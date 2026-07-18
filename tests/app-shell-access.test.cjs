const test = require('node:test');
const assert = require('node:assert/strict');

const shell = require('../assets/js/app-shell.js');

test('app shell exposes BitÃ¡cora only for administrative profile', () => {
  const flatten = (groups) => groups.flatMap((group) => group.items.map((item) => item[0]));

  assert.deepEqual(flatten(shell.getNavigationGroupsForProfile('operational')), [
    'dashboard.html',
    'transacciones.html',
    'clientes.html',
    'proyectos.html',
    'propuestas.html',
    'facturas.html',
    'reportes.html',
    'notificaciones.html',
    'categorias.html',
    'servicios.html',
    'configuracion-fiscal.html',
    'ajustes.html',
    'cuenta.html'
  ]);
  assert.deepEqual(flatten(shell.getNavigationGroupsForProfile('administrative')), ['bitacora.html']);
});

test('app shell redirects profiles away from unauthorized modules', () => {
  assert.equal(shell.getProtectedRedirect('dashboard.html', ''), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('dashboard.html', 'corrupt'), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('bitacora.html', 'operational'), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('bitacora.html', 'administrative'), '');
  assert.equal(shell.getProtectedRedirect('dashboard.html', 'administrative'), 'bitacora.html');
  assert.equal(shell.getProtectedRedirect('transacciones.html', 'administrative'), 'bitacora.html');
  assert.equal(shell.getProtectedRedirect('categorias.html', 'administrative'), 'bitacora.html');
  assert.equal(shell.getProtectedRedirect('servicios.html', 'administrative'), 'bitacora.html');
  assert.equal(shell.getProtectedRedirect('servicios.html', ''), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('servicios.html', 'operational'), '');
  assert.equal(shell.getProtectedRedirect('configuracion-fiscal.html', 'administrative'), 'bitacora.html');
  assert.equal(shell.getProtectedRedirect('configuracion-fiscal.html', ''), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('configuracion-fiscal.html', 'operational'), '');
  assert.equal(shell.getProtectedRedirect('ajustes.html', 'administrative'), 'bitacora.html');
  assert.equal(shell.getProtectedRedirect('ajustes.html', ''), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('ajustes.html', 'operational'), '');
  assert.equal(shell.getProtectedRedirect('cuenta.html', 'administrative'), 'bitacora.html');
  assert.equal(shell.getProtectedRedirect('cuenta.html', ''), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('cuenta.html', 'operational'), '');
  assert.equal(shell.getProtectedRedirect('notificaciones.html', 'administrative'), 'bitacora.html');
  assert.equal(shell.getProtectedRedirect('notificaciones.html', ''), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('notificaciones.html', 'operational'), '');
  assert.equal(shell.getProtectedRedirect('categorias.html', ''), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('categorias.html', 'operational'), '');
  assert.equal(shell.getProtectedRedirect('dashboard.html', 'operational'), '');
});

test('bottom navigation is operational-only', () => {
  assert.deepEqual(shell.getBottomNavigationForProfile('administrative'), []);
  const operationalBottomNav = shell.getBottomNavigationForProfile('operational');
  assert.equal(operationalBottomNav.length, 5);
  assert.equal(operationalBottomNav.some(([href]) => href === 'categorias.html'), false);
  assert.equal(operationalBottomNav.some(([href]) => href === 'ajustes.html'), false);
  assert.equal(operationalBottomNav.some(([href]) => href === 'notificaciones.html'), false);
});

test('app shell escapes stored actor copy before injecting it', () => {
  assert.equal(shell.escapeHTML('<Admin & Co>'), '&lt;Admin &amp; Co&gt;');
});


test('sidebar brand points from pages to landing root', () => {
  assert.equal(shell.LANDING_HREF, '../index.html');
});

const fs = require('node:fs');
const path = require('node:path');

test('mobile brand also points from pages to landing root', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/app-shell.js'), 'utf8');
  assert.match(source, /class="app-mobile-brand" href="\$\{LANDING_HREF\}"/);
});
