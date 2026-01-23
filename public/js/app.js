/**
 * 印象笔记导出工具 - 主入口文件
 * 模块化架构
 */

(function() {
  'use strict';

  /**
   * 应用初始化
   */
  async function init() {
    console.log('Initializing application...');

    try {
      // 1. 初始化状态管理
      if (typeof StateManager !== 'undefined') {
        StateManager.loadState();
      }

      // 2. 初始化 UI 模块
      if (typeof UIModule !== 'undefined') {
        UIModule.init();
      }

      // 3. 初始化设置模块（包含认证配置）
      if (typeof SettingsModule !== 'undefined') {
        SettingsModule.init();
      }

      // 4. 初始化导出模块
      if (typeof ExportModule !== 'undefined') {
        ExportModule.init();
      }

      // 5. 初始化整理模块
      if (typeof OrganizeModule !== 'undefined') {
        OrganizeModule.init();
      }

      // 6. 监听认证成功事件（手动配置时）
      document.addEventListener('auth:success', handleAuthSuccess);

      // 7. 监听自动配置事件（.env配置时）
      document.addEventListener('auth:autoconfigured', handleAutoConfigured);

      // 8. 监听认证失败事件
      document.addEventListener('auth:error', handleAuthError);

      console.log('Application initialized successfully');
    } catch (err) {
      console.error('Failed to initialize application:', err);
    }
  }

  /**
   * 处理认证成功
   */
  function handleAuthSuccess(e) {
    console.log('Authentication successful:', e.detail);

    // 刷新设置模块显示
    if (typeof SettingsModule !== 'undefined') {
      SettingsModule.refresh();
    }

    // 启用导出和整理 Tab
    if (typeof UIModule !== 'undefined') {
      UIModule.enableTab('export');
      UIModule.enableTab('organize');
    }

    // 移除自动加载笔记本，改为用户手动触发
    // if (typeof ExportModule !== 'undefined') {
    //   ExportModule.loadNotebooks();
    // }
  }

  /**
   * 处理自动配置（从.env读取）
   */
  function handleAutoConfigured(e) {
    console.log('Auto-configured from .env:', e.detail);

    // 设置模块已经处理了认证状态，这里只需要刷新显示
    // 移除自动加载笔记本，改为用户手动触发
    // if (typeof ExportModule !== 'undefined') {
    //   ExportModule.loadNotebooks();
    // }
  }

  /**
   * 处理认证失败
   */
  function handleAuthError(e) {
    console.error('Authentication failed:', e.detail);
  }

  /**
   * DOM 加载完成后初始化
   */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 全局错误处理
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
  });

})();
