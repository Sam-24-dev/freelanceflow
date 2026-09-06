const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  CLIENT_STORAGE_KEY,
  CIVIL_STATUS_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  createClientRecord,
  filterClients,
  getEffectiveClients,
  getSelectableClients,
  mapApiClientRecord,
  mergeClients,
  normalizeClient,
  persistClients,
  sanitizeStoredClients,
  validateClient
} = require('../assets/js/client-model.js');

test('mapApiClientRecord maps the public API record into the directory view model', () => {
  const client = mapApiClientRecord({
    public_id: 'client-1',
    legal_name: 'Acme Corporation',
    client_type: 'COMPANY',
    tax_identifier: 'RUC-100',
    primary_contact_name: 'Ada Lovelace',
    primary_contact_email: 'ada@example.com',
    primary_contact_phone: '0999999999',
    telephone: '0225551234',
    address: '42 Example Street',
    civil_status: 'MARRIED',
    status: 'ACTIVE',
    archived_at: null
  });

  assert.deepEqual(client, {
    id: 'client-1',
    nombre_razon_social: 'Acme Corporation',
    tipo_cliente: 'Empresa',
    nombres: 'Ada',
    apellidos: 'Lovelace',
    identificacion: 'RUC-100',
    identificacion_fiscal: 'RUC-100',
    telefono: '0225551234',
    celular: '0999999999',
    correo: 'ada@example.com',
    correo_electronico: 'ada@example.com',
    direccion: '42 Example Street',
    estadoCivil: 'casado',
    estado: 'activo',
    fecha_registro: ''
  });
});

test('mapApiClientRecord keeps unknown or null civil status unregistered', () => {
  for (const civil_status of [null, 'WIDOWED']) {
    assert.equal(mapApiClientRecord({ civil_status }).estadoCivil, '');
  }
});

test('mapApiClientRecord maps COMMONLAW to the exact unión libre UI option', () => {
  assert.equal(mapApiClientRecord({ civil_status: 'COMMONLAW' }).estadoCivil, CIVIL_STATUS_OPTIONS[4]);
});

test('filterClients does not turn an unregistered civil status into a visible fact', () => {
  const client = mapApiClientRecord({ public_id: 'client-1', legal_name: 'Acme', civil_status: null });
  assert.equal(filterClients([client])[0].estadoCivil, '');
});

const validClient = {
  nombre_razon_social: 'Bodega Andina S.A.',
  tipo_cliente: 'Empresa',
  nombres: 'Marcela',
  apellidos: 'Ríos Paredes',
  identificacion: '1791234567001',
  telefono: '',
  celular: '+593 99 845 6712',
  correo: 'marcela.rios@bodegaandina.com.ec',
  direccion: '',
  estadoCivil: 'casado',
  estado: 'activo'
};

test('normalizeClient preserves the B2B model and maps compatibility fields', () => {
  const client = normalizeClient({
    id: 'cli_1',
    nombre_razon_social: 'Acme S.A.',
    correo_electronico: 'legal@acme.test',
    identificacion_fiscal: 'RUC-100',
    nombres: 'Ana',
    apellidos: 'Pérez',
    celular: '0991234567'
  });

  assert.equal(client.correo, 'legal@acme.test');
  assert.equal(client.identificacion, 'RUC-100');
  assert.equal(client.tipo_cliente, 'Empresa');
  assert.equal(client.estadoCivil, 'soltero');
  assert.equal(client.estado, 'activo');
});

test('validateClient reports all missing mandatory fields for inline validation', () => {
  const result = validateClient({}, []);

  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(), [
    'apellidos',
    'celular',
    'correo',
    'estado',
    'estadoCivil',
    'identificacion',
    'nombre_razon_social',
    'nombres',
    'tipo_cliente'
  ]);
});

