import { DexScreener } from '../utils/dexscreener.js';
import { createClient } from '@supabase/supabase-js';
import { SOL_ADDRESS, USDC_ADDRESS } from '../utils/swapProcessor';
import { sendTelegramMessage } from '../utils/telegram';
import { analyzeTokenTxs } from '../utils/txsAnalyzer';
import { createMsg } from './messageTemplate';
import { sendSumMessage } from '../utils/aiSummary';
import dotenv from 'dotenv';
import { SUPABASE_KEY, SUPABASE_URL, TELEGRAM_CHANNEL_ID } from '../utils/config';

dotenv.config();
const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configuration constants
const MAX_AGE_DAYS = 2;
const MIN_MARKET_CAP = 100000; // 100k

const getTimeStamp = () => {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
};

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
      // 分析代币的交易数据
      const analysis = await analyzeTokenTxs(tokenAddress);

      // 创建并发送Telegram消息
      const message = createMsg(tokenInfo, analysis);
      const tgResponse = await sendTelegramMessage(message, TELEGRAM_CHANNEL_ID);

      // 如果消息发送成功
      if (tgResponse?.ok === true) {
        const messageId = tgResponse.result.message_id;
        // 发送AI总结消息
        await sendSumMessage(tokenInfo, messageId);
        console.log(`[${getTimeStamp()}] Successfully sent analysis for token ${tokenAddress} to Telegram`);
      }
    }
  } catch (error) {
    // 记录错误信息
    console.error(`[${getTimeStamp()}] Error checking token ${tokenAddress}:`, error);
  }
}
/**
 * 监控交易表的插入事件，分析多钱包买入行为
 * 主要功能:
 * 1. 监听新交易插入
 * 2. 分析是否有多个钱包在6小时内买入同一代币
 * 3. 符合条件时触发代币分析和消息推送
 */
export async function startMonitor() {
  supabase
    .channel('txs_monitor')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',      // 监听插入事件
        schema: 'public',     // 公共模式
        table: 'txs',         // 交易表
      },
      async (payload) => {
        // 解析新交易数据
        const newTx = payload.new;
        const tokenOutAddress = newTx.token_out_address;  // 买入的代币地址
        const currentAccount = newTx.account;             // 当前交易账户
        const currentTimestamp = newTx.timestamp;         // 交易时间戳

        // 检查是否为代币买入交易(排除SOL和USDC)
        if (tokenOutAddress !== SOL_ADDRESS && tokenOutAddress !== USDC_ADDRESS) {
          // 计算6小时前的时间戳
          const sixHoursAgo = new Date(currentTimestamp);
          sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
          const sixHoursAgoTimestamp = Math.floor(sixHoursAgo.getTime() / 1000);

          // 查询6小时内是否有其他钱包买入同一代币
          const { data, error } = await supabase
            .from('txs')
            .select('*')
            .eq('token_out_address', tokenOutAddress)    // 相同代币
            .neq('account', currentAccount)              // 不同钱包
            .gte('timestamp', sixHoursAgoTimestamp)      // 6小时内
            .limit(1);                                   // 只需要确认存在性

          // 处理查询错误
          if (error) {
            console.error(`[${getTimeStamp()}] Query error:`, error);
            return;
          }

          // 如果发现其他钱包的买入记录
          if (data && data.length > 0) {
            console.log(`[${getTimeStamp()}] Detected new multi-wallet transaction for token: ${tokenOutAddress}`);
            // 触发代币分析和消息推送
            await checkFilter(tokenOutAddress);
          }
        }
      }
    )
    // 错误处理
    // .on('error', (error: string, context: any, channel: any) => {
    //   console.error(`[${getTimeStamp()}] Supabase realtime connection error:`, error, context, channel);
    // })
    // 订阅状态处理
    .subscribe((status) => {
      console.log(`[${getTimeStamp()}] Monitoring started... Subscription status:`, status);
    })
}

// // Start monitoring
// startMonitor().catch(error => {
//   console.error(`[${getTimeStamp()}] Monitor program error:`, error);
//   process.exit(1);
// });


