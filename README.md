# 印象笔记导出工具

将印象笔记（Yinxiang/Evernote China）导出为 Markdown 格式，支持图片和附件下载。

## 功能特点

### 核心功能
- **导出笔记为 Markdown 格式** - 完整保留笔记内容
- **支持图片下载和本地引用** - 自动下载并本地化图片
- **支持附件下载** - PDF、Office 文档等附件
- **两种图片引用格式** - Obsidian 格式和标准 Markdown 格式
- **保留笔记元数据** - 创建时间、更新时间等 YAML frontmatter
- **待办事项转换** - checkbox 格式转换

### 新增功能
- **多笔记本批量导出** - 支持选择多个笔记本一次性导出
- **智能队列管理** - 自动控制请求频率，避免 API 限流
- **标签管理** - 加载、搜索、删除标签，支持查找空标签
- **左右分栏布局** - 更高效的选择界面
- **模块化架构** - 清晰的代码结构，易于维护和扩展

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
cd yinxiang-note-export
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

1. 在「配置」Tab 中输入 Token 和 NoteStore URL（如果未配置 .env）
2. 点击「验证并连接」
3. 切换到「导出」Tab
4. 从左侧选择笔记本
5. 在右侧勾选要导出的笔记
6. 选择图片引用格式
7. 点击「导出选中」

### 导出多个笔记本

1. 在左侧笔记本列表中勾选多个笔记本
2. 点击「导出选中」按钮
3. 系统会自动创建批量导出任务
4. 实时查看导出进度

### 导出整个笔记本

1. 选择一个笔记本
2. 点击「导出整个笔记本」按钮

### 标签整理

1. 切换到「整理」Tab
2. 点击「加载标签」获取所有标签
3. 使用「查找空标签」快速定位无用标签
4. 勾选要删除的标签
5. 点击「删除选中标签」

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

### 认证接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/auth/verify` | POST | 验证 Token |
| `/api/auth/config` | GET | 获取服务器配置 |

### 笔记本接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/notebooks` | GET | 获取笔记本列表 |
| `/api/notebooks/:guid/notes` | GET | 获取笔记本下的笔记 |
| `/api/notebooks/:guid` | GET | 获取笔记本详情 |

### 导出接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/export/note/:guid` | POST | 导出单个笔记 |
| `/api/export/notebook/:guid` | POST | 导出整个笔记本 |
| `/api/export/batch` | POST | 批量导出多个笔记本 |
| `/api/export/progress/:taskId` | GET | 获取导出任务进度 |
| `/api/export/download` | GET | 下载 ZIP 文件 |

### 标签接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/tags` | GET | 获取所有标签 |
| `/api/tags/delete` | POST | 删除指定标签 |
| `/api/tags/empty` | GET | 查找空标签 |
| `/api/tags/stats` | GET | 获取标签统计 |

请求时需要在 Header 中携带认证信息：

```
X-Evernote-Token: your_token
X-Evernote-NoteStore-URL: your_notestore_url
```

## 项目结构

```
server/
├── config/               # 配置管理
│   └── app.config.js     # 应用配置
├── controllers/          # 控制器层
│   ├── auth.controller.js
│   ├── notebook.controller.js
│   ├── export.controller.js
│   └── tag.controller.js
├── routes/               # 路由层
│   ├── auth.js
│   ├── notebooks.js
│   ├── notes.js
│   ├── export.js
│   └── tags.js
├── services/             # 服务层
│   ├── evernote.js       # Evernote API 封装
│   ├── converter.js      # ENML 转 Markdown
│   ├── downloader.js     # 资源下载
│   ├── queue.service.js  # 任务队列
│   └── export-tracker.js # 导出任务追踪
├── middleware/           # 中间件
│   ├── auth.middleware.js
│   ├── error.handler.js
│   └── rate-limiter.js
├── utils/                # 工具函数
│   ├── auth-helper.js
│   ├── logger.js
│   └── response.js
└── index.js             # 应用入口

public/
├── css/
│   ├── style.css         # 主样式
│   └── layout.css        # 布局样式
├── js/
│   ├── utils/            # 工具函数
│   │   ├── helpers.js
│   │   └── dom.js
│   ├── modules/          # 功能模块
│   │   ├── state.module.js    # 状态管理
│   │   ├── api.module.js      # API 封装
│   │   ├── config.module.js   # 配置模块
│   │   ├── export.module.js   # 导出模块
│   │   ├── organize.module.js # 整理模块
│   │   └── ui.module.js       # UI 模块
│   └── app.js            # 应用入口
└── index.html            # 主页面
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

### 批量导出卡住？

- 检查浏览器控制台是否有错误信息
- 尝试减少选择的笔记本数量
- 等待当前队列任务完成

## 技术说明

- **后端**: Node.js + Express
- **前端**: 原生 HTML/CSS/JavaScript（模块化架构）
- **API**: 印象笔记官方 SDK (evernote-sdk-js)
- **转换**: enml-js + node-html-markdown
- **架构**: MVC 分层架构 + 任务队列系统

## 安全说明

- 您的 Token 仅在本地使用，不会上传到任何外部服务器
- 建议使用完毕后撤销 Developer Token
- 导出的文件仅保存在本地 `exports` 目录
- 支持通过 `.env` 文件配置敏感信息

## License

MIT
