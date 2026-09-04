(function apiClientFactory(globalScope) {
  'use strict';

  function csrfToken() {
    const cookie = globalScope.document?.cookie || '';
    const match = cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  async function request(path, options = {}) {
    const response = await globalScope.fetch(path, {
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...options.headers }
    });
    let body = null;
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(body?.error?.code || 'request_failed');
      error.status = response.status;
      error.code = body?.error?.code || 'request_failed';
      throw error;
    }
    return body?.data || null;
  }

  function post(path, payload) {
    const token = csrfToken();
    if (!token) {
      const error = new Error('csrf_missing');
      error.code = 'csrf_missing';
      return Promise.reject(error);
    }
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token },
      body: JSON.stringify(payload)
    });
  }

  const api = {
    session: () => request('/api/v1/session/'),
    login: (email, password) => post('/api/v1/session/login/', { email, password }),
    workspaces: () => request('/api/v1/workspaces/'),
    selectWorkspace: (workspacePublicId) => post('/api/v1/workspaces/active/', { workspace_public_id: workspacePublicId })
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowApi = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
