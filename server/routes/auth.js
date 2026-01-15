const express = require('express');
const router = express.Router();
const EvernoteService = require('../services/evernote');

// POST /api/auth/verify - 验证 Token 有效性
router.post('/verify', async (req, res, next) => {
  try {
    const { token, noteStoreUrl } = req.body;

    if (!token || !noteStoreUrl) {
      return res.status(400).json({
        error: true,
        message: '请提供 Token 和 NoteStore URL'
      });
    }

    const service = new EvernoteService(token, noteStoreUrl);
    const user = await service.getUser();

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name
      }
    });
  } catch (err) {
    res.status(401).json({
      error: true,
      message: 'Token 验证失败: ' + err.message
    });
  }
});

// GET /api/auth/config - 获取服务器配置的 Token (如果有)
router.get('/config', (req, res) => {
  const token = process.env.EVERNOTE_TOKEN;
  const noteStoreUrl = process.env.EVERNOTE_NOTESTORE_URL;
  const hasConfig = !!(token && noteStoreUrl);

  res.json({
    hasConfig,
    // 返回完整的配置信息供前端使用
    token: hasConfig ? token : null,
    noteStoreUrl: hasConfig ? noteStoreUrl : null
  });
});

module.exports = router;