test('validateClient rejects invalid email, mobile, civil status and status', () => {
  const result = validateClient({
    ...validClient,
    correo: 'correo-invalido',
    celular: '123',
    estadoCivil: 'viudo',
    estado: 'pausado'
  }, []);

  assert.equal(result.errors.correo, 'Ingresa un correo electrónico válido.');
  assert.equal(result.errors.celular, 'Ingresa un número de celular válido.');
  assert.equal(result.errors.estadoCivil, 'Selecciona el estado civil del contacto principal.');
  assert.equal(result.errors.estado, 'Selecciona si el cliente está activo o inactivo.');
});

test('validateClient rejects a duplicate normalized identification except for the edited record', () => {
  const existing = [{ ...validClient, id: 'cli_existing', identificacion: 'EIN-87-ABC' }];
  const duplicate = validateClient({ ...validClient, identificacion: ' ein-87-abc ' }, existing);
  const editingSame = validateClient({ ...validClient, id: 'cli_existing', identificacion: 'EIN-87-ABC' }, existing);

  assert.equal(duplicate.errors.identificacion, 'Ya existe un cliente con esta identificación.');
  assert.equal(editingSame.valid, true);
});

test('filterClients combines accent-insensitive search and status, then sorts by business name', () => {
  const clients = [
    { ...validClient, id: '2', nombre_razon_social: 'Zeta', nombres: 'Ángela', estado: 'activo' },
    { ...validClient, id: '1', nombre_razon_social: 'Andina', nombres: 'Angela', estado: 'inactivo' },
    { ...validClient, id: '3', nombre_razon_social: 'Brisa', nombres: 'Daniel', estado: 'activo' }
  ];

  assert.deepEqual(
    filterClients(clients, { query: 'angela', status: 'todos' }).map((client) => client.id),
    ['1', '2']
  );
  assert.deepEqual(
    filterClients(clients, { query: '', status: 'activo' }).map((client) => client.id),
    ['3', '2']
  );
});

test('mergeClients overlays stored edits and keeps new local clients', () => {
  const base = [
    { ...validClient, id: 'cli_1', identificacion: 'ID-1', nombre_razon_social: 'Original' },
    { ...validClient, id: 'cli_2', identificacion: 'ID-2', nombre_razon_social: 'Base' }
  ];
  const stored = [
    { ...validClient, id: 'cli_1', identificacion: 'ID-1', nombre_razon_social: 'Editado' },
    { ...validClient, id: 'cli_3', identificacion: 'ID-3', nombre_razon_social: 'Local' }
  ];

  const result = mergeClients(base, stored);
  assert.deepEqual(result.map((client) => client.nombre_razon_social), ['Editado', 'Base', 'Local']);
});

test('createClientRecord generates immutable metadata and compatibility fields', () => {
  const record = createClientRecord(validClient, {
    id: 'cli_generated',
    date: '2026-06-20'
  });

  assert.equal(record.id, 'cli_generated');
  assert.equal(record.fecha_registro, '2026-06-20');
  assert.equal(record.identificacion_fiscal, validClient.identificacion);
  assert.equal(record.correo_electronico, validClient.correo);
});

test('approved option sets remain exact', () => {
  assert.deepEqual(CIVIL_STATUS_OPTIONS, ['soltero', 'casado', 'divorciado', 'separado', 'unión libre']);
  assert.deepEqual(CLIENT_STATUS_OPTIONS, ['activo', 'inactivo']);
});

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
    value(key) { return values.get(key); }
  };
}

test('getEffectiveClients keeps the valid baseline when storage JSON is corrupt or unavailable', () => {
  const base = [{ ...validClient, id: 'cli_base' }];
  const corrupt = memoryStorage({ [CLIENT_STORAGE_KEY]: '{bad json' });
  const blocked = { getItem() { throw new Error('SecurityError'); } };

  assert.deepEqual(getEffectiveClients(base, corrupt), base.map(normalizeClient));
  assert.deepEqual(getEffectiveClients(base, blocked), base.map(normalizeClient));
});

