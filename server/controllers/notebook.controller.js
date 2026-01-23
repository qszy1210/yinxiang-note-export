/**
 * 笔记本控制器
 * 处理笔记本相关操作
 */

const EvernoteService = require('../services/evernote');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

class NotebookController {
  /**
   * 获取所有笔记本列表
   * GET /api/notebooks
   */
  async listNotebooks(req, res, next) {
    try {
      logger.info('Fetching notebooks list', {
        hasToken: !!req.auth.token,
        tokenPrefix: req.auth.token ? req.auth.token.substring(0, 20) + '...' : 'none',
        noteStoreUrl: req.auth.noteStoreUrl
      });

      const service = new EvernoteService(req.auth.token, req.auth.noteStoreUrl);
      const notebooks = await service.listNotebooks();

      logger.info(`Retrieved ${notebooks.length} notebooks`);

      return success(res, { notebooks });
    } catch (err) {
      // 处理 Evernote 错误对象
      const errorCode = err?.errorCode;
      const errorMessage = err?.message || err?.parameter || 'Unknown error';

      // Evernote 错误码映射
      const errorMessages = {
        1: 'UNKNOWN_ERROR',
        2: 'BAD_DATA_FORMAT',
        3: 'PERMISSION_DENIED',
        4: 'INTERNAL_ERROR',
        5: 'DATA_REQUIRED',
        6: 'LIMIT_REACHED',
        7: 'QUOTA_REACHED',
        8: 'INVALID_AUTH',
        9: 'AUTH_EXPIRED',
        10: 'DATA_CONFLICT',
        11: 'ENML_VALIDATION',
        12: 'SHARD_UNAVAILABLE',
        13: 'LEN_TOO_SHORT',
        14: 'LEN_TOO_LONG',
        15: 'TOO_FEW',
        16: 'TOO_MANY',
        17: 'UNSUPPORTED_OPERATION',
        18: 'TAKEN_DOWN',
        19: 'RATE_LIMIT_REACHED'
      };

      const errorName = errorMessages[errorCode] || `ERROR_CODE_${errorCode}`;
      const fullMessage = `Evernote API 错误 (${errorName}): ${errorMessage}`;

      logger.error('Failed to fetch notebooks', {
        errorCode,
        errorName,
        errorMessage,
        fullMessage
      });

      // 创建带有正确错误信息的错误对象
      const error = new Error(fullMessage);
      error.status = errorCode === 8 || errorCode === 9 ? 401 : 500;
      error.errorCode = errorCode;
      next(error);
    }
  }

  /**
   * 获取笔记本下的笔记列表
   * GET /api/notebooks/:guid/notes
   */
  async getNotes(req, res, next) {
    try {
      const { guid } = req.params;

      logger.info('Fetching notes for notebook', { notebookGuid: guid });

      const service = new EvernoteService(req.auth.token, req.auth.noteStoreUrl);
      const result = await service.getNotesInNotebook(guid, 0, 1000);

      logger.info(`Retrieved ${result.notes?.length || 0} notes for notebook`, {
        notebookGuid: guid,
        totalNotes: result.totalNotes
      });

      return success(res, {
        notes: result.notes || [],
        totalNotes: result.totalNotes || 0
      });
    } catch (err) {
      logger.error('Failed to fetch notes', {
        notebookGuid: req.params.guid,
        error: err.message
      });
      next(err);
    }
  }

  /**
   * 获取单个笔记本详情
   * GET /api/notebooks/:guid
   */
  async getNotebook(req, res, next) {
    try {
      const { guid } = req.params;

      logger.info('Fetching notebook details', { notebookGuid: guid });

      const service = new EvernoteService(req.auth.token, req.auth.noteStoreUrl);
      const notebook = await service.getNotebook(guid);

      return success(res, { notebook });
    } catch (err) {
      logger.error('Failed to fetch notebook', {
        notebookGuid: req.params.guid,
        error: err.message
      });
      next(err);
    }
  }
}

module.exports = new NotebookController();
