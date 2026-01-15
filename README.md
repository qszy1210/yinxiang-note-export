# 印象笔记导出工具

将印象笔记（Yinxiang/Evernote China）导出为 Markdown 格式，支持图片和附件下载。

## 功能特点

- 导出笔记为 Markdown 格式
- 支持图片下载和本地引用
- 支持附件（PDF、Office文档等）下载
- 支持 Obsidian 和标准 Markdown 两种图片引用格式
- 保留笔记的创建时间、更新时间等元数据
- 支持待办事项（checkbox）转换
- 支持批量导出整个笔记本

## 环境要求

- Node.js 18.0.0 或更高版本
- 印象笔记账号

## 快速开始

### 1. 获取 Developer Token

1. 登录印象笔记网页版
2. 访问 [Developer Token 页面](https://app.yinxiang.com/api/DeveloperToken.action)
3. 点击 "Create a developer token" 按钮
4. 复制生成的 **Developer Token** 和 **NoteStore URL**

> 注意：请妥善保管您的 Token，不要泄露给他人。

### 2. 安装依赖

```bash
cd yx-export
npm install
```

### 3. 配置 Token（可选）

您可以选择在 `.env` 文件中配置 Token，或在网页界面中输入。

复制 `.env.example` 为 `.env` 并填写：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
EVERNOTE_TOKEN=your_developer_token_here
EVERNOTE_NOTESTORE_URL=https://app.yinxiang.com/shard/s1/notestore
PORT=3000
```

### 4. 启动服务

```bash
npm start
```

或开发模式（自动重启）：

```bash
npm run dev
```

### 5. 访问界面

打开浏览器访问：http://localhost:3000

## 使用说明

### 导出单个笔记

1. 在界面中输入 Token 和 NoteStore URL（如果未配置 .env）
2. 点击「验证 Token」
3. 从左侧选择笔记本
4. 在右侧勾选要导出的笔记
5. 选择图片引用格式
6. 点击「导出选中笔记」

### 导出整个笔记本

1. 选择一个笔记本
2. 点击「导出整个笔记本」

### 导出格式

导出的文件结构如下：

```
exports/
└── 笔记本名称/
    └── 笔记标题/
        ├── 笔记标题.md      # Markdown 文件
        ├── images/          # 图片文件夹
        │   ├── image1.png
        │   └── image2.jpg
        └── attachments/     # 附件文件夹
            └── document.pdf
```

Markdown 文件包含 YAML frontmatter：

```markdown
---
title: "笔记标题"
created: 2024-01-15T10:30:00.000Z
updated: 2024-01-16T15:45:00.000Z
source: yinxiang
---

笔记内容...
```

### 图片引用格式

**Obsidian 格式**（默认）：
```markdown
![[images/image.png]]
```

**标准 Markdown 格式**：
```markdown
![](./images/image.png)
```

## API 接口

如果您需要通过 API 调用：

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/auth/verify` | POST | 验证 Token |
| `/api/notebooks` | GET | 获取笔记本列表 |
| `/api/notebooks/:guid/notes` | GET | 获取笔记本下的笔记 |
| `/api/notes/:guid` | GET | 获取笔记详情 |
| `/api/export/note/:guid` | POST | 导出单个笔记 |
| `/api/export/notebook/:guid` | POST | 导出笔记本 |
| `/api/export/download` | GET | 下载 ZIP |

请求时需要在 Header 中携带认证信息：

```
X-Evernote-Token: your_token
X-Evernote-NoteStore-URL: your_notestore_url
```

## 常见问题

### Token 验证失败？

- 确保 Token 没有过期或被撤销
- 确认 NoteStore URL 格式正确
- 检查网络连接是否正常

### 导出的图片无法显示？

- 确保图片文件已正确下载到 `images` 文件夹
- 检查 Markdown 编辑器是否支持所选的引用格式

### 导出速度慢？

- 印象笔记 API 有调用频率限制，程序会自动控制请求速度
- 包含大量图片/附件的笔记需要更多下载时间

### 部分内容无法导出？

- 加密内容（en-crypt）无法导出，会显示为提示文字
- 复杂表格可能格式不完美

## 技术说明

- 后端：Node.js + Express
- 前端：原生 HTML/CSS/JavaScript
- API：印象笔记官方 SDK (evernote-sdk-js)
- 转换：enml-js + node-html-markdown

## 安全说明

- 您的 Token 仅在本地使用，不会上传到任何外部服务器
- 建议使用完毕后撤销 Developer Token
- 导出的文件仅保存在本地 `exports` 目录

## License

MIT
