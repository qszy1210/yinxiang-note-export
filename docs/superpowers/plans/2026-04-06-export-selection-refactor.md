# 导出模块选中逻辑重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构导出模块的选中逻辑，实现选中笔记本时按 noteSelectionCache 精确导出，同时优化布局和 UI 提示。

**Architecture:** 后端新增按笔记列表批量导出接口，前端修改导出逻辑按选中笔记精确导出，同时调整布局将导出设置移至左栏。

**Tech Stack:** Node.js/Express (后端), 原生 JavaScript (前端), CSS Grid/Flexbox

---

## 文件结构

```
server/
├── routes/export.js                    # 新增 /api/export/notes 路由
└── controllers/export.controller.js     # 新增 exportNotes 方法

public/
├── index.html                          # 导出设置移至左栏
├── css/
│   ├── style.css                      # Container 宽度调整
│   └── layout.css                     # 布局调整、笔记标题截断
└── js/modules/
    ├── api.module.js                   # 新增 API.export.notes()
    └── export.module.js                # 导出逻辑修改、UI 提示
```

---

## Task 1: 后端 - 新增 POST /api/export/notes 接口

**Files:**
- Modify: `server/routes/export.js`
- Modify: `server/controllers/export.controller.js`

- [ ] **Step 1: 在 export.js 添加新路由**

```javascript
// POST /api/export/notes - 按笔记列表批量导出
router.post('/notes', exportController.exportNotes.bind(exportController));
```

- [ ] **Step 2: 在 export.controller.js 添加 exportNotes 方法**

参考 `exportBatch` 方法结构，但接受 `noteGuids[]` 而不是 `notebookGuids[]`：

```javascript
/**
 * 按笔记列表批量导出
 * POST /api/export/notes
 */
async exportNotes(req, res, next) {
  try {
    const { noteGuids, imageFormat = 'obsidian' } = req.body;

    if (!Array.isArray(noteGuids) || noteGuids.length === 0) {
      return error(res, '请提供要导出的笔记 ID 列表', 400);
    }

    logger.info('Starting notes batch export', { noteCount: noteGuids.length, imageFormat });

    // 生成任务 ID
    const taskObj = exportTracker.createTask(Date.now().toString(), {
      type: 'multiple-notes',
      noteGuids,
      imageFormat
    });
    const taskId = taskObj.id;

    // 异步处理导出
    this._processNotesExport(taskId, noteGuids, req.auth, { imageFormat })
      .catch(err => {
        logger.error('Notes export failed', { taskId, error: err.message });
        exportTracker.updateTask(taskId, {
          status: 'failed',
          errors: [{ message: err.message }]
        });
      });

    return success(res, {
      taskId,
      message: '批量导出任务已创建'
    });
  } catch (err) {
    logger.error('Failed to create notes export task', { error: err.message });
    next(err);
  }
}
```

- [ ] **Step 3: 添加 _processNotesExport 内部方法**

