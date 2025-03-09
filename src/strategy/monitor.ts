import { DexScreener } from '../utils/dexscreener.js';
import { SOL_ADDRESS, USDC_ADDRESS } from '../utils/swapProcessor';
import { sendTelegramMessage } from '../utils/telegram';
import { analyzeTokenTxs } from '../utils/txsAnalyzer';
import { createMsg } from './messageTemplate';
import { sendSumMessage } from '../utils/aiSummary';
import { TELEGRAM_CHANNEL_ID } from '../utils/config';
import { getNewTransactions, getOtherWalletTransactions } from '../utils/sqlite';
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
    logger.info(`symbol:${tokenInfo.symbol} PairAge:${pairAge} mc:${tokenInfo.marketCap}`)

    // 检查代币是否满足年龄和市值条件
    if (pairAge <= MAX_AGE_DAYS && tokenInfo.marketCap >= MIN_MARKET_CAP) {
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
      }
    }
  } catch (error) {
    // 记录错误信息
    logger.error(`[${getTimeStamp()}] Error checking token ${tokenAddress}:`, error);
  }
}

/**
 * 监控SQLite交易表的变化，分析多钱包买入行为
 * 主要功能:
 * 1. 定期轮询SQLite数据库检查新交易
 * 2. 分析是否有多个钱包在6小时内买入同一代币 //目前改为单个钱包就告警
 * 3. 符合条件时触发代币分析和消息推送
 */
export async function startMonitor() {

  // 记录上次检查的时间戳
  let lastCheckTimestamp = Math.floor(Date.now() / 1000);

  // 每5秒检查一次新交易
  setInterval(async () => {
    try {
      // 查询新插入的交易记录
      const newTxs = await getNewTransactions(lastCheckTimestamp);

      // 处理每条新交易
      for (const newTx of newTxs) {
        const tokenOutAddress = newTx.token_out_address;  // 买入的代币地址
        const currentAccount = newTx.account;             // 当前交易账户
        const currentTimestamp = newTx.timestamp;         // 交易时间戳

        // 检查是否为代币买入交易(排除SOL和USDC)
        if (tokenOutAddress !== SOL_ADDRESS && tokenOutAddress !== USDC_ADDRESS) {
          // 计算6小时前的时间戳
          const sixHoursAgo = Math.floor(currentTimestamp - 6 * 60 * 60);

          // 查询6小时内是否有其他钱包买入同一代币
          const otherWalletTxs = await getOtherWalletTransactions(
            tokenOutAddress,
            currentAccount,
            sixHoursAgo
          );

          // 如果发现其他钱包的买入记录
          if (otherWalletTxs.length > 0) {
            console.log(`[${getTimeStamp()}] 检测到多钱包交易代币: ${tokenOutAddress}`);
            // 触发代币分析和消息推送
            await checkFilter(tokenOutAddress);
          }
        }
      }

      // 更新最后检查时间戳
      if (newTxs.length > 0) {
        lastCheckTimestamp = Math.max(...newTxs.map((tx: any) => tx.timestamp));
      }

    } catch (error) {
      console.error(`[${getTimeStamp()}] 监控程序错误:`, error);
    }
  }, 5000); // 5秒轮询间隔

  console.log(`[${getTimeStamp()}] 交易监控已启动...`);
}

// 启动监控
// startMonitor().catch(error => {
//   console.error(`[${getTimeStamp()}] 监控程序启动错误:`, error);
//   process.exit(1);
// });


