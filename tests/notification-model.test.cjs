const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../assets/js/notification-model.js');

const data = {
  facturas: [
    { id: 'due', numero_factura: 'FAC-1', fecha_vencimiento: '2026-07-16', saldo_pendiente: 25, estado: 'SENT', moneda: 'USD' },
    { id: 'draft', fecha_vencimiento: '2026-07-01', saldo_pendiente: 25, estado: 'DRAFT' },
    { id: 'paid', fecha_vencimiento: '2026-07-01', saldo_pendiente: 0, estado: 'PAID' }
  ],
  propuestas: [
    { id: 'soon', titulo_propuesta: 'Web', fecha_validez: '2026-08-16', estado: 'SENT' },
    { id: 'late', fecha_validez: '2026-07-16', estado: 'SENT' },
    { id: 'closed', fecha_validez: '2026-08-01', estado: 'ACCEPTED' }
  ],
  pagos_factura: [{ id: 'pay-1', factura_id: 'due', monto_pagado: 25, fecha_pago: '2026-07-17' }]
};

test('derives only eligible alerts with stable IDs, local dates, and descending order', () => {
  const alerts = model.deriveNotifications(data, '2026-07-17');
  assert.deepEqual(alerts.map((item) => item.id), ['proposal-expiring:soon', 'payment-received:pay-1', 'invoice-overdue:due']);
  assert.equal(alerts[0].targetHref, 'propuestas.html');
  assert.equal(alerts[1].targetHref, 'transacciones.html');
  assert.equal(alerts[2].targetHref, 'facturas.html');
  assert.equal(data.facturas[0].fecha_vencimiento, '2026-07-16');
});

test('filters enabled types and validates at least one channel', () => {
  const alerts = model.deriveNotifications(data, '2026-07-17');
  const preferences = model.normalizePreferences({ notificar_facturas_vencidas: false, channels: ['email'] });
  assert.deepEqual(model.applyPreferences(alerts, preferences).map((item) => item.type), ['proposal_expiring', 'payment_received']);
  assert.equal(model.validatePreferences({ channels: [] }).valid, false);
  assert.equal(model.validatePreferences({ channels: ['in_app'] }).valid, true);
});

test('normalizes corrupt storage and retains only live read IDs when marking alerts read', () => {
  const defaults = model.parseStoredState('{bad json');
  assert.deepEqual(defaults.readIds, []);
  const state = model.pruneState({ readIds: ['missing', 'invoice-overdue:due'] }, ['invoice-overdue:due']);
  assert.deepEqual(model.markRead(state, 'invoice-overdue:due').readIds, ['invoice-overdue:due']);
  assert.deepEqual(model.markAllRead({ readIds: [] }, ['invoice-overdue:due', 'payment-received:pay-1']).readIds, ['invoice-overdue:due', 'payment-received:pay-1']);
});

test('deduplicates repeated source IDs and does not shift YYYY-MM-DD dates', () => {
  const alerts = model.deriveNotifications({ ...data, pagos_factura: [...data.pagos_factura, { ...data.pagos_factura[0] }] }, '2026-07-17');
  assert.equal(alerts.filter((item) => item.id === 'payment-received:pay-1').length, 1);
  assert.equal(model.parseDate('2026-07-17').getDate(), 17);
});
