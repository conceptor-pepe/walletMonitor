// db.ts
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { logger } from './logger';
import { initCaTable } from './ca';

// 定义交易数据接口
interface Transaction {
  account: string;          // Solana 钱包地址
  token_in_address: string; // 输入代币的合约地址  
  token_in_amount: number;  // 输入代币数量
  token_out_address: string;// 输出代币的合约地址
  token_out_amount: number; // 输出代币数量
  timestamp: number;        // Unix 时间戳
  signature: string;        // 交易签名
  description?: string;     // 交易描述
}


// 定义钱包数据接口
interface Wallet {
  address: string;  // 钱包地址
  name?: string;    // 钱包名称
}

// 数据库连接实例
export let db: any = null;

/**
 * 初始化数据库连接
 * @returns Promise<void>
 */
async function initializeDB() {
  if (!db) {
    db = await open({
      filename: './walletMonitor.db', // 数据库文件路径
      driver: sqlite3.Database
    });

    // 创建交易表（如果不存在）
    await db.exec(`
      CREATE TABLE IF NOT EXISTS txs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,  -- 自增主键
        account TEXT NOT NULL,                 -- Solana 钱包地址
        token_in_address TEXT NOT NULL,        -- 输入代币的合约地址
        token_in_amount NUMERIC NOT NULL,      -- 输入代币数量
        token_out_address TEXT NOT NULL,       -- 输出代币的合约地址
        token_out_amount NUMERIC NOT NULL,     -- 输出代币数量
        timestamp BIGINT NOT NULL,             -- Unix 时间戳
        signature TEXT NOT NULL,               -- 交易签名
        description TEXT,                      -- 交易描述
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP -- 记录创建时间
      )
    `);

    // 创建钱包表（如果不存在）
    await db.exec(`
      CREATE TABLE IF NOT EXISTS wallets (
        address TEXT PRIMARY KEY,              -- 钱包地址（主键）
        name TEXT,                            -- 钱包名称
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP -- 记录创建时间
      )
    `);

    await initCaTable()
  }
}

/**
 * 关闭数据库连接
 */
async function closeDB() {
  if (db) {
    await db.close();
    db = null;
  }
}


// 添加钱包
const addWallet = async (wallet: Wallet) => {
  const stmt = await db.prepare(
    'INSERT INTO wallets (address, name) VALUES (?, ?)'
  );
  await stmt.run([wallet.address, wallet.name]);
};

// 删除交易记录
const deleteTransaction = async (signature: string) => {
  const stmt = await db.prepare('DELETE FROM txs WHERE signature = ?');
  await stmt.run([signature]);
};

// 删除钱包
const deleteWallet = async (address: string) => {
  const stmt = await db.prepare('DELETE FROM wallets WHERE address = ?');
  await stmt.run([address]);
};

// 查询交易记录
const queryTransactions = async (account?: string, startTime?: number, endTime?: number) => {
  let sql = 'SELECT * FROM txs WHERE 1=1';
  const params = [];

  if (account) {
    sql += ' AND account = ?';
    params.push(account);
  }

  if (startTime) {
    sql += ' AND timestamp >= ?';
    params.push(startTime);
  }

  if (endTime) {
    sql += ' AND timestamp <= ?';
    params.push(endTime);
  }

  return await db.all(sql, params);
};

// 查询钱包
const queryWallets = async (address?: string) => {
  if (address) {
    return await db.get('SELECT * FROM wallets WHERE address = ?', [address]);
  }
  return await db.all('SELECT * FROM wallets');
};

/**
 * 获取指定时间戳后的新交易
 * @param lastCheckTimestamp 上次检查的时间戳
 */
export async function getNewTransactions(lastCheckTimestamp: number) {
  return await db.all(`
    SELECT * FROM txs 
    WHERE timestamp > ? 
    ORDER BY timestamp ASC
  `, lastCheckTimestamp);
}

/**
 * 查询指定时间范围内其他钱包的代币交易
 * @param tokenAddress 代币地址
 * @param currentAccount 当前账户
 * @param fromTimestamp 起始时间戳
 */
export async function getOtherWalletTransactions(
  tokenAddress: string,
  currentAccount: string,
  fromTimestamp: number
) {
  return await db.all(`
    SELECT * FROM txs 
    WHERE token_out_address = ? 
    AND account != ? 
    AND timestamp >= ? 
    LIMIT 1
  `, [tokenAddress, currentAccount, fromTimestamp]);
}
// account text not null,                -- Solana 钱包地址
// token_in_address text not null,       -- 输入代币的合约地址
// token_in_amount numeric not null,     -- 输入代币数量
// token_out_address text not null,      -- 输出代币的合约地址
// token_out_amount numeric not null,    -- 输出代币数量
// timestamp bigint not null,            -- Unix 时间戳
// signature text not null,              -- 交易签名
// description text,                     -- 交易描述
// created_at timestamptz default now()  -- 记录创建时间


/**
 * 添加交易记录到数据库
 * @param transaction - 交易数据对象
 */
async function addTransaction(transaction: {
  account: string
  token_in_address: string;
  token_in_amount: number;
  token_out_address: string;
  token_out_amount: number;
  timestamp: number;
  description: string;
  signature: string;
}) {
  // SQL 插入语句
  const sql = `
    INSERT INTO txs (
      account,
      token_in_address,
      token_in_amount,
      token_out_address,
      token_out_amount,
      timestamp,
      description,
      signature,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `;

  // 执行插入操作
  try {
    await db.run(sql, [
      transaction.account,
      transaction.token_in_address,
      transaction.token_in_amount,
      transaction.token_out_address,
      transaction.token_out_amount,
      transaction.timestamp,
      transaction.description,
      transaction.signature
    ]);

    logger.info('交易记录已成功添加到数据库');
  } catch (error) {
    logger.error('添加交易记录时发生错误:', error);
    throw error;
  }
}

/**
 * 获取最近的交易记录
 * @param limit - 返回记录的数量限制
 */
export async function getRecentTransactions(limit: number = 10) {
  const sql = `
    SELECT * FROM transactions 
    ORDER BY timestamp DESC 
    LIMIT ?
  `;

  try {
    const transactions = await db.all(sql, [limit]);
    return transactions;
  } catch (error) {
    logger.error('获取交易记录时发生错误:', error);
    throw error;
  }
}


// 查询指定代币地址的所有交易记录
const getTxsByTokenAddress = async (tokenAddress: string) => {
  // 构建 SQL 查询语句
  const sql = `
    SELECT 
      account,           -- 钱包地址
      token_in_address,  -- 输入代币地址
      token_in_amount,   -- 输入代币数量
      token_out_address, -- 输出代币地址
      token_out_amount,  -- 输出代币数量
      timestamp         -- 交易时间戳
    FROM txs 
    WHERE token_in_address = ? OR token_out_address = ?
    ORDER BY timestamp ASC
  `;

  try {
    // 执行查询并返回结果
    const txs = await db.all(sql, [tokenAddress, tokenAddress]);
    return { data: txs }; // 保持与 Supabase 返回格式一致
  } catch (error) {
    logger.error('查询代币交易记录时发生错误:', error);
    throw error;
  }
};


export {
  initializeDB,
  closeDB,
  addTransaction,
  addWallet,
  deleteTransaction,
  deleteWallet,
  queryTransactions,
  queryWallets,
  getTxsByTokenAddress,
  Transaction,
  Wallet
};