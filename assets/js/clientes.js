/*
  FreelanceFlow - M?dulo Clientes Fase 1
  JavaScript puro: datos simulados en navegador, sin backend, APIs ni base de datos.
*/

const CLIENTS_DATA_URL = './assets/data/mock-data.json';
const CLIENTS_STORAGE_KEY = 'freelanceflow_clients_mock';
const CIVIL_STATUS_OPTIONS = ['soltero', 'casado', 'divorciado', 'separado', 'uni?n libre'];
const CLIENT_STATUS_OPTIONS = ['activo', 'inactivo'];

let clients = [];
let selectedClientId = null;

const dateFormatter = new Intl.DateTimeFormat('es-EC', {
  year: 'numeric',
  month: 'short',
  day: '2-digit'
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    clients = await loadClients();
    setupClientForm();
    setupSearch();
    renderClients();
    renderClientDetail(null);
  } catch (error) {
    showDataError(error);
  }
});

async function loadClients() {
  const storedClients = localStorage.getItem(CLIENTS_STORAGE_KEY);
  if (storedClients) return normalizeClients(JSON.parse(storedClients));

  const response = await fetch(CLIENTS_DATA_URL);
  if (!response.ok) throw new Error(`No se pudo cargar el mock data: ${response.status}`);

  const data = await response.json();
  return normalizeClients(data.clientes ?? []);
}

function normalizeClients(rawClients) {
  return rawClients.map((client) => ({
    id: client.id,
    nombre_razon_social: client.nombre_razon_social ?? '',
    tipo_cliente: client.tipo_cliente ?? 'Empresa',
    nombres: client.nombres ?? '',
    apellidos: client.apellidos ?? '',
    identificacion: client.identificacion ?? client.identificacion_fiscal ?? '',
    identificacion_fiscal: client.identificacion_fiscal ?? client.identificacion ?? '',
    telefono: client.telefono ?? '',
    celular: client.celular ?? '',
    correo: client.correo ?? client.correo_electronico ?? '',
    correo_electronico: client.correo_electronico ?? client.correo ?? '',
    direccion: client.direccion ?? '',
    estadoCivil: client.estadoCivil ?? 'soltero',
    estado: client.estado ?? 'activo',
    fecha_registro: client.fecha_registro ?? getTodayDate()
  }));
}

function setupClientForm() {
  const form = document.getElementById('client-form');
  const clearButton = document.getElementById('client-clear-button');

  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = readClientForm();
    const validation = validateClient(formData);

    if (!validation.valid) {
      showFormMessage(validation.message, 'error');
      return;
    }

    if (formData.id) {
      updateClient(formData);
      showFormMessage('Cliente actualizado correctamente.', 'success');
    } else {
      createClient(formData);
      showFormMessage('Cliente guardado correctamente.', 'success');
    }

    saveClients();
    renderClients();
    resetClientForm();
  });

  clearButton?.addEventListener('click', resetClientForm);
}

function setupSearch() {
  const search = document.getElementById('client-search');
  search?.addEventListener('input', () => renderClients());
}

function readClientForm() {
  return {
    id: getValue('client-id'),
    nombre_razon_social: getValue('business-name'),
    tipo_cliente: getValue('client-type') || 'Empresa',
    nombres: getValue('first-names'),
    apellidos: getValue('last-names'),
    identificacion: getValue('identification'),
    telefono: getValue('phone'),
    celular: getValue('mobile'),
    correo: getValue('email'),
    direccion: getValue('address'),
    estadoCivil: getValue('civil-status'),
    estado: getValue('client-status')
  };
}

function validateClient(client) {
  const requiredFields = [
    client.nombre_razon_social,
    client.nombres,
    client.apellidos,
    client.identificacion,
    client.celular,
    client.correo,
    client.estadoCivil,
    client.estado
  ];

  if (requiredFields.some((value) => !value)) {
    return { valid: false, message: 'Completa los campos obligatorios del cliente.' };
  }

  if (!isValidEmail(client.correo)) {
    return { valid: false, message: 'Ingresa un correo v?lido.' };
  }

  if (!CIVIL_STATUS_OPTIONS.includes(client.estadoCivil)) {
    return { valid: false, message: 'Selecciona un estado civil v?lido.' };
  }

  if (!CLIENT_STATUS_OPTIONS.includes(client.estado)) {
    return { valid: false, message: 'Selecciona un estado v?lido.' };
  }

  const duplicatedIdentification = clients.some((existingClient) => (
    normalizeText(existingClient.identificacion) === normalizeText(client.identificacion)
    && existingClient.id !== client.id
  ));

  if (duplicatedIdentification) {
    return { valid: false, message: 'Ya existe un cliente con esa identificaci?n.' };
  }

  return { valid: true };
}