test('getEffectiveClients survives a browser that blocks access to localStorage itself', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    assert.deepEqual(getEffectiveClients([{ ...validClient, id: 'cli_base' }]).map((client) => client.id), ['cli_base']);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('getEffectiveClients ignores a stored non-array overlay', () => {
  const base = [{ ...validClient, id: 'cli_base' }];
  const storage = memoryStorage({ [CLIENT_STORAGE_KEY]: JSON.stringify({ items: [validClient] }) });

  assert.deepEqual(getEffectiveClients(base, storage), base.map(normalizeClient));
});

test('sanitizeStoredClients rejects empty and duplicate IDs without last-write-wins', () => {
  const base = [{ ...validClient, id: 'cli_base', nombre_razon_social: 'Baseline' }];
  const overlay = [
    { ...validClient, id: '', identificacion: 'EMPTY' },
    { ...validClient, id: 'cli_base', nombre_razon_social: 'First' },
    { ...validClient, id: 'cli_base', nombre_razon_social: 'Second' }
  ];

  assert.deepEqual(sanitizeStoredClients(overlay, base), []);
  const storage = memoryStorage({ [CLIENT_STORAGE_KEY]: JSON.stringify(overlay) });
  assert.equal(getEffectiveClients(base, storage)[0].nombre_razon_social, 'Baseline');
});

test('sanitizeStoredClients rejects duplicate normalized identifications across client IDs', () => {
  const base = [{ ...validClient, id: 'cli_base', identificacion: 'RUC-123' }];
  const overlay = [
    { ...validClient, id: 'cli_new', identificacion: ' ruc 123 ' }
  ];

  assert.deepEqual(sanitizeStoredClients(overlay, base), []);
});

test('sanitizeStoredClients drops malformed records and unknown properties', () => {
  const overlay = [
    null,
    'client',
    { id: 'cli_missing' },
    { ...validClient, id: 'cli_valid', unexpected: '<script>alert(1)</script>' }
  ];

  const result = sanitizeStoredClients(overlay, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'cli_valid');
  assert.equal(Object.hasOwn(result[0], 'unexpected'), false);
});

test('sanitizeStoredClients rejects invalid or missing raw required enums', () => {
  const missingStatus = { ...validClient, id: 'cli_missing_status' };
  const missingCivilStatus = { ...validClient, id: 'cli_missing_civil_status' };
  delete missingStatus.estado;
  delete missingCivilStatus.estadoCivil;

  assert.deepEqual(sanitizeStoredClients([{ ...validClient, id: 'cli_invalid_status', estado: 'BROKEN' }], []), []);
  assert.deepEqual(sanitizeStoredClients([missingStatus], []), []);
  assert.deepEqual(sanitizeStoredClients([{ ...validClient, id: 'cli_invalid_civil_status', estadoCivil: 'BROKEN' }], []), []);
  assert.deepEqual(sanitizeStoredClients([missingCivilStatus], []), []);
});

test('invalid stored overlays preserve active and inactive baseline records', () => {
  const base = [
    { ...validClient, id: 'cli_active', identificacion: 'ACTIVE-1', nombre_razon_social: 'Active Baseline' },
    { ...validClient, id: 'cli_inactive', identificacion: 'INACTIVE-1', nombre_razon_social: 'Inactive Baseline', estado: 'inactivo' }
  ];
  const overlay = [
    { ...base[0], nombre_razon_social: 'Corrupt Active Overlay', estadoCivil: 'BROKEN' },
    { ...base[1], nombre_razon_social: 'Corrupt Inactive Overlay', estado: 'BROKEN' }
  ];
  const result = getEffectiveClients(base, memoryStorage({
    [CLIENT_STORAGE_KEY]: JSON.stringify(overlay)
  }));

  assert.deepEqual(result.map((client) => client.nombre_razon_social), ['Active Baseline', 'Inactive Baseline']);
  assert.equal(result.find((client) => client.id === 'cli_inactive').estado, 'inactivo');
});

test('an invalid local-only stored client disappears from the effective catalog', () => {
  const overlay = [{ ...validClient, id: 'cli_local', estado: 'BROKEN' }];
  const storage = memoryStorage({ [CLIENT_STORAGE_KEY]: JSON.stringify(overlay) });

  assert.deepEqual(getEffectiveClients([], storage), []);
});

test('a completely valid stored overlay remains accepted', () => {
  const base = [{ ...validClient, id: 'cli_base', nombre_razon_social: 'Baseline' }];
  const overlay = [{ ...base[0], nombre_razon_social: 'Valid Overlay', estado: 'inactivo' }];
  const storage = memoryStorage({ [CLIENT_STORAGE_KEY]: JSON.stringify(overlay) });

  assert.equal(sanitizeStoredClients(overlay, base).length, 1);
  assert.equal(getEffectiveClients(base, storage)[0].nombre_razon_social, 'Valid Overlay');
  assert.equal(getEffectiveClients(base, storage)[0].estado, 'inactivo');
});

test('a valid stored edit replaces the baseline record with the same ID', () => {
  const base = [{ ...validClient, id: 'cli_base', nombre_razon_social: 'Baseline' }];
  const overlay = [{ ...validClient, id: 'cli_base', nombre_razon_social: 'Edited' }];

  assert.equal(mergeClients(base, overlay)[0].nombre_razon_social, 'Edited');
});

test('persistClients reports storage failure and never mutates the candidate', () => {
  const candidate = [{ ...validClient, id: 'cli_candidate' }];
  const blocked = { setItem() { throw new Error('QuotaExceededError'); } };

  assert.equal(persistClients(candidate, blocked), false);
  assert.deepEqual(candidate, [{ ...validClient, id: 'cli_candidate' }]);
});

test('persistClients reports failure when access to localStorage itself is blocked', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    assert.equal(persistClients([{ ...validClient, id: 'cli_candidate' }]), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('persistClients writes the complete candidate before reporting success', () => {
  const storage = memoryStorage();
  const candidate = [{ ...validClient, id: 'cli_candidate' }];

  assert.equal(persistClients(candidate, storage), true);
  assert.deepEqual(JSON.parse(storage.value(CLIENT_STORAGE_KEY)), candidate);
});

test('getSelectableClients excludes inactive clients except the selected historical reference', () => {
  const clients = [
    { ...validClient, id: 'cli_active', estado: 'activo' },
    { ...validClient, id: 'cli_inactive', estado: 'inactivo' }
  ];

  assert.deepEqual(getSelectableClients(clients).map((client) => client.id), ['cli_active']);
  assert.deepEqual(getSelectableClients(clients, 'cli_inactive').map((client) => client.id), ['cli_active', 'cli_inactive']);
});

test('all six consumers load and use the canonical effective client catalog', () => {
  const consumers = [
    ['dashboard', 'assets/js/dashboard.js', 'pages/dashboard.html'],
    ['proposals', 'assets/js/propuestas.js', 'pages/propuestas.html'],
    ['projects', 'assets/js/proyectos.js', 'pages/proyectos.html'],
    ['invoices', 'assets/js/facturas.js', 'pages/facturas.html'],
    ['transactions', 'assets/js/transacciones.js', 'pages/transacciones.html'],
    ['reports', 'assets/js/reportes.js', 'pages/reportes.html']
  ];

  consumers.forEach(([name, scriptPath, pagePath]) => {
    const source = fs.readFileSync(path.join(__dirname, '..', scriptPath), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', pagePath), 'utf8');
    assert.match(source, /getEffectiveClients\(/, `${name} must use getEffectiveClients`);
    assert.match(html, /client-model\.js/, `${name} must load client-model.js`);
  });
});

test('client controls keep a minimum 44 by 44 pixel target', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /\.client-filter-tab\s*\{[^}]*min-height:\s*2\.75rem/s);
  assert.match(css, /\.client-inline-select\s*\{[^}]*min-height:\s*2\.75rem/s);
  assert.match(css, /\.client-row-actions\s*>\s*button:first-child\s*\{[^}]*min-height:\s*2\.75rem/s);
  assert.match(css, /\.client-icon-action\s*\{[^}]*width:\s*2\.75rem;[^}]*height:\s*2\.75rem/s);
  assert.match(css, /\.client-card footer \.clients-secondary-action\s*\{[^}]*min-height:\s*2\.75rem/s);
});
(function clientControllerRegressionTests() {
  const vm = require('node:vm'), model = require('../assets/js/client-model.js'), { createActivityLog } = require('../assets/js/activity-log.js');
const baselineClient = {
  id: 'cli_base', nombre_razon_social: 'Baseline Client', tipo_cliente: 'Empresa',
  nombres: 'Ana', apellidos: 'Pérez', identificacion: 'RUC-100', estadoCivil: 'soltero',
  correo: 'ana@example.com', celular: '0991234567', telefono: '', direccion: '',
  estado: 'activo', fecha_registro: '2026-07-01'
};
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
    value: (key) => values.get(key) ?? null
  };
}
function fakeElement(properties = {}) {
  const attributes = new Map(Object.entries(properties.attributes ?? {}));
  const classes = new Set();
  return {
    hidden: false, disabled: false, textContent: '', dataset: {}, value: '',
    ...properties,
    classList: { add: (...names) => names.forEach((name) => classes.add(name)), remove: (...names) => names.forEach((name) => classes.delete(name)) },
    setAttribute: (name, value) => attributes.set(name, String(value)), getAttribute: (name) => attributes.get(name) ?? null,
    removeAttribute: (name) => attributes.delete(name),
    toggleAttribute: (name, force) => force ? attributes.set(name, '') : attributes.delete(name),
    querySelector: () => null, querySelectorAll: () => [],
    focus() { this.focused = true; }
  };
}
function createActivity() {
  globalThis.FreelanceFlowMembershipContext = {
    MEMBERSHIPS: [{ id: 'ff-operational-v1', role: 'operational', actor: 'Operativo' }]
  };
  const storage = memoryStorage();
  let tick = 0;
  return createActivityLog({
    storage,
    getContext: () => ({ status: 'valid', membership: { id: 'ff-operational-v1' } }),
    now: () => new Date(Date.UTC(2026, 6, 1, 0, 0, tick++)).toISOString()
  });
}
function bootController({ clientStorage, formValues = {}, api = {} }) {
  const activity = createActivity();
  const form = fakeElement({ hidden: false });
  const elements = {
    appLayout: fakeElement(),
    backdrop: fakeElement(),
    drawer: fakeElement({ attributes: { 'aria-hidden': 'false' } }),
    loading: fakeElement(),
    content: fakeElement(),
    retryButton: fakeElement(),
    dataError: fakeElement({ hidden: true }),
    resultsCount: fakeElement(),
    form,
    formSummary: fakeElement({ hidden: true, attributes: { role: 'alert' } }),
    submitButton: fakeElement(),
    toast: fakeElement({ hidden: true })
  };
  let currentValues = { ...formValues };
  const document = {
    addEventListener() {},
    querySelector: () => null,
    body: fakeElement(),
    activeElement: null
  };
  const context = {
    console: { ...console, warn() {} },
    document,
    Intl,
    Date,
    URLSearchParams,
    FormData: class {
      get(name) { return currentValues[name] ?? ''; }
    },
    requestAnimationFrame: (callback) => callback(),
    setTimeout: () => 1,
    clearTimeout() {},
    crypto: { randomUUID: () => 'candidate-id' },
    FreelanceFlowApi: api
  };
  context.window = context;
  context.globalThis = context;
  context.FreelanceFlowClientModel = {
    ...model,
    persistClients: (clients) => model.persistClients(clients, clientStorage)
  };
  context.FreelanceFlowActivity = { record: (entry) => activity.record(entry) };
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/clientes.js'), 'utf8')
    .replace(/\r?\n}\(\)\);\s*$/, `
      globalThis.__clientsTest = {
        state,
        setElements(value) { elements = value; },
        setRenderAll(value) { renderAll = value; },
        loadAndRenderClients,
        renderDirectory,
        handleFormSubmit,
        applyClientFieldChange
      };
    }());`);
  vm.runInNewContext(source, context, { filename: 'clientes.js' });
  const controller = context.__clientsTest;
  controller.setElements(elements);
  controller.setRenderAll(() => {});
  controller.state.clients = [model.normalizeClient(baselineClient)];
  controller.state.drawerMode = 'form';
  return {
    activity,
    controller,
    elements,
    setFormValues: (values) => { currentValues = { ...values }; }
  };
}
function bootDirectoryController(api) {
  const elements = {
    loading: fakeElement(), content: fakeElement(), retryButton: fakeElement(), dataError: fakeElement(),
    resultsCount: fakeElement(), tableBody: fakeElement(), cardList: fakeElement(), emptyState: fakeElement(),
    noResults: fakeElement(), clearFilters: fakeElement(), totalCount: fakeElement(), activeCount: fakeElement(),
    inactiveCount: fakeElement()
  };
  const document = { addEventListener() {}, querySelector: () => null, body: fakeElement(), activeElement: null };
  const context = {
    console: { ...console }, document, Intl, Date, URLSearchParams,
    requestAnimationFrame: (callback) => callback(), setTimeout: () => 1, clearTimeout() {},
    window: null, globalThis: null, FreelanceFlowApi: api,
    FreelanceFlowClientModel: { ...model }
  };
  context.window = context;
  context.globalThis = context;
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/clientes.js'), 'utf8')
    .replace(/\r?\n}\(\)\);\s*$/, `
      globalThis.__clientsTest = { state, setElements(value) { elements = value; }, loadAndRenderClients, renderDirectory };
    }());`);
  vm.runInNewContext(source, context, { filename: 'clientes.js' });
  const controller = context.__clientsTest;
  controller.setElements(elements);
  controller.state.filters = { query: '', status: 'todos' };
  return { controller, elements };
}

