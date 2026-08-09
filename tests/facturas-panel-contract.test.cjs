const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const facturasSource = fs.readFileSync(path.join(root, 'assets/js/facturas.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'assets/css/app.css'), 'utf8');

test('applies the persisted fiscal default only to a new invoice submit', () => {
  const submit = facturasSource.match(/function handleInvoiceSubmit\(event\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(submit, /if \(!state\.editingId\) candidate\.impuestos = model\.resolveEstimatedTaxForNewInvoice\(candidate, readFiscalConfiguration\(\) \|\| \{\}\);/);
});

test('restores focus before making an invoice panel inaccessible', () => {
  const closePanel = facturasSource.match(/function closePanel\(panel\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  const restoreFocus = closePanel.indexOf('state.lastFocus?.focus?.();');
  const ariaHidden = closePanel.indexOf("panel.setAttribute('aria-hidden', 'true');");
  const inert = closePanel.indexOf("panel.setAttribute('inert', '');");

  assert.ok(restoreFocus >= 0, 'closePanel must restore the trigger focus');
  assert.ok(restoreFocus < ariaHidden, 'focus must be restored before aria-hidden');
  assert.ok(restoreFocus < inert, 'focus must be restored before inert');
});

test('contains the 1024px invoice table within its own horizontal scroller', () => {
  const tableWrap = cssSource.match(/\.invoice-table-wrap \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(tableWrap, /contain:\s*layout;/);
  assert.doesNotMatch(tableWrap, /min-width:\s*0;/);
  assert.match(tableWrap, /overflow-x:\s*auto;/);
  assert.match(cssSource, /\.invoice-table \{[\s\S]*?min-width:\s*68rem;/);
});
