const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../assets/js/fiscal-config-model.js');

test('normalizes fiscal values without mutating the input and disables tax when switched off', () => {
  const input = {
    identificacion_fiscal: '  ABC-12345  ',
    regimen_tributario: '  General ',
    porcentaje_retencion_estimado: '10.129',
    aplica_impuesto_valor_agregado: false,
    porcentaje_impuesto: '16'
  };

  assert.deepEqual(model.normalizeFiscalConfiguration(input), {
    identificacion_fiscal: 'ABC-12345',
    regimen_tributario: 'General',
    porcentaje_retencion_estimado: 10.13,
    aplica_impuesto_valor_agregado: false,
    porcentaje_impuesto: 0
  });
  assert.equal(input.porcentaje_impuesto, '16');
});

test('validates required text and finite rates between zero and one hundred', () => {
  const empty = model.validateFiscalConfiguration({});
  assert.deepEqual(empty.errors, {
    identificacion_fiscal: 'La identificación fiscal es obligatoria.',
    regimen_tributario: 'Selecciona o ingresa un régimen tributario.',
    porcentaje_retencion_estimado: 'El porcentaje debe estar entre 0 y 100.'
  });

  for (const value of [' ', '-1', '101', 'Infinity', 'texto', '10,5']) {
    assert.equal(model.validateFiscalConfiguration({ identificacion_fiscal: 'ID', regimen_tributario: 'General', porcentaje_retencion_estimado: value }).valid, false);
  }
  assert.equal(model.validateFiscalConfiguration({ identificacion_fiscal: 'ID', regimen_tributario: 'General', porcentaje_retencion_estimado: 0 }).valid, true);
  assert.equal(model.validateFiscalConfiguration({ identificacion_fiscal: 'ID', regimen_tributario: 'General', porcentaje_retencion_estimado: 100 }).valid, true);
});

test('requires tax only when enabled and calculates the neutral estimate', () => {
  const base = { identificacion_fiscal: 'ID', regimen_tributario: 'General', porcentaje_retencion_estimado: 10 };
  assert.equal(model.validateFiscalConfiguration({ ...base, aplica_impuesto_valor_agregado: true }).errors.porcentaje_impuesto, 'El porcentaje debe estar entre 0 y 100.');
  assert.deepEqual(model.calculateFiscalEstimate({ ...base, aplica_impuesto_valor_agregado: false, porcentaje_impuesto: 16 }), {
    base: 1000, retention: 100, tax: 0, estimatedTotal: 900
  });
  assert.deepEqual(model.calculateFiscalEstimate({ ...base, aplica_impuesto_valor_agregado: true, porcentaje_impuesto: 16 }), {
    base: 1000, retention: 100, tax: 160, estimatedTotal: 1060
  });
  assert.equal(model.calculateFiscalEstimate({ ...base, porcentaje_retencion_estimado: 100, aplica_impuesto_valor_agregado: false }).estimatedTotal, 0);
});

test('does not calculate a partial preview when an applicable rate is missing or invalid', () => {
  const base = { identificacion_fiscal: 'ID', regimen_tributario: 'General', porcentaje_retencion_estimado: 10 };

  assert.equal(model.calculateFiscalEstimate({ ...base, aplica_impuesto_valor_agregado: true, porcentaje_impuesto: '' }), null);
  assert.equal(model.calculateFiscalEstimate({ ...base, aplica_impuesto_valor_agregado: true, porcentaje_impuesto: '101' }), null);
  assert.equal(model.calculateFiscalEstimate({ ...base, porcentaje_retencion_estimado: '' }), null);
});

test('ignores corrupt or non-object saved fiscal configuration', () => {
  assert.equal(model.parseStoredFiscalConfiguration('{bad json'), null);
  assert.equal(model.parseStoredFiscalConfiguration('[]'), null);
  assert.equal(model.parseStoredFiscalConfiguration('{"identificacion_fiscal":""}'), null);
  assert.deepEqual(model.parseStoredFiscalConfiguration('{"identificacion_fiscal":" ID ","regimen_tributario":"General","porcentaje_retencion_estimado":0,"aplica_impuesto_valor_agregado":false,"porcentaje_impuesto":10}'), {
    identificacion_fiscal: 'ID', regimen_tributario: 'General', porcentaje_retencion_estimado: 0, aplica_impuesto_valor_agregado: false, porcentaje_impuesto: 0
  });
});
