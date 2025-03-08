import dotenv from 'dotenv';
import { Helius } from 'helius-sdk';
import { TransactionType, WebhookType } from 'helius-sdk';
import { createClient } from '@supabase/supabase-js';
import { HELIUS_API_KEY, SUPABASE_KEY, SUPABASE_URL, WEBHOOK_URL } from '../utils/config';

// 加载环境变量配置
dotenv.config();

// 初始化 Supabase 客户端连接
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);



// 检查 Helius API Key 是否存在
if (!HELIUS_API_KEY) {
  throw new Error('HELIUS_API_KEY is not defined in environment variables.');
}

// 创建 Helius 实例
const helius = new Helius(HELIUS_API_KEY);

/**
 * 设置 SWAP 类型的 Webhook
 * 主要功能:
 * 1. 从 Supabase 获取需要监控的钱包地址
 * 2. 配置 Webhook 参数
 * 3. 创建 Helius Webhook
 */
export const setupSwapWebhook = async () => {
  try {
    // 从 Supabase 数据库获取钱包地址
    const { data, error } = await supabase.from('wallets').select('address');
    if (error) {
      throw new Error('Failed to fetch wallet addresses from Supabase');
    }

    // 提取并过滤有效的钱包地址
    const accountAddresses = data.map(row => row.address).filter(addr => addr);

    // 检查是否存在有效的钱包地址
    if (accountAddresses.length === 0) {
      throw new Error('No valid wallet addresses found in wallets.txt.');
    }

    // 创建 Webhook 配置对象
    const webhookConfig = {
      accountAddresses,          // 监控的钱包地址列表
      transactionTypes: [TransactionType.SWAP],  // 只监控 SWAP 类型交易
      webhookURL: WEBHOOK_URL,   // Webhook 回调地址
      authHeader: `Bearer ${HELIUS_API_KEY}`,    // 认证头
      webhookType: WebhookType.ENHANCED,         // 使用增强型 Webhook
    };

    // 调用 Helius API 创建 Webhook
    const response = await helius.createWebhook(webhookConfig);
    console.log('Webhook created successfully:', response);
  } catch (error) {
    console.error('Error creating webhook:', error);
  }
};
