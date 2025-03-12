import sqlite3 from 'sqlite3';
import { Database } from 'sqlite';
import { db } from './sqlite';

// 定义记录类型
interface CaRecord {
  address: string;      // 地址
  isAiSum: boolean;     // AI 总结标志
  warningTime: string;  // 警告时间
}

/**
 * 初始化 ca_records 表
 * 如果表不存在则创建
 */
export async function initCaTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS ca_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,  -- 主键ID
      address TEXT NOT NULL,                 -- 地址
      isAiSum INTEGER NOT NULL,             -- AI总结标志 (0: 否, 1: 是)
      warningTime TEXT NOT NULL,            -- 警告时间
      UNIQUE(address)                       -- 确保地址唯一性
    )
  `;

  await db.exec(sql);
}

/**
 * 插入新记录
 * @param db - 数据库连接
 * @param record - 要插入的记录
 */
export async function insertCaRecord(
  record: Partial<CaRecord>
): Promise<void> {
  const sql = `
    INSERT OR REPLACE INTO ca_records (address, isAiSum, warningTime)
    VALUES (?, ?, ?)
  `;

  // 准备插入数据
  const warningTime = new Date().toISOString();
  const isAiSum = record.isAiSum ? 1 : 0;

  try {
    await db.run(sql, [
      record.address,
      isAiSum,
      warningTime
    ]);
  } catch (error) {
    console.error('插入记录时发生错误:', error);
    throw error;
  }
}

/**
 * 根据地址查询记录是否存在
 * @param address - 要查询的地址
 * @returns 如果记录存在返回 true，否则返回 false
 */
export async function queryCaByAddress(address: string): Promise<boolean> {
  const sql = `
    SELECT 1 
    FROM ca_records 
    WHERE address = ?
  `;

  try {
    const result = await db.get(sql, [address]);
    return !!result; // 如果 result 存在，返回 true；否则返回 false
  } catch (error) {
    console.error('查询记录时发生错误:', error);
    throw error; // 根据需要决定是否抛出错误
  }
}