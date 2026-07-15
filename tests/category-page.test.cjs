const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.join(__dirname, '../pages/categorias.html');

test('categories page exposes accessible operational UI regions', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /<main id="main-content"/);
  assert.match(html, /id="categories-results-status"[^>]*aria-live="polite"/);
  assert.match(html, /<table class="categories-table">/);
  assert.match(html, /<caption class="sr-only">Categorías de gasto/);
  assert.match(html, /id="category-drawer"[^>]*role="dialog"/);
  assert.match(html, /id="category-remove-dialog"/);
  assert.match(html, /assets\/js\/category-model\.js/);
  assert.match(html, /assets\/js\/categorias\.js/);
});

test('categories controller is part of static validation command', () => {
  const packageJson = fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8');

  assert.match(packageJson, /assets\/js\/category-model\.js/);
  assert.match(packageJson, /assets\/js\/categorias\.js/);
});

test('category actions escape ids before rendering data attributes', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(controller, /function escapeAttribute/);
  assert.match(controller, /data-category-id="\$\{escapeAttribute\(category\.id\)\}"/);
});

test('category actions identify the affected category for assistive technology', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(controller, /aria-label="Editar \$\{escapeAttribute\(category\.nombre_categoria\)\}"/);
  assert.match(controller, /aria-label="\$\{removeAction\} \$\{escapeAttribute\(category\.nombre_categoria\)\}"/);
});

test('category monthly metrics use the browser local month', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(controller, /getFullYear\(\)/);
  assert.match(controller, /getMonth\(\) \+ 1/);
  assert.doesNotMatch(controller, /toISOString\(\)\.slice\(0, 7\)/);
});

test('category form errors are associated to controls without dropping hints', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.match(html, /id="category-name"[^>]*aria-describedby="category-name-error"/);
  assert.match(html, /id="category-name-error"[^>]*data-field-error="nombre_categoria"/);
  assert.match(html, /id="category-budget"[^>]*aria-describedby="category-budget-hint category-budget-error"/);
  assert.match(html, /id="category-budget-error"[^>]*data-field-error="presupuesto_mensual"/);
});

test('categories heading stacks vertically on small screens', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.categories-heading\s*{[\s\S]*flex-direction:\s*column;/);
});

test('categories loading status is removed when hidden', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /\.categories-app\s+\[hidden\]\s*{\s*display:\s*none\s*!important;\s*}/);
});

test('categories content uses the accepted warm ledger surface instead of a full-dark canvas', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /\.categories-app\s*{[\s\S]*background:\s*#f4eee5;/);
  assert.match(css, /\.categories-heading,\s*[\s\S]*\.categories-summary-card\s*{[\s\S]*background:\s*#fffdf8;/);
  assert.doesNotMatch(css, /\.categories-app\s*{[\s\S]*background:\s*#0f172a;/);
});

test('categories mobile summary remains two columns down to 320px', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.categories-summary-grid\s*{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.doesNotMatch(css, /@media \(max-width: 640px\)[\s\S]*\.categories-heading,\s*[\s\S]*\.categories-summary-grid,\s*[\s\S]*\{[\s\S]*grid-template-columns:\s*1fr;/);
  assert.match(css, /@media \(max-width: 360px\)[\s\S]*\.categories-summary-card\s*{[\s\S]*padding:\s*0\.75rem;/);
});

test('category drawer backdrop is hidden from assistive tech while keeping click close behavior', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(html, /id="category-drawer-backdrop"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(html, /id="category-drawer-backdrop"[^>]*aria-label="Cerrar panel"/);
  assert.match(controller, /elements\.backdrop\?\.addEventListener\('click'/);
});

test('categories drawer caps tablet and desktop width at 420px while mobile is fullscreen', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /\.category-drawer\s*{[\s\S]*width:\s*min\(100vw,\s*420px\);/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.category-drawer\s*{[\s\S]*width:\s*100vw;/);
});

test('category copy pluralizes singular visible categories and usage', () => {
  const controller = fs.readFileSync(path.join(__dirname, '../assets/js/categorias.js'), 'utf8');

  assert.match(controller, /function pluralizeCategory/);
  assert.match(controller, /function pluralizeUsage/);
  assert.match(controller, /pluralizeCategory\(visible\.length\)/);
  assert.match(controller, /pluralizeUsage\(category\.usos\)/);
});
