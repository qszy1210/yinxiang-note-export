/**
 * 配置模块
 * 处理认证配置和 Token 验证
 */

const ConfigModule = (function() {
  const elements = {};

  /**
   * 初始化
   */
  function init() {
    cacheElements();
    bindEvents();
    loadInitialConfig();
  }

  /**
   * 缓存 DOM 元素
   */
  function cacheElements() {
    elements.token = document.getElementById('token');
    elements.noteStoreUrl = document.getElementById('noteStoreUrl');
    elements.toggleToken = document.getElementById('toggleToken');
    elements.verifyBtn = document.getElementById('verifyBtn');
    elements.authStatus = document.getElementById('authStatus');
    elements.configHint = document.getElementById('configHint');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    if (elements.toggleToken) {
      elements.toggleToken.addEventListener('click', toggleTokenVisibility);
    }

    if (elements.verifyBtn) {
      elements.verifyBtn.addEventListener('click', handleVerify);
    }
  }

  /**
   * 加载初始配置
   */
  async function loadInitialConfig() {
    try {
      // 从服务器加载配置
      const data = await API.auth.getConfig();

      if (data.hasConfig) {
        elements.token.value = data.token || '';
        elements.noteStoreUrl.value = data.noteStoreUrl || '';

        if (elements.configHint) {
          elements.configHint.style.display = 'block';
        }

        showStatus('已从服务器加载配置', 'success');
      }
    } catch (err) {
      console.error('加载服务器配置失败:', err);
    }

    // 从状态恢复
    if (StateManager) {
      StateManager.loadState();

      const savedToken = StateManager.getState('auth.token');
      const savedNoteStoreUrl = StateManager.getState('auth.noteStoreUrl');

      if (savedToken && !elements.token.value) {
        elements.token.value = savedToken;
      }

      if (savedNoteStoreUrl && !elements.noteStoreUrl.value) {
        elements.noteStoreUrl.value = savedNoteStoreUrl;
      }
    }
  }

  /**
   * 切换 Token 显示/隐藏
   */
  function toggleTokenVisibility() {
    const type = elements.token.type === 'password' ? 'text' : 'password';
    elements.token.type = type;
    elements.toggleToken.textContent = type === 'password' ? '👁' : '🙈';
  }

  /**
   * 处理 Token 验证
   */
  async function handleVerify() {
    const token = elements.token.value.trim();
    const noteStoreUrl = elements.noteStoreUrl.value.trim();

    if (!token || !noteStoreUrl) {
      showStatus('请填写 Token 和 NoteStore URL', 'error');
      return;
    }

    showStatus('验证中...', 'loading');
    UIModule?.setLoading(elements.verifyBtn, true);

    try {
      const data = await API.auth.verify(token, noteStoreUrl);

      // 更新状态
      if (StateManager) {
        StateManager.setState('auth.token', token);
        StateManager.setState('auth.noteStoreUrl', noteStoreUrl);
        StateManager.setState('auth.authenticated', true);
        StateManager.setState('auth.user', data.data.user);
        StateManager.saveState();
      }

      showStatus(`验证成功，欢迎 ${data.data.user.name || data.data.user.username}`, 'success');

      // 启用其他 Tab
      if (UIModule) {
        UIModule.enableTab('export');
        UIModule.enableTab('organize');

        // 切换到导出 Tab
        setTimeout(() => UIModule.switchTab('export'), 500);
      }

      // 触发验证成功事件
      document.dispatchEvent(new CustomEvent('auth:success', { detail: data.data.user }));

    } catch (err) {
      showStatus('验证失败: ' + err.message, 'error');

      // 触发验证失败事件
      document.dispatchEvent(new CustomEvent('auth:error', { detail: { error: err.message } }));

    } finally {
      UIModule?.setLoading(elements.verifyBtn, false);
    }
  }

  /**
   * 显示状态消息
   */
  function showStatus(message, type) {
    if (elements.authStatus) {
      elements.authStatus.textContent = message;
      elements.authStatus.className = `status ${type}`;
    }
  }

  /**
   * 清除配置
   */
  function clearConfig() {
    elements.token.value = '';
    elements.noteStoreUrl.value = '';

    if (elements.configHint) {
      elements.configHint.style.display = 'none';
    }

    if (StateManager) {
      StateManager.setState('auth.token', '');
      StateManager.setState('auth.noteStoreUrl', '');
      StateManager.setState('auth.authenticated', false);
      StateManager.clearState();
    }
  }

  return {
    init,
    handleVerify,
    clearConfig
  };
})();
