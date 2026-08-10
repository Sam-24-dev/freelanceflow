const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const facturasSource = fs.readFileSync(path.join(root, 'assets/js/facturas.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(root, 'assets/css/app.css'), 'utf8');

test('applies the persisted fiscal default only to a new invoice submit', () => {
  const submit = facturasSource.match(/(?:async )?function handleInvoiceSubmit\(event\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(submit, /if \(!editingId\) candidate\.impuestos = model\.resolveEstimatedTaxForNewInvoice\(candidate, readFiscalConfiguration\(\) \|\| \{\}\);/);
});

test('contains the 1024px invoice table within its own horizontal scroller', () => {
  const tableWrap = cssSource.match(/\.invoice-table-wrap \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(tableWrap, /contain:\s*layout;/);
  assert.doesNotMatch(tableWrap, /min-width:\s*0;/);
  assert.match(tableWrap, /overflow-x:\s*auto;/);
  assert.match(cssSource, /\.invoice-table \{[\s\S]*?min-width:\s*68rem;/);
});

test('FF-INV-003 routes every invoice mutation through the browser native Web Lock and reloads durable state inside it', () => {
  assert.match(facturasSource, /const invoiceWebLocks = window\.navigator\?\.locks;/);
  const serialized = facturasSource.match(/async function commitSerializedInvoiceMutation\(mutation, focusTarget\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(serialized, /model\.runSerializedInvoiceMutation\(invoiceWebLocks,/);
  assert.match(serialized, /const lockedSnapshot = readStoredInvoiceTransition\(\);/);
  assert.match(serialized, /state\.invoices = lockedSnapshot\.invoices;/);
  assert.match(serialized, /state\.payments = lockedSnapshot\.payments;/);
  for (const handler of ['handleInvoiceSubmit', 'handlePaymentSubmit', 'handleVoidSubmit', 'handleDetailAction']) {
    const source = facturasSource.match(new RegExp(`(?:async )?function ${handler}\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}`))?.[1] || '';
    assert.match(source, /commitSerializedInvoiceMutation\(/, `${handler} must serialize its mutation`);
  }
});

test('FF-INV-003 keeps lock failures and stale mutations closed with accessible feedback and focus', () => {
  const failure = facturasSource.match(/function showInvoiceMutationFailure\(reason, focusTarget\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(failure, /showToast\(.+?, 'error'\);/);
  assert.match(failure, /focusTarget\?\.focus\?\.\(\);/);
  assert.match(failure, /stale/);
  assert.match(failure, /lock-/);
});

test('FF-INV-003 includes all baseline invoice history in each locked durable reload', () => {
  const reload = facturasSource.match(/function readStoredInvoiceTransition\(\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(reload, /model\.mergeById\(state\.baselineInvoices, stored\.invoices\)/);
  assert.match(reload, /model\.mergeById\(state\.baselinePayments, stored\.payments\)/);
});

test('FF-INV-003 bootstraps mock invoice history before the first locked transition', async () => {
  const mockData = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/mock-data.json'), 'utf8'));
  const storage = new Map();
  const elements = new Map();
  const field = () => ({ value: '', innerHTML: '', addEventListener() {}, insertAdjacentHTML() {} });
  const element = () => ({
    hidden: false,
    textContent: '',
    innerHTML: '',
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    insertAdjacentHTML() {},
    querySelectorAll() { return []; }
  });
  const document = {
    body: element(),
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    addEventListener() {}
  };
  document.querySelector('[data-invoice-filters]').elements = {
    query: field(), period: field(), clientId: field(), projectId: field()
  };
  document.querySelector('[data-invoice-form-element]').elements = {
    cliente_id: field(), proyecto_relacionado_id: field(), monto_pagado: field()
  };
  document.querySelector('[data-payment-form]').elements = { monto_pagado: field() };
  document.querySelector('[data-void-form]').elements = {};

  const sandbox = {
    window: {
      navigator: { locks: { request: async (_name, _options, callback) => callback() } },
      FreelanceFlowInvoiceModel: require(path.join(root, 'assets/js/invoice-model.js')),
      FreelanceFlowSettingsModel: require(path.join(root, 'assets/js/settings-model.js')),
      FreelanceFlowClientModel: { getEffectiveClients: (clients) => clients, getSelectableClients: (clients) => clients },
      FreelanceFlowProjectModel: { getEffectiveProjects: (projects) => projects },
      FreelanceFlowDataLoader: { loadJson: async () => mockData },
      clearTimeout() {}, setTimeout() { return 0; }, location: { search: '' }
    },
    document,
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    requestAnimationFrame(callback) { callback(); },
    URLSearchParams,
    Intl,
    Date,
    console
  };
  const controllerSource = facturasSource
    .replace('      renderClientAndProjectOptions();', '      // Rendering is outside this bootstrap contract.')
    .replace('      renderList();', '      // Rendering is outside this bootstrap contract.')
    .replace('  bindEvents();', '  window.__invoiceControllerTest = { state, loadData, commitSerializedInvoiceMutation, commitLockedTransition, nextInvoiceNumber };')
    .replace('  loadData();', '');
  require('node:vm').runInNewContext(controllerSource, sandbox);
  const controller = sandbox.window.__invoiceControllerTest;

  await controller.loadData();
  const transition = await controller.commitSerializedInvoiceMutation(() => {
    const created = {
      ...mockData.facturas[0],
      id: 'fac_baseline_regression',
      numero_factura: controller.nextInvoiceNumber()
    };
    return controller.commitLockedTransition([...controller.state.invoices, created], controller.state.payments, () => {});
  });

  assert.equal(transition.committed, true);
  assert.equal(controller.state.invoices.length, mockData.facturas.length + 1);
  assert.equal(controller.state.payments.length, mockData.pagos_factura.length);
  assert.ok(mockData.facturas.every((invoice) => controller.state.invoices.some((item) => item.id === invoice.id)));
  assert.ok(mockData.pagos_factura.every((payment) => controller.state.payments.some((item) => item.id === payment.id)));
  assert.equal(controller.state.invoices.at(-1).numero_factura, 'FAC-0025');
});

test('FF-SET-003 persists an explicit manual invoice number instead of replacing it with the settings default', async () => {
  const mockData = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/mock-data.json'), 'utf8'));
  const storage = new Map();
  const elements = new Map();
  const field = (value = '') => ({ value, addEventListener() {}, focus() {} });
  const element = () => ({
    hidden: false,
    textContent: '',
    innerHTML: '',
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    focus() {},
    contains() { return false; },
    getClientRects() { return [{}]; },
    insertAdjacentHTML() {},
    querySelectorAll() { return []; },
    querySelector() { return null; }
  });
  const document = {
    body: element(),
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const itemFields = {
    '[name="origen_item"]': field('Manual'),
    '[name="descripcion_item"]': field('Servicio manual'),
    '[name="cantidad"]': field('1'),
    '[name="precio_unitario"]': field('100')
  };
  const invoiceItems = document.querySelector('[data-invoice-items]');
  invoiceItems.querySelectorAll = () => [{ querySelector: (selector) => itemFields[selector] }];
  const invoiceForm = document.querySelector('[data-invoice-form-element]');
  invoiceForm.reset = () => {};
  invoiceForm.elements = {
    cliente_id: field('cli_001'),
    proyecto_relacionado_id: field('proy_001'),
    numero_factura: field('MAN-9001'),
    fecha_emision: field('2026-12-01'),
    fecha_vencimiento: field('2026-12-31'),
    moneda: field('USD'),
    descuento: field('0'),
    impuestos: field('')
  };
  document.querySelector('[data-invoice-filters]').elements = { query: field(), period: field(), clientId: field(), projectId: field() };
  document.querySelector('[data-payment-form]').elements = { monto_pagado: field() };
  document.querySelector('[data-void-form]').elements = {};

  const invoiceModel = require(path.join(root, 'assets/js/invoice-model.js'));
  const settingsModel = require(path.join(root, 'assets/js/settings-model.js'));
  storage.set('freelanceflow_settings_v1', settingsModel.serializeSettingsEnvelope(settingsModel.createSettingsEnvelope({
    invoice_prefix: 'INV-', next_invoice_number: 42, default_due_days: 15, default_currency: 'USD'
  }, 7)));
  const sandbox = {
    window: {
      navigator: { locks: { request: async (_name, _options, callback) => callback() } },
      crypto: { randomUUID: () => 'fac_manual_9001' },
      FreelanceFlowInvoiceModel: invoiceModel,
      FreelanceFlowSettingsModel: settingsModel,
      FreelanceFlowClientModel: { getEffectiveClients: (clients) => clients, getSelectableClients: (clients) => clients },
      FreelanceFlowProjectModel: { getEffectiveProjects: (projects) => projects },
      FreelanceFlowDataLoader: { loadJson: async () => mockData },
      clearTimeout() {}, setTimeout() { return 0; }, location: { search: '' }
    },
    document,
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    requestAnimationFrame(callback) { callback(); },
    URLSearchParams,
    Intl,
    Date,
    console
  };
  const controllerSource = facturasSource
    .replace('      renderClientAndProjectOptions();', '      // Rendering is outside this persistence contract.')
    .replace('      renderList();', '      // Rendering is outside this persistence contract.')
    .replace('  bindEvents();', '  window.__invoiceControllerTest = { state, loadData, handleInvoiceSubmit };')
    .replace('  loadData();', '')
    .replace('    closeInvoiceForm();\n    renderList();\n    showToast(intent === \'send\' ? \'Factura enviada. Estado actualizado a Enviada.\' : \'Factura guardada como borrador.\');', '');
  require('node:vm').runInNewContext(controllerSource, sandbox);
  const controller = sandbox.window.__invoiceControllerTest;

  await controller.loadData();
  await controller.handleInvoiceSubmit({ preventDefault() {}, submitter: { value: 'draft', focus() {} } });

  const durable = invoiceModel.readInvoiceStorage(sandbox.localStorage, 'freelanceflow_invoice_transition_v1', 'freelanceflow_invoices_v1', 'freelanceflow_invoice_payments_v1', {
    clients: mockData.clientes, projects: mockData.proyectos
  });
  const created = durable.invoices.find((invoice) => invoice.id === 'fac_manual_9001');
  assert.equal(created.numero_factura, 'MAN-9001');
  assert.equal(created.fecha_vencimiento, '2026-12-31');
  assert.equal(settingsModel.resolveStoredSettingsEnvelope(storage.get('freelanceflow_settings_v1'), invoiceModel.readInvoiceTransitionSettings(sandbox.localStorage, 'freelanceflow_invoice_transition_v1')).settings.next_invoice_number, 43);
});

function createInvoicePanelDom({ simulateDetailRerender = false, deferAnimationFrame = false } = {}) {
  class Element {
    constructor(attributes = {}) {
      this.attributes = new Map(Object.entries(attributes));
      this.classList = {
        values: new Set(),
        add: (...names) => names.forEach((name) => this.classList.values.add(name)),
        remove: (...names) => names.forEach((name) => this.classList.values.delete(name)),
        contains: (name) => this.classList.values.has(name),
        toggle: (name, enabled) => {
          if (enabled) this.classList.values.add(name);
          else this.classList.values.delete(name);
        }
      };
      this.listeners = new Map();
      this.children = [];
      this.dataset = {};
      this.hidden = false;
      this.disabled = false;
      this.isConnected = true;
      this.textContent = '';
    }

    addEventListener(type, listener) { this.listeners.set(type, listener); }
    setAttribute(name, value) {
      this.attributes.set(name, value);
      if (name === 'aria-hidden' && value === 'true') {
        ariaHiddenFocus.push(document.activeElement);
      }
    }
    removeAttribute(name) { this.attributes.delete(name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    focus() { if (this.isConnected && !this.disabled && !this.hidden) document.activeElement = this; }
    getClientRects() { return this.hidden ? [] : [{}]; }
    contains(node) { return this === node || this.children.includes(node); }
    closest(selector) {
      return selector.split(',').map((part) => part.trim()).some((part) => {
        const match = part.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);
        return match && this.attributes.has(match[1]) && (!match[2] || this.attributes.get(match[1]) === match[2]);
      }) ? this : null;
    }
    querySelectorAll() { return []; }
    querySelector() { return null; }
  }

  const ariaHiddenFocus = [];
  const listeners = new Map();
  const document = {
    activeElement: null,
    body: new Element(),
    addEventListener(type, listener) { listeners.set(type, listener); },
    querySelector(selector) {
      const matchingRows = renderedDetailRows.filter((row) => row.attributes.get('data-open-detail') === selector.match(/^\[data-open-detail="(.+)"\]$/)?.[1]);
      if (matchingRows.length) return matchingRows[0];
      if (selector === '[data-open-detail]') return renderedDetailRows[0] || nodes.get(selector) || null;
      return nodes.get(selector) || new Element();
    },
    querySelectorAll(selector) {
      const selectedId = selector.match(/^\[data-open-detail="(.+)"\]$/)?.[1];
      return selectedId ? renderedDetailRows.filter((row) => row.attributes.get('data-open-detail') === selectedId) : [];
    },
    dispatch(type, target, extra = {}) { listeners.get(type)?.({ target, ...extra }); }
  };
  const nodes = new Map();
  const renderedDetailRows = [];
  const add = (selector, attributes = {}) => {
    const element = new Element(attributes);
    nodes.set(selector, element);
    return element;
  };
  const detail = add('[data-invoice-detail]');
  const formPanel = add('[data-invoice-form]');
  const detailOpener = add('[data-open-detail]', { 'data-open-detail': 'invoice-1' });
  const formOpener = add('[data-open-invoice-form]', { 'data-open-invoice-form': '' });
  const detailClose = add('[data-close-detail]', { 'data-close-detail': '' });
  const formClose = add('[data-close-invoice-form]', { 'data-close-invoice-form': '' });
  const removedTrigger = add('[data-removed-trigger]');
  detail.children.push(detailClose);
  formPanel.children.push(formClose);

  for (const selector of [
    '[data-invoice-loading]', '[data-invoice-error]', '[data-invoice-table-wrap]', '[data-invoice-table-body]',
    '[data-invoice-mobile-list]', '[data-invoice-empty]', '[data-empty-title]', '[data-empty-copy]',
    '[data-empty-action]', '[data-result-count]', '[data-invoice-filters]', '[data-clear-filters]',
    '[data-status-tabs]', '[data-detail-body]', '[data-detail-actions]', '[data-panel-backdrop]',
    '[data-invoice-form-element]', '[data-invoice-items]', '#invoice-item-template', '[data-payment-dialog]',
    '[data-payment-form]', '[data-void-dialog]', '[data-void-form]', '[data-invoice-toast]'
  ]) add(selector);
  nodes.get('[data-panel-backdrop]').hidden = true;
  const fields = () => ({ addEventListener() {}, value: '' });
  nodes.get('[data-invoice-filters]').elements = { query: fields(), period: fields(), clientId: fields(), projectId: fields() };
  nodes.get('[data-invoice-filters]').reset = () => {};
  nodes.get('[data-invoice-form-element]').elements = { cliente_id: fields(), monto_pagado: fields() };
  nodes.get('[data-payment-form]').elements = { monto_pagado: fields() };
  nodes.get('[data-void-form]').elements = {};
  nodes.get('[data-invoice-items]').children = [];
  nodes.get('[data-status-tabs]').querySelectorAll = () => [];

  const animationFrames = [];
  const sandbox = {
    window: {
      navigator: {},
      FreelanceFlowInvoiceModel: {
        calculateInvoiceMetrics: () => ({ pendingAmount: 0, overdueAmount: 0, collectedAmount: 0, pendingCount: 0, overdueCount: 0 }),
        filterInvoices: () => []
      },
      FreelanceFlowSettingsModel: {},
      FreelanceFlowClientModel: {},
      FreelanceFlowDataLoader: { loadJson: () => new Promise(() => {}) },
      clearTimeout() {}, setTimeout() { return 0; }, location: { search: '' }
    },
    document,
    localStorage: { getItem() { return null; } },
    requestAnimationFrame(callback) {
      if (deferAnimationFrame) animationFrames.push(callback);
      else callback();
    },
    URLSearchParams,
    Intl,
    Date,
    console
  };
  sandbox.window.__rerenderDetailRows = () => {
    detailOpener.isConnected = false;
    document.activeElement = document.body;
    renderedDetailRows.splice(0, renderedDetailRows.length, new Element({ 'data-open-detail': 'invoice-1' }));
  };
  const controllerSource = facturasSource
    .replace('  bindEvents();', '  window.__invoiceTestState = state;\n  window.__invoicePanelController = { openDetail, openPanel };\n  bindEvents();')
    .replace('  loadData();', '')
    .replace(
      /  function renderList\(\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  function renderDetail\(\)/,
      simulateDetailRerender
        ? '  function renderList() { window.__rerenderDetailRows(); }\n\n  function renderDetail()'
        : '$&'
    )
    .replace(
      /  function renderDetail\(\) \{[\s\S]*?\r?\n  \}\r?\n\r?\n  function syncOverlay\(\)/,
      simulateDetailRerender
        ? '  function renderDetail() {}\n\n  function syncOverlay()'
        : '$&'
    );
  require('node:vm').runInNewContext(controllerSource, sandbox);
  const flushAnimationFrames = () => animationFrames.splice(0).forEach((callback) => callback());
  return { detail, formPanel, detailOpener, formOpener, detailClose, formClose, removedTrigger, ariaHiddenFocus, document, state: sandbox.window.__invoiceTestState, controller: sandbox.window.__invoicePanelController, renderedDetailRows, flushAnimationFrames };
}

test('FF-INV-004 closes detail and form through DOM interactions without retaining focus in an inaccessible panel', () => {
  const detailDom = createInvoicePanelDom();
  detailDom.detail.classList.add('is-open');
  detailDom.detailClose.focus();
  detailDom.document.dispatch('click', detailDom.detailClose);
  assert.equal(detailDom.ariaHiddenFocus.at(-1), detailDom.detailOpener);
  assert.equal(detailDom.document.activeElement, detailDom.detailOpener);

  const formDom = createInvoicePanelDom();
  formDom.formPanel.classList.add('is-open');
  formDom.formClose.focus();
  formDom.document.dispatch('click', formDom.formClose);
  assert.equal(formDom.ariaHiddenFocus.at(-1), formDom.formOpener);
  assert.equal(formDom.document.activeElement, formDom.formOpener);
});

test('FF-INV-004 falls back to the visible form opener when the original focus target was removed', () => {
  const dom = createInvoicePanelDom();
  dom.state.lastFocus = dom.removedTrigger;
  dom.removedTrigger.isConnected = false;
  dom.formClose.focus();
  dom.document.dispatch('click', dom.formClose);

  assert.equal(dom.ariaHiddenFocus.at(-1), dom.formOpener, 'the fallback opener must receive focus before aria-hidden');
  assert.equal(dom.document.activeElement, dom.formOpener);
});

test('FF-INV-004 closes a re-rendered invoice detail onto a visible, focusable row for button, Escape, and backdrop', () => {
  const closeDetail = (kind) => {
    const dom = createInvoicePanelDom();
    const hiddenDesktopRow = new dom.detailOpener.constructor({ 'data-open-detail': 'invoice-1' });
    const visibleMobileRow = new dom.detailOpener.constructor({ 'data-open-detail': 'invoice-1' });
    hiddenDesktopRow.hidden = true;
    dom.renderedDetailRows.push(hiddenDesktopRow, visibleMobileRow);
    dom.detailOpener.isConnected = false;
    dom.state.lastFocus = dom.detailOpener;
    dom.state.selectedId = 'invoice-1';
    dom.detail.classList.add('is-open');
    dom.detailClose.focus();

    if (kind === 'button') dom.document.dispatch('click', dom.detailClose);
    if (kind === 'escape') dom.document.dispatch('keydown', dom.document.body, { key: 'Escape' });
    if (kind === 'backdrop') dom.document.dispatch('click', dom.document.querySelector('[data-panel-backdrop]'));

    assert.equal(dom.document.activeElement, visibleMobileRow, `${kind} must use a visible re-rendered invoice row`);
    assert.notEqual(dom.document.activeElement, dom.document.body, `${kind} must not fall back to document.body`);
    assert.equal(dom.detail.contains(dom.document.activeElement), false, `${kind} must move focus outside the detail panel`);
    assert.equal(dom.document.activeElement.hidden, false, `${kind} must restore focus to a visible element`);
    assert.equal(dom.document.activeElement.disabled, false, `${kind} must restore focus to an enabled element`);
    assert.ok(dom.document.activeElement.getClientRects().length, `${kind} must restore focus to a rendered element`);
    assert.equal(dom.ariaHiddenFocus.at(-1), visibleMobileRow, `${kind} must focus before detail becomes aria-hidden`);
  };

  ['button', 'escape', 'backdrop'].forEach(closeDetail);
});


test('FF-INV-004 preserves a re-rendered detail opener instead of replacing it with body before every close path', () => {
  for (const kind of ['button', 'escape', 'backdrop']) {
    const dom = createInvoicePanelDom({ simulateDetailRerender: true });
    dom.detailOpener.focus();
    dom.controller.openDetail('invoice-1', dom.detailOpener);

    const openingReplacement = dom.renderedDetailRows[0];
    assert.equal(dom.document.activeElement, dom.detailClose, `${kind} opens detail from a rendered invoice row`);
    assert.equal(dom.state.lastFocus, openingReplacement, `${kind} preserves the current re-rendered detail opener`);
    assert.notEqual(dom.state.lastFocus, dom.document.body, `${kind} never records body as the return focus target`);

    if (kind === 'button') dom.document.dispatch('click', dom.detailClose);
    if (kind === 'escape') dom.document.dispatch('keydown', dom.document.body, { key: 'Escape' });
    if (kind === 'backdrop') dom.document.dispatch('click', dom.document.querySelector('[data-panel-backdrop]'));

    const closingReplacement = dom.renderedDetailRows[0];
    assert.notEqual(closingReplacement, openingReplacement, `${kind} refreshes the invoice trigger after closing detail`);
    assert.equal(dom.document.activeElement, closingReplacement, `${kind} restores focus to the current re-rendered invoice trigger`);
    assert.notEqual(dom.document.activeElement, dom.document.body, `${kind} never leaves focus on body`);
    assert.equal(dom.detail.contains(dom.document.activeElement), false, `${kind} does not retain focus inside aria-hidden detail`);
    assert.equal(dom.detail.getAttribute('aria-hidden'), 'true', `${kind} closes the detail panel`);
    assert.equal(dom.detail.getAttribute('inert'), '', `${kind} makes the detail panel inert`);
    assert.equal(dom.document.activeElement.hidden, false, `${kind} restores a visible focus target`);
    assert.ok(dom.document.activeElement.getClientRects().length, `${kind} restores a rendered focus target`);
    assert.equal(dom.ariaHiddenFocus.at(-1), closingReplacement, `${kind} focuses outside before detail becomes aria-hidden`);
  }
});


test('FF-INV-003 exposes a visible, actionable backdrop only after each panel opens and hides it on every close route', () => {
  for (const panelCase of [
    { panel: 'detail', opener: 'detailOpener', closer: 'detailClose' },
    { panel: 'formPanel', opener: 'formOpener', closer: 'formClose' }
  ]) {
    const dom = createInvoicePanelDom({ deferAnimationFrame: true });
    const panel = dom[panelCase.panel];
    const opener = dom[panelCase.opener];
    const closer = dom[panelCase.closer];
    const backdrop = dom.document.querySelector('[data-panel-backdrop]');

    opener.focus();
    dom.controller.openPanel(panel, closer);
    assert.equal(backdrop.hidden, true, `${panelCase.panel} keeps the backdrop hidden before its deferred visible state`);

    dom.flushAnimationFrames();
    assert.equal(panel.classList.contains('is-open'), true, `${panelCase.panel} applies its visible state`);
    assert.equal(backdrop.hidden, false, `${panelCase.panel} exposes the backdrop once open`);

    dom.document.dispatch('click', backdrop);
    assert.equal(panel.classList.contains('is-open'), false, `the backdrop pointer route closes ${panelCase.panel}`);
    assert.equal(backdrop.hidden, true, `closing ${panelCase.panel} hides the backdrop`);
    assert.notEqual(dom.document.activeElement, dom.document.body, `${panelCase.panel} closes onto external usable focus`);
    assert.equal(panel.contains(dom.document.activeElement), false, `${panelCase.panel} does not retain focus in aria-hidden content`);
    assert.equal(panel.getAttribute('aria-hidden'), 'true', `${panelCase.panel} closes as aria-hidden`);
    assert.equal(panel.getAttribute('inert'), '', `${panelCase.panel} closes inert`);
  }
});
