const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMobileInvoiceAlert,
  buildDashboardSnapshot,
  composeDashboardData,
  createDashboardTransactionPreviews,
  getAvailablePeriods,
  getPeriodNavigation
} = require('../assets/js/dashboard-model.js');
const invoiceModel = require('../assets/js/invoice-model.js');
const clientModel = require('../assets/js/client-model.js');
const projectModel = require('../assets/js/project-model.js');
const reportModel = require('../assets/js/report-model.js');
const settingsModel = require('../assets/js/settings-model.js');
const transactionModel = require('../assets/js/transaction-model.js');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const movements = [
  { id: 'old', fecha: '2026-06-01' },
  { id: 'latest', fecha: '2026-06-20' },
  { id: 'second', fecha: '2026-06-18' },
  { id: 'third', fecha: '2026-06-12' },
  { id: 'fourth', fecha: '2026-06-05' },
  { id: 'fifth', fecha: '2026-06-03' }
];

test('createDashboardTransactionPreviews keeps five desktop items but only three mobile items', () => {
  const previews = createDashboardTransactionPreviews(movements);

  assert.deepEqual(previews.desktop.map((movement) => movement.id), ['latest', 'second', 'third', 'fourth', 'fifth']);
  assert.deepEqual(previews.mobile.map((movement) => movement.id), ['latest', 'second', 'third']);
});

test('buildMobileInvoiceAlert prioritizes overdue invoices with pending balance', () => {
  const alert = buildMobileInvoiceAlert([
    { estado: 'SENT', saldo_pendiente: 400 },
    { estado: 'OVERDUE', saldo_pendiente: 250 },
    { estado: 'PAID', saldo_pendiente: 0 }
  ]);

  assert.equal(alert.kind, 'overdue');
  assert.equal(alert.count, 1);
  assert.equal(alert.amount, 250);
});

test('buildMobileInvoiceAlert returns clear empty state when there is nothing to collect', () => {
  const alert = buildMobileInvoiceAlert([{ estado: 'PAID', saldo_pendiente: 0 }]);

  assert.deepEqual(alert, { kind: 'clear', count: 0, amount: 0 });
});

const invoice = (id, estado, total, due) => ({ id, estado, moneda: 'USD', fecha_emision: '2026-06-01', fecha_vencimiento: due, items: [{ cantidad: 1, precio_unitario: total }] });
const dashboardData = { facturas: [invoice('draft', 'DRAFT', 400, '2026-06-10'), invoice('sent', 'SENT', 300, '2026-06-30'), invoice('partial', 'PARTIAL', 100, '2026-06-15'), invoice('paid', 'PAID', 120, '2026-06-15'), invoice('void', 'VOID', 500, '2026-06-15')], pagos_factura: [{ factura_id: 'partial', monto_pagado: 50, fecha_pago: '2026-06-04', metodo_pago: 'transferencia' }, { factura_id: 'paid', monto_pagado: 120, fecha_pago: '2026-06-05', metodo_pago: 'transferencia' }, { factura_id: 'void', monto_pagado: 500, fecha_pago: '2026-06-06', metodo_pago: 'transferencia' }], movimientos_financieros_mock_auxiliar: [{ id: 'income', tipo: 'ingreso', monto: 999, fecha: '2026-06-04', moneda: 'USD' }, { id: 'expense', tipo: 'gasto', monto: 40, fecha: '2026-06-05', moneda: 'USD' }], presupuestos: { periodo_clave: '2026-06', meta_ingresos: 250 } };

test('buildDashboardSnapshot uses valid invoice payments by payment date without double counting movements', () => {
  const snapshot = buildDashboardSnapshot(dashboardData, { period: '2026-06', today: '2026-06-20', invoiceModel });
  assert.deepEqual(Object.fromEntries(['status', 'receipts', 'registeredIncome', 'registeredExpenses', 'result', 'incomeGoal'].map((key) => [key, snapshot[key]])), { status: 'ready', receipts: 170, registeredIncome: 999, registeredExpenses: 40, result: 130, incomeGoal: 250 });
  assert.deepEqual(snapshot.receivables.map((invoice) => invoice.id), ['partial', 'sent']);
  assert.equal(snapshot.receivablesTotal, 350);
});

