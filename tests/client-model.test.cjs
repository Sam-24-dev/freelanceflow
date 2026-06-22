const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CIVIL_STATUS_OPTIONS,
  CLIENT_STATUS_OPTIONS,
  createClientRecord,
  filterClients,
  mergeClients,
  normalizeClient,
  validateClient
} = require('../assets/js/client-model.js');

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
    { ...validClient, id: 'cli_1', nombre_razon_social: 'Original' },
    { ...validClient, id: 'cli_2', nombre_razon_social: 'Base' }
  ];
  const stored = [
    { ...validClient, id: 'cli_1', nombre_razon_social: 'Editado' },
    { ...validClient, id: 'cli_3', nombre_razon_social: 'Local' }
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
