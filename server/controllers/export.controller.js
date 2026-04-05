/**
 * 导出控制器
 * 处理笔记和笔记本的导出操作
 */

const path = require('path');
const archiver = require('archiver');
const fs = require('fs').promises;
const EvernoteService = require('../services/evernote');
const Converter = require('../services/converter');
const Downloader = require('../services/downloader');
const QueueService = require('../services/queue.service');
const exportTracker = require('../services/export-tracker');
const { success, error } = require('../utils/response');
const logger = require('../utils/logger');
const sanitize = require('sanitize-filename');
const config = require('../config/app.config');

// 导出目录
const EXPORTS_DIR = path.join(__dirname, '../../exports');

// 确保导出目录存在
async function ensureExportsDir() {
  try {
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
  } catch (err) {
    // 目录已存在
  }
}

// 生成带 frontmatter 的 Markdown
function generateMarkdown(note, content) {
  const frontmatter = [
    '---',
    `title: "${note.title.replace(/"/g, '\\"')}"`,
    `created: ${new Date(note.created).toISOString()}`,
    `updated: ${new Date(note.updated).toISOString()}`,
    `source: yinxiang`,
    '---',
    ''
  ].join('\n');

  return frontmatter + content;
}

class ExportController {
  constructor() {
    // 初始化任务队列
    this.queue = new QueueService({
      concurrency: config.queue.concurrency,
      timeout: config.queue.timeout
    });
  }

  /**
   * 导出单个笔记
   * POST /api/export/note/:guid
   */
  async exportNote(req, res, next) {
    let tempService = null;

    try {
      const { guid } = req.params;
      const { imageFormat = 'obsidian' } = req.body;

      logger.info('Exporting note', { noteGuid: guid, imageFormat });

      tempService = new EvernoteService(req.auth.token, req.auth.noteStoreUrl);
      const converter = new Converter({ imageFormat });
      const downloader = new Downloader(tempService);

      // 获取笔记完整信息
      const note = await tempService.getNoteWithResources(guid);
      const notebook = await tempService.getNotebook(note.notebookGuid);

      // 创建导出目录
      await ensureExportsDir();
      const notebookDir = sanitize(notebook.name);
      const noteDir = sanitize(note.title);
      const exportPath = path.join(EXPORTS_DIR, notebookDir, noteDir);

      await fs.mkdir(exportPath, { recursive: true });
      await fs.mkdir(path.join(exportPath, 'images'), { recursive: true });
      await fs.mkdir(path.join(exportPath, 'attachments'), { recursive: true });

      // 下载资源
      const resourceMap = await downloader.downloadResources(note.resources || [], exportPath);

      // 转换为 Markdown
      const result = converter.convert(note.content, resourceMap, note.title);
      const markdown = generateMarkdown(note, result.markdown);

      // 写入文件
      const mdPath = path.join(exportPath, `${sanitize(note.title)}.md`);
      await fs.writeFile(mdPath, markdown, 'utf-8');

      logger.info('Note exported successfully', { noteGuid: guid, exportPath });

      return success(res, {
        message: '导出成功',
        path: exportPath,
        files: {
          markdown: mdPath,
          images: result.images,
          attachments: result.attachments
        }
      });
    } catch (err) {
      logger.error('Failed to export note', {
        noteGuid: req.params.guid,
        error: err.message
      });
      next(err);
    }
  }

