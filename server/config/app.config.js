/**
 * 应用配置文件
 * 集中管理应用的各种配置项
 */

module.exports = {
  // API 限制配置
  api: {
    maxConcurrentRequests: 5,    // 最大并发请求数
    requestInterval: 200,        // 请求间隔（毫秒）
    maxRetries: 3                // 最大重试次数
  },

  // 导出配置
  export: {
    maxBatchSize: 50,                     // 最大批量大小
    defaultImageFormat: 'obsidian',       // 默认图片格式
    tempDir: './temp',                    // 临时目录
    outputDir: './exports'                // 输出目录
  },

  // 队列配置
  queue: {
    concurrency: 3,               // 队列并发数
    timeout: 300000               // 超时时间（5分钟）
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',  // 日志级别
    enableConsole: true                       // 是否启用控制台输出
  }
};
