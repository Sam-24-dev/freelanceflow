const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const bitacora = require('../assets/js/bitacora.js');

test('bitácora admin guard redirects non-admin profiles', () => {
  assert.equal(bitacora.getAdminRedirect('operational'), 'acceso.html');
  assert.equal(bitacora.getAdminRedirect(''), 'acceso.html');
  assert.equal(bitacora.getAdminRedirect('administrative'), '');
});

test('bitácora summary exposes total, last action and modules', () => {
  const summary = bitacora.summarizeEntries([
    { module: 'Dashboard', action: 'Ingreso a pantalla', timestamp: '2026-06-27T10:00:00.000Z' },
    { module: 'Clientes', action: 'Búsqueda realizada', timestamp: '2026-06-27T09:00:00.000Z' },
    { module: 'Dashboard', action: 'Ingreso a pantalla', timestamp: '2026-06-27T08:00:00.000Z' }
  ]);

  assert.equal(summary.total, 3);
  assert.equal(summary.lastAction, 'Ingreso a pantalla');
  assert.deepEqual(summary.modules, ['Dashboard', 'Clientes']);
});

test('bitácora only exposes operational entries', () => {
  const entries = bitacora.getVisibleEntries([
    { profile: 'administrative', module: 'Bitácora', action: 'Ingreso a pantalla' },
    { profile: 'operational', module: 'Dashboard', action: 'Ingreso a pantalla' }
  ]);

  assert.deepEqual(entries.map((entry) => entry.module), ['Dashboard']);
});

test('bitácora card list is limited to latest five visible entries', () => {
  const entries = Array.from({ length: 7 }, (_, index) => ({
    profile: 'operational',
    module: `Módulo ${index + 1}`,
    action: 'Ingreso a pantalla'
  }));

  assert.deepEqual(bitacora.getRecentEntries(entries).map((entry) => entry.module), [
    'Módulo 1',
    'Módulo 2',
    'Módulo 3',
    'Módulo 4',
    'Módulo 5'
  ]);
});

test('bitácora shows one activity representation per viewport', () => {
  const html = fs.readFileSync(path.join(__dirname, '../pages/bitacora.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/bitacora.js'), 'utf8');

  assert.match(html, /class="reports-summary bitacora-summary"/);
  assert.match(css, /\.bitacora-summary\s*\{\s*grid-template-columns:\s*repeat\(3,/);
  assert.match(source, /globalScope\.confirm\?\./);
  assert.match(html, /data-bitacora-table-wrap class="[^"]*bitacora-table/);
  assert.match(html, /data-bitacora-mobile-list class="[^"]*bitacora-mobile-list/);
  assert.match(css, /\.bitacora-mobile-list\s*\{\s*display:\s*none/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.bitacora-table\s*\{\s*display:\s*none[\s\S]*\.bitacora-mobile-list:not\(\[hidden\]\)\s*\{\s*display:\s*grid/);
});
