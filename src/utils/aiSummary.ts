import { sendTelegramMessage } from './telegram.js';
import OpenAI from "openai";
import dotenv from 'dotenv';
import { getUserTimeline, searchTwitter } from './tweetApi';
import { DEEPSEEK_API_KEY } from './config.js';
import { logger } from './logger.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
});

// 定义接口类型
interface TokenInfo {
  symbol: string;
  address: string;
  twitter?: string;
}

interface Tweet {
  text: string;
  created_at: string;
  views: number;
  favorites: number;
}

interface TimelineResult {
  tweets: Tweet[];
}

interface SearchTweet extends Tweet {
  author: {
    name: string;
    screen_name: string;
    followers_count: number;
  }
}

interface SummaryResult {
  search_summary: string;
  account_summary: string;
}

// 总结与代币相关的推文,包括账号推文和搜索结果
async function sumTweets(tokenInfo: TokenInfo): Promise<SummaryResult | string | null> {
  const { symbol, address, twitter } = tokenInfo;

  let account_tweets: TimelineResult | null = null;
  let search_tweets: SearchTweet[] = [];

  // 获取Twitter账号的推文
  if (twitter && (twitter.includes('x.com/') || twitter.includes('twitter.com/'))) {
    const urlParts = twitter.split('/');
    // 排除特殊链接
    if (!twitter.includes('/communities/') && !twitter.includes('/search?') && !twitter.includes('/status/')) {
      let screenname = urlParts[urlParts.length - 1].split('?')[0];

      const timelineResult = await getUserTimeline(screenname);
      if (timelineResult) account_tweets = timelineResult as TimelineResult;
      else logger.info('Failed to fetch user tweets:', screenname);
    }
  }

  // 搜索与代币地址相关的推文
  search_tweets = await searchTwitter(address) as SearchTweet[];

  if (!search_tweets?.length) {
    logger.info('No tweets found for address:', address);
    return `No tweet data found for ${symbol}(${address}).`;
  }

  // 分析推文
  const search_summary = await genSum(symbol, search_tweets, 'search');

  let account_summary = "";
  if (account_tweets && 'tweets' in account_tweets && account_tweets.tweets?.length > 0) {
    account_summary = await genSum(symbol, account_tweets, 'account');
  }

  if (!search_summary && !account_summary) {
    logger.info(`Unable to generate tweet analysis summary for ${symbol}.`);
    return null;
  }

  return { search_summary, account_summary };
}

// 使用AI生成推文摘要
async function genSum(symbol: string, tweets: TimelineResult | SearchTweet[], type = 'search'): Promise<string> {
  try {
    let tweetData: string[] = [];
    let promptPrefix = '';
    let promptSuffix = '';

    if (type === 'account' && 'tweets' in tweets) {
      promptPrefix = `请总结关于 ${symbol} 的账号推文:`;
      promptSuffix = `提供简短的要点总结。保持简洁直接,去除所有不必要的词语。`;

      // 处理账号推文格式
      tweetData = tweets.tweets.map((tweet, index) => `
Tweet ${index + 1}:
Content: ${tweet.text}
Time: ${tweet.created_at}
Engagement: ${tweet.views} views / ${tweet.favorites} likes 
---`);
    } else if (Array.isArray(tweets)) {
      // 搜索推文
      promptPrefix = `请总结关于 ${symbol} 的搜索推文:`;
      promptSuffix = `提供关于叙事观点和风险内容的极简要点总结。不总结主观价格预测和个人收益的内容。保持简洁直接,去除所有不必要的词语。格式如下：
- 叙事观点：
- 风险内容：`;

      // 处理搜索推文格式
      tweetData = (tweets as SearchTweet[]).map((tweet, index) => `
Tweet ${index + 1}:
Content: ${tweet.text}
Time: ${tweet.created_at}
Author: ${tweet.author.name} (@${tweet.author.screen_name})
Followers: ${tweet.author.followers_count}
Engagement: ${tweet.views} views / ${tweet.favorites} likes 
---`);
    }

    const prompt = `${promptPrefix}

${tweetData.join('\n')}

${promptSuffix}`;

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "You are a helpful assistant that analyzes cryptocurrency Twitter data." },
        { role: "user", content: prompt }
      ],
      temperature: 1.0,
      max_tokens: 3000
    });

    return response.choices[0].message.content ?? "No summary generated.";
  } catch (error) {
    logger.error("Error generating Twitter summary:", error);
    return "Failed to generate summary due to an error.";
  }
}

// 将推文摘要作为回复发送到Telegram
export async function sendSumMessage(tokenInfo: TokenInfo, replyToMessageId: number) {
  const summaryResult = await sumTweets(tokenInfo);
  if (!summaryResult || typeof summaryResult === 'string') {
    logger.info(`Unable to get tweet summary for ${tokenInfo.symbol}`);
    return;
  }

  const { search_summary, account_summary } = summaryResult as SummaryResult;

  let message = `\u{1F49B}${tokenInfo.symbol} tweets summary:\n`;

  if (account_summary) {
    // 格式化换行和空格,将多个换行替换为单个换行
    const formattedAccountSummary = account_summary
      .replace(/\n\s*\n/g, '\n')
      .trim();
    message += `<blockquote>${formattedAccountSummary}</blockquote>\n\n`;
  }

  if (search_summary) {
    message += `\u{1F49B}Searched tweets summary:\n<blockquote>${search_summary}</blockquote>`;
  }

  const tgResponse = await sendTelegramMessage(message, replyToMessageId);

  return tgResponse;
}
