/**
 * API 模块
 * 封装所有 API 请求
 */

const API = (function() {
  const BASE_URL = '/api';

  /**
   * 发送请求
   * @param {string} endpoint - API 端点
   * @param {object} options - 请求选项
   * @returns {Promise} 响应数据
   */
  async function request(endpoint, options = {}) {
    let url = BASE_URL + endpoint;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // 获取认证信息
    const token = StateManager?.getState?.('auth.token');
    const noteStoreUrl = StateManager?.getState?.('auth.noteStoreUrl');

    // 将认证信息从 headers 移到请求体或查询参数中
    // 避免 HTTP Headers 编码问题（headers 必须只包含 ISO-8859-1 字符）
    if (token) {
      if (options.method === 'POST' || options.method === 'PUT' || options.method === 'PATCH') {
        // 对于 POST/PUT/PATCH 请求，将认证信息放在请求体中
        let body = options.body;
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
        body = body || {};
        body.token = token;
        body.noteStoreUrl = noteStoreUrl;
        options.body = JSON.stringify(body);
      } else {
        // 对于 GET 请求，将认证信息放在查询参数中
        const urlObj = new URL(url, window.location.origin);
        urlObj.searchParams.set('token', token);
        if (noteStoreUrl) {
          urlObj.searchParams.set('noteStoreUrl', noteStoreUrl);
        }
        url = urlObj.pathname + urlObj.search;
      }
    }

    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '请求失败');
      }

      return await response.json();
    } catch (err) {
      console.error('API request failed:', err);
      throw err;
    }
  }

  return {
    // 认证
    auth: {
      verify: (token, noteStoreUrl) =>
        request('/auth/verify', {
          method: 'POST',
          body: JSON.stringify({ token, noteStoreUrl })
        }),
      getConfig: () => request('/auth/config')
    },

    // 笔记本
    notebooks: {
      list: () => request('/notebooks'),
      getNotes: (guid) => request(`/notebooks/${guid}/notes`),
      get: (guid) => request(`/notebooks/${guid}`)
    },

    // 笔记
    notes: {
      get: (guid) => request(`/notes/${guid}`)
    },

    // 导出
    export: {
      note: (guid, imageFormat) =>
        request(`/export/note/${guid}`, {
          method: 'POST',
          body: JSON.stringify({ imageFormat })
        }),
      notebook: (guid, imageFormat) =>
        request(`/export/notebook/${guid}`, {
          method: 'POST',
          body: JSON.stringify({ imageFormat })
        }),
      // 多笔记本批量导出（新增）
      batch: (notebookGuids, imageFormat) =>
        request('/export/batch', {
          method: 'POST',
          body: JSON.stringify({ notebookGuids, imageFormat })
        }),
      // 获取任务进度（新增）
      getProgress: (taskId) => request(`/export/progress/${taskId}`),
      download: (path) => {
        window.location.href = `/api/export/download?path=${encodeURIComponent(path)}`;
      }
    },

    // 标签
    tags: {
      list: () => request('/tags'),
      delete: (tagGuids) =>
        request('/tags/delete', {
          method: 'POST',
          body: JSON.stringify({ tagGuids })
        }),
      findEmpty: () => request('/tags/empty'),
      getStats: () => request('/tags/stats')
    }
  };
})();
