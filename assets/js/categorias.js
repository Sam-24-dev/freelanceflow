/* FreelanceFlow — Categorías. Browser-only prototype; no backend or external APIs. */

(function categoriesModule() {
  'use strict';

  const DATA_URL = '../assets/data/mock-data.json';
  const STORAGE_KEY = 'freelanceflow_expense_categories_v1';
  const model = window.FreelanceFlowCategoryModel;

  const state = {
    categories: [],
    expenses: [],
    filters: { query: '', deductible: 'todas', status: 'todos' },
    editingId: '',
    pendingRemovalId: '',
    deletedCategoryIds: [],
    formDirty: false,
    lastTrigger: null,
    toastTimer: 0
  };

  const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' });
  let elements = {};

  document.addEventListener('DOMContentLoaded', initialize);

  async function initialize() {
    if (!model) {
      showFatalError(new Error('El modelo de categorías no está disponible.'));
      return;
    }
    cacheElements();
    bindEvents();
    await loadAndRenderCategories();
  }

  function cacheElements() {
    elements = {
      appLayout: document.querySelector('[data-app-layout]'),
      createButton: document.getElementById('category-create-button'),
      search: document.getElementById('category-search'),
      deductible: document.getElementById('category-deductible-filter'),
      clearFilters: document.getElementById('categories-clear-filters'),
      tabs: [...document.querySelectorAll('[data-category-status]')],
      retryButton: document.getElementById('categories-retry-button'),
      dataError: document.getElementById('categories-data-error'),
      loading: document.getElementById('categories-loading'),
      content: document.getElementById('categories-content'),
      tableBody: document.getElementById('categories-table-body'),
      cardList: document.getElementById('categories-card-list'),
      emptyState: document.getElementById('categories-empty-state'),
      noResults: document.getElementById('categories-no-results'),
      resultsCount: document.getElementById('categories-results-count'),
      resultsStatus: document.getElementById('categories-results-status'),
      totalCount: document.getElementById('categories-total-count'),
      deductibleCount: document.getElementById('categories-deductible-count'),
      mostUsed: document.getElementById('categories-most-used'),
      budgetAttention: document.getElementById('categories-budget-attention'),
      budgetLabel: document.getElementById('categories-budget-label'),
      backdrop: document.getElementById('category-drawer-backdrop'),
      drawer: document.getElementById('category-drawer'),
      drawerClose: document.getElementById('category-drawer-close'),
      drawerTitle: document.getElementById('category-drawer-title'),
      form: document.getElementById('category-form'),
      formSummary: document.getElementById('category-form-summary'),
      formCancel: document.getElementById('category-form-cancel'),
      submitButton: document.getElementById('category-submit-button'),
      removeDialog: document.getElementById('category-remove-dialog'),
      removeCopy: document.getElementById('category-remove-dialog-copy'),
      toast: document.getElementById('category-toast')
    };
  }

  function bindEvents() {
    elements.createButton?.addEventListener('click', (event) => openForm(null, event.currentTarget));
    elements.search?.addEventListener('input', (event) => {
      state.filters.query = event.currentTarget.value;
      renderAll();
    });
    elements.search?.addEventListener('change', () => window.FreelanceFlowActivity?.recordSearch('Categorías', state.filters.query));
    elements.deductible?.addEventListener('change', (event) => {
      state.filters.deductible = event.currentTarget.value;
      renderAll();
    });
    elements.tabs.forEach((tab) => tab.addEventListener('click', () => {
      state.filters.status = tab.dataset.categoryStatus;
      syncTabs();
      renderAll();
    }));
    elements.clearFilters?.addEventListener('click', clearFilters);
    elements.retryButton?.addEventListener('click', loadAndRenderCategories);
    document.getElementById('main-content')?.addEventListener('click', handleActionClick);
    elements.backdrop?.addEventListener('click', () => closeForm({ confirmDirty: true }));
    elements.drawerClose?.addEventListener('click', () => closeForm({ confirmDirty: true }));
    elements.formCancel?.addEventListener('click', () => closeForm({ confirmDirty: true }));
    elements.form?.addEventListener('input', () => { state.formDirty = true; });
    elements.form?.addEventListener('change', () => { state.formDirty = true; });
    elements.form?.addEventListener('focusout', validateFieldOnBlur);
    elements.form?.addEventListener('submit', handleFormSubmit);
    elements.removeDialog?.addEventListener('close', resolveRemovalDialog);
    document.addEventListener('keydown', handleKeydown);
  }

  async function loadAndRenderCategories() {
    setLoading(true);
    elements.dataError.hidden = true;
    try {
      const data = await window.FreelanceFlowDataLoader.loadJson(DATA_URL);
      const stored = readStoredCatalog();
      state.expenses = data.gastos || [];
      state.deletedCategoryIds = stored.deletedIds;
      state.categories = model.mergeCategories(data.categorias_gasto || [], stored);
      renderAll();
      setLoading(false);
    } catch (error) {
      showFatalError(error);
    }
  }

  function readStoredCatalog() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return model.normalizeStoredCatalog(parsed);
    } catch (error) {
      console.warn('No se pudieron recuperar las categorías locales.', error);
      return { items: [], deletedIds: [] };
    }
  }

  function saveCategories() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        items: state.categories,
        deletedIds: state.deletedCategoryIds
      }));
    } catch (error) {
      console.warn('No se pudieron guardar las categorías locales.', error);
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
    elements.resultsCount.textContent = 'Categorías no disponibles';
  }

  function currentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  function categoriesWithUsage() {
    return model.applyCategoryUsage(state.categories, state.expenses, currentMonth());
  }

  function visibleCategories() {
    return model.filterCategories(categoriesWithUsage(), state.filters);
  }

  function renderAll() {
    const visible = visibleCategories();
    renderSummary(visible);
    renderList(visible);
    syncTabs();
    const hasFilters = Boolean(state.filters.query.trim()) || state.filters.deductible !== 'todas' || state.filters.status !== 'todos';
    elements.clearFilters.hidden = !hasFilters;
    elements.resultsStatus.textContent = `${pluralizeCategory(visible.length)}.`;
  }

  function renderSummary(visible) {
    const metrics = model.calculateCategoryMetrics(visible);
    elements.totalCount.textContent = String(metrics.total);
    elements.deductibleCount.textContent = String(metrics.deducible);
    elements.mostUsed.textContent = metrics.mostUsed;
    elements.budgetAttention.textContent = String(metrics.budgetAttention.count);
    elements.budgetLabel.textContent = metrics.budgetAttention.label;
  }

  function renderList(visible) {
    const total = state.categories.length;
    const countCopy = pluralizeCategory(visible.length);
    elements.resultsCount.textContent = total ? countCopy : 'Sin categorías registradas';
    elements.tableBody.innerHTML = visible.map(renderTableRow).join('');
    elements.cardList.innerHTML = visible.map(renderCard).join('');
    elements.emptyState.hidden = total !== 0;
    elements.noResults.hidden = total === 0 || visible.length !== 0;
  }

  function renderTableRow(category) {
    return `<tr>
      <td><strong>${escapeHTML(category.nombre_categoria)}</strong><span>${escapeHTML(category.descripcion || 'Sin descripción')}</span></td>
      <td>${renderDeductible(category)}</td>
      <td>${renderBudget(category)}</td>
      <td>${renderUsage(category)}</td>
      <td>${renderStatus(category)}</td>
      <td><div class="categories-row-actions">${renderActions(category)}</div></td>
    </tr>`;
  }

  function renderCard(category) {
    return `<li class="category-card">
      <div><strong>${escapeHTML(category.nombre_categoria)}</strong>${renderStatus(category)}</div>
      <p>${escapeHTML(category.descripcion || 'Sin descripción')}</p>
      <dl>
        <div><dt>Deducible</dt><dd>${category.es_deducible_por_defecto ? 'Sí' : 'No'}</dd></div>
        <div><dt>Presupuesto</dt><dd>${renderBudget(category)}</dd></div>
        <div><dt>Uso mensual</dt><dd>${renderUsage(category)}</dd></div>
      </dl>
      <div class="categories-row-actions">${renderActions(category)}</div>
    </li>`;
  }

  function renderActions(category) {
    const removeAction = category.usos > 0 ? 'Inactivar' : 'Eliminar';
    return `<button type="button" aria-label="Editar ${escapeAttribute(category.nombre_categoria)}" data-action="edit-category" data-category-id="${escapeAttribute(category.id)}">Editar</button>
      <button type="button" aria-label="${removeAction} ${escapeAttribute(category.nombre_categoria)}" data-action="remove-category" data-category-id="${escapeAttribute(category.id)}">${removeAction}</button>`;
  }

  function renderDeductible(category) {
    return `<span class="category-badge ${category.es_deducible_por_defecto ? 'is-deductible' : 'is-neutral'}">${category.es_deducible_por_defecto ? 'Deducible' : 'No deducible'}</span>`;
  }

  function renderBudget(category) {
    return category.presupuesto_mensual === null ? 'Sin presupuesto' : money.format(category.presupuesto_mensual);
  }

  function renderUsage(category) {
    const amount = money.format(category.gasto_mensual || 0);
    const overBudget = category.presupuesto_mensual && category.gasto_mensual >= category.presupuesto_mensual;
    const nearBudget = category.presupuesto_mensual && category.gasto_mensual >= category.presupuesto_mensual * 0.8;
    const label = overBudget ? 'Límite alcanzado' : nearBudget ? 'Atención' : pluralizeUsage(category.usos);
    return `<span class="category-usage${nearBudget ? ' is-warning' : ''}">${amount}<small>${label}</small></span>`;
  }

  function pluralizeCategory(count) {
    return count === 1 ? '1 categoría visible' : `${count} categorías visibles`;
  }

  function pluralizeUsage(count) {
    return count === 1 ? '1 uso' : `${count} usos`;
  }

  function renderStatus(category) {
    return `<span class="category-badge ${category.estado === 'activo' ? 'is-active' : 'is-inactive'}">${category.estado === 'activo' ? 'Activa' : 'Inactiva'}</span>`;
  }

  function syncTabs() {
    elements.tabs.forEach((tab) => {
      const active = tab.dataset.categoryStatus === state.filters.status;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
  }

  function clearFilters() {
    state.filters = { query: '', deductible: 'todas', status: 'todos' };
    elements.search.value = '';
    elements.deductible.value = 'todas';
    renderAll();
  }

  function handleActionClick(event) {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'create-category') openForm(null, action);
    if (action.dataset.action === 'clear-category-filters') clearFilters();
    if (action.dataset.action === 'edit-category') openForm(findCategory(action.dataset.categoryId), action);
    if (action.dataset.action === 'remove-category') openRemovalDialog(action.dataset.categoryId);
  }

  function findCategory(id) {
    return categoriesWithUsage().find((category) => category.id === id);
  }

  function openForm(category, trigger) {
    state.editingId = category?.id || '';
    state.lastTrigger = trigger || document.activeElement;
    elements.drawerTitle.textContent = category ? 'Editar categoría' : 'Nueva categoría';
    elements.submitButton.textContent = category ? 'Guardar cambios' : 'Guardar categoría';
    elements.form.reset();
    elements.form.elements.id.value = category?.id || '';
    elements.form.elements.nombre_categoria.value = category?.nombre_categoria || '';
    elements.form.elements.descripcion.value = category?.descripcion || '';
    elements.form.elements.presupuesto_mensual.value = category?.presupuesto_mensual ?? '';
    elements.form.elements.estado.value = category?.estado || 'activo';
    elements.form.elements.es_deducible_por_defecto.checked = category?.es_deducible_por_defecto || false;
    clearErrors();
    state.formDirty = false;
    elements.drawer.removeAttribute('inert');
    elements.drawer.setAttribute('aria-hidden', 'false');
    elements.backdrop.classList.add('is-visible');
    elements.appLayout?.setAttribute('inert', '');
    document.body.classList.add('category-drawer-open');
    requestAnimationFrame(() => elements.form.elements.nombre_categoria.focus());
  }

  function closeForm({ confirmDirty = false } = {}) {
    if (confirmDirty && state.formDirty && !window.confirm('Tenés cambios sin guardar. ¿Cerrar de todos modos?')) return;
    elements.drawer.setAttribute('inert', '');
    elements.drawer.setAttribute('aria-hidden', 'true');
    elements.backdrop.classList.remove('is-visible');
    elements.appLayout?.removeAttribute('inert');
    document.body.classList.remove('category-drawer-open');
    state.formDirty = false;
    state.lastTrigger?.focus?.();
  }

  function formData() {
    const data = Object.fromEntries(new FormData(elements.form).entries());
    data.es_deducible_por_defecto = elements.form.elements.es_deducible_por_defecto.checked;
    return data;
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    const data = formData();
    const existing = state.categories.filter((category) => category.id !== state.editingId);
    const result = model.validateCategory({ ...data, id: state.editingId }, existing);
    if (!result.valid) {
      showErrors(result.errors);
      return;
    }

    const record = model.createCategoryRecord({ ...data, id: state.editingId }, { id: state.editingId || `cat_${Date.now()}` });
    if (state.editingId) {
      state.categories = state.categories.map((category) => category.id === state.editingId ? record : category);
      recordActivity('Categoría actualizada', `Categoría actualizada: ${record.nombre_categoria}.`);
      showToast('Categoría actualizada.');
    } else {
      state.categories = [...state.categories, record];
      recordActivity('Categoría creada', `Categoría creada: ${record.nombre_categoria}.`);
      showToast('Categoría creada.');
    }
    saveCategories();
    closeForm();
    renderAll();
  }

  function validateFieldOnBlur(event) {
    if (!event.target.name) return;
    const result = model.validateCategory({ ...formData(), id: state.editingId }, state.categories.filter((category) => category.id !== state.editingId));
    showErrors(result.errors, event.target.name);
  }

  function showErrors(errors = {}, onlyField = '') {
    clearErrors(onlyField);
    const fields = onlyField ? [onlyField] : Object.keys(errors);
    fields.forEach((field) => {
      if (!errors[field]) return;
      const input = elements.form.elements[field];
      const error = elements.form.querySelector(`[data-field-error="${field}"]`);
      input?.setAttribute('aria-invalid', 'true');
      error.textContent = errors[field];
    });
    if (!onlyField && Object.keys(errors).length) {
      elements.formSummary.hidden = false;
      elements.formSummary.textContent = 'Revisá los campos marcados para guardar la categoría.';
      elements.form.elements[Object.keys(errors)[0]]?.focus();
    }
  }

  function clearErrors(onlyField = '') {
    const selector = onlyField ? `[data-field-error="${onlyField}"]` : '[data-field-error]';
    elements.form.querySelectorAll(selector).forEach((error) => { error.textContent = ''; });
    const controls = onlyField ? [elements.form.elements[onlyField]] : [...elements.form.elements];
    controls.forEach((control) => control?.removeAttribute?.('aria-invalid'));
    if (!onlyField) elements.formSummary.hidden = true;
  }

  function openRemovalDialog(id) {
    const category = findCategory(id);
    if (!category) return;
    state.pendingRemovalId = id;
    const action = model.getCategoryRemovalAction(category);
    elements.removeCopy.textContent = action === 'inactivate'
      ? 'Esta categoría ya tiene gastos asociados. Se inactivará para conservar el historial.'
      : 'Esta categoría no tiene gastos asociados. Se eliminará del catálogo local.';
    elements.removeDialog.showModal();
  }

  function resolveRemovalDialog() {
    if (elements.removeDialog.returnValue !== 'confirm' || !state.pendingRemovalId) return;
    const category = findCategory(state.pendingRemovalId);
    if (!category) return;
    const action = model.getCategoryRemovalAction(category);
    if (action === 'inactivate') {
      state.categories = state.categories.map((item) => item.id === category.id ? { ...item, estado: 'inactivo' } : item);
      recordActivity('Categoría inactivada', `Categoría inactivada por uso histórico: ${category.nombre_categoria}.`);
      showToast('La categoría tenía movimientos; quedó inactiva para proteger el historial.');
    } else {
      state.categories = state.categories.filter((item) => item.id !== category.id);
      state.deletedCategoryIds = [...new Set([...state.deletedCategoryIds, category.id])];
      recordActivity('Categoría eliminada', `Categoría eliminada: ${category.nombre_categoria}.`);
      showToast('Categoría eliminada.');
    }
    state.pendingRemovalId = '';
    saveCategories();
    renderAll();
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && elements.drawer.getAttribute('aria-hidden') === 'false') {
      event.preventDefault();
      closeForm({ confirmDirty: true });
    }
    if (event.key !== 'Tab' || elements.drawer.getAttribute('aria-hidden') === 'true') return;
    const focusable = [...elements.drawer.querySelectorAll('button:not([disabled]), input, select, textarea')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function recordActivity(action, description) {
    window.FreelanceFlowActivity?.record({ module: 'Categorías', action, description });
  }

  function showToast(message, tone = 'success') {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.dataset.tone = tone;
    elements.toast.hidden = false;
    state.toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, 3600);
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function escapeAttribute(value) {
    return escapeHTML(value);
  }
}());
