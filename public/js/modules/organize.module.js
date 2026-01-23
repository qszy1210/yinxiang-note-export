/**
 * 整理模块
 * 处理标签管理和整理功能
 */

const OrganizeModule = (function() {
  const elements = {};
  let searchQuery = '';

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
    elements.loadBtn = document.getElementById('loadTagsBtn');
    elements.findEmptyBtn = document.getElementById('findEmptyTagsBtn');
    elements.deleteBtn = document.getElementById('deleteSelectedTagsBtn');
    elements.search = document.getElementById('tagSearch');
    elements.clearSearch = document.getElementById('clearTagSearch');
    elements.tagList = document.getElementById('tagList');
    elements.selectionInfo = document.getElementById('tagSelectionInfo');
    elements.selectAllTags = document.getElementById('selectAllTags');
    elements.tagsErrorMsg = document.getElementById('tagsErrorMsg');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    if (elements.loadBtn) {
      elements.loadBtn.addEventListener('click', loadTags);
    }

    if (elements.findEmptyBtn) {
      elements.findEmptyBtn.addEventListener('click', findEmptyTags);
    }

    if (elements.deleteBtn) {
      elements.deleteBtn.addEventListener('click', deleteSelectedTags);
    }

    if (elements.search) {
      elements.search.addEventListener('input', handleSearch);
    }

    if (elements.clearSearch) {
      elements.clearSearch.addEventListener('click', clearSearch);
    }

    if (elements.selectAllTags) {
      elements.selectAllTags.addEventListener('change', handleSelectAll);
    }
  }

  /**
   * 加载所有标签
   */
  async function loadTags() {
    if (!elements.loadBtn || !elements.tagList) return;

    elements.loadBtn.disabled = true;
    elements.loadBtn.textContent = '加载中...';
    elements.tagList.innerHTML = '<p class="placeholder">加载中...</p>';

    try {
      const data = await API.tags.list();

      if (data.success) {
        if (StateManager) {
          StateManager.setState('organize.tags', data.data.tags);
        }

        renderTags();

        elements.loadBtn.textContent = '刷新标签';
      }
    } catch (err) {
      console.error('加载标签失败:', err);
      elements.tagList.innerHTML = '<p class="placeholder">加载失败</p>';

      // 更友好的错误提示
      let errorMsg = '加载失败: ' + err.message;
      if (err.message.includes('RATE_LIMIT_REACHED') || err.message.includes('限流')) {
        errorMsg = '请求过于频繁，请稍后再试（印象笔记 API 限制）';
      }
      showStatus(errorMsg, 'error');

      // 恢复按钮文本
      elements.loadBtn.textContent = '刷新标签';
    } finally {
      elements.loadBtn.disabled = false;
    }
  }

  /**
   * 查找空标签
   */
  async function findEmptyTags() {
    if (!elements.findEmptyBtn) return;

    // 添加确认对话框，警告用户 API 限流风险
    const confirmed = confirm(
      '⚠️ 警告：此功能需要逐个检查每个标签的使用情况。\n\n' +
      '如果您有大量标签，可能会触发 Evernote API 限流（RATE_LIMIT_REACHED）。\n\n' +
      '建议：仅在确实需要清理空标签时使用此功能。\n\n' +
      '是否继续？'
    );

    if (!confirmed) return;

    elements.findEmptyBtn.disabled = true;
    elements.findEmptyBtn.textContent = '查找中...';

    try {
      const data = await API.tags.findEmpty();

      if (data.success) {
        if (StateManager) {
          StateManager.setState('organize.tags', data.data.tags);
        }

        renderTags();

        showStatus(`找到 ${data.data.count} 个空标签`, 'success');
      }
    } catch (err) {
      console.error('查找空标签失败:', err);
      showStatus('查找失败: ' + err.message, 'error');
    } finally {
      elements.findEmptyBtn.disabled = false;
      elements.findEmptyBtn.textContent = '查找空标签';
    }
  }

  /**
   * 渲染标签列表
   */
  function renderTags() {
    const tags = StateManager?.getState?.('organize.tags') || [];
    const selected = StateManager?.getState?.('organize.selectedTags') || [];

    // 过滤标签
    const filtered = tags.filter(tag =>
      tag.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filtered.length === 0) {
      elements.tagList.innerHTML = searchQuery
        ? `<p class="no-results">没有匹配 "${escapeHtml(searchQuery)}" 的标签</p>`
        : '<p class="placeholder">点击"加载标签"开始</p>';
      return;
    }

    let html = '';
    filtered.forEach(tag => {
      const checked = selected.includes(tag.guid) ? 'checked' : '';
      const selectedClass = checked ? 'selected' : '';

      html += `
        <div class="list-item ${selectedClass}" data-guid="${tag.guid}">
          <input type="checkbox" ${checked}>
          <span class="title">${escapeHtml(tag.name)}</span>
        </div>
      `;
    });

    elements.tagList.innerHTML = html;

    // 绑定事件
    elements.tagList.querySelectorAll('.list-item[data-guid]').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          const checkbox = item.querySelector('input');
          checkbox.checked = !checkbox.checked;
        }
        toggleTagSelection(item.dataset.guid, item.querySelector('input').checked);
      });
    });

    updateUI();
  }

  /**
   * 切换标签选择
   */
  function toggleTagSelection(guid, checked) {
    let selected = StateManager?.getState?.('organize.selectedTags') || [];

    if (checked) {
      if (!selected.includes(guid)) {
        selected.push(guid);
      }
    } else {
      selected = selected.filter(g => g !== guid);
    }

    if (StateManager) {
      StateManager.setState('organize.selectedTags', selected);
    }

    // 更新 UI
    const item = elements.tagList.querySelector(`[data-guid="${guid}"]`);
    if (item) {
      item.classList.toggle('selected', checked);
    }

    // 更新全选框
    updateSelectAllState();
    updateUI();
  }

  /**
   * 全选/取消全选
   */
  function handleSelectAll() {
    const tags = StateManager?.getState?.('organize.tags') || [];
    const checked = elements.selectAllTags.checked;
    let selected = StateManager?.getState?.('organize.selectedTags') || [];

    tags.forEach(tag => {
      if (checked) {
        if (!selected.includes(tag.guid)) {
          selected.push(tag.guid);
        }
      } else {
        selected = selected.filter(g => g !== tag.guid);
      }
    });

    if (StateManager) {
      StateManager.setState('organize.selectedTags', selected);
    }

    renderTags();
  }

  /**
   * 更新全选框状态
   */
  function updateSelectAllState() {
    const tags = StateManager?.getState?.('organize.tags') || [];
    const selected = StateManager?.getState?.('organize.selectedTags') || [];

    if (elements.selectAllTags) {
      elements.selectAllTags.checked = tags.length > 0 && tags.every(tag => selected.includes(tag.guid));
    }
  }

  /**
   * 更新 UI
   */
  function updateUI() {
    const selected = StateManager?.getState?.('organize.selectedTags') || [];

    // 更新删除按钮
    if (elements.deleteBtn) {
      elements.deleteBtn.disabled = selected.length === 0;
    }

    // 更新选择信息
    if (elements.selectionInfo) {
      elements.selectionInfo.textContent = selected.length > 0
        ? `已选择 ${selected.length} 个标签`
        : '';
    }
  }

  /**
   * 删除选中的标签
   */
  async function deleteSelectedTags() {
    const selected = StateManager?.getState?.('organize.selectedTags') || [];

    if (selected.length === 0) return;

    const confirmed = confirm(`确定要删除选中的 ${selected.length} 个标签吗？此操作不可撤销。`);

    if (!confirmed) return;

    if (elements.deleteBtn) {
      elements.deleteBtn.disabled = true;
      elements.deleteBtn.textContent = '删除中...';
    }

    try {
      const data = await API.tags.delete(selected);

      if (data.success) {
        showStatus(data.message, 'success');

        // 清除选择并刷新
        if (StateManager) {
          StateManager.setState('organize.selectedTags', []);
        }

        await loadTags();
      }
    } catch (err) {
      console.error('删除标签失败:', err);
      showStatus('删除失败: ' + err.message, 'error');
    } finally {
      if (elements.deleteBtn) {
        elements.deleteBtn.disabled = false;
        elements.deleteBtn.textContent = '删除选中标签';
      }
    }
  }

  /**
   * 处理搜索
   */
  function handleSearch(e) {
    searchQuery = e.target.value;

    if (elements.clearSearch) {
      elements.clearSearch.classList.toggle('visible', searchQuery.length > 0);
    }

    renderTags();
  }

  /**
   * 清除搜索
   */
  function clearSearch() {
    if (elements.search) {
      elements.search.value = '';
    }

    searchQuery = '';

    if (elements.clearSearch) {
      elements.clearSearch.classList.remove('visible');
    }

    renderTags();
  }

  /**
   * 显示状态消息
   */
  function showStatus(message, type) {
    // 在选择信息区域显示（用于操作反馈）
    if (elements.selectionInfo) {
      elements.selectionInfo.textContent = message;
      elements.selectionInfo.className = `selection-summary ${type}`;

      // 3秒后自动清除
      setTimeout(() => {
        if (elements.selectionInfo.textContent === message) {
          elements.selectionInfo.textContent = '';
          elements.selectionInfo.className = 'selection-summary';
        }
      }, 3000);
    }

    // 同时在专门的错误区域显示（用于加载错误）
    if (elements.tagsErrorMsg && type === 'error') {
      elements.tagsErrorMsg.textContent = message;
      elements.tagsErrorMsg.className = `error-message show ${type}`;

      // 5秒后自动隐藏
      setTimeout(() => {
        if (elements.tagsErrorMsg) {
          elements.tagsErrorMsg.classList.remove('show');
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
    init
  };
})();
