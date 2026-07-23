const test = require('node:test');
const assert = require('node:assert/strict');

const shell = require('../assets/js/app-shell.js');
const activity = require('../assets/js/activity-log.js');
const operational = () => ({ status: 'valid', membership: shell.MEMBERSHIPS[0] });
const administrative = () => ({ status: 'valid', membership: shell.MEMBERSHIPS[1] });

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

test('activity log persists only its closed event contract and derives trusted display data', () => {
  const session = storage();
  const api = activity.createActivityLog({
    storage: session,
    now: () => '2026-06-27T10:00:00.000Z',
    random: () => 0.25,
    getContext: () => ({ ...operational(), membership: { ...shell.MEMBERSHIPS[0], actor: 'Ana Mora' } })
  });

  api.record({
    module: 'Movimientos',
    action: 'Movimiento registrado',
    description: '<img src=x onerror=alert(1)> ACME RUC 0999999999001 token secret amount $500',
    actor: 'Actor falso',
    membershipId: 'ff-administrative-v1'
  });

  assert.deepEqual(JSON.parse(session.getItem(activity.STORAGE_KEY)), [{
    version: 1,
    type: 'movements.recorded',
    timestamp: '2026-06-27T10:00:00.000Z',
    membershipId: 'ff-operational-v1'
  }]);
  assert.deepEqual(api.read()[0], {
    timestamp: '2026-06-27T10:00:00.000Z',
    actor: 'Equipo operativo',
    role: 'operational',
    membershipId: 'ff-operational-v1',
    module: 'Movimientos',
    action: 'Movimiento registrado',
    description: 'Se registró un movimiento.'
  });
});

test('activity log clears session entries', () => {
  const api = activity.createActivityLog({ storage: storage() });
  api.record({ module: 'Clientes', action: 'Ingreso a pantalla', description: 'Ingreso al módulo Clientes.' });
  api.clear();

  assert.deepEqual(api.read(), []);
});

test('activity log skips all administrative activity', () => {
  const api = activity.createActivityLog({
    storage: storage(),
    getContext: administrative
  });

  assert.equal(api.record({ module: 'Bitácora', action: 'Ingreso a pantalla', description: 'Ingreso al módulo Bitácora.' }), null);
  assert.deepEqual(api.read(), []);
});

test('activity log skips activity until a profile is selected', () => {
  const api = activity.createActivityLog({ storage: storage() });

  assert.equal(api.record({ module: 'Dashboard', action: 'Ingreso a pantalla', description: 'Ingreso al módulo Dashboard.' }), null);
  assert.deepEqual(api.read(), []);
});

test('activity log discards forged, unknown, malformed, and legacy storage entries', () => {
  const session = storage({
    [activity.STORAGE_KEY]: JSON.stringify([
      { version: 1, type: 'movements.recorded', timestamp: '2026-06-27T10:00:00.000Z', membershipId: 'ff-operational-v1', actor: 'Actor falso' },
      { version: 1, type: 'unknown.event', timestamp: '2026-06-27T10:00:00.000Z', membershipId: 'ff-operational-v1' },
      { version: 1, type: 'movements.recorded', timestamp: 'not-a-date', membershipId: 'ff-operational-v1' },
      { version: 1, type: 'movements.recorded', timestamp: '2026-06-27T10:00:00.000Z', membershipId: 'unknown-membership' },
      { actor: 'Equipo operativo', module: 'Movimientos', action: 'Movimiento registrado', description: 'RUC 0999999999001' }
    ])
  });
  const api = activity.createActivityLog({ storage: session, getContext: operational });

  assert.equal(api.read().length, 1);
  assert.equal(api.read()[0].actor, 'Equipo operativo');
  assert.doesNotMatch(JSON.stringify(api.read()), /Actor falso|0999999999001|RUC/);
});

test('activity log reads valid adversarial storage newest first before applying the limit', () => {
  const session = storage({
    [activity.STORAGE_KEY]: JSON.stringify([
      { version: 1, type: 'movements.recorded', timestamp: '2026-06-27T10:00:00.000Z', membershipId: 'ff-operational-v1' },
      { version: 1, type: 'clients.registered', timestamp: '2026-06-27T12:00:00.000Z', membershipId: 'ff-operational-v1' },
      { version: 1, type: 'projects.created', timestamp: '2026-06-27T11:00:00.000Z', membershipId: 'ff-operational-v1' }
    ])
  });
  const api = activity.createActivityLog({ storage: session, limit: 2, getContext: operational });

  assert.deepEqual(api.read().map((entry) => entry.timestamp), [
    '2026-06-27T12:00:00.000Z',
    '2026-06-27T11:00:00.000Z'
  ]);
});

test('activity catalog maps every operational page visit and generic search producer', () => {
  const producers = new Set(activity.EVENT_CATALOG.map((entry) => `${entry.module}\u0000${entry.action}`));
  Object.values(activity.pageModules)
    .filter((module) => module !== 'Bitácora')
    .forEach((module) => {
      assert.ok(producers.has(`${module}\u0000Ingreso a pantalla`));
      assert.ok(producers.has(`${module}\u0000Búsqueda realizada`));
    });
});

