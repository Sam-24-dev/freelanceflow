/* FreelanceFlow dashboard rendering with local prototype data. */

const MOCK_DATA_URL = './assets/data/mock-data.json';
const TRANSACTIONS_STORAGE_KEY = 'freelanceflow_transactions_mock';
const MONTHLY_INCOME_GOAL = 2000;
const DEFAULT_PERIOD = '2026-06';
const DASHBOARD_REFERENCE_DATE = new Date('2026-06-20T12:00:00');
const dashboardModel = globalThis.FreelanceFlowDashboardModel ?? {};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD'
});

const compactDateFormatter = new Intl.DateTimeFormat('es-EC', {
  day: '2-digit',
  month: 'short'
});

const periodFormatter = new Intl.DateTimeFormat('es-EC', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
});

let dashboardData = null;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    dashboardData = await loadMockData();
    setupPeriodFilter();
    applyPeriodFromUrl();
    renderSelectedPeriod();
  } catch (error) {
    showLoadingError(error);
  }
});

async function loadMockData() {
  return window.FreelanceFlowDataLoader.loadJson(MOCK_DATA_URL);
}

function setupPeriodFilter() {
  document.getElementById('dashboard-period')?.addEventListener('change', () => {
    syncPeriodToUrl();
    renderSelectedPeriod();
  });
  window.addEventListener('popstate', () => {
    applyPeriodFromUrl();
    renderSelectedPeriod();
  });
}

function renderSelectedPeriod() {
  if (!dashboardData) return;

  const selectedMonth = getValue('dashboard-period') || DEFAULT_PERIOD;
  const movements = getPersistedMovements(dashboardData)
    .filter((movement) => movement.fecha?.startsWith(selectedMonth));
  const invoices = dashboardData.facturas ?? [];
  const clients = dashboardData.clientes ?? [];
  const projects = dashboardData.proyectos ?? [];

  const totalIncome = sumByType(movements, 'ingreso');
  const totalExpenses = sumByType(movements, 'gasto');
  const netCashFlow = totalIncome - totalExpenses;
  const pendingBalance = invoices.reduce(
    (total, invoice) => total + Number(invoice.saldo_pendiente || 0),
    0
  );
  const pendingInvoices = invoices.filter(
    (invoice) => Number(invoice.saldo_pendiente || 0) > 0 && invoice.estado !== 'VOID'
  );

  updateText('period-label', formatPeriod(selectedMonth));
  updateText('mobile-home-month', formatPeriod(selectedMonth));
  updateText('dashboard-context-label', `Vista consolidada de ${formatPeriod(selectedMonth)}`);
  updateText('income-total', formatCurrency(totalIncome));
  updateText('mobile-income-total', formatCurrency(totalIncome));
  updateText('expenses-total', formatCurrency(totalExpenses));
  updateText('mobile-expenses-total', formatCurrency(totalExpenses));
  updateText('cash-flow-total', formatCurrency(netCashFlow));
  updateText('mobile-cash-flow-total', formatCurrency(netCashFlow));
  updateText('pending-total', formatCurrency(pendingBalance));
  updateText('cash-flow-status', netCashFlow >= 0 ? 'Flujo positivo en el período.' : 'Los gastos superan los ingresos.');
  updateText('mobile-cash-flow-copy', netCashFlow >= 0 ? 'Tu flujo es positivo este mes.' : 'Tus gastos superan los ingresos del período.');
  updateText('health-message', buildHealthMessage(netCashFlow, pendingBalance, pendingInvoices.length));
  updateMobileFlowSignal(totalIncome, totalExpenses);
  renderMobileInvoiceAlert(invoices);

  const activeClients = clients.filter((client) => client.estado !== 'inactivo');
  updateText('client-count', String(activeClients.length));
  updateText('mobile-client-count', String(activeClients.length));
  updateText('project-count', String(projects.length));
  updateText('mobile-project-count', String(projects.length));
  updateText('invoice-count', String(invoices.length));
  updateText('mobile-invoice-count', String(invoices.length));

  const fullName = dashboardData.usuario?.nombre_completo ?? 'Freelancer';
  updateText('greeting-label', getGreeting());
  updateText('mobile-home-greeting', getGreeting());
  updateText('user-name', fullName.split(' ')[0]);
  updateText('mobile-home-user', fullName.split(' ')[0]);
  updateText('sidebar-user-name', fullName);

  renderTransactions(movements, dashboardData);
  renderMobileHomeTransactions(movements, dashboardData);
  renderIncomeGoal(totalIncome);
  renderInvoicesDue(invoices, clients);
  renderClientRevenue(movements, clients, projects);
}

