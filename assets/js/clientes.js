/* FreelanceFlow — Clientes. Browser-only prototype; no backend or external APIs. */

(function clientsModule() {
  const DATA_URL = '../assets/data/mock-data.json';
  const STORAGE_KEY = 'freelanceflow_clients_v2';
  const LEGACY_STORAGE_KEY = 'freelanceflow_clients_mock';
  const model = window.FreelanceFlowClientModel;

  const state = {
    clients: [],
    filters: { query: '', status: 'todos' },
    selectedClientId: null,
    pendingStatusChange: null,
    drawerMode: null,
    formDirty: false,
    lastTrigger: null,
    toastTimer: null
  };

  const dateFormatter = new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let elements = {};

  document.addEventListener('DOMContentLoaded', initialize);

  async function initialize() {
    if (!model) {
      showFatalError(new Error('El modelo de clientes no está disponible.'));
      return;
    }

    cacheElements();
    readFiltersFromUrl();
    bindEvents();
    syncFilterControls();
    await loadAndRenderClients();
  }

  function cacheElements() {
    elements = {
      appLayout: document.querySelector('[data-app-layout]'),
      createButton: document.getElementById('client-create-button'),
      search: document.getElementById('client-search'),
      clearFilters: document.getElementById('clients-clear-filters'),
      tabs: [...document.querySelectorAll('[data-client-status]')],
      retryButton: document.getElementById('clients-retry-button'),
      dataError: document.getElementById('clients-data-error'),
      loading: document.getElementById('clients-loading'),
      content: document.getElementById('clients-content'),
      tableBody: document.getElementById('clients-table-body'),
      cardList: document.getElementById('clients-card-list'),
      emptyState: document.getElementById('clients-empty-state'),
      noResults: document.getElementById('clients-no-results'),
      resultsCount: document.getElementById('clients-results-count'),
      totalCount: document.getElementById('clients-total-count'),
      activeCount: document.getElementById('clients-active-count'),
      inactiveCount: document.getElementById('clients-inactive-count'),
      backdrop: document.getElementById('client-drawer-backdrop'),
      drawer: document.getElementById('client-drawer'),
      drawerClose: document.getElementById('client-drawer-close'),
      drawerEyebrow: document.getElementById('client-drawer-eyebrow'),
      drawerTitle: document.getElementById('client-drawer-title'),
      drawerDescription: document.getElementById('client-drawer-description'),
      detailView: document.getElementById('client-detail-view'),
      detailContent: document.getElementById('client-detail-content'),
      detailClose: document.getElementById('client-detail-close'),
      detailEdit: document.getElementById('client-detail-edit'),
      form: document.getElementById('client-form'),
      formSummary: document.getElementById('client-form-summary'),
      formCancel: document.getElementById('client-form-cancel'),
      submitButton: document.getElementById('client-submit-button'),
      statusDialog: document.getElementById('client-status-dialog'),
      toast: document.getElementById('client-toast')
    };
  }

  function bindEvents() {
    elements.createButton?.addEventListener('click', (event) => openCreateForm(event.currentTarget));
    elements.search?.addEventListener('input', (event) => {
      state.filters.query = event.currentTarget.value;
      updateFilterUrl();
      renderDirectory();
    });
    elements.clearFilters?.addEventListener('click', clearFilters);
    elements.tabs.forEach((tab) => tab.addEventListener('click', () => {
      state.filters.status = tab.dataset.clientStatus;
      syncFilterControls();
      updateFilterUrl();
      renderDirectory();
    }));
    elements.retryButton?.addEventListener('click', loadAndRenderClients);

    document.getElementById('main-content')?.addEventListener('click', handleActionClick);
    document.getElementById('main-content')?.addEventListener('change', handleInlineChange);
    elements.detailContent?.addEventListener('change', handleInlineChange);
    elements.detailEdit?.addEventListener('click', () => {
      const client = findClient(state.selectedClientId);
      if (client) openEditForm(client, elements.detailEdit);
    });
    elements.detailClose?.addEventListener('click', () => closeDrawer());
    elements.backdrop?.addEventListener('click', () => closeDrawer({ confirmDirty: true }));
    elements.drawerClose?.addEventListener('click', () => closeDrawer({ confirmDirty: true }));
    elements.formCancel?.addEventListener('click', () => closeDrawer({ confirmDirty: true }));
    elements.form?.addEventListener('input', () => { state.formDirty = true; });
    elements.form?.addEventListener('change', () => { state.formDirty = true; });
    elements.form?.addEventListener('focusout', validateFieldOnBlur);
    elements.form?.addEventListener('submit', handleFormSubmit);
    elements.statusDialog?.addEventListener('close', resolveStatusDialog);

    document.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('beforeunload', (event) => {
      if (state.drawerMode !== 'form' || !state.formDirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  async function loadAndRenderClients() {
    setLoading(true);
    elements.dataError.hidden = true;

    try {
      const data = await window.FreelanceFlowDataLoader.loadJson(DATA_URL);
      const stored = readStoredClients();
      state.clients = model.mergeClients(data.clientes ?? [], stored);
      renderAll();
      setLoading(false);
    } catch (error) {
      showFatalError(error);
    }
  }

  function readStoredClients() {
    try {
      const serialized = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!serialized) return [];
      const parsed = JSON.parse(serialized);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('No se pudieron recuperar los cambios locales de clientes.', error);
      return [];
    }
  }

  function saveClients() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.clients));
    } catch (error) {
      console.warn('No se pudieron guardar los cambios locales de clientes.', error);
      showToast('El cambio se aplicó, pero no pudo guardarse en este navegador.', 'warning');
    }
  }

  function setLoading(isLoading) {
    elements.loading.hidden = !isLoading;
    elements.content.hidden = isLoading;
    elements.retryButton.disabled = isLoading;
  }

  function showFatalError(error) {
    console.error(error);
    setLoading(false);
    elements.content.hidden = true;
    elements.dataError.hidden = false;
    elements.resultsCount.textContent = 'Directorio no disponible';
  }

  function renderAll() {
    renderSummary();
    renderDirectory();
    if (state.selectedClientId && state.drawerMode === 'detail') renderDetail(findClient(state.selectedClientId));
  }

  function renderSummary() {
    const active = state.clients.filter((client) => client.estado === 'activo').length;
    elements.totalCount.textContent = String(state.clients.length);
    elements.activeCount.textContent = String(active);
    elements.inactiveCount.textContent = String(state.clients.length - active);
  }

  function renderDirectory() {
    const filtered = model.filterClients(state.clients, state.filters);
    const hasFilters = Boolean(state.filters.query.trim()) || state.filters.status !== 'todos';

    elements.tableBody.innerHTML = filtered.map(renderTableRow).join('');
    elements.cardList.innerHTML = filtered.map(renderClientCard).join('');
    elements.emptyState.hidden = state.clients.length !== 0;
    elements.noResults.hidden = state.clients.length === 0 || filtered.length !== 0;
    elements.clearFilters.hidden = !hasFilters;
    elements.resultsCount.textContent = getResultsCopy(filtered.length);
  }

  function getResultsCopy(count) {
    if (!state.clients.length) return 'Tu directorio está listo para el primer cliente';
    if (!count) return '0 clientes encontrados';
    return `${count} ${count === 1 ? 'cliente encontrado' : 'clientes encontrados'}`;
  }

  function renderTableRow(client) {
    const fullName = `${client.nombres} ${client.apellidos}`.trim();
    return `
      <tr>
        <td><div class="client-identity"><span aria-hidden="true">${initials(client.nombre_razon_social)}</span><div><strong>${escapeHtml(client.nombre_razon_social)}</strong><small>${escapeHtml(client.tipo_cliente)}</small></div></div></td>
        <td><span class="client-mono">${escapeHtml(client.identificacion)}</span></td>
        <td><strong class="client-cell-title">${escapeHtml(fullName)}</strong><small>Representante legal</small></td>
        <td><a href="mailto:${escapeAttribute(client.correo)}">${escapeHtml(client.correo)}</a><small>${escapeHtml(client.celular)}</small></td>
        <td>${renderInlineSelect(client, 'estadoCivil')}</td>
        <td>${renderInlineSelect(client, 'estado')}</td>
        <td><div class="client-row-actions"><button type="button" data-action="view-client" data-client-id="${escapeAttribute(client.id)}">Ver detalle</button><button class="client-icon-action" type="button" data-action="edit-client" data-client-id="${escapeAttribute(client.id)}" aria-label="Editar ${escapeAttribute(client.nombre_razon_social)}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 16-1 5 5-1L19 9l-4-4L4 16ZM13.5 6.5l4 4"/></svg></button></div></td>
      </tr>`;
  }

  function renderClientCard(client) {
    const fullName = `${client.nombres} ${client.apellidos}`.trim();
    return `
      <li class="client-card">
        <header>
          <div class="client-identity"><span aria-hidden="true">${initials(client.nombre_razon_social)}</span><div><h3>${escapeHtml(client.nombre_razon_social)}</h3><p>${escapeHtml(client.tipo_cliente)}</p></div></div>
          ${renderStatusBadge(client.estado)}
        </header>
        <dl>
          <div><dt>Contacto principal</dt><dd>${escapeHtml(fullName)}</dd></div>
          <div><dt>Identificación</dt><dd class="client-mono">${escapeHtml(client.identificacion)}</dd></div>
          <div><dt>Contacto</dt><dd>${escapeHtml(client.correo)}<small>${escapeHtml(client.celular)}</small></dd></div>
        </dl>
        <div class="client-card-controls">
          <label>Estado civil${renderInlineSelect(client, 'estadoCivil')}</label>
          <label>Estado${renderInlineSelect(client, 'estado')}</label>
        </div>
        <footer>
          <button type="button" class="clients-secondary-action" data-action="view-client" data-client-id="${escapeAttribute(client.id)}">Ver detalle</button>
          <button type="button" class="client-icon-action" data-action="edit-client" data-client-id="${escapeAttribute(client.id)}" aria-label="Editar ${escapeAttribute(client.nombre_razon_social)}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 16-1 5 5-1L19 9l-4-4L4 16ZM13.5 6.5l4 4"/></svg></button>
        </footer>
      </li>`;
  }

  function renderInlineSelect(client, field) {
    const isCivil = field === 'estadoCivil';
    const options = isCivil ? model.CIVIL_STATUS_OPTIONS : model.CLIENT_STATUS_OPTIONS;
    const label = isCivil ? 'estado civil' : 'estado';
    const className = isCivil ? '' : ` client-status-select client-status-${client.estado}`;
    return `<select class="client-inline-select${className}" name="client-${field}-${escapeAttribute(client.id)}" data-client-field="${field}" data-client-id="${escapeAttribute(client.id)}" aria-label="Cambiar ${label} de ${escapeAttribute(client.nombre_razon_social)}">${options.map((option) => `<option value="${escapeAttribute(option)}"${option === client[field] ? ' selected' : ''}>${escapeHtml(titleCase(option))}</option>`).join('')}</select>`;
  }

  function handleActionClick(event) {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const action = trigger.dataset.action;
    if (action === 'create-client') openCreateForm(trigger);
    if (action === 'clear-client-filters') clearFilters();
    if (action === 'view-client') {
      const client = findClient(trigger.dataset.clientId);
      if (client) openDetail(client, trigger);
    }
    if (action === 'edit-client') {
      const client = findClient(trigger.dataset.clientId);
      if (client) openEditForm(client, trigger);
    }
  }

  function handleInlineChange(event) {
    const select = event.target.closest('[data-client-field]');
    if (!select) return;

    const client = findClient(select.dataset.clientId);
    if (!client) return;
    const field = select.dataset.clientField;
    const nextValue = select.value;

    if (field === 'estado' && nextValue === 'inactivo' && client.estado !== 'inactivo') {
      state.pendingStatusChange = { clientId: client.id, field, value: nextValue };
      elements.statusDialog.showModal();
      return;
    }

    applyClientFieldChange(client.id, field, nextValue);
  }

  function resolveStatusDialog() {
    const pending = state.pendingStatusChange;
    state.pendingStatusChange = null;
    if (!pending) return;

    if (elements.statusDialog.returnValue === 'confirm') {
      applyClientFieldChange(pending.clientId, pending.field, pending.value);
      showToast('Cliente inactivado. Su historial se mantiene disponible.', 'success');
    } else {
      renderDirectory();
      if (state.drawerMode === 'detail') renderDetail(findClient(state.selectedClientId));
    }
  }

  function applyClientFieldChange(clientId, field, value) {
    const allowed = field === 'estadoCivil' ? model.CIVIL_STATUS_OPTIONS : model.CLIENT_STATUS_OPTIONS;
    if (!allowed.includes(value)) return;

    state.clients = state.clients.map((client) => client.id === clientId ? { ...client, [field]: value } : client);
    saveClients();
    renderAll();
    if (!(field === 'estado' && value === 'inactivo')) {
      showToast(field === 'estadoCivil' ? 'Estado civil actualizado.' : 'Estado del cliente actualizado.', 'success');
    }
  }

  function openDetail(client, trigger) {
    state.selectedClientId = client.id;
    state.drawerMode = 'detail';
    renderDetail(client);
    elements.detailView.hidden = false;
    elements.form.hidden = true;
    elements.drawerEyebrow.textContent = 'Ficha comercial';
    elements.drawerTitle.textContent = 'Detalle del cliente';
    elements.drawerDescription.textContent = 'Consulta la información comercial y del contacto principal.';
    openDrawer(trigger);
  }

  function renderDetail(client) {
    if (!client) return;
    const fullName = `${client.nombres} ${client.apellidos}`.trim();
    elements.detailContent.innerHTML = `
      <section class="client-detail-hero">
        <div class="client-identity"><span aria-hidden="true">${initials(client.nombre_razon_social)}</span><div><h3>${escapeHtml(client.nombre_razon_social)}</h3><p>${escapeHtml(client.tipo_cliente)}</p></div></div>
        ${renderStatusBadge(client.estado)}
        <p>Registrado el ${escapeHtml(formatDate(client.fecha_registro))}</p>
      </section>
      <section class="client-detail-section"><h3>Datos comerciales</h3><dl>${renderDetailItem('Razón social', client.nombre_razon_social)}${renderDetailItem('Tipo de cliente', client.tipo_cliente)}</dl></section>
      <section class="client-detail-section"><h3>Contacto principal / representante legal</h3><dl>${renderDetailItem('Nombre completo', fullName)}${renderDetailItem('Identificación', client.identificacion)}<div><dt>Estado civil</dt><dd>${renderInlineSelect(client, 'estadoCivil')}</dd></div></dl></section>
      <section class="client-detail-section"><h3>Contacto y ubicación</h3><dl>${renderDetailItem('Correo', client.correo)}${renderDetailItem('Celular', client.celular)}${renderDetailItem('Teléfono', client.telefono || 'No registrado')}${renderDetailItem('Dirección', client.direccion || 'No registrada')}</dl></section>
      <section class="client-detail-section"><h3>Estado del cliente</h3><div class="client-detail-status-control"><p>Define si puede utilizarse en nuevas operaciones.</p>${renderInlineSelect(client, 'estado')}</div></section>`;
  }

  function renderDetailItem(label, value) {
    return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
  }

  function openCreateForm(trigger) {
    prepareForm(null);
    elements.drawerEyebrow.textContent = 'Nueva relación comercial';
    elements.drawerTitle.textContent = 'Registrar cliente';
    elements.drawerDescription.textContent = 'Completa los datos comerciales y del contacto principal.';
    elements.submitButton.textContent = 'Registrar cliente';
    state.drawerMode = 'form';
    openDrawer(trigger);
  }

  function openEditForm(client, trigger) {
    prepareForm(client);
    elements.drawerEyebrow.textContent = 'Actualizar ficha comercial';
    elements.drawerTitle.textContent = 'Editar cliente';
    elements.drawerDescription.textContent = 'Actualiza la información sin perder el historial del cliente.';
    elements.submitButton.textContent = 'Guardar cambios';
    state.drawerMode = 'form';
    openDrawer(trigger);
  }

  function prepareForm(client) {
    elements.detailView.hidden = true;
    elements.form.hidden = false;
    elements.form.reset();
    clearFormErrors();

    const values = client ?? {
      id: '', tipo_cliente: 'Empresa', estadoCivil: '', estado: 'activo'
    };
    setFormValue('client-id', values.id);
    setFormValue('business-name', values.nombre_razon_social);
    setFormValue('client-type', values.tipo_cliente);
    setFormValue('first-names', values.nombres);
    setFormValue('last-names', values.apellidos);
    setFormValue('identification', values.identificacion);
    setFormValue('civil-status', values.estadoCivil);
    setFormValue('email', values.correo);
    setFormValue('mobile', values.celular);
    setFormValue('phone', values.telefono);
    setFormValue('address', values.direccion);
    const status = elements.form.querySelector(`[name="estado"][value="${values.estado || 'activo'}"]`);
    if (status) status.checked = true;
    state.formDirty = false;
  }

  function openDrawer(trigger) {
    state.lastTrigger = trigger ?? document.activeElement;
    elements.drawer.removeAttribute('inert');
    elements.drawer.setAttribute('aria-hidden', 'false');
    elements.drawer.classList.add('is-open');
    elements.backdrop.classList.add('is-open');
    document.body.classList.add('client-drawer-open');
    setBackgroundInert(true);
    requestAnimationFrame(() => {
      const target = state.drawerMode === 'form'
        ? elements.form.querySelector('input:not([type="hidden"]), select')
        : elements.drawerClose;
      target?.focus();
    });
  }

  function closeDrawer({ confirmDirty = false } = {}) {
    if (confirmDirty && state.drawerMode === 'form' && state.formDirty) {
      const shouldClose = window.confirm('Tienes cambios sin guardar. ¿Quieres descartarlos?');
      if (!shouldClose) return;
    }

    elements.drawer.classList.remove('is-open');
    elements.backdrop.classList.remove('is-open');
    elements.drawer.setAttribute('aria-hidden', 'true');
    elements.drawer.setAttribute('inert', '');
    document.body.classList.remove('client-drawer-open');
    setBackgroundInert(false);
    state.drawerMode = null;
    state.formDirty = false;
    state.lastTrigger?.focus?.();
  }

  function setBackgroundInert(isInert) {
    elements.appLayout?.toggleAttribute('inert', isInert);
    document.querySelector('.app-bottom-navigation')?.toggleAttribute('inert', isInert);
  }

  function handleGlobalKeydown(event) {
    if (!state.drawerMode) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer({ confirmDirty: true });
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = [...elements.drawer.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')]
      .filter((element) => !element.closest('[hidden]'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function validateFieldOnBlur(event) {
    const field = event.target.closest('input, select, textarea');
    if (!field?.name || ['id', 'telefono', 'direccion'].includes(field.name)) return;
    const data = readForm();
    const validation = model.validateClient(data, state.clients);
    setFieldError(field.name, validation.errors[field.name] ?? '');
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    const draft = readForm();
    const validation = model.validateClient(draft, state.clients);
    clearFormErrors();

    if (!validation.valid) {
      Object.entries(validation.errors).forEach(([field, message]) => setFieldError(field, message));
      elements.formSummary.textContent = 'Revisa los campos señalados antes de guardar.';
      elements.formSummary.hidden = false;
      const firstInvalid = elements.form.querySelector('[aria-invalid="true"]');
      firstInvalid?.focus();
      return;
    }

    elements.submitButton.disabled = true;
    elements.submitButton.textContent = draft.id ? 'Guardando…' : 'Registrando…';

    let savedClient;
    if (draft.id) {
      state.clients = state.clients.map((client) => client.id === draft.id ? {
        ...model.normalizeClient({ ...client, ...draft }),
        id: client.id,
        fecha_registro: client.fecha_registro,
        identificacion_fiscal: draft.identificacion,
        correo_electronico: draft.correo
      } : client);
      state.selectedClientId = draft.id;
      savedClient = findClient(draft.id);
    } else {
      const newClient = model.createClientRecord(draft, {
        id: generateClientId(),
        date: getTodayDate()
      });
      state.clients.unshift(newClient);
      state.selectedClientId = newClient.id;
      savedClient = newClient;
    }

    saveClients();
    renderAll();
    state.formDirty = false;
    closeDrawer();
    recordActivity('Clientes', draft.id ? 'Cliente actualizado' : 'Cliente registrado', `${savedClient?.nombre_razon_social || draft.nombre_razon_social}.`);
    showToast(draft.id ? 'Cliente actualizado exitosamente.' : 'Cliente registrado exitosamente.', 'success');
    elements.submitButton.disabled = false;
  }

  function recordActivity(module, action, description) {
    window.FreelanceFlowActivity?.record({ module, action, description });
  }

  function readForm() {
    const data = new FormData(elements.form);
    return {
      id: String(data.get('id') ?? '').trim(),
      nombre_razon_social: String(data.get('nombre_razon_social') ?? '').trim(),
      tipo_cliente: String(data.get('tipo_cliente') ?? '').trim(),
      nombres: String(data.get('nombres') ?? '').trim(),
      apellidos: String(data.get('apellidos') ?? '').trim(),
      identificacion: String(data.get('identificacion') ?? '').trim(),
      estadoCivil: String(data.get('estadoCivil') ?? '').trim(),
      correo: String(data.get('correo') ?? '').trim(),
      celular: String(data.get('celular') ?? '').trim(),
      telefono: String(data.get('telefono') ?? '').trim(),
      direccion: String(data.get('direccion') ?? '').trim(),
      estado: String(data.get('estado') ?? '').trim()
    };
  }

  function clearFormErrors() {
    elements.formSummary.hidden = true;
    elements.formSummary.textContent = '';
    elements.form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    });
    elements.form.querySelectorAll('.has-error').forEach((field) => field.classList.remove('has-error'));
    elements.form.querySelectorAll('[data-field-error]').forEach((error) => { error.textContent = ''; });
  }

  function setFieldError(fieldName, message) {
    const field = elements.form.elements.namedItem(fieldName);
    const fieldElement = field instanceof RadioNodeList ? field[0] : field;
    const error = elements.form.querySelector(`[data-field-error="${fieldName}"]`);
    if (!fieldElement || !error) return;

    if (!error.id) error.id = `${fieldName}-error`;
    error.textContent = message;
    const wrapper = fieldElement.closest('.client-field, .client-form-section');
    wrapper?.classList.toggle('has-error', Boolean(message));
    if (message) {
      fieldElement.setAttribute('aria-invalid', 'true');
      fieldElement.setAttribute('aria-describedby', error.id);
    } else {
      fieldElement.removeAttribute('aria-invalid');
      fieldElement.removeAttribute('aria-describedby');
    }
  }

  function clearFilters() {
    state.filters = { query: '', status: 'todos' };
    syncFilterControls();
    updateFilterUrl();
    renderDirectory();
    elements.search?.focus();
  }

  function readFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.filters.query = params.get('q') ?? '';
    const status = params.get('estado') ?? 'todos';
    state.filters.status = ['todos', ...model.CLIENT_STATUS_OPTIONS].includes(status) ? status : 'todos';
  }

  function syncFilterControls() {
    if (elements.search) elements.search.value = state.filters.query;
    elements.tabs.forEach((tab) => {
      const active = tab.dataset.clientStatus === state.filters.status;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
  }

  function updateFilterUrl() {
    const url = new URL(window.location.href);
    const query = state.filters.query.trim();
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    if (state.filters.status !== 'todos') url.searchParams.set('estado', state.filters.status);
    else url.searchParams.delete('estado');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function showToast(message, type = 'success') {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.dataset.type = type;
    elements.toast.hidden = false;
    requestAnimationFrame(() => elements.toast.classList.add('is-visible'));
    state.toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove('is-visible');
      window.setTimeout(() => { elements.toast.hidden = true; }, 220);
    }, 3800);
  }

  function findClient(id) {
    return state.clients.find((client) => String(client.id) === String(id));
  }

  function setFormValue(id, value) {
    const field = document.getElementById(id);
    if (field) field.value = value ?? '';
  }

  function generateClientId() {
    if (window.crypto?.randomUUID) return `cli_${window.crypto.randomUUID()}`;
    return `cli_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDate(value) {
    if (!value) return 'Fecha no disponible';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateFormatter.format(date);
  }

  function initials(value) {
    return String(value ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }

  function titleCase(value) {
    const text = String(value ?? '');
    return text ? `${text[0].toUpperCase()}${text.slice(1)}` : '';
  }

  function renderStatusBadge(status) {
    return `<span class="client-status-badge client-status-${escapeAttribute(status)}"><span aria-hidden="true"></span>${escapeHtml(titleCase(status))}</span>`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll('`', '&#096;');
  }
}());
