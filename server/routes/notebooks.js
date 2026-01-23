/**
 * 笔记本路由
 * 处理笔记本相关的 API 端点
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const notebookController = require('../controllers/notebook.controller');

// 应用认证中间件到所有路由
router.use(requireAuth);

// GET /api/notebooks - 获取笔记本列表
router.get('/', notebookController.listNotebooks);

// GET /api/notebooks/:guid/notes - 获取笔记本下的笔记列表
router.get('/:guid/notes', notebookController.getNotes);

// GET /api/notebooks/:guid - 获取单个笔记本详情
router.get('/:guid', notebookController.getNotebook);

module.exports = router;
