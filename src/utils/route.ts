// 导入所需的依赖
import { createClient } from '@supabase/supabase-js';
import { processSwapData } from './swapProcessor';
import { solParser } from './txParser';
import { HELIUS_API_KEY, SUPABASE_KEY, SUPABASE_URL } from './config';

// 初始化 Supabase 客户端
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * 处理 Webhook 请求的主函数
 * 主要功能:
 * 1. 验证请求方法和授权
 * 2. 解析交易数据
 * 3. 处理 SWAP 交易
 * 4. 存储交易数据到数据库
 */
export const handleWebhookRequest = async (req: any, res: any) => {
  try {
    // 验证请求方法
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // 验证请求头中的 API Key
    if (req.headers.authorization !== `Bearer ${HELIUS_API_KEY}`) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 处理 webhook 数据
    await processWebhookData(req.body);

    // 返回成功响应
    return res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * 处理 Webhook 数据的具体实现
 * @param {Object} data - Webhook 请求数据
 */
async function processWebhookData(data: any) {
  // 获取并检查交易数据
  const txData = Array.isArray(data) ? data[0] : data;
  if (!txData) {
    console.error('Empty transaction data received', txData);
    throw new Error('Empty data received');
  }

  // 处理交易数据
  let processedData = null;

  // 根据不同数据来源处理交易
  if (txData.events?.swap) {
    // 使用 Helius 解析器处理 SWAP 事件
    processedData = processSwapData(txData);
  } else if (txData.signature) {
    // 使用 Solana 解析器处理交易签名
    processedData = await solParser(txData.signature);
    if (!processedData) {
      console.error('Failed to parse tx:', txData.signature);
      throw new Error(`Parse failed for signature: ${txData.signature}`);
    }
  } else {
    // 如果没有 SWAP 数据则跳过
    throw new Error('No swap data found');
  }

  // 将处理后的数据存储到 Supabase 数据库
  const { error } = await supabase.from('txs').insert([{
    ...processedData,
    signature: txData.signature
  }]);

  // 处理数据库插入错误
  if (error) {
    console.error('Error inserting into Supabase:', error);
    throw error;
  }

  // 记录成功信息
  console.log('Successfully processed and stored with parser:', txData.events?.swap ? 'helius' : 'shyft');
}