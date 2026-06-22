const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMobileInvoiceAlert,
  createDashboardTransactionPreviews
} = require('../assets/js/dashboard-model.js');

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
