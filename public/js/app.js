// 应用状态
const state = {
  token: '',
  noteStoreUrl: '',
  authenticated: false,
  notebooks: [],
  currentNotebook: null,
  notes: [],
  selectedNotes: new Set(),
  exportPath: ''
};

// DOM 元素
const elements = {
  token: document.getElementById('token'),
  noteStoreUrl: document.getElementById('noteStoreUrl'),
  verifyBtn: document.getElementById('verifyBtn'),
  authStatus: document.getElementById('authStatus'),
  selectSection: document.getElementById('select-section'),
  exportSection: document.getElementById('export-section'),
  progressSection: document.getElementById('progress-section'),
  notebookList: document.getElementById('notebookList'),
  noteList: document.getElementById('noteList'),
  noteCount: document.getElementById('noteCount'),
  selectAllNotes: document.getElementById('selectAllNotes'),
  exportNotebookBtn: document.getElementById('exportNotebookBtn'),
  exportSelectedBtn: document.getElementById('exportSelectedBtn'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  exportResult: document.getElementById('exportResult'),
  resultMessage: document.getElementById('resultMessage'),
  downloadBtn: document.getElementById('downloadBtn')
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 尝试从 localStorage 恢复配置
  const savedToken = localStorage.getItem('yx_token');
  const savedNoteStoreUrl = localStorage.getItem('yx_notestore_url');

  if (savedToken) elements.token.value = savedToken;
  if (savedNoteStoreUrl) elements.noteStoreUrl.value = savedNoteStoreUrl;

  // 绑定事件
  elements.verifyBtn.addEventListener('click', handleVerify);
  elements.selectAllNotes.addEventListener('change', handleSelectAll);
  elements.exportNotebookBtn.addEventListener('click', () => handleExport('notebook'));
  elements.exportSelectedBtn.addEventListener('click', () => handleExport('selected'));
  elements.downloadBtn.addEventListener('click', handleDownload);
});

// 验证 Token
async function handleVerify() {
  const token = elements.token.value.trim();
  const noteStoreUrl = elements.noteStoreUrl.value.trim();

  if (!token || !noteStoreUrl) {
    showStatus('请填写 Token 和 NoteStore URL', 'error');
    return;
  }

  showStatus('验证中...', 'loading');
  elements.verifyBtn.disabled = true;

  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, noteStoreUrl })
    });

    const data = await response.json();

    if (data.success) {
      state.token = token;
      state.noteStoreUrl = noteStoreUrl;
      state.authenticated = true;

      // 保存到 localStorage
      localStorage.setItem('yx_token', token);
      localStorage.setItem('yx_notestore_url', noteStoreUrl);

      showStatus(`验证成功，欢迎 ${data.user.name || data.user.username}`, 'success');

      // 显示选择区域
      elements.selectSection.style.display = 'block';
      elements.exportSection.style.display = 'block';

      // 加载笔记本列表
      await loadNotebooks();
    } else {
      showStatus(data.message || '验证失败', 'error');
    }
  } catch (err) {
    showStatus('验证失败: ' + err.message, 'error');
  } finally {
    elements.verifyBtn.disabled = false;
  }
}

// 加载笔记本列表
async function loadNotebooks() {
  try {
    const response = await fetch('/api/notebooks', {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (data.success) {
      state.notebooks = data.notebooks;
      renderNotebooks();
    }
  } catch (err) {
    console.error('加载笔记本失败:', err);
  }
}

// 渲染笔记本列表
function renderNotebooks() {
  if (state.notebooks.length === 0) {
    elements.notebookList.innerHTML = '<p class="placeholder">没有找到笔记本</p>';
    return;
  }

  // 按 stack 分组
  const stacks = new Map();
  const noStack = [];

  state.notebooks.forEach(nb => {
    if (nb.stack) {
      if (!stacks.has(nb.stack)) stacks.set(nb.stack, []);
      stacks.get(nb.stack).push(nb);
    } else {
      noStack.push(nb);
    }
  });

  let html = '';

  // 先显示无 stack 的笔记本
  noStack.forEach(nb => {
    html += createNotebookItem(nb);
  });

  // 再按 stack 显示
  stacks.forEach((notebooks, stackName) => {
    html += `<div class="stack-header">${stackName}</div>`;
    notebooks.forEach(nb => {
      html += createNotebookItem(nb);
    });
  });

  elements.notebookList.innerHTML = html;

  // 绑定点击事件
  elements.notebookList.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', () => handleNotebookClick(item.dataset.guid));
  });
}

function createNotebookItem(notebook) {
  return `
    <div class="list-item" data-guid="${notebook.guid}">
      <span class="title">${escapeHtml(notebook.name)}</span>
    </div>
  `;
}