test('buildDashboardSnapshot excludes malformed future and methodless payment overlays', () => {
  const data = composeDashboardData({ facturas: [invoice('i', 'SENT', 100, '2026-06-30')], pagos_factura: [], movimientos_financieros_mock_auxiliar: [], presupuestos: [] }, { payments: [{ id: 'bad', factura_id: 'i', monto_pagado: 10, fecha_pago: 'bad', metodo_pago: 'cash' }, { id: 'future', factura_id: 'i', monto_pagado: 10, fecha_pago: '2026-06-21', metodo_pago: 'cash' }, { id: 'methodless', factura_id: 'i', monto_pagado: 10, fecha_pago: '2026-06-10' }, { id: 'valid', factura_id: 'i', monto_pagado: 25, fecha_pago: '2026-06-10', metodo_pago: 'cash' }] }, { invoiceModel });
  const snapshot = buildDashboardSnapshot(data, { period: '2026-06', today: '2026-06-20', invoiceModel });
  assert.deepEqual([snapshot.receipts, snapshot.receivablesTotal], [25, 75]);
});

test('buildDashboardSnapshot tolerates malformed collections, captures the cutoff once, and rejects mixed currencies', () => {
  const snapshot = buildDashboardSnapshot({ facturas: null, pagos_factura: [{}], movimientos_financieros_mock_auxiliar: [{ tipo: 'gasto', monto: 10, fecha: '2026-06-01', moneda: 'USD' }, { tipo: 'gasto', monto: 5, fecha: '2026-06-02', moneda: 'EUR' }], presupuestos: [] }, { period: '2026-06', today: '2026-06-20', invoiceModel });
  assert.deepEqual([snapshot.status, snapshot.today, snapshot.registeredIncome], ['unavailable', '2026-06-20', 0]); assert.match(snapshot.message, /monedas/i);
});

test('fails closed for incomplete sources and invalid currency before mixed valid currencies', () => {
  const models = { invoiceModel, clientModel, projectModel, reportModel, settingsModel };
  const incomplete = buildDashboardSnapshot(composeDashboardData({ facturas: null, pagos_factura: {}, movimientos_financieros_mock_auxiliar: {} }, {}, models), { period: '2026-06', today: '2026-06-20', invoiceModel });
  const invalid = buildDashboardSnapshot({ facturas: [invoice('i', 'SENT', 1, '2026-06-30')], pagos_factura: [{ factura_id: 'i', monto_pagado: 1, fecha_pago: '2026-06-01' }], movimientos_financieros_mock_auxiliar: [{ tipo: 'gasto', monto: 1, fecha: '2026-06-01', moneda: 'BAD!' }] }, { period: '2026-06', today: '2026-06-20', invoiceModel });
  const missing = buildDashboardSnapshot({ facturas: [invoice('m', 'SENT', 1, '2026-06-30')], pagos_factura: [], movimientos_financieros_mock_auxiliar: [{ tipo: 'gasto', monto: 1, fecha: '2026-06-01' }] }, { period: '2026-06', today: '2026-06-20', invoiceModel });
  assert.deepEqual(incomplete.availability, { receipts: false, movements: false }); assert.match(incomplete.message, /incompletos/i); assert.deepEqual(invalid.availability, { receipts: false, movements: false }); assert.match(invalid.message, /moneda no válida/i); assert.deepEqual([invalid.currency, missing.status, missing.currency], ['USD', 'unavailable', 'USD']);
});

test('period helpers derive dynamic periods and only propagate valid periods to Movimientos and Reportes', () => {
  assert.deepEqual(getAvailablePeriods({ pagos_factura: [{ fecha_pago: '2026-05-20' }], movimientos_financieros_mock_auxiliar: [{ fecha: '2026-06-01' }], presupuestos: { periodo_clave: '2026-04' } }), ['2026-06', '2026-05', '2026-04']);
  assert.deepEqual(getPeriodNavigation('2026-06'), { movements: 'transacciones.html?period=2026-06', reports: 'reportes.html?period=2026-06' });
  assert.deepEqual(getPeriodNavigation('bad'), { movements: 'transacciones.html', reports: 'reportes.html' });
});

test('composes owner overlays and safely falls back for blocked storage', () => {
  const models = { invoiceModel, clientModel, projectModel, reportModel, settingsModel };
  const result = composeDashboardData({ clientes: [{ id: 'c1', nombre_razon_social: 'Base' }] }, { invoices: [{ id: 'i1' }], payments: [{ id: 'p1' }], clients: [{ id: 'c1', nombre_razon_social: 'Local' }], projects: [{ id: 'p1', cliente_id: 'c1' }], budgets: [{ id: 'b1', periodo_clave: '2026-06' }], settings: { invoice_prefix: 'FF-', next_invoice_number: 2, default_due_days: 15, default_currency: 'USD' } }, models);
  assert.equal(result.facturas[0].id, 'i1'); assert.equal(result.clientes[0].nombre_razon_social, 'Local'); assert.equal(result.presupuestos[0].id, 'b1'); assert.equal(result.settings.default_currency, 'USD');
  assert.deepEqual(composeDashboardData({ clientes: [{ id: 'base' }] }, { clients: null }, models).clientes.map((item) => item.id), ['base']);
  assert.equal(composeDashboardData({ presupuestos: { id: 'base-budget' } }, {}, models).presupuestos[0].id, 'base-budget');
});

