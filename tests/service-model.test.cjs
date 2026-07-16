const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../assets/js/service-model.js');

const services = [
  { id: 'srv_001', nombre_servicio: 'Consultoría UX/UI', descripcion: 'Auditoría de experiencia', unidad_medida: 'Hora', tarifa_unitaria: 75, moneda: 'USD' },
  { id: 'srv_002', nombre_servicio: 'Implementación web', descripcion: 'Sitio institucional', unidad_medida: 'Proyecto', tarifa_unitaria: 1200, moneda: 'USD' },
  { id: 'srv_003', nombre_servicio: 'Kit de interfaz', descripcion: 'Entrega de componentes', unidad_medida: 'Entregable', tarifa_unitaria: 340, moneda: 'EUR' }
];

test('normalizes service text and safely defaults incomplete records', () => {
  assert.deepEqual(model.normalizeService({ id: ' srv_010 ', nombre_servicio: '  Auditoría  ', descripcion: '  Revisión  ' }), {
    id: 'srv_010', nombre_servicio: 'Auditoría', descripcion: 'Revisión', unidad_medida: '', tarifa_unitaria: null, moneda: 'USD'
  });
});

test('validates required unique names, approved units and positive finite rates', () => {
  assert.equal(model.validateService({ nombre_servicio: '  ' }, services).errors.nombre_servicio, 'Ingresá un nombre para el servicio.');
  assert.equal(model.validateService({ nombre_servicio: 'consultoría ux/ui', unidad_medida: 'Hora', tarifa_unitaria: 10 }, services).errors.nombre_servicio, 'Ya existe un servicio con ese nombre.');
  assert.equal(model.validateService({ nombre_servicio: 'Nuevo', unidad_medida: 'Mensual', tarifa_unitaria: 10 }, services).errors.unidad_medida, 'Seleccioná una unidad de medida.');
  assert.equal(model.validateService({ nombre_servicio: 'Nuevo', unidad_medida: 'Hora', tarifa_unitaria: 'Infinity' }, services).errors.tarifa_unitaria, 'Ingresá una tarifa mayor que cero.');
  assert.equal(model.validateService({ nombre_servicio: 'Nuevo', unidad_medida: 'Hora', tarifa_unitaria: '12.50', moneda: 'MXN' }, services).valid, true);
});

test('filters by normalized name or description and unit', () => {
  assert.deepEqual(model.filterServices(services, { query: 'experiencia', unit: 'Hora' }).map((service) => service.id), ['srv_001']);
  assert.deepEqual(model.filterServices(services, { unit: 'Entregable' }).map((service) => service.id), ['srv_003']);
});

test('calculates currency-safe metrics with deterministic most-used unit ties', () => {
  assert.deepEqual(model.calculateServiceMetrics(services), { total: 3, averageRate: 637.5, averageCurrency: 'USD', mostUsedUnit: 'Hora' });
  assert.equal(model.calculateServiceMetrics([]).mostUsedUnit, 'Sin registros');
});

test('creates updates and removes records without mutating the catalogue', () => {
  const created = model.createServiceRecord({ nombre_servicio: '  Auditoría SEO ', unidad_medida: 'Hora', tarifa_unitaria: '90', moneda: 'USD' }, { id: 'srv_004' });
  const updated = model.updateService(services, 'srv_001', { ...created, id: 'srv_001' });
  const removed = model.removeService(updated, 'srv_002');

  assert.equal(created.tarifa_unitaria, 90);
  assert.equal(services[0].nombre_servicio, 'Consultoría UX/UI');
  assert.equal(updated[0].nombre_servicio, 'Auditoría SEO');
  assert.deepEqual(removed.map((service) => service.id), ['srv_001', 'srv_003']);
});

test('merges incomplete local overlays while retaining baseline records and deletions', () => {
  const merged = model.mergeServices(services, { items: [{ id: 'srv_001', nombre_servicio: 'Consultoría editada', unidad_medida: 'Hora', tarifa_unitaria: 80 }], deletedIds: ['srv_002', null] });
  assert.deepEqual(merged.map((service) => service.id), ['srv_001', 'srv_003']);
  assert.equal(merged[0].moneda, 'USD');
});
