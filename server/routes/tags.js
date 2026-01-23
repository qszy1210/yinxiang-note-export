/**
 * 标签路由
 * 处理标签管理相关的 API 端点
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth.middleware');
const tagController = require('../controllers/tag.controller');

// 应用认证中间件到所有路由
router.use(requireAuth);

// GET /api/tags - 获取所有标签列表
router.get('/', tagController.listTags);

// POST /api/tags/delete - 删除指定的标签
router.post('/delete', tagController.deleteTags);

// GET /api/tags/empty - 查找空标签
router.get('/empty', tagController.findEmptyTags);

// GET /api/tags/stats - 获取标签使用统计
router.get('/stats', tagController.getTagStats);

module.exports = router;
