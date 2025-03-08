import BigNumber from 'bignumber.js';  // 改用 bignumber.js 库

// 定义 SOL 代币的地址常量
export const SOL_ADDRESS = 'So11111111111111111111111111111111111111112';
// 定义 USDC 代币的地址常量
export const USDC_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/**
 * 格式化代币金额，将原始金额除以对应的小数位数
 * @param {string|number} amount - 原始代币金额
 * @param {number} decimals - 代币的小数位数
 * @returns {string} 格式化后的金额
 */
export function formatAmount(amount: string | number, decimals: number): string {
  return new BigNumber(amount)
    .dividedBy(new BigNumber(10).pow(decimals))
    .toFixed();
}

/**
 * 处理交换事件数据，将 webhook 数据转换为标准格式
 * @param {Object} webhookData - webhook 原始数据
 * @returns {SwapData} 处理后的标准格式数据
 */

// 定义交易数据接口
interface SwapData {
  account: string;
  token_in_address: string;
  token_in_amount: string;
  token_out_address: string;
  token_out_amount: string;
  timestamp: number;
  description: string;
}

export function processSwapData(webhookData: any): SwapData {
  const swapEvent = webhookData.events.swap;
  let processedData: SwapData = {
    account: '',
    token_in_address: '',
    token_in_amount: '',
    token_out_address: '',
    token_out_amount: '',
    timestamp: 0,
    description: ''
  };

  // 处理输入代币信息
  if (swapEvent.nativeInput && swapEvent.nativeInput.amount) {
    // 处理原生 SOL 代币输入
    processedData.account = webhookData.feePayer;          // 支付手续费的账户
    processedData.token_in_address = SOL_ADDRESS;          // 输入代币地址（SOL）
    processedData.token_in_amount = formatAmount(parseInt(swapEvent.nativeInput.amount), 9);  // SOL 有 9 位小数
  } else if (swapEvent.tokenInputs && swapEvent.tokenInputs.length > 0) {
    // 处理其他代币输入
    const tokenInput = swapEvent.tokenInputs[0];
    processedData.account = webhookData.feePayer;          // 支付手续费的账户
    processedData.token_in_address = tokenInput.mint;      // 输入代币的铸造地址
    processedData.token_in_amount = formatAmount(
      parseInt(tokenInput.rawTokenAmount.tokenAmount),
      tokenInput.rawTokenAmount.decimals    // 使用代币自身的小数位数
    );
  }

  // 处理输出代币信息
  if (swapEvent.nativeOutput && swapEvent.nativeOutput.amount) {
    // 处理原生 SOL 代币输出
    processedData.token_out_address = SOL_ADDRESS;
    processedData.token_out_amount = formatAmount(parseInt(swapEvent.nativeOutput.amount), 9);
  } else if (swapEvent.tokenOutputs && swapEvent.tokenOutputs.length > 0) {
    // 处理其他代币输出
    const tokenOutput = swapEvent.tokenOutputs[0];
    processedData.token_out_address = tokenOutput.mint;
    processedData.token_out_amount = formatAmount(
      parseInt(tokenOutput.rawTokenAmount.tokenAmount),
      tokenOutput.rawTokenAmount.decimals
    );
  }

  // 添加时间戳和描述信息
  processedData.timestamp = webhookData.timestamp;    // 交易时间戳
  processedData.description = webhookData.description; // 交易描述

  console.log(`processedData is:${JSON.stringify(processedData)}`)
  return processedData;
}
