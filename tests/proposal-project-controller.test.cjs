const test = require('node:test');
const assert = require('node:assert/strict');
const proposal = require('../assets/js/proposal-model.js');
const projects = require('../assets/js/project-model.js');
const fs = require('node:fs');
const vm = require('node:vm');

const valid = {
  id: 'prop_1', cliente_id: 'cli_1', titulo_propuesta: 'Proyecto',
  fecha_emision: '2026-07-01', fecha_validez: '2026-08-01', moneda: 'USD',
  notas_condiciones: '', items: [{ id: 'item_1', servicio_referencia_id: '', descripcion_item: 'Servicio', unidad_medida: 'Hora', cantidad: 1, precio_unitario: 100, subtotal_item: 100 }],
  subtotal_general: 100, descuento: 0, total_propuesta: 100, estado: 'ACCEPTED', historial_estado: [{ estado: 'ACCEPTED', fecha: '2026-07-01T00:00:00.000Z', detalle: 'Aceptada.' }], proyecto_convertido_id: '', fecha_creacion: '2026-07-01T00:00:00.000Z', fecha_actualizacion: '2026-07-01T00:00:00.000Z'
};

function storageWith(value) {
  const values = new Map([[proposal.PROPOSAL_STORAGE_KEY, JSON.stringify(value)]]);
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('fails closed for incomplete legacy proposals and writes only versioned envelopes', () => {
  const incomplete = storageWith([{ ...valid, fecha_creacion: undefined }]);
  assert.equal(proposal.readProposalStorage(incomplete).ok, false);

  const legacy = storageWith([{ ...valid }]);
  assert.equal(proposal.readProposalStorage(legacy).ok, true);
  const persisted = JSON.parse(legacy.getItem(proposal.PROPOSAL_STORAGE_KEY));
  assert.deepEqual(Object.keys(persisted).sort(), ['proposals', 'version']);
  assert.equal(persisted.version, proposal.PROPOSAL_STORAGE_VERSION);
});

test('preserves durable proposal data when a versioned write throws', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem() { throw new DOMException('quota', 'QuotaExceededError'); } };
  assert.throws(() => proposal.writeProposalStorage(storage, [valid]), /No se pudo guardar/);
  assert.equal(storage.getItem(proposal.PROPOSAL_STORAGE_KEY), null);
});


test('keeps the proposal drawer open and records no activity when send persistence fails', () => {
  const activities = [];
  const context = {
    __FREELANCEFLOW_TEST__: true,
    console,
    URLSearchParams,
    crypto: {},
    requestAnimationFrame: (callback) => callback(),
    FormData: class { constructor(form) { this.values = form.values; } get(key) { return this.values[key] ?? ''; } },
    document: { addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() { throw new DOMException('quota', 'QuotaExceededError'); } },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    window: null
  };
  context.window = context;
  context.clearTimeout = () => {};
  context.setTimeout = () => 1;
  context.FreelanceFlowProposalModel = proposal;
  context.FreelanceFlowClientModel = { getSelectableClients: () => [] };
  context.FreelanceFlowActivity = { record: (event) => activities.push(event) };
  vm.runInNewContext(fs.readFileSync('assets/js/propuestas.js', 'utf8'), context);
  const controller = context.FreelanceFlowProposalsControllerTest;
  const input = (value) => ({ value });
  const row = { dataset: {}, querySelector(selector) { return input({ '[data-field="service"]': '', '[data-field="description"]': 'Servicio', '[data-field="unit"]': 'Hora', '[data-field="quantity"]': '1', '[data-field="price"]': '100' }[selector]); } };
  const form = { values: { id: 'prop_1', cliente_id: 'cli_1', titulo_propuesta: 'Proyecto', fecha_emision: '2026-07-01', fecha_validez: '2026-08-01', moneda: 'USD', notas_condiciones: '', descuento: '0' }, querySelectorAll: () => [], querySelector: () => null, elements: {} };
  const drawer = { hidden: false, setAttribute() {} };
  controller.setElements({ form, items: { querySelectorAll: () => [row] }, drawer, backdrop: { hidden: false }, toast: { classList: { add() {}, remove() {} }, dataset: {} }, summary: {} });
  controller.state.clients = [{ id: 'cli_1', estado: 'activo' }];
  controller.state.proposals = [proposal.normalizeProposal({ ...valid, estado: 'DRAFT' })];
  controller.state.editing = 'prop_1';
  controller.send();
  const generatedItemId = row.dataset.itemId;
  controller.send();
  assert.ok(generatedItemId);
  assert.equal(row.dataset.itemId, generatedItemId);
  assert.equal(controller.state.proposals[0].estado, 'DRAFT');
  assert.equal(drawer.hidden, false);
  assert.equal(activities.length, 0);
});



