const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../assets/js/category-model.js');

const baseCategories = [
  { id: 'cat_001', nombre_categoria: 'Software y suscripciones', descripcion: '', es_deducible_por_defecto: true, presupuesto_mensual: 100, estado: 'activo' },
  { id: 'cat_002', nombre_categoria: 'Transporte', descripcion: '', es_deducible_por_defecto: false, presupuesto_mensual: 20, estado: 'activo' },
  { id: 'cat_003', nombre_categoria: 'Oficina', descripcion: '', es_deducible_por_defecto: true, presupuesto_mensual: null, estado: 'inactivo' }
];

const expenses = [
  { categoria_gasto_id: 'cat_001', monto: 50, fecha_gasto: '2026-07-01' },
  { categoria_gasto_id: 'cat_001', monto: 30, fecha_gasto: '2026-07-15' },
  { categoria_gasto_id: 'cat_002', monto: 25, fecha_gasto: '2026-07-03' },
  { categoria_gasto_id: 'cat_001', monto: 90, fecha_gasto: '2026-06-03' }
];

test('normalizes a valid expense category without type drift', () => {
  const category = model.normalizeCategory({
    id: ' cat_010 ',
    nombre_categoria: '  Internet  ',
    descripcion: '  Conectividad  ',
    es_deducible_por_defecto: false,
    presupuesto_mensual: null,
    estado: 'activo'
  });

  assert.deepEqual(category, {
    id: 'cat_010',
    nombre_categoria: 'Internet',
    descripcion: 'Conectividad',
    es_deducible_por_defecto: false,
    presupuesto_mensual: null,
    estado: 'activo'
  });
  assert.equal(Object.hasOwn(category, 'tipo'), false);
});