```javascript
/**
 * 处理按笔记列表导出（内部方法）
 */
async _processNotesExport(taskId, noteGuids, auth, options) {
  logger.info('Processing notes export', { taskId, noteCount: noteGuids.length });

  exportTracker.updateTask(taskId, { status: 'processing' });

  const evernoteService = new EvernoteService(auth.token, auth.noteStoreUrl);
  const converter = new Converter({ imageFormat: options.imageFormat });
  const downloader = new Downloader(evernoteService);

  // 按笔记本分组笔记
  const notesByNotebook = new Map();

  for (const noteGuid of noteGuids) {
    try {
      const note = await evernoteService.getNoteWithResources(noteGuid);
      const notebook = await evernoteService.getNotebook(note.notebookGuid);

      if (!notesByNotebook.has(note.notebookGuid)) {
        notesByNotebook.set(note.notebookGuid, {
          notebookName: notebook.name,
          notes: []
        });
      }
      notesByNotebook.get(note.notebookGuid).notes.push({
        guid: note.guid,
        title: note.title,
        notebookName: notebook.name
      });

      // 控制请求频率
      await this.delay(config.api.requestInterval);
    } catch (err) {
      logger.error('Failed to get note', { noteGuid, error: err.message });
    }
  }

  // 更新任务总数
  const allNoteInfos = [];
  notesByNotebook.forEach(group => {
    allNoteInfos.push(...group.notes);
  });
  exportTracker.updateTask(taskId, { total: allNoteInfos.length });

  // 使用队列处理导出
  const results = [];
  const errors = [];

  for (const noteInfo of allNoteInfos) {
    try {
      await this.queue.add(async () => {
        const note = await evernoteService.getNoteWithResources(noteInfo.guid);

        const exportBasePath = path.join(EXPORTS_DIR, sanitize(noteInfo.notebookName));
        await fs.mkdir(exportBasePath, { recursive: true });

        const noteDir = sanitize(noteInfo.title);
        const exportPath = path.join(exportBasePath, noteDir);

        await fs.mkdir(exportPath, { recursive: true });
        await fs.mkdir(path.join(exportPath, 'images'), { recursive: true });
        await fs.mkdir(path.join(exportPath, 'attachments'), { recursive: true });

        const resourceMap = await downloader.downloadResources(note.resources || [], exportPath);
        const result = converter.convert(note.content, resourceMap, noteInfo.title);
        const markdown = generateMarkdown(note, result.markdown);

        await fs.writeFile(path.join(exportPath, `${sanitize(noteInfo.title)}.md`), markdown, 'utf-8');

        return { guid: note.guid, title: note.title, path: exportPath };
      });

      results.push({ guid: noteInfo.guid, status: 'success' });

      // 更新进度
      exportTracker.updateTask(taskId, {
        progress: Math.floor((results.length / allNoteInfos.length) * 100),
        success: results.length
      });

      // 控制请求频率
      await this.delay(config.api.requestInterval);

    } catch (err) {
      errors.push({ guid: noteInfo.guid, title: noteInfo.title, error: err.message });
      logger.error('Failed to export note', { noteGuid: noteInfo.guid, error: err.message });
    }
  }

  // 等待队列完成
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 更新任务状态
  exportTracker.updateTask(taskId, {
    status: 'completed',
    progress: 100,
    success: results.length,
    errors
  });

  logger.info('Notes export completed', {
    taskId,
    successCount: results.length,
    errorCount: errors.length
  });
}
```

- [ ] **Step 4: 测试接口**

启动后端后，使用 curl 测试：
```bash
curl -X POST http://localhost:3000/api/export/notes \
  -H "Content-Type: application/json" \
  -d '{"noteGuids": ["guid1", "guid2"], "imageFormat": "obsidian"}'
```

预期返回：`{"success": true, "data": {"taskId": "xxx", "message": "批量导出任务已创建"}}`

---

## Task 2: 前端 - 新增 API.export.notes() 方法

**Files:**
- Modify: `public/js/modules/api.module.js`

- [ ] **Step 1: 在 api.module.js 的 export 对象中添加 notes 方法**

在 `export: { note, notebook, batch, getProgress, download }` 中添加：

```javascript
notes: (noteGuids, imageFormat) =>
  request('/export/notes', {
    method: 'POST',
    body: JSON.stringify({ noteGuids, imageFormat })
  }),
```

找到 `batch` 方法后的位置插入。

- [ ] **Step 2: 验证文件语法**

```bash
# 检查 JS 语法
node --check public/js/modules/api.module.js
```

---

## Task 3: 前端 - HTML 结构变更（导出设置移到左栏）

**Files:**
- Modify: `public/index.html:135-161`

- [ ] **Step 1: 修改 HTML 结构**

将右侧的导出设置 card 移到左栏的笔记本列表下方：

当前右栏结构（需要修改）：
```html
<!-- 右侧：笔记列表 -->
<div class="export-main">
  <div class="card">
    <h2>选择笔记 <span id="noteCount"></span></h2>
    ...
  </div>
  <div class="card">
    <h2>导出设置</h2>           <!-- 移到左栏 -->
    ...
  </div>
  <div class="card" id="progressCard">...</div>
</div>
```

改为：
```html
<!-- 左栏 -->
<div class="export-sidebar">
  <div class="card">
    <h2>选择笔记本</h2>
    ...
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
    ...
  </div>
  <div class="card" id="progressCard">...</div>
</div>
```

注意：导出按钮（`exportSelectedBtn` 和 `exportNotebookBtn`）及其相关元素也要一起移过去。

---

## Task 4: 前端 - CSS 布局调整

**Files:**
- Modify: `public/css/style.css`
- Modify: `public/css/layout.css`

