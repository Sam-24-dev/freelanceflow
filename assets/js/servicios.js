/* FreelanceFlow — Servicios. Browser-only catalogue with local persistence. */
(function servicesModule() {
  'use strict';
  const EDIT_ENABLED = true;
  const REMOVE_ENABLED = false;
  const CREATE_ENABLED = true;
  const MUTATION_UNAVAILABLE_ID = 'services-mutations-unavailable';
  const model = window.FreelanceFlowServiceModel;
  const state = { services: [], filters: { query: '', unit: 'todas' }, editingId: '', pendingRemovalId: '', deletedIds: [], formDirty: false, lastTrigger: null, toastTimer: 0, loaded: false };
  let elements = {};

  document.addEventListener('DOMContentLoaded', initialize);
  async function initialize() {
    cache(); disableMutationControls(); bind();
    if (!model) return fatal(new Error('El modelo de servicios no está disponible.'));
    await load();
  }
  function cache() { elements = {
    layout: document.querySelector('[data-app-layout]'), create: document.getElementById('service-create-button'), search: document.getElementById('service-search'), unit: document.getElementById('service-unit-filter'), clear: document.getElementById('services-clear-filters'), retry: document.getElementById('services-retry-button'), error: document.getElementById('services-data-error'), loading: document.getElementById('services-loading'), content: document.getElementById('services-content'), table: document.getElementById('services-table-body'), cards: document.getElementById('services-card-list'), empty: document.getElementById('services-empty-state'), noResults: document.getElementById('services-no-results'), count: document.getElementById('services-results-count'), status: document.getElementById('services-results-status'), total: document.getElementById('services-total-count'), average: document.getElementById('services-average-rate'), mostUsed: document.getElementById('services-most-used-unit'), backdrop: document.getElementById('service-drawer-backdrop'), drawer: document.getElementById('service-drawer'), close: document.getElementById('service-drawer-close'), title: document.getElementById('service-drawer-title'), form: document.getElementById('service-form'), summary: document.getElementById('service-form-summary'), cancel: document.getElementById('service-form-cancel'), submit: document.getElementById('service-submit-button'), dialog: document.getElementById('service-remove-dialog'), removeCopy: document.getElementById('service-remove-dialog-copy'), toast: document.getElementById('service-toast') }; }
  function disableMutationControls() { if (CREATE_ENABLED) elements.create?.removeAttribute('disabled'); }
  function bind() {
    elements.create?.addEventListener('click', (event) => openForm(null, event.currentTarget));
    elements.search?.addEventListener('input', (event) => { state.filters.query = event.currentTarget.value; render(); });
    elements.search?.addEventListener('change', () => window.FreelanceFlowActivity?.recordSearch('Servicios', state.filters.query));
    elements.unit?.addEventListener('change', (event) => { state.filters.unit = event.currentTarget.value; render(); });
    elements.clear?.addEventListener('click', clearFilters); elements.retry?.addEventListener('click', load);
    document.getElementById('main-content')?.addEventListener('click', actionClick);
    [elements.backdrop, elements.close, elements.cancel].forEach((item) => item?.addEventListener('click', () => closeForm(true)));
    elements.form?.addEventListener('input', () => { state.formDirty = true; }); elements.form?.addEventListener('change', () => { state.formDirty = true; });
    elements.form?.addEventListener('focusout', validateBlur); elements.form?.addEventListener('submit', submitForm); elements.dialog?.addEventListener('close', resolveRemoval);
    document.addEventListener('keydown', keyboard);
  }
  async function load() {
    loading(true); elements.error.hidden = true;
    try {
      const services = [];
      const requestedCursors = new Set();
      let cursor = null;
      do {
        if (requestedCursors.has(cursor)) throw new Error('Repeated service pagination cursor.');
        requestedCursors.add(cursor);
        const page = await window.FreelanceFlowApi.services(cursor);
        if (!page || typeof page !== 'object' || Array.isArray(page) || !Array.isArray(page.items)
          || !(page.next_cursor === null || (typeof page.next_cursor === 'string' && page.next_cursor.length > 0))
          || page.items.some((item) => !isApiServiceRecord(item))) throw new Error('Invalid services directory response.');
        services.push(...page.items.map(model.mapApiServiceRecord));
        cursor = page.next_cursor;
      } while (cursor !== null);
      state.services = services; state.loaded = true; render(); loading(false); return true;
    } catch (error) { if (state.loaded) { render(); loading(false); elements.error.hidden = false; } else fatal(error); return false; }
  }
  function isApiServiceRecord(record) {
    return record && typeof record === 'object' && !Array.isArray(record)
      && typeof record.public_id === 'string' && typeof record.name === 'string'
      && typeof record.description === 'string' && typeof record.unit_of_measure === 'string'
      && (typeof record.rate === 'number' || (typeof record.rate === 'string' && record.rate.trim() !== '')) && Number.isFinite(Number(record.rate)) && Number(record.rate) >= 0
      && record.currency === 'USD' && ['ACTIVE', 'ARCHIVED'].includes(record.status)
      && ((record.status === 'ACTIVE' && record.archived_at === null) || (record.status === 'ARCHIVED' && typeof record.archived_at === 'string'));
  }
  function loading(value) { elements.loading.hidden = !value; elements.content.hidden = value; elements.retry.disabled = value; }
  function fatal(error) { console.error(error); state.services = []; elements.table.innerHTML = ''; elements.cards.innerHTML = ''; loading(false); elements.content.hidden = true; elements.error.hidden = false; elements.count.textContent = 'Servicios no disponibles'; elements.status.textContent = 'Servicios no disponibles'; }
  function visible() { return model.filterServices(state.services, state.filters); }
  function render() { const shown = visible(); const metrics = model.calculateServiceMetrics(state.services); elements.total.textContent = metrics.total; elements.average.textContent = format(metrics.averageRate, metrics.averageCurrency); elements.mostUsed.textContent = metrics.mostUsedUnit; elements.table.innerHTML = shown.map(row).join(''); elements.cards.innerHTML = shown.map(card).join(''); const empty = state.services.length === 0; elements.empty.hidden = !empty; elements.noResults.hidden = empty || shown.length !== 0; elements.count.textContent = empty ? 'Sin servicios registrados' : `${shown.length} ${shown.length === 1 ? 'servicio visible' : 'servicios visibles'}`; elements.status.textContent = elements.count.textContent; elements.clear.hidden = !(state.filters.query.trim() || state.filters.unit !== 'todas'); }
  function row(service) { return `<tr><td><strong>${safe(service.nombre_servicio)}</strong>${status(service)}</td><td title="${safe(service.descripcion)}"><span class="service-description">${safe(service.descripcion || 'Sin descripci\u00f3n')}</span></td><td>${safe(service.unidad_medida)}</td><td class="service-rate">${format(service.tarifa_unitaria, service.moneda)}</td><td>${safe(service.moneda)}</td><td><div class="services-row-actions">${actions(service)}</div></td></tr>`; }
  function card(service) { return `<li class="service-card"><div><strong>${safe(service.nombre_servicio)}</strong><span class="service-unit-badge">${safe(service.unidad_medida)}</span>${status(service)}</div><p>${safe(service.descripcion || 'Sin descripci\u00f3n')}</p><dl><div><dt>Tarifa</dt><dd>${format(service.tarifa_unitaria, service.moneda)}</dd></div><div><dt>Moneda</dt><dd>${safe(service.moneda)}</dd></div></dl><div class="services-row-actions">${actions(service)}</div></li>`; }
  function actions(service) { const editDisabled = EDIT_ENABLED ? '' : ` disabled aria-describedby="${MUTATION_UNAVAILABLE_ID}"`; const removeDisabled = REMOVE_ENABLED ? '' : ` disabled aria-describedby="${MUTATION_UNAVAILABLE_ID}"`; return `<button type="button" data-action="edit-service" data-id="${safe(service.id)}" aria-label="Editar ${safe(service.nombre_servicio)}"${editDisabled}>Editar</button><button type="button" data-action="remove-service" data-id="${safe(service.id)}" aria-label="Eliminar ${safe(service.nombre_servicio)}"${removeDisabled}>Eliminar</button>`; }
  function status(service) { return service.estado === 'archivado' ? '<span class="service-status-badge">Archivado</span>' : ''; }
  function actionClick(event) { const action = event.target.closest('[data-action]'); if (!action) return; if (action.dataset.action === 'clear-service-filters') return clearFilters(); if (action.dataset.action === 'create-service') return CREATE_ENABLED && openForm(null, action); if (action.dataset.action === 'edit-service') return EDIT_ENABLED && openForm(find(action.dataset.id), action); if (action.dataset.action === 'remove-service') return REMOVE_ENABLED && removeDialog(action.dataset.id); }
  function find(id) { return state.services.find((service) => service.id === id); }
  function clearFilters() { state.filters = { query: '', unit: 'todas' }; elements.search.value = ''; elements.unit.value = 'todas'; render(); }
  function openForm(service, trigger) { if (service ? !EDIT_ENABLED : !CREATE_ENABLED) return; state.editingId = service?.id || ''; state.lastTrigger = trigger || document.activeElement; elements.title.textContent = service ? 'Editar servicio' : 'Crear servicio'; elements.submit.textContent = service ? 'Guardar cambios' : 'Crear servicio'; elements.submit.disabled = false; elements.submit.removeAttribute('aria-describedby'); elements.form.reset(); ['id', 'nombre_servicio', 'descripcion', 'unidad_medida', 'tarifa_unitaria', 'moneda'].forEach((name) => { elements.form.elements[name].value = service?.[name] ?? (name === 'moneda' ? 'USD' : ''); }); clearErrors(); state.formDirty = false; elements.drawer.removeAttribute('inert'); elements.drawer.setAttribute('aria-hidden', 'false'); elements.backdrop.classList.add('is-visible'); elements.layout?.setAttribute('inert', ''); document.body.classList.add('service-drawer-open'); requestAnimationFrame(() => elements.form.elements.nombre_servicio.focus()); }
  function closeForm(confirmDirty) { if (confirmDirty && state.formDirty && !window.confirm('Hay cambios sin guardar. ¿Cerrar de todos modos?')) return; elements.drawer.setAttribute('inert', ''); elements.drawer.setAttribute('aria-hidden', 'true'); elements.backdrop.classList.remove('is-visible'); elements.layout?.removeAttribute('inert'); document.body.classList.remove('service-drawer-open'); state.formDirty = false; state.lastTrigger?.focus?.(); }
  function data() { return Object.fromEntries(new FormData(elements.form).entries()); }
  async function submitForm(event) {
    event.preventDefault();
    if (state.editingId ? !EDIT_ENABLED : !CREATE_ENABLED) return;
    const form = data();
    const result = model.validateService({ ...form, id: state.editingId }, state.services.filter((service) => service.id !== state.editingId), { currencyOptions: ['USD'], allowZero: true });
    if (!result.valid) return showErrors(result.errors);
    const payload = {
      name: form.nombre_servicio,
      description: form.descripcion,
      unit_of_measure: { Hora: 'HOUR', Proyecto: 'PROJECT', Entregable: 'DELIVERABLE' }[form.unidad_medida],
      rate: form.tarifa_unitaria,
      currency: form.moneda
    };
    try {
      if (state.editingId) await window.FreelanceFlowApi.updateService(state.editingId, payload);
      else await window.FreelanceFlowApi.createService(payload);
    } catch (error) {
      toast('No pudimos crear el servicio. Reintentá.', 'error');
      return;
    }
    closeForm(false);
    if (await load()) {
      activity(state.editingId ? 'Servicio actualizado' : 'Servicio creado', 'Servicio guardado.');
      toast('Servicio guardado correctamente.');
    } else {
      toast('El servicio se creó, pero no pudimos actualizar el catálogo. Reintentá.', 'error');
    }
  }
  function validateBlur(event) { if (!event.target.name) return; showErrors(model.validateService({ ...data(), id: state.editingId }, state.services.filter((service) => service.id !== state.editingId), { currencyOptions: ['USD'], allowZero: true }).errors, event.target.name); }
  function showErrors(errors = {}, only = '') { clearErrors(only); const fields = only ? [only] : Object.keys(errors); fields.forEach((field) => { if (!errors[field]) return; elements.form.elements[field]?.setAttribute('aria-invalid', 'true'); const error = elements.form.querySelector(`[data-field-error="${field}"]`); if (error) error.textContent = errors[field]; }); if (!only && fields.length) { elements.summary.hidden = false; elements.summary.textContent = 'Revisá los campos marcados para guardar el servicio.'; elements.form.elements[fields[0]]?.focus(); } }
  function clearErrors(only = '') { elements.form.querySelectorAll(only ? `[data-field-error="${only}"]` : '[data-field-error]').forEach((item) => { item.textContent = ''; }); (only ? [elements.form.elements[only]] : [...elements.form.elements]).forEach((item) => item?.removeAttribute?.('aria-invalid')); if (!only) elements.summary.hidden = true; }
  function removeDialog(id) { if (!REMOVE_ENABLED) return; const service = find(id); if (!service) return; state.pendingRemovalId = id; elements.removeCopy.textContent = `Eliminarás el servicio ${service.nombre_servicio}. Esta acción no se puede deshacer.`; elements.dialog.showModal(); }
  function resolveRemoval() { if (!REMOVE_ENABLED) return; if (elements.dialog.returnValue !== 'confirm' || !state.pendingRemovalId) return; const service = find(state.pendingRemovalId); if (!service) return; const services = model.removeService(state.services, service.id); const deletedIds = [...new Set([...state.deletedIds, service.id])]; state.services = services; state.deletedIds = deletedIds; state.pendingRemovalId = ''; render(); activity('Servicio eliminado', `Eliminó el servicio ${service.nombre_servicio}.`); toast('Servicio eliminado correctamente.'); }
  function keyboard(event) { if (event.key === 'Escape' && elements.drawer.getAttribute('aria-hidden') === 'false') { event.preventDefault(); closeForm(true); } if (event.key !== 'Tab' || elements.drawer.getAttribute('aria-hidden') === 'true') return; const focusable = [...elements.drawer.querySelectorAll('button:not([disabled]), input:not([type="hidden"]), select, textarea')]; const first = focusable[0]; const last = focusable.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  function format(value, currency) { try { return new Intl.NumberFormat('es-EC', { style: 'currency', currency }).format(value); } catch { return String(value); } }
  function activity(action, description) { window.FreelanceFlowActivity?.record({ module: 'Servicios', action, description }); }
  function toast(message, tone = 'success') { clearTimeout(state.toastTimer); elements.toast.textContent = message; elements.toast.dataset.tone = tone; elements.toast.hidden = false; state.toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 3600); }
  function safe(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
}());
