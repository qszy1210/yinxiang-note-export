/**
 * 错误处理中间件
 * 统一处理应用中的错误
 */

const logger = require('../utils/logger');

/**
 * 全局错误处理中间件
 * 必须在所有路由之后注册
 */
function errorHandler(err, req, res, next) {
  // 记录错误日志
  logger.error('Request error', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // 判断是否是已知的错误类型
  const status = err.status || err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  // 开发环境返回堆栈信息
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(status).json({
    success: false,
    message,
    ...(isDevelopment && { stack: err.stack })
  });
}

/**
 * 404 处理中间件
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`路径 ${req.originalUrl} 不存在`);
  error.status = 404;
  next(error);
}

/**
 * 异步错误包装器
 * 用于捕获异步路由中的错误
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
