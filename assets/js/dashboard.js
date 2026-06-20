/*
  FreelanceFlow - Dashboard Fase 1
  JavaScript puro: sin backend, sin APIs reales, sin React y sin base de datos.
  La información se carga desde assets/data/mock-data.json para simular el sistema.
*/

const MOCK_DATA_URL = './assets/data/mock-data.json';

const currencyFormatter = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD'
});

const dateFormatter = new Intl.DateTimeFormat('es-EC', {
  year: 'numeric',
  month: 'short',
  day: '2-digit'
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const data = await loadMockData();
    renderDashboard(data);
    populateMovementForm(data);
    setupMovementFormValidation();
  } catch (error) {
    showLoadingError(error);
  }
});

async function loadMockData() {
  const response = await fetch(MOCK_DATA_URL);

  if (!response.ok) {
    throw new Error(`No se pudo cargar el mock data: ${response.status}`);
  }

  return response.json();
}

function renderDashboard(data) {
  const movements = data.movimientos_financieros_mock_auxiliar ?? [];
  const invoices = data.facturas ?? [];

  const totalIncome = sumByType(movements, 'ingreso');
  const totalExpenses = sumByType(movements, 'gasto');
  const netCashFlow = totalIncome - totalExpenses;
  const pendingBalance = invoices.reduce((total, invoice) => total + Number(invoice.saldo_pendiente || 0), 0);

  updateText('income-total', formatCurrency(totalIncome));
  updateText('expenses-total', formatCurrency(totalExpenses));
  updateText('cash-flow-total', formatCurrency(netCashFlow));
  updateText('pending-total', formatCurrency(pendingBalance));
  updateText('client-count', String((data.clientes ?? []).filter((client) => client.estado !== 'inactivo').length));
  updateText('project-count', String((data.proyectos ?? []).length));
  updateText('invoice-count', String(invoices.length));
  updateText('user-name', data.usuario?.nombre_completo ?? 'Freelancer');

  renderTransactionsTable(movements, data);
  renderClientsList(data.clientes ?? [], data.proyectos ?? [], invoices);
  renderBudgetPreview(data.categorias_gasto ?? [], data.gastos ?? []);
}

function populateMovementForm(data) {
  populateSelect('movement-category', data.categorias_gasto ?? [], 'id', 'nombre_categoria');
  populateSelect('movement-account', data.cuentas_mock_auxiliar ?? [], 'id', 'nombre_cuenta');
}

function populateSelect(selectId, items, valueKey, labelKey) {
  const select = document.getElementById(selectId);
  if (!select) return;

  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item[valueKey];
    option.textContent = item[labelKey];
    select.appendChild(option);
  });
}

function setupMovementFormValidation() {
  const form = document.getElementById('movement-form');
  const message = document.getElementById('movement-form-message');

  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const type = document.getElementById('movement-type')?.value.trim();
    const amount = Number(document.getElementById('movement-amount')?.value);
    const category = document.getElementById('movement-category')?.value.trim();
    const date = document.getElementById('movement-date')?.value;

    if (!type) {
      showMovementFormMessage('Debes seleccionar si el movimiento es Ingreso o Gasto.', 'error');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      showMovementFormMessage('El monto debe ser un número mayor a cero.', 'error');
      return;
    }

    if (!category) {
      showMovementFormMessage('Debes seleccionar una categoría.', 'error');
      return;
    }

    if (!isValidDateInput(date)) {
      showMovementFormMessage('Debes ingresar una fecha válida.', 'error');
      return;
    }

    showMovementFormMessage('Transacción guardada exitosamente.', 'success');
    form.reset();
  });

  function showMovementFormMessage(text, type) {
    if (!message) {
      alert(text);
      return;
    }

    message.textContent = text;
    message.classList.remove(
      'hidden',
      'border',
      'border-green-200',
      'border-red-200',
      'bg-green-50',
      'bg-red-50',
      'text-green-800',
      'text-red-800'
    );

    if (type === 'error') {
      message.classList.add('border', 'border-red-200', 'bg-red-50', 'text-red-800');
      return;
    }

    message.classList.add('border', 'border-green-200', 'bg-green-50', 'text-green-800');
  }
}

function isValidDateInput(dateValue) {
  if (!dateValue) return false;

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(dateValue)) return false;

  const parsedDate = new Date(`${dateValue}T00:00:00`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === dateValue;
}

function sumByType(movements, type) {
  return movements
    .filter((movement) => movement.tipo === type)
    .reduce((total, movement) => total + Number(movement.monto || 0), 0);
}