test('validates required unique names and non-negative monthly budget', () => {
  assert.deepEqual(model.validateCategory({ nombre_categoria: '   ' }, baseCategories).errors.nombre_categoria, 'Escribe el nombre de la categoría.');
  assert.deepEqual(model.validateCategory({ ...baseCategories[1], id: 'cat_010', nombre_categoria: 'software y suscripciones' }, baseCategories).errors.nombre_categoria, 'Ya existe una categoría con ese nombre.');
  assert.deepEqual(model.validateCategory({ ...baseCategories[1], id: 'cat_010', nombre_categoria: 'Viajes', presupuesto_mensual: -1 }, baseCategories).errors.presupuesto_mensual, 'Ingresa un presupuesto mensual mayor o igual a cero.');
  assert.equal(model.validateCategory({ ...baseCategories[1], id: 'cat_010', nombre_categoria: 'Viajes', presupuesto_mensual: 0 }, baseCategories).valid, true);
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

test('FF-CAT-001 rejects invalid raw category shapes before normalization', () => {
  const valid = { ...baseCategories[1], id: 'cat_010', nombre_categoria: 'Viajes' };
  const invalid = [
    null,
    'category',
    [],
    { ...valid, id: '' },
    { ...valid, estado: undefined },
    { ...valid, estado: 'archivado' },
    { ...valid, es_deducible_por_defecto: undefined },
    { ...valid, es_deducible_por_defecto: 'true' },
    { ...valid, nombre_categoria: '' },
    { ...valid, presupuesto_mensual: -1 },
    { ...valid, presupuesto_mensual: NaN },
    { ...valid, presupuesto_mensual: Infinity },
    { ...valid, presupuesto_mensual: '10' },
    { ...valid, extra: true }
  ];

  invalid.forEach((category) => assert.equal(model.validateCategory(category, baseCategories).valid, false));
  assert.equal(model.validateCategory({ ...valid, id: 'cat_001' }, baseCategories).errors.id, 'Ya existe una categoría con ese identificador.');
  assert.equal(model.validateCategory({ ...valid, nombre_categoria: ' SÓFTWARE Y SUSCRIPCIONES ' }, baseCategories).errors.nombre_categoria, 'Ya existe una categoría con ese nombre.');
  assert.deepEqual(model.validateCategory(valid, baseCategories), { valid: true, errors: {} });
});

test('FF-CAT-001 rejects duplicate ids and normalized names across a raw catalog', () => {
  assert.equal(model.validateCatalog([baseCategories[0], { ...baseCategories[1], id: 'cat_001' }]).valid, false);
  assert.equal(model.validateCatalog([baseCategories[0], { ...baseCategories[1], nombre_categoria: 'SÓFTWARE Y SUSCRIPCIONES' }]).valid, false);
  assert.equal(model.validateCatalog([baseCategories[0], [baseCategories[1]]]).valid, false);
});

test('FF-CAT-002 accepts only the exact versioned payload and otherwise preserves the baseline', () => {
  const payload = {
    version: 2,
    items: [
      { ...baseCategories[0], nombre_categoria: 'Software local' },
      { ...baseCategories[1], id: 'cat_999', nombre_categoria: 'Comisiones' }
    ],
    deletedIds: ['cat_002']
  };
  const effective = model.mergeCategories(baseCategories, payload);
  assert.deepEqual(effective.map(({ id }) => id), ['cat_001', 'cat_003', 'cat_999']);
  assert.equal(effective[0].nombre_categoria, 'Software local');

  const invalidPayloads = [
    { ...payload, version: 999 },
    null,
    [],
    { version: 2, items: {}, deletedIds: [] },
    { version: 2, items: [], deletedIds: {} },
    { version: 2, items: [], deletedIds: [''] },
    { version: 2, items: [], deletedIds: ['cat_002', 'cat_002'] },
    { version: 2, items: [], deletedIds: [1] },
    { version: 2, items: [], deletedIds: ['cat_unknown'] },
    { ...payload, items: [{ ...baseCategories[0], estado: 'archivado' }] }
  ];
  invalidPayloads.forEach((stored) => assert.deepEqual(model.mergeCategories(baseCategories, stored), baseCategories));
});

test('FF-CAT-002 recovers from corrupt storage without deleting unrelated keys', () => {
  let removeCalls = 0;
  const storage = {
    getItem: (key) => key === model.CATEGORY_STORAGE_KEY ? '{bad json' : 'keep',
    setItem() {},
    removeItem() { removeCalls += 1; }
  };

  const result = model.readEffectiveCatalog(baseCategories, storage);
  assert.equal(result.ok, false);
  assert.deepEqual(result.categories, baseCategories);
  assert.equal(removeCalls, 0);
});

test('FF-CAT-003 catches a blocked default Storage getter inside the model boundary', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage'); const blocked = new DOMException('blocked', 'SecurityError');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw blocked; } });
  try {
    const read = model.readEffectiveCatalog(baseCategories); const write = model.saveEffectiveCatalog(baseCategories, baseCategories);
    assert.deepEqual([read.ok, read.error, write.ok, write.error], [false, blocked, false, blocked]);
    assert.deepEqual(read.categories, baseCategories);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage;
  }
});

test('FF-CAT-003 persists candidates atomically and reports blocked storage explicitly', () => {
  const candidate = [...baseCategories, { ...baseCategories[1], id: 'cat_999', nombre_categoria: 'Comisiones' }];
  const snapshot = structuredClone(candidate);
  const current = JSON.stringify({ version: 2, items: baseCategories, deletedIds: [] });
  const scenarios = [
    { getItem() { throw new Error('blocked getter'); }, setItem() {} },
    { getItem() { return current; }, setItem() { throw new Error('blocked setter'); } },
    { getItem() { return current; }, setItem() { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; } }
  ];

  scenarios.forEach((storage) => {
    const result = model.saveEffectiveCatalog(baseCategories, candidate, [], storage);
    assert.equal(result.ok, false);
    assert.deepEqual(candidate, snapshot);
  });

  let stored = current;
  const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  const result = model.saveEffectiveCatalog(baseCategories, candidate, [], storage);
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(stored), { version: 2, items: candidate, deletedIds: [] });
});

test('FF-CAT-005 offers active categories plus only the selected inactive historical category', () => {
  assert.deepEqual(model.getSelectableCategories(baseCategories).map(({ id }) => id), ['cat_001', 'cat_002']);
  assert.deepEqual(model.getSelectableCategories(baseCategories, 'cat_003').map(({ id }) => id), ['cat_001', 'cat_002', 'cat_003']);
  assert.deepEqual(model.getSelectableCategories(baseCategories, 'cat_unknown').map(({ id }) => id), ['cat_001', 'cat_002']);
});
