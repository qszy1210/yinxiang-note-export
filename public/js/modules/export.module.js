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
    elements.noteSearch = document.getElementById('noteSearch');
    elements.clearNoteSearch = document.getElementById('clearNoteSearch');
    elements.noteList = document.getElementById('noteList');
    elements.noteCount = document.getElementById('noteCount');
    elements.selectAllNotes = document.getElementById('selectAllNotes');
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

    if (elements.selectAllNotes) {
      elements.selectAllNotes.addEventListener('change', handleSelectAllNotes);
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
      if (err.message.includes('RATE_LIMIT_REACHED') || err.message.includes('限流')) {
        errorMsg = '请求过于频繁，请稍后再试（印象笔记 API 限制）';
      }
      showStatus(errorMsg, 'error');

      // 恢复按钮
      if (elements.loadNotebooksBtn) {
        elements.loadNotebooksBtn.disabled = false;
        elements.loadNotebooksBtn.textContent = '刷新笔记本';
      }
    }
  }

  /**
   * 渲染笔记本列表
   */
  function renderNotebooks() {
    const notebooks = StateManager?.getState?.('export.notebooks') || [];
    const selected = StateManager?.getState?.('export.selectedNotebooks') || [];
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

    let html = '';

    // 无 stack 的笔记本
    noStack.forEach(nb => {
      html += createNotebookItem(nb, selected);
    });

    // 有 stack 的笔记本
    stacks.forEach((stackNotebooks, stackName) => {
      html += `<div class="list-item stack-header">${escapeHtml(stackName)}</div>`;
      stackNotebooks.forEach(nb => {
        html += createNotebookItem(nb, selected, true);
      });
    });

    elements.notebookList.innerHTML = html;

    // 绑定事件
    elements.notebookList.querySelectorAll('.notebook-item[data-guid]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const checkbox = item.querySelector('input');
          checkbox.checked = !checkbox.checked;
        }
        toggleNotebookSelection(item.dataset.guid, item.querySelector('input').checked);
      });
    });
  }

  /**
   * 创建笔记本项 HTML
   */
  function createNotebookItem(notebook, selected, indent = false) {
    const checked = selected.includes(notebook.guid) ? 'checked' : '';
    const style = indent ? 'padding-left: 28px;' : '';
    const selectedClass = checked ? 'selected' : '';

    return `
      <div class="notebook-item ${selectedClass}" data-guid="${notebook.guid}" style="${style}">
        <input type="checkbox" ${checked}>
        <span>${escapeHtml(notebook.name)}</span>
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
    }

    // 更新 UI
    const item = elements.notebookList.querySelector(`[data-guid="${guid}"]`);
    if (item) {
      item.classList.toggle('selected', checked);
    }

    updateUI();
  }

  /**
   * 全选/取消全选笔记本
   */
  function handleSelectAllNotebooks() {
    const notebooks = StateManager?.getState?.('export.notebooks') || [];
    const allSelected = (StateManager?.getState?.('export.selectedNotebooks') || []).length === notebooks.length;

    const newSelection = allSelected ? [] : notebooks.map(nb => nb.guid);

    if (StateManager) {
      StateManager.setState('export.selectedNotebooks', newSelection);
    }

    renderNotebooks();
    updateUI();
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

      for (const notebookGuid of selectedNotebooks) {
        const data = await API.notebooks.getNotes(notebookGuid);

        if (data.success) {
          allNotes.push(...(data.data.notes || []));
        }
      }

      if (StateManager) {
        StateManager.setState('export.notes', allNotes);
      }

      renderNotes();
    } catch (err) {
      console.error('加载笔记失败:', err);
      elements.noteList.innerHTML = '<p class="placeholder">加载失败</p>';
    }
  }

  /**
   * 渲染笔记列表
   */
  function renderNotes() {
    const notes = StateManager?.getState?.('export.notes') || [];
    const selected = StateManager?.getState?.('export.selectedNotes') || [];
    const query = searchQuery.notes.toLowerCase();

    // 当笔记本选择变化时自动加载笔记
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
    if (selectedNotebooks.length > 0 && notes.length === 0) {
      loadNotesForNotebooks();
      return;
    }

    const filtered = notes.filter(note =>
      note.title.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      elements.noteList.innerHTML = notes.length === 0
        ? '<p class="placeholder">请先选择笔记本</p>'
        : `<p class="no-results">没有匹配 "${escapeHtml(query)}" 的笔记</p>`;
      return;
    }

    let html = '';
    filtered.forEach(note => {
      const checked = selected.includes(note.guid) ? 'checked' : '';
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

    // 更新笔记计数
    if (elements.noteCount) {
      elements.noteCount.textContent = `(${notes.length} 篇)`;
    }

    // 绑定事件
    elements.noteList.querySelectorAll('.list-item[data-guid]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const checkbox = item.querySelector('input');
          checkbox.checked = !checkbox.checked;
        }
        toggleNoteSelection(item.dataset.guid, item.querySelector('input').checked);
      });
    });
  }

  /**
   * 切换笔记选择
   */
  function toggleNoteSelection(guid, checked) {
    let selected = StateManager?.getState?.('export.selectedNotes') || [];

    if (checked) {
      if (!selected.includes(guid)) {
        selected.push(guid);
      }
    } else {
      selected = selected.filter(g => g !== guid);
    }

    if (StateManager) {
      StateManager.setState('export.selectedNotes', selected);
    }

    // 更新 UI
    const item = elements.noteList.querySelector(`[data-guid="${guid}"]`);
    if (item) {
      item.classList.toggle('selected', checked);
    }

    // 更新全选框
    updateSelectAllState();
    updateUI();
  }

  /**
   * 全选/取消全选笔记
   */
  function handleSelectAllNotes() {
    const notes = StateManager?.getState?.('export.notes') || [];
    const checked = elements.selectAllNotes.checked;
    let selected = StateManager?.getState?.('export.selectedNotes') || [];

    notes.forEach(note => {
      if (checked) {
        if (!selected.includes(note.guid)) {
          selected.push(note.guid);
        }
      } else {
        selected = selected.filter(g => g !== note.guid);
      }
    });

    if (StateManager) {
      StateManager.setState('export.selectedNotes', selected);
    }

    renderNotes();
    updateUI();
  }

  /**
   * 更新全选框状态
   */
  function updateSelectAllState() {
    const notes = StateManager?.getState?.('export.notes') || [];
    const selected = StateManager?.getState?.('export.selectedNotes') || [];

    if (elements.selectAllNotes) {
      elements.selectAllNotes.checked = notes.length > 0 && notes.every(note => selected.includes(note.guid));
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
    const selectedNotes = StateManager?.getState?.('export.selectedNotes') || [];

    const hasSelection = selectedNotebooks.length > 0 || selectedNotes.length > 0;

    // 更新导出按钮
    if (elements.exportBtn) {
      elements.exportBtn.disabled = !hasSelection;

      // 更新按钮文本
      if (selectedNotebooks.length > 0 && selectedNotes.length > 0) {
        elements.exportBtn.textContent = `导出选中 (${selectedNotebooks.length} 笔记本 + ${selectedNotes.length} 笔记)`;
      } else if (selectedNotebooks.length > 0) {
        elements.exportBtn.textContent = `导出选中笔记本 (${selectedNotebooks.length})`;
      } else if (selectedNotes.length > 0) {
        elements.exportBtn.textContent = `导出选中笔记 (${selectedNotes.length})`;
      } else {
        elements.exportBtn.textContent = '导出选中';
      }
    }

    // 当笔记本选择变化时，重新加载笔记
    if (selectedNotebooks.length > 0) {
      loadNotesForNotebooks();
    }
  }

  /**
   * 处理导出
   */
  async function handleExport() {
    const selectedNotebooks = StateManager?.getState?.('export.selectedNotebooks') || [];
    const selectedNotes = StateManager?.getState?.('export.selectedNotes') || [];
    const imageFormat = document.querySelector('input[name="imageFormat"]:checked')?.value || 'obsidian';

    if (selectedNotebooks.length === 0 && selectedNotes.length === 0) {
      showStatus('请先选择要导出的内容', 'error');
      return;
    }

    showProgressCard(true);
    updateProgress(0, '准备导出...');

    try {
      if (selectedNotebooks.length > 0) {
        // 使用批量导出接口
        const result = await API.export.batch(selectedNotebooks, imageFormat);

        if (result.data?.taskId) {
          // 轮询进度
          await pollExportProgress(result.data.taskId);
        }
      } else if (selectedNotes.length > 0) {
        // 逐个导出笔记
        let completed = 0;
        const errors = [];

        for (const guid of selectedNotes) {
          try {
            await API.export.note(guid, imageFormat);
            completed++;
            updateProgress(
              Math.floor((completed / selectedNotes.length) * 100),
              `正在导出 (${completed}/${selectedNotes.length})`
            );
          } catch (err) {
            errors.push({ guid, error: err.message });
          }
        }

        showExportResult(completed, errors.length);
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
