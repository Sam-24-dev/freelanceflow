const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const model = require('../assets/js/settings-model.js');

function loadController({ activity } = {}) {
  const handlers = {};
  const fields = Object.entries(model.getDefaultSettings()).map(([name, value]) => ({
    name,
    value: String(value),
    removeAttribute() {},
    setAttribute() {},
    focus() {}
  }));
  fields.forEach((field) => { fields[field.name] = field; });
  const form = {
    elements: fields,
    addEventListener(type, handler) { handlers[type] = handler; },
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
  const status = { textContent: '', hidden: true };
  const reset = { addEventListener(type, handler) { handlers[type] = handler; } };
  const elements = {
    'settings-form': form,
    'settings-form-summary': { hidden: true, textContent: '' },
    'settings-status': status,
    'settings-preview-number': { textContent: '' },
    'settings-preview-due': { textContent: '' },
    'settings-preview-currency': { textContent: '' },
    'settings-reset': reset
  };
  const storage = new Map();
  const document = {
    addEventListener(type, handler) { if (type === 'DOMContentLoaded') handlers.ready = handler; },
    getElementById(id) { return elements[id]; }
  };
  const window = { FreelanceFlowSettingsModel: model, FreelanceFlowActivity: activity, confirm: () => true };
  const context = { window, document, localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }, FormData: class { constructor() { this.values = fields; } entries() { return this.values.map(({ name, value }) => [name, value]); } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/ajustes.js'), 'utf8'), context);
  handlers.ready();
  return { handlers, status };
}

test('editing settings clears and hides prior success feedback', () => {
  const { handlers, status } = loadController();
  status.textContent = 'Ajustes guardados correctamente.';
  status.hidden = false;

  handlers.input();

  assert.equal(status.textContent, '');
  assert.equal(status.hidden, true);
});

test('a logging failure does not prevent saved-settings success feedback', () => {
  const { handlers, status } = loadController({ activity: { record() { throw new Error('logger unavailable'); } } });

  assert.doesNotThrow(() => handlers.submit({ preventDefault() {} }));
  assert.equal(status.textContent, 'Ajustes guardados correctamente.');
  assert.equal(status.hidden, false);
});

test('a logging failure does not prevent restored-settings success feedback', () => {
  const { handlers, status } = loadController({ activity: { record() { throw new Error('logger unavailable'); } } });

  assert.doesNotThrow(() => handlers.click());
  assert.equal(status.textContent, 'Valores predeterminados restaurados.');
  assert.equal(status.hidden, false);
});
