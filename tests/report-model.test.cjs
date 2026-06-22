const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modelPath = path.resolve(__dirname, '../assets/js/report-model.js');

const data = {
  clientes: [
    { id: 'cli_001', nombre_razon_social: 'Bodega Andina S.A.' },
    { id: 'cli_002', nombre_razon_social: 'BrightWave Marketing LLC' }
  ],
  proyectos: [
    { id: 'proy_001', cliente_id: 'cli_001', nombre_proyecto: 'Rediseño web' },
    { id: 'proy_002', cliente_id: 'cli_001', nombre_proyecto: 'Mantenimiento' },
    { id: 'proy_003', cliente_id: 'cli_002', nombre_proyecto: 'Campaña' }
  ],
  categorias_gasto: [
    { id: 'cat_001', nombre_categoria: 'Software y suscripciones' },
    { id: 'cat_002', nombre_categoria: 'Transporte y movilidad' },
    { id: 'cat_003', nombre_categoria: 'Hosting y dominios' }
  ],
  pagos_factura: [
    { id: 'pay_001', factura_id: 'fac_001', monto_pagado: 850, fecha_pago: '2026-06-10' },
    { id: 'pay_002', factura_id: 'fac_002', monto_pagado: 500, fecha_pago: '2026-06-05' }
  ],
  facturas: [
    { id: 'fac_001', cliente_id: 'cli_001', proyecto_relacionado_id: 'proy_001', numero_factura: 'FAC-001', estado: 'PARTIAL', total_factura: 1800, saldo_pendiente: 950, fecha_emision: '2026-06-01', fecha_vencimiento: '2026-06-16' },
    { id: 'fac_002', cliente_id: 'cli_001', proyecto_relacionado_id: 'proy_002', numero_factura: 'FAC-002', estado: 'PAID', total_factura: 500, saldo_pendiente: 0, fecha_emision: '2026-06-02', fecha_vencimiento: '2026-06-17' },
    { id: 'fac_void', cliente_id: 'cli_002', proyecto_relacionado_id: 'proy_003', numero_factura: 'FAC-VOID', estado: 'VOID', total_factura: 1000, saldo_pendiente: 1000, fecha_emision: '2026-06-03', fecha_vencimiento: '2026-06-18' }
  ],
  gastos: [
    { id: 'gasto_001', fecha_gasto: '2026-06-08', categoria_gasto_id: 'cat_001', monto: 54.99, proyecto_relacionado_id: 'proy_001', es_deducible: true },
    { id: 'gasto_002', fecha_gasto: '2026-06-12', categoria_gasto_id: 'cat_002', monto: 12.5, proyecto_relacionado_id: 'proy_002', es_deducible: true }
  ],
  registros_tiempo: [
    { proyecto_id: 'proy_001', horas_trabajadas: 14.5 },
    { proyecto_id: 'proy_002', horas_trabajadas: 7.5 }
  ]
};

const juneBudget = {
  id: 'budget_2026_06',
  periodo: 'Mensual',
  periodo_clave: '2026-06',
  meta_ingresos: 1800,
  meta_horas_facturables: 80,
  limites_gasto_por_categoria: [
    { categoria_id: 'cat_001', limite: 60 },
    { categoria_id: 'cat_002', limite: 10 },
    { categoria_id: 'cat_003', limite: 30 }
  ]
};

test('expone la API pública del modelo de reportes', () => {
  const model = require(modelPath);
  assert.equal(typeof model.calculateFinancialSummary, 'function');
  assert.equal(typeof model.calculateBudgetRows, 'function');
  assert.equal(typeof model.buildReport, 'function');
  assert.equal(typeof model.validateBudget, 'function');
  assert.equal(typeof model.validateDateRange, 'function');
  assert.equal(typeof model.mergeBudgets, 'function');
});

test('valida presupuesto, límites positivos y categorías sin duplicados', () => {
  const model = require(modelPath);
  const result = model.validateBudget({
    periodo: 'Mensual',
    periodo_clave: '2026-06',
    meta_ingresos: 0,
    meta_horas_facturables: -2,
    limites_gasto_por_categoria: [
      { categoria_id: 'cat_001', limite: 20 },
      { categoria_id: 'cat_001', limite: 0 }
    ]
  }, data.categorias_gasto);

  assert.equal(result.valid, false);
  assert.equal(result.errors.meta_ingresos, 'La meta de ingresos debe ser mayor a 0.');
  assert.equal(result.errors.meta_horas_facturables, 'Las horas facturables deben ser mayores a 0.');
  assert.equal(result.rowErrors[1].categoria_id, 'Ya definiste un límite para esta categoría.');
  assert.equal(result.rowErrors[1].limite, 'El límite de gasto debe ser mayor a 0.');
});

