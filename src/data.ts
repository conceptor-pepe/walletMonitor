import { logger } from "./logger"

// 定义代币信息接口
export interface VipTokenInfo {
  address: string      // 代币地址
  symbol: string       // 代币符号
  gmHotLevel: number   // GM热度等级
  top10HolderRatio: number  // 前10持有者比例
  mouseRatio: number   // 鼠仔比例
  top10Bro: string | null   // 前10兄弟情况
  top50SmartMoney: string | null  // 前50聪明钱包
}

// 创建数据库连接
export function createDatabase(dbPath: string) {
  const sqlite3 = require('sqlite3').verbose();
  return new sqlite3.Database(dbPath);
}

// 初始化数据库表
export async function initDatabase(db: any): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS vip_tokens (
      address TEXT PRIMARY KEY,    -- 代币地址，作为主键
      symbol TEXT,                 -- 代币符号
      gmHotLevel INTEGER,         -- GM热度等级
      top10HolderRatio REAL,      -- 前10持有者比例
      mouseRatio REAL,            -- 鼠仔比例
      top10Bro TEXT,              -- 前10兄弟情况
      top50SmartMoney TEXT        -- 前50聪明钱包
    )
  `;

  return new Promise((resolve, reject) => {
    db.run(sql, (err: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 添加或更新代币信息
export async function addToken(db: any, token: VipTokenInfo): Promise<void> {
  const sql = `
    INSERT OR REPLACE INTO vip_tokens 
    (address, symbol, gmHotLevel, top10HolderRatio, mouseRatio, top10Bro, top50SmartMoney)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  logger.info(`addToken: ${token.address} symbol: ${token.symbol} gm热度: ${token.gmHotLevel} 前十holder占比: ${token.top10HolderRatio} 老鼠仓占比: ${token.mouseRatio} 前十兄弟: ${token.top10Bro} 前五十聪明钱: ${token.top50SmartMoney}`)
  return new Promise((resolve, reject) => {
    db.run(sql, [
      token.address,
      token.symbol,
      token.gmHotLevel,
      token.top10HolderRatio,
      token.mouseRatio,
      token.top10Bro,
      token.top50SmartMoney
    ], (err: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// 查询单个代币信息
export async function getToken(db: any, address: string): Promise<VipTokenInfo | null> {
  const sql = `SELECT * FROM vip_tokens WHERE address = ?`;

  return new Promise((resolve, reject) => {
    db.get(sql, [address], (err: Error, row: any) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

// 获取所有代币信息
export async function getAllTokens(db: any): Promise<VipTokenInfo[]> {
  const sql = `SELECT * FROM vip_tokens`;

  return new Promise((resolve, reject) => {
    db.all(sql, [], (err: Error, rows: any[]) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// 删除代币信息
export async function deleteToken(db: any, address: string): Promise<void> {
  const sql = `DELETE FROM vip_tokens WHERE address = ?`;

  return new Promise((resolve, reject) => {
    db.run(sql, [address], (err: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

