const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const settingsSource = fs.readFileSync(path.join(root, 'assets/js/settings-model.js'), 'utf8');
const ajustesSource = fs.readFileSync(path.join(root, 'assets/js/ajustes.js'), 'utf8');
const invoicesSource = fs.readFileSync(path.join(root, 'assets/js/facturas.js'), 'utf8');
const ajustesPage = fs.readFileSync(path.join(root, 'pages/ajustes.html'), 'utf8');
const invoicesPage = fs.readFileSync(path.join(root, 'pages/facturas.html'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'assets/css/app.css'), 'utf8');
const settingsModel = require('../assets/js/settings-model.js');

function createExclusiveWebLocks(beforeCallback) {
  return {
    requests: [],
    async request(name, options, callback) {
      this.requests.push({ name, options });
      await beforeCallback?.();
      return callback({ name });
    }
  };
}

function mountSettingsController({ directEnvelope, stagedEnvelope = null, locks = createExclusiveWebLocks() } = {}) {
  const handlers = {};
  const pageHandlers = {};
  const fields = Object.entries(settingsModel.getDefaultSettings()).map(([name, value]) => ({
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
  const elements = {
    'settings-form': form,
    'settings-form-summary': { hidden: true, textContent: '' },
    'settings-status': { hidden: true, textContent: '', setAttribute() {} },
    'settings-preview-number': { textContent: '' },
    'settings-preview-due': { textContent: '' },
    'settings-preview-currency': { textContent: '' },
    'settings-reset': { addEventListener(type, handler) { handlers[type] = handler; } }
  };
  const storage = new Map([["freelanceflow_settings_v1", settingsModel.serializeSettingsEnvelope(directEnvelope)]]);
  const document = {
    addEventListener(type, handler) { if (type === 'DOMContentLoaded') handlers.ready = handler; },
    getElementById(id) { return elements[id]; }
  };
  const activity = [];
  const window = {
    FreelanceFlowSettingsModel: settingsModel,
    FreelanceFlowInvoiceModel: { INVOICE_WEB_LOCK_NAME: 'freelanceflow-invoice-mutations-v1', readInvoiceTransitionSettings() { return stagedEnvelope; } },
    FreelanceFlowActivity: { record(entry) { activity.push(entry); } },
    navigator: { locks },
    addEventListener(type, handler) { pageHandlers[type] = handler; },
    dispatchEvent(event) { pageHandlers[event.type]?.(event); },
    confirm: () => true
  };
  const context = {
    window,
    document,
    localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    FormData: class { constructor() { this.values = fields; } entries() { return this.values.map(({ name, value }) => [name, value]); } }
  };
  vm.runInNewContext(ajustesSource, context);
  handlers.ready();
  return {
    elements,
    handlers,
    storage,
    activity,
    locks,
    setStagedEnvelope(value) { stagedEnvelope = value; },
    dispatchPageShow() { window.dispatchEvent({ type: 'pageshow', persisted: true }); }
  };
}

test('FF-SET-001 keeps USD as the sole current settings currency and loads the shared settings model before invoices', () => {
  assert.match(settingsSource, /SETTINGS_CURRENCY_OPTIONS = Object\.freeze\(\['USD'\]\)/);
  assert.match(ajustesPage, /<option>USD<\/option>(?![\s\S]*<option>)/);
  assert.ok(invoicesPage.indexOf('assets/js/settings-model.js') < invoicesPage.indexOf('assets/js/facturas.js'));
});

test('FF-SET-002 blocks settings controls after storage failure and restores the last durable values', () => {
  assert.match(ajustesSource, /setStorageAvailability\(false\)/);
  assert.match(ajustesSource, /apply\(durableEnvelope\.settings\)/);
  assert.match(ajustesSource, /elements\.form\.querySelectorAll\('button'\)/);
  assert.match(ajustesSource, /persistent \? 'alert' : 'status'/);
});

test('FF-SET-003 creates invoices from the locked settings snapshot and advances its authoritative number in the same transition', () => {
  const submit = invoicesSource.match(/async function handleInvoiceSubmit\(event\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(submit, /readSettingsEnvelope\(\)/);
  assert.match(submit, /const manualInvoiceNumber = selectors\.invoiceForm\.elements\.numero_factura\.value\.trim\(\);/);
  assert.match(submit, /const invoiceNumber = current \? current\.numero_factura : manualInvoiceNumber \|\| settingsModel\.formatInvoiceNumber\(settings\.invoice_prefix, settings\.next_invoice_number\)/);
  assert.match(submit, /numero_factura: invoiceNumber/);
  assert.match(submit, /const advancedSettings = current \? null : settingsModel\.createSettingsEnvelope/);
  assert.match(submit, /commitLockedTransition\([\s\S]*?settingsModel\.serializeSettingsEnvelope\(advancedSettings\)/);
});

test('FF-SET-003a permits a manual invoice-number override in the real invoice form', () => {
  const invoiceNumberInput = invoicesPage.match(/<input\b[^>]*\bname=["']numero_factura["'][^>]*>/i)?.[0] || '';
  assert.ok(invoiceNumberInput, 'invoice number input must exist');
  assert.doesNotMatch(invoiceNumberInput, /\breadonly\b/i);
  assert.doesNotMatch(invoiceNumberInput, /\baria-readonly\s*=/i);
});

test('FF-SET-004 gives the shared sidebar toggle a 44px target on every app screen', () => {
  const toggle = cssSource.match(/\.app-sidebar-toggle \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(toggle, /width:\s*2\.75rem;/);
  assert.match(toggle, /height:\s*2\.75rem;/);
});

test('FF-SET-005 refreshes a BFCache-restored settings form from the effective staged invoice transition', () => {
  const older = settingsModel.createSettingsEnvelope({ ...settingsModel.getDefaultSettings(), next_invoice_number: 42 }, 4);
  const newer = settingsModel.createSettingsEnvelope({ ...settingsModel.getDefaultSettings(), next_invoice_number: 43 }, 5);
  const controller = mountSettingsController({ directEnvelope: older });

  assert.equal(controller.elements['settings-form'].elements.next_invoice_number.value, 42);
  controller.setStagedEnvelope(settingsModel.serializeSettingsEnvelope(newer));
  controller.dispatchPageShow();

  assert.equal(controller.elements['settings-form'].elements.next_invoice_number.value, 43);
  assert.equal(controller.elements['settings-preview-number'].textContent, 'FAC-0043');
});

test('FF-SET-006 serializes a stale settings save after an interleaved invoice mutation', async () => {
  const older = settingsModel.createSettingsEnvelope({ ...settingsModel.getDefaultSettings(), next_invoice_number: 42 }, 4);
  const newer = settingsModel.createSettingsEnvelope({ ...settingsModel.getDefaultSettings(), next_invoice_number: 43 }, 5);
  let controller;
  const locks = createExclusiveWebLocks(() => controller.setStagedEnvelope(settingsModel.serializeSettingsEnvelope(newer)));
  controller = mountSettingsController({ directEnvelope: older, locks });
  const fields = controller.elements['settings-form'].elements;

  fields.invoice_prefix.value = 'NEW-';
  fields.default_due_days.value = '30';
  controller.setStagedEnvelope(settingsModel.serializeSettingsEnvelope(newer));
  const handlers = controller.handlers;
  await handlers.submit({ preventDefault() {} });

  const saved = settingsModel.parseStoredSettingsEnvelope(controller.storage.get('freelanceflow_settings_v1'));
  assert.equal(saved.revision, 6);
  assert.equal(saved.settings.next_invoice_number, 43);
  assert.equal(saved.settings.invoice_prefix, 'NEW-');
  assert.equal(saved.settings.default_due_days, 30);
  assert.equal(locks.requests.length, 1);
  assert.equal(locks.requests[0].name, 'freelanceflow-invoice-mutations-v1');
  assert.equal(locks.requests[0].options.mode, 'exclusive');
});

test('FF-SET-007 serializes reset after an interleaved invoice mutation without regressing the counter', async () => {
  const older = settingsModel.createSettingsEnvelope({ invoice_prefix: 'NEW-', next_invoice_number: 42, default_due_days: 30, default_currency: 'USD' }, 4);
  const newer = settingsModel.createSettingsEnvelope({ ...settingsModel.getDefaultSettings(), next_invoice_number: 43 }, 5);
  let controller;
  const locks = createExclusiveWebLocks(() => controller.setStagedEnvelope(settingsModel.serializeSettingsEnvelope(newer)));
  controller = mountSettingsController({ directEnvelope: older, locks });

  await controller.handlers.click();

  const saved = settingsModel.parseStoredSettingsEnvelope(controller.storage.get('freelanceflow_settings_v1'));
  assert.equal(saved.revision, 6);
  assert.equal(saved.settings.next_invoice_number, 43);
  assert.equal(saved.settings.invoice_prefix, 'FAC-');
  assert.equal(saved.settings.default_due_days, 15);
  assert.equal(locks.requests.length, 1);
  assert.equal(locks.requests[0].name, 'freelanceflow-invoice-mutations-v1');
  assert.equal(locks.requests[0].options.mode, 'exclusive');
});

test('FF-SET-008 fails closed with an accessible error when the shared invoice lock is unavailable', async () => {
  const direct = settingsModel.createSettingsEnvelope({ ...settingsModel.getDefaultSettings(), next_invoice_number: 42 }, 4);
  const controller = mountSettingsController({ directEnvelope: direct, locks: null });
  const fields = controller.elements['settings-form'].elements;
  fields.invoice_prefix.value = 'NEW-';

  await controller.handlers.submit({ preventDefault() {} });

  assert.equal(controller.storage.get('freelanceflow_settings_v1'), settingsModel.serializeSettingsEnvelope(direct));
  assert.equal(controller.elements['settings-status'].hidden, false);
  assert.equal(controller.elements['settings-status'].textContent.includes('bloqueo'), true);
  assert.deepEqual(controller.activity, []);

  await controller.handlers.click();

  assert.equal(controller.storage.get('freelanceflow_settings_v1'), settingsModel.serializeSettingsEnvelope(direct));
  assert.deepEqual(controller.activity, []);
});
