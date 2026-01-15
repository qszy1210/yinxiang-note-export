// 应用状态
const state = {
  token: '',
  noteStoreUrl: '',
  authenticated: false,
  notebooks: [],
  currentNotebook: null,
  notes: [],
  selectedNotes: new Set(),
  exportPath: '',
  // 搜索状态
  notebookSearchQuery: '',
  noteSearchQuery: '',
  filteredNotebooks: [],
  filteredNotes: []
};

// DOM 元素
const elements = {
  // Tab
  tabBtns: document.querySelectorAll('.tab-btn'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  exportTab: document.querySelector('[data-tab="export"]'),
  // 配置
  token: document.getElementById('token'),
  noteStoreUrl: document.getElementById('noteStoreUrl'),
  toggleToken: document.getElementById('toggleToken'),
  verifyBtn: document.getElementById('verifyBtn'),
  authStatus: document.getElementById('authStatus'),
  configHint: document.getElementById('configHint'),
  // 搜索
  notebookSearch: document.getElementById('notebookSearch'),
  clearNotebookSearch: document.getElementById('clearNotebookSearch'),
  noteSearch: document.getElementById('noteSearch'),
  clearNoteSearch: document.getElementById('clearNoteSearch'),
  // 导出
  notebookList: document.getElementById('notebookList'),
  noteList: document.getElementById('noteList'),
  noteCount: document.getElementById('noteCount'),
  selectAllNotes: document.getElementById('selectAllNotes'),
  exportNotebookBtn: document.getElementById('exportNotebookBtn'),
  exportSelectedBtn: document.getElementById('exportSelectedBtn'),
  // 进度
  progressCard: document.getElementById('progressCard'),
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),
  exportResult: document.getElementById('exportResult'),
  resultMessage: document.getElementById('resultMessage'),
  downloadBtn: document.getElementById('downloadBtn')
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 绑定 Tab 切换事件
  elements.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // 绑定 Token 显示/隐藏
  elements.toggleToken.addEventListener('click', toggleTokenVisibility);

  // 绑定验证按钮
  elements.verifyBtn.addEventListener('click', handleVerify);
  elements.selectAllNotes.addEventListener('change', handleSelectAll);
  elements.exportNotebookBtn.addEventListener('click', () => handleExport('notebook'));
  elements.exportSelectedBtn.addEventListener('click', () => handleExport('selected'));
  elements.downloadBtn.addEventListener('click', handleDownload);

  // 绑定搜索事件
  elements.notebookSearch.addEventListener('input', handleNotebookSearch);
  elements.clearNotebookSearch.addEventListener('click', clearNotebookSearch);
  elements.noteSearch.addEventListener('input', handleNoteSearch);
  elements.clearNoteSearch.addEventListener('click', clearNoteSearch);

  // 加载配置
  await loadConfig();
});

// ==================== 搜索功能 ====================

/**
 * 模糊搜索匹配
 * 支持：拼音首字母、部分匹配、忽略大小写
 */
function fuzzyMatch(text, query) {
  if (!query) return { matched: true, score: 0 };

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // 精确包含匹配（得分最高）
  if (lowerText.includes(lowerQuery)) {
    const index = lowerText.indexOf(lowerQuery);
    return {
      matched: true,
      score: 100 - index,
      ranges: [[index, index + query.length]]
    };
  }

  // 模糊匹配：检查查询字符是否按顺序出现在文本中
  let queryIndex = 0;
  let textIndex = 0;
  const ranges = [];
  let currentRange = null;

  while (queryIndex < lowerQuery.length && textIndex < lowerText.length) {
    if (lowerText[textIndex] === lowerQuery[queryIndex]) {
      if (currentRange === null) {
        currentRange = [textIndex, textIndex + 1];
      } else {
        currentRange[1] = textIndex + 1;
      }
      queryIndex++;
    } else if (currentRange !== null) {
      ranges.push(currentRange);
      currentRange = null;
    }
    textIndex++;
  }

  if (currentRange !== null) {
    ranges.push(currentRange);
  }

  if (queryIndex === lowerQuery.length) {
    // 计算得分：连续匹配越多得分越高
    const continuity = ranges.length === 1 ? 50 : Math.max(0, 50 - ranges.length * 10);
    return { matched: true, score: continuity, ranges };
  }

  return { matched: false, score: 0 };
}

/**
 * 高亮匹配文本
 */
function highlightText(text, ranges) {
  if (!ranges || ranges.length === 0) return escapeHtml(text);

  let result = '';
  let lastIndex = 0;

  ranges.forEach(([start, end]) => {
    result += escapeHtml(text.substring(lastIndex, start));
    result += `<span class="highlight">${escapeHtml(text.substring(start, end))}</span>`;
    lastIndex = end;
  });

  result += escapeHtml(text.substring(lastIndex));
  return result;
}

/**
 * 处理笔记本搜索
 */
