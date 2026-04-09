# 印象笔记全量导出方案 A：ENEX 本地转换

## 方案概述

将印象笔记（Evernote 中国版）的全部笔记导出为标准 Markdown 文件，**完全在本地离线完成，不直接调用印象笔记 API，不存在限流风险**。

核心流程：

```
印象笔记云端
    ↓  evernote-backup（第三方工具，一次性同步到本地 SQLite）
本地 .enex 文件（每个笔记本一个）
    ↓  node scripts/export-enex.js（流式解析，逐条转换）
Markdown + 图片/附件
```

---

## 1. 导出机制详解

### 1.1 为什么印象笔记没有通用文本导出？

印象笔记使用自有的 **ENML（Evernote Note Markup Language）** 格式存储笔记内容。ENML 本质是受限的 XHTML，但加入了多个私有标签：

| 标签 | 用途 | 标准 HTML 中无对应 |
|------|------|-------------------|
| `<en-note>` | 笔记根容器 | 是 |
| `<en-media hash="..." type="...">` | 嵌入图片/附件（通过 MD5 hash 引用） | 是 |
| `<en-todo checked="true/false">` | 待办事项复选框 | 是 |
| `<en-crypt>` | 加密文本块 | 是 |

这些私有标签是**印象笔记实现数据锁定的关键手段**。ENML 不是标准 HTML，无法被浏览器直接渲染；附件通过 hash 引用而非 URL 链接，脱离印象笔记客户端就无法访问。官方只提供 ENEX（打包 ENML + base64 编码的资源）和 HTML（仅保留视觉样式，丢失结构信息）两种导出格式，**刻意不提供 Markdown、纯文本等通用格式**，目的是增加迁移成本。

2023 年起，印象笔记中国版甚至取消了桌面客户端的 ENEX 导出功能，改为只支持自有的 `.notes` 私有格式，进一步锁死数据。目前只能通过第三方工具 `evernote-backup` 绕过这个限制。

### 1.2 ENEX 文件格式

ENEX 是一个 XML 文件，结构如下：

```xml
<en-export>
  <note>
    <title>笔记标题</title>
    <content><![CDATA[...ENML 内容...]]></content>
    <created>20240115T103000Z</created>
    <updated>20240620T142200Z</updated>
    <tag>标签名</tag>
    <tag>另一个标签</tag>
    <resource>
      <data encoding="base64">...图片/附件的 base64 编码...</data>
      <mime>image/png</mime>
      <resource-attributes>
        <file-name>screenshot.png</file-name>
      </resource-attributes>
    </resource>
  </note>
  <!-- 更多 note... -->
</en-export>
```

每个笔记本导出为一个 `.enex` 文件，所有笔记及其附件（base64）打包在一起。大笔记本的 ENEX 可达数百 MB。

### 1.3 转换管线

本项目的转换分三个阶段：

**阶段 1：ENML 预处理** (`lib/converter.js` - `preprocessEnml`)

将 ENML 私有标签转换为标准 HTML：

| ENML | 转换为 |
|------|--------|
| `<en-note>` | `<div>` |
| `<en-media hash="abc" type="image/png">` | `<img src="./images/文件名.png">` |
| `<en-media hash="abc" type="application/pdf">` | `<a href="./attachments/文件名.pdf">` |
| `<en-todo checked="true">` | `[x]`（Markdown checkbox） |
| `<en-todo checked="false">` | `[ ]` |
| `<en-crypt>` | `[加密内容 - 无法导出]` |

图片/附件的 hash 通过 `resourceMap`（MD5 → 本地文件名）映射到已保存的资源文件。

**阶段 2：HTML → Markdown** (`node-html-markdown` 库)

标准 HTML 标签（`<p>`, `<h1>`, `<strong>`, `<ul>`, `<table>` 等）通过 `node-html-markdown` 库转换为 Markdown 语法。

**阶段 3：后处理** (`lib/converter.js` - `postprocess`)

- 清理多余空行
- 如果选择 Obsidian 格式：将 `![alt](./images/x.png)` 转为 `![[images/x.png]]`
- 修复列表和 checkbox 格式