function renderTransactionsTable(movements, data) {
  const tableBody = document.querySelector('#transactions-table-body');
  const emptyState = document.querySelector('#transactions-empty-state');

  if (!tableBody || !emptyState) return;

  tableBody.innerHTML = '';

  if (movements.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  const sortedMovements = [...movements].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  sortedMovements.slice(0, 5).forEach((movement) => {
    const row = document.createElement('tr');
    row.className = 'border-b border-slate-200 last:border-0 hover:bg-amber-50/70';

    const clientName = findClientName(data.clientes, movement.cliente_id);
    const projectName = findProjectName(data.proyectos, movement.proyecto_id);
    const badgeClass = movement.tipo === 'ingreso'
      ? 'bg-green-100 text-green-800 ring-green-700/10'
      : 'bg-red-100 text-red-800 ring-red-700/10';
    const signedAmount = movement.tipo === 'ingreso'
      ? formatCurrency(movement.monto)
      : `-${formatCurrency(movement.monto)}`;

    // El contenido proviene de un JSON local controlado del prototipo académico.
    row.innerHTML = `
      <td class="px-4 py-4 text-sm text-slate-700">${formatDate(movement.fecha)}</td>
      <td class="px-4 py-4">
        <span class="inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClass}">${movement.tipo}</span>
      </td>
      <td class="px-4 py-4 text-sm font-medium text-slate-900">${movement.descripcion}</td>
      <td class="px-4 py-4 text-sm text-slate-600">${clientName}</td>
      <td class="px-4 py-4 text-sm text-slate-600">${projectName}</td>
      <td class="px-4 py-4 text-right text-sm font-bold ${movement.tipo === 'ingreso' ? 'text-green-700' : 'text-red-700'}">${signedAmount}</td>
    `;

    tableBody.appendChild(row);
  });
}

function renderClientsList(clients, projects, invoices) {
  const list = document.getElementById('clients-list');
  if (!list) return;

  list.innerHTML = '';

  clients.forEach((client) => {
    const clientProjects = projects.filter((project) => project.cliente_id === client.id);
    const clientPending = invoices
      .filter((invoice) => invoice.cliente_id === client.id)
      .reduce((total, invoice) => total + Number(invoice.saldo_pendiente || 0), 0);

    const item = document.createElement('article');
    item.className = 'rounded-2xl border border-slate-200 bg-white p-4';
    item.innerHTML = `
      <h3 class="font-black text-slate-950">${client.nombre_razon_social}</h3>
      <p class="mt-1 text-sm text-slate-600">${client.tipo_cliente} · ${client.correo_electronico}</p>
      <p class="mt-3 text-sm font-semibold text-slate-700">Proyectos: ${clientProjects.length}</p>
      <p class="text-sm font-semibold text-amber-700">Saldo pendiente: ${formatCurrency(clientPending)}</p>
    `;
    list.appendChild(item);
  });
}

function renderBudgetPreview(categories, expenses) {
  const list = document.getElementById('budget-list');
  if (!list) return;

  list.innerHTML = '';

  categories.slice(0, 4).forEach((category) => {
    const spent = expenses
      .filter((expense) => expense.categoria_gasto_id === category.id)
      .reduce((total, expense) => total + Number(expense.monto || 0), 0);

    const item = document.createElement('li');
    item.className = 'flex items-center justify-between border-b border-slate-200 py-3 last:border-0';
    item.innerHTML = `
      <span class="text-sm font-semibold text-slate-700">${category.nombre_categoria}</span>
      <span class="text-sm font-black text-slate-950">${formatCurrency(spent)}</span>
    `;
    list.appendChild(item);
  });
}

function findClientName(clients = [], clientId) {
  if (!clientId) return 'Sin cliente asociado';
  return clients.find((client) => client.id === clientId)?.nombre_razon_social ?? 'Cliente no encontrado';
}

function findProjectName(projects = [], projectId) {
  if (!projectId) return 'Sin proyecto asociado';
  return projects.find((project) => project.id === projectId)?.nombre_proyecto ?? 'Proyecto no encontrado';
}

function updateText(elementId, value) {
  const element = document.getElementById(elementId);
  if (element) element.textContent = value;
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

function formatDate(dateValue) {
  return dateFormatter.format(new Date(`${dateValue}T00:00:00`));
}

function showLoadingError(error) {
  console.error(error);
  const alertBox = document.getElementById('data-error');
  if (!alertBox) return;

  alertBox.classList.remove('hidden');
  alertBox.textContent = 'No se pudieron cargar los datos simulados. Verifica que assets/data/mock-data.json exista y abre el proyecto con un servidor local.';
}
