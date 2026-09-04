const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const accessSource = fs.readFileSync(path.join(ROOT, 'assets/js/acceso.js'), 'utf8');

function createAccessHarness(api) {
  const listeners = {}, login = { hidden: false, email: { disabled: false }, password: { disabled: false }, button: { disabled: false }, addEventListener(type, handler) { listeners[type] = handler; }, querySelector() { return this.button; }, querySelectorAll() { return [this.email, this.password, this.button]; } };
  const elements = { login, workspaceSection: { hidden: true }, memberships: { addEventListener() {}, querySelectorAll() { return []; }, replaceChildren() {}, append() {} }, error: { hidden: true, textContent: '', focus() {} }, empty: { hidden: true }, status: { hidden: true, textContent: '' }, retry: { hidden: true, disabled: true, addEventListener(type, handler) { listeners.retry = handler; } } };
  const document = { addEventListener(type, handler) { listeners[type] = handler; }, querySelector(selector) { return ({ '[data-access-login]': elements.login, '[data-access-workspace-section]': elements.workspaceSection, '[data-access-memberships]': elements.memberships, '[data-access-error]': elements.error, '[data-access-empty]': elements.empty, '[data-access-status]': elements.status, '[data-access-retry]': elements.retry })[selector] || null; } };
  const scope = { document, FreelanceFlowApi: api, FormData: class { get(field) { return field === 'email' ? 'person@example.com' : 'secret'; } } };
  scope.globalThis = scope; vm.runInNewContext(accessSource, scope); listeners.DOMContentLoaded();
  return { elements, submit: () => listeners.submit({ preventDefault() {} }) };
}

test('session bootstrap uses same-origin cookies and CSRF without browser authorization storage', async () => {
  const source = fs.readFileSync(path.join(ROOT, 'assets/js/api-client.js'), 'utf8');
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage|Authorization|Bearer|JWT)/i); assert.match(source, /credentials:\s*'same-origin'/); assert.match(source, /X-CSRFToken/);
  const originalFetch = global.fetch, originalDocument = global.document, calls = [];
  global.document = { cookie: 'csrftoken=token%201' }; global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ data: { authenticated: true } }) }; };
  try { delete require.cache[require.resolve('../assets/js/api-client.js')]; const api = require('../assets/js/api-client.js'); await api.session(); await api.selectWorkspace('workspace-public-id'); assert.equal(calls[0].options.credentials, 'same-origin'); assert.equal(calls[1].options.headers['X-CSRFToken'], 'token 1'); assert.match(calls[1].options.body, /workspace-public-id/); }
  finally { global.fetch = originalFetch; global.document = originalDocument; delete global.FreelanceFlowApi; }
});

test('immediate login submit waits for session bootstrap CSRF readiness', async () => {
  let resolveSession, loginCalls = 0; const api = { session: () => new Promise((resolve) => { resolveSession = resolve; }), login: async () => { loginCalls += 1; } };
  const { elements, submit } = createAccessHarness(api);
  assert.equal(elements.login.email.disabled, true); assert.equal(elements.login.password.disabled, true); assert.equal(elements.login.button.disabled, true); await submit(); assert.equal(loginCalls, 0);
  resolveSession({ authenticated: false }); await Promise.resolve(); await Promise.resolve(); assert.equal(elements.login.button.disabled, false);
});

test('bootstrap failure keeps login blocked and exposes retry feedback', async () => {
  const { elements } = createAccessHarness({ session: async () => { throw new Error('offline'); } }); await new Promise(setImmediate);
  assert.equal(elements.login.button.disabled, true); assert.equal(elements.error.hidden, false); assert.equal(elements.error.textContent, 'No pudimos preparar el acceso. Volv\u00e9 a intentarlo.'); assert.equal(elements.retry.hidden, false); assert.equal(elements.retry.disabled, false);
});

test('workspace loading failure after a successful login remains a workspace error', async () => {
  const error = Object.assign(new Error('workspace_not_available'), { code: 'workspace_not_available' });
  const { elements, submit } = createAccessHarness({ session: async () => ({ authenticated: false }), login: async () => null, workspaces: async () => { throw error; } }); await new Promise(setImmediate); await submit();
  assert.equal(elements.login.hidden, true); assert.equal(elements.error.textContent, 'Ese espacio ya no est\u00e1 disponible para tu cuenta.'); assert.doesNotMatch(elements.error.textContent, /iniciar sesi\u00f3n/i);
});

test('access screen contains a disabled session form, status, retry and accessible errors', () => {
  const html = fs.readFileSync(path.join(ROOT, 'pages/acceso.html'), 'utf8').replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
  assert.match(html, /data-access-login/); assert.match(html, /autocomplete="current-password"[^>]*disabled/); assert.match(html, /type="submit" disabled/); assert.match(html, /data-access-retry[^>]*hidden[^>]*disabled/); assert.match(html, /data-access-workspace-section/); assert.match(html, /data-access-status[^>]*role="status"[^>]*aria-live="polite"/); assert.match(html, /data-access-error[^>]*role="alert"[^>]*aria-live="assertive"/); assert.match(html, /api-client\.js/);
});
