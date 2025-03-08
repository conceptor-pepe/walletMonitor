import axios from 'axios';
import axiosRetry from 'axios-retry';

// Create axios client with custom configuration
const client = axios.create({
  timeout: 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0'
  }
});

// Configure retry mechanism
axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    // Custom retry conditions
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNRESET';
  }
});

// 定义代币信息的接口类型
interface TokenData {
  baseToken: {
    name: string;
    symbol: string;
    address: string;
  };
  chainId: string;
  liquidity?: {
    usd: number;
  };
  marketCap: number;
  priceUsd: number;
  pairCreatedAt: number;
  volume?: {
    h24?: number;
    h6?: number;
    h1?: number;
    m5?: number;
  };
  priceChange?: {
    h6?: number;
  };
  info?: {
    websites?: Array<{ url: string }>;
    socials?: Array<{ type: string; url: string }>;
  };
}

// Token information class to parse and store token data
export class TokenInfo {
  name: string;
  symbol: string;
  address: string;
  chain: string;
  liquidity?: number;
  marketCap: number;
  priceUSD: number;
  createdAt: number;
  volumeH24?: number;
  volumeH6?: number;
  volumeH1?: number;
  volumeM5?: number;
  changeH6?: number;
  website?: string;
  twitter?: string;

  constructor(data: TokenData[]) {
    const pair = data[0];
    const baseToken = pair.baseToken;

    this.name = baseToken.name;
    this.symbol = baseToken.symbol;
    this.address = baseToken.address;
    this.chain = pair.chainId;
    this.liquidity = pair.liquidity?.usd;
    this.marketCap = pair.marketCap;
    this.priceUSD = pair.priceUsd;
    this.createdAt = Math.floor(pair.pairCreatedAt / 1000);  // Convert to seconds timestamp

    // Volume data
    const volume = pair.volume || {};
    this.volumeH24 = volume.h24;
    this.volumeH6 = volume.h6;
    this.volumeH1 = volume.h1;
    this.volumeM5 = volume.m5;

    // Price changes
    this.changeH6 = pair.priceChange?.h6;

    // Website and social media info
    if (pair.info) {
      this.website = pair.info.websites?.[0]?.url;

      const twitter = pair.info.socials?.find(s => s.type === 'twitter');
      this.twitter = twitter?.url;
    }
  }
}

// DexScreener API wrapper class
export class DexScreener {
  // Fetches token information from DexScreener API
  static async getTokenInfo(chainId: string, tokenAddress: string): Promise<TokenInfo> {
    const response = await client.get<TokenData[]>(
      `https://api.dexscreener.com/tokens/v1/${chainId}/${tokenAddress}`
    ).catch(error => {
      console.error('DexScreener API Error:', error.message);
      throw error;
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No data returned from DexScreener');
    }

    return new TokenInfo(response.data);
  }
}