### 1.4 资源处理

ENEX 中每个资源（图片、PDF、Office 文档等）以 base64 编码嵌入。转换时：

1. 解码 base64 得到原始二进制数据
2. 计算 MD5 hash（与 ENML 中 `en-media` 的 hash 属性对应）
3. 按 MIME 类型分类存储到 `images/` 或 `attachments/` 目录
4. 构建 `hash → 文件名` 映射表，供 ENML 预处理时替换引用

### 1.5 流式解析

对于大文件（如 700MB 的 ENEX），脚本使用 **逐行流式读取**，在 `<note>` 和 `</note>` 边界切割，每次只将一条笔记的 XML 加载到内存中解析。这样即使 ENEX 文件数 GB，内存占用也只与单条最大笔记成正比。

---

## 2. 操作步骤

### 2.1 前置准备

```bash
# 确保 Node.js >= 18
node --version

# 安装项目依赖
cd /Users/qs/vibe/yinxiang-note-export
npm install

# 安装 evernote-backup（macOS）
brew install evernote-backup
```

### 2.2 同步笔记到本地

```bash
# 初始化并登录印象笔记（中国版），二选一：

# 方式 1：用账号密码（推荐）
evernote-backup init-db --backend china \
  --user "你的手机号或邮箱" \
  --password "你的密码" \
  --force

# 方式 2：用 Developer Token
evernote-backup init-db --backend china \
  --token "你的Token" \
  --force

# 同步全部笔记（首次可能需要几分钟，后续增量同步很快）
evernote-backup sync
```

### 2.3 导出为 ENEX 文件

```bash
# 每个笔记本生成一个 .enex 文件
evernote-backup export ./enex-backup/
```

### 2.4 转换为 Markdown

```bash
# 基本用法（默认 Obsidian 图片格式，输出到 ./exports/）
node scripts/export-enex.js ./enex-backup/

# 指定输出目录
node scripts/export-enex.js ./enex-backup/ --output ~/my-notes

# 使用标准 Markdown 图片格式（非 Obsidian）
node scripts/export-enex.js ./enex-backup/ --format standard

# 强制重新导出（覆盖已有文件）
node scripts/export-enex.js ./enex-backup/ --force

# 转换单个 ENEX 文件
node scripts/export-enex.js ./enex-backup/某笔记本.enex
```

### 2.5 验证结果

```bash
# 查看导出统计
cat exports/_export-report.json

# 查看目录结构
ls exports/

# 统计导出的 Markdown 文件数
find exports -name "*.md" | wc -l
```

---

## 3. 导出目录结构

```
exports/
├── 笔记本A/
│   ├── 笔记标题1/
│   │   ├── 笔记标题1.md          # Markdown 正文 + YAML frontmatter
│   │   ├── images/               # 该笔记引用的图片
│   │   │   ├── screenshot.png
│   │   │   └── photo.jpg
│   │   └── attachments/          # 该笔记引用的附件
│   │       └── document.pdf
│   └── 笔记标题2/
│       └── ...
├── 笔记本B/
│   └── ...
└── _export-report.json           # 导出统计报告
```

---

## 4. Markdown 文件格式

每个 `.md` 文件包含 YAML frontmatter 和正文：

```markdown
---
title: "工作记录 2024-01-15"
created: 2024-01-15T10:30:00Z
updated: 2024-06-20T14:22:00Z
source: yinxiang
notebook: "52-records-work"
tags:
  - "daily-work"
  - "项目管理"
---

笔记正文内容（Markdown 格式）...

![[images/screenshot.png]]
```

| 字段 | 说明 |
|------|------|
| title | 笔记标题 |
| created | 创建时间（UTC ISO 格式） |
| updated | 最后修改时间 |
| source | 固定为 `yinxiang` |
| notebook | 所属笔记本名称（来自 ENEX 文件名） |
| tags | 标签列表（来自 ENEX 中的 `<tag>` 元素） |

---

## 5. 图片链接格式

脚本支持两种图片链接格式，通过 `--format` 参数选择：

