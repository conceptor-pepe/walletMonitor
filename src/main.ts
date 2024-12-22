import { logger } from './logger'


const { Client, Message } = require('tdl')
const { TDLib } = require('tdl-tdlib-addon')

// 创建TDLib客户端实例
const client = new Client(new TDLib(), {
  apiId: 29750444, // Telegram API ID
  apiHash: '2a65294b8d87d74270e91ccaa52ae37e', // Telegram API Hash
})

// 获取指定群组的chat_id
async function getChatId(groupName: string) {
  // 搜索群组
  const result = await client.invoke({
    _: 'searchPublicChat',
    username: groupName
  })
  return result.id
}

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
    if (!update.last_message) {
      return
    }
  } catch (err) {
    logger.error('处理消息更新失败:', err)
    return
  }

  logger.info(`消息内容: ${JSON.stringify(update.last_message)}`)


  // // 检查是否是目标群组的消息
  // if (update.last_message.sender_id._ === 'messageSenderChat') {
  //   const senderChatId = update.last_message.sender_id.chat_id.toString()
  //   const messageContent = update.last_message.content

  //   // 记录群组消息内容
  //   logger.info(`群组ID: ${senderChatId}`)
  //   logger.info(`消息内容: ${JSON.stringify(messageContent)}`)
  // }
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
