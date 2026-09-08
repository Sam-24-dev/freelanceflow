const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadApi(fetchImpl) {
  const originalFetch = global.fetch;
  const originalDocument = global.document;
  global.fetch = fetchImpl;
  global.document = { cookie: '' };
  delete require.cache[require.resolve('../assets/js/api-client.js')];
  const api = require('../assets/js/api-client.js');
  return { api, restore() { global.fetch = originalFetch; global.document = originalDocument; } };
}

const apiPage = { items: [], next_cursor: null };

test('services API client reads same-origin pages and optionally encodes cursors', async () => {
  const calls = [];
  const harness = loadApi(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ data: apiPage }) };
  });
  try {
    assert.deepEqual(await harness.api.services(), apiPage);
    assert.deepEqual(await harness.api.services('next page/ß'), apiPage);
    assert.equal(calls[0].url, '/api/v1/services/');
    assert.equal(calls[1].url, '/api/v1/services/?cursor=next%20page%2F%C3%9F');
    assert.equal(calls[0].options.credentials, 'same-origin');
    assert.equal(calls[0].options.headers.Accept, 'application/json');
  } finally { harness.restore(); }
});

test('services API client posts create payload with the CSRF header', async () => {
  const calls = [];
  const harness = loadApi(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ data: { public_id: 'server-id' } }) };
  });
  global.document.cookie = 'csrftoken=csrf-token';
  try {
    await harness.api.createService({ name: 'Audit', description: '', unit_of_measure: 'HOUR', rate: '0.00', currency: 'USD' });
    assert.equal(calls[0].url, '/api/v1/services/');
    assert.equal(calls[0].options.method, 'POST');
    assert.equal(calls[0].options.headers['X-CSRFToken'], 'csrf-token');
    assert.deepEqual(JSON.parse(calls[0].options.body), { name: 'Audit', description: '', unit_of_measure: 'HOUR', rate: '0.00', currency: 'USD' });
  } finally { harness.restore(); }
});

test('service adapter maps server units, USD rate, and archived display state', () => {
  const model = require('../assets/js/service-model.js');
  assert.deepEqual(model.mapApiServiceRecord({
    public_id: 'srv-1', name: 'Auditoría', description: 'Revisión',
    unit_of_measure: 'HOUR', rate: '125.50', currency: 'USD', status: 'ARCHIVED', archived_at: '2026-01-01T00:00:00Z'
  }), {
    id: 'srv-1', nombre_servicio: 'Auditoría', descripcion: 'Revisión', unidad_medida: 'Hora', tarifa_unitaria: 125.5,
    moneda: 'USD', estado: 'archivado', archived_at: '2026-01-01T00:00:00Z'
  });
});

test('service adapter preserves a server-authoritative zero rate', () => {
  const model = require('../assets/js/service-model.js');
  const record = {
    ...service,
    rate: '0.00'
  };
  assert.equal(model.mapApiServiceRecord(record).tarifa_unitaria, 0);
  assert.equal(model.mapApiServiceRecord({ ...record, rate: 0 }).tarifa_unitaria, 0);
});

test('service adapter rejects coerced or invalid rate values', () => {
  const model = require('../assets/js/service-model.js');
  for (const rate of [false, [], ' ', 'not-a-rate', NaN, 'Infinity', -1]) {
    assert.equal(model.mapApiServiceRecord({ ...service, rate }).tarifa_unitaria, null, `rate ${String(rate)}`);
  }
});

function createElement(id) {
  const listeners = {};
  const attributes = {};
  return {
    id, hidden: false, disabled: false, value: '', textContent: '', innerHTML: '', dataset: {},
    classList: { add() {}, remove() {} },
    addEventListener(type, callback) { listeners[type] = callback; },
    getListener(type) { return listeners[type]; },
    setAttribute(name, value) { attributes[name] = String(value); },
    removeAttribute(name) { delete attributes[name]; },
    getAttribute(name) { return attributes[name] ?? null; },
    querySelectorAll() { return []; }, querySelector() { return null; }, reset() {}, focus() {}, showModal() {}
  };
}