test('dashboard controller falls back to raw categories when the category catalog reader is unavailable', async () => {
  const listeners = {};
  let composed;
  const select = { options: [], value: '', disabled: false, addEventListener() {}, replaceChildren(...options) { this.options = options; } };
  const context = {
    console: { error() {}, warn() {} },
    document: {
      addEventListener(type, callback) { if (type === 'DOMContentLoaded') listeners.load = callback; },
      getElementById(id) { return id === 'dashboard-period' ? select : null; },
      querySelectorAll() { return []; }
    },
    Intl,
    Date,
    URL,
    URLSearchParams,
    Option: function Option(label, value) { this.text = label; this.value = value; },
    localStorage: { getItem() { return null; } },
    location: { href: 'http://test.local/pages/dashboard.html', search: '' },
    history: { replaceState() {} },
    addEventListener() {},
    FreelanceFlowDataLoader: { loadJson: async () => ({ categorias_gasto: [{ id: 'cat_base', estado: 'activo' }], movimientos_financieros_mock_auxiliar: [], clientes: [], proyectos: [], facturas: [], pagos_factura: [], presupuestos: [] }) },
    FreelanceFlowCategoryModel: {},
    FreelanceFlowClientModel: { getEffectiveClients: (items) => items },
    FreelanceFlowDashboardModel: { composeDashboardData(data) { composed = data; return data; }, getAvailablePeriods: () => ['2026-06'] }
  };
  Object.assign(context, { window: context, globalThis: context });

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/dashboard.js'), 'utf8'), context);
  await listeners.load();

  assert.deepEqual(composed.categorias_gasto, [{ id: 'cat_base', estado: 'activo' }]);
});

test('dashboard markup keeps private accessible mobile states and scoped period links', () => {
  const html = fs.readFileSync(require.resolve('../pages/dashboard.html'), 'utf8');
  const css = fs.readFileSync(require.resolve('../assets/css/app.css'), 'utf8');
  assert.match(html, /name="robots" content="noindex, nofollow"/); assert.match(html, /<main id="main-content"[^>]*tabindex="-1"/); assert.match(html, /<a href="transacciones\.html" data-period-link="movements">Ver todos<\/a>/);
  assert.match(html, /id="cash-flow-status"[^>]*aria-live="polite"/); assert.match(html, /dashboard-due-link/);
  assert.match(css, /\.dashboard-due-link\s*\{[^}]*min-width: 44px/); assert.match(css, /\.dashboard-app \.app-sidebar-brand\s*\{[^}]*min-height: 44px/); assert.match(css, /\.dashboard-app \[aria-label="FreelanceFlow, ir a la página de inicio"\]\s*\{[^}]*min-height: 44px/); assert.match(css, /\.dashboard-app \.app-sidebar-toggle\s*\{[^}]*min-width: 44px[^}]*min-height: 44px/); assert.match(css, /\.dashboard-app \.app-sidebar-section-title\s*\{[^}]*#94a3b8/); assert.doesNotMatch(css, /mobile-home-transaction-item h3\s*\{[^}]*ellipsis/);
});

test('FF-CAT-004 dashboard excludes unknown expense categories without duplicating income', () => {
  const categories = [{ id: 'cat_known', estado: 'activo' }];
  const sanitized = transactionModel.sanitizeTransactions([
    { id: 'income', tipo: 'ingreso', monto: 20, fecha: '2026-06-01', moneda: 'USD', cuenta_id: 'a' },
    { id: 'known', tipo: 'gasto', monto: 5, fecha: '2026-06-02', moneda: 'USD', categoria_gasto_id: 'cat_known', cuenta_id: 'a' },
    { id: 'unknown', tipo: 'gasto', monto: 99, fecha: '2026-06-03', moneda: 'USD', categoria_gasto_id: 'cat_unknown', cuenta_id: 'a' }
  ], { categories }).items;
  const snapshot = buildDashboardSnapshot({
    facturas: [],
    pagos_factura: [],
    movimientos_financieros_mock_auxiliar: sanitized
  }, { period: '2026-06', today: '2026-06-20', invoiceModel });

  assert.equal(snapshot.registeredIncome, 20);
  assert.equal(snapshot.registeredExpenses, 5);
  assert.equal(snapshot.movements.length, 2);
});
