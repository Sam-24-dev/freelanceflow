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

const expenseCategories = [
  { id: 'cat', estado: 'activo', es_deducible_por_defecto: true },
  { id: 'cat_inactive', estado: 'inactivo', es_deducible_por_defecto: false }
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
  }, { categories: [{ id: 'cat_002', estado: 'activo' }] }), { valid: true });
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

test('sanitizeTransactions excludes malformed, non-USD and duplicate persisted records', () => {
  const { sanitizeTransactions } = require('../assets/js/transaction-model.js');
  const result = sanitizeTransactions([
    { id: 'ok', tipo: 'gasto', monto: 10, fecha: '2026-06-10', moneda: 'USD', categoria_gasto_id: 'cat', cuenta_id: 'account' },
    { id: 'bad-date', tipo: 'gasto', monto: 10, fecha: '2026-02-30', moneda: 'USD', categoria_gasto_id: 'cat', cuenta_id: 'account' },
    { id: 'eur', tipo: 'ingreso', monto: 10, fecha: '2026-06-10', moneda: 'EUR', categoria_gasto_id: 'income_invoice', cuenta_id: 'account' },
    { id: 'dup', tipo: 'ingreso', monto: 10, fecha: '2026-06-10', moneda: 'USD', categoria_gasto_id: 'income_invoice', cuenta_id: 'account' },
    { id: 'dup', tipo: 'gasto', monto: 10, fecha: '2026-06-11', moneda: 'USD', categoria_gasto_id: 'cat', cuenta_id: 'account' }
  ], { categories: expenseCategories });
  assert.deepEqual(result.items.map((item) => item.id), ['ok']);
  assert.equal(result.rejected.length, 4);
  assert.deepEqual(calculateSummary(result.items), { income: 0, expense: 10, net: -10, count: 1 });
});

test('validateTransaction rejects client-project mismatch and requires verified invoice origin', () => {
  const { validateTransaction } = require('../assets/js/transaction-model.js');
  const base = { tipo: 'ingreso', monto: 10, fecha: '2026-06-10', categoria: 'income_invoice', cuenta_id: 'account', origen_oficial: 'pago_factura' };
  assert.equal(validateTransaction(base).field, 'origen_id');
  assert.equal(validateTransaction({ ...base, origen_id: 'pay_1', cliente_id: 'c1', proyecto_id: 'p2' }, { projects: [{ id: 'p2', cliente_id: 'c2' }] }).field, 'proyecto_id');
  assert.deepEqual(validateTransaction({ ...base, origen_oficial: 'movimiento_manual' }), { valid: true });
});

test('toExpenseRecords adapts only valid expense movements without double counting incomes', () => {
  const { toExpenseRecords } = require('../assets/js/transaction-model.js');
  const records = toExpenseRecords([
    { id: 'income', tipo: 'ingreso', monto: 20, fecha: '2026-06-01', moneda: 'USD', cuenta_id: 'a' },
    { id: 'expense', tipo: 'gasto', monto: 12.5, fecha: '2026-06-02', moneda: 'USD', categoria_gasto_id: 'cat', cuenta_id: 'a' }
  ], { categories: expenseCategories });
  assert.deepEqual(records, [{ id: 'expense', categoria_gasto_id: 'cat', monto: 12.5, fecha_gasto: '2026-06-02', cliente_id: '', proyecto_relacionado_id: '', es_deducible: true }]);
});

test('toExpenseRecords keeps valid project-linked expenses for downstream reports and categories', () => {
  const { toExpenseRecords } = require('../assets/js/transaction-model.js');
  const records = toExpenseRecords([
    { id: 'project-expense', tipo: 'gasto', monto: 18, fecha: '2026-06-03', moneda: 'USD', categoria_gasto_id: 'cat', cuenta_id: 'a', cliente_id: 'c1', proyecto_id: 'p1' }
  ], { projects: [{ id: 'p1', cliente_id: 'c1' }], categories: expenseCategories });
  assert.deepEqual(records, [{ id: 'project-expense', categoria_gasto_id: 'cat', monto: 18, fecha_gasto: '2026-06-03', cliente_id: 'c1', proyecto_relacionado_id: 'p1', es_deducible: true }]);
});

test('toExpenseRecords resolves legacy auxiliary category ids and deductible metadata', () => {
  const { toExpenseRecords } = require('../assets/js/transaction-model.js');
  const records = toExpenseRecords([
    { id: 'legacy-expense', tipo: 'gasto', monto: 9, fecha: '2026-06-04', moneda: 'USD', categoria_mock_auxiliar: 'cat_legacy', cuenta_id: 'a' }
  ], { categories: [{ id: 'cat_legacy', estado: 'activo', es_deducible_por_defecto: false }] });

  assert.deepEqual(records, [{ id: 'legacy-expense', categoria_gasto_id: 'cat_legacy', monto: 9, fecha_gasto: '2026-06-04', cliente_id: '', proyecto_relacionado_id: '', es_deducible: false }]);
});

