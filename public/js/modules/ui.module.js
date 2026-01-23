/**
 * UI 模块
 * 处理 UI 交互和 Tab 切换
 */

const UIModule = (function() {
  const elements = {};

  /**
   * 初始化
   */
  function init() {
    cacheElements();
    bindEvents();
    updateActiveTab();
  }

  /**
   * 缓存 DOM 元素
   */
  function cacheElements() {
    elements.tabBtns = document.querySelectorAll('.tab-btn');
    elements.tabPanels = document.querySelectorAll('.tab-panel');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  /**
   * 切换 Tab
   * @param {string} tabName - Tab 名称
   */
  function switchTab(tabName) {
    // 更新按钮状态
    elements.tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // 更新面板状态
    elements.tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });

    // 更新状态
    if (StateManager) {
      StateManager.setState('ui.activeTab', tabName);
    }
  }

  /**
   * 更新当前激活的 Tab
   */
  function updateActiveTab() {
    const activeTab = StateManager?.getState?.('ui.activeTab') || 'config';
    switchTab(activeTab);
  }

  /**
   * 启用 Tab
   * @param {string} tabName - Tab 名称
   */
  function enableTab(tabName) {
    const tab = document.querySelector(`[data-tab="${tabName}"]`);
    if (tab) {
      tab.disabled = false;
    }
  }

  /**
   * 禁用 Tab
   * @param {string} tabName - Tab 名称
   */
  function disableTab(tabName) {
    const tab = document.querySelector(`[data-tab="${tabName}"]`);
    if (tab) {
      tab.disabled = true;
    }
  }

  /**
   * 显示状态消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型
   * @param {Element} targetElement - 目标元素（可选）
   */
  function showStatus(message, type = 'info', targetElement = null) {
    const statusElement = targetElement || document.getElementById('statusMessage');

    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status ${type}`;
      statusElement.style.display = 'block';

      // 自动隐藏成功消息
      if (type === 'success') {
        setTimeout(() => {
          statusElement.style.display = 'none';
        }, 3000);
      }
    }
  }

  /**
   * 显示加载状态
   * @param {Element} element - 目标元素
   * @param {boolean} loading - 是否加载中
   */
  function setLoading(element, loading) {
    if (!element) return;

    if (loading) {
      element.disabled = true;
      element.dataset.originalText = element.textContent;
      element.textContent = '加载中...';
    } else {
      element.disabled = false;
      if (element.dataset.originalText) {
        element.textContent = element.dataset.originalText;
        delete element.dataset.originalText;
      }
    }
  }

  /**
   * 显示确认对话框
   * @param {string} message - 消息内容
   * @returns {boolean} 用户选择
   */
  function confirm(message) {
    return window.confirm(message);
  }

  /**
   * 显示提示
   * @param {string} message - 消息内容
   */
  function alert(message) {
    window.alert(message);
  }

  /**
   * 更新进度条
   * @param {number} percent - 百分比
   * @param {string} text - 进度文本
   */
  function updateProgress(percent, text) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (progressFill) {
      progressFill.style.width = `${percent}%`;
    }

    if (progressText) {
      progressText.textContent = text;
    }
  }

  /**
   * 显示/隐藏元素
   * @param {Element} element - 元素
   * @param {boolean} visible - 是否可见
   */
  function setVisible(element, visible) {
    if (!element) return;

    if (visible) {
      element.style.display = '';
    } else {
      element.style.display = 'none';
    }
  }

  return {
    init,
    switchTab,
    enableTab,
    disableTab,
    showStatus,
    setLoading,
    confirm,
    alert,
    updateProgress,
    setVisible
  };
})();
