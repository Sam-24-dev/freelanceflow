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

async function loadController() {
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
    FreelanceFlowApi: { services: async () => ({ items: [{ public_id: 'srv_001', name: 'Auditoria', description: '', unit_of_measure: 'HOUR', rate: '10.00', currency: 'USD', status: 'ACTIVE', archived_at: null }], next_cursor: null }), createService: async () => ({ public_id: 'srv_002' }) },
    window: null,
    globalThis: null
  };
  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(controllerSource, context);
  await documentListeners.DOMContentLoaded();
  return { elements, form, storage, activity };
}

test('Services create is enabled while edit and remove remain disabled', async () => {
  const { elements } = await loadController();
  const renderedActions = elements.get('services-table-body').innerHTML;

  assert.equal(elements.get('service-create-button').disabled, false);
  assert.match(renderedActions, /data-action="edit-service"[^>]*disabled/);
  assert.match(renderedActions, /data-action="remove-service"[^>]*disabled/);
  assert.match(renderedActions, /aria-describedby="services-mutations-unavailable"/);
});

test('Services create uses the API and never persists a local mutation', async () => {
  const { form, storage, elements, activity } = await loadController();
  const submit = form.getListener('submit');

  await submit({ preventDefault() {} });

  assert.equal(storage.writes, 0);
  assert.equal(activity.length, 1);
  assert.equal(elements.get('service-toast').hidden, false);
});
