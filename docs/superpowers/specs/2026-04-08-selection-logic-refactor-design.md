# 印象笔记导出工具 - 选中逻辑重构设计

## 1. 问题背景

当前选中逻辑存在多个状态互相影响的问题：
- `selectedNotebooks` 作为独立状态与笔记勾选状态分离
- `allNotebooksSelected` 全选标记与缓存状态不一致
- 笔记本 checkbox 状态与笔记勾选状态计算逻辑混乱
- 导出时依赖 `selectedNotebooks` 而非实际笔记勾选

**核心问题**：笔记本和笔记的状态是双向关联的，但代码把它们当作独立状态处理，导致复杂交互后状态不一致。

---

## 2. 设计目标

**核心原则**：单向数据流

```
笔记勾选状态 → 决定笔记本状态 → 决定全选按钮状态
```

- 笔记本 checkbox 是笔记勾选的**聚合显示**，不是独立状态
- 全选按钮是所有笔记本状态的**聚合显示**，不是独立状态
- `selectAllIntent` 仅用于标记**未加载笔记本**的全选意图

---

## 3. 状态结构设计

### 3.1 新状态结构

```javascript
// StateManager.export 状态
{
  notebooks: [
    { guid: 'abc', name: '笔记本A', stack: '工作' },
    ...
  ],

  // 核心状态：按笔记本存储笔记和勾选
  notesByNotebook: {
    'abc': {
      loaded: false,           // 是否已加载笔记列表
      loading: false,          // 是否正在加载中（防止重复加载）
      notes: [],               // 笔记列表 [{ guid, title, updated }]
      selectedGuids: Set(),    // 勾选的笔记 guid（Set 类型）
      selectAllIntent: false   // 该笔记本的全选意图（仅未加载时有效）
    },
    'def': {
      loaded: true,
      loading: false,
      notes: [{ guid: 'n1', title: '笔记1', ... }],
      selectedGuids: Set(['n1', 'n2']),
      selectAllIntent: false   // 已加载时此字段无意义
    },
    ...
  },

  currentNotebook: 'abc'       // 当前右侧显示的笔记本 guid
}
```

### 3.2 删除的状态

| 原状态 | 原用途 | 删除原因 |
|--------|--------|---------|
| `selectedNotebooks` | 标记哪些笔记本被选中 | 笔记本状态由笔记勾选派生，不需要独立存储 |
| `allNotebooksSelected` | 全局全选标记 | 合并为笔记本级别的 `selectAllIntent` |
| `noteSelectionCache` | 笔记勾选缓存 | 合并到 `notesByNotebook[].selectedGuids` |
| `noteTotalCache` | 笔记总数缓存 | 合并到 `notesByNotebook[].notes.length` |
| `notes` | 当前笔记列表 | 合并到 `notesByNotebook[currentNotebook].notes` |

### 3.3 关键规则

1. **selectAllIntent 的定位**：仅用于标记未加载笔记本的全选意图，不与已加载笔记本状态同步
2. **已加载笔记本**：状态完全由 `selectedGuids` 决定，`selectAllIntent` 无意义
3. **未加载笔记本**：`selectAllIntent` 决定显示状态和导出行为
4. **意图兑现时机**：点击笔记本名称加载笔记时，如果 `selectAllIntent=true`，加载后自动将所有笔记加入 `selectedGuids`，意图兑现后清除标记
5. **意图失效时机**：用户取消所有笔记勾选时（`selectedGuids.size === 0`），自动清除 `selectAllIntent`

---

## 4. 笔记本状态派生逻辑

### 4.1 派生函数

```javascript
function getNotebookDisplay(notebookGuid) {
  const data = notesByNotebook[notebookGuid];

  // === 未加载的笔记本 ===
  if (!data || !data.loaded) {
    const intent = data?.selectAllIntent || false;
    if (intent) {
      // 有全选意图，但笔记未加载
      return { checkbox: 'checked', displayCount: '-/-' };
    }
    return { checkbox: 'unchecked', displayCount: '' };
  }

  // === 已加载的笔记本 ===
  // 状态完全由 selectedGuids 决定，忽略 selectAllIntent
  const total = data.notes.length;
  const selected = data.selectedGuids.size;

  if (selected === 0) {
    return { checkbox: 'unchecked', displayCount: `0/${total}`, selected: 0, total };
  }
  if (selected === total) {
    return { checkbox: 'checked', displayCount: `${total}/${total}`, selected: total, total };
  }
  return { checkbox: 'partial', displayCount: `${selected}/${total}`, selected, total };
}
```

### 4.2 显示状态表

