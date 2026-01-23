/**
 * 状态管理模块
 * 提供全局状态管理和订阅机制
 */

const StateManager = (function() {
  const STATE_KEY = 'yx_app_state';

  // 初始状态
  let state = {
    auth: {
      token: '',
      noteStoreUrl: '',
      authenticated: false,
      user: null
    },
    export: {
      notebooks: [],
      selectedNotebooks: [],
      notes: [],
      selectedNotes: [],
      currentNotebook: null
    },
    organize: {
      tags: [],
      selectedTags: []
    },
    ui: {
      activeTab: 'config',
      theme: 'light'
    }
  };

  // 订阅者列表
  const listeners = new Map();

  /**
   * 设置状态
   * @param {string} path - 状态路径（如 'auth.token'）
   * @param {*} value - 新值
   */
  function setState(path, value) {
    const keys = path.split('.');
    let obj = state;

    // 导航到父对象
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }

    // 设置值
    const lastKey = keys[keys.length - 1];
    const oldValue = obj[lastKey];
    obj[lastKey] = value;

    // 只有当值真正改变时才通知
    if (oldValue !== value) {
      notifyChange(path, value);
    }
  }

  /**
   * 获取状态
   * @param {string} path - 状态路径（可选）
   * @returns {*} 状态值
   */
  function getState(path) {
    if (!path) return state;

    const keys = path.split('.');
    let obj = state;

    for (const key of keys) {
      if (obj && typeof obj === 'object') {
        obj = obj[key];
      } else {
        return undefined;
      }
    }

    return obj;
  }

  /**
   * 订阅状态变化
   * @param {string} path - 状态路径
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   */
  function subscribe(path, callback) {
    if (!listeners.has(path)) {
      listeners.set(path, []);
    }
    listeners.get(path).push(callback);

    // 返回取消订阅函数
    return () => {
      const subs = listeners.get(path);
      if (subs) {
        const index = subs.indexOf(callback);
        if (index > -1) {
          subs.splice(index, 1);
        }
      }
    };
  }

  /**
   * 通知状态变化
   * @param {string} path - 状态路径
   * @param {*} value - 新值
   */
  function notifyChange(path, value) {
    // 通知精确路径订阅者
    if (listeners.has(path)) {
      listeners.get(path).forEach(cb => {
        try {
          cb(value);
        } catch (err) {
          console.error('State listener error:', err);
        }
      });
    }

    // 通知父路径订阅者
    const parts = path.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const parentPath = parts.slice(0, i).join('.');
      if (listeners.has(parentPath)) {
        const parentValue = getState(parentPath);
        listeners.get(parentPath).forEach(cb => {
          try {
            cb(parentValue);
          } catch (err) {
            console.error('State listener error:', err);
          }
        });
      }
    }
  }

  /**
   * 保存状态到 localStorage
   */
  function saveState() {
    try {
      const toSave = {
        auth: {
          token: state.auth.token,
          noteStoreUrl: state.auth.noteStoreUrl
        },
        ui: {
          theme: state.ui.theme
        }
      };
      localStorage.setItem(STATE_KEY, JSON.stringify(toSave));
    } catch (err) {
      console.error('Failed to save state:', err);
    }
  }

  /**
   * 从 localStorage 加载状态
   */
  function loadState() {
    try {
      const saved = localStorage.getItem(STATE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);

        // 合并保存的状态
        if (parsed.auth) {
          Object.assign(state.auth, parsed.auth);
        }
        if (parsed.ui) {
          Object.assign(state.ui, parsed.ui);
        }
      }
    } catch (err) {
      console.error('Failed to load state:', err);
    }
  }

  /**
   * 清除保存的状态
   */
  function clearState() {
    try {
      localStorage.removeItem(STATE_KEY);
    } catch (err) {
      console.error('Failed to clear state:', err);
    }
  }

  /**
   * 重置状态
   */
  function resetState() {
    state = {
      auth: {
        token: '',
        noteStoreUrl: '',
        authenticated: false,
        user: null
      },
      export: {
        notebooks: [],
        selectedNotebooks: [],
        notes: [],
        selectedNotes: [],
        currentNotebook: null
      },
      organize: {
        tags: [],
        selectedTags: []
      },
      ui: {
        activeTab: 'config',
        theme: 'light'
      }
    };
    clearState();
  }

  return {
    setState,
    getState,
    subscribe,
    saveState,
    loadState,
    clearState,
    resetState
  };
})();