  /**
   * 导出整个笔记本
   * POST /api/export/notebook/:guid
   */
  async exportNotebook(req, res, next) {
    let tempService = null;

    try {
      const { guid } = req.params;
      const { imageFormat = 'obsidian' } = req.body;

      logger.info('Exporting notebook', { notebookGuid: guid, imageFormat });

      tempService = new EvernoteService(req.auth.token, req.auth.noteStoreUrl);
      const converter = new Converter({ imageFormat });
      const downloader = new Downloader(tempService);

      // 获取笔记本信息
      const notebook = await tempService.getNotebook(guid);
      const notesResult = await tempService.getNotesInNotebook(guid, 0, 1000);

      await ensureExportsDir();
      const notebookDir = sanitize(notebook.name);
      const exportBasePath = path.join(EXPORTS_DIR, notebookDir);
      await fs.mkdir(exportBasePath, { recursive: true });

      const exportedNotes = [];
      const errors = [];

      for (let i = 0; i < notesResult.notes.length; i++) {
        const noteMeta = notesResult.notes[i];
        try {
          // 获取完整笔记
          const note = await tempService.getNoteWithResources(noteMeta.guid);
          const noteDir = sanitize(note.title);
          const exportPath = path.join(exportBasePath, noteDir);

          await fs.mkdir(exportPath, { recursive: true });
          await fs.mkdir(path.join(exportPath, 'images'), { recursive: true });
          await fs.mkdir(path.join(exportPath, 'attachments'), { recursive: true });

          // 下载资源
          const resourceMap = await downloader.downloadResources(note.resources || [], exportPath);

          // 转换
          const result = converter.convert(note.content, resourceMap, note.title);
          const markdown = generateMarkdown(note, result.markdown);

          // 写入
          const mdPath = path.join(exportPath, `${sanitize(note.title)}.md`);
          await fs.writeFile(mdPath, markdown, 'utf-8');

          exportedNotes.push({
            guid: note.guid,
            title: note.title,
            path: exportPath
          });

          // 控制请求频率
          if (i < notesResult.notes.length - 1) {
            await this.delay(config.api.requestInterval);
          }
        } catch (err) {
          errors.push({
            guid: noteMeta.guid,
            title: noteMeta.title,
            error: err.message
          });
        }
      }

      logger.info('Notebook export completed', {
        notebookGuid: guid,
        successCount: exportedNotes.length,
        errorCount: errors.length
      });

      return success(res, {
        message: `导出完成: ${exportedNotes.length} 成功, ${errors.length} 失败`,
        exportPath: exportBasePath,
        exported: exportedNotes,
        errors
      });
    } catch (err) {
      logger.error('Failed to export notebook', {
        notebookGuid: req.params.guid,
        error: err.message
      });
      next(err);
    }
  }

  /**
   * 多笔记本批量导出
   * POST /api/export/batch
   */
  async exportBatch(req, res, next) {
    try {
      const { notebookGuids, imageFormat = 'obsidian' } = req.body;

      if (!Array.isArray(notebookGuids) || notebookGuids.length === 0) {
        return error(res, '请提供要导出的笔记本 ID 列表', 400);
      }

      logger.info('Starting batch export', { notebookCount: notebookGuids.length, imageFormat });

      // 生成任务 ID
      const taskObj = exportTracker.createTask(Date.now().toString(), {
        type: 'multiple-notebooks',
        notebookGuids,
        imageFormat
      });
      const taskId = taskObj.id;

      // 异步处理导出
      this._processBatchExport(taskId, notebookGuids, req.auth, { imageFormat })
        .catch(err => {
          logger.error('Batch export failed', { taskId, error: err.message });
          exportTracker.updateTask(taskId, {
            status: 'failed',
            errors: [{ message: err.message }]
          });
        });

      return success(res, {
        taskId,
        message: '批量导出任务已创建'
      });
    } catch (err) {
      logger.error('Failed to create batch export task', { error: err.message });
      next(err);
    }
  }

  /**
   * 获取导出任务进度
   * GET /api/export/progress/:taskId
   */
  async getProgress(req, res, next) {
    try {
      const { taskId } = req.params;
      const task = exportTracker.getTask(taskId);

      if (!task) {
        return error(res, '任务不存在', 404);
      }

      return success(res, task);
    } catch (err) {
      logger.error('Failed to get task progress', { taskId: req.params.taskId, error: err.message });
      next(err);
    }
  }