const canonicalMockData = require('../assets/data/mock-data.json');

test('keeps canonical mov_003 without cliente_id and adapts its project client', () => {
  const { sanitizeTransactions, toExpenseRecords } = require('../assets/js/transaction-model.js');
  const canonicalExpense = canonicalMockData.movimientos_financieros_mock_auxiliar.find(({ id }) => id === 'mov_003');
  const projects = canonicalMockData.proyectos;

  const categories = canonicalMockData.categorias_gasto;
  assert.equal(sanitizeTransactions([canonicalExpense], { projects, categories }).items[0].cliente_id, 'cli_001');
  assert.deepEqual(toExpenseRecords([canonicalExpense], { projects, categories }), [{
    id: 'mov_003', categoria_gasto_id: 'cat_001', monto: 54.99, fecha_gasto: '2026-06-08',
    cliente_id: 'cli_001', proyecto_relacionado_id: 'proy_001', es_deducible: true
  }]);
});

test('rejects explicit mismatched and unknown project clients', () => {
  const { sanitizeTransactions } = require('../assets/js/transaction-model.js');
  const canonicalExpense = canonicalMockData.movimientos_financieros_mock_auxiliar.find(({ id }) => id === 'mov_003');
  const projects = canonicalMockData.proyectos;

  const categories = canonicalMockData.categorias_gasto;
  assert.equal(sanitizeTransactions([{ ...canonicalExpense, cliente_id: 'cli_999' }], { projects, categories }).items.length, 0);
  assert.equal(sanitizeTransactions([{ ...canonicalExpense, proyecto_id: 'proy_unknown' }], { projects, categories }).items.length, 0);
});

test('FF-CAT-004 rejects unknown expense references while retaining active and inactive history', () => {
  const base = { tipo: 'gasto', monto: 10, fecha: '2026-06-10', cuenta_id: 'account' };
  assert.equal(validateTransaction({ ...base, categoria: 'unknown' }, { categories: expenseCategories }).field, 'categoria');
  assert.deepEqual(validateTransaction({ ...base, categoria: 'cat' }, { categories: expenseCategories }), { valid: true });
  assert.equal(validateTransaction({ ...base, categoria: 'cat_inactive' }, { categories: expenseCategories }).field, 'categoria');

  const stored = require('../assets/js/transaction-model.js').sanitizeTransactions([
    { id: 'active', ...base, moneda: 'USD', categoria_gasto_id: 'cat' },
    { id: 'inactive', ...base, moneda: 'USD', categoria_gasto_id: 'cat_inactive' },
    { id: 'unknown', ...base, moneda: 'USD', categoria_gasto_id: 'unknown' }
  ], { categories: expenseCategories });
  assert.deepEqual(stored.items.map(({ id }) => id), ['active', 'inactive']);
  assert.deepEqual(stored.rejected.map(({ item }) => item.id), ['unknown']);
});

test('FF-CAT-005 permits the selected inactive category only while editing its historical movement', () => {
  const transaction = { tipo: 'gasto', monto: 10, fecha: '2026-06-10', categoria: 'cat_inactive', cuenta_id: 'account' };
  assert.equal(validateTransaction(transaction, { categories: expenseCategories }).valid, false);
  assert.equal(validateTransaction(transaction, { categories: expenseCategories, selectedCategoryId: 'cat_inactive' }).valid, true);
  assert.equal(validateTransaction({ ...transaction, categoria: 'unknown' }, { categories: expenseCategories, selectedCategoryId: 'unknown' }).valid, false);
});

test('FF-CAT-007 derives deductible metadata from the validated effective category', () => {
  const records = require('../assets/js/transaction-model.js').toExpenseRecords(
    canonicalMockData.movimientos_financieros_mock_auxiliar,
    { projects: canonicalMockData.proyectos, categories: canonicalMockData.categorias_gasto }
  );
  assert.deepEqual(records.map(({ id, monto, categoria_gasto_id, es_deducible }) => ({ id, monto, categoria_gasto_id, es_deducible })), [
    { id: 'mov_003', monto: 54.99, categoria_gasto_id: 'cat_001', es_deducible: true },
    { id: 'mov_004', monto: 12.5, categoria_gasto_id: 'cat_002', es_deducible: true }
  ]);
  assert.equal(Number(records.reduce((sum, item) => sum + item.monto, 0).toFixed(2)), 67.49);
});
