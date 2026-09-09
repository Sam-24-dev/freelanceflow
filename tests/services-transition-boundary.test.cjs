const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const controllerSource = fs.readFileSync(path.join(__dirname, '../assets/js/servicios.js'), 'utf8');

function createElement(id = '') {
  const listeners = {};
  const attributes = {};
  const element = {
    id,
    hidden: false,
    disabled: false,
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    classList: { add() {}, remove() {} },
    addEventListener(type, callback) { listeners[type] = callback; },
    setAttribute(name, value) { attributes[name] = String(value); },
    removeAttribute(name) { delete attributes[name]; },
    getAttribute(name) { return attributes[name] ?? null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    reset() {},
    focus() {},
    showModal() {},
    getListener(type) { return listeners[type]; }
  };
  return element;
}

async function loadController(apiOverrides = {}) {
  const elements = new Map();
  const getElement = (id) => elements.get(id) || elements.set(id, createElement(id)).get(id);
  const documentListeners = {};
  const document = {
    body: getElement('body'),
    activeElement: getElement('active'),
    addEventListener(type, callback) { documentListeners[type] = callback; },
    getElementById: getElement,
    querySelector: () => getElement('layout')
  };
  const storage = {
    writes: 0,
    getItem() { return null; },
    setItem() { this.writes += 1; }
  };
  const activity = [];
  const form = getElement('service-form');
  getElement('service-toast').hidden = true;
  form.elements = [];
  form.querySelectorAll = () => [];
  const fields = ['id', 'nombre_servicio', 'descripcion', 'unidad_medida', 'tarifa_unitaria', 'moneda'];
  fields.forEach((name) => {
    const field = getElement(`service-${name}`);
    field.name = name;
    form.elements.push(field);
    form.elements[name] = field;
  });
  Object.assign(form.elements, {
    id: Object.assign(form.elements.id, { value: '' }),
    nombre_servicio: Object.assign(form.elements.nombre_servicio, { value: 'Nuevo servicio' }),
    unidad_medida: Object.assign(form.elements.unidad_medida, { value: 'Hora' }),
    tarifa_unitaria: Object.assign(form.elements.tarifa_unitaria, { value: '10' }),
    moneda: Object.assign(form.elements.moneda, { value: 'USD' })
  });
  const context = {
    document,
    localStorage: storage,
    console: { error() {} },
    Intl,
    Date,
    FormData: class {
      constructor(currentForm) { this.form = currentForm; }
      entries() { return this.form.elements.map((field) => [field.name, field.value]); }
    },
    setTimeout: () => 0,
    clearTimeout() {},
    requestAnimationFrame(callback) { callback(); },
    confirm: () => true,
    FreelanceFlowServiceModel: require('../assets/js/service-model.js'),
    FreelanceFlowActivity: { record(event) { activity.push(event); } },
    FreelanceFlowApi: { services: async () => ({ items: [{ public_id: 'srv_001', name: 'Auditoria', description: '', unit_of_measure: 'HOUR', rate: '10.00', currency: 'USD', status: 'ACTIVE', archived_at: null }], next_cursor: null }), createService: async () => ({ public_id: 'srv_002' }), ...apiOverrides },
    window: null,
    globalThis: null
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(controllerSource, context);
  await documentListeners.DOMContentLoaded();
  return { elements, form, storage, activity };
}

test('Services create and edit are enabled while remove remains disabled', async () => {
  const { elements } = await loadController();
  const renderedActions = elements.get('services-table-body').innerHTML;

  assert.equal(elements.get('service-create-button').disabled, false);
  assert.doesNotMatch(renderedActions, /data-action="edit-service"[^>]*disabled/);
  assert.match(renderedActions, /data-action="remove-service"[^>]*disabled/);
  assert.match(renderedActions, /aria-describedby="services-mutations-unavailable"/);
});

test('Services notice names only disabled delete while preserving the delete aria contract', () => {
  const page = fs.readFileSync(path.join(__dirname, '../pages/servicios.html'), 'utf8');
  assert.match(page, /Eliminar servicios no est[aá]n disponibles/);
  assert.doesNotMatch(page, /Editar y eliminar servicios no est[aá]n disponibles/);
  assert.match(page, /value="confirm"[^>]*disabled[^>]*aria-describedby="services-mutations-unavailable"/);
});

test('Services edit PATCHes, then refetches the confirmed list and preserves zero', async () => {
  const calls = [];
  const harness = await loadController({
    updateService: async (id, payload) => { calls.push(['patch', id, payload]); return { public_id: id }; },
    services: async () => { calls.push(['get']); return { items: [{ public_id: 'srv_001', name: 'Updated', description: '', unit_of_measure: 'HOUR', rate: '0.00', currency: 'USD', status: 'ACTIVE', archived_at: null }], next_cursor: null }; }
  });
  const edit = harness.elements.get('services-table-body').innerHTML.match(/data-action="edit-service"[^>]*data-id="([^"]+)"/)[1];
  harness.elements.get('main-content').getListener('click')({ target: { closest: () => ({ dataset: { action: 'edit-service', id: edit } }) } });
  harness.form.elements.nombre_servicio.value = 'Updated';
  harness.form.elements.tarifa_unitaria.value = '0.00';
  await harness.form.getListener('submit')({ preventDefault() {} });
  assert.deepEqual(JSON.parse(JSON.stringify(calls.slice(1))), [['patch', 'srv_001', { name: 'Updated', description: '', unit_of_measure: 'HOUR', rate: '0.00', currency: 'USD' }], ['get']]);
  assert.equal(harness.elements.get('service-toast').hidden, false);
});

test('Services edit failure retains the confirmed list and announces no success', async () => {
  const harness = await loadController({ updateService: async () => { throw new Error('offline'); } });
  harness.elements.get('main-content').getListener('click')({ target: { closest: () => ({ dataset: { action: 'edit-service', id: 'srv_001' } }) } });
  await harness.form.getListener('submit')({ preventDefault() {} });
  assert.match(harness.elements.get('services-table-body').innerHTML, /Auditoria/);
  assert.equal(harness.activity.length, 0);
  assert.equal(harness.elements.get('service-toast').dataset.tone, 'error');
  assert.equal(harness.elements.get('service-toast').textContent, 'No pudimos actualizar el servicio. Reintentá.');
});

test('Services create failure retains the confirmed list and announces no success', async () => {
  const harness = await loadController({ createService: async () => { throw new Error('offline'); } });
  await harness.form.getListener('submit')({ preventDefault() {} });
  assert.match(harness.elements.get('services-table-body').innerHTML, /Auditoria/);
  assert.equal(harness.activity.length, 0);
  assert.equal(harness.elements.get('service-toast').dataset.tone, 'error');
  assert.equal(harness.elements.get('service-toast').textContent, 'No pudimos crear el servicio. Reintentá.');
});

test('Services edit does not announce success when the confirmation refetch fails', async () => {
  let reads = 0;
  const harness = await loadController({
    services: async () => { reads += 1; if (reads > 1) throw new Error('offline'); return { items: [{ public_id: 'srv_001', name: 'Auditoria', description: '', unit_of_measure: 'HOUR', rate: '10.00', currency: 'USD', status: 'ACTIVE', archived_at: null }], next_cursor: null }; },
    updateService: async () => ({ public_id: 'srv_001' })
  });
  harness.elements.get('main-content').getListener('click')({ target: { closest: () => ({ dataset: { action: 'edit-service', id: 'srv_001' } }) } });
  await harness.form.getListener('submit')({ preventDefault() {} });
  assert.equal(harness.activity.length, 0);
  assert.equal(harness.elements.get('service-toast').dataset.tone, 'error');
  assert.equal(harness.elements.get('service-toast').textContent, 'El servicio se actualizó, pero no pudimos actualizar el catálogo. Reintentá.');
  assert.match(harness.elements.get('services-table-body').innerHTML, /Auditoria/);
});

test('Services create does not announce success when the confirmation refetch fails', async () => {
  let reads = 0;
  const harness = await loadController({
    services: async () => { reads += 1; if (reads > 1) throw new Error('offline'); return { items: [{ public_id: 'srv_001', name: 'Auditoria', description: '', unit_of_measure: 'HOUR', rate: '10.00', currency: 'USD', status: 'ACTIVE', archived_at: null }], next_cursor: null }; },
    createService: async () => ({ public_id: 'srv_002' })
  });
  await harness.form.getListener('submit')({ preventDefault() {} });
  assert.equal(harness.activity.length, 0);
  assert.equal(harness.elements.get('service-toast').dataset.tone, 'error');
  assert.equal(harness.elements.get('service-toast').textContent, 'El servicio se creó, pero no pudimos actualizar el catálogo. Reintentá.');
  assert.match(harness.elements.get('services-table-body').innerHTML, /Auditoria/);
});

test('Services create uses the API and never persists a local mutation', async () => {
  const { form, storage, elements, activity } = await loadController();
  const submit = form.getListener('submit');

  await submit({ preventDefault() {} });

  assert.equal(storage.writes, 0);
  assert.equal(activity.length, 1);
  assert.equal(elements.get('service-toast').hidden, false);
  assert.equal(elements.get('service-toast').textContent, 'Servicio creado correctamente.');
});

test('Services edit announces the update success copy after confirmed refetch', async () => {
  const harness = await loadController({
    updateService: async () => ({ public_id: 'srv_001' }),
    services: async () => ({ items: [{ public_id: 'srv_001', name: 'Updated', description: '', unit_of_measure: 'HOUR', rate: '10.00', currency: 'USD', status: 'ACTIVE', archived_at: null }], next_cursor: null })
  });
  harness.elements.get('main-content').getListener('click')({ target: { closest: () => ({ dataset: { action: 'edit-service', id: 'srv_001' } }) } });
  await harness.form.getListener('submit')({ preventDefault() {} });
  assert.equal(harness.activity.length, 1);
  assert.equal(harness.activity[0].action, 'Servicio actualizado');
  assert.equal(harness.elements.get('service-toast').textContent, 'Servicio actualizado correctamente.');
});
