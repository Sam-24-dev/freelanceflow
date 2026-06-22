const test = require('node:test');
const assert = require('node:assert/strict');

let model;
try {
  model = require('../assets/js/project-model.js');
} catch {
  model = {};
}

const clients = [
  {
    id: 'cli_001',
    nombre_razon_social: 'Bodega Andina S.A.',
    nombres: 'Marcela',
    apellidos: 'Ríos',
    estado: 'activo'
  },
  {
    id: 'cli_002',
    nombre_razon_social: 'BrightWave Marketing LLC',
    nombres: 'Daniel',
    apellidos: 'Morrison',
    estado: 'inactivo'
  }
];

const projects = [
  {
    id: 'proy_001',
    nombre_proyecto: 'Rediseño de sitio web corporativo',
    cliente_id: 'cli_001',
    estado: 'ACTIVE',
    modalidad_cobro: 'Tarifa fija',
    fecha_inicio: '2026-04-01',
    monto_fijo: 1800
  },
  {
    id: 'proy_002',
    nombre_proyecto: 'Mantenimiento mensual',
    cliente_id: 'cli_001',
    estado: 'ON_HOLD',
    modalidad_cobro: 'Por horas',
    fecha_inicio: '2026-02-01',
    tarifa_hora: 25,
    presupuesto_horas_estimado: 20
  }
];

test('expone la API pública del modelo de proyectos', () => {
  assert.equal(typeof model.normalizeProject, 'function');
  assert.equal(typeof model.validateProject, 'function');
  assert.equal(typeof model.filterProjects, 'function');
  assert.equal(typeof model.calculateProjectMetrics, 'function');
  assert.equal(typeof model.groupProjectsByClient, 'function');
});

test('normaliza un proyecto sin perder campos oficiales', () => {
  const result = model.normalizeProject({
    id: 8,
    nombre_proyecto: '  Portal de ventas  ',
    cliente_id: 'cli_001',
    estado: 'INVALID',
    modalidad_cobro: 'Tarifa fija',
    monto_fijo: '1200',
    presupuesto_horas_estimado: '40'
  });

  assert.equal(result.id, '8');
  assert.equal(result.nombre_proyecto, 'Portal de ventas');
  assert.equal(result.estado, 'ACTIVE');
  assert.equal(result.monto_fijo, 1200);
  assert.equal(result.presupuesto_horas_estimado, 40);
});

test('valida campos comunes y fechas del proyecto', () => {
  const result = model.validateProject({
    nombre_proyecto: '',
    cliente_id: '',
    fecha_inicio: '2026-07-20',
    fecha_fin_estimada: '2026-07-10',
    modalidad_cobro: ''
  }, clients);

  assert.equal(result.valid, false);
  assert.equal(result.errors.nombre_proyecto, 'Ingresa el nombre del proyecto.');
  assert.equal(result.errors.cliente_id, 'Selecciona un cliente.');
  assert.equal(result.errors.fecha_fin_estimada, 'La fecha de fin estimada debe ser posterior a la fecha de inicio.');
  assert.equal(result.errors.modalidad_cobro, 'Selecciona una modalidad de cobro.');
});

test('aplica validaciones condicionales por modalidad', () => {
  const fixed = model.validateProject({
    nombre_proyecto: 'Proyecto fijo',
    cliente_id: 'cli_001',
    fecha_inicio: '2026-06-01',
    modalidad_cobro: 'Tarifa fija',
    monto_fijo: 0
  }, clients);
  const hourly = model.validateProject({
    nombre_proyecto: 'Proyecto por horas',
    cliente_id: 'cli_001',
    fecha_inicio: '2026-06-01',
    modalidad_cobro: 'Por horas',
    tarifa_hora: -1,
    presupuesto_horas_estimado: -4
  }, clients);

  assert.equal(fixed.errors.monto_fijo, 'Ingresa un monto fijo mayor a cero.');
  assert.equal(hourly.errors.tarifa_hora, 'Ingresa una tarifa por hora mayor a cero.');
  assert.equal(hourly.errors.presupuesto_horas_estimado, 'Las horas estimadas deben ser mayores a cero.');
});

test('impide crear proyectos para un cliente inactivo', () => {
  const result = model.validateProject({
    nombre_proyecto: 'Campaña',
    cliente_id: 'cli_002',
    fecha_inicio: '2026-06-01',
    modalidad_cobro: 'Por hitos'
  }, clients);

  assert.equal(result.valid, false);
  assert.equal(result.errors.cliente_id, 'Activa este cliente antes de registrar un proyecto nuevo.');
});

test('filtra por búsqueda sin acentos, estado, modalidad y cliente', () => {
  const result = model.filterProjects(projects, clients, {
    query: 'rediseno bodega',
    status: 'ACTIVE',
    billingMode: 'Tarifa fija',
    clientId: 'cli_001'
  });

  assert.deepEqual(result.map((project) => project.id), ['proy_001']);
});