test('client directory consumes every API page serially and filters the complete transient catalog', async () => {
  const calls = [];
  const pages = [
    { items: Array.from({ length: 25 }, (_, index) => ({
      public_id: `client-${index + 1}`, legal_name: `Client ${String(index + 1).padStart(2, '0')}`,
      client_type: 'COMPANY', tax_identifier: `RUC-${index + 1}`, primary_contact_name: 'Ada Lovelace',
      primary_contact_email: 'ada@example.com', primary_contact_phone: '0999999999', telephone: '', address: '',
      civil_status: 'SINGLE', status: 'ACTIVE', archived_at: null
    })), next_cursor: 'cursor-1' },
    { items: [{ public_id: 'client-26', legal_name: 'Client 26', client_type: 'COMPANY', tax_identifier: 'RUC-26',
      primary_contact_name: 'Ada Lovelace', primary_contact_email: 'ada@example.com', primary_contact_phone: '0999999999',
      telephone: '', address: '', civil_status: 'SINGLE', status: 'ACTIVE', archived_at: null }], next_cursor: null }
  ];
  const harness = bootDirectoryController({ clients: async (cursor) => { calls.push(cursor); return pages[calls.length - 1]; } });

  await harness.controller.loadAndRenderClients();

  assert.deepEqual(calls, [null, 'cursor-1']);
  assert.equal(harness.controller.state.clients.length, 26);
  harness.controller.state.filters.query = 'client 26';
  harness.controller.renderDirectory();
  assert.match(harness.elements.tableBody.innerHTML, /Client 26/);
  assert.doesNotMatch(harness.elements.tableBody.innerHTML, /Client 01/);
});