test('reconciles a durable project through the versioned proposal boundary before session cleanup', () => {
  const values = new Map();
  const activities = [];
  let failWrites = true;
  const context = {
    __FREELANCEFLOW_TEST__: true, console, URL, URLSearchParams, HTMLElement: class {},
    document: { addEventListener() {}, querySelector() { return null; } },
    navigator: {}, history: { replaceState() {} }, requestAnimationFrame: (callback) => callback(),
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem(key, value) { if (failWrites) throw new DOMException('quota', 'QuotaExceededError'); values.set(key, value); } },
    sessionStorage: { getItem: () => '{}', removeItem: () => { context.sessionCleared = true; } },
    window: null
  };
  context.window = context;
  context.clearTimeout = () => {};
  context.setTimeout = () => 1;
  context.matchMedia = () => ({ matches: false, addEventListener() {} });
  context.FreelanceFlowProjectModel = projects;
  context.FreelanceFlowProposalModel = proposal;
  context.FreelanceFlowClientModel = { getEffectiveClients: (items) => items, getSelectableClients: (items) => items };
  context.FreelanceFlowActivity = { record: (event) => activities.push(event) };
  vm.runInNewContext(fs.readFileSync('assets/js/proyectos.js', 'utf8'), context);
  const controller = context.FreelanceFlowProjectsControllerTest;
  controller.setElements({ toast: { classList: { add() {}, remove() {} }, dataset: {} } });
  controller.state.proposals = [proposal.normalizeProposal(valid)];
  const durable = { id: 'proy_1', propuesta_origen: 'prop_1' };
  assert.equal(controller.completeProposalConversion(durable), false);
  assert.equal(controller.state.proposals[0].estado, 'ACCEPTED');
  assert.equal(context.sessionCleared, undefined);
  assert.equal(activities.length, 0);
  failWrites = false;
  assert.equal(controller.completeProposalConversion(durable), true);
  const envelope = JSON.parse(values.get(proposal.PROPOSAL_STORAGE_KEY));
  assert.equal(envelope.version, proposal.PROPOSAL_STORAGE_VERSION);
  assert.equal(envelope.proposals[0].proyecto_convertido_id, 'proy_1');
  assert.equal(context.sessionCleared, true);
  assert.equal(activities.length, 0);
});