test('calcula métricas solo con facturas no anuladas y relaciones oficiales', () => {
  const result = model.calculateProjectMetrics(projects[0], {
    invoices: [
      { id: 'fac_1', proyecto_relacionado_id: 'proy_001', estado: 'PARTIAL', total_factura: 1800, monto_pagado_acumulado: 850, saldo_pendiente: 950 },
      { id: 'fac_2', proyecto_relacionado_id: 'proy_001', estado: 'VOID', total_factura: 400, monto_pagado_acumulado: 0, saldo_pendiente: 400 },
      { id: 'fac_3', proyecto_relacionado_id: 'proy_002', estado: 'PAID', total_factura: 500, monto_pagado_acumulado: 500, saldo_pendiente: 0 }
    ],
    expenses: [
      { proyecto_relacionado_id: 'proy_001', monto: 54.99 },
      { proyecto_relacionado_id: 'proy_002', monto: 12.5 }
    ],
    timeEntries: [
      { proyecto_id: 'proy_001', horas_trabajadas: 12.5 },
      { proyecto_id: 'proy_002', horas_trabajadas: 4 }
    ]
  });

  assert.equal(result.invoiced, 1800);
  assert.equal(result.paid, 850);
  assert.equal(result.receivable, 950);
  assert.equal(result.expenses, 54.99);
  assert.equal(result.profit, 1745.01);
  assert.equal(result.margin, 96.95);
  assert.equal(result.hours, 12.5);
  assert.equal(result.billingProgress, 100);
});


test('diferencia facturación emitida, cobro recibido y saldo pendiente en tarifa fija', () => {
  const result = model.calculateProjectMetrics(projects[0], {
    invoices: [
      { id: 'fac_1', proyecto_relacionado_id: 'proy_001', estado: 'PARTIAL', total_factura: 1800, monto_pagado_acumulado: 850, saldo_pendiente: 950 }
    ],
    expenses: [],
    timeEntries: []
  });

  assert.equal(result.estimatedValue, 1800);
  assert.equal(result.unbilledValue, 0);
  assert.equal(result.billingProgress, 100);
  assert.equal(result.collectionProgress, 47.22);
  assert.equal(result.financialStatus, 'partial_collection');
});

test('calcula valor trabajado estimado y alerta proyectos por horas completados sin factura', () => {
  const completedHourly = {
    ...projects[1],
    id: 'proy_003',
    estado: 'COMPLETED',
    tarifa_hora: 35,
    presupuesto_horas_estimado: 60
  };

  const result = model.calculateProjectMetrics(completedHourly, {
    invoices: [],
    expenses: [],
    timeEntries: [
      { proyecto_id: 'proy_003', horas_trabajadas: 57 }
    ]
  });

  assert.equal(result.hours, 57);
  assert.equal(result.estimatedValue, 1995);
  assert.equal(result.unbilledValue, 1995);
  assert.equal(result.billingProgress, 0);
  assert.equal(result.collectionProgress, 0);
  assert.equal(result.financialStatus, 'completed_without_invoice');
});

test('detecta cuando la facturación supera el valor de las horas registradas', () => {
  const result = model.calculateProjectMetrics(projects[1], {
    invoices: [
      { id: 'fac_2', proyecto_relacionado_id: 'proy_002', estado: 'PARTIAL', total_factura: 800, monto_pagado_acumulado: 500, saldo_pendiente: 300 }
    ],
    expenses: [],
    timeEntries: [
      { proyecto_id: 'proy_002', horas_trabajadas: 7.5 }
    ]
  });

  assert.equal(result.estimatedValue, 187.5);
  assert.equal(result.invoicedAboveLoggedWork, true);
  assert.equal(result.invoiceValueDifference, 612.5);
});

test('agrupa proyectos por cliente e incluye clientes sin proyectos', () => {
  const groups = model.groupProjectsByClient(clients, projects, {
    invoices: [
      { proyecto_relacionado_id: 'proy_001', estado: 'PARTIAL', total_factura: 1800, monto_pagado_acumulado: 850, saldo_pendiente: 950 }
    ],
    expenses: [],
    timeEntries: []
  });

  assert.equal(groups.length, 2);
  assert.equal(groups[0].projects.length, 2);
  assert.equal(groups[0].outstanding, 950);
  assert.equal(groups[1].projects.length, 0);
});

test('fusiona cambios locales por id y crea registros nuevos activos', () => {
  const merged = model.mergeProjects(projects, [{ ...projects[0], nombre_proyecto: 'Rediseño actualizado' }]);
  const created = model.createProjectRecord({
    nombre_proyecto: 'Nuevo proyecto',
    cliente_id: 'cli_001',
    fecha_inicio: '2026-06-20',
    modalidad_cobro: 'Por hitos'
  }, { id: 'proy_new' });

  assert.equal(merged.length, 2);
  assert.equal(merged[0].nombre_proyecto, 'Rediseño actualizado');
  assert.equal(created.id, 'proy_new');
  assert.equal(created.estado, 'ACTIVE');
});