function handleNotebookSearch() {
  const query = elements.notebookSearch.value.trim();
  state.notebookSearchQuery = query;

  // 显示/隐藏清除按钮
  elements.clearNotebookSearch.classList.toggle('visible', query.length > 0);

  // 过滤笔记本
  filterNotebooks();
  renderNotebooks();
}

function clearNotebookSearch() {
  elements.notebookSearch.value = '';
  state.notebookSearchQuery = '';
  elements.clearNotebookSearch.classList.remove('visible');
  filterNotebooks();
  renderNotebooks();
}

function filterNotebooks() {
  const query = state.notebookSearchQuery;

  if (!query) {
    state.filteredNotebooks = state.notebooks.map(nb => ({
      ...nb,
      matchResult: { matched: true, score: 0 }
    }));
    return;
  }

  state.filteredNotebooks = state.notebooks
    .map(nb => {
      const matchResult = fuzzyMatch(nb.name, query);
      // 也匹配 stack 名称
      const stackMatch = nb.stack ? fuzzyMatch(nb.stack, query) : { matched: false, score: 0 };
      const bestMatch = matchResult.score >= stackMatch.score ? matchResult : stackMatch;
      return { ...nb, matchResult: bestMatch };
    })
    .filter(nb => nb.matchResult.matched)
    .sort((a, b) => b.matchResult.score - a.matchResult.score);
}

/**
 * 处理笔记搜索
 */
function handleNoteSearch() {
  const query = elements.noteSearch.value.trim();
  state.noteSearchQuery = query;

  // 显示/隐藏清除按钮
  elements.clearNoteSearch.classList.toggle('visible', query.length > 0);

  // 过滤笔记
  filterNotes();
  renderNotes();
}

function clearNoteSearch() {
  elements.noteSearch.value = '';
  state.noteSearchQuery = '';
  elements.clearNoteSearch.classList.remove('visible');
  filterNotes();
  renderNotes();
}

function filterNotes() {
  const query = state.noteSearchQuery;

  if (!query) {
    state.filteredNotes = state.notes.map(note => ({
      ...note,
      matchResult: { matched: true, score: 0 }
    }));
    return;
  }

  state.filteredNotes = state.notes
    .map(note => {
      const matchResult = fuzzyMatch(note.title, query);
      return { ...note, matchResult };
    })
    .filter(note => note.matchResult.matched)
    .sort((a, b) => b.matchResult.score - a.matchResult.score);
}

// ==================== 原有功能 ====================

// 加载服务器配置
async function loadConfig() {
  try {
    const response = await fetch('/api/auth/config');
    const data = await response.json();

    if (data.hasConfig) {
      // 服务器有配置，使用服务器配置
      elements.token.value = data.token || '';
      elements.noteStoreUrl.value = data.noteStoreUrl || '';
      elements.configHint.style.display = 'block';
    } else {
      // 尝试从 localStorage 恢复
      const savedToken = localStorage.getItem('yx_token');
      const savedNoteStoreUrl = localStorage.getItem('yx_notestore_url');

      if (savedToken) elements.token.value = savedToken;
      if (savedNoteStoreUrl) elements.noteStoreUrl.value = savedNoteStoreUrl;
    }
  } catch (err) {
    console.error('加载配置失败:', err);
    // 回退到 localStorage
    const savedToken = localStorage.getItem('yx_token');
    const savedNoteStoreUrl = localStorage.getItem('yx_notestore_url');

    if (savedToken) elements.token.value = savedToken;
    if (savedNoteStoreUrl) elements.noteStoreUrl.value = savedNoteStoreUrl;
  }
}

// Tab 切换
function switchTab(tabName) {
  elements.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  elements.tabPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

// 切换 Token 显示/隐藏
function toggleTokenVisibility() {
  const type = elements.token.type === 'password' ? 'text' : 'password';
  elements.token.type = type;
  elements.toggleToken.textContent = type === 'password' ? '👁' : '🙈';
}

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

      // 启用导出 Tab
      elements.exportTab.disabled = false;

      // 切换到导出 Tab
      switchTab('export');

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
  elements.notebookList.innerHTML = '<p class="placeholder">加载中...</p>';

  try {
    const response = await fetch('/api/notebooks', {
      headers: getAuthHeaders()
    });

    const data = await response.json();

    if (data.success) {
      state.notebooks = data.notebooks;
      filterNotebooks();
      renderNotebooks();
    }
  } catch (err) {
    elements.notebookList.innerHTML = '<p class="placeholder">加载失败</p>';
    console.error('加载笔记本失败:', err);
  }
}