function createProjectController({ values = new Map(), lockRequest, failProject = false, failProposal = false } = {}) {
  const events = [];
  class HTMLElement {}
  const field = (value = '') => Object.assign(new HTMLElement(), { value, textContent: '', hidden: false, setAttribute() {}, removeAttribute() {}, toggleAttribute() {}, focus() {}, closest() { return null; } });
  const form = field();
  form.values = { id: '', nombre_proyecto: 'Proyecto causal', cliente_id: 'cli_1', propuesta_origen: 'prop_1', descripcion: '', fecha_inicio: '2026-07-01', fecha_fin_estimada: '', modalidad_cobro: 'Tarifa fija', tarifa_hora: '', monto_fijo: '100', presupuesto_horas_estimado: '' };
  const formField = (name) => ({ get value() { return form.values[name] ?? ''; }, set value(value) { form.values[name] = String(value ?? ''); }, focus() {} });
  const select = (name) => {
    let options = ['']; let selected = ''; let html = '';
    const item = field();
    Object.defineProperties(item, {
      innerHTML: { get() { return html; }, set(value) { html = value; options = [...html.matchAll(/value="([^"]*)"/g)].map((match) => match[1]); if (!options.includes(selected)) selected = ''; form.values[name] = selected; } },
      value: { get() { return selected; }, set(value) { selected = options.includes(String(value)) ? String(value) : ''; form.values[name] = selected; } }
    });
    return item;
  };
  const formProposal = select('propuesta_origen');
  const formClient = select('cliente_id');
  const billingMode = formField('modalidad_cobro');
  form.reset = () => { formProposal.value = ''; formClient.value = ''; billingMode.value = ''; };
  form.elements = { namedItem: () => field() };
  form.querySelectorAll = () => [];
  form.querySelector = () => null;
  const element = (name = '') => {
    const classes = new Set(name === 'drawer' ? ['is-open'] : []);
    const item = { ...field(), dataset: {}, focus() {} };
    item.classList = {
      add(...names) { names.forEach((value) => classes.add(value)); },
      remove(...names) { names.forEach((value) => { classes.delete(value); if (name === 'drawer' && value === 'is-open') events.push('drawer:close'); }); },
      toggle(value) { classes.has(value) ? classes.delete(value) : classes.add(value); },
      contains(value) { return classes.has(value); }
    };
    if (name === 'groups') Object.defineProperty(item, 'innerHTML', { get() { return ''; }, set() { events.push('ui:render'); } });
    return item;
  };
  const bodyClassList = { add() {}, remove() {}, toggle() {} };
  const context = {
    __FREELANCEFLOW_TEST__: true, console, URL, URLSearchParams, HTMLElement,
    FormData: class { constructor(source) { this.values = source.values; } get(name) { return this.values[name] ?? ''; } },
    document: { addEventListener() {}, querySelector() { return null; }, getElementById(id) { return ({ 'project-proposal': formProposal, 'project-client': formClient, 'project-billing-mode': billingMode, 'project-id': formField('id'), 'project-name': formField('nombre_proyecto'), 'project-description': formField('descripcion'), 'project-start-date': formField('fecha_inicio'), 'project-end-date': formField('fecha_fin_estimada'), 'project-hours-budget': formField('presupuesto_horas_estimado'), 'project-fixed-amount': formField('monto_fijo'), 'project-hourly-rate': formField('tarifa_hora') }[id] || field()); }, body: { classList: bodyClassList } },
    navigator: { locks: lockRequest ? { request: lockRequest } : undefined }, location: { href: 'https://example.test/proyectos.html', search: '' }, history: { replaceState() {} }, requestAnimationFrame: (callback) => callback(),
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem(key, value) { events.push(`storage:${key}`); if ((key === 'freelanceflow_projects_v1' && failProject) || (key === proposal.PROPOSAL_STORAGE_KEY && failProposal)) throw new DOMException('quota', 'QuotaExceededError'); values.set(key, value); } },
    sessionStorage: { getItem: () => '{}', removeItem() { events.push('session:remove'); } }, window: null
  };
  context.window = context;
  context.clearTimeout = () => {};
  context.setTimeout = () => 1;
  context.matchMedia = () => ({ matches: false, addEventListener() {} });
  context.FreelanceFlowProjectModel = projects;
  context.FreelanceFlowProposalModel = proposal;
  context.FreelanceFlowClientModel = { getEffectiveClients: (items) => items, getSelectableClients: (items) => items };
  context.FreelanceFlowActivity = { record(event) { events.push(`activity:${event.action}`); } };
  vm.runInNewContext(fs.readFileSync('assets/js/proyectos.js', 'utf8').replace('}());', 'if (globalThis.__FREELANCEFLOW_TEST__) Object.assign(globalThis.FreelanceFlowProjectsControllerTest, { openEditForm, openCreateForm }); }());'), context);
  const controller = context.FreelanceFlowProjectsControllerTest;
  const toast = element();
  toast.hidden = true;
  const formSummary = element();
  formSummary.hidden = true;
  const submitButton = element();
  const formDrawer = element('drawer');
  controller.setElements({ form, formSummary, submitButton, content: element(), toast, formDrawer, formBackdrop: element(), layout: element(), formTitle: element(), formDescription: element(), formClient, formProposal, billingMode, fixedFields: element(), hourlyFields: element(), milestoneNote: element(), totalCount: element(), activeCount: element(), receivableTotal: element(), profitTotal: element(), groups: element('groups'), emptyState: element(), noResults: element(), clearFilters: element(), resultsCount: element(), detailPanel: element(), detailBackdrop: element(), detailClose: element(), detailTitle: element(), detailClient: element(), detailBody: element(), statusTabs: [], search: element(), billingFilter: element(), clientFilter: element() });
  controller.state.clients = [{ id: 'cli_1', estado: 'activo', nombre_razon_social: 'Cliente' }];
  controller.state.proposals = [proposal.normalizeProposal(valid)];
  return { controller, events, toast, form, formSummary, submitButton, formDrawer, formProposal, values };
}

test('keeps persistence warning distinct from lock acquisition when the real submit callback returns false', async () => {
  const shared = new Map();
  const first = createProjectController({ values: shared, failProposal: true, lockRequest: async (_name, _options, callback) => callback({ name: 'lock' }) });
  await first.controller.handleFormSubmit({ preventDefault() {} });
  assert.equal(first.formSummary.textContent, 'El proyecto fue guardado, pero la propuesta no pudo convertirse. Reintenta para conciliarla.');
  assert.equal(first.formSummary.hidden, false);
  assert.equal(first.toast.hidden, true);
  assert.ok(first.formDrawer.classList.contains('is-open'));
  assert.ok(!first.events.includes('session:remove'));
  assert.ok(!first.events.some((event) => event.startsWith('activity:')));
  assert.equal(first.submitButton.disabled, false);
  assert.equal(first.submitButton.textContent, 'Guardar proyecto');
  assert.ok(shared.has('freelanceflow_projects_v1'));

  const rejected = createProjectController({ values: shared, lockRequest: async (_name, _options, callback) => callback(null) });
  await rejected.controller.handleFormSubmit({ preventDefault() {} });
  assert.equal(rejected.formSummary.textContent, 'No se pudo adquirir exclusividad segura para convertir la propuesta.');
  assert.equal(rejected.formSummary.hidden, false);
  assert.equal(rejected.toast.hidden, true);
  assert.ok(rejected.formDrawer.classList.contains('is-open'));
  assert.ok(!rejected.events.includes('session:remove'));
  assert.ok(!rejected.events.some((event) => event.startsWith('activity:')));
  assert.equal(rejected.submitButton.disabled, false);
  assert.equal(rejected.submitButton.textContent, 'Guardar proyecto');
});

test('runs the real submit flow across shared storage: project failure, durable retry, render-close, then activity', async () => {
  const shared = new Map();
  const lock = async (_name, _options, callback) => callback({ name: 'lock' });
  const failedProject = createProjectController({ values: shared, failProject: true, lockRequest: lock });
  await failedProject.controller.handleFormSubmit({ preventDefault() {} });
  assert.equal(failedProject.formSummary.textContent, 'No se pudo guardar localmente.');
  assert.equal(failedProject.formSummary.hidden, false);
  assert.equal(failedProject.toast.hidden, true);
  assert.equal(shared.has('freelanceflow_projects_v1'), false);
  assert.equal(failedProject.controller.state.projects.length, 0);

  const retry = createProjectController({ values: shared, lockRequest: lock });
  await retry.controller.handleFormSubmit({ preventDefault() {} });
  const project = JSON.parse(shared.get('freelanceflow_projects_v1'))[0];
  const envelope = JSON.parse(shared.get(proposal.PROPOSAL_STORAGE_KEY));
  assert.equal(envelope.proposals[0].proyecto_convertido_id, project.id);
  assert.equal(retry.controller.state.proposals[0].estado, 'CONVERTED');
  assert.equal(retry.submitButton.disabled, false);
  assert.ok(retry.events.includes('activity:Propuesta convertida'), retry.events.join(', '));
});

test('observes project and proposal storage before render, drawer close, and activity in the real submit flow', async () => {
  const lockRequests = [];
  const run = createProjectController({ lockRequest: async (name, options, callback) => {
    lockRequests.push({ name, options: { ...options } });
    return callback({ name: 'lock' });
  } });
  await run.controller.handleFormSubmit({ preventDefault() {} });
  const projectWrite = run.events.indexOf('storage:freelanceflow_projects_v1');
  const proposalWrite = run.events.indexOf(`storage:${proposal.PROPOSAL_STORAGE_KEY}`);
  const sessionRemove = run.events.indexOf('session:remove');
  const render = run.events.indexOf('ui:render');
  const close = run.events.indexOf('drawer:close');
  const activity = run.events.indexOf('activity:Propuesta convertida');
  assert.ok(projectWrite >= 0 && proposalWrite >= 0);
  assert.equal(run.events.filter((event) => event === 'session:remove').length, 1);
  assert.ok(projectWrite < proposalWrite && proposalWrite < sessionRemove && sessionRemove < render && render < close && close < activity, run.events.join(', '));
  assert.equal(run.toast.textContent, 'Proyecto creado correctamente.');
  assert.equal(run.toast.hidden, false);
  assert.ok(!run.formDrawer.classList.contains('is-open'));
  assert.equal(lockRequests.length, 1);
  assert.deepEqual(lockRequests, [{ name: 'freelanceflow-proposal-conversion', options: { mode: 'exclusive', ifAvailable: true } }]);
});

test('keeps every mutable boundary untouched and the drawer open when Web Locks are unavailable', async () => {
  const run = createProjectController();
  const stateBefore = JSON.stringify({ projects: run.controller.state.projects, proposals: run.controller.state.proposals, selectedProjectId: run.controller.state.selectedProjectId, formDirty: run.controller.state.formDirty, formMode: run.controller.state.formMode });
  await run.controller.handleFormSubmit({ preventDefault() {} });
  assert.equal(run.formSummary.textContent, 'No se pudo adquirir exclusividad segura para convertir la propuesta.');
  assert.equal(run.formSummary.hidden, false);
  assert.equal(run.toast.hidden, true);
  assert.deepEqual([...run.values], []);
  assert.equal(run.controller.state.projects.length, 0);
  assert.equal(run.controller.state.proposals[0].estado, 'ACCEPTED');
  assert.equal(JSON.stringify({ projects: run.controller.state.projects, proposals: run.controller.state.proposals, selectedProjectId: run.controller.state.selectedProjectId, formDirty: run.controller.state.formDirty, formMode: run.controller.state.formMode }), stateBefore);
  assert.ok(!run.events.includes('session:remove'));
  assert.ok(!run.events.some((event) => event.startsWith('activity:')));
  assert.ok(run.formDrawer.classList.contains('is-open'));
  assert.equal(run.submitButton.disabled, false);
  assert.equal(run.submitButton.textContent, 'Guardar proyecto');
});

test('updates the durable project before converting its proposal after a failed proposal write', async () => {
  const shared = new Map();
  const lock = async (_name, _options, callback) => callback({ name: 'lock' });
  const failed = createProjectController({ values: shared, failProposal: true, lockRequest: lock });
  await failed.controller.handleFormSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(shared.get('freelanceflow_projects_v1')).length, 1);
  assert.ok(!failed.events.includes('ui:render'));
  assert.ok(!failed.events.includes('drawer:close'));
  assert.ok(!failed.events.some((event) => event.startsWith('activity:')));

  const retry = createProjectController({ values: shared, lockRequest: lock });
  retry.form.values = { ...retry.form.values, nombre_proyecto: 'Proyecto corregido', descripcion: 'Cambios del usuario' };
  await retry.controller.handleFormSubmit({ preventDefault() {} });
  const project = JSON.parse(shared.get('freelanceflow_projects_v1'));
  const envelope = JSON.parse(shared.get(proposal.PROPOSAL_STORAGE_KEY));
  assert.equal(project.length, 1);
  assert.equal(project[0].nombre_proyecto, 'Proyecto corregido');
  assert.equal(project[0].descripcion, 'Cambios del usuario');
  assert.equal(envelope.version, proposal.PROPOSAL_STORAGE_VERSION);
  assert.equal(envelope.proposals[0].estado, 'CONVERTED');
  assert.equal(envelope.proposals[0].proyecto_convertido_id, project[0].id);
  const projectWrite = retry.events.indexOf('storage:freelanceflow_projects_v1');
  const proposalWrite = retry.events.indexOf(`storage:${proposal.PROPOSAL_STORAGE_KEY}`);
  const sessionRemove = retry.events.indexOf('session:remove');
  const render = retry.events.indexOf('ui:render');
  const close = retry.events.indexOf('drawer:close');
  const activity = retry.events.indexOf('activity:Propuesta convertida');
  assert.equal(retry.events.filter((event) => event === 'storage:freelanceflow_projects_v1').length, 1);
  assert.equal(retry.events.filter((event) => event === 'session:remove').length, 1);
  assert.ok(projectWrite < proposalWrite && proposalWrite < sessionRemove && sessionRemove < render && render < close && close < activity, retry.events.join(', '));
});


