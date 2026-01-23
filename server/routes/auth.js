/**
 * 认证路由
 * 处理认证相关的 API 端点
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// POST /api/auth/verify - 验证 Token 有效性
router.post('/verify', authController.verifyToken);

// GET /api/auth/config - 获取服务器配置的 Token (如果有)
router.get('/config', authController.getConfig);

module.exports = router;
