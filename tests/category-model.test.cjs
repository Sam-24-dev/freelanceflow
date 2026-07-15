const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../assets/js/category-model.js');

const baseCategories = [
  { id: 'cat_001', nombre_categoria: 'Software y suscripciones', es_deducible_por_defecto: true, presupuesto_mensual: 100, estado: 'activo' },
  { id: 'cat_002', nombre_categoria: 'Transporte', es_deducible_por_defecto: false, presupuesto_mensual: 20, estado: 'activo' },
  { id: 'cat_003', nombre_categoria: 'Oficina', es_deducible_por_defecto: true, estado: 'inactivo' }
];

const expenses = [
  { categoria_gasto_id: 'cat_001', monto: 50, fecha_gasto: '2026-07-01' },
  { categoria_gasto_id: 'cat_001', monto: 30, fecha_gasto: '2026-07-15' },
  { categoria_gasto_id: 'cat_002', monto: 25, fecha_gasto: '2026-07-03' },
  { categoria_gasto_id: 'cat_001', monto: 90, fecha_gasto: '2026-06-03' }
];

test('normalizes legacy expense categories with safe defaults and no tipo field', () => {
  const category = model.normalizeCategory({ id: 'cat_010', nombre_categoria: '  Internet  ' });

  assert.deepEqual(category, {
    id: 'cat_010',
    nombre_categoria: 'Internet',
    descripcion: '',
    es_deducible_por_defecto: false,
    presupuesto_mensual: null,
    estado: 'activo'
  });
  assert.equal(Object.hasOwn(category, 'tipo'), false);
});

test('validates required unique names and non-negative monthly budget', () => {
  assert.deepEqual(model.validateCategory({ nombre_categoria: '   ' }, baseCategories).errors.nombre_categoria, 'Escribe el nombre de la categoría.');
  assert.deepEqual(model.validateCategory({ nombre_categoria: 'software y suscripciones' }, baseCategories).errors.nombre_categoria, 'Ya existe una categoría con ese nombre.');
  assert.deepEqual(model.validateCategory({ nombre_categoria: 'Viajes', presupuesto_mensual: -1 }, baseCategories).errors.presupuesto_mensual, 'Ingresa un presupuesto mensual mayor o igual a cero.');
  assert.equal(model.validateCategory({ nombre_categoria: 'Viajes', presupuesto_mensual: 0 }, baseCategories).valid, true);
});

test('filters categories by search, deductible flag and status', () => {
  const filtered = model.filterCategories(baseCategories, { query: 'soft sus', deductible: 'deducible', status: 'activo' });

  assert.deepEqual(filtered.map((category) => category.id), ['cat_001']);
  assert.deepEqual(model.filterCategories(baseCategories, { deductible: 'no-deducible' }).map((category) => category.id), ['cat_002']);
});

test('derives usage and metrics from current month expense data', () => {
  const withUsage = model.applyCategoryUsage(baseCategories, expenses, '2026-07');
  const metrics = model.calculateCategoryMetrics(withUsage);

  assert.equal(withUsage.find((category) => category.id === 'cat_001').usos, 3);
  assert.equal(withUsage.find((category) => category.id === 'cat_001').gasto_mensual, 80);
  assert.deepEqual(metrics, {
    total: 3,
    deducible: 2,
    mostUsed: 'Software y suscripciones',
    budgetAttention: { count: 2, label: '2 categorías requieren atención' }
  });
});

test('chooses inactivate for used categories and delete for unused categories', () => {
  assert.equal(model.getCategoryRemovalAction({ id: 'cat_001', usos: 2 }), 'inactivate');
  assert.equal(model.getCategoryRemovalAction({ id: 'cat_999', usos: 0 }), 'delete');
});

test('creates category records without income/category type drift', () => {
  const record = model.createCategoryRecord({ nombre_categoria: 'Comisiones', presupuesto_mensual: '45.50', es_deducible_por_defecto: true }, { id: 'cat_999' });

  assert.equal(record.id, 'cat_999');
  assert.equal(record.presupuesto_mensual, 45.5);
  assert.equal(record.estado, 'activo');
  assert.equal(Object.hasOwn(record, 'tipo'), false);
});

test('keeps persisted catalog state authoritative while still seeding first load', () => {
  assert.deepEqual(model.mergeCategories(baseCategories, undefined).map((category) => category.id), ['cat_001', 'cat_002', 'cat_003']);

  const stored = {
    version: 2,
    items: [{ ...baseCategories[0], nombre_categoria: 'Software editado' }],
    deletedIds: ['cat_002']
  };

  assert.deepEqual(model.mergeCategories(baseCategories, stored).map((category) => category.id), ['cat_001', 'cat_003']);
  assert.equal(model.mergeCategories(baseCategories, stored)[0].nombre_categoria, 'Software editado');
});