test('client directory clears partial API pages and retries from the first cursorless request', async () => {
  const calls = [];
  let fail = true;
  const page = { items: [{ public_id: 'client-1', legal_name: 'Client 1', client_type: 'COMPANY', tax_identifier: 'RUC-1',
    primary_contact_name: 'Ada Lovelace', primary_contact_email: 'ada@example.com', primary_contact_phone: '0999999999',
    telephone: '', address: '', civil_status: 'SINGLE', status: 'ACTIVE', archived_at: null }], next_cursor: 'cursor-1' };
  const api = { clients: async (cursor) => {
    calls.push(cursor);
    if (fail && cursor === 'cursor-1') throw new Error('page failed');
    return cursor === null ? { ...page, next_cursor: fail ? 'cursor-1' : null } : { items: page.items, next_cursor: null };
  } };
  const harness = bootDirectoryController(api);

  await harness.controller.loadAndRenderClients();
  assert.equal(harness.controller.state.clients.length, 0);
  assert.equal(harness.elements.content.hidden, true);
  fail = false;
  await harness.controller.loadAndRenderClients();
  assert.deepEqual(calls, [null, 'cursor-1', null]);
  assert.equal(harness.controller.state.clients.length, 1);
  assert.equal(harness.elements.content.hidden, false);
});

