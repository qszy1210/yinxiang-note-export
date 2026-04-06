/**
 * 导出模块
 * 处理笔记本和笔记的选择与导出
 */

const ExportModule = (function() {
  const elements = {};
  let searchQuery = { notebooks: '', notes: '' };
  let exportPollInterval = null;

  /**
   * 初始化
   */
  function init() {
    cacheElements();
    bindEvents();
  }

  /**
   * 缓存 DOM 元素
   */
  function cacheElements() {
    elements.notebookSearch = document.getElementById('notebookSearch');
    elements.clearNotebookSearch = document.getElementById('clearNotebookSearch');
    elements.notebookList = document.getElementById('notebookList');
    elements.notebookSelectAllHeader = document.getElementById('notebookSelectAllHeader');
    elements.noteSearch = document.getElementById('noteSearch');
    elements.clearNoteSearch = document.getElementById('clearNoteSearch');
    elements.noteList = document.getElementById('noteList');
    elements.noteCount = document.getElementById('noteCount');
    elements.currentNotebookName = document.getElementById('currentNotebookName');
    elements.selectNotebooks = document.getElementById('selectNotebooks');
    elements.exportBtn = document.getElementById('exportSelectedBtn');
    elements.exportNotebookBtn = document.getElementById('exportNotebookBtn');
    elements.progressCard = document.getElementById('progressCard');
    elements.progressFill = document.getElementById('progressFill');
    elements.progressText = document.getElementById('progressText');
    elements.exportResult = document.getElementById('exportResult');
    elements.resultMessage = document.getElementById('resultMessage');
    elements.downloadBtn = document.getElementById('downloadBtn');
    elements.loadNotebooksBtn = document.getElementById('loadNotebooksBtn');
    elements.notebooksErrorMsg = document.getElementById('notebooksErrorMsg');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    if (elements.notebookSearch) {
      elements.notebookSearch.addEventListener('input', handleNotebookSearch);
    }

    if (elements.clearNotebookSearch) {
      elements.clearNotebookSearch.addEventListener('click', clearNotebookSearch);
    }

    if (elements.noteSearch) {
      elements.noteSearch.addEventListener('input', handleNoteSearch);
    }

    if (elements.clearNoteSearch) {
      elements.clearNoteSearch.addEventListener('click', clearNoteSearch);
    }

    if (elements.selectNotebooks) {
      elements.selectNotebooks.addEventListener('click', handleSelectAllNotebooks);
    }

    if (elements.exportBtn) {
      elements.exportBtn.addEventListener('click', handleExport);
    }

    if (elements.exportNotebookBtn) {
      elements.exportNotebookBtn.addEventListener('click', () => handleExportNotebook());
    }

    if (elements.downloadBtn) {
      elements.downloadBtn.addEventListener('click', handleDownload);
    }

    if (elements.loadNotebooksBtn) {
      elements.loadNotebooksBtn.addEventListener('click', loadNotebooks);
    }

    // 移除认证成功事件监听，改为用户手动触发
    // document.addEventListener('auth:success', () => {
    //   loadNotebooks();
    // });
  }

  /**
   * 加载笔记本列表
   */
  async function loadNotebooks() {
    if (!elements.notebookList) return;

    // 禁用按钮，防止重复点击
    if (elements.loadNotebooksBtn) {
      elements.loadNotebooksBtn.disabled = true;
      elements.loadNotebooksBtn.textContent = '加载中...';
    }

    elements.notebookList.innerHTML = '<p class="placeholder">加载中...</p>';

    try {
      const data = await API.notebooks.list();

      if (data.success) {
        if (StateManager) {
          StateManager.setState('export.notebooks', data.data.notebooks);
        }
        renderNotebooks();

        // 显示全选 checkbox
        if (elements.notebookSelectAllHeader) {
          elements.notebookSelectAllHeader.style.display = 'block';
        }

        // 更新按钮文本为刷新
        if (elements.loadNotebooksBtn) {
          elements.loadNotebooksBtn.disabled = false;
          elements.loadNotebooksBtn.textContent = '刷新笔记本';
        }
      }
    } catch (err) {
      console.error('加载笔记本失败:', err);
      elements.notebookList.innerHTML = '<p class="placeholder">加载失败</p>';

      // 友好的错误提示
      let errorMsg = '加载失败: ' + err.message;
      let isRateLimit = false;
      if (err.message.includes('RATE_LIMIT_REACHED') || err.message.includes('限流')) {
        errorMsg = '请求过于频繁，请稍后再试（印象笔记 API 限制）';
        isRateLimit = true;
      }
      UIModule?.log('ERROR', `加载笔记本失败${isRateLimit ? '（限流）' : ''}: ${err.message}`);
      showStatus(errorMsg, 'error');

      // 恢复按钮
      if (elements.loadNotebooksBtn) {
        elements.loadNotebooksBtn.disabled = false;
        elements.loadNotebooksBtn.textContent = '刷新笔记本';
      }
    }
  }

  /**
   * 获取笔记选择缓存（每个笔记本独立的勾选状态）
   */
  function getNoteSelectionCache() {
    const cache = StateManager?.getState?.('export.noteSelectionCache') || {};
    // 确保每个条目都是 Set
    const result = {};
    Object.keys(cache).forEach(nbGuid => {
      result[nbGuid] = new Set(cache[nbGuid] || []);
    });
    return result;
  }

  /**
   * 保存笔记选择缓存
   */
  function saveNoteSelectionCache(cache) {
    // 将 Map/Object 转换为可序列化格式
    const serializable = {};
    Object.keys(cache).forEach(nbGuid => {
      serializable[nbGuid] = Array.from(cache[nbGuid] || []);
    });
    if (StateManager) {
      StateManager.setState('export.noteSelectionCache', serializable);
    }
  }

  /**
   * 获取笔记总数缓存
   */
  function getNoteTotalCache() {
    return StateManager?.getState?.('export.noteTotalCache') || {};
  }

  /**
   * 保存笔记总数缓存
   */
  function saveNoteTotalCache(cache) {
    if (StateManager) {
      StateManager.setState('export.noteTotalCache', cache);
    }
  }

  /**
   * 渲染笔记本列表
   */
  function renderNotebooks() {
    const notebooks = StateManager?.getState?.('export.notebooks') || [];
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
    const currentNotebook = StateManager?.getState?.('export.currentNotebook');
    const currentNotes = StateManager?.getState?.('export.notes') || [];
    const noteCache = getNoteSelectionCache();
    const noteTotalCache = getNoteTotalCache();
    const query = searchQuery.notebooks.toLowerCase();

    // 过滤笔记本
    const filtered = notebooks.filter(nb =>
      nb.name.toLowerCase().includes(query) ||
      (nb.stack && nb.stack.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
      elements.notebookList.innerHTML = query
        ? `<p class="no-results">没有匹配 "${escapeHtml(query)}" 的笔记本</p>`
        : '<p class="placeholder">没有找到笔记本</p>';
      return;
    }

    // 按 stack 分组
    const stacks = new Map();
    const noStack = [];

    filtered.forEach(nb => {
      if (nb.stack) {
        if (!stacks.has(nb.stack)) stacks.set(nb.stack, []);
        stacks.get(nb.stack).push(nb);
      } else {
        noStack.push(nb);
      }
    });

    // 计算每个笔记本的勾选状态
    // notebookSelectionStatus: { [guid]: 'checked' | 'partial' | 'none' }
    // 判断依据：缓存中的选中数 vs 笔记总数
    const allNotebooksSelected = StateManager?.getState?.('export.allNotebooksSelected') || false;
    const notebookStatus = {};
    filtered.forEach(nb => {
      // 如果点击了"全选笔记本"，所有笔记本都显示为勾选状态
      if (allNotebooksSelected) {
        notebookStatus[nb.guid] = 'checked';
        return;
      }

      const cached = noteCache[nb.guid] || new Set();
      const totalCount = noteTotalCache[nb.guid] || 0;

      // 优先根据缓存和总数判断（不管是否是当前笔记本）
      if (totalCount > 0 && cached.size > 0) {
        if (cached.size === totalCount) {
          // 全选
          notebookStatus[nb.guid] = 'checked';
        } else if (cached.size < totalCount) {
          // 部分选中：只有当笔记数 > 1 时才显示 partial
          notebookStatus[nb.guid] = totalCount > 1 ? 'partial' : 'checked';
        }
      } else if (totalCount > 0 && cached.size === 0) {
        // 有笔记但未选中
        notebookStatus[nb.guid] = 'none';
      } else {
        // 没有加载过笔记或总数未知
        notebookStatus[nb.guid] = 'none';
      }
    });

    let html = '';

    // 无 stack 的笔记本
    noStack.forEach(nb => {
      const status = notebookStatus[nb.guid] || 'none';
      const isCurrent = nb.guid === currentNotebook;
      let selectedCount = noteCache[nb.guid]?.size || 0;
      const totalCount = noteTotalCache[nb.guid] || 0;
      // 如果全选了，selectedCount 应该等于 totalCount（显示为全部选中）
      if (allNotebooksSelected && selectedNotebooks.includes(nb.guid)) {
        selectedCount = totalCount;
      }
      html += createNotebookItem(nb, selectedNotebooks, false, isCurrent, status, selectedCount, totalCount);
    });

    // 有 stack 的笔记本
    stacks.forEach((stackNotebooks, stackName) => {
      html += `<div class="list-item stack-header">${escapeHtml(stackName)}</div>`;
      stackNotebooks.forEach(nb => {
        const status = notebookStatus[nb.guid] || 'none';
        const isCurrent = nb.guid === currentNotebook;
        let selectedCount = noteCache[nb.guid]?.size || 0;
        const totalCount = noteTotalCache[nb.guid] || 0;
        // 如果全选了，selectedCount 应该等于 totalCount（显示为全部选中）
        if (allNotebooksSelected && selectedNotebooks.includes(nb.guid)) {
          selectedCount = totalCount;
        }
        html += createNotebookItem(nb, selectedNotebooks, true, isCurrent, status, selectedCount, totalCount);
      });
    });

    elements.notebookList.innerHTML = html;

    // 同步全选 checkbox 状态
    if (elements.selectNotebooks) {
      const allSelected = selectedNotebooks.length === notebooks.length && notebooks.length > 0;
      elements.selectNotebooks.checked = allSelected;
    }

    // 绑定事件
    elements.notebookList.querySelectorAll('.notebook-item[data-guid]').forEach(item => {
      item.addEventListener('click', (e) => {
        const guid = item.dataset.guid;

        // 点击部分选中的减号图标，切换到完全选中或取消全选
        if (e.target.classList.contains('checkbox-partial')) {
          e.stopPropagation();
          handlePartialClick(guid);
          return;
        }

        // 点击 checkbox
        if (e.target.tagName === 'INPUT') {
          e.stopPropagation();
          toggleNotebookSelection(guid, e.target.checked);
          return;
        }

        // 点击笔记本项（不是 checkbox）只显示笔记
        if (StateManager) {
          StateManager.setState('export.currentNotebook', guid);
        }

        // 如果笔记本已被选中或全选状态，加载笔记并全选
        const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
        const allNotebooksSelected = StateManager?.getState?.('export.allNotebooksSelected') || false;
        if (selectedNotebooks.includes(guid) || allNotebooksSelected) {
          loadNotesForNotebookWithSelection(guid, true);
        } else {
          loadNotesForNotebook(guid);
        }
      });
    });
  }

  /**
   * 创建笔记本项 HTML
   */
  function createNotebookItem(notebook, selected, indent = false, isCurrent = false, selectionStatus = 'none', selectedCount = 0, totalCount = 0) {
    // checkbox 勾选状态：要么是 selectedNotebooks 中的，要么是笔记全选
    const isCheckedInSelected = selected.includes(notebook.guid);
    const isAllNotesSelected = totalCount > 0 && selectedCount === totalCount;
    const checked = isCheckedInSelected || isAllNotesSelected ? 'checked' : '';
    const style = indent ? 'padding-left: 28px;' : '';
    // 完全选中时的样式（左侧勾选框勾中）
    const selectedClass = checked ? 'selected' : '';
    // 当前查看的笔记本（有背景色但没完全选中）
    const currentClass = isCurrent && !checked ? 'current' : '';
    // 笔记勾选状态
    const partialClass = selectionStatus === 'partial' ? 'partial' : '';

    let checkboxHtml;
    if (selectionStatus === 'partial') {
      // 部分选中状态 - 显示减号
      checkboxHtml = '<span class="checkbox-partial">&#8212;</span>';
    } else {
      checkboxHtml = `<input type="checkbox" ${checked}>`;
    }

    // 已选中数量显示 (n/m 格式，只要有总数就显示)
    let countHtml = '';
    if (totalCount > 0) {
      countHtml = ` <span class="note-count">(${selectedCount}/${totalCount})</span>`;
    } else if (selectedCount > 0 || selected.includes(notebook.guid)) {
      // 笔记本被选中但笔记未加载
      countHtml = ` <span class="note-count">(-/-)</span>`;
    }

    return `
      <div class="notebook-item ${selectedClass} ${currentClass} ${partialClass}" data-guid="${notebook.guid}" style="${style}">
        ${checkboxHtml}
        <span>${escapeHtml(notebook.name)}${countHtml}</span>
      </div>
    `;
  }

  /**
   * 切换笔记本选择
   */
  function toggleNotebookSelection(guid, checked) {
    let selected = StateManager?.getState?.('export.selectedNotebooks') || [];

    if (checked) {
      if (!selected.includes(guid)) {
        selected.push(guid);
      }
    } else {
      selected = selected.filter(g => g !== guid);
    }

    if (StateManager) {
      StateManager.setState('export.selectedNotebooks', selected);
      // 清除"全选"标记，因为用户正在单独操作某个笔记本
      StateManager.setState('export.allNotebooksSelected', false);
    }

    // 更新 UI
    const item = elements.notebookList.querySelector(`[data-guid="${guid}"]`);
    if (item) {
      item.classList.toggle('selected', checked);
    }

    const currentNotebook = StateManager?.getState?.('export.currentNotebook');

    // 勾选/取消勾选左侧笔记本时
    if (checked) {
      // 如果是当前笔记本，且笔记已加载，只更新勾选状态
      if (currentNotebook === guid) {
        const allNotes = StateManager?.getState?.('export.notes') || [];
        const notebookNotes = allNotes.filter(n => n.notebookGuid === guid);
        if (notebookNotes.length > 0) {
          // 笔记已加载，直接全选
          const noteCache = getNoteSelectionCache();
          noteCache[guid] = new Set(notebookNotes.map(n => n.guid));
          saveNoteSelectionCache(noteCache);
          renderNotes();
          updateNotebookCheckboxState(guid);
          updateCurrentNotebookDisplay();
          renderNotebooks();
          updateUI();
        } else {
          // 笔记未加载，需要加载
          loadNotesForNotebookWithSelection(guid, true);
        }
      } else {
        // 如果不是当前笔记本，先标记为全选（但不知道总数，先不更新数字）
        // 然后异步加载笔记来获取总数
        _pendingNotebookSelection = { guid, selected: true };
        // 不切换右侧显示，只加载笔记获取总数
        loadNotesForNotebookTotalOnly(guid);
      }
    } else {
      // 取消勾选笔记本时，清空该笔记本的笔记缓存和总数
      const noteCache = getNoteSelectionCache();
      delete noteCache[guid];
      saveNoteSelectionCache(noteCache);

      const noteTotalCache = getNoteTotalCache();
      delete noteTotalCache[guid];
      saveNoteTotalCache(noteTotalCache);

      // 如果当前查看的就是这个笔记本，清空笔记选中状态但不删除笔记列表
      if (currentNotebook === guid) {
        // 清空选中状态后重新渲染笔记列表（显示为未勾选）
        renderNotes();
        updateCurrentNotebookDisplay();
      }
      // 更新左侧笔记本显示
      renderNotebooks();
    }

    updateUI();
    updateExportModeHint();
  }

  /**
   * 加载笔记本笔记并同步勾选状态
   * @param {string} guid - 笔记本 guid
   * @param {boolean} selectAll - 是否全选该笔记本的笔记
   */
  async function loadNotesForNotebookWithSelection(guid, selectAll) {
    elements.noteList.innerHTML = '<p class="placeholder">加载中...</p>';

    // 设置当前查看的笔记本
    if (StateManager) {
      StateManager.setState('export.currentNotebook', guid);
    }

    try {
      const data = await API.notebooks.getNotes(guid);

      if (data.success) {
        let notes = data.data.notes || [];
        // 给每个笔记添加 notebookGuid
        notes.forEach(note => note.notebookGuid = guid);

        if (StateManager) {
          StateManager.setState('export.notes', notes);
        }

        // 同步勾选状态
        const noteCache = getNoteSelectionCache();
        if (selectAll) {
          noteCache[guid] = new Set(notes.map(n => n.guid));
        } else {
          noteCache[guid] = new Set();
        }
        saveNoteSelectionCache(noteCache);

        // 保存笔记总数
        const noteTotalCache = getNoteTotalCache();
        noteTotalCache[guid] = notes.length;
        saveNoteTotalCache(noteTotalCache);

        renderNotes();
        // 更新当前笔记本名称显示
        updateCurrentNotebookDisplay();
        // renderNotebooks() 会正确计算所有笔记本的勾选状态
        renderNotebooks();

        // 检查是否有待执行的 partial 操作
        if (_pendingPartialAction && _pendingPartialAction.guid === guid) {
          const action = _pendingPartialAction;
          _pendingPartialAction = null;
          if (action.type === 'toggle') {
            // 重新计算选中状态
            const cachedNotes = noteCache[guid] || new Set();
            const updatedNotes = StateManager?.getState?.('export.notes') || [];
            const notebookNotes = updatedNotes.filter(n => n.notebookGuid === guid);
            const selectedCount = notebookNotes.filter(n => cachedNotes.has(n.guid)).length;

            if (selectedCount === notebookNotes.length) {
              noteCache[guid] = new Set();
            } else {
              noteCache[guid] = new Set(notebookNotes.map(n => n.guid));
            }
            saveNoteSelectionCache(noteCache);
            updateNotebookCheckboxState(guid);
            renderNotes();
            updateCurrentNotebookDisplay();
          }
        }
      }
    } catch (err) {
      console.error('加载笔记失败:', err);
      elements.noteList.innerHTML = '<p class="placeholder">加载失败</p>';
    }
    updateExportModeHint();
  }

  /**
   * 全选/取消全选笔记本
   */
  /**
   * 处理左侧笔记本减号➖的点击
   * @param {string} guid - 笔记本 guid
   */
  function handlePartialClick(guid) {
    const noteCache = getNoteSelectionCache();
    const cachedNotes = noteCache[guid] || new Set();

    // 获取该笔记本的笔记
    const allNotes = StateManager?.getState?.('export.notes') || [];
    const notebookNotes = allNotes.filter(n => n.notebookGuid === guid);

    if (notebookNotes.length > 0) {
      // 笔记已加载，直接处理
      const selectedCount = notebookNotes.filter(n => cachedNotes.has(n.guid)).length;

      if (selectedCount === notebookNotes.length) {
        // 当前是全选状态 → 取消全选
        noteCache[guid] = new Set();
      } else {
        // 当前是部分选中 → 全选
        noteCache[guid] = new Set(notebookNotes.map(n => n.guid));
      }
      saveNoteSelectionCache(noteCache);

      // 更新显示（重新渲染整个笔记本列表以更新 n/m 数字）
      renderNotebooks();

      // 如果当前查看的就是这个笔记本，更新右侧显示
      const currentNotebook = StateManager?.getState?.('export.currentNotebook');
      if (currentNotebook === guid) {
        renderNotes();
        updateCurrentNotebookDisplay();
      }
    } else {
      // 笔记未加载，先加载再处理
      // 临时存储要执行的操作，加载完成后执行
      _pendingPartialAction = { type: 'toggle', guid };
      // 加载笔记并保持当前的勾选状态切换逻辑
      loadNotesForNotebook(guid);
    }
  }

  /**
   * 临时存储待执行的partial操作（用于笔记本笔记未加载时）
   */
  let _pendingPartialAction = null;

  /**
   * 临时存储待执行的笔记本勾选操作（用于非当前笔记本勾选时加载总数）
   */
  let _pendingNotebookSelection = null;

  /**
   * 加载笔记本笔记总数（不切换右侧显示）
   * 用于勾选非当前笔记本时，获取总数来显示 n/m
   */
  async function loadNotesForNotebookTotalOnly(notebookGuid) {
    try {
      const data = await API.notebooks.getNotes(notebookGuid);

      if (data.success) {
        let notes = data.data.notes || [];
        notes.forEach(note => note.notebookGuid = notebookGuid);

        // 保存笔记总数
        const noteTotalCache = getNoteTotalCache();
        noteTotalCache[notebookGuid] = notes.length;
        saveNoteTotalCache(noteTotalCache);

        // 处理待执行的勾选操作
        if (_pendingNotebookSelection && _pendingNotebookSelection.guid === notebookGuid) {
          const pending = _pendingNotebookSelection;
          _pendingNotebookSelection = null;

          if (pending.selected) {
            // 全选该笔记本的笔记
            const noteCache = getNoteSelectionCache();
            noteCache[notebookGuid] = new Set(notes.map(n => n.guid));
            saveNoteSelectionCache(noteCache);
          }
        }

        // 更新左侧笔记本显示
        renderNotebooks();
      }
    } catch (err) {
      console.error('加载笔记总数失败:', err);
    }
  }

  function handleSelectAllNotebooks() {
    const notebooks = StateManager?.getState?.('export.notebooks') || [];
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];

    // 判断是否是全部选中：selectedNotebooks 数量等于笔记本数量
    const allSelected = selectedNotebooks.length === notebooks.length;

    if (allSelected) {
      // 取消全选：清空所有笔记本和笔记的勾选状态
      if (StateManager) {
        StateManager.setState('export.selectedNotebooks', []);
        StateManager.setState('export.allNotebooksSelected', false);
      }
      // 清空所有笔记本的笔记缓存
      const noteCache = getNoteSelectionCache();
      Object.keys(noteCache).forEach(guid => {
        delete noteCache[guid];
      });
      saveNoteSelectionCache(noteCache);
      // 清空笔记总数缓存
      const noteTotalCache = getNoteTotalCache();
      Object.keys(noteTotalCache).forEach(guid => {
        delete noteTotalCache[guid];
      });
      saveNoteTotalCache(noteTotalCache);
      // 清空当前笔记列表
      if (StateManager) {
        StateManager.setState('export.notes', []);
      }
      renderNotes();
    } else {
      // 全选所有笔记本
      if (StateManager) {
        StateManager.setState('export.selectedNotebooks', notebooks.map(nb => nb.guid));
        // 标记为全选状态，用于 UI 显示
        StateManager.setState('export.allNotebooksSelected', true);
      }
    }

    renderNotebooks();
    updateUI();
    updateExportModeHint();
  }

  /**
   * 处理笔记本搜索
   */
  function handleNotebookSearch(e) {
    searchQuery.notebooks = e.target.value;

    if (elements.clearNotebookSearch) {
      elements.clearNotebookSearch.classList.toggle('visible', searchQuery.notebooks.length > 0);
    }

    renderNotebooks();
  }

  /**
   * 清除笔记本搜索
   */
  function clearNotebookSearch() {
    if (elements.notebookSearch) {
      elements.notebookSearch.value = '';
    }
    searchQuery.notebooks = '';

    if (elements.clearNotebookSearch) {
      elements.clearNotebookSearch.classList.remove('visible');
    }

    renderNotebooks();
  }

  /**
   * 加载选中笔记本的笔记
   */
  async function loadNotesForNotebooks() {
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];

    if (selectedNotebooks.length === 0) {
      elements.noteList.innerHTML = '<p class="placeholder">请先选择笔记本</p>';
      return;
    }

    elements.noteList.innerHTML = '<p class="placeholder">加载中...</p>';

    try {
      // 收集所有笔记
      const allNotes = [];
      const noteTotalCache = getNoteTotalCache();

      for (const notebookGuid of selectedNotebooks) {
        const data = await API.notebooks.getNotes(notebookGuid);

        if (data.success) {
          const notes = data.data.notes || [];
          // 给每个笔记添加 notebookGuid
          notes.forEach(note => note.notebookGuid = notebookGuid);
          allNotes.push(...notes);
          // 保存每个笔记本的笔记总数
          noteTotalCache[notebookGuid] = notes.length;
        }
      }
      saveNoteTotalCache(noteTotalCache);

      if (StateManager) {
        StateManager.setState('export.notes', allNotes);
      }

      renderNotes();
      updateCurrentNotebookDisplay();
      renderNotebooks();
    } catch (err) {
      console.error('加载笔记失败:', err);
      elements.noteList.innerHTML = '<p class="placeholder">加载失败</p>';
      let isRateLimit = err.message.includes('RATE_LIMIT_REACHED') || err.message.includes('限流');
      UIModule?.log('ERROR', `加载笔记失败${isRateLimit ? '（限流）' : ''}: ${err.message}`);
    }
  }

  /**
   * 加载单个笔记本的笔记（点击笔记本时调用）
   */
  async function loadNotesForNotebook(notebookGuid) {
    elements.noteList.innerHTML = '<p class="placeholder">加载中...</p>';

    // 设置当前查看的笔记本
    if (StateManager) {
      StateManager.setState('export.currentNotebook', notebookGuid);
    }

    try {
      const data = await API.notebooks.getNotes(notebookGuid);

      if (data.success) {
        let notes = data.data.notes || [];
        // 给每个笔记添加 notebookGuid
        notes.forEach(note => note.notebookGuid = notebookGuid);

        if (StateManager) {
          StateManager.setState('export.notes', notes);
        }

        // 确保缓存存在（如果之前没有初始化过）
        const noteCache = getNoteSelectionCache();
        if (!noteCache[notebookGuid]) {
          noteCache[notebookGuid] = new Set();
          saveNoteSelectionCache(noteCache);
        }

        // 保存笔记总数
        const noteTotalCache = getNoteTotalCache();
        noteTotalCache[notebookGuid] = notes.length;
        saveNoteTotalCache(noteTotalCache);

        renderNotes();
        // 更新当前笔记本名称显示
        updateCurrentNotebookDisplay();
        // renderNotebooks() 会正确计算所有笔记本的勾选状态，不需要单独调用 updateNotebookCheckboxState
        renderNotebooks(); // 重新渲染笔记本以更新当前笔记本的样式

        // 检查是否有待执行的 partial 操作
        if (_pendingPartialAction && _pendingPartialAction.guid === notebookGuid) {
          const action = _pendingPartialAction;
          _pendingPartialAction = null;
          if (action.type === 'toggle') {
            // 重新计算选中状态
            const noteCache = getNoteSelectionCache();
            const cachedNotes = noteCache[notebookGuid] || new Set();
            const updatedNotes = StateManager?.getState?.('export.notes') || [];
            const notebookNotes = updatedNotes.filter(n => n.notebookGuid === notebookGuid);
            const selectedCount = notebookNotes.filter(n => cachedNotes.has(n.guid)).length;

            if (selectedCount === notebookNotes.length) {
              noteCache[notebookGuid] = new Set();
            } else {
              noteCache[notebookGuid] = new Set(notebookNotes.map(n => n.guid));
            }
            saveNoteSelectionCache(noteCache);
            updateNotebookCheckboxState(notebookGuid);
            renderNotes();
            updateCurrentNotebookDisplay();
          }
        }
      }
    } catch (err) {
      console.error('加载笔记失败:', err);
      elements.noteList.innerHTML = '<p class="placeholder">加载失败</p>';
      let isRateLimit = err.message.includes('RATE_LIMIT_REACHED') || err.message.includes('限流');
      UIModule?.log('ERROR', `加载笔记失败${isRateLimit ? '（限流）' : ''}: ${err.message}`);
    }
    updateExportModeHint();
  }

  /**
   * 渲染笔记列表
   */
  function renderNotes() {
    const notes = StateManager?.getState?.('export.notes') || [];
    const currentNotebook = StateManager?.getState?.('export.currentNotebook');
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
    const allNotebooksSelected = StateManager?.getState?.('export.allNotebooksSelected') || false;
    const noteCache = getNoteSelectionCache();
    const cachedSelection = currentNotebook ? (noteCache[currentNotebook] || new Set()) : new Set();
    const query = searchQuery.notes.toLowerCase();

    const filtered = notes.filter(note =>
      note.title.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      elements.noteList.innerHTML = notes.length === 0
        ? '<p class="placeholder">请先选择笔记本</p>'
        : `<p class="no-results">没有匹配 "${escapeHtml(query)}" 的笔记</p>`;
      return;
    }

    // 如果全选了当前笔记本，所有笔记都显示为勾选
    const allNotesSelectedForCurrent = allNotebooksSelected && selectedNotebooks.includes(currentNotebook);

    let html = '';
    filtered.forEach(note => {
      const checked = allNotesSelectedForCurrent || cachedSelection.has(note.guid) ? 'checked' : '';
      const selectedClass = checked ? 'selected' : '';
      const date = new Date(note.updated).toLocaleDateString();

      html += `
        <div class="list-item ${selectedClass}" data-guid="${note.guid}">
          <input type="checkbox" ${checked}>
          <span class="title">${escapeHtml(note.title)}</span>
          <span class="meta">${date}</span>
        </div>
      `;
    });

    elements.noteList.innerHTML = html;

    // 右侧笔记计数不在这里显示，数字显示在左侧笔记本后面
    if (elements.noteCount) {
      elements.noteCount.textContent = '';
    }

    // 绑定事件
    elements.noteList.querySelectorAll('.list-item[data-guid]').forEach(item => {
      // 点击笔记项（不是 checkbox）切换选择
      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const checkbox = item.querySelector('input');
          checkbox.checked = !checkbox.checked;
          toggleNoteSelection(item.dataset.guid, checkbox.checked);
        }
      });

      // 点击 checkbox 也触发选择
      const checkbox = item.querySelector('input');
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          toggleNoteSelection(item.dataset.guid, checkbox.checked);
        });
      }
    });
  }

  /**
   * 切换笔记选择
   * @param {string} guid - 笔记 guid
   * @param {boolean} checked - 是否选中
   * @param {string} notebookGuid - 笔记所属笔记本（可选，从 note.notebookGuid 获取）
   */
  function toggleNoteSelection(guid, checked, notebookGuid = null) {
    // 获取当前笔记本
    const currentNotebook = notebookGuid || StateManager?.getState?.('export.currentNotebook');
    if (!currentNotebook) return;

    // 获取缓存
    const noteCache = getNoteSelectionCache();
    if (!noteCache[currentNotebook]) {
      noteCache[currentNotebook] = new Set();
    }

    // 更新缓存
    if (checked) {
      noteCache[currentNotebook].add(guid);
    } else {
      noteCache[currentNotebook].delete(guid);
    }
    saveNoteSelectionCache(noteCache);

    // 清除"全选"标志，因为用户正在单独操作笔记
    if (StateManager) {
      StateManager.setState('export.allNotebooksSelected', false);
    }

    // 更新 UI
    const item = elements.noteList.querySelector(`[data-guid="${guid}"]`);
    if (item) {
      item.classList.toggle('selected', checked);
    }

    // 更新左侧笔记本的勾选状态
    updateNotebookCheckboxState(currentNotebook);
    // 更新当前笔记本名称显示
    updateCurrentNotebookDisplay();
    // 更新左侧笔记本的数字显示 (n/m)
    renderNotebooks();
    updateUI();
  }

  /**
   * 更新左侧笔记本的勾选状态（根据缓存的笔记选择）
   */
  function updateNotebookCheckboxState(notebookGuid) {
    const noteCache = getNoteSelectionCache();
    const cachedNotes = noteCache[notebookGuid] || new Set();
    const currentNotes = StateManager?.getState?.('export.notes') || [];

    // 获取当前笔记本的笔记
    const notebookNotes = currentNotes.filter(n => n.notebookGuid === notebookGuid);

    if (notebookNotes.length === 0) return; // 还没加载，不知道状态

    const selectedCount = notebookNotes.filter(n => cachedNotes.has(n.guid)).length;

    // 更新左侧笔记本显示
    const notebookItem = elements.notebookList.querySelector(`.notebook-item[data-guid="${notebookGuid}"]`);
    if (notebookItem) {
      // 移除旧的 partial class
      notebookItem.classList.remove('partial');

      if (selectedCount > 0 && selectedCount < notebookNotes.length) {
        notebookItem.classList.add('partial');
        // 把 checkbox 替换成减号
        const checkbox = notebookItem.querySelector('input[type="checkbox"]');
        if (checkbox && !notebookItem.querySelector('.checkbox-partial')) {
          checkbox.outerHTML = '<span class="checkbox-partial">&#8212;</span>';
        }
      } else if (selectedCount === notebookNotes.length) {
        // 全选 - checkbox 应该勾选
        const partial = notebookItem.querySelector('.checkbox-partial');
        if (partial) {
          partial.outerHTML = `<input type="checkbox" checked>`;
        }
      } else {
        // 未选
        const partial = notebookItem.querySelector('.checkbox-partial');
        if (partial) {
          partial.outerHTML = `<input type="checkbox">`;
        }
      }
    }
  }

  /**
   * 更新所有笔记本的勾选状态
   * 当加载笔记后，遍历所有有缓存的笔记本并更新其勾选状态
   */
  function updateAllNotebooksCheckboxState() {
    const noteCache = getNoteSelectionCache();
    const notebooks = StateManager?.getState?.('export.notebooks') || [];
    const currentNotes = StateManager?.getState?.('export.notes') || [];

    notebooks.forEach(nb => {
      const cachedNotes = noteCache[nb.guid] || new Set();
      // 只更新有缓存且当前笔记列表中有该笔记本笔记的情况
      if (cachedNotes.size > 0) {
        const notebookNotes = currentNotes.filter(n => n.notebookGuid === nb.guid);
        if (notebookNotes.length > 0) {
          updateNotebookCheckboxState(nb.guid);
        }
      }
    });
  }

  /**
   * 更新当前笔记本名称显示
   */
  function updateCurrentNotebookDisplay() {
    const currentNotebook = StateManager?.getState?.('export.currentNotebook');
    const notebooks = StateManager?.getState?.('export.notebooks') || [];
    const noteCache = getNoteSelectionCache();

    if (!currentNotebook) {
      if (elements.currentNotebookName) {
        elements.currentNotebookName.textContent = '';
      }
      return;
    }

    const notebook = notebooks.find(nb => nb.guid === currentNotebook);
    const selectedCount = noteCache[currentNotebook]?.size || 0;

    if (elements.currentNotebookName) {
      if (selectedCount > 0) {
        elements.currentNotebookName.textContent = `${notebook?.name || ''} (已选择 ${selectedCount} 篇)`;
      } else {
        elements.currentNotebookName.textContent = notebook?.name || '';
      }
    }
  }

  /**
   * 更新导出模式提示文字
   */
  function updateExportModeHint() {
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
    const hintEl = document.getElementById('exportModeHint');

    if (!hintEl) return;

    if (selectedNotebooks.length > 0) {
      hintEl.textContent = `已选 ${selectedNotebooks.length} 个笔记本（可取消勾选笔记排除）`;
    } else {
      hintEl.textContent = '请勾选要导出的笔记';
    }
  }

  /**
   * 处理笔记搜索
   */
  function handleNoteSearch(e) {
    searchQuery.notes = e.target.value;

    if (elements.clearNoteSearch) {
      elements.clearNoteSearch.classList.toggle('visible', searchQuery.notes.length > 0);
    }

    renderNotes();
  }

  /**
   * 清除笔记搜索
   */
  function clearNoteSearch() {
    if (elements.noteSearch) {
      elements.noteSearch.value = '';
    }
    searchQuery.notes = '';

    if (elements.clearNoteSearch) {
      elements.clearNoteSearch.classList.remove('visible');
    }

    renderNotes();
  }

  /**
   * 更新 UI
   */
  function updateUI() {
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
    const noteCache = getNoteSelectionCache();

    // 计算选中笔记本下的选中笔记总数
    let totalSelectedNotes = 0;
    selectedNotebooks.forEach(nbGuid => {
      const selectedNotes = noteCache[nbGuid] || new Set();
      totalSelectedNotes += selectedNotes.size;
    });

    const hasSelection = totalSelectedNotes > 0;

    // 更新导出按钮
    if (elements.exportBtn) {
      elements.exportBtn.disabled = !hasSelection;

      // 更新按钮文本
      if (totalSelectedNotes > 0) {
        elements.exportBtn.textContent = `导出选中 (${totalSelectedNotes} 笔记)`;
      } else {
        elements.exportBtn.textContent = '导出选中';
      }
    }
  }

  /**
   * 处理导出
   */
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

  /**
   * 导出单个笔记本
   */
  async function handleExportNotebook() {
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];

    if (selectedNotebooks.length !== 1) {
      showStatus('请选择一个笔记本', 'error');
      return;
    }

    const imageFormat = document.querySelector('input[name="imageFormat"]:checked')?.value || 'obsidian';

    showProgressCard(true);
    updateProgress(0, '准备导出...');

    try {
      const result = await API.export.notebook(selectedNotebooks[0], imageFormat);

      if (result.success) {
        updateProgress(100, '导出完成');
        showExportResult(
          result.data.exported?.length || 1,
          result.data.errors?.length || 0
        );
      }
    } catch (err) {
      showStatus('导出失败: ' + err.message, 'error');
      showProgressCard(false);
    }
  }

  /**
   * 轮询导出进度
   */
  async function pollExportProgress(taskId) {
    if (exportPollInterval) {
      clearInterval(exportPollInterval);
    }

    exportPollInterval = setInterval(async () => {
      try {
        const data = await API.export.getProgress(taskId);

        updateProgress(
          data.data.progress || 0,
          `导出进度: ${data.data.progress || 0}% (${data.data.success || 0}/${data.data.total || 0})`
        );

        UIModule?.log('INFO', `进度更新: ${data.data.progress || 0}% (${data.data.success || 0}/${data.data.total || 0})`);

        if (data.data.status === 'completed') {
          clearInterval(exportPollInterval);
          exportPollInterval = null;

          showExportResult(
            data.data.success || 0,
            data.data.errors?.length || 0
          );

          // 自动下载
          if (data.data.errors?.length === 0) {
            setTimeout(() => {
              handleDownload();
            }, 1000);
          }
        } else if (data.data.status === 'failed') {
          clearInterval(exportPollInterval);
          exportPollInterval = null;
          showStatus('导出失败', 'error');
          showProgressCard(false);
        }
      } catch (err) {
        clearInterval(exportPollInterval);
        exportPollInterval = null;
        showStatus('获取进度失败: ' + err.message, 'error');
        showProgressCard(false);
      }
    }, 1000);
  }

  /**
   * 显示导出结果
   */
  function showExportResult(successCount, errorCount) {
    updateProgress(100, '导出完成');

    if (errorCount > 0) {
      UIModule?.log('WARN', `导出完成: 成功 ${successCount}，失败 ${errorCount}`);
    } else {
      UIModule?.log('INFO', `导出完成: 成功 ${successCount}`);
    }

    if (elements.exportResult) {
      elements.exportResult.style.display = 'block';
    }

    if (elements.resultMessage) {
      let message = `成功导出 ${successCount} 篇笔记`;
      if (errorCount > 0) {
        message += `，${errorCount} 篇失败`;
      }
      elements.resultMessage.textContent = message;
    }
  }

  /**
   * 显示/隐藏进度卡片
   */
  function showProgressCard(show) {
    if (elements.progressCard) {
      elements.progressCard.style.display = show ? 'block' : 'none';
    }

    if (elements.exportResult) {
      elements.exportResult.style.display = 'none';
    }
  }

  /**
   * 更新进度
   */
  function updateProgress(percent, text) {
    if (elements.progressFill) {
      elements.progressFill.style.width = `${percent}%`;
    }

    if (elements.progressText) {
      elements.progressText.textContent = text;
    }
  }

  /**
   * 下载导出文件
   */
  function handleDownload() {
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];

    if (selectedNotebooks.length === 1) {
      // 单个笔记本
      const notebooks = StateManager?.getState?.('export.notebooks') || [];
      const notebook = notebooks.find(nb => nb.guid === selectedNotebooks[0]);
      const path = `./exports/${escapeHtml(notebook?.name || 'notebook')}`;
      API.export.download(path);
    } else {
      // 多个笔记本，使用 exports 目录
      API.export.download('./exports');
    }
  }

  /**
   * 显示状态消息
   */
  function showStatus(message, type) {
    // 在进度卡片中显示（用于导出进度）
    if (elements.progressText) {
      elements.progressText.textContent = message;
      elements.progressText.className = `progress-text ${type}`;
    }

    // 同时在专门的错误区域显示（用于加载错误）
    if (elements.notebooksErrorMsg && type === 'error') {
      elements.notebooksErrorMsg.textContent = message;
      elements.notebooksErrorMsg.className = `error-message show ${type}`;

      // 5秒后自动隐藏
      setTimeout(() => {
        if (elements.notebooksErrorMsg) {
          elements.notebooksErrorMsg.classList.remove('show');
        }
      }, 5000);
    }
  }

  /**
   * 转义 HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    init,
    loadNotebooks
  };
})();
