/**
 * 设置模块
 * 处理设置面板，包括认证配置和服务器配置
 */

const SettingsModule = (function() {
  const elements = {};
  let config = null;
  let showToken = false;

  /**
   * 初始化
   */
  function init() {
    cacheElements();
    bindEvents();
    loadConfig();
  }

  /**
   * 缓存 DOM 元素
   */
  function cacheElements() {
    elements.settingsBar = document.getElementById('settingsBar');
    elements.settingsTrigger = document.getElementById('settingsTrigger');
    elements.settingsPanel = document.getElementById('settingsPanel');
    elements.settingsClose = document.getElementById('settingsClose');
    elements.settingsContent = document.getElementById('settingsContent');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    if (elements.settingsTrigger) {
      elements.settingsTrigger.addEventListener('click', toggleSettings);
    }

    if (elements.settingsClose) {
      elements.settingsClose.addEventListener('click', closeSettings);
    }

    // 点击外部关闭设置面板
    document.addEventListener('click', (e) => {
      if (elements.settingsPanel && elements.settingsPanel.classList.contains('active')) {
        if (!elements.settingsBar.contains(e.target)) {
          closeSettings();
        }
      }
    });

    // 监听配置变化事件
    document.addEventListener('config:updated', loadConfig);
  }

  /**
   * 切换设置面板显示
   */
  function toggleSettings() {
    if (elements.settingsPanel) {
      elements.settingsPanel.classList.toggle('active');
    }
  }

  /**
   * 关闭设置面板
   */
  function closeSettings() {
    if (elements.settingsPanel) {
      elements.settingsPanel.classList.remove('active');
    }
  }

  /**
   * 加载配置
   */
  async function loadConfig() {
    if (!elements.settingsContent) return;

    elements.settingsContent.innerHTML = '<p class="settings-loading">加载中...</p>';

    try {
      const data = await API.auth.getConfig();

      if (data.success) {
        config = data.data;
        renderSettings();
      }
    } catch (err) {
      console.error('加载配置失败:', err);
      renderSettings();
    }
  }

  /**
   * 渲染设置面板
   */
  function renderSettings() {
    if (!elements.settingsContent) return;

    const hasConfig = config?.hasConfig || false;
    const tokenConfigured = !!(config?.token);
    const noteStoreUrlConfigured = !!(config?.noteStoreUrl);

    let html = '';

    // 认证配置区域
    html += `
      <div class="settings-section">
        <h3 class="settings-section-title">认证配置</h3>

        ${!hasConfig ? renderGuideSection() : ''}

        <div class="settings-auth-config">
          <div class="form-group">
            <label for="settingsToken">Developer Token</label>
            <div class="input-with-toggle">
              <input
                type="${showToken ? 'text' : 'password'}"
                id="settingsToken"
                placeholder="粘贴您的 Developer Token"
                class="form-control"
                value="${hasConfig ? (config.token || '') : ''}"
              >
              <button type="button" id="settingsToggleToken" class="toggle-btn" title="显示/隐藏">
                ${showToken ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="settingsNoteStoreUrl">NoteStore URL</label>
            <input
              type="text"
              id="settingsNoteStoreUrl"
              placeholder="https://app.yinxiang.com/shard/s1/notestore"
              class="form-control"
              value="${hasConfig ? (config.noteStoreUrl || '') : ''}"
            >
          </div>

          <div class="form-actions">
            <button id="settingsVerifyBtn" class="btn btn-primary btn-block">
              ${hasConfig ? '更新并验证' : '验证并连接'}
            </button>
          </div>

          <div id="settingsAuthStatus" class="status"></div>
        </div>
      </div>
    `;

    // 服务器配置区域
    html += `
      <div class="settings-section">
        <h3 class="settings-section-title">服务器信息</h3>

        <div class="settings-status ${hasConfig ? 'configured' : 'not-configured'}">
          <span class="settings-status-dot"></span>
          <span>${hasConfig ? '已配置服务器环境变量' : '未配置服务器环境变量'}</span>
        </div>

        <div class="settings-item">
          <div class="settings-item-label">服务端口</div>
          <div class="settings-item-value">
            ${window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}
          </div>
        </div>

        <div class="settings-item">
          <div class="settings-item-label">运行环境</div>
          <div class="settings-item-value">
            ${window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'development' : 'production'}
          </div>
        </div>
      </div>
    `;

    elements.settingsContent.innerHTML = html;

    // 绑定认证配置相关事件
    bindAuthConfigEvents();

    // 如果已配置，自动启用导出和整理Tab
    if (hasConfig && tokenConfigured && noteStoreUrlConfigured) {
      autoEnableTabs();
    }
  }

  /**
   * 渲染引导区域
   */
  function renderGuideSection() {
    return `
      <div class="settings-guide">
        <h4>如何获取 Developer Token？</h4>
        <ol class="settings-guide-steps">
          <li>登录印象笔记网页版</li>
          <li>访问 <a href="https://app.yinxiang.com/api/DeveloperToken.action" target="_blank" rel="noopener">Developer Token 页面</a></li>
          <li>点击 "Create a developer token" 按钮</li>
          <li>复制生成的 <strong>Developer Token</strong> 和 <strong>NoteStore URL</strong></li>
        </ol>
        <div class="settings-guide-warning">
          <strong>注意：</strong>请妥善保管您的 Token，不要泄露给他人。
        </div>
      </div>
    `;
  }

  /**
   * 绑定认证配置相关事件
   */
  function bindAuthConfigEvents() {
    const toggleBtn = document.getElementById('settingsToggleToken');
    const verifyBtn = document.getElementById('settingsVerifyBtn');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTokenVisibility);
    }

    if (verifyBtn) {
      verifyBtn.addEventListener('click', handleVerify);
    }
  }

  /**
   * 切换 Token 显示/隐藏
   */
  function toggleTokenVisibility() {
    showToken = !showToken;
    const tokenInput = document.getElementById('settingsToken');
    const toggleBtn = document.getElementById('settingsToggleToken');

    if (tokenInput) {
      tokenInput.type = showToken ? 'text' : 'password';
    }

    if (toggleBtn) {
      toggleBtn.textContent = showToken ? '🙈' : '👁';
    }
  }

  /**
   * 处理 Token 验证
   */
  async function handleVerify() {
    const tokenInput = document.getElementById('settingsToken');
    const noteStoreUrlInput = document.getElementById('settingsNoteStoreUrl');
    const statusEl = document.getElementById('settingsAuthStatus');
    const verifyBtn = document.getElementById('settingsVerifyBtn');

    const token = tokenInput?.value?.trim() || '';
    const noteStoreUrl = noteStoreUrlInput?.value?.trim() || '';

    if (!token || !noteStoreUrl) {
      showAuthStatus('请填写 Token 和 NoteStore URL', 'error');
      return;
    }

    showAuthStatus('验证中...', 'loading');
    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = '验证中...';
    }

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

      showAuthStatus(`验证成功，欢迎 ${data.data.user.name || data.data.user.username}`, 'success');

      // 启用其他 Tab
      if (UIModule) {
        UIModule.enableTab('export');
        UIModule.enableTab('organize');
      }

      // 触发验证成功事件
      document.dispatchEvent(new CustomEvent('auth:success', { detail: data.data.user }));

      // 延迟关闭设置面板
      setTimeout(() => {
        closeSettings();
      }, 1500);

    } catch (err) {
      showAuthStatus('验证失败: ' + err.message, 'error');

      // 触发验证失败事件
      document.dispatchEvent(new CustomEvent('auth:error', { detail: { error: err.message } }));

    } finally {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = '验证并连接';
      }
    }
  }

  /**
   * 显示认证状态消息
   */
  function showAuthStatus(message, type) {
    const statusEl = document.getElementById('settingsAuthStatus');
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = `status ${type}`;
    }
  }

  /**
   * 自动启用导出和整理Tab
   */
  function autoEnableTabs() {
    if (typeof UIModule !== 'undefined') {
      UIModule.enableTab('export');
      UIModule.enableTab('organize');

      // 自动设置认证状态
      if (typeof StateManager !== 'undefined' && config) {
        StateManager.setState('auth.token', config.token);
        StateManager.setState('auth.noteStoreUrl', config.noteStoreUrl);
        StateManager.setState('auth.authenticated', true);

        // 触发认证成功事件
        document.dispatchEvent(new CustomEvent('auth:autoconfigured', {
          detail: { fromEnv: true }
        }));
      }
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

  /**
   * 刷新配置
   */
  function refresh() {
    loadConfig();
  }

  return {
    init,
    refresh,
    toggleSettings,
    closeSettings
  };
})();
