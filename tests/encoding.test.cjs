const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const USER_FACING_FILES = [
  'transacciones.html',
  'dashboard.html',
  'assets/js/transacciones.js',
  'assets/js/dashboard.js',
  'assets/js/app-shell.js',
  'assets/data/mock-data.json'
];

test('Movimientos and Dashboard contain no UTF-8 mojibake', () => {
  const corrupted = USER_FACING_FILES.filter((relativePath) => {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    return /[\u00c2\u00c3\ufffd]/u.test(content);
  });

  assert.deepEqual(corrupted, []);
});
