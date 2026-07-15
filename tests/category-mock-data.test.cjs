const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('mock expense categories include approved optional fields for the Categories module', () => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/data/mock-data.json'), 'utf8'));

  assert.ok(data.categorias_gasto.every((category) => Object.hasOwn(category, 'descripcion')));
  assert.ok(data.categorias_gasto.every((category) => Object.hasOwn(category, 'presupuesto_mensual')));
  assert.ok(data.categorias_gasto.every((category) => category.estado === 'activo'));
  assert.ok(data.categorias_gasto.every((category) => !Object.hasOwn(category, 'tipo')));
});

test('mock expense category descriptions keep premium Spanish UTF-8 accents', () => {
  const json = fs.readFileSync(path.join(__dirname, '../assets/data/mock-data.json'), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '../assets/data/mock-data.js'), 'utf8');

  for (const content of [json, js]) {
    assert.match(content, /diseño/);
    assert.match(content, /gestión/);
    assert.match(content, /papelería/);
    assert.doesNotMatch(content, /diseno|gestion|papeleria/);
  }
});
