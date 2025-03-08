import axios from 'axios';

/**
 * SOL 价格缓存类
 * 用于缓存 SOL 价格数据，减少 API 调用次数
 */
class SolPriceCache {
  // 缓存的价格
  private price: number | null;
  // 最后更新时间戳
  private lastUpdate: number;
  // 缓存持续时间（10分钟，以毫秒为单位）
  private readonly CACHE_DURATION: number;

  constructor() {
    this.price = null;
    this.lastUpdate = 0;
    this.CACHE_DURATION = 10 * 60 * 1000; // 10分钟，转换为毫秒
  }

  /**
   * 获取 SOL 价格
   * 优先使用缓存数据，缓存过期则重新获取
   * @returns Promise<number> SOL 当前价格
   * @throws Error 当 API 调用失败且没有可用缓存时抛出错误
   */
  public async getPrice(): Promise<number> {
    const now = Date.now();

    // 如果缓存存在且未过期，返回缓存的价格
    if (this.price && (now - this.lastUpdate) < this.CACHE_DURATION) {
      // console.log('Returning cached SOL price:', this.price);
      return this.price;
    }

    try {
      // 从 DexScreener API 获取最新价格
      const response = await axios.get<{
        [key: string]: { priceUsd: string }
      }>('https://api.dexscreener.com/tokens/v1/solana/So11111111111111111111111111111111111111112');

      // 解析响应数据获取 SOL 价格
      const solPrice = parseFloat(response.data[0].priceUsd);

      // 更新缓存
      this.price = solPrice;
      this.lastUpdate = now;

      // console.log('Fetched new SOL price:', this.price);
      return this.price;
    } catch (error) {
      console.error('获取 SOL 价格失败:', error);

      // API 调用失败时，如果有缓存则返回缓存的价格
      if (this.price !== null) {
        console.log('API 调用失败，返回缓存价格:', this.price);
        return this.price;
      }

      throw new Error('无法获取 SOL 价格且没有可用缓存');
    }
  }
}

// 导出单例实例
export const solPrice = new SolPriceCache();