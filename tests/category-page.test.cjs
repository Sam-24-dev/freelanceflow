const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const htmlPath = path.join(__dirname, '../pages/categorias.html');

test('categories page exposes accessible operational UI regions', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<main id="main-content"/);
  assert.match(html, /id="categories-results-status"[^>]*aria-live="polite"/);
  assert.match(html, /<table class="categories-table">/);
  assert.match(html, /<caption class="sr-only">Categorías de gasto/);
  assert.match(html, /id="category-drawer"[^>]*role="dialog"/);
  assert.match(html, /id="category-remove-dialog"/);
  assert.match(html, /assets\/js\/category-model\.js/);
  assert.match(html, /assets\/js\/categorias\.js/);
});

test('categories controller is part of static validation command', () => {
  const packageJson = fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8');

  assert.match(packageJson, /assets\/js\/category-model\.js/);
  assert.match(packageJson, /assets\/js\/categorias\.js/);
});

test('category actions escape ids before rendering data attributes', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(controller, /function escapeAttribute/);
  assert.match(controller, /data-category-id="\$\{escapeAttribute\(category\.id\)\}"/);
});

test('category actions identify the affected category for assistive technology', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(controller, /aria-label="Editar \$\{escapeAttribute\(category\.nombre_categoria\)\}"/);
  assert.match(controller, /aria-label="\$\{removeAction\} \$\{escapeAttribute\(category\.nombre_categoria\)\}"/);
});

test('category monthly metrics use the browser local month', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(controller, /getFullYear\(\)/);
  assert.match(controller, /getMonth\(\) \+ 1/);
  assert.doesNotMatch(controller, /toISOString\(\)\.slice\(0, 7\)/);
});

test('category form errors are associated to controls without dropping hints', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /id="category-name"[^>]*aria-describedby="category-name-error"/);
  assert.match(html, /id="category-name-error"[^>]*data-field-error="nombre_categoria"/);
  assert.match(html, /id="category-budget"[^>]*aria-describedby="category-budget-hint category-budget-error"/);
  assert.match(html, /id="category-budget-error"[^>]*data-field-error="presupuesto_mensual"/);
});

test('categories heading stacks vertically on small screens', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.categories-heading\s*{[\s\S]*flex-direction:\s*column;/);
});

test('categories loading status is removed when hidden', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /\.categories-app\s+\[hidden\]\s*{\s*display:\s*none\s*!important;\s*}/);
});