function getPersistedMovements(data) {
  const stored = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
  if (!stored) return data.movimientos_financieros_mock_auxiliar ?? [];

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : data.movimientos_financieros_mock_auxiliar ?? [];
  } catch (error) {
    console.warn('No se pudo leer la persistencia simulada de movimientos.', error);
    return data.movimientos_financieros_mock_auxiliar ?? [];
  }
}

function applyPeriodFromUrl() {
  const select = document.getElementById('dashboard-period');
  if (!select) return;
  const requestedPeriod = new URLSearchParams(window.location.search).get('period');
  const hasRequestedPeriod = [...select.options].some((option) => option.value === requestedPeriod);
  select.value = hasRequestedPeriod ? requestedPeriod : DEFAULT_PERIOD;
}

function syncPeriodToUrl() {
  const selectedPeriod = getValue('dashboard-period') || DEFAULT_PERIOD;
  const url = new URL(window.location.href);
  if (selectedPeriod === DEFAULT_PERIOD) url.searchParams.delete('period');
  else url.searchParams.set('period', selectedPeriod);
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function buildHealthMessage(netCashFlow, pendingBalance, pendingInvoiceCount) {
  if (netCashFlow < 0) {
    return 'Tus gastos superan los ingresos del período. Revisa los movimientos y ajusta las próximas salidas.';
  }
  if (pendingBalance > 0) {
    const invoiceLabel = pendingInvoiceCount === 1 ? 'factura pendiente' : 'facturas pendientes';
    return `Tu flujo es positivo. Aún tienes ${formatCurrency(pendingBalance)} por cobrar en ${pendingInvoiceCount} ${invoiceLabel}.`;
  }
  return 'Tu flujo es positivo y no tienes cobros pendientes. Mantén el registro al día.';
}

function renderTransactions(movements, data) {
  const tableBody = document.getElementById('transactions-table-body');
  const mobileList = document.getElementById('transactions-mobile-list');
  const emptyState = document.getElementById('transactions-empty-state');
  if (!tableBody || !mobileList || !emptyState) return;

  tableBody.innerHTML = '';
  mobileList.innerHTML = '';

  const sorted = createTransactionPreviews(movements).desktop;

  emptyState.classList.toggle('hidden', sorted.length !== 0);

  sorted.forEach((movement) => {
    tableBody.appendChild(createTransactionRow(movement, data));
    mobileList.appendChild(createTransactionCard(movement, data));
  });
}

function renderMobileHomeTransactions(movements, data) {
  const list = document.getElementById('mobile-home-transactions');
  const emptyState = document.getElementById('mobile-home-transactions-empty');
  if (!list || !emptyState) return;

  const mobileMovements = createTransactionPreviews(movements).mobile;
  list.innerHTML = '';
  emptyState.classList.toggle('hidden', mobileMovements.length !== 0);

  mobileMovements.forEach((movement) => {
    list.appendChild(createMobileHomeTransactionItem(movement, data));
  });
}

function createMobileHomeTransactionItem(movement, data) {
  const item = document.createElement('article');
  const isIncome = movement.tipo === 'ingreso';
  const clientName = findClientName(data.clientes, movement.cliente_id);
  const projectName = findProjectName(data.proyectos, movement.proyecto_id);

  item.className = 'mobile-home-transaction-item';
  item.innerHTML = `
    <span class="mobile-home-transaction-dot ${isIncome ? 'is-income' : 'is-expense'}" aria-hidden="true"></span>
    <div class="min-w-0">
      <h3>${escapeHtml(movement.descripcion)}</h3>
      <p>${escapeHtml(clientName)} · ${escapeHtml(projectName)}</p>
      <small>${formatDate(movement.fecha)}</small>
    </div>
    <strong class="${isIncome ? 'is-income' : 'is-expense'}">${isIncome ? '+' : '-'}${formatCurrency(movement.monto)}</strong>
  `;
  return item;
}

function createTransactionPreviews(movements) {
  if (typeof dashboardModel.createDashboardTransactionPreviews === 'function') {
    return dashboardModel.createDashboardTransactionPreviews(movements);
  }

  const sorted = [...movements].sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  return {
    desktop: sorted.slice(0, 5),
    mobile: sorted.slice(0, 3)
  };
}

function renderMobileInvoiceAlert(invoices) {
  const alertLink = document.getElementById('mobile-invoice-alert');
  const label = document.getElementById('mobile-invoice-alert-label');
  const amount = document.getElementById('mobile-invoice-alert-amount');
  if (!alertLink || !label || !amount) return;

  const alert = typeof dashboardModel.buildMobileInvoiceAlert === 'function'
    ? dashboardModel.buildMobileInvoiceAlert(invoices)
    : buildFallbackInvoiceAlert(invoices);

  alertLink.dataset.state = alert.kind;
  if (alert.kind === 'overdue') {
    label.textContent = `${alert.count} ${alert.count === 1 ? 'factura vencida' : 'facturas vencidas'}`;
  } else if (alert.kind === 'pending') {
    label.textContent = `${alert.count} ${alert.count === 1 ? 'factura por cobrar' : 'facturas por cobrar'}`;
  } else {
    label.textContent = 'Sin facturas pendientes';
  }
  amount.textContent = formatCurrency(alert.amount);
}

function buildFallbackInvoiceAlert(invoices = []) {
  const pending = invoices.filter((invoice) => Number(invoice.saldo_pendiente || 0) > 0 && invoice.estado !== 'VOID');
  const overdue = pending.filter((invoice) => invoice.estado === 'OVERDUE');
  return {
    kind: overdue.length ? 'overdue' : (pending.length ? 'pending' : 'clear'),
    count: overdue.length || pending.length,
    amount: pending.reduce((total, invoice) => total + Number(invoice.saldo_pendiente || 0), 0)
  };
}

function updateMobileFlowSignal(totalIncome, totalExpenses) {
  const incomeSignal = document.getElementById('mobile-flow-income-signal');
  const expenseSignal = document.getElementById('mobile-flow-expense-signal');
  if (!incomeSignal || !expenseSignal) return;

  const maxValue = Math.max(totalIncome, totalExpenses, 1);
  incomeSignal.style.width = `${Math.max((totalIncome / maxValue) * 100, 6)}%`;
  expenseSignal.style.width = `${Math.max((totalExpenses / maxValue) * 100, totalExpenses > 0 ? 6 : 0)}%`;
}

function createTransactionRow(movement, data) {
  const row = document.createElement('tr');
  const isIncome = movement.tipo === 'ingreso';
  const clientName = findClientName(data.clientes, movement.cliente_id);
  const projectName = findProjectName(data.proyectos, movement.proyecto_id);

  row.className = 'transition-colors hover:bg-amber-50/60';
  row.innerHTML = `
    <td class="px-6 py-4 text-sm font-bold text-slate-600">${formatDate(movement.fecha)}</td>
    <td class="px-4 py-4">
      <div class="flex items-start gap-3">
        <span class="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isIncome ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}" aria-hidden="true">${isIncome ? '↗' : '↘'}</span>
        <div class="min-w-0"><p class="text-sm font-black leading-5 text-slate-950">${escapeHtml(movement.descripcion)}</p><p class="mt-1 text-xs font-semibold text-slate-600">${isIncome ? 'Ingreso recibido' : 'Gasto registrado'}</p></div>
      </div>
    </td>
    <td class="px-4 py-4"><p class="text-sm font-bold leading-5 text-slate-800">${escapeHtml(clientName)}</p><p class="mt-1 text-xs font-semibold leading-4 text-slate-600">${escapeHtml(projectName)}</p></td>
    <td class="px-6 py-4 text-right text-sm font-black ${isIncome ? 'text-green-700' : 'text-red-700'}">${isIncome ? '+' : '-'}${formatCurrency(movement.monto)}</td>
  `;
  return row;
}

function createTransactionCard(movement, data) {
  const card = document.createElement('article');
  const isIncome = movement.tipo === 'ingreso';
  const clientName = findClientName(data.clientes, movement.cliente_id);
  const projectName = findProjectName(data.proyectos, movement.proyecto_id);

  card.className = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
  card.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0"><p class="text-xs font-black uppercase tracking-[0.14em] text-slate-600">${formatDate(movement.fecha)} · ${isIncome ? 'Ingreso' : 'Gasto'}</p><h3 class="mt-1 truncate font-black text-slate-950">${escapeHtml(movement.descripcion)}</h3></div>
      <p class="shrink-0 text-lg font-black ${isIncome ? 'text-green-700' : 'text-red-700'}">${isIncome ? '+' : '-'}${formatCurrency(movement.monto)}</p>
    </div>
    <div class="mt-3 border-t border-slate-100 pt-3"><p class="text-sm font-bold text-slate-800">${escapeHtml(clientName)}</p><p class="mt-1 text-xs font-semibold text-slate-600">${escapeHtml(projectName)}</p></div>
  `;
  return card;
}

function renderIncomeGoal(totalIncome) {
  const percent = Math.min(Math.round((totalIncome / MONTHLY_INCOME_GOAL) * 100), 100);
  const circumference = 163.36;
  const offset = circumference - (circumference * percent) / 100;

  updateText('income-goal-current', formatCurrency(totalIncome));
  updateText('income-goal-target', formatCurrency(MONTHLY_INCOME_GOAL));
  updateText('income-goal-percent', `${percent}%`);
  updateText(
    'income-goal-message',
    percent >= 100
      ? 'Meta alcanzada. Excelente cierre de período.'
      : `Te faltan ${formatCurrency(Math.max(MONTHLY_INCOME_GOAL - totalIncome, 0))} para alcanzar tu meta.`
  );

  const bar = document.getElementById('income-goal-bar');
  if (bar) {
    bar.style.width = `${percent}%`;
    bar.setAttribute('aria-valuenow', String(percent));
  }

  const ring = document.getElementById('income-goal-ring');
  if (ring) ring.setAttribute('stroke-dashoffset', String(offset));
}

function renderInvoicesDue(invoices, clients) {
  const list = document.getElementById('invoices-due-list');
  const emptyState = document.getElementById('invoices-due-empty');
  if (!list || !emptyState) return;

  const pending = invoices
    .filter((invoice) => Number(invoice.saldo_pendiente || 0) > 0 && invoice.estado !== 'VOID')
    .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))
    .slice(0, 3);

  list.innerHTML = '';
  emptyState.classList.toggle('hidden', pending.length !== 0);

  pending.forEach((invoice) => {
    const isOverdue = invoice.estado === 'OVERDUE' || new Date(`${invoice.fecha_vencimiento}T12:00:00`) < DASHBOARD_REFERENCE_DATE;
    const item = document.createElement('article');
    item.className = 'rounded-2xl border border-slate-200 bg-[#FBF7F1] p-4';
    item.innerHTML = `
      <div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="truncate text-sm font-black text-slate-950">${escapeHtml(findClientName(clients, invoice.cliente_id))}</p><p class="mt-1 text-xs font-semibold text-slate-600">${escapeHtml(invoice.numero_factura)}</p></div><p class="text-sm font-black text-slate-950">${formatCurrency(invoice.saldo_pendiente)}</p></div>
      <p class="mt-3 text-xs font-black ${isOverdue ? 'text-red-700' : 'text-amber-700'}">${isOverdue ? 'Vencida' : 'Vence'} · ${formatDate(invoice.fecha_vencimiento)}</p>
    `;
    list.appendChild(item);
  });
}

function renderClientRevenue(movements, clients, projects) {
  const list = document.getElementById('client-revenue-list');
  if (!list) return;

  const revenue = clients.map((client) => {
    const total = movements
      .filter((movement) => movement.tipo === 'ingreso' && movement.cliente_id === client.id)
      .reduce((sum, movement) => sum + Number(movement.monto || 0), 0);
    const projectCount = projects.filter((project) => project.cliente_id === client.id).length;
    return { client, total, projectCount };
  }).sort((a, b) => b.total - a.total);

  const maxRevenue = Math.max(...revenue.map((item) => item.total), 1);
  list.innerHTML = '';

  if (revenue.length === 0) {
    list.innerHTML = '<p class="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center text-sm font-semibold text-slate-600 md:col-span-2">Agrega clientes para analizar la concentración de ingresos.</p>';
    return;
  }

  revenue.forEach(({ client, total, projectCount }) => {
    const percent = Math.round((total / maxRevenue) * 100);
    const card = document.createElement('article');
    card.className = 'rounded-2xl border border-slate-200 bg-[#FBF7F1] p-5';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4"><div class="min-w-0"><h3 class="truncate font-black text-slate-950">${escapeHtml(client.nombre_razon_social)}</h3><p class="mt-1 text-xs font-semibold text-slate-600">${projectCount === 1 ? '1 proyecto vinculado' : `${projectCount} proyectos vinculados`}</p></div><p class="shrink-0 text-xl font-black text-slate-950">${formatCurrency(total)}</p></div>
      <div class="mt-5 h-2 overflow-hidden rounded-full bg-slate-200"><div class="h-full rounded-full ${total > 0 ? 'bg-teal-500' : 'bg-slate-300'}" style="width:${total > 0 ? Math.max(percent, 4) : 0}%"></div></div>
      <p class="mt-2 text-xs font-semibold text-slate-600">${total > 0 ? `${percent}% del cliente con mayor ingreso` : 'Sin ingresos en este período'}</p>
    `;
    list.appendChild(card);
  });
}

function sumByType(movements, type) {
  return movements
    .filter((movement) => movement.tipo === type)
    .reduce((total, movement) => total + Number(movement.monto || 0), 0);
}

function findClientName(clients = [], clientId) {
  if (!clientId) return 'Sin cliente asociado';
  return clients.find((client) => client.id === clientId)?.nombre_razon_social ?? 'Cliente no encontrado';
}

function findProjectName(projects = [], projectId) {
  if (!projectId) return 'Sin proyecto asociado';
  return projects.find((project) => project.id === projectId)?.nombre_proyecto ?? 'Proyecto no encontrado';
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDate(dateValue) {
  return compactDateFormatter.format(new Date(`${dateValue}T00:00:00`)).replace('.', '');
}

function formatPeriod(monthValue) {
  const formatted = periodFormatter.format(new Date(`${monthValue}-01T00:00:00Z`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getValue(id) {
  return document.getElementById(id)?.value.trim() ?? '';
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

function showLoadingError(error) {
  console.error(error);
  const alertBox = document.getElementById('data-error');
  if (!alertBox) return;
  alertBox.classList.remove('hidden');
  alertBox.textContent = 'No pudimos cargar tu información. Actualiza la página o inténtalo nuevamente en unos minutos.';
}