test('client directory rejects a repeated API cursor without rendering partial rows', async () => {
  const calls = [];
  const harness = bootDirectoryController({ clients: async (cursor) => {
    calls.push(cursor);
    return { items: [], next_cursor: 'cursor-1' };
  } });

  await harness.controller.loadAndRenderClients();

  assert.deepEqual(calls, [null, 'cursor-1']);
  assert.equal(harness.controller.state.clients.length, 0);
  assert.equal(harness.elements.content.hidden, true);
});
function validForm(overrides = {}) {
  return {
    id: '',
    nombre_razon_social: 'New Client',
    tipo_cliente: 'Empresa',
    nombres: 'Nora',
    apellidos: 'Vega',
    identificacion: 'RUC-200',
    estadoCivil: 'soltero',
    correo: 'nora@example.com',
    celular: '0997654321',
    telefono: '',
    direccion: '',
    estado: 'activo',
    ...overrides
  };
}
test('B2.1 blocks form submission without local persistence or fake success', () => {
  let writes = 0;
  const storage = memoryStorage();
  const clientStorage = {
    getItem: storage.getItem,
    setItem(key, value) { writes += 1; storage.setItem(key, value); }
  };
  const harness = bootController({ clientStorage, formValues: validForm({ nombre_razon_social: 'Blocked Create' }) });

  harness.controller.handleFormSubmit({ preventDefault() {} });

  assert.equal(writes, 0);
  assert.deepEqual(harness.controller.state.clients.map((client) => client.id), ['cli_base']);
  assert.equal(harness.controller.state.drawerMode, 'form');
  assert.equal(harness.elements.formSummary.hidden, false);
  assert.match(harness.elements.formSummary.textContent, /servidor/i);
  assert.equal(harness.elements.toast.dataset.type, 'error');
  assert.equal(harness.activity.read().length, 0);
});

