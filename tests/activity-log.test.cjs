const test = require('node:test');
const assert = require('node:assert/strict');

const shell = require('../assets/js/app-shell.js');
const activity = require('../assets/js/activity-log.js');
const operational = () => ({ status: 'valid', membership: shell.MEMBERSHIPS[0] });
const administrative = () => ({ status: 'valid', membership: shell.MEMBERSHIPS[1] });

function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

test('activity log records, reads newest first and respects the limit', () => {
  const api = activity.createActivityLog({
    storage: storage(),
    now: () => '2026-06-27T10:00:00.000Z',
    random: () => 0.25,
    limit: 2,
    getContext: () => ({ ...operational(), membership: { ...shell.MEMBERSHIPS[0], actor: 'Ana Mora' } })
  });

  api.record({ module: 'Acceso', action: 'Perfil seleccionado', description: 'Perfil administrativo seleccionado.' });
  api.record({ module: 'Dashboard', action: 'Ingreso a pantalla', description: 'Ingreso al dashboard.' });
  api.record({ module: 'Reportes', action: 'Búsqueda realizada', description: 'Filtro aplicado.' });

  assert.deepEqual(api.read().map((item) => item.module), ['Reportes', 'Dashboard']);
  assert.equal(api.read()[0].actor, 'Ana Mora');
  assert.equal(api.read()[0].role, 'operational');
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

test('activity log deduplicates equivalent consecutive events', () => {
  const api = activity.createActivityLog({
    storage: storage(),
    getContext: operational
  });

  api.record({ module: 'Dashboard', action: 'Ingreso a pantalla', description: 'Ingreso al módulo Dashboard.' });
  api.record({ module: 'Dashboard', action: 'Ingreso a pantalla', description: 'Ingreso al módulo Dashboard.' });

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
  assert.deepEqual(api.read().map((item) => item.description), ['Eliminó el servicio Consultoría UX/UI.', 'Creó el servicio Consultoría UX/UI.']);
});
