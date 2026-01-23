/**
 * 标签控制器
 * 处理标签管理相关操作
 */

const EvernoteService = require('../services/evernote');
const Evernote = require('evernote');
const { success } = require('../utils/response');
const logger = require('../utils/logger');

class TagController {
  /**
   * 获取所有标签列表
   * GET /api/tags
   */
  async listTags(req, res, next) {
    try {
      logger.info('Fetching tags list');

      const evernoteService = new EvernoteService(req.auth.token, req.auth.noteStoreUrl);
      const noteStore = evernoteService.getNoteStore();
      const tags = await noteStore.listTags();

      logger.info(`Retrieved ${tags.length} tags`);

      return success(res, { tags });
    } catch (err) {
      logger.error('Failed to fetch tags', { error: err.message });
      next(err);
    }
  }

  /**
   * 删除指定的标签
   * POST /api/tags/delete
   */
  async deleteTags(req, res, next) {
    try {
      const { tagGuids } = req.body;

      if (!Array.isArray(tagGuids) || tagGuids.length === 0) {
        return res.status(400).json({
          success: false,
          message: '请提供要删除的标签 ID 列表'
        });
      }

      logger.info('Deleting tags', { count: tagGuids.length });

      const evernoteService = new EvernoteService(req.auth.token, req.auth.noteStoreUrl);
      const noteStore = evernoteService.getNoteStore();
      const results = [];

      for (const guid of tagGuids) {
        try {
          await noteStore.deleteTag(guid);
          results.push({ guid, status: 'success' });
          logger.info('Tag deleted successfully', { tagGuid: guid });
        } catch (err) {
          results.push({ guid, status: 'failed', error: err.message });
          logger.warn('Failed to delete tag', { tagGuid: guid, error: err.message });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;

      return success(res, {
        results,
        message: `已删除 ${successCount}/${tagGuids.length} 个标签`
      });
    } catch (err) {
      logger.error('Failed to delete tags', { error: err.message });
      next(err);
    }
  }

  /**
   * 查找空标签（不包含任何笔记的标签）
   * GET /api/tags/empty
   */
  async findEmptyTags(req, res, next) {
    try {
      logger.info('Finding empty tags');

      const evernoteService = new EvernoteService(req.auth.token, req.auth.noteStoreUrl);
      const noteStore = evernoteService.getNoteStore();

      // 获取所有标签
      const tags = await noteStore.listTags();
      const emptyTags = [];

      // 创建笔记元数据结果规范
      const spec = new Evernote.NoteStore.NotesMetadataResultSpec();
      spec.includeTitle = true;
      spec.includeCreated = true;
      spec.includeUpdated = true;
      spec.includeContentLength = true;

      // 检查每个标签的使用情况
      for (const tag of tags) {
        try {
          // 创建过滤条件，只查找包含该标签的笔记
          const filter = new Evernote.NoteStore.NoteFilter();
          filter.tagGuids = [tag.guid];

          // 使用 findNotesMetadata 查找笔记数量
          const result = await noteStore.findNotesMetadata(filter, 0, 1, spec);

          if (result.totalNotes === 0) {
            emptyTags.push(tag);
          }
        } catch (err) {
          logger.warn('Failed to check tag usage', {
            tagGuid: tag.guid,
            error: err.message
          });
        }
      }

      logger.info(`Found ${emptyTags.length} empty tags`);

      return success(res, {
        tags: emptyTags,
        count: emptyTags.length
      });
    } catch (err) {
      logger.error('Failed to find empty tags', { error: err.message });
      next(err);
    }
  }

  /**
   * 获取标签的使用统计
   * GET /api/tags/stats
   */
  async getTagStats(req, res, next) {
    try {
      logger.info('Fetching tag statistics');

      const evernoteService = new EvernoteService(req.auth.token, req.auth.noteStoreUrl);
      const noteStore = evernoteService.getNoteStore();

      const tags = await noteStore.listTags();
      const stats = [];

      // 创建笔记元数据结果规范
      const spec = new Evernote.NoteStore.NotesMetadataResultSpec();
      spec.includeTitle = true;
      spec.includeCreated = true;
      spec.includeUpdated = true;
      spec.includeContentLength = true;

      for (const tag of tags) {
        try {
          const filter = new Evernote.NoteStore.NoteFilter();
          filter.tagGuids = [tag.guid];

          // 使用 findNotesMetadata 查找笔记数量
          const result = await noteStore.findNotesMetadata(filter, 0, 1, spec);

          stats.push({
            guid: tag.guid,
            name: tag.name,
            noteCount: result.totalNotes || 0
          });
        } catch (err) {
          logger.warn('Failed to get tag stats', {
            tagGuid: tag.guid,
            error: err.message
          });
          stats.push({
            guid: tag.guid,
            name: tag.name,
            noteCount: -1 // 表示获取失败
          });
        }
      }

      return success(res, {
        stats,
        totalTags: tags.length,
        totalEmptyTags: stats.filter(s => s.noteCount === 0).length
      });
    } catch (err) {
      logger.error('Failed to get tag statistics', { error: err.message });
      next(err);
    }
  }
}

module.exports = new TagController();