test('activity log records generic searches and ignores producer-supplied names, money, and invoice identifiers', () => {
  const api = activity.createActivityLog({
    storage: storage(),
    getContext: operational
  });

  api.record({ module: 'Clientes', action: 'Cliente registrado', description: 'Cliente ACME S.A. RUC 0999999999001.' });
  api.record({ module: 'Propuestas', action: 'Propuesta creada', description: 'PROP-123 Proyecto Atlas $700.' });
  api.record({ module: 'Facturas', action: 'Factura guardada', description: 'FAC-001 por $350.' });
  api.record({ module: 'Servicios', action: 'Servicio creado', description: 'Consultoría UX $99.' });
  api.record({ module: 'Categorías', action: 'Categoría creada', description: 'Categoría Comisiones.' });
  api.record({ module: 'Movimientos', action: 'Movimiento actualizado', description: 'Cobro cliente por $500.' });
  api.record({ module: 'Propuestas', action: 'Búsqueda realizada', description: 'Búsqueda en Propuestas: token secreto.' });

  const display = JSON.stringify(api.read());
  assert.match(display, /Se realizó una búsqueda en Propuestas\./);
  assert.doesNotMatch(display, /ACME|0999999999001|PROP-123|Atlas|FAC-001|\$|Consultoría|Comisiones|token secreto|Cobro cliente/);
});

test('activity log keeps valid events newest first, limits to 80, and deduplicates consecutive types', () => {
  let tick = 0;
  const api = activity.createActivityLog({
    storage: storage(),
    now: () => new Date(Date.UTC(2026, 5, 27, 10, 0, tick++)).toISOString(),
    getContext: operational
  });

  api.record({ module: 'Dashboard', action: 'Ingreso a pantalla' });
  api.record({ module: 'Dashboard', action: 'Ingreso a pantalla' });
  for (let index = 0; index < 85; index += 1) {
    api.record({ module: index % 2 ? 'Clientes' : 'Movimientos', action: index % 2 ? 'Cliente actualizado' : 'Movimiento actualizado', deduplicate: false });
  }

  assert.equal(api.read().length, 80);
  assert.equal(api.read()[0].timestamp, '2026-06-27T10:01:26.000Z');
  assert.equal(api.read().at(-1).timestamp, '2026-06-27T10:00:07.000Z');
});

test('activity log stays nonblocking when storage or optional logging dependencies fail', () => {
  const brokenStorage = { getItem() { return null; }, setItem() { throw new Error('blocked'); } };
  const api = activity.createActivityLog({ storage: brokenStorage, getContext: operational });
  assert.doesNotThrow(() => api.record({ module: 'Dashboard', action: 'Ingreso a pantalla' }));
  assert.equal(api.read().length, 1);
});

test('activity log only records operational page visits', () => {
  assert.equal(activity.shouldRecordPageVisit('bitacora.html', operational()), false);
  assert.equal(activity.shouldRecordPageVisit('bitacora.html', administrative()), false);
  assert.equal(activity.shouldRecordPageVisit('dashboard.html', operational()), true);
  assert.equal(activity.shouldRecordPageVisit('categorias.html', operational()), true);
  assert.equal(activity.shouldRecordPageVisit('servicios.html', operational()), true);
  assert.equal(activity.shouldRecordPageVisit('configuracion-fiscal.html', operational()), true);
  assert.equal(activity.shouldRecordPageVisit('notificaciones.html', operational()), true);
  assert.equal(activity.pageModules['categorias.html'], 'Categor\u00edas');
  assert.equal(activity.pageModules['servicios.html'], 'Servicios');
  assert.equal(activity.pageModules['configuracion-fiscal.html'], 'Configuraci\u00f3n fiscal');
  assert.equal(activity.pageModules['notificaciones.html'], 'Notificaciones');
  assert.equal(activity.shouldRecordPageVisit('dashboard.html', administrative()), false);
});

test('activity log records meaningful Categories search and actions for operational profile only', () => {
  const api = activity.createActivityLog({
    storage: storage(),
    getContext: operational
  });

  api.record({ module: 'Categorías', action: 'Búsqueda realizada', description: 'Búsqueda en Categorías: software.' });
  api.record({ module: 'Categorías', action: 'Categoría creada', description: 'Categoría creada: Comisiones.' });

  assert.deepEqual(api.read().map((item) => item.action), ['Categoría creada', 'Búsqueda realizada']);
});

test('activity log records meaningful Services actions for operational profile only', () => {
  const api = activity.createActivityLog({ storage: storage(), getContext: operational });
  api.record({ module: 'Servicios', action: 'Servicio creado', description: 'Creó el servicio Consultoría UX/UI.' });
  api.record({ module: 'Servicios', action: 'Servicio eliminado', description: 'Eliminó el servicio Consultoría UX/UI.' });
  assert.deepEqual(api.read().map((item) => item.description), ['Se eliminó un servicio.', 'Se creó un servicio.']);
});
