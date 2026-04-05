/**
 * 导出路由
 * 处理导出相关的 API 端点
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const exportController = require('../controllers/export.controller');

// 应用认证中间件到所有路由
router.use(requireAuth);

// POST /api/export/note/:guid - 导出单个笔记
router.post('/note/:guid', exportController.exportNote);

// POST /api/export/notebook/:guid - 导出整个笔记本
router.post('/notebook/:guid', exportController.exportNotebook);

// POST /api/export/batch - 多笔记本批量导出（新增）
router.post('/batch', exportController.exportBatch.bind(exportController));

// GET /api/export/progress/:taskId - 获取导出任务进度（新增）
router.get('/progress/:taskId', exportController.getProgress.bind(exportController));

// POST /api/export/notes - 按笔记列表批量导出
router.post('/notes', exportController.exportNotes.bind(exportController));

// GET /api/export/download - 打包下载导出目录
router.get('/download', exportController.downloadExport);

module.exports = router;