// 渲染笔记本列表
function renderNotebooks() {
  const notebooks = state.filteredNotebooks;

  if (state.notebooks.length === 0) {
    elements.notebookList.innerHTML = '<p class="placeholder">没有找到笔记本</p>';
    return;
  }

  if (notebooks.length === 0) {
    elements.notebookList.innerHTML = `<p class="no-results">没有匹配 "${escapeHtml(state.notebookSearchQuery)}" 的笔记本</p>`;
    return;
  }

  // 按 stack 分组
  const stacks = new Map();
  const noStack = [];

  notebooks.forEach(nb => {
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
  stacks.forEach((stackNotebooks, stackName) => {
    html += `<div class="list-item stack-header" style="background: #f0f0f0; font-weight: 500; cursor: default;">${escapeHtml(stackName)}</div>`;
    stackNotebooks.forEach(nb => {
      html += createNotebookItem(nb, true);
    });
  });

  elements.notebookList.innerHTML = html;

  // 绑定点击事件
  elements.notebookList.querySelectorAll('.list-item[data-guid]').forEach(item => {
    item.addEventListener('click', () => handleNotebookClick(item.dataset.guid));
  });
}

function createNotebookItem(notebook, indent = false) {
  const style = indent ? 'padding-left: 28px;' : '';
  const isActive = state.currentNotebook?.guid === notebook.guid;
  const activeClass = isActive ? 'active' : '';
  const titleHtml = highlightText(notebook.name, notebook.matchResult?.ranges);

  return `
    <div class="list-item ${activeClass}" data-guid="${notebook.guid}" style="${style}">
      <span class="title">${titleHtml}</span>
    </div>
  `;
}

// 处理笔记本点击
async function handleNotebookClick(notebookGuid) {
  // 更新选中状态
  elements.notebookList.querySelectorAll('.list-item[data-guid]').forEach(item => {
    item.classList.toggle('active', item.dataset.guid === notebookGuid);
  });

  state.currentNotebook = state.notebooks.find(nb => nb.guid === notebookGuid);
  state.selectedNotes.clear();
  elements.selectAllNotes.checked = false;

  // 清除笔记搜索
  elements.noteSearch.value = '';
  state.noteSearchQuery = '';
  elements.clearNoteSearch.classList.remove('visible');

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
      filterNotes();
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
  const notes = state.filteredNotes;

  if (state.notes.length === 0) {
    elements.noteList.innerHTML = '<p class="placeholder">该笔记本没有笔记</p>';
    return;
  }

  if (notes.length === 0) {
    elements.noteList.innerHTML = `<p class="no-results">没有匹配 "${escapeHtml(state.noteSearchQuery)}" 的笔记</p>`;
    return;
  }

  let html = '';
  notes.forEach(note => {
    const checked = state.selectedNotes.has(note.guid) ? 'checked' : '';
    const date = new Date(note.updated).toLocaleDateString();
    const titleHtml = highlightText(note.title, note.matchResult?.ranges);

    html += `
      <div class="list-item ${checked ? 'selected' : ''}" data-guid="${note.guid}">
        <input type="checkbox" ${checked}>
        <span class="title">${titleHtml}</span>
        <span class="meta">${date}</span>
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

  // 更新全选框状态（基于当前筛选结果）
  const filteredGuids = state.filteredNotes.map(n => n.guid);
  const allFilteredSelected = filteredGuids.every(guid => state.selectedNotes.has(guid));
  elements.selectAllNotes.checked = filteredGuids.length > 0 && allFilteredSelected;

  updateExportButtons();
}

// 全选/取消全选（只针对当前筛选结果）
function handleSelectAll() {
  const checked = elements.selectAllNotes.checked;

  state.filteredNotes.forEach(note => {
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

  elements.progressCard.style.display = 'block';
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
        elements.progressText.textContent = `正在导出 (${completed + 1}/${guids.length}): ${note?.title || guid}`;

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

// ==================== 测试用例 ====================
// 可在浏览器控制台运行：testFuzzyMatch()
window.testFuzzyMatch = function() {
  const testCases = [
    { text: '工作笔记', query: '工作', expected: true },
    { text: '工作笔记', query: '笔记', expected: true },
    { text: '工作笔记', query: '工笔', expected: true },
    { text: '工作笔记', query: 'gzb', expected: false }, // 不支持拼音
    { text: 'My Notes', query: 'note', expected: true },
    { text: 'My Notes', query: 'mn', expected: true },
    { text: 'Project 2024', query: '2024', expected: true },
    { text: 'Hello World', query: 'hw', expected: true },
    { text: 'Hello World', query: 'xyz', expected: false },
    { text: '测试文档', query: '测文', expected: true },
    { text: '测试文档', query: '', expected: true }, // 空查询匹配所有
  ];

  console.log('=== 模糊搜索测试 ===');
  let passed = 0;
  let failed = 0;

  testCases.forEach(({ text, query, expected }) => {
    const result = fuzzyMatch(text, query);
    const success = result.matched === expected;

    if (success) {
      console.log(`✓ "${text}" + "${query}" => ${result.matched} (score: ${result.score})`);
      passed++;
    } else {
      console.error(`✗ "${text}" + "${query}" => ${result.matched}, expected: ${expected}`);
      failed++;
    }
  });

  console.log(`\n总计: ${passed} 通过, ${failed} 失败`);
  return { passed, failed };
};