| 状态 | checkbox | 数字显示 | 说明 |
|------|----------|---------|------|
| 未加载 + 无意图 | unchecked | 无 | 默认状态，未加载 |
| 未加载 + 有意图 | checked | -/- | 用户勾选但未加载，`-/-` 表示"总数未知/总数未知" |
| 已加载 + 选中 0 | unchecked | 0/5 | 已加载，无笔记选中 |
| 已加载 + 选中部分 | partial（➖） | 3/5 | 部分笔记选中 |
| 已加载 + 选中全部 | checked | 5/5 | 全部笔记选中 |

**数字显示说明**：
- 无数字 = 未加载，总数未知
- -/- = 未加载但有全选意图
- 0/m = 已加载但未选中（区别于未加载）
- n/m = 已加载且部分或全部选中

**限制**：由于 Evernote API 没有获取笔记本笔记总数的接口，`-/-` 无法显示具体数量。用户需要点击笔记本名称加载后才能看到实际数字。

---

## 5. 全选按钮状态派生

### 5.1 派生函数

```javascript
function getSelectAllButtonState() {
  const notebooks = StateManager.getState('export.notebooks');

  // 边界情况：笔记本列表为空，显示"全选"
  if (notebooks.length === 0) {
    return 'select';
  }

  const allChecked = notebooks.every(nb => {
    const data = notesByNotebook[nb.guid];

    if (!data || !data.loaded) {
      return data?.selectAllIntent || false;
    }

    return data.selectedGuids.size === data.notes.length;
  });

  return allChecked ? 'cancel' : 'select';
}
```

### 5.2 按钮显示

| 所有笔记本状态 | 按钮文本 | 按钮样式 |
|---------------|---------|---------|
| 全部 checked | 取消全选 | 危险色（红色） |
| 部分或全部 unchecked | 全选 | 默认色 |

---

## 6. 交互流程设计

### 6.1 左侧笔记本交互

| 操作 | 行为 |
|------|------|
| 点击笔记本 checkbox（未加载） | 设置 `selectAllIntent = checked`，不加载笔记，显示 checked/-/- 或 unchecked |
| 点击笔记本 checkbox（已加载） | `checked=true` → 全选所有笔记到 selectedGuids<br>`checked=false` → 清空 selectedGuids |
| 点击笔记本名称 | 切换 `currentNotebook`，加载笔记（如未加载），右侧显示该笔记本笔记。**加载后行为**：如果笔记本有 `selectAllIntent=true`，自动将所有笔记加入 `selectedGuids` 并清除意图标记；否则保持 `selectedGuids` 为空 |
| 点击笔记本减号➖（partial） | 切换状态：全选所有笔记 或 清空选中 |

### 6.2 右侧笔记交互

| 操作 | 行为 |
|------|------|
| 勾选笔记 | 添加到 `selectedGuids` |
| 取消勾选笔记 | 从 `selectedGuids` 移除，如果取消后 `selectedGuids.size === 0`，自动清除该笔记本的 `selectAllIntent` |

### 6.4 点击笔记本名称加载笔记的详细逻辑

```javascript
async function clickNotebookName(notebookGuid) {
  currentNotebook = notebookGuid;
  const data = notesByNotebook[notebookGuid];

  if (!data || !data.loaded) {
    // 防止重复加载
    if (data?.loading) {
      return;  // 正在加载中，忽略重复点击
    }

    // 标记加载中
    if (!notesByNotebook[notebookGuid]) {
      notesByNotebook[notebookGuid] = { loaded: false, loading: false, notes: [], selectedGuids: new Set(), selectAllIntent: false };
    }
    notesByNotebook[notebookGuid].loading = true;

    try {
      // 加载笔记
      const notes = await API.getNotes(notebookGuid);
      const shouldSelectAll = data?.selectAllIntent || false;

      notesByNotebook[notebookGuid] = {
        loaded: true,
        loading: false,
        notes: notes,
        selectedGuids: shouldSelectAll ? new Set(notes.map(n => n.guid)) : new Set(),
        selectAllIntent: false  // 意图已兑现，清除标记
      };

      renderNotes();
      renderNotebooks();
    } catch (err) {
      // 加载失败，清除 loading 状态
      notesByNotebook[notebookGuid].loading = false;
      console.error('加载笔记失败:', err);
    }
  }
}
```

**关键行为**：
- 如果笔记本有 `selectAllIntent=true`（用户之前勾选过 checkbox），加载后自动全选所有笔记
- 意图兑现后立即清除标记，防止后续操作混淆
- **防重复加载**：通过 `loading` 状态防止快速重复点击触发多次 API 调用

### 6.5 全选按钮交互

| 操作 | 行为 |
|------|------|
| 点击"全选" | 所有笔记本：未加载的设置 `selectAllIntent=true`，已加载的全选笔记到 selectedGuids |
| 点击"取消全选" | 所有笔记本：清除 `selectAllIntent`，清空 `selectedGuids` |

---

## 7. 导出逻辑设计

### 7.1 导出按钮

- **导出**：导出选中笔记（N=0 时禁用）
- **导出全部笔记本**：无视选择，导出所有笔记本下的所有笔记