function createClient(client) {
  const newClient = {
    ...client,
    id: generateClientId(),
    identificacion_fiscal: client.identificacion,
    correo_electronico: client.correo,
    fecha_registro: getTodayDate()
  };

  clients.unshift(newClient);
  selectedClientId = newClient.id;
  renderClientDetail(newClient);
}

function updateClient(client) {
  clients = clients.map((existingClient) => {
    if (existingClient.id !== client.id) return existingClient;

    return {
      ...existingClient,
      ...client,
      identificacion_fiscal: client.identificacion,
      correo_electronico: client.correo,
      fecha_registro: existingClient.fecha_registro || getTodayDate()
    };
  });

  selectedClientId = client.id;
  renderClientDetail(clients.find((existingClient) => existingClient.id === client.id));
}

function renderClients() {
  const tableBody = document.getElementById('clients-table-body');
  const emptyState = document.getElementById('clients-empty-state');
  const noResults = document.getElementById('clients-no-results');

  if (!tableBody || !emptyState || !noResults) return;

  const query = normalizeText(document.getElementById('client-search')?.value ?? '');
  const filteredClients = getFilteredClients(query);

  tableBody.innerHTML = '';
  emptyState.classList.toggle('hidden', clients.length !== 0);
  noResults.classList.toggle('hidden', clients.length === 0 || filteredClients.length !== 0);

  filteredClients.forEach((client) => {
    const row = document.createElement('tr');
    row.className = 'align-top hover:bg-amber-50/60';
    row.innerHTML = `
      <td class="px-4 py-4">
        <p class="font-black text-slate-950">${escapeHtml(client.nombre_razon_social)}</p>
        <p class="mt-1 text-xs font-semibold text-slate-500">${escapeHtml(client.tipo_cliente)}</p>
      </td>
      <td class="px-4 py-4 text-sm text-slate-700">
        <p class="font-semibold text-slate-900">${escapeHtml(client.nombres)} ${escapeHtml(client.apellidos)}</p>
        <p>${escapeHtml(client.correo)}</p>
        <p>${escapeHtml(client.celular)}</p>
      </td>
      <td class="px-4 py-4 text-sm font-semibold text-slate-700">${escapeHtml(client.identificacion)}</td>
      <td class="px-4 py-4">
        <select class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700" data-action="change-civil-status" data-client-id="${client.id}" aria-label="Cambiar estado civil de ${escapeHtml(client.nombres)}">
          ${renderOptions(CIVIL_STATUS_OPTIONS, client.estadoCivil)}
        </select>
      </td>
      <td class="px-4 py-4">
        <select class="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold ${client.estado === 'activo' ? 'text-green-700' : 'text-slate-500'}" data-action="change-status" data-client-id="${client.id}" aria-label="Cambiar estado de ${escapeHtml(client.nombres)}">
          ${renderOptions(CLIENT_STATUS_OPTIONS, client.estado)}
        </select>
      </td>
      <td class="px-4 py-4 text-right">
        <div class="flex justify-end gap-2">
          <button type="button" class="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-slate-800" data-action="view" data-client-id="${client.id}">Detalle</button>
          <button type="button" class="rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-300" data-action="edit" data-client-id="${client.id}">Editar</button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });

  tableBody.querySelectorAll('[data-action="view"]').forEach((button) => {
    button.addEventListener('click', () => selectClient(button.dataset.clientId));
  });

  tableBody.querySelectorAll('[data-action="edit"]').forEach((button) => {
    button.addEventListener('click', () => editClient(button.dataset.clientId));
  });

  tableBody.querySelectorAll('[data-action="change-civil-status"]').forEach((select) => {
    select.addEventListener('change', () => changeClientField(select.dataset.clientId, 'estadoCivil', select.value));
  });

  tableBody.querySelectorAll('[data-action="change-status"]').forEach((select) => {
    select.addEventListener('change', () => changeClientField(select.dataset.clientId, 'estado', select.value));
  });
}

function getFilteredClients(query) {
  if (!query) return clients;

  return clients.filter((client) => {
    const searchable = [client.nombres, client.apellidos, client.identificacion].join(' ');
    return normalizeText(searchable).includes(query);
  });
}

function selectClient(clientId) {
  const client = clients.find((currentClient) => currentClient.id === clientId);
  selectedClientId = client?.id ?? null;
  renderClientDetail(client);
}

function editClient(clientId) {
  const client = clients.find((currentClient) => currentClient.id === clientId);
  if (!client) return;

  setValue('client-id', client.id);
  setValue('business-name', client.nombre_razon_social);
  setValue('client-type', client.tipo_cliente);
  setValue('first-names', client.nombres);
  setValue('last-names', client.apellidos);
  setValue('identification', client.identificacion);
  setValue('phone', client.telefono);
  setValue('mobile', client.celular);
  setValue('email', client.correo);
  setValue('address', client.direccion);
  setValue('civil-status', client.estadoCivil);
  setValue('client-status', client.estado);
  document.getElementById('client-form-title').textContent = 'Editar cliente';
  document.getElementById('client-submit-button').textContent = 'Actualizar cliente';
  selectClient(client.id);
  document.getElementById('client-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function changeClientField(clientId, field, value) {
  const allowedValues = field === 'estadoCivil' ? CIVIL_STATUS_OPTIONS : CLIENT_STATUS_OPTIONS;
  if (!allowedValues.includes(value)) return;

  clients = clients.map((client) => client.id === clientId ? { ...client, [field]: value } : client);
  saveClients();
  renderClients();

  if (selectedClientId === clientId) {
    renderClientDetail(clients.find((client) => client.id === clientId));
  }
}

function renderClientDetail(client) {
  const detail = document.getElementById('client-detail');
  if (!detail) return;

  if (!client) {
    detail.textContent = 'Selecciona un cliente para consultar su detalle.';
    return;
  }

  const statusClass = client.estado === 'activo' ? 'bg-green-400 text-slate-950' : 'bg-slate-600 text-white';

  detail.innerHTML = `
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="text-lg font-black text-white">${escapeHtml(client.nombre_razon_social)}</p>
        <p class="mt-1 text-slate-300">${escapeHtml(client.tipo_cliente)}</p>
      </div>
      <span class="inline-flex w-fit rounded-full px-3 py-1 text-xs font-black ${statusClass}">${escapeHtml(client.estado)}</span>
    </div>
    <dl class="mt-5 grid gap-3 sm:grid-cols-2">
      ${renderDetailItem('Contacto', `${client.nombres} ${client.apellidos}`)}
      ${renderDetailItem('Identificaci?n', client.identificacion)}
      ${renderDetailItem('Correo', client.correo)}
      ${renderDetailItem('Celular', client.celular)}
      ${renderDetailItem('Tel?fono', client.telefono || 'No registrado')}
      ${renderDetailItem('Estado civil', client.estadoCivil)}
      ${renderDetailItem('Direcci?n', client.direccion || 'No registrada')}
      ${renderDetailItem('Fecha de registro', formatDate(client.fecha_registro))}
    </dl>
  `;
}

function renderDetailItem(label, value) {
  return `
    <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
      <dt class="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">${label}</dt>
      <dd class="mt-1 font-semibold text-white">${escapeHtml(value)}</dd>
    </div>
  `;
}

function renderOptions(options, selectedValue) {
  return options.map((option) => {
    const selected = option === selectedValue ? 'selected' : '';
    const label = option.charAt(0).toUpperCase() + option.slice(1);
    return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(label)}</option>`;
  }).join('');
}

