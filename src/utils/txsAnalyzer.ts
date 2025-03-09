import BigNumber from 'bignumber.js';  // 改用 bignumber.js 库
import { solPrice } from './solPrice';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { USDC_ADDRESS, SOL_ADDRESS } from './swapProcessor';
import { DexScreener } from './dexscreener';
import { Connection, PublicKey } from '@solana/web3.js';
import { RPC_ENDPOINT, SUPABASE_KEY, SUPABASE_URL } from './config';
import { getTxsByTokenAddress } from './sqlite';

const supabaseUrl = SUPABASE_URL;
const supabaseKey = SUPABASE_KEY;
const rpcEndpoint = RPC_ENDPOINT;

const supabase = createClient(supabaseUrl, supabaseKey);

// 从 Supabase 数据库获取指定代币的交易记录
async function getTokenTxs(tokenAddress: any) {
  try {
    // 查询该代币的所有交易记
    const { data: txs } = await getTxsByTokenAddress(tokenAddress)
    if (!txs || txs.length === 0) {
      return {};
    }

    // 按账户地址对交易进行分组
    interface Transaction {
      account: string;
      token_in_address: string;
      token_in_amount: string;
      token_out_address: string;
      token_out_amount: string;
      timestamp: number;
    }

    const accountTxs: Record<string, Transaction[]> = {};
    txs.forEach((tx: any) => {
      if (!accountTxs[tx.account]) {
        accountTxs[tx.account] = [];
      }
      accountTxs[tx.account].push(tx);
    });

    return accountTxs;
  } catch (error) {
    console.error(`Error fetching txs for token ${tokenAddress}:`, error);
    throw error;
  }
}

// 获取代币的当前价格
async function getTokenPrice(tokenAddress: string) {
  try {
    // 如果是 SOL，使用 SOL 价格缓存
    if (tokenAddress === SOL_ADDRESS) {
      return new BigNumber(await solPrice.getPrice());
    }
    // 如果是 USDC，返回 1
    else if (tokenAddress === USDC_ADDRESS) {
      return new BigNumber(1);
    }
    // 其他代币使用 DexScreener 获取价格
    else {
      const tokenInfo = await DexScreener.getTokenInfo('solana', tokenAddress);
      return new BigNumber(tokenInfo.priceUSD || 0);
    }
  } catch (error) {
    console.error(`Error getting price for token ${tokenAddress}:`, error);
    return new BigNumber(0);
  }
}

// 获取代币的总供应量
async function getTokenSupply(tokenAddress: string) {
  try {
    // 连接到 Solana 网络
    const connection = new Connection(rpcEndpoint as string, 'confirmed');

    // 创建代币的 PublicKey
    const mintPubkey = new PublicKey(tokenAddress);

    // 获取代币信息
    const tokenInfo = await connection.getTokenSupply(mintPubkey);
    const totalSupply = tokenInfo.value.uiAmountString;

    // 如果无法获取则返回默认值
    return totalSupply || '1000000000';
  } catch (error) {
    console.error(`Error getting supply for token ${tokenAddress}:`, error);
    // 发生错误时返回默认值
    return '1000000000';
  }
}

// 将时间戳格式化为"多久之前"的形式
export function formatTimeAgo(timestamp: any) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  // 定义时间单位（秒）
  const minute = 60;
  const hour = minute * 60;
  const day = hour * 24;

  // 根据时间差返回对应的格式
  if (diff < minute) {
    return `${diff}s ago`;
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes}m ago`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diff / day);
    return `${days}d ago`;
  }
}
// 分析代币交易数据并计算关键指标
async function analyzeTxs(accountTxs: Record<string, any[]>, tokenAddress: string) {
  // 获取代币总供应量
  const totalSupply = new BigNumber(await getTokenSupply(tokenAddress));
  const result: Record<string, any> = {};

  // 遍历每个账户的交易
  for (const [account, txs] of Object.entries(accountTxs)) {
    // 分离买入和卖出交易
    const buyTxs = txs.filter(tx => tx.token_out_address === tokenAddress);
    const sellTxs = txs.filter(tx => tx.token_in_address === tokenAddress);

    // 如果没有买入交易则跳过
    if (buyTxs.length === 0) continue;

    // 初始化统计变量
    let totalBuyCost = new BigNumber(0);
    let totalBuyAmount = new BigNumber(0);
    let latestBuyTime = 0;

    // 计算买入相关数据
    for (const tx of buyTxs) {
      const tokenInPrice = await getTokenPrice(tx.token_in_address);
      const tokenInAmount = new BigNumber(tx.token_in_amount);
      const txCost = tokenInPrice.multipliedBy(tokenInAmount);

      totalBuyCost = totalBuyCost.plus(txCost);
      totalBuyAmount = totalBuyAmount.plus(new BigNumber(tx.token_out_amount));
      latestBuyTime = Math.max(latestBuyTime, tx.timestamp);
    }

    // 计算总卖出量
    const totalSellAmount = sellTxs.reduce(
      (sum, tx) => sum.plus(new BigNumber(tx.token_in_amount)),
      new BigNumber(0)
    );

    // 计算持有百分比
    const remainingAmount = BigNumber.maximum(0, totalBuyAmount.minus(totalSellAmount));
    const holdsPercentage = remainingAmount.dividedBy(totalBuyAmount).multipliedBy(100);

    // 计算平均买入价格
    const averageBuyPrice = totalBuyAmount.isZero() ?
      new BigNumber(0) :
      totalBuyCost.dividedBy(totalBuyAmount);
    // 计算买入时的平均市值
    const averageMarketCap = averageBuyPrice.multipliedBy(totalSupply);

    // 保存分析结果
    result[account] = {
      totalBuyCost: totalBuyCost.toFixed(0),
      averageBuyPrice: averageBuyPrice.toFixed(6),
      averageMarketCap: averageMarketCap.toFixed(0),
      buyTime: formatTimeAgo(latestBuyTime),
      holdsPercentage: holdsPercentage.toFixed(2) + '%'
    };
  }

  // 获取所有钱包地址
  const walletAddresses = Object.keys(result);

  // 从数据库查询钱包名称
  const { data: wallets } = await supabase
    .from('wallets')
    .select('address, name')
    .in('address', walletAddresses);

  // 创建地址到名称的映射
  const addressToName: Record<string, string> = {};
  if (wallets) {
    wallets.forEach(wallet => {
      addressToName[wallet.address] = wallet.name;
    });
  }

  // 将钱包名称添加到分析结果中
  const resultWithNames = Object.entries(result).reduce<Record<string, any>>((acc, [address, data]) => {
    acc[address] = {
      totalBuyCost: data.totalBuyCost,
      averageBuyPrice: data.averageBuyPrice,
      averageMarketCap: data.averageMarketCap,
      buyTime: data.buyTime,
      holdsPercentage: data.holdsPercentage,
      walletName: addressToName[address] || 'Unknown'
    };
    return acc;
  }, {});

  return resultWithNames;
}

// 主函数：分析指定代币的所有交易
export async function analyzeTokenTxs(tokenAddress: string) {
  try {
    const transactionData = await getTokenTxs(tokenAddress);
    const analysis = await analyzeTxs(transactionData, tokenAddress);
    return analysis;
  } catch (error) {
    console.error(`Error analyzing transactions for token ${tokenAddress}:`, error);
    throw error;
  }
}

