import { createDatabase, initDatabase } from './data'
import { logger } from './logger'
import { parseGongyueMessage, parseMasonMessage, sendMessageToTelegram } from './msg'


const { Client } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')

// 创建TDLib客户端实例
const client = new Client(new TDLib(), {
  apiId: 20870585, // Telegram API ID
  apiHash: '01fca0d8f9b8794089ebc04289897feb', // Telegram API Hash
})

export let db: any

// 主函数
async function main() {
  try {
    // 创建数据库连接
    db = createDatabase('./vip_tokens.db');
    await initDatabase(db);

    await client.login() // 登录Telegram账号

    await getAllGroupChats()

    // 监听消息更新
    client.on('update', handleUpdate)
    client.on('error', handleError)
    client.on('destroy', handleDestroy)

  } catch (err) {
    logger.error('error for process main:', err)
  }
}

// 处理消息更新
async function handleUpdate(update: any) {
  try {
    // 检查是否有消息
    if (!update.last_message) {
      return
    }

    // 获取消息内容
    const message = update.last_message

    // 检查是否是目标群组的消息--旗开得胜尊享VIP群
    if (message.chat_id === -1002349291613) {
      // 检查是否是用户发送的消息
      await parseGongyueMessage(message)
    }

    //Mason的Debot地址报警
    if (message.chat_id === -1002497895796) {
      // logger.info(`${JSON.stringify(message)}`)
      await parseMasonMessage(message)
    }

  } catch (err) {
    logger.error('error for process handleUpdate:', err)
    return
  }
}

// 错误处理函数
function handleError(err: any) {
  logger.error('error for process handleError:', JSON.stringify(err, null, 2))
}

// 销毁事件处理函数
function handleDestroy() {
  logger.info('client is disconnected')
}



// 启动程序
main().catch(err => {
  logger.error('未处理的错误:', err);
});


// 获取所有群组聊天
async function getAllGroupChats() {
  try {
    const result = await client.invoke({
      _: 'getChats',
      chatList: { _: 'chatListMain' },
      limit: 100  // 每次获取的数量
    });

    // 打印基础信息
    logger.info(`find ${result.chat_ids.length} chats`);

    // 获取每个聊天的详细信息
    for (const chatId of result.chat_ids) {
      const chat = await client.invoke({
        _: 'getChat',
        chat_id: chatId
      });

      // 筛选群组类型（普通群组/超级群组）
      if (chat.type._ === 'chatTypeSupergroup' || chat.type._ === 'chatTypeGroup') {
        logger.info(`chat id: ${chat.id} | title: ${chat.title} | type: ${chat.type._}`);
      }
    }

    // 如果需要获取更多（分页处理）：
    if (result.total_count > result.chat_ids.length) {
      logger.info('notice: there are more chats need to be fetched');
    }
  } catch (err) {
    logger.error('error for process getAllGroupChats:', err);
  }
}
