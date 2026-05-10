# 印象笔记全量导出工具

将**印象笔记（Evernote 中国版）**的全部笔记离线转换为 Markdown 文件，包含图片、附件和完整元数据。

全程本地运行，**不调用印象笔记 API，不存在限流问题**。

## 环境要求

| 要求 | 说明 |
|------|------|
| **操作系统** | macOS / Linux / Windows（WSL） |
| **Node.js** | >= 18.0.0（[下载](https://nodejs.org/)） |
| **Python** | >= 3.9（evernote-backup 需要） |
| **evernote-backup** | 第三方同步工具（见下方安装） |

## 核心流程

导出分为 **三个阶段**，每个阶段的输出是下一个阶段的输入，**不能跳步**：

```
印象笔记云端                     本地 SQLite                    ENEX 文件                     Markdown
    │                              │                             │                             │
    │  ① evernote-backup sync      │  ② evernote-backup export   │  ③ export-enex.js           │
    │  (从云端拉取最新笔记)         │  (生成每个笔记本的 .enex)    │  (解析 ENEX → MD + 图片)     │
    ├─────────────────────────────→├────────────────────────────→├────────────────────────────→│
    │                              │                             │                             │
    │  en_backup.db                │  enex-backup/*.enex         │  exports/**/*.md            │
```

> **关键理解**：第③步只是把本地 ENEX 文件转为 Markdown，它不会从印象笔记拉取任何数据。
> 如果印象笔记上有新增/修改的笔记，必须先跑①②刷新 ENEX 文件，再跑③。

---

## 快速开始（首次使用）

### 0. 安装工具（只需一次）

```bash
# 克隆本项目
git clone https://github.com/你的用户名/yinxiang-note-export.git
cd yinxiang-note-export
npm install

# 安装 evernote-backup（二选一）
brew install evernote-backup   # macOS
pip install evernote-backup    # 所有平台
```

### 1. 同步 — 从印象笔记拉取数据

```bash
# 首次需要登录（后续 sync 不需要重复登录）
evernote-backup init-db --backend china

# 同步全部笔记到本地 en_backup.db
evernote-backup sync
```

> 如果开启了两步验证，终端会提示输入验证码。

### 2. 导出 — 生成 ENEX 文件

```bash
# 从本地数据库导出，每个笔记本一个 .enex 文件
evernote-backup export ./enex-backup/
```

### 3. 转换 — ENEX 转为 Markdown

```bash
# 将 ENEX 文件转换为 Markdown + 图片/附件
node scripts/export-enex.js ./enex-backup/
```

完成！在 `exports/` 目录下查看你的全部笔记。

---

## 重新导出（印象笔记有更新时）

当你在印象笔记上新增或修改了笔记，需要**按顺序跑完三步**才能得到最新的 Markdown：

```bash
# ① 增量同步（只拉取变化部分，通常几秒）
evernote-backup sync

# ② 重新生成 ENEX 文件
rm -rf enex-backup && evernote-backup export ./enex-backup/

# ③ 重新转换为 Markdown
rm -rf exports && node scripts/export-enex.js ./enex-backup/
```

也可以一行搞定：

```bash
evernote-backup sync && rm -rf enex-backup && evernote-backup export ./enex-backup/ && rm -rf exports && node scripts/export-enex.js ./enex-backup/
```

## 命令参数

```
node scripts/export-enex.js <enex目录或文件> [选项]

选项：
  --output <dir>     输出目录（默认: ./exports）
  --format <fmt>     图片格式: obsidian | standard（默认: obsidian）
  --force            强制重新导出，覆盖已有文件
```

**常用示例：**

```bash
# 输出到指定目录
node scripts/export-enex.js ./enex-backup/ --output ~/my-notes

# 使用标准 Markdown 图片格式（适合非 Obsidian 工具）
node scripts/export-enex.js ./enex-backup/ --format standard

# 只转换某个笔记本
node scripts/export-enex.js ./enex-backup/某笔记本.enex

# 强制重新导出全部
node scripts/export-enex.js ./enex-backup/ --force
```

## 输出结构

```
exports/
├── 笔记本名称/
│   └── 笔记标题/
│       ├── 笔记标题.md        ← Markdown 正文 + YAML 元数据
│       ├── images/            ← 笔记中的图片
│       │   └── photo.png
│       └── attachments/       ← PDF、Office 等附件
│           └── document.pdf
└── _export-report.json        ← 导出统计报告
```

每个 `.md` 文件包含 YAML frontmatter：

```yaml
---
title: "笔记标题"
created: 2024-01-15T10:30:00Z
updated: 2024-06-20T14:22:00Z
source: yinxiang
notebook: "工作笔记"
tags:
  - "项目管理"
  - "会议记录"
---
```

## 图片链接格式

| 参数值 | 语法 | 适用工具 |
|--------|------|----------|
| `obsidian`（默认） | `![[images/file.png]]` | Obsidian |
| `standard` | `![alt](./images/file.png)` | Typora、Notion、Logseq、Joplin 等 |

## 注意事项

### 断点续传

脚本默认跳过已存在的 `.md` 文件。如果中途中断，重新运行即可继续。如需重新导出全部，加 `--force`。

### 无法导出的内容

- **加密笔记**：`en-crypt` 标记的加密块会显示为 `[加密内容 - 无法导出]`。请先在印象笔记客户端手动解密。
- **墨笔手写**：以图片形式保存，可正常导出，但不可编辑。

### 大文件处理

脚本使用流式解析，单个 ENEX 文件无论多大都不会撑爆内存。实测 700MB+ 文件可正常处理。

### 安全建议

- `evernote-backup` 的登录凭证保存在本地 `en_backup.db` 文件中
- 导出完成后建议删除 `en_backup.db` 和 `enex-backup/` 目录
- 如果使用了 Developer Token，建议完成后撤销

## 工作原理

```
印象笔记 (ENML 私有格式)
    ↓  evernote-backup：一次性同步到本地 SQLite
ENEX 文件 (XML 打包 ENML + base64 资源)
    ↓  export-enex.js：流式解析 → 逐条转换
    ├── ENML 预处理：en-note/en-media/en-todo → 标准 HTML
    ├── HTML → Markdown：node-html-markdown 库
    ├── 后处理：格式清理 + Obsidian 语法转换
    └── 资源提取：base64 解码 → 保存为图片/附件
Markdown + 图片/附件
```

印象笔记使用私有的 ENML 格式存储笔记，通过 `en-media` 标签用 MD5 hash 引用附件，不提供 Markdown 或纯文本导出。本工具将 ENML 标签转为标准 HTML，再经 `node-html-markdown` 转为 Markdown，同时提取并保存 base64 编码的资源文件。

详细技术说明见 [docs/export-guide.md](docs/export-guide.md)。

## 项目结构

```
├── scripts/
│   └── export-enex.js     # 主转换脚本（流式 ENEX 解析）
├── lib/
│   └── converter.js        # ENML → HTML → Markdown 转换器
├── docs/
│   └── export-guide.md     # 详细技术文档
├── package.json
└── README.md
```

## 性能参考

在 Apple M 系列 Mac 上的实测数据：

| 指标 | 数值 |
|------|------|
| ENEX 文件数 | 20 |
| 原始数据量 | 1.9 GB |
| 笔记总数 | 3622 条 |
| 转换耗时 | ~70 秒 |
| 导出大小 | 1.4 GB |

## 常见问题

<details>
<summary><b>重新跑了第③步，但导出结果没变化？</b></summary>

第③步只转换本地已有的 ENEX 文件。如果印象笔记有新增/修改内容，必须先跑第①②步刷新 ENEX 文件，再跑第③步。参见上方「重新导出」章节。
</details>

<details>
<summary><b>evernote-backup sync 报错怎么办？</b></summary>

通常是网络问题或凭证过期。重新运行 `evernote-backup init-db --backend china` 登录，再 `sync`。sync 是增量的，不会重新下载已有笔记。
</details>

<details>
<summary><b>某些图片导出后打不开？</b></summary>

极少数资源的 base64 编码在 ENEX 中格式异常。笔记正文仍会完整导出，只是对应图片缺失。Markdown 中会留下 `<!-- 资源未找到: hash -->` 注释。
</details>

<details>
<summary><b>能否只导出某些笔记本？</b></summary>

可以。只把需要的 `.enex` 文件放到一个目录，或直接指定文件：
```bash
node scripts/export-enex.js ./enex-backup/某笔记本.enex
```
</details>

<details>
<summary><b>Obsidian 和 standard 格式有什么区别？</b></summary>

仅影响图片/附件的引用语法。Obsidian 用 `![[]]` 语法，标准 Markdown 用 `![]()` 语法。笔记正文内容完全相同。
</details>

<details>
<summary><b>导出后目录太大怎么办？</b></summary>

大部分体积来自图片和附件。如果只需文本：
```bash
find exports -type d -name images -exec rm -rf {} +
find exports -type d -name attachments -exec rm -rf {} +
```
</details>

## License

MIT
