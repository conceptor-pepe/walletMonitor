import { addToken, getToken, VipTokenInfo } from "./data"
import { logger } from "./logger"
import { db } from "./main"


const axios = require('axios')

/**
 * 发送消息到Telegram
 * @param formattedText 要发送的格式化文本内容(支持HTML或Markdown格式)
 * @param chatId 目标聊天ID,默认为指定群组
 */
export async function sendMessageToTelegram(formattedText: string, chatId: string = '-4653203065') {
  let axiosInstance = axios

  // Telegram Bot API URL
  const url = `https://api.telegram.org/bot5468947096:AAHjqcA8IPi-4y6keSxKueNIaPHfWNL-6wM/sendMessage`

  // 构建请求参数
  const payload = {
    chat_id: chatId,
    text: formattedText,
    // 支持HTML或Markdown格式,根据消息内容选择
    parse_mode: formattedText.includes('<') ? 'HTML' : 'Markdown',
    disable_web_page_preview: true,
  }

  try {
    // 发送POST请求到Telegram API
    const response = await axiosInstance.post(url, payload)
  } catch (error) {
    console.error('发送消息失败:', error)
  }
}


export async function parseGongyueMessage(message: any) {
  const text = message.content.text?.text
  if (text == undefined || text == null || !text.includes('monitor404')) {
    return
  }

  logger.info(`text: ${text}`)
  let result: VipTokenInfo = {
    address: '',
    symbol: '',
    gmHotLevel: 0,
    top10HolderRatio: 0,
    mouseRatio: 0,
    top10Bro: '',
    top50SmartMoney: ''
  }

  //monitor404
  // 🔥🔥🔥
  // monitor404
  // ---------------------
  // 代币：SFM
  // 合约：5HyvguGZmLiss9fMpdrUf5LiH6iy14bxskuV6fSJpump
  // 创建时间：1 小时
  // 市值：1.77m
  // 池子：157.85k
  // 持币人数：7075人
  // gm热度等级：3
  // 前十holder占比：2.0%
  // 老鼠仓占比：4.4%
  // 前十大哥：无
  // 前五十聪明钱：无

  //开始解析上面的内容

  // 拆分消息为行数组
  const lines = text.split('\n');

  // 定义需要忽略的标题行标识
  const IGNORE_PREFIXES = ['🔥', 'monitor404', '-', '='];

  lines.forEach((line: any) => {
    const trimmedLine = line.trim();

    // 跳过空行和标题行
    if (!trimmedLine || IGNORE_PREFIXES.some(prefix => trimmedLine.startsWith(prefix))) {
      return;
    }

    // 分割键值对
    const separatorIndex = trimmedLine.indexOf('：'); // 注意使用中文冒号
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();
    applyValueToResult(key, value, result)
  });

  // 将结果添加到数据库
  await addToken(db, result);

  // sendMessageToTelegram(`${text}`)
  return result;

}

//根据key value解析结果
function applyValueToResult(key: string, value: string, result: VipTokenInfo): void {
  const numValue = parseFloat(value);

  switch (true) {
    case key === '代币':
      result.symbol = value;
      break;

    case key === '合约':
      result.address = value;
      break;

    case key.includes('热度等级'):
      result.gmHotLevel = Number.isInteger(numValue) ? numValue : 0;
      break;

    case key.includes('holder占比'):
      result.top10HolderRatio = numValue || 0;
      break;

    case key.includes('老鼠仓占比'):
      result.mouseRatio = numValue || 0;
      break;

    case key === '前十大哥':
      result.top10Bro = value;
      break;

    case key === '前五十聪明钱':
      result.top50SmartMoney = value;
      break;
  }
}

//解析mason群的message ca地址
export function extractMasonCAAddress(text: any) {
  if (text == undefined || text == null || !text.includes('CA')) {
    return
  }

  // 方法1：直接匹配CA行
  const caLineMatch = text.match(/🔥CA:\s*([A-Za-z0-9]+)/);
  if (caLineMatch) {
    return caLineMatch[1];
  }

  // 方法2：从URL中提取（备用方案）
  const urlMatch = text.match(/token\/solana\/\d+_([A-Za-z0-9]+)/);
  return urlMatch ? urlMatch[1] : null;
}

export interface MasonWarningInfo {
  address: string
  walletInfo: string[]
}

export async function parseMasonMessage(message: any) {
  const text = message.content.text?.text
  if (text == undefined || text == null || !text.includes('钱包列表')) {
    return
  }

  let warningInfo: MasonWarningInfo = {
    address: '',
    walletInfo: []
  }
  const caAddress = extractMasonCAAddress(text)
  const walletInfo = extractMasonWalletInfo(text)

  logger.info(`caAddress: ${caAddress} walletInfo: ${JSON.stringify(walletInfo)}`)

  //查询token是否已经在数据库
  const tokenInfo = await getToken(db, caAddress)
  if (!tokenInfo) {
    logger.info(`Not Find it in the database:  ${JSON.stringify(tokenInfo)}`)
    return null
  }

  warningInfo.walletInfo = walletInfo
  warningInfo.address = caAddress

  // 发送消息到Telegram
  sendMessageToTelegram(formatAlertMessage(tokenInfo, warningInfo))

  return warningInfo
}

function extractMasonWalletInfo(text: any) {
  const regex = /├钱包:.*?\((MC:[^)]+\))/g;
  const matches = text.match(regex);
  if (matches) {

    return matches;
  }
  return [];
}

function formatAlertMessage(tokenInfo: any, masonWarning: MasonWarningInfo) {
  // 基础信息区块
  const header = `🚨 **代币交易告警** 🚨\n━━━━━━━━━━━━━━━━━━━━`;

  // 代币信息区块
  const tokenSection = [
    '🪙 **代币信息**',
    `▫️ 名称：\`${tokenInfo.symbol}\`  `,
    `▫️ 合约：\`${tokenInfo.address}\`  `,
    `▫️ 热度等级：${tokenInfo.gmHotLevel}  `,
    `▫️ 老鼠仓占比：${tokenInfo.mouseRatio}%  `
  ].join('\n');

  let walletInfo = '\n💸 **大额买入监控**\n' + masonWarning.walletInfo.join('\n')
  // 链接区块
  const linksSection = [
    '\n🔗 **相关链接**',
    `[dexscreener](https://dexscreener.com/solana/${tokenInfo.address})`,
  ].join('\n');

  return [
    header,
    tokenSection,
    walletInfo,
    linksSection
  ].join('\n');
}


