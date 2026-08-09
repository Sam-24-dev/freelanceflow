const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const reportsPath = path.resolve(__dirname, '../assets/js/reportes.js');
const pagePath = path.resolve(__dirname, '../pages/reportes.html');

test('FF-RPT-003 y FF-RPT-005 preservan el borrador y anuncian errores accesibles', () => {
  const script = fs.readFileSync(reportsPath, 'utf8');
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(script, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(nextBudgets\)\);[\s\S]{0,280}state\.budgets = nextBudgets;/);
  assert.match(script, /function showBudgetStorageError\(\)[\s\S]{0,420}summary\.focus\(\)/);
  assert.match(script, /function showDateRangeError\(message\)[\s\S]{0,700}to\?\.focus\(\)/);
  assert.match(script, /function clearDateRangeError\(\)[\s\S]{0,420}removeAttribute\('aria-describedby'\)/);
  assert.match(page, /id="report-date-error"[^>]*role="alert"[^>]*aria-live="assertive"/);
});

test('FF-RPT-003 runtime keeps the budget panel, draft, state, and activity untouched after storage rejects', () => {
  const vm = require('node:vm');
  const model = require('../assets/js/report-model.js');
  const attributes = new Map();
  const field = (value = '') => ({ value, textContent: '', hidden: false, focusCount: 0, setAttribute(name, next) { attributes.set(name, next); }, removeAttribute(name) { attributes.delete(name); }, getAttribute(name) { return attributes.get(name) ?? null; }, focus() { this.focusCount += 1; } });
  const fields = {
    'budget-id': field(''), 'budget-period-type': field('Mensual'), 'budget-period-key': field('2026-06'),
    'budget-income-goal': field('100'), 'budget-hours-goal': field(''), 'reports-period': field(),
    'report-date-from': field('2026-07-02'), 'report-date-to': field('2026-07-01'),
    'report-date-error': field(), 'budget-form-summary': field()
  };
  const limit = { querySelector(selector) { return selector === '[name="categoria_id"]' ? field('cat_001') : field('10'); } };
  const listeners = new Map();
  const doc = {
    addEventListener() {},
    getElementById(id) { return fields[id] ?? field(); },
    querySelectorAll(selector) {
      if (selector === '.budget-limit-row') return [limit];
      if (selector === '#report-date-from, #report-date-to') return [fields['report-date-from'], fields['report-date-to']];
      return [];
    },
    querySelector() { return null; },
    body: { classList: { add() {}, remove() {} } }
  };
  const activities = [];
  const context = {
    __FREELANCEFLOW_TEST__: true, console: { warn() {} }, document: doc, localStorage: { setItem() { throw new DOMException('quota', 'QuotaExceededError'); } },
    window: null, URL, URLSearchParams, requestAnimationFrame: (fn) => fn(), clearTimeout() {}, setTimeout() { return 1; },
    matchMedia() { return { matches: false }; }, history: { replaceState() {} }, FreelanceFlowReportModel: model,
    FreelanceFlowActivity: { record(event) { activities.push(event); } }
  };
  context.window = context;
  const instrumented = fs.readFileSync(reportsPath, 'utf8').replace('}());', 'if (globalThis.__FREELANCEFLOW_TEST__) globalThis.FreelanceFlowReportsControllerTest = { state, handleBudgetSubmit, showDateRangeError, clearDateRangeError }; }());');
  vm.runInNewContext(instrumented, context);
  const controller = context.FreelanceFlowReportsControllerTest;
  const panel = { id: 'budget-panel' };
  controller.state.data = { categorias_gasto: [{ id: 'cat_001' }] };
  controller.state.budgets = [{ id: 'persisted', periodo: 'Mensual', periodo_clave: '2026-05' }];
  controller.state.activePanel = panel;
  controller.state.formDirty = true;
  const before = JSON.stringify(controller.state.budgets);

  controller.handleBudgetSubmit({ preventDefault() {} });

  assert.equal(JSON.stringify(controller.state.budgets), before);
  assert.equal(controller.state.activePanel, panel);
  assert.equal(controller.state.formDirty, true);
  assert.equal(fields['budget-period-key'].value, '2026-06');
  assert.equal(activities.length, 0);
  assert.equal(fields['budget-form-summary'].hidden, false);
  assert.match(fields['budget-form-summary'].textContent, /No se pudo guardar/);
  assert.equal(fields['budget-form-summary'].focusCount, 1);

  controller.showDateRangeError('La fecha final no puede ser anterior a la fecha inicial.');
  assert.equal(fields['report-date-from'].getAttribute('aria-invalid'), 'true');
  assert.equal(fields['report-date-to'].getAttribute('aria-describedby'), 'report-date-error');
  assert.equal(fields['report-date-to'].focusCount, 1);
  controller.clearDateRangeError();
  assert.equal(fields['report-date-from'].getAttribute('aria-invalid'), null);
  assert.equal(fields['report-date-to'].getAttribute('aria-describedby'), null);
});