// 处理笔记本点击
async function handleNotebookClick(notebookGuid) {
  // 更新选中状态
  elements.notebookList.querySelectorAll('.list-item').forEach(item => {
    item.classList.toggle('active', item.dataset.guid === notebookGuid);
  });

  state.currentNotebook = state.notebooks.find(nb => nb.guid === notebookGuid);
  state.selectedNotes.clear();
  elements.selectAllNotes.checked = false;

  // 加载笔记列表
  elements.noteList.innerHTML = '<p class="placeholder">加载中...</p>';

  try {
    const response = await fetch(`/api/notebooks/${notebookGuid}/notes`, {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (data.success) {
      state.notes = data.notes;
      elements.noteCount.textContent = `(${data.totalNotes} 篇)`;
      renderNotes();
      updateExportButtons();
    }
  } catch (err) {
    elements.noteList.innerHTML = '<p class="placeholder">加载失败</p>';
    console.error('加载笔记失败:', err);
  }
}

// 渲染笔记列表
function renderNotes() {
  if (state.notes.length === 0) {
    elements.noteList.innerHTML = '<p class="placeholder">该笔记本没有笔记</p>';
    return;
  }

  let html = '';
  state.notes.forEach(note => {
    const checked = state.selectedNotes.has(note.guid) ? 'checked' : '';
    const date = new Date(note.updated).toLocaleDateString();
    html += `
      <div class="list-item ${checked ? 'selected' : ''}" data-guid="${note.guid}">
        <input type="checkbox" ${checked}>
        <span class="title">${escapeHtml(note.title)}</span>
        <span class="count">${date}</span>
      </div>
    `;
  });

  elements.noteList.innerHTML = html;

  // 绑定点击事件
  elements.noteList.querySelectorAll('.list-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'INPUT') {
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.checked = !checkbox.checked;
      }
      handleNoteToggle(item.dataset.guid, item.querySelector('input').checked);
    });
  });
}

// 处理笔记选择
function handleNoteToggle(noteGuid, checked) {
  if (checked) {
    state.selectedNotes.add(noteGuid);
  } else {
    state.selectedNotes.delete(noteGuid);
  }

  // 更新样式
  const item = elements.noteList.querySelector(`[data-guid="${noteGuid}"]`);
  if (item) item.classList.toggle('selected', checked);

  // 更新全选框状态
  elements.selectAllNotes.checked = state.selectedNotes.size === state.notes.length;

  updateExportButtons();
}

// 全选/取消全选
function handleSelectAll() {
  const checked = elements.selectAllNotes.checked;

  state.notes.forEach(note => {
    if (checked) {
      state.selectedNotes.add(note.guid);
    } else {
      state.selectedNotes.delete(note.guid);
    }
  });

  renderNotes();
  updateExportButtons();
}

// 更新导出按钮状态
function updateExportButtons() {
  elements.exportNotebookBtn.disabled = !state.currentNotebook;
  elements.exportSelectedBtn.disabled = state.selectedNotes.size === 0;
}

// 处理导出
async function handleExport(type) {
  const imageFormat = document.querySelector('input[name="imageFormat"]:checked').value;

  elements.progressSection.style.display = 'block';
  elements.exportResult.style.display = 'none';
  elements.progressFill.style.width = '0%';
  elements.progressText.textContent = '准备导出...';

  try {
    let url, body;

    if (type === 'notebook') {
      url = `/api/export/notebook/${state.currentNotebook.guid}`;
      body = { imageFormat };
      elements.progressText.textContent = `正在导出笔记本: ${state.currentNotebook.name}`;
    } else {
      // 导出选中笔记 - 逐个导出
      const guids = Array.from(state.selectedNotes);
      let completed = 0;
      const errors = [];

      for (const guid of guids) {
        const note = state.notes.find(n => n.guid === guid);
        elements.progressText.textContent = `正在导出: ${note?.title || guid}`;

        try {
          const response = await fetch(`/api/export/note/${guid}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            },
            body: JSON.stringify({ imageFormat })
          });

          const data = await response.json();
          if (!data.success) {
            errors.push({ title: note?.title, error: data.message });
          } else {
            state.exportPath = data.path;
          }
        } catch (err) {
          errors.push({ title: note?.title, error: err.message });
        }

        completed++;
        elements.progressFill.style.width = `${(completed / guids.length) * 100}%`;
      }

      showExportResult(completed - errors.length, errors.length);
      return;
    }

    // 笔记本导出
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (data.success) {
      state.exportPath = data.exportPath;
      elements.progressFill.style.width = '100%';
      showExportResult(data.exported?.length || 1, data.errors?.length || 0);
    } else {
      elements.progressText.textContent = '导出失败: ' + data.message;
    }
  } catch (err) {
    elements.progressText.textContent = '导出失败: ' + err.message;
  }
}

// 显示导出结果
function showExportResult(successCount, errorCount) {
  elements.progressFill.style.width = '100%';
  elements.progressText.textContent = '导出完成';
  elements.exportResult.style.display = 'block';

  let message = `成功导出 ${successCount} 篇笔记`;
  if (errorCount > 0) {
    message += `，${errorCount} 篇失败`;
  }
  elements.resultMessage.textContent = message;
}

// 下载导出文件
function handleDownload() {
  if (!state.exportPath) return;

  // 构建下载 URL
  const url = `/api/export/download?path=${encodeURIComponent(state.exportPath)}`;
  window.location.href = url;
}

// 辅助函数
function showStatus(message, type) {
  elements.authStatus.textContent = message;
  elements.authStatus.className = `status ${type}`;
}

function getAuthHeaders() {
  return {
    'X-Evernote-Token': state.token,
    'X-Evernote-NoteStore-URL': state.noteStoreUrl
  };
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
