const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateSummary,
  filterTransactions,
  getProjectsForClient,
  isValidDate,
  shouldOpenTransactionFormFromHash,
  validateTransaction
} = require('../assets/js/transaction-model.js');

const sampleTransactions = [
  {
    id: 'mov_1',
    tipo: 'ingreso',
    fecha: '2026-06-10',
    monto: 850,
    descripcion: 'Pago de factura',
    categoria: 'Ingreso por factura',
    cliente: 'Bodega Andina',
    proyecto: 'Rediseño web'
  },
  {
    id: 'mov_2',
    tipo: 'gasto',
    fecha: '2026-06-08',
    monto: 54.99,
    descripcion: 'Suscripción de diseño',
    categoria: 'Software y suscripciones',
    cliente: '',
    proyecto: 'Rediseño web'
  },
  {
    id: 'mov_3',
    tipo: 'ingreso',
    fecha: '2026-05-20',
    monto: 400,
    descripcion: 'Anticipo',
    categoria: 'Ingreso por factura',
    cliente: 'BrightWave',
    proyecto: 'Campaña digital'
  }
];

test('calculateSummary returns income, expenses, net flow and count', () => {
  assert.deepEqual(calculateSummary(sampleTransactions.slice(0, 2)), {
    income: 850,
    expense: 54.99,
    net: 795.01,
    count: 2
  });
});

test('filterTransactions combines type, month, category and normalized search', () => {
  const result = filterTransactions(sampleTransactions, {
    type: 'ingreso',
    month: '2026-06',
    category: 'Ingreso por factura',
    query: 'bodega rediseño'
  });

  assert.deepEqual(result.map((item) => item.id), ['mov_1']);
});

test('filterTransactions sorts newest movements first', () => {
  const result = filterTransactions(sampleTransactions, { type: 'todos' });
  assert.deepEqual(result.map((item) => item.id), ['mov_1', 'mov_2', 'mov_3']);
});


test('shouldOpenTransactionFormFromHash detects the mobile add transaction target', () => {
  assert.equal(shouldOpenTransactionFormFromHash('#transaction-form-panel'), true);
  assert.equal(shouldOpenTransactionFormFromHash('transaction-form-panel'), true);
  assert.equal(shouldOpenTransactionFormFromHash('#other-section'), false);
});

test('validateTransaction reports each required business field', () => {
  assert.equal(validateTransaction({}).field, 'tipo');
  assert.equal(validateTransaction({ tipo: 'ingreso', monto: 0 }).field, 'monto');
  assert.equal(validateTransaction({ tipo: 'ingreso', monto: 10, fecha: 'bad' }).field, 'fecha');
  assert.equal(validateTransaction({ tipo: 'ingreso', monto: 10, fecha: '2026-06-10' }).field, 'categoria');
  const accountResult = validateTransaction({ tipo: 'ingreso', monto: 10, fecha: '2026-06-10', categoria: 'cat' });
  assert.equal(accountResult.field, 'cuenta_id');
  assert.equal(accountResult.message, 'Selecciona una cuenta.');
});

test('validateTransaction accepts a complete transaction', () => {
  assert.deepEqual(validateTransaction({
    tipo: 'gasto',
    monto: 12.5,
    fecha: '2026-06-12',
    categoria: 'cat_002',
    cuenta_id: 'aux_cta_002'
  }), { valid: true });
});

test('isValidDate rejects calendar overflow dates', () => {
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('2026-06-12'), true);
});

test('getProjectsForClient only returns projects for the selected client', () => {
  const projects = [
    { id: 'p1', cliente_id: 'c1' },
    { id: 'p2', cliente_id: 'c2' },
    { id: 'p3', cliente_id: 'c1' }
  ];
  assert.deepEqual(getProjectsForClient(projects, 'c1').map((project) => project.id), ['p1', 'p3']);
  assert.deepEqual(getProjectsForClient(projects, ''), []);
});