| 格式 | 语法 | 适用场景 |
|------|------|----------|
| `obsidian`（默认） | `![[images/file.png]]` | Obsidian 笔记软件 |
| `standard` | `![alt](./images/file.png)` | 通用 Markdown 编辑器 |

---

## 6. 注意事项

### 安全相关

- `evernote-backup init-db` 需要你的印象笔记登录凭证。建议**完成同步后修改密码**。
- 密码不会存储在明文文件中，登录后 token 保存在本地 `en_backup.db`（SQLite）文件里。
- 导出完成后可删除 `en_backup.db` 和 `enex-backup/` 目录。

### 数据完整性

- **加密笔记**：`<en-crypt>` 标记的加密块无法导出，会显示为 `[加密内容 - 无法导出]`。如需导出加密内容，请先在印象笔记客户端手动解密。
- **极少数附件**可能因 base64 编码异常（被 XML 解析器误判为数字类型）而无法保存。这不影响笔记正文的导出。可在 `_export-report.json` 中查看详情。
- **笔记本名作为目录名**：特殊字符会被 `sanitize-filename` 清理。如果两个笔记本清理后同名，内容会合并到同一目录。
- **同名笔记**：同一笔记本下标题相同的笔记会覆盖。使用 `--force` 重新导出时需注意。

### 性能参考

本项目实际导出性能（M 系列 Mac）：

| 指标 | 数值 |
|------|------|
| ENEX 文件 | 17 个 |
| 原始数据大小 | 1.9 GB |
| 笔记总数 | 3540 条 |
| 转换耗时 | 68 秒 |
| 输出大小 | 1.4 GB |
| 失败数 | 0 |

流式解析保证内存使用可控，不会因单个大文件（700MB+）导致崩溃。

### 断点续传

脚本默认开启断点续传 — 如果目标 `.md` 文件已存在则自动跳过。这意味着：

- 转换中断后可以重新运行，已完成的部分不会重复处理
- 想要覆盖已有文件，需要加 `--force` 参数
- 首次运行后调整参数（如切换 obsidian → standard 格式），也需要加 `--force`

### 与其他工具的兼容

导出的 Markdown 可直接导入以下工具：

- **Obsidian**：使用默认 `obsidian` 格式，将 `exports/` 目录作为 Vault 打开即可
- **Notion**：使用 `standard` 格式导出后，通过 Notion 的 Import Markdown 功能导入
- **Logseq / Joplin / Typora**：使用 `standard` 格式
- **Git 仓库**：导出的纯文本 Markdown 天然适合版本控制

---

## 7. 常见问题

**Q: evernote-backup sync 报错怎么办？**

通常是网络问题或凭证过期。可以重新运行 `init-db` 重新登录，然后 `sync`。sync 是增量的，不会重新下载已有笔记。

**Q: 某些图片导出后打不开？**

极少数资源的 base64 编码在 ENEX 中格式异常（被 XML 解析器误判类型）。这些资源的笔记正文依然会完整导出，只是对应的图片文件缺失。受影响的笔记在 Markdown 中会留下 `<!-- 资源未找到: hash -->` 注释。

**Q: 导出后目录太大，如何减小？**

ENEX 中包含所有图片和附件的完整数据。如果只需要文本内容：
- 可以用 `find exports -type d -name images -exec rm -rf {} +` 删除所有图片目录
- 或用 `find exports -type d -name attachments -exec rm -rf {} +` 删除附件

**Q: 能否只导出某些笔记本？**

可以。只把需要的 ENEX 文件放到一个目录里，或者直接指定单个文件：
```bash
node scripts/export-enex.js ./enex-backup/某笔记本.enex
```

**Q: 与方案 B（远程 API）的区别？**

方案 A 通过 `evernote-backup` 一次性把数据拉到本地 SQLite，后续转换完全离线。方案 B 直接调用 Evernote API 逐条获取笔记，每条笔记都是一次网络请求，容易触发 `RATE_LIMIT_REACHED` 限流。对于全量导出场景，方案 A 在速度、可靠性、数据完整性上全面优于方案 B。
