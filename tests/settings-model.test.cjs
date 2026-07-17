const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../assets/js/settings-model.js');

test('returns independent defaults', () => {
  const first = model.getDefaultSettings();
  const second = model.getDefaultSettings();
  first.invoice_prefix = 'X-';
  assert.deepEqual(second, { invoice_prefix: 'FAC-', next_invoice_number: 25, default_due_days: 15, default_currency: 'USD' });
});

test('normalizes settings without mutating input', () => {
  const input = { invoice_prefix: ' FAC- ', next_invoice_number: '25', default_due_days: '15', default_currency: 'usd' };
  assert.deepEqual(model.normalizeSettings(input), { invoice_prefix: 'FAC-', next_invoice_number: 25, default_due_days: 15, default_currency: 'USD' });
  assert.equal(input.invoice_prefix, ' FAC- ');
});

test('validates required prefix, positive integer numbers, and currency catalog', () => {
  assert.equal(model.validateSettings({ invoice_prefix: ' ', next_invoice_number: 25, default_due_days: 15, default_currency: 'USD' }).errors.invoice_prefix, 'El prefijo de factura es obligatorio.');
  for (const value of ['0', '-1', '1.5', 'texto']) assert.ok(model.validateSettings({ invoice_prefix: 'FAC-', next_invoice_number: value, default_due_days: 15, default_currency: 'USD' }).errors.next_invoice_number);
  for (const value of ['0', '-1', '1.5', 'texto']) assert.ok(model.validateSettings({ invoice_prefix: 'FAC-', next_invoice_number: 25, default_due_days: value, default_currency: 'USD' }).errors.default_due_days);
  assert.equal(model.validateSettings({ invoice_prefix: 'FAC-', next_invoice_number: 25, default_due_days: 15, default_currency: 'COP' }).errors.default_currency, 'Selecciona una moneda predeterminada.');
});

test('formats and previews valid settings', () => {
  assert.equal(model.formatInvoiceNumber('FAC-', 25), 'FAC-0025');
  assert.equal(model.formatInvoiceNumber('FAC-', 10000), 'FAC-10000');
  assert.deepEqual(model.buildSettingsPreview({ invoice_prefix: 'FAC-', next_invoice_number: 25, default_due_days: 15, default_currency: 'USD' }), {
    invoice_number: 'FAC-0025', due_behavior: '15 días después de la emisión', currency: 'USD'
  });
});

test('uses defaults for corrupt or invalid stored settings and preserves valid records', () => {
  const defaults = model.getDefaultSettings();
  assert.deepEqual(model.parseStoredSettings('{bad json'), defaults);
  assert.deepEqual(model.parseStoredSettings('[]'), defaults);
  assert.deepEqual(model.parseStoredSettings('{"invoice_prefix":""}'), defaults);
  const saved = { invoice_prefix: 'FF-', next_invoice_number: 26, default_due_days: 30, default_currency: 'EUR' };
  assert.deepEqual(model.parseStoredSettings(JSON.stringify(saved)), saved);
});