test('B2.3 creates through the API, then renders only the fresh server catalog', async () => {
  const calls = [];
  const api = {
    async createClient(payload) { calls.push(['create', payload]); return { client: { public_id: 'response-only' } }; },
    async clients(cursor) {
      calls.push(['clients', cursor]);
      return {
        items: [{ public_id: 'server-client', legal_name: 'Server Client', client_type: 'COMPANY', tax_identifier: 'RUC-201',
          primary_contact_name: 'Ada Lovelace', primary_contact_email: 'ada@example.com', primary_contact_phone: '0999999999',
          telephone: '', address: '', civil_status: 'SINGLE', status: 'ACTIVE', archived_at: null }],
        next_cursor: null
      };
    }
  };
  const harness = bootController({ api, formValues: validForm({ celular: '+593 99 000 0001' }) });

  await harness.controller.handleFormSubmit({ preventDefault() {} });

  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [
    ['create', {
      legal_name: 'New Client', client_type: 'COMPANY', tax_identifier: 'RUC-200',
      primary_contact_name: 'Nora Vega', primary_contact_email: 'nora@example.com', primary_contact_phone: '593990000001',
      civil_status: 'SINGLE', status: 'ACTIVE'
    }],
    ['clients', null]
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(harness.controller.state.clients.map((client) => client.id))), ['server-client']);
  assert.equal(harness.controller.state.drawerMode, null);
  assert.equal(harness.elements.submitButton.disabled, false);
  assert.equal(harness.activity.read().length, 0);
});