### 7.2 导出选中笔记流程

**分类逻辑**：

| 笔记本状态 | 导出方式 | 使用接口 |
|-----------|---------|---------|
| 未加载 + selectAllIntent=true | 按笔记本导出 | `/api/export/batch` |
| 已加载 + selectedGuids.size === total | 按笔记本导出 | `/api/export/batch` |
| 已加载 + 0 < selectedGuids.size < total | 按笔记导出 | `/api/export/notes` |
| 未加载 + 无意图 | 不参与导出 | - |
| 已加载 + selectedGuids.size === 0 | 不参与导出 | - |

**串行导出流程**：

```javascript
async function handleExportSelected() {
  // 分类
  const fullNotebooks = [];    // 全选的笔记本 guid 数组 ['abc', 'def']
  const partialNoteGuids = []; // 部分选中的笔记 guid 数组 ['n1', 'n2']

  const notebooks = StateManager.getState('export.notebooks');

  notebooks.forEach(nb => {
    const data = notesByNotebook[nb.guid];

    if (!data) {
      // 未初始化且无意图 → 不参与导出
      return;
    }

    if (!data.loaded) {
      // 未加载：检查意图
      if (data.selectAllIntent) {
        fullNotebooks.push(nb.guid);
      }
      // 无意图 → 不参与导出
    } else {
      // 已加载：检查选中数量
      const total = data.notes.length;
      const selected = data.selectedGuids.size;

      if (selected === total) {
        // 全选
        fullNotebooks.push(nb.guid);
      } else if (selected > 0) {
        // 部分选中
        partialNoteGuids.push(...Array.from(data.selectedGuids));
      }
      // selected === 0 → 不参与导出
    }
  });

  // 导出逻辑...
  const hasFull = fullNotebooks.length > 0;
  const hasPartial = partialNoteGuids.length > 0;

  if (hasFull && hasPartial) {
    // 两个阶段都有：0-50%, 50-100%
    const taskId1 = await API.export.batch(fullNotebooks, imageFormat);
    await pollProgress(taskId1, progress => updateProgress(progress / 2, `笔记本: ${progress}%`));

    const taskId2 = await API.export.notes(partialNoteGuids, imageFormat);
    await pollProgress(taskId2, progress => updateProgress(50 + progress / 2, `笔记: ${progress}%`));
  } else if (hasFull) {
    // 只有全选笔记本：0-100%
    const taskId = await API.export.batch(fullNotebooks, imageFormat);
    await pollProgress(taskId, progress => updateProgress(progress, `笔记本: ${progress}%`));
  } else if (hasPartial) {
    // 只有部分笔记：0-100%
    const taskId = await API.export.notes(partialNoteGuids, imageFormat);
    await pollProgress(taskId, progress => updateProgress(progress, `笔记: ${progress}%`));
  }

  updateProgress(100, '导出完成');
  showDownloadButton();
}
```

**数据结构说明**：
- `fullNotebooks`：笔记本 guid 数组，传给 `/api/export/batch`
- `partialNoteGuids`：笔记 guid 数组，传给 `/api/export/notes`

### 7.3 导出全部笔记本流程

使用现有接口 `POST /api/export/batch`，传入所有笔记本 guid。

---

## 8. UI 显示设计

### 8.1 左侧笔记本显示

见 [4.2 显示状态表](#42-显示状态表)

### 8.2 右侧笔记显示

| 状态 | checkbox | 说明 |
|------|----------|------|
| 笔记在 selectedGuids 中 | checked | 已选中 |
| 笔记不在 selectedGuids 中 | unchecked | 未选中 |

### 8.3 导出按钮显示

| 场景 | 按钮文本 | 按钮状态 |
|------|---------|---------|
| 无任何选中 | 导出 | 禁用 |
| 有选中 | 导出 (N 笔记) | 可用 |
| 笔记本列表不为空 | 导出全部笔记本 | 可用 |

---

## 9. 后端接口使用

| 接口 | 用途 |
|------|------|
| `POST /api/export/batch` | 导出全选笔记本 + 导出全部笔记本按钮 |
| `POST /api/export/notes` | 导出部分选中笔记 |
| `GET /api/export/progress/:taskId` | 获取进度（已有轮询逻辑） |

**无需新增后端接口**。

---

## 10. 涉及文件

| 文件 | 改动类型 |
|------|---------|
| `public/js/modules/export.module.js` | 重构（主要改动） |
| `public/index.html` | 按钮调整（合并导出按钮） |
| `public/css/style.css` | 可能需要调整样式（partial 状态等） |

---

## 11. 实现优先级

1. 重构状态结构和派生逻辑
2. 重构交互流程（笔记本 checkbox、笔记勾选、全选按钮）
3. 重构导出逻辑（串行调用两个接口）
4. UI 按钮调整（合并导出按钮）