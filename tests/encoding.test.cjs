const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const USER_FACING_FILES = [
  'index.html',
  'pages/acceso.html',
  'pages/bitacora.html',
  'pages/transacciones.html',
  'pages/dashboard.html',
  'pages/clientes.html',
  'pages/proyectos.html',
  'pages/facturas.html',
  'pages/reportes.html',
  'assets/js/activity-log.js',
  'assets/js/acceso.js',
  'assets/js/bitacora.js',
  'assets/js/transacciones.js',
  'assets/js/proyectos.js',
  'assets/js/dashboard.js',
  'assets/js/app-shell.js',
  'assets/data/mock-data.json'
];

test('user-facing files contain no UTF-8 mojibake or replacement question marks', () => {
  const corrupted = USER_FACING_FILES.filter((relativePath) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    return /[\u00c2\u00c3\ufffd]|\p{L}\?\p{L}|>\?\p{L}|â[^\s<]/u.test(content);
  });

  assert.deepEqual(corrupted, []);
});

test('Acceso and Bitácora UI avoids forbidden presentation terms', () => {
  const forbidden = /\b(demo|simulación|prototipo|sustentación)\b/iu;
  const offenders = USER_FACING_FILES.filter((relativePath) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    return forbidden.test(content);
  });

  assert.deepEqual(offenders, []);
});

test('Acceso and Bitácora UI avoids internal implementation disclaimers', () => {
  const forbidden = /sessionStorage|frontend local|credenciales reales/i;
  const offenders = ['pages/acceso.html', 'pages/bitacora.html'].filter((relativePath) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    return forbidden.test(content);
  });

  assert.deepEqual(offenders, []);
});

test('user-facing copy avoids internal phase and sample-data language', () => {
  const forbidden = /cuenta mock|datos simulad[oa]s?|simular|Fase 1/i;
  const offenders = USER_FACING_FILES.filter((relativePath) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    return forbidden.test(content);
  });

  assert.deepEqual(offenders, []);
});

test('user-facing copy uses consistent product terminology and neutral Spanish', () => {
  const forbidden = /Cuenta auxiliar|Transacción (?:guardada|actualizada)|Revisá|transporte a reunion/iu;
  const offenders = USER_FACING_FILES.filter((relativePath) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    return forbidden.test(content);
  });

  assert.deepEqual(offenders, []);
});