test('B2.3 keeps the create form open and reports a generic API error', async () => {
  let reloads = 0;
  const harness = bootController({
    api: {
      async createClient() { throw new Error('invalid_request'); },
      async clients() { reloads += 1; return { items: [], next_cursor: null }; }
    },
    formValues: validForm({ nombre_razon_social: 'Rejected Client' })
  });

  await harness.controller.handleFormSubmit({ preventDefault() {} });

  assert.equal(reloads, 0);
  assert.equal(harness.controller.state.drawerMode, 'form');
  assert.equal(harness.elements.formSummary.hidden, false);
  assert.match(harness.elements.formSummary.textContent, /No se pudo registrar/i);
  assert.equal(harness.elements.toast.dataset.type, 'error');
  assert.equal(harness.elements.submitButton.disabled, false);
  assert.equal(harness.activity.read().length, 0);
});

test('B2.3 does not claim success when the post-create refresh fails', async () => {
  const harness = bootController({
    api: {
      async createClient() { return { client: { public_id: 'response-only' } }; },
      async clients() { throw new Error('refresh failed'); }
    },
    formValues: validForm({ nombre_razon_social: 'Refresh Failure' })
  });

  await harness.controller.handleFormSubmit({ preventDefault() {} });

  assert.equal(harness.controller.state.drawerMode, 'form');
  assert.equal(harness.elements.formSummary.hidden, false);
  assert.match(harness.elements.formSummary.textContent, /actualizar el directorio/i);
  assert.notEqual(harness.elements.toast.dataset.type, 'success');
  assert.equal(harness.elements.submitButton.disabled, false);
  assert.equal(harness.activity.read().length, 0);
});

test('B2.1 blocks inline mutations without local persistence or success feedback', () => {
  let writes = 0;
  const storage = memoryStorage();
  const clientStorage = {
    getItem: storage.getItem,
    setItem() { writes += 1; }
  };
  const harness = bootController({ clientStorage });

  assert.equal(harness.controller.applyClientFieldChange('cli_base', 'estadoCivil', 'casado'), false);
  assert.equal(writes, 0);
  assert.equal(harness.controller.state.clients[0].estadoCivil, 'soltero');
  assert.equal(harness.elements.toast.dataset.type, 'error');
  assert.equal(harness.elements.toast.getAttribute('role'), 'alert');
  assert.equal(harness.activity.read().length, 0);
});

test('B2.1 exposes disabled mutation controls while preserving directory and drawer hooks', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/clientes.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../pages/clientes.html'), 'utf8');

  assert.match(source, /MUTATIONS_ENABLED\s*=\s*false/);
  assert.match(source, /mutationControlAttributes\(\)/);
  assert.match(source, /return MUTATIONS_ENABLED \? '' : '[^']*disabled/);
  assert.doesNotMatch(html, /id="client-submit-button"[^>]*disabled/);
  assert.match(html, /id="client-detail-edit"[^>]*disabled/);
  ['client-search', 'data-client-status', 'client-drawer', 'client-form'].forEach((hook) => assert.match(html, new RegExp(hook)));
});

test('B2.3 enables create while keeping edit and inline mutations disabled', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/clientes.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../pages/clientes.html'), 'utf8');

  assert.match(source, /CREATE_ENABLED\s*=\s*true/);
  assert.match(source, /window\.FreelanceFlowApi\.createClient\(/);
  assert.match(source, /if \(draft\.id\)\s*\{\s*showMutationUnavailable\(\);/s);
  assert.match(source, /mutationControlAttributes\(\)/);
  assert.match(html, /id="client-submit-button"[^>]*type="submit"(?![^>]*disabled)/);
  assert.match(html, /id="client-detail-edit"[^>]*disabled[^>]*aria-disabled="true"/);
});
}());
