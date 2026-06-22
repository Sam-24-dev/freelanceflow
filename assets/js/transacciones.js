/* FreelanceFlow — Movimientos financieros, frontend estático. */

(function transactionsApp() {
  const DATA_URL = './assets/data/mock-data.json';
  const STORAGE_KEY = 'freelanceflow_transactions_mock';
  const DEFAULT_PERIOD = '2026-06';
  const INCOME_CATEGORY_ID = 'income_invoice';
  const model = window.FreelanceFlowTransactionModel;

  const currencyFormatter = new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });

  const dateFormatter = new Intl.DateTimeFormat('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const periodFormatter = new Intl.DateTimeFormat('es-EC', {
    month: 'long',
    year: 'numeric'
  });

  const state = {
    data: {},
    transactions: [],
    filters: {
      type: 'todos',
      month: DEFAULT_PERIOD,
      category: '',
      query: ''
    },
    previousFocus: null,
    toastTimer: null,
    formDirty: false
  };

  document.addEventListener('DOMContentLoaded', initializeTransactions);

  async function initializeTransactions() {
    if (!model) {
      showDataError('No pudimos preparar el módulo de movimientos. Inténtalo nuevamente.');
      return;
    }

    try {
      state.data = await loadData();
      state.transactions = loadTransactions(state.data);
      setInitialPeriod();
      populateStaticOptions();
      bindFilters();
      bindDrawer();
      bindForm();
      renderTransactions();
      openDrawerFromHash();
    } catch (error) {
      console.error(error);
      hideLoading();
      showDataError('No pudimos cargar tus movimientos. Inténtalo nuevamente.');
    }
  }

  async function loadData() {
    return window.FreelanceFlowDataLoader.loadJson(DATA_URL);
  }

  function loadTransactions(data) {
    const fallback = data.movimientos_financieros_mock_auxiliar ?? [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const source = stored ? JSON.parse(stored) : fallback;
      return Array.isArray(source) ? source.map(normalizeTransaction) : fallback.map(normalizeTransaction);
    } catch (error) {
      console.warn('Se descartó un historial local inválido.', error);
      localStorage.removeItem(STORAGE_KEY);
      return fallback.map(normalizeTransaction);
    }
  }

  function normalizeTransaction(transaction) {
    return {
      id: transaction.id || `mov_${crypto.randomUUID?.() || Date.now()}`,
      mock_auxiliar: true,
      origen_oficial: transaction.origen_oficial || 'movimiento_manual',
      origen_id: transaction.origen_id || null,
      tipo: transaction.tipo || '',
      fecha: transaction.fecha || getLocalDate(),
      monto: Number(transaction.monto || 0),
      moneda: transaction.moneda || 'USD',
      categoria_gasto_id: transaction.categoria_gasto_id || '',
      categoria_mock_auxiliar: transaction.categoria_mock_auxiliar || '',
      cuenta_id: transaction.cuenta_id || '',
      cliente_id: transaction.cliente_id || '',
      proyecto_id: transaction.proyecto_id || transaction.project_id || '',
      descripcion: transaction.descripcion || ''
    };
  }

  function setInitialPeriod() {
    const params = new URLSearchParams(window.location.search);
    const requestedPeriod = params.get('period');
    state.filters.month = /^\d{4}-\d{2}$/.test(requestedPeriod || '') ? requestedPeriod : DEFAULT_PERIOD;
    state.filters.type = ['todos', 'ingreso', 'gasto'].includes(params.get('type')) ? params.get('type') : 'todos';
    state.filters.category = params.get('category') || '';
    state.filters.query = params.get('q') || '';
    setValue('movement-month', state.filters.month);
    setValue('transactions-search', state.filters.query);
    updateTypeTabs();
  }

  function populateStaticOptions() {
    populateSelect('transaction-account', state.data.cuentas_mock_auxiliar ?? [], 'id', 'nombre_cuenta');
    populateSelect('transaction-client', state.data.clientes ?? [], 'id', 'nombre_razon_social');
    populateCategoryFilter();
    setValue('transactions-category-filter', state.filters.category);
    updateFormCategories('');
    updateProjectOptions('');
    setValue('transaction-date', getLocalDate());
  }

  function populateCategoryFilter() {
    const options = [
      { id: INCOME_CATEGORY_ID, label: 'Ingreso por factura' },
      ...(state.data.categorias_gasto ?? []).map((category) => ({ id: category.id, label: category.nombre_categoria }))
    ];
    populateSelect('transactions-category-filter', options, 'id', 'label');
  }

  function populateSelect(id, items, valueKey, labelKey, selectedValue = '') {
    const select = document.getElementById(id);
    if (!select) return;
    items.forEach((item) => {
      const option = document.createElement('option');
      option.value = item[valueKey];
      option.textContent = item[labelKey];
      option.selected = String(option.value) === String(selectedValue);
      select.appendChild(option);
    });
  }

  function updateFormCategories(type, selectedValue = '') {
    const select = document.getElementById('transaction-category');
    if (!select) return;

    const categories = [];
    if (!type || type === 'ingreso') categories.push({ id: INCOME_CATEGORY_ID, label: 'Ingreso por factura' });
    if (!type || type === 'gasto') {
      categories.push(...(state.data.categorias_gasto ?? []).map((category) => ({ id: category.id, label: category.nombre_categoria })));
    }

    select.innerHTML = '<option value="">Selecciona una categoría</option>';
    populateSelect('transaction-category', categories, 'id', 'label', selectedValue);
    renderCategoryChips(categories, selectedValue);
  }

  function renderCategoryChips(categories, selectedValue = '') {
    const container = document.getElementById('transaction-category-chips');
    if (!container) return;

    container.replaceChildren();
    categories.slice(0, 5).forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'transaction-category-chip';
      button.dataset.categoryValue = category.id;
      button.setAttribute('aria-pressed', String(category.id === selectedValue));
      button.textContent = category.label;
      button.addEventListener('click', () => {
        setValue('transaction-category', category.id);
        syncCategoryChips();
        state.formDirty = true;
      });
      container.append(button);
    });
  }

  function syncCategoryChips() {
    const selectedValue = getValue('transaction-category');
    document.querySelectorAll('.transaction-category-chip').forEach((button) => {
      const active = button.dataset.categoryValue === selectedValue;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function updateProjectOptions(clientId, selectedValue = '') {
    const select = document.getElementById('transaction-project');
    if (!select) return;

    const projects = model.getProjectsForClient(state.data.proyectos ?? [], clientId);
    select.innerHTML = clientId
      ? '<option value="">Sin proyecto</option>'
      : '<option value="">Selecciona primero un cliente</option>';
    select.disabled = !clientId;
    populateSelect('transaction-project', projects, 'id', 'nombre_proyecto', selectedValue);
  }

  function bindFilters() {
    document.querySelectorAll('.transaction-filter-tab').forEach((button) => {
      button.addEventListener('click', () => {
        state.filters.type = button.dataset.filterType || 'todos';
        updateTypeTabs();
        updateFilterUrl();
        renderTransactions();
      });
    });

    document.getElementById('transactions-search')?.addEventListener('input', (event) => {
      state.filters.query = event.target.value;
      updateFilterUrl();
      renderTransactions();
    });

    document.getElementById('transactions-category-filter')?.addEventListener('change', (event) => {
      state.filters.category = event.target.value;
      updateFilterUrl();
      renderTransactions();
    });

    document.getElementById('movement-month')?.addEventListener('change', (event) => {
      state.filters.month = event.target.value || DEFAULT_PERIOD;
      setValue('movement-month', state.filters.month);
      updateFilterUrl();
      renderTransactions();
    });

    document.getElementById('transactions-clear-filters')?.addEventListener('click', clearFilters);
    document.querySelectorAll('[data-clear-transaction-filters]').forEach((button) => button.addEventListener('click', clearFilters));
  }

  function updateTypeTabs() {
    document.querySelectorAll('.transaction-filter-tab').forEach((button) => {
      const active = button.dataset.filterType === state.filters.type;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function clearFilters() {
    state.filters = { type: 'todos', month: DEFAULT_PERIOD, category: '', query: '' };
    setValue('movement-month', DEFAULT_PERIOD);
    setValue('transactions-search', '');
    setValue('transactions-category-filter', '');
    updateTypeTabs();
    updateFilterUrl();
    renderTransactions();
  }

  function updateFilterUrl() {
    const url = new URL(window.location.href);
    if (state.filters.month && state.filters.month !== DEFAULT_PERIOD) url.searchParams.set('period', state.filters.month);
    else url.searchParams.delete('period');
    if (state.filters.type !== 'todos') url.searchParams.set('type', state.filters.type);
    else url.searchParams.delete('type');
    if (state.filters.category) url.searchParams.set('category', state.filters.category);
    else url.searchParams.delete('category');
    if (state.filters.query.trim()) url.searchParams.set('q', state.filters.query.trim());
    else url.searchParams.delete('q');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function bindDrawer() {
    document.querySelectorAll('[data-open-transaction-form]').forEach((button) => {
      button.addEventListener('click', () => openDrawer(button));
    });
    document.getElementById('transaction-close-button')?.addEventListener('click', closeDrawer);
    document.getElementById('transaction-cancel-button')?.addEventListener('click', closeDrawer);
    document.getElementById('transaction-drawer-backdrop')?.addEventListener('click', closeDrawer);
    document.getElementById('transaction-form-panel')?.addEventListener('keydown', trapDrawerFocus);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isDrawerOpen()) closeDrawer();
    });
    window.addEventListener('hashchange', openDrawerFromHash);
    window.addEventListener('beforeunload', (event) => {
      if (!state.formDirty || !isDrawerOpen()) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  function openDrawer(trigger, transactionId = '') {
    const drawer = document.getElementById('transaction-form-panel');
    const backdrop = document.getElementById('transaction-drawer-backdrop');
    if (!drawer || !backdrop) return;

    state.previousFocus = trigger || document.activeElement;
    resetForm(false);
    if (transactionId) populateFormForEdit(transactionId);

    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.body.classList.add('transaction-drawer-open');
    setPageInert(true);

    window.requestAnimationFrame(() => {
      const focusTarget = window.matchMedia('(max-width: 767px)').matches
        ? document.getElementById('transaction-amount')
        : document.getElementById('transaction-close-button');
      focusTarget?.focus();
    });
  }

  function openDrawerFromHash() {
    if (!model.shouldOpenTransactionFormFromHash(window.location.hash) || isDrawerOpen()) return;
    openDrawer(document.querySelector('[data-open-transaction-form]'));
  }

  function closeDrawer() {
    const drawer = document.getElementById('transaction-form-panel');
    const backdrop = document.getElementById('transaction-drawer-backdrop');
    if (!drawer || !backdrop) return;
    if (state.formDirty && !window.confirm('¿Descartar los cambios de este movimiento?')) return;

    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    document.body.classList.remove('transaction-drawer-open');
    setPageInert(false);
    state.formDirty = false;
    state.previousFocus?.focus?.();
  }

  function setPageInert(value) {
    const targets = [
      document.querySelector('[data-app-layout]'),
      document.querySelector('.app-bottom-navigation')
    ].filter(Boolean);
    targets.forEach((element) => value ? element.setAttribute('inert', '') : element.removeAttribute('inert'));
  }

  function isDrawerOpen() {
    return document.getElementById('transaction-form-panel')?.classList.contains('is-open') || false;
  }

  function trapDrawerFocus(event) {
    if (event.key !== 'Tab') return;
    const drawer = event.currentTarget;
    const focusable = [...drawer.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]')]
      .filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
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

  function bindForm() {
    const form = document.getElementById('transaction-form');
    form?.addEventListener('submit', submitTransaction);
    form?.addEventListener('input', () => { state.formDirty = true; });
    document.querySelectorAll('input[name="tipo"]').forEach((input) => {
      input.addEventListener('change', () => updateFormCategories(input.value));
    });
    document.getElementById('transaction-client')?.addEventListener('change', (event) => updateProjectOptions(event.target.value));
    document.getElementById('transaction-category')?.addEventListener('change', syncCategoryChips);
  }

  function submitTransaction(event) {
    event.preventDefault();
    clearFormErrors();

    const formData = readForm();
    const validation = model.validateTransaction(formData);
    if (!validation.valid) {
      showFieldError(validation.field, validation.message);
      return;
    }

    const existing = state.transactions.find((transaction) => transaction.id === formData.id);
    const transaction = buildTransaction(formData, existing);
    state.transactions = existing
      ? state.transactions.map((item) => item.id === existing.id ? transaction : item)
      : [transaction, ...state.transactions];

    saveTransactions();
    renderTransactions();
    state.formDirty = false;
    closeDrawer();
    showToast(existing ? 'Transacción actualizada exitosamente.' : 'Transacción guardada exitosamente.');
  }

  function readForm() {
    return {
      id: getValue('transaction-id'),
      tipo: document.querySelector('input[name="tipo"]:checked')?.value || '',
      monto: Number(getValue('transaction-amount')),
      fecha: getValue('transaction-date'),
      categoria: getValue('transaction-category'),
      cuenta_id: getValue('transaction-account'),
      cliente_id: getValue('transaction-client'),
      proyecto_id: getValue('transaction-project'),
      descripcion: getValue('transaction-notes')
    };
  }

  function buildTransaction(formData, existing = {}) {
    const category = resolveCategory(formData.categoria);
    return normalizeTransaction({
      ...existing,
      id: existing.id || `mov_${crypto.randomUUID?.() || Date.now()}`,
      origen_oficial: formData.tipo === 'ingreso' ? 'pago_factura' : 'gasto',
      tipo: formData.tipo,
      monto: formData.monto,
      fecha: formData.fecha,
      categoria_gasto_id: category.isExpense ? formData.categoria : '',
      categoria_mock_auxiliar: category.label,
      cuenta_id: formData.cuenta_id,
      cliente_id: formData.cliente_id,
      proyecto_id: formData.proyecto_id,
      descripcion: formData.descripcion || (formData.tipo === 'ingreso' ? 'Ingreso registrado' : 'Gasto registrado')
    });
  }

  function populateFormForEdit(transactionId) {
    const transaction = state.transactions.find((item) => item.id === transactionId);
    if (!transaction) return;

    const project = (state.data.proyectos ?? []).find((item) => item.id === transaction.proyecto_id);
    const clientId = transaction.cliente_id || project?.cliente_id || '';
    const categoryId = transaction.tipo === 'ingreso' ? INCOME_CATEGORY_ID : transaction.categoria_gasto_id;

    setValue('transaction-id', transaction.id);
    setCheckedType(transaction.tipo);
    updateFormCategories(transaction.tipo, categoryId);
    setValue('transaction-amount', transaction.monto);
    setValue('transaction-date', transaction.fecha);
    setValue('transaction-account', transaction.cuenta_id);
    setValue('transaction-client', clientId);
    updateProjectOptions(clientId, transaction.proyecto_id);
    setValue('transaction-notes', transaction.descripcion);
    updateText('transaction-form-title', 'Editar movimiento');
    updateText('transaction-submit-button', 'Actualizar movimiento');
  }

  function resetForm() {
    const form = document.getElementById('transaction-form');
    form?.reset();
    clearFormErrors();
    setValue('transaction-id', '');
    setValue('transaction-date', getLocalDate());
    updateFormCategories('');
    updateProjectOptions('');
    updateText('transaction-form-title', 'Nuevo movimiento');
    updateText('transaction-submit-button', 'Guardar movimiento');
    state.formDirty = false;
  }

  function clearFormErrors() {
    document.querySelectorAll('.transaction-field-error').forEach((element) => { element.textContent = ''; });
    document.querySelectorAll('.transaction-field, .transaction-fieldset').forEach((element) => element.classList.remove('has-error'));
    document.querySelectorAll('[aria-invalid="true"]').forEach((element) => element.removeAttribute('aria-invalid'));
    const message = document.getElementById('transaction-form-message');
    if (message) {
      message.hidden = true;
      message.textContent = '';
    }
  }

  function showFieldError(field, message) {
    const mapping = {
      tipo: ['transaction-type-error', 'input[name="tipo"]', '.transaction-fieldset'],
      monto: ['transaction-amount-error', '#transaction-amount', '.transaction-amount-field'],
      fecha: ['transaction-date-error', '#transaction-date', '#transaction-date'],
      categoria: ['transaction-category-error', '#transaction-category', '#transaction-category'],
      cuenta_id: ['transaction-account-error', '#transaction-account', '#transaction-account']
    };
    const [errorId, controlSelector, wrapperSelector] = mapping[field] || [];
    const control = controlSelector ? document.querySelector(controlSelector) : null;
    const wrapper = wrapperSelector?.startsWith('.')
      ? document.querySelector(wrapperSelector)
      : control?.closest('.transaction-field');
    const error = errorId ? document.getElementById(errorId) : null;

    if (error) error.textContent = message;
    wrapper?.classList.add('has-error');
    control?.setAttribute('aria-invalid', 'true');
    control?.focus();

    const summary = document.getElementById('transaction-form-message');
    if (summary) {
      summary.hidden = false;
      summary.className = 'transactions-alert transactions-alert-error';
      summary.textContent = 'Revisa el campo destacado antes de continuar.';
    }
  }

  function renderTransactions() {
    const enriched = state.transactions.map(enrichTransaction);
    const filtered = model.filterTransactions(enriched, state.filters);
    renderSummary(filtered);
    renderLedger(filtered);
    hideLoading();
  }

  function enrichTransaction(transaction) {
    return {
      ...transaction,
      categoria_id: transaction.tipo === 'ingreso' ? INCOME_CATEGORY_ID : transaction.categoria_gasto_id,
      categoria: getCategoryName(transaction),
      cliente: getClientName(transaction.cliente_id),
      proyecto: getProjectName(transaction.proyecto_id),
      cuenta: getAccountName(transaction.cuenta_id)
    };
  }

  function renderSummary(items) {
    const summary = model.calculateSummary(items);
    updateText('summary-income', formatCurrency(summary.income));
    updateText('summary-expense', formatCurrency(summary.expense));
    updateText('summary-balance', formatCurrency(summary.net));
    const netElement = document.getElementById('summary-balance');
    netElement?.classList.toggle('transactions-expense-text', summary.net < 0);
  }

  function renderLedger(items) {
    const tableBody = document.getElementById('transactions-table-body');
    const cardList = document.getElementById('transactions-card-list');
    const tableWrap = document.getElementById('transactions-table-wrap');
    const emptyState = document.getElementById('transactions-empty-state');
    const noResults = document.getElementById('transactions-no-results');
    if (!tableBody || !cardList || !tableWrap || !emptyState || !noResults) return;

    tableBody.replaceChildren();
    cardList.replaceChildren();
    const hasStoredData = state.transactions.length > 0;
    const hasResults = items.length > 0;

    tableWrap.hidden = !hasResults;
    cardList.hidden = !hasResults;
    emptyState.hidden = hasStoredData;
    noResults.hidden = !hasStoredData || hasResults;

    items.forEach((transaction) => {
      tableBody.append(createTableRow(transaction));
      cardList.append(createTransactionCard(transaction));
    });

    updateText('transactions-result-count', getResultCountText(items.length));
  }

  function createTableRow(transaction) {
    const row = document.createElement('tr');
    const income = transaction.tipo === 'ingreso';
    row.innerHTML = `
      <td><p class="transactions-table-primary">${escapeHtml(formatDate(transaction.fecha))}</p></td>
      <td><span class="transactions-type-badge ${income ? 'transactions-type-income' : 'transactions-type-expense'}">${income ? 'Ingreso' : 'Gasto'}</span></td>
      <td><p class="transactions-table-primary" title="${escapeHtml(transaction.descripcion)}">${escapeHtml(transaction.descripcion)}</p></td>
      <td><span class="transactions-category-badge" title="${escapeHtml(transaction.categoria)}">${escapeHtml(transaction.categoria)}</span></td>
      <td><p title="${escapeHtml(transaction.cliente)}">${escapeHtml(transaction.cliente)}</p></td>
      <td><p title="${escapeHtml(transaction.proyecto)}">${escapeHtml(transaction.proyecto)}</p></td>
      <td class="transactions-table-amount ${income ? 'transactions-income-text' : 'transactions-expense-text'}">${income ? '+' : '−'}${escapeHtml(formatCurrency(transaction.monto))}</td>
      <td><button class="transactions-row-action" type="button" data-edit-transaction="${escapeHtml(transaction.id)}" aria-label="Editar ${escapeHtml(transaction.descripcion)}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button></td>`;
    row.querySelector('[data-edit-transaction]')?.addEventListener('click', (event) => openDrawer(event.currentTarget, transaction.id));
    return row;
  }

  function createTransactionCard(transaction) {
    const card = document.createElement('article');
    const income = transaction.tipo === 'ingreso';
    card.className = 'transaction-card';
    card.innerHTML = `
      <div class="transaction-card-header">
        <div>
          <span class="transactions-type-badge ${income ? 'transactions-type-income' : 'transactions-type-expense'}">${income ? 'Ingreso' : 'Gasto'}</span>
          <h3>${escapeHtml(transaction.descripcion)}</h3>
        </div>
        <p class="transaction-card-amount ${income ? 'transactions-income-text' : 'transactions-expense-text'}">${income ? '+' : '−'}${escapeHtml(formatCurrency(transaction.monto))}</p>
      </div>
      <div class="transaction-card-meta"><span class="transactions-category-badge">${escapeHtml(transaction.categoria)}</span></div>
      <dl class="transaction-card-context">
        <div><dt>Cliente</dt><dd title="${escapeHtml(transaction.cliente)}">${escapeHtml(transaction.cliente)}</dd></div>
        <div><dt>Proyecto</dt><dd title="${escapeHtml(transaction.proyecto)}">${escapeHtml(transaction.proyecto)}</dd></div>
      </dl>
      <footer class="transaction-card-footer">
        <time class="transaction-card-date" datetime="${escapeHtml(transaction.fecha)}">${escapeHtml(formatDate(transaction.fecha))}</time>
        <button class="transactions-row-action" type="button" data-edit-transaction="${escapeHtml(transaction.id)}" aria-label="Editar ${escapeHtml(transaction.descripcion)}"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>
      </footer>`;
    card.querySelector('[data-edit-transaction]')?.addEventListener('click', (event) => openDrawer(event.currentTarget, transaction.id));
    return card;
  }

  function getResultCountText(count) {
    const period = formatPeriod(state.filters.month);
    if (count === 0) return `Sin movimientos en ${period}`;
    return `${count} ${count === 1 ? 'movimiento' : 'movimientos'} en ${period}`;
  }

  function resolveCategory(categoryId) {
    if (categoryId === INCOME_CATEGORY_ID) return { label: 'Ingreso por factura', isExpense: false };
    const category = (state.data.categorias_gasto ?? []).find((item) => item.id === categoryId);
    return { label: category?.nombre_categoria || 'Sin categoría', isExpense: true };
  }

  function getCategoryName(transaction) {
    if (transaction.tipo === 'ingreso') return 'Ingreso por factura';
    if (transaction.categoria_mock_auxiliar) return transaction.categoria_mock_auxiliar;
    return resolveCategory(transaction.categoria_gasto_id).label;
  }

  function getClientName(clientId) {
    if (!clientId) return 'Sin cliente';
    return (state.data.clientes ?? []).find((client) => client.id === clientId)?.nombre_razon_social || 'Cliente no disponible';
  }

  function getProjectName(projectId) {
    if (!projectId) return 'Sin proyecto';
    return (state.data.proyectos ?? []).find((project) => project.id === projectId)?.nombre_proyecto || 'Proyecto no disponible';
  }

  function getAccountName(accountId) {
    if (!accountId) return 'Sin cuenta';
    return (state.data.cuentas_mock_auxiliar ?? []).find((account) => account.id === accountId)?.nombre_cuenta || 'Cuenta no disponible';
  }

  function setCheckedType(type) {
    document.querySelectorAll('input[name="tipo"]').forEach((input) => { input.checked = input.value === type; });
  }

  function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
  }

  function hideLoading() {
    const loading = document.getElementById('transactions-loading');
    if (loading) loading.hidden = true;
  }

  function showDataError(message) {
    const alert = document.getElementById('transactions-data-error');
    if (!alert) return;
    alert.hidden = false;
    alert.textContent = message;
  }

  function showToast(message) {
    const toast = document.getElementById('transaction-toast');
    if (!toast) return;
    const text = toast.querySelector('span');
    if (text) text.textContent = message;
    toast.hidden = false;
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4200);
  }

  function formatCurrency(value) {
    return currencyFormatter.format(Number(value || 0));
  }

  function formatDate(value) {
    return dateFormatter.format(new Date(`${value}T00:00:00`));
  }

  function formatPeriod(value) {
    const [year, month] = String(value || DEFAULT_PERIOD).split('-').map(Number);
    const formatted = periodFormatter.format(new Date(year, month - 1, 1));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  function getLocalDate() {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 10);
  }

  function getValue(id) {
    return document.getElementById(id)?.value?.trim() || '';
  }

  function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value ?? '';
  }

  function updateText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}());
