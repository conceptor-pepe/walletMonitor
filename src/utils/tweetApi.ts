import axios from 'axios';
import dotenv from 'dotenv';
import axiosRetry from 'axios-retry';
import { AxiosError } from 'axios';
import { RAPID_API_KEY } from './config';

// 加载环境变量
dotenv.config();

// 配置 API 密钥和主机地址
const TWITTER_API_HOST = 'twitter-api45.p.rapidapi.com';
// RapidAPI Twitter API 文档: https://rapidapi.com/alexanderxbx/api/twitter-api45

// 配置 axios 重试机制
axiosRetry(axios, {
  retries: 3, // 最大重试次数
  retryDelay: (retryCount) => {
    return retryCount * 1000; // 重试延迟时间，每次递增1秒
  },
  retryCondition: (error: AxiosError): boolean => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      Boolean(error.response?.status && error.response.status >= 500);
  }
});

/**
 * 搜索 Twitter 内容
 * @param {string} query - 搜索关键词
 * @param {string} searchType - 搜索类型，默认为"Top"
 * @returns {Array} 处理后的推文数据数组
 */
export async function searchTwitter(query: any, searchType = 'Top') {
  // 配置 API 请求参数
  const options = {
    method: 'GET',
    url: 'https://twitter-api45.p.rapidapi.com/search.php',
    params: {
      query,
      search_type: searchType
    },
    headers: {
      'x-rapidapi-key': RAPID_API_KEY,
      'x-rapidapi-host': TWITTER_API_HOST
    }
  };

  // 发送请求并处理错误
  const response = await axios.request(options).catch(error => {
    console.error('Twitter API Error:', error.message);
    throw error;
  });

  // 验证响应数据
  if (!response || !response.data) {
    console.error('Twitter API Search Error: No response data');
    return null;
  }

  if (!response.data?.timeline) {
    console.error('Twitter API Search Error: No tweet data');
    return [];
  }

  // 处理并格式化推文数据
  return response.data.timeline.map((tweet: any) => ({
    text: tweet.text,                    // 推文内容
    created_at: new Date(tweet.created_at).toLocaleString('en-US', { hour12: false }) + ' UTC',  // 发布时间

    // 互动数据
    views: tweet.views,                  // 浏览量
    favorites: tweet.favorites,          // 点赞数
    retweets: tweet.retweets,           // 转发数
    replies: tweet.replies,              // 回复数

    // 作者信息
    author: {
      name: tweet.user_info.name,        // 用户名称
      screen_name: tweet.user_info.screen_name,  // 用户账号
      followers_count: tweet.user_info.followers_count,  // 粉丝数
      description: tweet.user_info.description    // 用户简介
    }
  }));
}

// 定义返回结果接口类型
export interface TimelineResult {
  user: {
    name: string;
    screen_name: string;
    verified: boolean;
    description: string;
    followers_count: number;
  };
  tweets: {
    text: string;
    created_at: string;
    views: number;
    favorites: number;
    retweets: number;
    replies: number;
    isPinned: boolean;
  }[];
}

/**
 * 获取指定用户的推文时间线
 * @param {string} screenname - 用户的 Twitter 账号名
 * @returns {Object} 包含用户信息和推文列表的对象
 */
export async function getUserTimeline(screenname: string): Promise<TimelineResult | null> {
  // 配置 API 请求参数
  const options = {
    method: 'GET',
    url: 'https://twitter-api45.p.rapidapi.com/timeline.php',
    params: {
      screenname
    },
    headers: {
      'x-rapidapi-key': RAPID_API_KEY,
      'x-rapidapi-host': TWITTER_API_HOST
    }
  };

  // 发送请求并处理错误
  const response = await axios.request(options).catch(error => {
    console.error('Twitter API Error:', error.message);
    throw error;
  });

  // 验证响应数据
  if (!response || !response.data) {
    console.error('Twitter API Timeline Error: No response data');
    return null;
  }

  // 定义推文接口类型
  interface Tweet {
    text: string;
    created_at: string;
    views: number;
    favorites: number;
    retweets: number;
    replies: number;
    isPinned: boolean;
  }

  // 定义用户接口类型
  interface User {
    name: string;
    screen_name: string;
    verified: boolean;
    description: string;
    followers_count: number;
  }

  // 组织返回数据结构
  const result: TimelineResult = {
    user: {
      name: response.data.user?.name,           // 用户名称
      screen_name: screenname,                  // 用户账号
      verified: response.data.user?.blue_verified,  // 是否已认证
      description: response.data.user?.desc,    // 用户简介
      followers_count: response.data.user?.sub_count  // 粉丝数
    },
    tweets: []
  };

  // 处理置顶推文（如果存在）
  if (response.data.pinned) {
    const pinnedTweet: Tweet = {
      text: response.data.pinned.text,
      created_at: new Date(response.data.pinned.created_at).toLocaleString('en-US', { hour12: false }) + ' UTC',
      views: response.data.pinned.views,
      favorites: response.data.pinned.favorites,
      retweets: response.data.pinned.retweets,
      replies: response.data.pinned.replies,
      isPinned: true
    };
    result.tweets.push(pinnedTweet);
  }

  // 处理时间线推文
  if (response.data.timeline && Array.isArray(response.data.timeline)) {
    response.data.timeline.forEach((tweet: any) => {
      const timelineTweet: Tweet = {
        text: tweet.text,
        created_at: new Date(tweet.created_at).toLocaleString('en-US', { hour12: false }) + ' UTC',
        views: tweet.views,
        favorites: tweet.favorites,
        retweets: tweet.retweets,
        replies: tweet.replies,
        isPinned: false
      };
      result.tweets.push(timelineTweet);
    });
  }

  return result;
}

