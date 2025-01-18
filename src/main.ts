import { logger } from './logger'


const { Client, Message } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')

// 创建TDLib客户端实例
const client = new Client(new TDLib(), {
  apiId: 29750444, // Telegram API ID
  apiHash: '2a65294b8d87d74270e91ccaa52ae37e', // Telegram API Hash
})


// 主函数
async function main() {
  try {
    await client.login() // 登录Telegram账号

    // 监听消息更新
    client.on('update', handleUpdate)
    client.on('error', handleError)
    client.on('destroy', handleDestroy)

    // 获取1000xGEM NFT Group的chat_id
    // const targetChatId = await getChatId('1000xGEM NFT Group')
    // logger.info(`==================开始监控1000xGEM NFT Group(${targetChatId})======================`)
  } catch (err) {
    logger.error('启动程序时发生错误:', err)
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

    // 检查是否是目标群组的消息
    if (message.chat_id === -1002335179695) {
      // 检查是否是用户发送的消息
      if (message.sender_id._ === 'messageSenderUser') {
        const userId = message.sender_id.user_id

        // 根据userId获取用户信息
        const userInfo = await client.invoke({
          _: 'getUser',
          user_id: userId
        })

        // 获取用户名,如果没有username则使用first_name
        const userName = userInfo.username || userInfo.first_name || '未知用户'

        // 检查消息内容是否包含text字段
        const text = message.content.text?.text || '无文本内容'

        // 打印用户名和消息文本
        logger.info(`用户名: ${userName} (ID: ${userId}) 消息内容: ${text}`)
      }
    }

  } catch (err) {
    logger.error('处理消息更新失败:', err)
    return
  }
}

// 错误处理函数
function handleError(err: any) {
  logger.error('发生错误:', JSON.stringify(err, null, 2))
}

// 销毁事件处理函数
function handleDestroy() {
  logger.info('客户端已断开连接')
}

// 启动程序
main().catch(err => {
  logger.error('未处理的错误:', err);
});
