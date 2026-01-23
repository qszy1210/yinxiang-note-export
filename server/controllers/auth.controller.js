/**
 * 认证控制器
 * 处理用户认证相关操作
 */

const EvernoteService = require('../services/evernote');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');

class AuthController {
  /**
   * 验证 Developer Token
   * POST /api/auth/verify
   */
  async verifyToken(req, res, next) {
    try {
      const { token, noteStoreUrl } = req.body;

      // 验证参数
      if (!token || !noteStoreUrl) {
        return error(res, '请提供 Token 和 NoteStore URL', 400);
      }

      logger.info('Token verification requested');

      // 创建 Evernote 服务并验证
      const service = new EvernoteService(token, noteStoreUrl);
      const user = await service.getUser();

      logger.info('Token verified successfully', { username: user.username });

      return success(res, {
        user: {
          name: user.name,
          username: user.username,
          email: user.email,
          created: user.created
        }
      }, '验证成功');
    } catch (err) {
      logger.error('Token verification failed', { error: err.message });
      return error(res, 'Token 验证失败: ' + err.message, 401);
    }
  }

  /**
   * 获取服务器配置
   * GET /api/auth/config
   */
  async getConfig(req, res) {
    const hasConfig = !!(
      process.env.EVERNOTE_TOKEN &&
      process.env.EVERNOTE_NOTESTORE_URL
    );

    return success(res, {
      hasConfig,
      token: process.env.EVERNOTE_TOKEN || '',
      noteStoreUrl: process.env.EVERNOTE_NOTESTORE_URL || ''
    });
  }
}

module.exports = new AuthController();