test('categories content uses the accepted warm ledger surface instead of a full-dark canvas', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /\.categories-app\s*{[\s\S]*background:\s*#f4eee5;/);
  assert.match(css, /\.categories-heading,\s*[\s\S]*\.categories-summary-card\s*{[\s\S]*background:\s*#fffdf8;/);
  assert.doesNotMatch(css, /\.categories-app\s*{[\s\S]*background:\s*#0f172a;/);
});

test('categories mobile summary remains two columns down to 320px', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.categories-summary-grid\s*{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.doesNotMatch(css, /@media \(max-width: 640px\)[\s\S]*\.categories-heading,\s*[\s\S]*\.categories-summary-grid,\s*[\s\S]*\{[\s\S]*grid-template-columns:\s*1fr;/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*\.categories-summary-card\s*{[\s\S]*padding:\s*0\.75rem;/);
});

test('category drawer backdrop is hidden from assistive tech while keeping click close behavior', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(html, /id="category-drawer-backdrop"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html, /id="category-drawer-backdrop"[^>]*aria-label="Cerrar panel"/);
  assert.match(controller, /elements\.backdrop\?\.addEventListener\('click'/);
});

test('categories drawer caps tablet and desktop width at 420px while mobile is fullscreen', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /\.category-drawer\s*{[\s\S]*width:\s*min\(100vw,\s*420px\);/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.category-drawer\s*{[\s\S]*width:\s*100vw;/);
});

test('category copy pluralizes singular visible categories and usage', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(controller, /function pluralizeCategory/);
  assert.match(controller, /function pluralizeUsage/);
  assert.match(controller, /pluralizeCategory\(visible\.length\)/);
  assert.match(controller, /pluralizeUsage\(category\.usos\)/);
});

test('FF-CAT-003 category CRUD commits UI state and activity only after persistence succeeds', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');
  const submit = controller.slice(controller.indexOf('function handleFormSubmit'), controller.indexOf('function validateFieldOnBlur'));
  const removal = controller.slice(controller.indexOf('function resolveRemovalDialog'), controller.indexOf('function handleKeydown'));

  assert.match(submit, /saveEffectiveCatalog/);
  assert.match(submit, /if \(!persisted\.ok\)[\s\S]*return;/);
  assert.ok(submit.indexOf('if (!persisted.ok)') < submit.indexOf('state.categories = candidate'));
  assert.ok(submit.indexOf('state.categories = candidate') < submit.indexOf('recordCategoryActivity'));
  assert.match(removal, /saveEffectiveCatalog/);
  assert.ok(removal.indexOf('if (!persisted.ok)') < removal.indexOf('state.categories = candidate'));
  assert.match(removal, /if \(!persisted\.ok\)[\s\S]*removeDialog\.showModal\(\)/);
});

test('FF-CAT-001 category submit validates the raw candidate before normalization', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');
  const submit = controller.slice(controller.indexOf('function handleFormSubmit'), controller.indexOf('function validateFieldOnBlur'));
  assert.ok(submit.indexOf('validateCategory(rawRecord') < submit.indexOf('createCategoryRecord(rawRecord'));
});

test('FF-CAT-004 and FF-CAT-009 route every category consumer through the shared model boundary', () => {
  const pages = [
    fs.readFileSync(path.join(__dirname, '../pages/transacciones.html'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../pages/dashboard.html'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../pages/reportes.html'), 'utf8')
  ];
  const controllers = [
    fs.readFileSync(path.join(__dirname, '../assets/js/transacciones.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../assets/js/dashboard.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../assets/js/reportes.js'), 'utf8')
  ];

  pages.forEach((html) => {
    assert.match(html, /assets\/js\/category-model\.js/);
    assert.ok(html.indexOf('category-model.js') < html.indexOf('transaction-model.js'));
  });
  controllers.forEach((controller) => {
    assert.match(controller, /readEffectiveCatalog/);
    assert.doesNotMatch(controller, /const CATEGORY_STORAGE_KEY/);
  });
});

test('FF-CAT-005 movements reuse selectedValue for the one inactive historical option', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/transacciones.js'), 'utf8');
  assert.match(controller, /getSelectableCategories\(state\.data\.categorias_gasto, selectedValue\)/);
  assert.match(controller, /selectedCategoryId: existing\?\.categoria_gasto_id/);
});

test('FF-CAT-008 category CRUD disables deduplication only at the successful activity call site', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');
  assert.match(controller, /function recordCategoryActivity\(action\)[\s\S]*deduplicate: false/);
  assert.doesNotMatch(controller, /recordSearch\([^)]*deduplicate/);
});

test('blocked global Storage getter reaches the shared boundary and all four controllers degrade', async () => {
  const element = () => ({ hidden: false, disabled: false, value: '', options: [], dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, replaceChildren() {}, querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }, focus() {}, reset() {} });
  for (const [file, completed] of [['categorias.js', 'categories'], ['dashboard.js', 'dashboard'], ['reportes.js', 'reports'], ['transacciones.js', 'transactions']]) {
    const listeners = {}; const calls = {}; const node = element();
    const document = { body: element(), activeElement: node, addEventListener(type, callback) { if (type === 'DOMContentLoaded') listeners.load = callback; },
      getElementById() { return node; }, querySelector() { return node; }, querySelectorAll() { return []; }, createElement: element };
    const categoryModel = { readEffectiveCatalog(...args) { calls.categoryArgs = args; return { ok: false, categories: args[0] || [], deletedIds: [] }; }, mergeCategories: (items) => items, applyCategoryUsage: (items) => items, filterCategories: (items) => items,
      calculateCategoryMetrics() { calls.categories = true; return { total: 0, deducible: 0, mostUsed: '', budgetAttention: { count: 0, label: '' } }; }, getSelectableCategories: () => [] };
    const transactionModel = { sanitizeTransactions() { calls.transactions = true; return { items: [], rejected: [] }; }, filterTransactions: () => [], calculateSummary: () => ({ income: 0, expense: 0, net: 0, count: 0 }), getProjectsForClient: () => [], shouldOpenTransactionFormFromHash: () => false };
    const reportModel = { REPORT_TYPES: ['income'], mergeBudgets(items) { calls.reports = true; return items; }, validateDateRange: () => ({ valid: false }), getDateRange: () => ({ from: '', to: '' }), calculateFinancialSummary: () => ({}), calculateBudgetRows: () => [], buildReport: () => ({ rows: [] }) };
    const dashboardModel = { composeDashboardData: (data) => data, getAvailablePeriods: () => [], buildDashboardSnapshot() { calls.dashboard = true; return { status: 'unavailable', availability: {}, movements: [], receivables: [] }; }, getPeriodNavigation: () => ({ movements: '', reports: '' }) };
    const context = { document, console: { error() {}, warn() {} }, Intl, Date, URL, URLSearchParams, Option: function Option() {}, crypto: { randomUUID: () => 'id' }, setTimeout: () => 0, clearTimeout() {}, confirm: () => true };
    Object.assign(context, { window: context, globalThis: context, location: { href: 'http://test.local/pages/test.html', search: '', hash: '' },
      history: { replaceState() {} }, addEventListener() {}, requestAnimationFrame: (callback) => callback(), matchMedia: () => ({ matches: false }), FreelanceFlowDataLoader: { loadJson: async () => ({ categorias_gasto: [], movimientos_financieros_mock_auxiliar: [], proyectos: [], clientes: [], presupuestos: [] }) },
      FreelanceFlowCategoryModel: categoryModel, FreelanceFlowTransactionModel: transactionModel, FreelanceFlowReportModel: reportModel, FreelanceFlowDashboardModel: dashboardModel, FreelanceFlowClientModel: { getEffectiveClients: (items) => items, getSelectableClients: () => [] } });
    Object.defineProperty(context, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../assets/js/${file}`), 'utf8'), context); await listeners.load();
    assert.equal(calls.categoryArgs?.length, 1, `${file} evaluated Storage before the model boundary`);
    assert.equal(calls[completed], true, `${file} did not complete its degraded flow`);
  }
});

test('Movimientos preserves stored bytes while the category catalog is degraded and recovers on reload', async () => {
  const transactionModel = require('../assets/js/transaction-model.js');
  const original = [{ id: 'mov_local', tipo: 'gasto', monto: 8, fecha: '2026-07-01', moneda: 'USD', categoria_gasto_id: 'cat_local', cuenta_id: 'account' }];
  const bytes = JSON.stringify(original); const values = new Map([['freelanceflow_transactions_mock', bytes]]); const activity = [];
  const run = async (catalog) => {
    const listeners = {}; const nodes = new Map(); const calls = {};
    const node = (id) => nodes.get(id) || (() => { const value = { id, hidden: false, disabled: false, value: '', options: [], dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, replaceChildren() {}, querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return value; }, reset() {}, focus() { document.activeElement = value; }, addEventListener(type, callback) { listeners[`${id}:${type}`] = callback; } }; nodes.set(id, value); return value; })();
    const document = { body: node('body'), activeElement: null, addEventListener(type, callback) { if (type === 'DOMContentLoaded') listeners.load = callback; },
      getElementById: node, querySelector(selector) { return selector === 'input[name="tipo"]:checked' ? { value: 'ingreso' } : node(selector); }, querySelectorAll() { return []; }, createElement: (tag) => node(`created-${tag}-${nodes.size}`) };
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
    const model = { ...transactionModel, sanitizeTransactions(items, options) { const result = transactionModel.sanitizeTransactions(items, options); calls.loaded = result.items; return result; } };
    const context = { document, console: { error() {}, warn() {} }, Intl, Date, URL, URLSearchParams, localStorage: storage, Option: function Option() {}, crypto: { randomUUID: () => 'new' }, setTimeout: () => 0, clearTimeout() {}, confirm: () => true };
    Object.assign(context, { window: context, globalThis: context, location: { href: 'http://test.local/pages/transacciones.html', search: '', hash: '' },
      history: { replaceState() {} }, addEventListener() {}, requestAnimationFrame: (callback) => callback(), matchMedia: () => ({ matches: false }), FreelanceFlowDataLoader: { loadJson: async () => ({ categorias_gasto: [{ id: 'cat_base' }], movimientos_financieros_mock_auxiliar: [], proyectos: [], clientes: [], cuentas_mock_auxiliar: [] }) },
      FreelanceFlowCategoryModel: { readEffectiveCatalog: () => catalog, getSelectableCategories: (items) => items }, FreelanceFlowTransactionModel: model, FreelanceFlowClientModel: { getEffectiveClients: (items) => items, getSelectableClients: () => [] }, FreelanceFlowActivity: { record: (event) => activity.push(event) } });
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/transacciones.js'), 'utf8'), context); await listeners.load();
    Object.assign(node('transaction-amount'), { value: '10' }); Object.assign(node('transaction-date'), { value: '2026-07-02' }); Object.assign(node('transaction-category'), { value: 'income_invoice' }); Object.assign(node('transaction-account'), { value: 'account' });
    await listeners['transaction-form:submit']({ preventDefault() {} });
    return { calls, document, nodes };
  };
  const degraded = await run({ ok: false, categories: [{ id: 'cat_base', estado: 'activo' }], deletedIds: [] });
  assert.equal(values.get('freelanceflow_transactions_mock'), bytes);
  assert.equal(activity.length, 0);
  assert.equal(degraded.nodes.get('transaction-form-message').hidden, false);
  assert.equal(degraded.document.activeElement?.id, 'transaction-submit-button');
  const restored = await run({ ok: true, categories: [{ id: 'cat_base', estado: 'activo' }, { id: 'cat_local', estado: 'activo' }], deletedIds: [] });
  assert.equal(restored.calls.loaded.map(({ id }) => id).join(','), 'mov_local');
});
