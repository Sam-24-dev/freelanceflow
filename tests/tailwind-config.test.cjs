const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../tailwind.config.js');

test('Tailwind scans application pages after the pages directory migration', () => {
  assert.ok(config.content.includes('./pages/**/*.html'));
});
