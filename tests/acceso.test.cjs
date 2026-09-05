const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
const accessSource = fs.readFileSync(path.join(ROOT, 'assets/js/acceso.js'), 'utf8');
const flush = () => new Promise((resolve) => setImmediate(resolve));

function createHarness(api) {
  const listeners = {}, controls = [{ disabled: false }, { disabled: false }, { disabled: false }];
  const login = { hidden: false, addEventListener: (type, fn) => { listeners.login = fn; }, querySelectorAll: () => controls };
  const memberships = { children: [], addEventListener: (type, fn) => { listeners.memberships = fn; }, querySelectorAll: () => [], replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); } };
  const elements = { login, memberships, workspaceSection: { hidden: true }, empty: { hidden: true }, error: { hidden: true, textContent: '', focus() {} }, status: { hidden: true, textContent: '' }, retry: { hidden: true, disabled: true, addEventListener: (type, fn) => { listeners.retry = fn; } }, logout: { hidden: true, disabled: true, addEventListener: (type, fn) => { listeners.logout = fn; } } };
  const selectors = { '[data-access-login]': login, '[data-access-workspace-section]': elements.workspaceSection, '[data-access-memberships]': memberships, '[data-access-empty]': elements.empty, '[data-access-error]': elements.error, '[data-access-status]': elements.status, '[data-access-retry]': elements.retry, '[data-access-logout]': elements.logout };
  const document = { addEventListener: (type, fn) => { listeners.ready = fn; }, querySelector: (selector) => selectors[selector] || null, createElement: () => ({ dataset: {}, append() {}, setAttribute() {} }) };
  const scope = { document, FreelanceFlowApi: api, FormData: class { get(name) { return name === 'email' ? 'member@example.com' : 'secret'; } }, location: { assign(value) { scope.destination = value; } } };
  scope.globalThis = scope; vm.runInNewContext(accessSource, scope); listeners.ready();
  return { elements, scope, submit: () => listeners.login({ preventDefault() {} }), select: (id) => listeners.memberships({ target: { closest: () => ({ dataset: { workspaceId: id } }) } }) };
}

test('API client uses session cookies and CSRF without browser-held authority', async () => {
  const source = fs.readFileSync(path.join(ROOT, 'assets/js/api-client.js'), 'utf8');
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage|Authorization|Bearer|JWT)/i);
  const originalFetch = global.fetch, originalDocument = global.document, calls = [];
  global.document = { cookie: 'csrftoken=token%201' };
  global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => ({ data: { authenticated: true } }) }; };
  try {
    delete require.cache[require.resolve('../assets/js/api-client.js')]; const api = require('../assets/js/api-client.js');
    await api.session(); await api.login('member@example.com', 'secret'); await api.selectWorkspace('workspace-id'); await api.logout();
    assert.deepEqual(calls.map(({ url }) => url), ['/api/v1/session/', '/api/v1/session/login/', '/api/v1/workspaces/active/', '/api/v1/session/logout/']);
    for (const call of calls) assert.equal(call.options.credentials, 'same-origin');
    assert.equal(calls[1].options.headers['X-CSRFToken'], 'token 1'); assert.equal(calls[3].options.headers['X-CSRFToken'], 'token 1');
  } finally { global.fetch = originalFetch; global.document = originalDocument; delete global.FreelanceFlowApi; }
});

test('login remains blocked until the session bootstrap finishes', async () => {
  let resolveSession, loginCalls = 0;
  const harness = createHarness({ session: () => new Promise((resolve) => { resolveSession = resolve; }), login: async () => { loginCalls += 1; } });
  assert.ok(harness.elements.login.querySelectorAll().every((control) => control.disabled)); await harness.submit(); assert.equal(loginCalls, 0);
  resolveSession({ authenticated: false, active_workspace: null }); await flush(); assert.ok(harness.elements.login.querySelectorAll().every((control) => !control.disabled));
});

test('successful login lists only server-returned workspaces', async () => {
  const calls = [], harness = createHarness({ session: async () => ({ authenticated: false, active_workspace: null }), login: async () => { calls.push('login'); return { authenticated: true, active_workspace: null }; }, workspaces: async () => ({ workspaces: [{ workspace_public_id: 'workspace-a', workspace_name: 'Studio A', workspace_slug: 'studio-a', role: 'OPERATIONAL' }] }) });
  await flush(); await harness.submit(); await flush();
  assert.deepEqual(calls, ['login']); assert.equal(harness.elements.login.hidden, true); assert.equal(harness.elements.memberships.children.length, 1);
});

test('workspace-load failure after login clears UI and offers a safe retry', async () => {
  const harness = createHarness({ session: async () => ({ authenticated: false }), login: async () => ({ authenticated: true }), workspaces: async () => { throw new Error('offline'); } });
  await flush(); await harness.submit(); await flush();
  assert.equal(harness.elements.login.hidden, true); assert.equal(harness.elements.retry.hidden, false); assert.match(harness.elements.error.textContent, /cargar tus accesos/);
});

test('workspace selection re-probes the server session before navigation', async () => {
  const calls = [], harness = createHarness({ session: async () => { calls.push('session'); return calls.length === 1 ? { authenticated: true, active_workspace: null } : { authenticated: true, active_workspace: { workspace_public_id: 'workspace-a', workspace_name: 'Studio A', workspace_slug: 'studio-a', role: 'OPERATIONAL' } }; }, workspaces: async () => ({ workspaces: [{ workspace_public_id: 'workspace-a', workspace_name: 'Studio A', workspace_slug: 'studio-a', role: 'OPERATIONAL' }] }), selectWorkspace: async () => { calls.push('select'); } });
  await flush(); await harness.select('workspace-a'); await flush();
  assert.deepEqual(calls, ['session', 'select', 'session']); assert.equal(harness.scope.destination, 'dashboard.html');
});

test('mismatched selection re-probe clears workspace UI without navigating', async () => {
  let sessions = 0;
  const harness = createHarness({ session: async () => (++sessions === 1 ? { authenticated: true, active_workspace: null } : { authenticated: true, active_workspace: null }), workspaces: async () => ({ workspaces: [{ workspace_public_id: 'workspace-a', workspace_name: 'Studio A', workspace_slug: 'studio-a', role: 'OPERATIONAL' }] }), selectWorkspace: async () => null });
  await flush(); await harness.select('workspace-a'); await flush();
  assert.equal(harness.scope.destination, undefined); assert.equal(harness.elements.memberships.children.length, 0); assert.match(harness.elements.error.textContent, /ya no est/);
});

test('access page provides disabled credentials, logout, retry, and live feedback', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pages/acceso.html'), 'utf8').replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
  assert.match(html, /data-access-login/); assert.match(html, /autocomplete="current-password"[^>]*disabled/); assert.match(html, /data-access-logout[^>]*hidden[^>]*disabled/); assert.match(html, /data-access-retry[^>]*hidden[^>]*disabled/);
  assert.match(html, /data-access-status[^>]*role="status"[^>]*aria-live="polite"/); assert.match(html, /data-access-error[^>]*role="alert"[^>]*aria-live="assertive"/); assert.match(html, /api-client\.js/);
});

test('active server workspace redirects access directly to the dashboard', async () => {
  const harness = createHarness({ session: async () => ({ authenticated: true, active_workspace: { workspace_public_id: 'workspace-a', role: 'OPERATIONAL' } }) });
  await flush();
  assert.equal(harness.scope.destination, 'dashboard.html');
});
