# 导出模块选中逻辑重构设计

## 背景

当前导出模块存在两个独立的状态：
- `selectedNotebooks` - 笔记本是否被"选中"用于批量导出
- `noteSelectionCache` - 每个笔记本下哪些笔记被"勾选"

原有逻辑：选中笔记本 → 整个笔记本导出（noteSelectionCache 被忽略），导致"部分选中"状态语义不清。

## 设计目标

1. **统一导出逻辑**：选中笔记本时，按 noteSelectionCache 精确导出（而不是全笔记本）
2. **清晰的 UI 提示**：让用户知道当前是什么模式
3. **布局优化**：左栏固定宽度，导出设置移至左侧，右侧笔记列表支持滚动

## 功能设计

### 1. 导出逻辑

**修改 `handleExport()`：**
- 选中笔记本时，**按 noteSelectionCache 精确导出**该笔记本下被选中的笔记
- 只有选中笔记本的笔记才导出，其他笔记本的笔记不受影响

```javascript
// 导出逻辑
const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
const noteCache = getNoteSelectionCache();

// 构建导出列表：
// 1. 选中笔记本的所有笔记（如果 noteCache 中有记录，按记录精确导出）
// 2. 未选中笔记本的笔记不受影响
```

**具体行为：**
1. 勾选笔记本A的部分笔记 → A 显示部分选中，笔记选中了
2. 又勾选笔记本B（自动全选B的笔记）→ B 显示全选中
3. 导出 → A 的部分笔记 + B 的全部笔记

### 2. 笔记本 checkbox 点击行为

- **勾选笔记本**：把该笔记本加入 `selectedNotebooks`，同时**默认全选**该笔记本的笔记（自动勾选所有笔记 checkbox）
- **取消勾选笔记本**：从 `selectedNotebooks` 移除，清空该笔记本的 noteSelectionCache
- **减号(partial) 点击**：切换全选/取消全选该笔记本的笔记

### 3. 笔记 checkbox 行为

- **始终可编辑**：不管是哪种模式，笔记都可以勾选/取消勾选
- 勾选笔记 → 更新 noteSelectionCache
- 取消勾选 → 更新 noteSelectionCache

## UI 设计

### 1. 布局调整

**Container 宽度：**
```css
.container {
  width: 98%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}
```

**导出布局：**
```css
.export-layout {
  display: grid;
  grid-template-columns: 340px 1fr;  /* 左栏固定 340px，右栏自适应 */
  gap: 20px;
  min-width: 700px;
}
```

**左栏（340px 固定）：**
- 笔记本列表 card
- 导出设置 card（从右栏移过来）

**右栏（flexible）：**
- 笔记列表 card
- 进度卡片
- 导出结果

**笔记列表：**
- `note-list` 固定高度，支持垂直滚动
- 笔记标题截断 + hover 显示完整

```css
.note-list {
  height: 350px;
  overflow-y: auto;
}

.note-list .title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
```

### 2. 左侧笔记本列表

**n/m 数字显示：**
- **始终显示**（因为笔记勾选影响导出了，部分选中的状态需要可见）

**checkbox 状态：**
- `checked`：笔记本全选中（笔记全部勾选）
- `partial`：笔记本部分选中（部分笔记勾选，只在笔记数 > 1 时显示）
- `none`：笔记本未选中

### 3. 右侧笔记区域

**顶部提示文字（currentNotebookName 旁边）：**
- 有笔记本被选中时：`"已选 N 个笔记本（可取消勾选笔记排除）"`
- 没选笔记本时：`"请勾选要导出的笔记"`

**搜索结果的全选 checkbox：**
- **移除**（搜索时的全选会造成状态混乱）

### 4. 导出按钮

**按钮文字：**
```
导出选中 (N 笔记本 + M 笔记)
```

**按钮逻辑：**
- 始终可用，只要有选中内容
- 导出的内容 = 所有选中笔记本下被选中的笔记

### 5. HTML 结构变更

**导出设置 card 移至左栏：**

```html
<!-- 左栏 -->
<div class="export-sidebar">
  <div class="card">
    <h2>选择笔记本</h2>
    <!-- 刷新按钮、全选、搜索、笔记本列表 -->
  </div>
  <div class="card">
    <h2>导出设置</h2>
    <!-- 图片格式、导出按钮 -->
  </div>
</div>

<!-- 右栏 -->
<div class="export-main">
  <div class="card">
    <h2>选择笔记 <span id="noteCount"></span></h2>
    <p id="currentNotebookName" class="notebook-name"></p>
    <!-- 搜索、笔记列表 -->
  </div>
  <div class="card" id="progressCard" style="display: none;">
    <!-- 进度显示 -->
  </div>
</div>
```

## 涉及文件

- `public/js/modules/export.module.js` - 导出逻辑修改
- `public/index.html` - HTML 结构变更（导出设置移到左栏）
- `public/css/layout.css` - 布局样式调整
- `public/css/style.css` - Container 宽度、笔记标题截断

## 实现顺序

1. 修改 HTML 结构（导出设置移到左栏）
2. 修改 CSS 布局（固定左栏宽度、右栏自适应、笔记标题截断）
3. 修改导出逻辑（handleExport 按 noteSelectionCache 精确导出）
4. 添加右侧顶部提示文字
5. 移除搜索结果的全选 checkbox
6. 测试各种场景
