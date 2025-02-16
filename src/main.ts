import { logger } from './logger'
import { sendMessageToTelegram } from './msg'


const { Client } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')

// 创建TDLib客户端实例
const client = new Client(new TDLib(), {
  apiId: 20870585, // Telegram API ID
  apiHash: '01fca0d8f9b8794089ebc04289897feb', // Telegram API Hash
})


// 主函数
async function main() {
  try {
    await client.login() // 登录Telegram账号

    await getAllGroupChats()

    // 监听消息更新
    client.on('update', handleUpdate)
    client.on('error', handleError)
    client.on('destroy', handleDestroy)

    // 获取1000xGEM NFT Group的chat_id
    // const targetChatId = await getChatId('1000xGEM NFT Group')
    // logger.info(`==================开始监控1000xGEM NFT Group(${targetChatId})======================`)
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
      if (message.sender_id._ === 'messageSenderUser') {
        const userId = message.sender_id.user_id
        // 根据userId获取用户信息
        const userInfo = await client.invoke({
          _: 'getUser',
          user_id: userId
        })

        logger.info(`firstName:${userInfo.first_name} Id:${userId} text:${message.content.text?.text}`)

        // 检查消息内容是否包含text字段
        const text = message.content.text?.text
        if (text == undefined || text == null) {
          return
        }

        // // if (userInfo.username?.includes("Alex") || userInfo.username?.includes('Serpent')) {
        // //   // 打印用户名和消息文本
        // logger.info(`firstName:${userInfo.first_name} Id:${userId} text:${message.content.text?.text}`)
        // // }

        // await getUserIdByUsername('AlexWongHK_bot')
        // await getUserIdByUsername('lurker696_bot')

        //D哥、alex、lurker696
        if (userId == 517292541 || userId == 5133526766 || userId == 7734561108) {
          logger.info(`${userInfo.first_name} text:${text}`)
          // 发送消息到指定群组
          await sendMessageToTelegram(`【${userInfo.first_name}】\n${text}`)
        }
      }
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

// 根据用户名获取用户ID
async function getUserIdByUsername(username: string) {
  try {
    // 使用searchPublicChat方法搜索公开聊天
    const chat = await client.invoke({
      _: 'searchPublicChat',
      username: username
    });

    // 检查搜索结果是否为用户
    if (chat.type._ === 'chatTypePrivate') {
      logger.info(`find user id:${chat.id} username:${username}`)
      return chat.id; // 返回用户ID
    } else {
      logger.info(`find not private chat type:${chat.type._} username:${username}`)
      return null;
    }
  } catch (err) {
    logger.error('error for process getUserIdByUsername:', err);
    return null;
  }
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
