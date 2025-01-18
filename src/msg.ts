

const axios = require('axios')

/**
 * 发送消息到Telegram
 * @param formattedText 要发送的格式化文本内容(支持HTML或Markdown格式)
 * @param chatId 目标聊天ID,默认为指定群组
 */
export async function sendMessageToTelegram(formattedText: string, chatId: string = '-4552212633') {
  let axiosInstance = axios

  // Telegram Bot API URL
  const url = `https://api.telegram.org/bot5468947096:AAHjqcA8IPi-4y6keSxKueNIaPHfWNL-6wM/sendMessage`

  // 构建请求参数
  const payload = {
    chat_id: chatId,
    text: formattedText,
    // 支持HTML或Markdown格式,根据消息内容选择
    parse_mode: formattedText.includes('<') ? 'HTML' : 'Markdown',
    disable_web_page_preview: true,
  }

  try {
    // 发送POST请求到Telegram API
    const response = await axiosInstance.post(url, payload)
  } catch (error) {
    console.error('发送消息失败:', error)
  }
}

