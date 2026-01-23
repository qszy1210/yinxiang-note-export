/**
 * 印象笔记导出工具 - 主入口文件
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// 加载配置
const config = require('./config/app.config');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/error.handler');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== 中间件配置 ====================

// CORS 跨域支持
app.use(cors());

// JSON 解析
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')));

// ==================== API 路由 ====================

// 认证路由（无需认证）
app.use('/api/auth', require('./routes/auth'));

// 笔记本路由
app.use('/api/notebooks', require('./routes/notebooks'));

// 笔记路由（保留原有功能）
app.use('/api/notes', require('./routes/notes'));

// 导出路由
app.use('/api/export', require('./routes/export'));

// 标签路由（新增）
app.use('/api/tags', require('./routes/tags'));

// ==================== 错误处理 ====================

// 404 处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

// ==================== 启动服务器 ====================

app.listen(PORT, () => {
  logger.info(`印象笔记导出工具已启动`, {
    url: `http://localhost:${PORT}`,
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: config.logging.level
  });

  // 定期清理过期的限流记录（如果使用了限流）
  setInterval(() => {
    // 这里可以添加清理逻辑
  }, 300000); // 每5分钟清理一次
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

// 未捕获的异常
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', {
    error: err.message,
    stack: err.stack
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason,
    promise
  });
});
