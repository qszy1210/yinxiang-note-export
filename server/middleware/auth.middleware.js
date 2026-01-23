/**
 * 认证中间件
 * 验证请求是否包含有效的认证信息
 */

const { getCredentials } = require('../utils/auth-helper');
const { error } = require('../utils/response');

/**
 * 要求认证的中间件
 * 检查请求头中是否包含有效的 Token 和 NoteStore URL
 */
function requireAuth(req, res, next) {
  try {
    const credentials = getCredentials(req);

    if (!credentials.token || !credentials.noteStoreUrl) {
      return error(res, '未认证或认证已过期', 401);
    }

    // 将认证信息附加到请求对象
    req.auth = credentials;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * 可选认证中间件
 * 如果有认证信息则解析，没有则跳过
 */
function optionalAuth(req, res, next) {
  try {
    const credentials = getCredentials(req);
    req.auth = credentials;
  } catch (err) {
    // 忽略错误，继续处理请求
    req.auth = { token: null, noteStoreUrl: null };
  }
  next();
}

module.exports = {
  requireAuth,
  optionalAuth
};
