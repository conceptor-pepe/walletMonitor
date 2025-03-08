import axios from 'axios';
import dotenv from 'dotenv';
import { SHYFT_API_KEY } from './config';

dotenv.config();

// 使用 Shyft API 解析 Solana 交易数据
export async function solParser(signature: any) {
  // Shyft API 的基础 URL
  const BASE_URL = "https://api.shyft.to/sol/v1";

  // 调用 Shyft API 获取交易解析数据
  const response = await axios.get(`${BASE_URL}/transaction/parsed`, {
    params: {
      network: 'mainnet-beta',  // 使用主网
      txn_signature: signature  // 交易签名
    },
    headers: {
      'x-api-key': SHYFT_API_KEY  // 使用 API 密钥进行认证
    }
  }).catch(error => {
    console.error('Error fetching transaction:', error);
    return { data: null };
  });

  // 如果响应为空则返回 null
  if (!response || !response.data) {
    return null;
  }

  // 检查是否成功且为 SWAP 类型交易
  if (response.data.success && response.data.result) {
    const result = response.data.result;
    console.log(JSON.stringify(result, null, 2));

    // 查找包含代币交换信息的动作
    const swapAction = result.actions.find((action: any) =>
      action.info && action.info.tokens_swapped
    );

    if (swapAction) {
      // 将 ISO 时间戳转换为秒级时间戳
      const timestamp = Math.floor(new Date(result.timestamp).getTime() / 1000);

      // 返回标准化的交易数据
      return {
        account: swapAction.info.swapper,                                    // 交换发起账户
        token_in_address: swapAction.info.tokens_swapped.in.token_address,  // 输入代币地址
        token_in_amount: swapAction.info.tokens_swapped.in.amount,          // 输入代币数量
        token_out_address: swapAction.info.tokens_swapped.out.token_address,// 输出代币地址
        token_out_amount: swapAction.info.tokens_swapped.out.amount,        // 输出代币数量
        timestamp: timestamp,                                               // 交易时间戳
        description: null                                                   // 交易描述(可选)
      };
    }
  }

  // 如果不是交换交易则返回原始响应数据
  return response.data;
}