- [ ] **Step 1: 调整 Container 宽度 (style.css)**

找到 `.container` 样式，修改为：
```css
.container {
  width: 98%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}
```

- [ ] **Step 2: 调整导出布局 (layout.css)**

修改 `.export-layout`：
```css
.export-layout {
  display: grid;
  grid-template-columns: 340px 1fr;  /* 左栏固定 340px，右栏自适应 */
  gap: 20px;
  min-width: 700px;
}
```

- [ ] **Step 3: 调整导出设置卡片位置**

确保 `.export-sidebar` 包含两个 card：
```css
.export-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

- [ ] **Step 4: 笔记标题截断 (layout.css)**

在 `.note-list .title` 样式中添加：
```css
.note-list .title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
```

如果 `.note-list .title` 样式不存在，找到 `.note-list` 样式，在其后添加。

- [ ] **Step 5: 验证布局**

启动前端，刷新页面，确认左右栏布局正确。

---

## Task 5: 前端 - 导出逻辑修改（按 noteSelectionCache 精确导出）

**Files:**
- Modify: `public/js/modules/export.module.js`

- [ ] **Step 1: 修改 handleExport() 函数**

找到 `handleExport` 函数（约在 1091 行），修改导出逻辑：

当前逻辑（约 1091-1148 行）：
```javascript
async function handleExport() {
  const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
  const noteCache = getNoteSelectionCache();

  // 计算所有选中的笔记
  let selectedNoteGuids = [];
  Object.values(noteCache).forEach(set => {
    selectedNoteGuids.push(...Array.from(set));
  });
  // ... 后面的逻辑
}
```

修改为：
```javascript
async function handleExport() {
  const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
  const noteCache = getNoteSelectionCache();

  // 构建导出列表：只导出选中笔记本下的选中笔记
  const noteGuids = [];
  selectedNotebooks.forEach(nbGuid => {
    const selectedNotes = noteCache[nbGuid] || new Set();
    selectedNotes.forEach(guid => noteGuids.push(guid));
  });

  const imageFormat = document.querySelector('input[name="imageFormat"]:checked')?.value || 'obsidian';

  if (noteGuids.length === 0) {
    showStatus('请先选择要导出的笔记', 'error');
    return;
  }

  showProgressCard(true);
  updateProgress(0, '准备导出...');
  UIModule?.log('INFO', `开始导出: ${noteGuids.length} 篇笔记`);

  try {
    // 使用新的按笔记列表批量导出接口
    UIModule?.log('INFO', `调用批量导出 API...`);
    const result = await API.export.notes(noteGuids, imageFormat);

    if (result.data?.taskId) {
      UIModule?.log('INFO', `任务已创建, TaskID: ${result.data.taskId}, 开始轮询进度`);
      // 轮询进度
      await pollExportProgress(result.data.taskId);
    } else {
      UIModule?.log('ERROR', `API 返回异常: ${JSON.stringify(result)}`);
    }
  } catch (err) {
    showStatus('导出失败: ' + err.message, 'error');
    showProgressCard(false);
  }
}
```

- [ ] **Step 2: 更新 updateUI() 中的按钮文字逻辑**

约在 1056 行的 `updateUI()` 函数中，找到导出按钮文字更新逻辑，修改为只显示笔记数（因为现在总是按笔记导出）：

```javascript
// 更新导出按钮
if (elements.exportBtn) {
  elements.exportBtn.disabled = noteGuids.length === 0;

  // 更新按钮文本
  if (noteGuids.length > 0) {
    elements.exportBtn.textContent = `导出选中 (${noteGuids.length} 笔记)`;
  } else {
    elements.exportBtn.textContent = '导出选中';
  }
}
```

其中 `noteGuids` 可以通过 `selectedNotebooks` 和 `noteCache` 计算得出。

---

## Task 6: 前端 - 添加右侧顶部模式提示文字

**Files:**
- Modify: `public/js/modules/export.module.js`
- Modify: `public/index.html` (如果需要新增元素)

- [ ] **Step 1: 在 index.html 中右侧笔记卡片添加提示元素**

在 `#currentNotebookName` 后面添加一个新元素：
```html
<p id="currentNotebookName" class="notebook-name"></p>
<span id="exportModeHint" class="export-mode-hint"></span>
```

