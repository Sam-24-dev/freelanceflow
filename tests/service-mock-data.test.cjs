const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('mock data exposes a valid initial services catalogue', () => {
  const data = JSON.parse(fs.readFileSync('assets/data/mock-data.json', 'utf8'));
  assert.equal(Array.isArray(data.servicios), true);
  assert.equal(data.servicios.length >= 3, true);
  assert.deepEqual([...new Set(data.servicios.map((service) => service.unidad_medida))].sort(), ['Entregable', 'Hora', 'Proyecto']);
});
