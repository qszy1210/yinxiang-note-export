const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const archiver = require('archiver');
const EvernoteService = require('../services/evernote');
const Converter = require('../services/converter');
const Downloader = require('../services/downloader');
const { getCredentials } = require('../utils/auth-helper');
const sanitize = require('sanitize-filename');

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

// POST /api/export/note/:guid - 导出单个笔记
router.post('/note/:guid', async (req, res, next) => {
  try {
    const { guid } = req.params;
    const { imageFormat = 'obsidian' } = req.body;

    const credentials = getCredentials(req);
    const service = new EvernoteService(credentials.token, credentials.noteStoreUrl);
    const converter = new Converter({ imageFormat });
    const downloader = new Downloader(service);

    // 获取笔记完整信息
    const note = await service.getNoteWithResources(guid);
    const notebook = await service.getNotebook(note.notebookGuid);

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

    // 添加 frontmatter
    const markdown = generateMarkdown(note, result.markdown);

    // 写入文件
    const mdPath = path.join(exportPath, `${sanitize(note.title)}.md`);
    await fs.writeFile(mdPath, markdown, 'utf-8');

    res.json({
      success: true,
      message: '导出成功',
      path: exportPath,
      files: {
        markdown: mdPath,
        images: result.images,
        attachments: result.attachments
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/export/notebook/:guid - 导出整个笔记本
router.post('/notebook/:guid', async (req, res, next) => {
  try {
    const { guid } = req.params;
    const { imageFormat = 'obsidian' } = req.body;

    const credentials = getCredentials(req);
    const service = new EvernoteService(credentials.token, credentials.noteStoreUrl);
    const converter = new Converter({ imageFormat });
    const downloader = new Downloader(service);

    // 获取笔记本信息
    const notebook = await service.getNotebook(guid);
    const notesResult = await service.getNotesInNotebook(guid, 0, 1000);

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
        const note = await service.getNoteWithResources(noteMeta.guid);
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

        // 控制请求频率，避免 API 限流
        if (i < notesResult.notes.length - 1) {
          await sleep(200);
        }
      } catch (err) {
        errors.push({
          guid: noteMeta.guid,
          title: noteMeta.title,
          error: err.message
        });
      }
    }

    res.json({
      success: true,
      message: `导出完成: ${exportedNotes.length} 成功, ${errors.length} 失败`,
      exportPath: exportBasePath,
      exported: exportedNotes,
      errors
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/export/download - 打包下载导出目录
router.get('/download', async (req, res, next) => {
  try {
    const { path: exportPath } = req.query;

    if (!exportPath) {
      return res.status(400).json({ error: true, message: '请指定导出路径' });
    }

    // 安全检查：确保路径在 exports 目录内
    const fullPath = path.resolve(exportPath);
    if (!fullPath.startsWith(path.resolve(EXPORTS_DIR))) {
      return res.status(403).json({ error: true, message: '无效的路径' });
    }

    const stat = await fs.stat(fullPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: true, message: '路径不是目录' });
    }

    const zipName = path.basename(fullPath) + '.zip';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(zipName)}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    archive.directory(fullPath, path.basename(fullPath));
    await archive.finalize();
  } catch (err) {
    next(err);
  }
});

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = router;
