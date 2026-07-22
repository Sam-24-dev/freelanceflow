const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets/css/app.css'), 'utf8');

const contrast = (foreground, background) => {
  const luminance = (hex) => hex.match(/[\da-f]{2}/gi).map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

test('landing keeps public navigation, CTA and accessible feature ordinals', () => {
  assert.equal((landing.match(/<h1\b/gi) || []).length, 1);
  for (const anchor of ['features', 'how-it-works', 'value']) {
    assert.match(landing, new RegExp(`id="${anchor}"`));
  }
  assert.match(landing, /class="primary-cta" href="pages\/acceso\.html"/);
  assert.doesNotMatch(landing, /pages\/index\.html/);

  for (const href of landing.matchAll(/\bhref="([^"]+)"/g)) {
    const target = href[1];
    if (target.startsWith('#')) assert.match(landing, new RegExp(`id="${target.slice(1)}"`));
    if (!target.startsWith('#') && !target.startsWith('http')) assert.ok(fs.existsSync(path.join(root, target)));
  }

  assert.doesNotMatch(landing.match(/<body\b[\s\S]*<\/body>/i)[0], /\b(demo|simulación|prototipo|mock|fase académica)\b/i);
  const ordinal = css.match(/\.feature-grid span\s*\{[\s\S]*?color:\s*(#[\da-f]{6}|var\((--[\w-]+)\))/i);
  assert.ok(ordinal, 'feature ordinal color must be declared');
  const color = ordinal[2] || css.match(new RegExp(`${ordinal[3]}:\\s*(#[\\da-f]{6})`, 'i'))[1];
  assert.ok(contrast(color, '#ffffff') >= 4.5, `ordinal contrast is ${contrast(color, '#ffffff')}`);
});
