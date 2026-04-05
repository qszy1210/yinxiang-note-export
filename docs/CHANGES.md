# 改动记录

## 2026-04-05

### 笔记本选择逻辑重构（第一期）

**改动内容：**

- 新增 `noteSelectionCache` 数据结构，按笔记本独立存储笔记勾选状态
- 修复：左侧勾选 checkbox 后自动加载对应笔记本笔记到右侧
- 修复：左侧减号➖点击在"全选"和"取消全选"之间切换
- 优化：右侧全选 checkbox 只在有搜索过滤时显示
- 修复：移除 `updateUI()` 中错误调用 `loadNotesForNotebooks()` 覆盖右侧的问题
- 修复：导出功能 `handleExport()` 适配新的 `noteSelectionCache` 结构
- 修复：顶部"选择笔记"改为显示"当前笔记本名称 (已选择 X 篇)"
- 界面优化：左侧笔记本后显示已选中笔记数量

**涉及文件：**

- `public/js/modules/export.module.js`
- `public/css/layout.css`
- `public/index.html`

---

## 2026-01-23

### 基本功能完善

**改动内容：**

- 移除自动加载逻辑，改为按钮手动触发（避免 API 限流）
- 添加加载失败错误提示和友好的限流提示
- 恢复标签加载失败时按钮状态以便重试
- "查找空标签"功能添加确认对话框

**涉及文件：**

- `public/js/app.js`
- `public/js/modules/export.module.js`
- `public/js/modules/organize.module.js`
- `public/index.html`
- `public/css/style.css`