- [ ] **Step 2: 添加样式 (layout.css)**

```css
.export-mode-hint {
  display: block;
  margin-bottom: 10px;
  font-size: 0.85rem;
  color: #666;
}
```

- [ ] **Step 3: 在 export.module.js 中添加 updateExportModeHint() 函数**

在 `updateUI()` 函数附近添加：

```javascript
/**
 * 更新导出模式提示文字
 */
function updateExportModeHint() {
  const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
  const hintEl = document.getElementById('exportModeHint');

  if (!hintEl) return;

  if (selectedNotebooks.length > 0) {
    hintEl.textContent = `已选 ${selectedNotebooks.length} 个笔记本（可取消勾选笔记排除）`;
    hintEl.style.color = '#666';
  } else {
    hintEl.textContent = '请勾选要导出的笔记';
    hintEl.style.color = '#999';
  }
}
```

- [ ] **Step 4: 在适当的地方调用 updateExportModeHint()**

在以下函数中调用：
- `toggleNotebookSelection()` 末尾
- `handleSelectAllNotebooks()` 末尾
- `loadNotesForNotebook()` 末尾
- `loadNotesForNotebookWithSelection()` 末尾

---

## Task 7: 前端 - 移除搜索结果的全选 checkbox

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/modules/export.module.js`

- [ ] **Step 1: 从 index.html 移除 selectAllHeader 元素**

找到并删除：
```html
<div class="list-header" id="selectAllHeader" style="display: none;">
  <label>
    <input type="checkbox" id="selectAllNotes"> 全选
  </label>
</div>
```

- [ ] **Step 2: 从 export.module.js 移除相关逻辑**

删除或注释掉：
- `bindEvents()` 中对 `elements.selectAllNotes` 的事件绑定
- `handleSelectAllNotes()` 函数
- `updateSelectAllState()` 函数
- `elements.selectAllNotes` 的缓存

---

## Task 8: 前端 - 笔记本 n/m 显示 (-/-) 未加载状态

**Files:**
- Modify: `public/js/modules/export.module.js`

- [ ] **Step 1: 修改 createNotebookItem() 中的 countHtml 生成逻辑**

约在 331-335 行：

```javascript
// 已选中数量显示 (n/m 格式，只要有总数就显示)
let countHtml = '';
if (totalCount > 0) {
  countHtml = ` <span class="note-count">(${selectedCount}/${totalCount})</span>`;
} else if (selectedCount > 0 || selected.includes(notebook.guid)) {
  // 笔记本被选中但笔记未加载
  countHtml = ` <span class="note-count">(-/-)</span>`;
}
```

---

## Task 9: 集成测试

- [ ] **Step 1: 启动后端服务**

```bash
npm start
```

- [ ] **Step 2: 启动前端服务**（如果需要）

- [ ] **Step 3: 测试场景**

1. **基本流程测试**：
   - 加载笔记本
   - 点击一个笔记本，右侧加载笔记
   - 勾选该笔记本（应该全选右侧笔记）
   - 取消勾选部分笔记
   - 点击导出，确认只导出被勾选的笔记

2. **多笔记本测试**：
   - 勾选笔记本 A（部分笔记）
   - 勾选笔记本 B（全选）
   - 确认左侧显示正确的 partial/checked 状态
   - 导出，确认 A 的部分笔记 + B 的全部笔记

3. **布局测试**：
   - 确认左栏固定 340px
   - 确认笔记标题过长时截断
   - 确认导出设置在左栏下方

4. **提示文字测试**：
   - 有选中的笔记本时显示"已选 N 个笔记本（可取消勾选笔记排除）"
   - 无选中时显示"请勾选要导出的笔记"

---

## 自检清单

完成实现后，检查：

- [ ] 后端接口 `/api/export/notes` 可以接受 `noteGuids[]` 并返回 taskId
- [ ] 前端 `API.export.notes()` 方法正确调用后端
- [ ] 导出设置 card 在左栏（笔记本列表下方）
- [ ] 布局左栏 340px 固定，右栏自适应
- [ ] 笔记标题过长时截断（显示...）
- [ ] 导出逻辑按 noteSelectionCache 精确导出
- [ ] 右侧顶部有模式提示文字
- [ ] 搜索结果的全选 checkbox 已移除
- [ ] 笔记本未加载笔记时显示 (-/-)
