const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

test('FF-PROJ-003 loads each project consumer through the shared effective catalog boundary', () => {
  ['facturas.js', 'transacciones.js', 'reportes.js'].forEach((file) => {
    const controller = fs.readFileSync(path.join(root, 'assets/js', file), 'utf8');

    assert.match(controller, /FreelanceFlowProjectModel/);
    assert.match(controller, /getEffectiveProjects\(data\.proyectos \?\? \[\]\)/);
    assert.equal((controller.match(/data\.proyectos/g) ?? []).length, 1);
  });
});

test('FF-PROJ-003 loads project-model before every live consumer controller page', () => {
  [['facturas.html', 'facturas.js'], ['transacciones.html', 'transacciones.js'], ['reportes.html', 'reportes.js']].forEach(([page, controller]) => {
    const html = fs.readFileSync(path.join(root, 'pages', page), 'utf8');

    assert.match(html, /assets\/js\/project-model\.js/);
    assert.ok(html.indexOf('project-model.js') < html.indexOf(controller));
  });
});

test('FF-PROJ-003 reports keep a local-only project name in profitability results', async () => {
  const reportModel = require('../assets/js/report-model.js');
  const listeners = {};
  const nodes = new Map();
  const node = (id) => nodes.get(id) || (() => {
    const value = {
      id, hidden: false, disabled: false, value: '', textContent: '', innerHTML: '', options: [], dataset: {}, style: {},
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener(type, callback) { listeners[`${id}:${type}`] = callback; }, setAttribute() {}, removeAttribute() {},
      append() {}, appendChild() {}, replaceChildren() {}, querySelector() { return null; }, querySelectorAll() { return []; },
      closest() { return null; }, focus() {}, reset() {}
    };
    nodes.set(id, value);
    return value;
  })();
  const document = {
    body: node('body'), activeElement: null,
    addEventListener(type, callback) { if (type === 'DOMContentLoaded') listeners.load = callback; },
    getElementById: node, querySelector: node, querySelectorAll() { return []; }, createElement: node
  };
  const reports = [];
  const model = {
    ...reportModel,
    buildReport(type, data, filters) {
      const report = reportModel.buildReport(type, data, filters);
      reports.push(report);
      return report;
    }
  };
  const context = {
    document, console: { error() {}, warn() {} }, Intl, Date, URL, URLSearchParams,
    setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: (callback) => callback(), addEventListener() {},
    location: { href: 'http://test.local/pages/reportes.html?report=profitability', search: '?report=profitability', hash: '' },
    history: { replaceState() {} }, localStorage: { getItem() { return null; } }
  };
  Object.assign(context, {
    window: context, globalThis: context,
    FreelanceFlowDataLoader: { loadJson: async () => ({
      proyectos: [], clientes: [], categorias_gasto: [], presupuestos: [], movimientos_financieros_mock_auxiliar: [], gastos: [], registros_tiempo: [],
      facturas: [{ id: 'fac_local', proyecto_relacionado_id: 'proy_local', estado: 'SENT', fecha_emision: '2026-06-10', total_factura: 125 }]
    }) },
    FreelanceFlowProjectModel: { getEffectiveProjects: () => [{ id: 'proy_local', nombre_proyecto: 'Proyecto local', cliente_id: 'cli_local' }] },
    FreelanceFlowClientModel: { getEffectiveClients: (items) => items },
    FreelanceFlowCategoryModel: { readEffectiveCatalog: () => ({ categories: [] }) },
    FreelanceFlowTransactionModel: { toExpenseRecords: () => [] },
    FreelanceFlowReportModel: model,
    FreelanceFlowActivity: { record() {} }
  });

  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/js/reportes.js'), 'utf8'), context);
  await listeners.load();

  assert.equal(reports.find((report) => report.type === 'profitability')?.rows[0]?.projectName, 'Proyecto local');
});