async function loadController(pages) {
  const elements = new Map();
  const getElement = (id) => elements.get(id) || elements.set(id, createElement(id)).get(id);
  const documentListeners = {};
  const document = {
    body: getElement('body'), activeElement: getElement('active'),
    addEventListener(type, callback) { documentListeners[type] = callback; },
    getElementById: getElement, querySelector: () => getElement('layout')
  };
  const form = getElement('service-form');
  form.elements = []; form.querySelectorAll = () => [];
  ['id', 'nombre_servicio', 'descripcion', 'unidad_medida', 'tarifa_unitaria', 'moneda'].forEach((name) => {
    const field = getElement(`service-${name}`); field.name = name; field.value = ''; form.elements.push(field); form.elements[name] = field;
  });
  const calls = [];
  const context = {
    document, console: { error() {} }, Intl, Date, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: (fn) => fn(),
    confirm: () => true, FreelanceFlowServiceModel: require('../assets/js/service-model.js'),
    FreelanceFlowActivity: { record() {} }, FreelanceFlowApi: { services: async (cursor) => { calls.push(cursor ?? null); const page = pages.shift(); if (page instanceof Error) throw page; return page; } },
    window: null, globalThis: null
  };
  context.window = context; context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/js/servicios.js'), 'utf8'), context);
  await documentListeners.DOMContentLoaded();
  return { elements, calls };
}

const service = { public_id: 'srv-1', name: 'Auditoría', description: 'Revisión', unit_of_measure: 'HOUR', rate: '10.00', currency: 'USD', status: 'ACTIVE', archived_at: null };

test('services controller loads every page and refresh refetches without local storage', async () => {
  const first = { items: [service], next_cursor: 'page-2' };
  const second = { items: [{ ...service, public_id: 'srv-2', name: 'Proyecto', status: 'ARCHIVED', archived_at: '2026-01-02T00:00:00Z' }], next_cursor: null };
  const harness = await loadController([first, second, { items: [], next_cursor: null }]);
  assert.deepEqual(harness.calls, [null, 'page-2']);
  assert.match(harness.elements.get('services-table-body').innerHTML, /Auditoría/);
  assert.match(harness.elements.get('services-table-body').innerHTML, /Archivado/);
  assert.equal(String(harness.elements.get('services-total-count').textContent), '2');
  harness.elements.get('service-search').getListener('input')({ currentTarget: { value: 'Proyecto' } });
  assert.match(harness.elements.get('services-table-body').innerHTML, /Proyecto/);
  assert.doesNotMatch(harness.elements.get('services-table-body').innerHTML, /Auditoría/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../assets/js/servicios.js'), 'utf8'), /mock-data|readStored|freelanceflow_services_v1|mergeServices/);
  await harness.elements.get('services-retry-button').getListener('click')();
  assert.deepEqual(harness.calls, [null, 'page-2', null]);
});

test('services controller rejects malformed, repeated, and mid-page failures then retry can recover', async () => {
  for (const pages of [[{ items: {}, next_cursor: null }], [{ items: [], next_cursor: 'same' }, { items: [], next_cursor: 'same' }], [{ items: [service], next_cursor: 'next' }, new Error('offline'), { items: [service], next_cursor: null }]]) {
    const shouldRecover = pages.some((page) => page instanceof Error);
    const harness = await loadController(pages);
    assert.equal(harness.elements.get('services-content').hidden, true);
    assert.equal(harness.elements.get('services-data-error').hidden, false);
    if (shouldRecover) {
      await harness.elements.get('services-retry-button').getListener('click')();
      assert.deepEqual(harness.calls, [null, 'next', null]);
      assert.equal(harness.elements.get('services-content').hidden, false);
      assert.match(harness.elements.get('services-table-body').innerHTML, /Auditoría/);
    }
  }
});