test('edits a converted project without reconverting its proposal', async () => {
  const shared = new Map();
  const lock = async (_name, _options, callback) => callback({ name: 'lock' });
  const created = createProjectController({ values: shared, lockRequest: lock });
  await created.controller.handleFormSubmit({ preventDefault() {} });
  const project = JSON.parse(shared.get('freelanceflow_projects_v1'))[0];
  const edited = createProjectController({ values: shared, lockRequest: lock });
  edited.form.values = { ...edited.form.values, id: project.id, nombre_proyecto: 'Proyecto editado' };
  await edited.controller.handleFormSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(shared.get('freelanceflow_projects_v1'))[0].nombre_proyecto, 'Proyecto editado');
  assert.equal(edited.events.filter((event) => event === `storage:${proposal.PROPOSAL_STORAGE_KEY}`).length, 0);
});


test('keeps only the owning converted proposal selected when editing', async () => {
  const shared = new Map();
  const lock = async (_name, _options, callback) => callback({ name: 'lock' });
  const run = createProjectController({ values: shared, lockRequest: lock });
  const project = projects.createProjectRecord({ ...run.form.values, id: '', propuesta_origen: 'prop_1' }, { id: 'proy_1' });
  const ownConverted = proposal.completeConversion(proposal.normalizeProposal(valid), project.id);
  const otherConverted = proposal.completeConversion(proposal.normalizeProposal({ ...valid, id: 'prop_2', titulo_propuesta: 'Otro proyecto' }), 'proy_2');
  run.controller.state.projects = [project];
  run.controller.state.proposals = [ownConverted, otherConverted];

  run.controller.openEditForm(project.id, null);
  assert.equal(run.formProposal.value, 'prop_1');
  assert.match(run.formProposal.innerHTML, /value="prop_1"/);
  assert.doesNotMatch(run.formProposal.innerHTML, /value="prop_2"/);
  await run.controller.handleFormSubmit({ preventDefault() {} });
  assert.equal(JSON.parse(shared.get('freelanceflow_projects_v1'))[0].propuesta_origen, 'prop_1');

  run.controller.openCreateForm(null);
  assert.doesNotMatch(run.formProposal.innerHTML, /value="prop_1"|value="prop_2"/);
});
