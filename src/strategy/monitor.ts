import { DexScreener } from '../utils/dexscreener.js';
import { SOL_ADDRESS, USDC_ADDRESS } from '../utils/swapProcessor';
import { sendTelegramMessage } from '../utils/telegram';
import { analyzeTokenTxs } from '../utils/txsAnalyzer';
import { createMsg } from './messageTemplate';
import { sendSumMessage } from '../utils/aiSummary';
import { TELEGRAM_CHANNEL_ID } from '../utils/config';
import { getNewTransactions, getOtherWalletTransactions, getPreviousPurchases } from '../utils/sqlite';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { insertCaRecord, queryCaByAddress } from '../utils/ca';

dotenv.config();

const getTimeStamp = () => {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
};

// Configuration constants
const MAX_AGE_DAYS = 2;
const MIN_MARKET_CAP = 100000; // 100k

// Check if token meets filtering criteria
/**
 * 检查代币是否满足过滤条件并发送分析结果
 * @param {string} tokenAddress - 代币地址
 */
async function checkFilter(tokenAddress: string) {
  try {
    // 获取代币信息
    const tokenInfo = await DexScreener.getTokenInfo('solana', tokenAddress);
    if (!tokenInfo) return;

    // 计算代币交易对的存在时间(天)
    const pairAge = (Date.now() / 1000 - tokenInfo.createdAt) / (60 * 60 * 24);


    // 检查代币是否满足年龄和市值条件
    if (pairAge <= MAX_AGE_DAYS && tokenInfo.marketCap >= MIN_MARKET_CAP) {
      logger.info(`checkFilter name:${tokenInfo.name} symbol:${tokenInfo.symbol} PairAge:${pairAge} mc:${tokenInfo.marketCap}  need warning`)

      // 分析代币的交易数据
      const analysis = await analyzeTokenTxs(tokenAddress);

      // 创建并发送Telegram消息
      const message = createMsg(tokenInfo, analysis);
      const tgResponse = await sendTelegramMessage(message, TELEGRAM_CHANNEL_ID);

      // 如果消息发送成功，并且是首次发现该代币，才发送AI总结
      if (tgResponse?.ok === true) {
        const messageId = tgResponse.result.message_id;
        // 检查是否首次发现该代币
        const isFirstDiscovery = !(await queryCaByAddress(tokenAddress));

        // 如果这是首次发现该代币的交易，发送AI总结
        if (isFirstDiscovery) {
          await sendSumMessage(tokenInfo, messageId);
          await insertCaRecord({ address: tokenAddress, isAiSum: true })
        }

        logger.info(`[${getTimeStamp()}] Successfully sent analysis for token ${tokenAddress} to Telegram isFirstDiscover:${isFirstDiscovery}`);
      } else {
        logger.info(`Failed to send warning message to telgram`)
      }
    }
  } catch (error) {
    // 记录错误信息
    logger.error(`[${getTimeStamp()}] Error checking token ${tokenAddress}:`, error);
  }
}

// /**
//  * 监控SQLite交易表的变化，分析钱包买入行为
//  * 主要功能:
//  * 1. 定期轮询SQLite数据库检查新交易
//  * 2. 当账户首次买入代币或其他账户买入同一代币时触发告警
//  * 3. 每个监控会话中，相同代币只告警一次
//  */
// export async function startMonitor() {
//   // 记录上次检查的时间戳
//   // datetime('now') 返回的是 UTC 时间的字符串格式,如 "2024-01-01 12:00:00"
//   // Date.now()/1000 返回的是 Unix 时间戳(秒)
//   // 数据库中 timestamp 字段存储的是 Unix 时间戳,所以这里使用 Date.now()/1000 是正确的
//   let lastCheckTimestamp = Math.floor(Date.now() / 1000);
//   // 存储已经告警的代币地址集合
//   const alertedTokens = new Set<string>();

//   // 每5秒检查一次新交易
//   setInterval(async () => {
//     try {
//       // 查询新插入的交易记录
//       const newTxs = await getNewTransactions(lastCheckTimestamp);

//       // 处理每条新交易
//       for (const tx of newTxs) {
//         const {
//           token_out_address: tokenOutAddress,  // 买入的代币地址
//           account: currentAccount,             // 当前交易账户
//           timestamp: currentTimestamp          // 交易时间戳
//         } = tx;

//         // 检查是否为代币买入交易(排除SOL和USDC)
//         if (tokenOutAddress === SOL_ADDRESS || tokenOutAddress === USDC_ADDRESS) {
//           continue;
//         }

//         // 跳过已告警的代币
//         if (alertedTokens.has(tokenOutAddress)) {
//           logger.info(`address:[${tokenOutAddress} has alerted]`)
//           continue;
//         }

//         // 检查告警条件
//         const shouldAlert = await checkAlertConditions(currentAccount, tokenOutAddress, lastCheckTimestamp);

//         if (shouldAlert.alert) {
//           logger.info(`[${getTimeStamp()}] 检测到告警条件: ${shouldAlert.reason} - 代币: ${tokenOutAddress}, 账户: ${currentAccount}`);

//           // 触发代币分析和消息推送
//           await checkFilter(tokenOutAddress);
//           // 将代币加入已告警集合
//           alertedTokens.add(tokenOutAddress);
//         } else {
//           logger.info(`address:[${tokenOutAddress} alert:false]`)
//         }
//       }

//       // 更新最后检查时间戳
//       if (newTxs.length > 0) {
//         lastCheckTimestamp = Math.max(...newTxs.map((tx: any) => tx.timestamp));
//       }
//     } catch (error) {
//       logger.error(`[${getTimeStamp()}] 监控程序错误:`, error);
//     }
//   }, 5000); // 5秒轮询间隔

//   logger.info(`[${getTimeStamp()}] 交易监控已启动...`);
// }

// /**
//  * 检查是否需要触发告警
//  * @param currentAccount - 当前交易账户
//  * @param tokenAddress - 代币地址
//  * @param lastCheckTimestamp - 上次检查时间戳
//  * @returns {Promise<{alert: boolean, reason: string}>} - 返回是否需要告警及原因
//  */
// async function checkAlertConditions(
//   currentAccount: string,
//   tokenAddress: string,
//   lastCheckTimestamp: number
// ): Promise<{ alert: boolean, reason: string }> {
//   // 检查账户历史购买记录
//   const previousPurchases = await getPreviousPurchases(currentAccount, tokenAddress, lastCheckTimestamp);

//   // 如果是首次购买
//   if (previousPurchases.length === 0) {
//     return {
//       alert: true,
//       reason: '账户首次买入该代币'
//     };
//   }

//   // 检查其他账户是否在最近时间窗口内购买过该代币
//   const otherAccountPurchases = await getOtherWalletTransactions(
//     tokenAddress,
//     currentAccount,
//     lastCheckTimestamp
//   );

//   logger.info(`otherAccountPurchases:${JSON.stringify(otherAccountPurchases)}`)
//   if (otherAccountPurchases.length > 0) {
//     return {
//       alert: true,
//       reason: '其他账户已购买过该代币'
//     };
//   }

//   return {
//     alert: false,
//     reason: ''
//   };
// }

// 启动监控
// startMonitor().catch(error => {
//   console.error(`[${getTimeStamp()}] 监控程序启动错误:`, error);
//   process.exit(1);
// });

export async function trigerMonitor(tokenOutAddress: string) {

  // Check if it's not SOL or USDC (buy transaction)
  if (tokenOutAddress !== SOL_ADDRESS && tokenOutAddress !== USDC_ADDRESS) {
    await checkFilter(tokenOutAddress);
  }

}