  /**
   * 处理批量导出（内部方法）
   */
  async _processBatchExport(taskId, notebookGuids, auth, options) {
    logger.info('Processing batch export', { taskId, notebookCount: notebookGuids.length });

    exportTracker.updateTask(taskId, { status: 'processing' });

    const evernoteService = new EvernoteService(auth.token, auth.noteStoreUrl);
    const converter = new Converter({ imageFormat: options.imageFormat });
    const downloader = new Downloader(evernoteService);

    // 收集所有笔记 GUID
    const allNoteGuids = [];

    for (const notebookGuid of notebookGuids) {
      try {
        const notebook = await evernoteService.getNotebook(notebookGuid);
        const notesResult = await evernoteService.getNotesInNotebook(notebookGuid, 0, 1000);

        logger.info('Collected notes from notebook', {
          notebookGuid,
          notebookName: notebook.name,
          noteCount: notesResult.notes?.length || 0
        });

        notesResult.notes?.forEach(note => {
          allNoteGuids.push({
            guid: note.guid,
            title: note.title,
            notebookName: notebook.name
          });
        });
      } catch (err) {
        logger.error('Failed to get notebook notes', { notebookGuid, error: err.message });
        exportTracker.updateTask(taskId, {
          errors: [{ notebookGuid, error: err.message }]
        });
      }
    }

    // 更新任务总数
    exportTracker.updateTask(taskId, { total: allNoteGuids.length });

    // 使用队列处理导出
    const results = [];
    const errors = [];

    for (const noteInfo of allNoteGuids) {
      try {
        await this.queue.add(
          async () => {
            const note = await evernoteService.getNoteWithResources(noteInfo.guid);

            const exportBasePath = path.join(EXPORTS_DIR, sanitize(noteInfo.notebookName));
            await fs.mkdir(exportBasePath, { recursive: true });

            const noteDir = sanitize(noteInfo.title);
            const exportPath = path.join(exportBasePath, noteDir);

            await fs.mkdir(exportPath, { recursive: true });
            await fs.mkdir(path.join(exportPath, 'images'), { recursive: true });
            await fs.mkdir(path.join(exportPath, 'attachments'), { recursive: true });

            const resourceMap = await downloader.downloadResources(note.resources || [], exportPath);
            const result = converter.convert(note.content, resourceMap, noteInfo.title);
            const markdown = generateMarkdown(note, result.markdown);

            await fs.writeFile(path.join(exportPath, `${sanitize(noteInfo.title)}.md`), markdown, 'utf-8');

            return { guid: note.guid, title: note.title, path: exportPath };
          },
          { noteGuid: noteInfo.guid, noteTitle: noteInfo.title }
        );

        results.push({ guid: noteInfo.guid, status: 'success' });

        // 更新进度
        const successCount = results.length;
        exportTracker.updateTask(taskId, {
          progress: Math.floor((successCount / allNoteGuids.length) * 100),
          success: successCount
        });

        // 控制请求频率
        await this.delay(config.api.requestInterval);

      } catch (err) {
        errors.push({ guid: noteInfo.guid, title: noteInfo.title, error: err.message });
        logger.error('Failed to export note in batch', {
          noteGuid: noteInfo.guid,
          error: err.message
        });
      }
    }

    // 等待队列完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 更新任务状态
    exportTracker.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      success: results.length,
      errors
    });

    logger.info('Batch export completed', {
      taskId,
      successCount: results.length,
      errorCount: errors.length
    });
  }

  /**
   * 下载导出目录为 ZIP
   * GET /api/export/download
   */
  async downloadExport(req, res, next) {
    try {
      const { path: exportPath } = req.query;

      if (!exportPath) {
        return error(res, '请指定导出路径', 400);
      }

      // 安全检查：确保路径在 exports 目录内
      const fullPath = path.resolve(exportPath);
      if (!fullPath.startsWith(path.resolve(EXPORTS_DIR))) {
        logger.warn('Invalid export path requested', { requestedPath: exportPath });
        return error(res, '无效的路径', 403);
      }

      const stat = await fs.stat(fullPath);
      if (!stat.isDirectory()) {
        return error(res, '路径不是目录', 400);
      }

      const zipName = path.basename(fullPath) + '.zip';
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);

      const archive = archiver('zip', { zlib: { level: 9 } });
      archive.pipe(res);
      archive.directory(fullPath, path.basename(fullPath));
      await archive.finalize();

      logger.info('Export downloaded', { exportPath: fullPath });
    } catch (err) {
      logger.error('Failed to download export', { error: err.message });
      next(err);
    }
  }

  /**
   * 延迟函数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 按笔记列表批量导出
   * POST /api/export/notes
   */
  async exportNotes(req, res, next) {
    try {
      const { noteGuids, imageFormat = 'obsidian' } = req.body;

      if (!Array.isArray(noteGuids) || noteGuids.length === 0) {
        return error(res, '请提供要导出的笔记 ID 列表', 400);
      }

      logger.info('Starting notes batch export', { noteCount: noteGuids.length, imageFormat });

      // 生成任务 ID
      const taskObj = exportTracker.createTask(Date.now().toString(), {
        type: 'multiple-notes',
        noteGuids,
        imageFormat
      });
      const taskId = taskObj.id;

      // 异步处理导出
      this._processNotesExport(taskId, noteGuids, req.auth, { imageFormat })
        .catch(err => {
          logger.error('Notes export failed', { taskId, error: err.message });
          exportTracker.updateTask(taskId, {
            status: 'failed',
            errors: [{ message: err.message }]
          });
        });

      return success(res, {
        taskId,
        message: '批量导出任务已创建'
      });
    } catch (err) {
      logger.error('Failed to create notes export task', { error: err.message });
      next(err);
    }
  }

  /**
   * 处理按笔记列表导出（内部方法）
   */
  async _processNotesExport(taskId, noteGuids, auth, options) {
    logger.info('Processing notes export', { taskId, noteCount: noteGuids.length });

    exportTracker.updateTask(taskId, { status: 'processing' });

    const evernoteService = new EvernoteService(auth.token, auth.noteStoreUrl);
    const converter = new Converter({ imageFormat: options.imageFormat });
    const downloader = new Downloader(evernoteService);

    // 按笔记本分组笔记
    const notesByNotebook = new Map();

    for (const noteGuid of noteGuids) {
      try {
        const note = await evernoteService.getNoteWithResources(noteGuid);
        const notebook = await evernoteService.getNotebook(note.notebookGuid);

        if (!notesByNotebook.has(note.notebookGuid)) {
          notesByNotebook.set(note.notebookGuid, {
            notebookName: notebook.name,
            notes: []
          });
        }
        notesByNotebook.get(note.notebookGuid).notes.push({
          guid: note.guid,
          title: note.title,
          notebookName: notebook.name
        });

        // 控制请求频率
        await this.delay(config.api.requestInterval);
      } catch (err) {
        logger.error('Failed to get note', { noteGuid, error: err.message });
      }
    }

    // 更新任务总数
    const allNoteInfos = [];
    notesByNotebook.forEach(group => {
      allNoteInfos.push(...group.notes);
    });
    exportTracker.updateTask(taskId, { total: allNoteInfos.length });

    // 使用队列处理导出
    const results = [];
    const errors = [];

    for (const noteInfo of allNoteInfos) {
      try {
        await this.queue.add(async () => {
          const note = await evernoteService.getNoteWithResources(noteInfo.guid);

          const exportBasePath = path.join(EXPORTS_DIR, sanitize(noteInfo.notebookName));
          await fs.mkdir(exportBasePath, { recursive: true });

          const noteDir = sanitize(noteInfo.title);
          const exportPath = path.join(exportBasePath, noteDir);

          await fs.mkdir(exportPath, { recursive: true });
          await fs.mkdir(path.join(exportPath, 'images'), { recursive: true });
          await fs.mkdir(path.join(exportPath, 'attachments'), { recursive: true });

          const resourceMap = await downloader.downloadResources(note.resources || [], exportPath);
          const result = converter.convert(note.content, resourceMap, noteInfo.title);
          const markdown = generateMarkdown(note, result.markdown);

          await fs.writeFile(path.join(exportPath, `${sanitize(noteInfo.title)}.md`), markdown, 'utf-8');

          return { guid: note.guid, title: note.title, path: exportPath };
        });

        results.push({ guid: noteInfo.guid, status: 'success' });

        // 更新进度
        exportTracker.updateTask(taskId, {
          progress: Math.floor((results.length / allNoteInfos.length) * 100),
          success: results.length
        });

        // 控制请求频率
        await this.delay(config.api.requestInterval);

      } catch (err) {
        errors.push({ guid: noteInfo.guid, title: noteInfo.title, error: err.message });
        logger.error('Failed to export note', { noteGuid: noteInfo.guid, error: err.message });
      }
    }

    // 等待队列完成
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 更新任务状态
    exportTracker.updateTask(taskId, {
      status: 'completed',
      progress: 100,
      success: results.length,
      errors
    });

    logger.info('Notes export completed', {
      taskId,
      successCount: results.length,
      errorCount: errors.length
    });
  }
}

module.exports = new ExportController();