function resetClientForm() {
  const form = document.getElementById('client-form');
  form?.reset();
  setValue('client-id', '');
  setValue('client-type', 'Empresa');
  setValue('client-status', 'activo');
  document.getElementById('client-form-title').textContent = 'Registrar cliente';
  document.getElementById('client-submit-button').textContent = 'Guardar cliente';
}

function showFormMessage(text, type) {
  const message = document.getElementById('client-form-message');
  if (!message) {
    alert(text);
    return;
  }

  message.textContent = text;
  message.className = 'rounded-2xl px-4 py-3 text-sm font-semibold';

  if (type === 'error') {
    message.classList.add('border', 'border-red-200', 'bg-red-50', 'text-red-800');
    return;
  }

  message.classList.add('border', 'border-green-200', 'bg-green-50', 'text-green-800');
}

function showDataError(error) {
  console.error(error);
  const alertBox = document.getElementById('clients-data-error');
  if (!alertBox) return;

  alertBox.classList.remove('hidden');
  alertBox.textContent = 'No se pudieron cargar los clientes simulados. Verifica assets/data/mock-data.json y abre el proyecto con un servidor local.';
}

function saveClients() {
  localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(clients));
}

function getValue(id) {
  return document.getElementById(id)?.value.trim() ?? '';
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? '';
}

function generateClientId() {
  return `cli_${Date.now()}`;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatDate(dateValue) {
  if (!dateValue) return 'No registrada';
  return dateFormatter.format(new Date(`${dateValue}T00:00:00`));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

