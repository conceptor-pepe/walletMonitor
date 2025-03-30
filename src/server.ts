// 导入必要的依赖
import express from 'express';
import { setupSwapWebhook } from './scripts/heliusSetup';

// 创建 Express 应用
const app = express();
// 导入 startMonitor 函数
import { handleWebhookRequest } from './utils/route';
import { initializeDB } from './utils/sqlite';


// 配置中间件
app.use(express.json());

// 设置 webhook 路由
app.post('/api/webhook', handleWebhookRequest);

// 设置服务器端口
const PORT = process.env.PORT || 3000;

// 获取时间戳函数
const getTimeStamp = () => {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
};



// 启动服务器并设置 webhook
async function startServer() {
  await initializeDB()

  try {
    // 设置 Helius webhook
    await setupSwapWebhook();
    console.log('Webhook setup completed');

    // 启动服务器
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });


    console.log('Monitor started successfully');

  } catch (err) {
    console.error('Server startup failed:', err);
    process.exit(1);
  }
}

// 启动服务器
startServer();