test('calcula resumen financiero global del período con pagos y gastos reales', () => {
  const model = require(modelPath);
  const summary = model.calculateFinancialSummary(data, juneBudget, { period: '2026-06' });

  assert.equal(summary.incomeGoal, 1800);
  assert.equal(summary.realIncome, 1350);
  assert.equal(summary.budgetedExpenses, 100);
  assert.equal(summary.realExpenses, 67.49);
  assert.equal(summary.netFlow, 1282.51);
  assert.equal(summary.incomeProgress, 75);
  assert.equal(summary.expenseProgress, 67.49);
});

test('filtra métricas por proyecto y resuelve el cliente desde el proyecto', () => {
  const model = require(modelPath);
  const project = model.calculateFinancialSummary(data, juneBudget, { period: '2026-06', projectId: 'proy_001' });
  const client = model.calculateFinancialSummary(data, juneBudget, { period: '2026-06', clientId: 'cli_001' });

  assert.equal(project.realIncome, 850);
  assert.equal(project.realExpenses, 54.99);
  assert.equal(project.netFlow, 795.01);
  assert.equal(client.realIncome, 1350);
  assert.equal(client.realExpenses, 67.49);
});

test('clasifica categorías disponibles, cercanas al límite, excedidas y sin movimientos', () => {
  const model = require(modelPath);
  const rows = model.calculateBudgetRows(data, juneBudget, { period: '2026-06' });

  assert.equal(rows[0].categoryId, 'cat_001');
  assert.equal(rows[0].spent, 54.99);
  assert.equal(rows[0].available, 5.01);
  assert.equal(rows[0].consumed, 91.65);
  assert.equal(rows[0].status, 'near_limit');
  assert.equal(rows[1].status, 'over_budget');
  assert.equal(rows[1].available, -2.5);
  assert.equal(rows[2].status, 'no_activity');
});

test('conserva el porcentaje real cuando el consumo supera 100%', () => {
  const model = require(modelPath);
  const rows = model.calculateBudgetRows(data, juneBudget, { period: '2026-06' });
  assert.equal(rows[1].consumed, 125);
  assert.equal(rows[1].visualProgress, 100);
});

test('genera cuentas por cobrar sin incluir facturas anuladas', () => {
  const model = require(modelPath);
  const report = model.buildReport('receivables', data, { period: '2026-06' });

  assert.equal(report.rows.length, 1);
  assert.equal(report.rows[0].invoiceNumber, 'FAC-001');
  assert.equal(report.rows[0].balance, 950);
});

test('genera rentabilidad por proyecto con facturación, gastos y horas', () => {
  const model = require(modelPath);
  const report = model.buildReport('profitability', data, { period: '2026-06' });
  const row = report.rows.find((item) => item.projectId === 'proy_001');

  assert.equal(row.invoiced, 1800);
  assert.equal(row.expenses, 54.99);
  assert.equal(row.hours, 14.5);
  assert.equal(row.profit, 1745.01);
});

test('pérdidas y ganancias queda vacío cuando los filtros no contienen movimientos', () => {
  const model = require(modelPath);
  const report = model.buildReport('pnl', data, { period: '2026-06', clientId: 'cli_002' });
  assert.deepEqual(report.rows, []);
});

test('rechaza rangos incompletos, inválidos o invertidos', () => {
  const model = require(modelPath);
  assert.equal(model.validateDateRange('', '2026-06-30').valid, false);
  assert.equal(model.validateDateRange('2026-06-31', '2026-07-01').valid, false);
  assert.equal(model.validateDateRange('2026-07-01', '2026-06-30').valid, false);
  assert.equal(model.validateDateRange('2026-06-01', '2026-06-30').valid, true);
});

test('fusiona cambios locales por período sin duplicar presupuestos', () => {
  const model = require(modelPath);
  const merged = model.mergeBudgets([juneBudget], [{ ...juneBudget, meta_ingresos: 2200 }]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].meta_ingresos, 2200);
});

test('genera una exportación CSV del reporte activo con nombre y columnas útiles', () => {
  const model = require(modelPath);
  const report = model.buildReport('income', data, { period: '2026-06' });
  const exported = model.buildReportCsvExport(report, { period: '2026-06' });

  assert.equal(exported.filename, 'freelanceflow-ingresos-2026-06.csv');
  assert.equal(exported.mimeType, 'text/csv;charset=utf-8');
  assert.equal(exported.rowCount, 1);
  assert.match(exported.content, /^Cliente;Ingresos;% del total\r\n/);
  assert.match(exported.content, /Bodega Andina S\.A\.;1350,00;100%/);
});

test('protege la exportación CSV contra fórmulas inyectadas en texto', () => {
  const model = require(modelPath);
  const exported = model.buildReportCsvExport({
    type: 'income',
    rows: [{ clientName: '=CMD()', amount: 50, share: 100 }]
  }, { period: '2026-06' });

  assert.match(exported.content, /'=CMD\(\);50,00;100%/);
});
