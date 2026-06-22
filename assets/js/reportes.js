/* FreelanceFlow — Presupuestos y Reportes, frontend estático. */

(function reportsApp() {
  'use strict';

  const DATA_URL = './assets/data/mock-data.json';
  const STORAGE_KEY = 'freelanceflow_budgets_v1';
  const DEFAULT_PERIOD = '2026-06';
  const model = window.FreelanceFlowReportModel;

  const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });
  const monthFormatter = new Intl.DateTimeFormat('es-EC', { month: 'long', year: 'numeric' });

  const reportMeta = {
    income: { title: 'Ingresos', description: 'Cobros recibidos agrupados por cliente.' },
    expenses: { title: 'Gastos', description: 'Gasto real agrupado por categoría.' },
    cashflow: { title: 'Flujo de caja', description: 'Entradas, salidas y saldo acumulado del período.' },
    profitability: { title: 'Rentabilidad', description: 'Resultado facturado por proyecto, con gastos y horas.' },
    pnl: { title: 'Pérdidas y ganancias', description: 'Ingresos, gastos y resultado neto del período.' },
    receivables: { title: 'Cuentas por cobrar', description: 'Facturas con saldo pendiente y vencimiento.' }
  };

  const state = {
    data: {},
    budgets: [],
    budget: null,
    filters: { period: DEFAULT_PERIOD, clientId: '', projectId: '', dateFrom: '', dateTo: '' },
    activeReport: 'income',
    activePanel: null,
    previousFocus: null,
    formDirty: false,
    toastTimer: null
  };

  document.addEventListener('DOMContentLoaded', initialize);

  async function initialize() {
    if (!model) {
      showFatalError();
      return;
    }
    try {
      state.data = await loadData();
      state.budgets = loadBudgets(state.data.presupuestos ?? []);
      readInitialFilters();
      populateSelectors();
      bindEvents();
      selectBudget();
      renderAll();
      hideLoading();
    } catch (error) {
      console.error(error);
      showFatalError();
    }
  }

  async function loadData() {
    return window.FreelanceFlowDataLoader.loadJson(DATA_URL);
  }

  function loadBudgets(baseBudgets) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return model.mergeBudgets(baseBudgets, Array.isArray(stored) ? stored : []);
    } catch (error) {
      console.warn('Se descartó un presupuesto local inválido.', error);
      localStorage.removeItem(STORAGE_KEY);
      return model.mergeBudgets(baseBudgets, []);
    }
  }

  function readInitialFilters() {
    const params = new URLSearchParams(window.location.search);
    state.filters.period = /^\d{4}-\d{2}$/.test(params.get('period') || '') ? params.get('period') : DEFAULT_PERIOD;
    state.filters.clientId = params.get('client') || '';
    state.filters.projectId = params.get('project') || '';
    const requestedFrom = params.get('from') || '';
    const requestedTo = params.get('to') || '';
    if (model.validateDateRange(requestedFrom, requestedTo).valid) {
      state.filters.dateFrom = requestedFrom;
      state.filters.dateTo = requestedTo;
    }
    state.activeReport = model.REPORT_TYPES.includes(params.get('report')) ? params.get('report') : 'income';
    setValue('reports-period', state.filters.period);
  }

  function populateSelectors() {
    ['reports-client', 'report-drawer-client'].forEach((id) => populateSelect(id, state.data.clientes ?? [], 'id', 'nombre_razon_social'));
    setValue('reports-client', state.filters.clientId);
    setValue('report-drawer-client', state.filters.clientId);
    updateProjectSelectors();
  }

  function populateSelect(id, items, valueKey, labelKey) {
    const select = document.getElementById(id);
    if (!select) return;
    const existing = new Set([...select.options].map((option) => option.value));
    items.forEach((item) => {
      if (existing.has(String(item[valueKey]))) return;
      const option = document.createElement('option');
      option.value = item[valueKey];
      option.textContent = item[labelKey];
      select.appendChild(option);
    });
  }

  function updateProjectSelectors() {
    const projects = (state.data.proyectos ?? []).filter((project) => !state.filters.clientId || project.cliente_id === state.filters.clientId);
    if (state.filters.projectId && !projects.some((project) => project.id === state.filters.projectId)) state.filters.projectId = '';
    populateProjectSelect('reports-project', state.filters.clientId, state.filters.projectId);
    populateProjectSelect('report-drawer-project', state.filters.clientId, state.filters.projectId);
  }

  function populateProjectSelect(id, clientId, selectedValue = '') {
    const select = document.getElementById(id);
    if (!select) return;
    const projects = (state.data.proyectos ?? []).filter((project) => !clientId || project.cliente_id === clientId);
    select.innerHTML = '<option value="">Todos los proyectos</option>';
    populateSelect(id, projects, 'id', 'nombre_proyecto');
    select.value = projects.some((project) => project.id === selectedValue) ? selectedValue : '';
  }

  function bindEvents() {
    document.getElementById('reports-period')?.addEventListener('change', (event) => {
      state.filters.period = event.target.value || DEFAULT_PERIOD;
      state.filters.dateFrom = '';
      state.filters.dateTo = '';
      selectBudget();
      updateUrl();
      renderAll();
    });
    document.getElementById('reports-client')?.addEventListener('change', (event) => {
      state.filters.clientId = event.target.value;
      state.filters.projectId = '';
      updateProjectSelectors();
      syncDrawerFilters();
      updateUrl();
      renderAll();
    });
    document.getElementById('reports-project')?.addEventListener('change', (event) => {
      state.filters.projectId = event.target.value;
      syncDrawerFilters();
      updateUrl();
      renderAll();
    });
    document.getElementById('reports-clear-filters')?.addEventListener('click', clearScopeFilters);
    document.querySelectorAll('[data-clear-report-filters]').forEach((button) => button.addEventListener('click', clearScopeFilters));
    document.querySelectorAll('.report-access-card').forEach((button) => button.addEventListener('click', () => {
      state.activeReport = button.dataset.reportType;
      updateUrl();
      renderReport();
      document.getElementById('report-preview-title')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }));
    document.querySelectorAll('#report-export, #report-preview-export').forEach((button) => button.addEventListener('click', exportActiveReport));
    document.getElementById('reports-retry')?.addEventListener('click', () => window.location.reload());
    bindPanels();
    bindBudgetForm();
    bindReportFilterForm();
  }

  function bindPanels() {
    document.getElementById('budget-open')?.addEventListener('click', (event) => openBudgetPanel(event.currentTarget));
    document.querySelectorAll('[data-open-budget]').forEach((button) => button.addEventListener('click', (event) => openBudgetPanel(event.currentTarget)));
    document.getElementById('budget-close')?.addEventListener('click', requestClosePanel);
    document.getElementById('budget-cancel')?.addEventListener('click', requestClosePanel);
    document.getElementById('report-filter-open')?.addEventListener('click', (event) => openFilterPanel(event.currentTarget));
    document.getElementById('report-filter-close')?.addEventListener('click', requestClosePanel);
    document.getElementById('reports-panel-backdrop')?.addEventListener('click', requestClosePanel);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.activePanel) requestClosePanel();
      if (event.key === 'Tab' && state.activePanel) trapFocus(event, state.activePanel);
    });
    window.addEventListener('beforeunload', (event) => {
      if (!state.formDirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  }

  function bindBudgetForm() {
    document.getElementById('budget-add-limit')?.addEventListener('click', () => {
      addLimitRow();
      state.formDirty = true;
    });
    document.getElementById('budget-limit-rows')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-remove-limit]');
      if (!button) return;
      button.closest('.budget-limit-row')?.remove();
      state.formDirty = true;
    });
    document.getElementById('budget-form')?.addEventListener('input', () => { state.formDirty = true; clearBudgetErrors(); });
    document.getElementById('budget-form')?.addEventListener('change', () => { state.formDirty = true; clearBudgetErrors(); });
    document.getElementById('budget-form')?.addEventListener('submit', handleBudgetSubmit);
  }

  function bindReportFilterForm() {
    document.getElementById('report-drawer-client')?.addEventListener('change', (event) => {
      populateProjectSelect('report-drawer-project', event.target.value, '');
    });
    document.getElementById('report-filter-form')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const from = valueOf('report-date-from');
      const to = valueOf('report-date-to');
      const validation = model.validateDateRange(from, to);
      const error = document.getElementById('report-date-error');
      if (!validation.valid) {
        error.textContent = validation.message;
        document.getElementById('report-date-from')?.focus();
        return;
      }
      error.textContent = '';
      state.filters.dateFrom = from;
      state.filters.dateTo = to;
      state.filters.clientId = valueOf('report-drawer-client');
      state.filters.projectId = valueOf('report-drawer-project');
      setValue('reports-client', state.filters.clientId);
      updateProjectSelectors();
      setValue('reports-project', state.filters.projectId);
      updateUrl();
      closePanel();
      renderAll();
      showToast('Filtros aplicados correctamente.');
    });
    document.getElementById('report-filter-reset')?.addEventListener('click', () => {
      const range = model.getDateRange({ period: state.filters.period });
      setValue('report-date-from', range.from);
      setValue('report-date-to', range.to);
      setValue('report-drawer-client', '');
      populateProjectSelect('report-drawer-project', '', '');
      document.getElementById('report-date-error').textContent = '';
    });
  }

  function selectBudget() {
    state.budget = state.budgets.find((budget) => budget.periodo === 'Mensual' && budget.periodo_clave === state.filters.period) ?? null;
  }

  function renderAll() {
    renderFilterSummary();
    renderSummary();
    renderBudget();
    renderReportNavigation();
    renderReport();
  }

  function renderSummary() {
    const summary = model.calculateFinancialSummary(state.data, state.budget ?? {}, state.filters);
    setText('metric-income-goal', state.budget ? money.format(summary.incomeGoal) : 'Sin meta');
    setText('metric-real-income', money.format(summary.realIncome));
    setText('metric-budgeted-expenses', state.budget ? money.format(summary.budgetedExpenses) : 'Sin presupuesto');
    setText('metric-real-expenses', money.format(summary.realExpenses));
    setText('metric-net-flow', money.format(summary.netFlow));
    setText('metric-income-progress', summary.incomeProgress === null ? 'Sin meta' : `${formatPercent(summary.incomeProgress)}%`);
    setText('metric-expense-progress', summary.expenseProgress === null ? 'Sin límite' : `${formatPercent(summary.expenseProgress)}%`);
    setText('metric-net-status', summary.netFlow >= 0 ? 'Positivo' : 'Negativo');
    setText('metric-net-copy', summary.netFlow >= 0 ? 'Tus ingresos cubren los gastos del período.' : 'Los gastos superan los ingresos del período.');
    setText('metric-income-goal-copy', state.budget ? 'Plan definido para el período.' : 'Define una meta para medir tu avance.');
    setProgress('metric-income-progress-bar', summary.incomeProgress);
    setProgress('metric-expense-progress-bar', summary.expenseProgress);
    document.querySelector('.reports-metric-net')?.classList.toggle('is-negative', summary.netFlow < 0);
    document.querySelector('.reports-metric-expense')?.classList.toggle('is-risk', (summary.expenseProgress ?? 0) > 100);
    document.querySelector('.reports-summary')?.setAttribute('aria-busy', 'false');
  }

  function renderBudget() {
    const rows = model.calculateBudgetRows(state.data, state.budget ?? {}, state.filters);
    const table = document.getElementById('budget-table-wrap');
    const empty = document.getElementById('budget-empty');
    const mobile = document.getElementById('budget-mobile-cards');
    table.hidden = rows.length === 0;
    mobile.hidden = rows.length === 0;
    empty.hidden = rows.length > 0;
    document.getElementById('budget-table-body').innerHTML = rows.map(renderBudgetTableRow).join('');
    mobile.innerHTML = rows.map(renderBudgetCard).join('');
  }

  function renderBudgetTableRow(row) {
    const status = budgetStatus(row);
    const difference = row.available >= 0 ? money.format(row.available) : `-${money.format(Math.abs(row.available))}`;
    return `<tr>
      <th scope="row"><span class="budget-category-dot is-${status.tone}" aria-hidden="true"></span>${escapeHtml(row.categoryName)}</th>
      <td>${money.format(row.budgeted)}</td><td>${money.format(row.spent)}</td>
      <td class="budget-value-${status.tone}">${difference}</td><td>${formatPercent(row.consumed)}%</td>
      <td><div class="budget-status"><span>${escapeHtml(status.label)}</span><div class="budget-progress is-${status.tone}" role="progressbar" aria-label="${escapeAttribute(status.label)}: ${escapeAttribute(formatPercent(row.consumed))}%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${escapeAttribute(row.visualProgress)}"><i style="width:${row.visualProgress}%"></i></div></div></td>
    </tr>`;
  }

  function renderBudgetCard(row) {
    const status = budgetStatus(row);
    const amountLabel = row.available >= 0 ? `${money.format(row.available)} disponibles` : `Excedido por ${money.format(Math.abs(row.available))}`;
    return `<article class="budget-mobile-card is-${status.tone}">
      <header><div><span class="budget-category-dot is-${status.tone}" aria-hidden="true"></span><strong>${escapeHtml(row.categoryName)}</strong></div><span class="budget-status-label">${escapeHtml(status.label)}</span></header>
      <div class="budget-mobile-values"><span><small>Ejecutado</small><strong>${money.format(row.spent)}</strong></span><span><small>Presupuestado</small><strong>${money.format(row.budgeted)}</strong></span></div>
      <div class="budget-progress is-${status.tone}" role="progressbar" aria-label="${escapeAttribute(status.label)}: ${escapeAttribute(formatPercent(row.consumed))}%" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${escapeAttribute(row.visualProgress)}"><i style="width:${row.visualProgress}%"></i></div>
      <p><strong>${formatPercent(row.consumed)}% consumido</strong><span>${escapeHtml(amountLabel)}</span></p>
    </article>`;
  }

  function budgetStatus(row) {
    const states = {
      available: { label: 'Disponible', tone: 'available' },
      near_limit: { label: 'Cerca del límite', tone: 'warning' },
      over_budget: { label: 'Excedido', tone: 'danger' },
      no_activity: { label: 'Sin movimientos', tone: 'neutral' },
      no_budget: { label: 'Sin presupuesto', tone: 'neutral' }
    };
    return states[row.status] ?? states.neutral;
  }

  function renderReportNavigation() {
    document.querySelectorAll('.report-access-card').forEach((button) => {
      const active = button.dataset.reportType === state.activeReport;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
  }

  function exportActiveReport() {
    const report = model.buildReport(state.activeReport, state.data, state.filters);
    if (!report.rows.length) {
      showToast('No hay datos para exportar. Ajusta los filtros e inténtalo nuevamente.');
      return;
    }

    const exported = model.buildReportCsvExport(report, {
      period: state.filters.period,
      dateFrom: state.filters.dateFrom,
      dateTo: state.filters.dateTo
    });
    const blob = new Blob(['\uFEFF', exported.content], { type: exported.mimeType });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = exported.filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    showToast(`Reporte descargado en CSV · ${exported.rowCount} ${exported.rowCount === 1 ? 'fila' : 'filas'}.`);
  }

  function renderReport() {
    renderReportNavigation();
    const meta = reportMeta[state.activeReport];
    const report = model.buildReport(state.activeReport, state.data, state.filters);
    setText('report-preview-title', meta.title);
    setText('report-preview-description', meta.description);
    setText('report-active-filters', filterSummaryCopy());
    const empty = document.getElementById('report-empty');
    const table = document.getElementById('report-table-container');
    const chart = document.getElementById('report-chart');
    empty.hidden = report.rows.length > 0;
    table.hidden = report.rows.length === 0;
    chart.hidden = report.rows.length === 0;
    table.innerHTML = report.rows.length ? buildReportTable(report) : '';
    chart.innerHTML = report.rows.length ? buildReportChart(report) : '';
  }

  function buildReportTable(report) {
    const configs = {
      income: { headers: ['Cliente', 'Ingresos', '% del total'], cells: (row) => [escapeHtml(row.clientName), money.format(row.amount), `${formatPercent(row.share)}%`] },
      expenses: { headers: ['Categoría', 'Gasto total', '% deducible'], cells: (row) => [escapeHtml(row.categoryName), money.format(row.amount), `${formatPercent(row.deductibleShare)}%`] },
      cashflow: { headers: ['Período', 'Ingresos', 'Gastos', 'Flujo neto', 'Acumulado'], cells: (row) => [escapeHtml(periodLabel(row.period)), money.format(row.income), money.format(row.expenses), money.format(row.net), money.format(row.accumulated)] },
      profitability: { headers: ['Proyecto', 'Facturado', 'Gastos', 'Horas', 'Resultado', 'Margen'], cells: (row) => [escapeHtml(row.projectName), money.format(row.invoiced), money.format(row.expenses), `${number.format(row.hours)} h`, money.format(row.profit), row.margin === null ? 'Sin datos' : `${formatPercent(row.margin)}%`] },
      pnl: { headers: ['Concepto', 'Tipo', 'Monto'], cells: (row) => [escapeHtml(row.label), pnlTypeLabel(row.type), money.format(row.amount)] },
      receivables: { headers: ['Cliente', 'Factura', 'Saldo pendiente', 'Días vencidos', 'Estado'], cells: (row) => [escapeHtml(row.clientName), `<a href="facturas.html?invoice=${encodeURIComponent(row.invoiceId)}">${escapeHtml(row.invoiceNumber)}</a>`, money.format(row.balance), row.overdueDays ? String(row.overdueDays) : 'Al día', invoiceStatus(row.status)] }
    };
    const config = configs[report.type];
    return `<table class="report-data-table"><caption class="sr-only">${escapeHtml(reportMeta[report.type].title)}</caption><thead><tr>${config.headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${report.rows.map((row) => `<tr>${config.cells(row).map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function buildReportChart(report) {
    const values = report.rows.map(reportRowValue);
    const max = Math.max(...values.map((value) => Math.abs(value)), 1);
    return `<div class="report-chart-header"><strong>Lectura rápida</strong><span>${report.rows.length} ${report.rows.length === 1 ? 'resultado' : 'resultados'}</span></div><div class="report-chart-bars">${report.rows.slice(0, 6).map((row, index) => {
      const width = Math.max(4, (Math.abs(values[index]) / max) * 100);
      return `<div><span>${escapeHtml(reportRowLabel(report.type, row))}</span><i><b style="width:${width}%"></b></i><strong>${money.format(values[index])}</strong></div>`;
    }).join('')}</div>`;
  }

  function reportRowValue(row) {
    return toNumber(row.amount ?? row.net ?? row.profit ?? row.balance ?? 0);
  }

  function reportRowLabel(type, row) {
    if (type === 'income') return row.clientName;
    if (type === 'expenses') return row.categoryName;
    if (type === 'cashflow') return periodLabel(row.period);
    if (type === 'profitability') return row.projectName;
    if (type === 'pnl') return row.label;
    return row.invoiceNumber;
  }

  function openBudgetPanel(trigger) {
    fillBudgetForm();
    openPanel(document.getElementById('budget-panel'), trigger);
  }

  function openFilterPanel(trigger) {
    syncDrawerFilters();
    setDefaultDates();
    openPanel(document.getElementById('report-filter-panel'), trigger);
  }

  function openPanel(panel, trigger) {
    if (!panel) return;
    state.activePanel = panel;
    state.previousFocus = trigger || document.activeElement;
    panel.removeAttribute('inert');
    panel.setAttribute('aria-hidden', 'false');
    panel.classList.add('is-open');
    document.getElementById('reports-panel-backdrop')?.classList.add('is-open');
    document.body.classList.add('reports-panel-open');
    document.querySelector('[data-app-layout]')?.setAttribute('inert', '');
    document.querySelector('.app-bottom-navigation')?.setAttribute('inert', '');
    requestAnimationFrame(() => panel.querySelector('button, input, select')?.focus());
  }

  function requestClosePanel() {
    if (state.activePanel?.id === 'budget-panel' && state.formDirty && !window.confirm('¿Descartar los cambios del presupuesto?')) return;
    closePanel();
  }

  function closePanel() {
    if (!state.activePanel) return;
    state.activePanel.classList.remove('is-open');
    state.activePanel.setAttribute('aria-hidden', 'true');
    state.activePanel.setAttribute('inert', '');
    document.getElementById('reports-panel-backdrop')?.classList.remove('is-open');
    document.body.classList.remove('reports-panel-open');
    document.querySelector('[data-app-layout]')?.removeAttribute('inert');
    document.querySelector('.app-bottom-navigation')?.removeAttribute('inert');
    state.activePanel = null;
    state.formDirty = false;
    state.previousFocus?.focus?.();
  }

  function trapFocus(event, panel) {
    const focusable = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href]')].filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function fillBudgetForm() {
    const budget = state.budget ?? { id: '', periodo: 'Mensual', periodo_clave: state.filters.period, meta_ingresos: '', meta_horas_facturables: '', limites_gasto_por_categoria: [] };
    setValue('budget-id', budget.id);
    setValue('budget-period-type', budget.periodo);
    setValue('budget-period-key', budget.periodo_clave || state.filters.period);
    setValue('budget-income-goal', budget.meta_ingresos || '');
    setValue('budget-hours-goal', budget.meta_horas_facturables ?? '');
    const container = document.getElementById('budget-limit-rows');
    container.innerHTML = '';
    (budget.limites_gasto_por_categoria ?? []).forEach((row) => addLimitRow(row));
    if (!(budget.limites_gasto_por_categoria ?? []).length) addLimitRow();
    clearBudgetErrors();
    state.formDirty = false;
  }

  function addLimitRow(row = {}) {
    const container = document.getElementById('budget-limit-rows');
    const index = container.children.length;
    const wrapper = document.createElement('div');
    wrapper.className = 'budget-limit-row';
    wrapper.innerHTML = `<label>Categoría <strong aria-hidden="true">*</strong><select name="categoria_id" autocomplete="off" required><option value="">Selecciona una categoría</option>${(state.data.categorias_gasto ?? []).map((category) => `<option value="${escapeAttribute(category.id)}"${category.id === row.categoria_id ? ' selected' : ''}>${escapeHtml(category.nombre_categoria)}</option>`).join('')}</select><small class="reports-field-error" data-row-error="categoria_id"></small></label><label>Límite <strong aria-hidden="true">*</strong><span class="reports-money-input"><span>$</span><input name="limite" type="number" min="0.01" step="0.01" inputmode="decimal" autocomplete="off" value="${escapeAttribute(row.limite ?? '')}" required></span><small class="reports-field-error" data-row-error="limite"></small></label><button class="reports-icon-button" type="button" data-remove-limit aria-label="Eliminar límite ${index + 1}"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m-9 0 1 14h10l1-14"/></svg></button>`;
    container.appendChild(wrapper);
  }

  function readBudgetForm() {
    return {
      id: valueOf('budget-id'),
      periodo: valueOf('budget-period-type'),
      periodo_clave: valueOf('budget-period-key'),
      meta_ingresos: valueOf('budget-income-goal'),
      meta_horas_facturables: valueOf('budget-hours-goal'),
      limites_gasto_por_categoria: [...document.querySelectorAll('.budget-limit-row')].map((row) => ({
        categoria_id: row.querySelector('[name="categoria_id"]')?.value || '',
        limite: row.querySelector('[name="limite"]')?.value || ''
      }))
    };
  }

  function handleBudgetSubmit(event) {
    event.preventDefault();
    const draft = readBudgetForm();
    const validation = model.validateBudget(draft, state.data.categorias_gasto ?? []);
    clearBudgetErrors();
    if (!validation.valid) {
      showBudgetErrors(validation);
      return;
    }
    const saved = { ...validation.value, id: draft.id || `budget_${validation.value.periodo_clave.replace('-', '_')}`, fecha_actualizacion: localDate() };
    state.budgets = model.mergeBudgets(state.budgets, [saved]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.budgets));
    state.filters.period = saved.periodo_clave;
    setValue('reports-period', state.filters.period);
    selectBudget();
    updateUrl();
    state.formDirty = false;
    closePanel();
    renderAll();
    showToast('Presupuesto guardado correctamente.');
  }

  function showBudgetErrors(validation) {
    Object.entries(validation.errors).forEach(([field, message]) => {
      const error = document.querySelector(`[data-budget-error="${field}"]`);
      const input = document.querySelector(`[name="${field}"]`);
      if (error) error.textContent = message;
      input?.setAttribute('aria-invalid', 'true');
    });
    validation.rowErrors.forEach((rowErrors, index) => {
      const row = document.querySelectorAll('.budget-limit-row')[index];
      Object.entries(rowErrors).forEach(([field, message]) => {
        const error = row?.querySelector(`[data-row-error="${field}"]`);
        const input = row?.querySelector(`[name="${field}"]`);
        if (error) error.textContent = message;
        input?.setAttribute('aria-invalid', 'true');
      });
    });
    const summary = document.getElementById('budget-form-summary');
    summary.hidden = false;
    summary.focus();
  }

  function clearBudgetErrors() {
    document.querySelectorAll('#budget-form [aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
    document.querySelectorAll('#budget-form .reports-field-error').forEach((error) => { error.textContent = ''; });
    const summary = document.getElementById('budget-form-summary');
    if (summary) summary.hidden = true;
  }

  function clearScopeFilters() {
    state.filters.clientId = '';
    state.filters.projectId = '';
    state.filters.dateFrom = '';
    state.filters.dateTo = '';
    syncMainFilters();
    updateUrl();
    renderAll();
  }

  function syncMainFilters() {
    setValue('reports-client', state.filters.clientId);
    updateProjectSelectors();
    setValue('reports-project', state.filters.projectId);
    syncDrawerFilters();
  }

  function syncDrawerFilters() {
    setValue('report-drawer-client', state.filters.clientId);
    populateProjectSelect('report-drawer-project', state.filters.clientId, state.filters.projectId);
  }

  function setDefaultDates() {
    const range = model.getDateRange(state.filters);
    setValue('report-date-from', state.filters.dateFrom || range.from);
    setValue('report-date-to', state.filters.dateTo || range.to);
  }

  function renderFilterSummary() {
    const copy = filterSummaryCopy();
    setText('reports-filter-summary', copy);
    setText('report-active-filters', copy);
    document.getElementById('reports-clear-filters').hidden = !state.filters.clientId && !state.filters.projectId && !state.filters.dateFrom;
  }

  function filterSummaryCopy() {
    const period = state.filters.dateFrom
      ? `${formatDate(state.filters.dateFrom)} – ${formatDate(state.filters.dateTo)}`
      : periodLabel(state.filters.period);
    const client = (state.data.clientes ?? []).find((item) => item.id === state.filters.clientId)?.nombre_razon_social || 'Todos los clientes';
    const project = (state.data.proyectos ?? []).find((item) => item.id === state.filters.projectId)?.nombre_proyecto || 'Todos los proyectos';
    return `${period} · ${client} · ${project}`;
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    if (state.filters.period !== DEFAULT_PERIOD) url.searchParams.set('period', state.filters.period); else url.searchParams.delete('period');
    if (state.filters.clientId) url.searchParams.set('client', state.filters.clientId); else url.searchParams.delete('client');
    if (state.filters.projectId) url.searchParams.set('project', state.filters.projectId); else url.searchParams.delete('project');
    if (state.filters.dateFrom && state.filters.dateTo) {
      url.searchParams.set('from', state.filters.dateFrom);
      url.searchParams.set('to', state.filters.dateTo);
    } else {
      url.searchParams.delete('from');
      url.searchParams.delete('to');
    }
    if (state.activeReport !== 'income') url.searchParams.set('report', state.activeReport); else url.searchParams.delete('report');
    window.history.replaceState({}, '', `${url.pathname}${url.search}`);
  }

  function hideLoading() {
    document.getElementById('reports-loading').hidden = true;
    document.getElementById('reports-error').hidden = true;
    document.getElementById('reports-content').hidden = false;
  }

  function showFatalError() {
    document.getElementById('reports-loading').hidden = true;
    document.getElementById('reports-content').hidden = true;
    document.getElementById('reports-error').hidden = false;
  }

  function showToast(message) {
    const toast = document.getElementById('reports-toast');
    clearTimeout(state.toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    state.toastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => { toast.hidden = true; }, 220);
    }, 3200);
  }

  function invoiceStatus(status) {
    const labels = { PARTIAL: 'Pago parcial', OVERDUE: 'Vencida', SENT: 'Enviada', PAID: 'Pagada', DRAFT: 'Borrador' };
    return `<span class="report-status-badge is-${escapeAttribute(String(status).toLowerCase())}">${escapeHtml(labels[status] || status)}</span>`;
  }

  function pnlTypeLabel(type) {
    const labels = { income: 'Ingreso', expense: 'Categoría de gasto', expense_total: 'Total', net: 'Resultado' };
    return escapeHtml(labels[type] || type);
  }

  function setProgress(id, value) {
    const element = document.getElementById(id);
    if (element) element.style.width = `${Math.min(100, Math.max(0, value ?? 0))}%`;
  }

  function periodLabel(period) {
    if (!/^\d{4}-\d{2}$/.test(period || '')) return 'Período no definido';
    const date = new Date(`${period}-01T00:00:00`);
    const label = monthFormatter.format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function formatDate(value) {
    if (!model.isValidDate(value)) return 'Fecha no válida';
    return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
  }

  function formatPercent(value) {
    return number.format(toNumber(value));
  }

  function localDate() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function valueOf(id) { return document.getElementById(id)?.value ?? ''; }
  function setValue(id, value) { const element = document.getElementById(id); if (element) element.value = value ?? ''; }
  function setText(id, value) { const element = document.getElementById(id); if (element) element.textContent = value; }
  function toNumber(value) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
  function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
}());
