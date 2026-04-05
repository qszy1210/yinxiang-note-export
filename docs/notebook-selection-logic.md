# 笔记本/笔记选择逻辑梳理

## 数据结构

| State Key | 说明 |
|-----------|------|
| `export.notebooks` | 笔记本列表 |
| `export.selectedNotebooks` | 左侧被勾选的笔记本（圆形checkbox，用于批量导出） |
| `export.currentNotebook` | 当前在右侧显示的笔记本 |
| `export.notes` | 当前右侧显示的笔记列表 |
| `export.noteSelectionCache` | 每个笔记本独立的笔记勾选状态 `{[nbGuid]: Set([noteGuid...])}` |

---

## 交互逻辑（已修复）

### 1. 初始状态
- 左侧：未选中任何笔记本
- 右侧：空，显示"请先选择笔记本"
- 全选checkbox：隐藏

### 2. 点击左侧笔记本名字
```
→ loadNotesForNotebook(guid)
  → 右侧显示"加载中..."
  → 设置 currentNotebook = guid
  → 加载该笔记本笔记到 export.notes
  → renderNotes()
  → updateCurrentNotebookDisplay()
  → updateNotebookCheckboxState(guid)
  → renderNotebooks()
```

### 3. 点击左侧笔记本圆形checkbox（勾选）
```
→ toggleNotebookSelection(guid, checked)
  → 更新 selectedNotebooks
  → 如果 checked=true:
    → loadNotesForNotebook(guid)  ← 自动加载笔记到右侧
  → updateUI()
```

### 4. 点击左侧减号➖（部分选中状态）
```
→ handlePartialClick(guid)
  → 如果笔记已加载:
    → 切换：全选 ↔ 取消全选
    → 更新缓存
    → 更新左侧显示
    → 如果当前笔记本是它，更新右侧
  → 如果笔记未加载:
    → 先 loadNotesForNotebook(guid)
    → 加载完成后执行切换操作
```

### 5. 点击右侧笔记方形checkbox
```
→ toggleNoteSelection(guid, checked)
  → 更新 noteSelectionCache[currentNotebook]
  → 更新全选框
  → 更新左侧笔记本勾选状态
  → 更新顶部显示
  → 更新导出按钮
```

### 6. 点击右侧全选checkbox
```
→ handleSelectAllNotes()
  → 全选/取消全选当前笔记本的所有笔记
  → 更新缓存
  → renderNotes()
  → 更新左侧
  → 更新顶部
  → 更新导出按钮
```
**注意**：全选checkbox只在有搜索过滤时显示

### 7. 搜索笔记
```
→ handleNoteSearch(e)
  → 搜索时显示全选checkbox
  → renderNotes()  ← 过滤后重新渲染
```

---

## 状态对应关系

| 左侧状态 | 圆形checkbox | 减号 | 含义 |
|----------|--------------|------|------|
| 未选中 | ☐ | 无 | 未勾选该笔记本 |
| 已全选 | ☑ | 无 | 整个笔记本被勾选用于导出 |
| 部分选中 | ☑ | ➖ | 该笔记本下有部分笔记被勾选 |
| 当前查看 | 背景色 | 无 | 当前在右侧显示的笔记本 |

---

## 导出逻辑

当点击"导出选中"按钮时：
- 如果有 `selectedNotebooks`：导出这些笔记本的全部笔记
- 如果有 `noteSelectionCache` 里的笔记：导出这些特定笔记
- 两者可以同时存在

---

## 待优化

1. **左侧显示笔记总数**：显示 (3/10) 而不是 (3)，需要API支持
2. **减号点击的交互反馈**：可以考虑加个 tooltip 说明
