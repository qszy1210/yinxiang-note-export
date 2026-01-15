require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/notebooks', require('./routes/notebooks'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/export', require('./routes/export'));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || '服务器内部错误'
  });
});

app.listen(PORT, () => {
  console.log(`印象笔记导出工具已启动: http://localhost:${PORT}`);
});
