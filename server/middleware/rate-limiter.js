/**
 * 请求限流中间件
 * 基于 IP 的简单限流实现
 */

const logger = require('../utils/logger');

/**
 * 创建限流中间件
 * @param {object} options - 配置选项
 * @param {number} options.windowMs - 时间窗口（毫秒）
 * @param {number} options.maxRequests - 最大请求数
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 60000,      // 默认 1 分钟
    maxRequests = 100       // 默认 100 次请求
  } = options;

  // 存储请求记录
  const requests = new Map();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // 获取或初始化 IP 的请求记录
    let record = requests.get(ip);

    if (!record) {
      record = {
        count: 0,
        resetTime: now + windowMs
      };
      requests.set(ip, record);
    }

    // 检查是否需要重置计数器
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    // 增加计数
    record.count++;

    // 检查是否超过限制
    if (record.count > maxRequests) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`, {
        ip,
        count: record.count,
        maxRequests
      });

      return res.status(429).json({
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    // 添加限流信息到响应头
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

    next();
  };
}

/**
 * 清理过期的请求记录
 * 应该定期调用以释放内存
 */
function cleanupExpiredRecords(limiterMap) {
  const now = Date.now();
  for (const [ip, record] of limiterMap.entries()) {
    if (now > record.resetTime) {
      limiterMap.delete(ip);
    }
  }
}

module.exports = {
  createRateLimiter,
  cleanupExpiredRecords
};
