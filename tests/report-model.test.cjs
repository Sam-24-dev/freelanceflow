const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const modelPath = path.resolve(__dirname, '../assets/js/report-model.js');
const categoryModel = require('../assets/js/category-model.js');
const transactionModel = require('../assets/js/transaction-model.js');
const canonicalMockData = require('../assets/data/mock-data.json');

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

test('FF-CAT-006 resolves report names and budgets from the effective overlay catalog', () => {
  const categories = categoryModel.mergeCategories(canonicalMockData.categorias_gasto, {
    version: 2,
    items: [
      { ...canonicalMockData.categorias_gasto[0], nombre_categoria: 'Software local' },
      { ...canonicalMockData.categorias_gasto[1], id: 'cat_999', nombre_categoria: 'Comisiones', presupuesto_mensual: 25 }
    ],
    deletedIds: ['cat_003']
  });
  const expenses = transactionModel.toExpenseRecords(canonicalMockData.movimientos_financieros_mock_auxiliar, {
    projects: canonicalMockData.proyectos,
    categories
  });
  const reportData = { ...canonicalMockData, categorias_gasto: categories, gastos: expenses };
  const report = require(modelPath).buildReport('expenses', reportData, { period: '2026-06' });
  const rows = require(modelPath).calculateBudgetRows(reportData, canonicalMockData.presupuestos[0], { period: '2026-06' });

  assert.equal(report.rows.find(({ categoryId }) => categoryId === 'cat_001').categoryName, 'Software local');
  assert.equal(categories.some(({ id }) => id === 'cat_999'), true);
  assert.equal(categories.some(({ id }) => id === 'cat_003'), false);
  assert.equal(rows.find(({ categoryId }) => categoryId === 'cat_001').categoryName, 'Software local');

  const invalidOverlay = categoryModel.mergeCategories(canonicalMockData.categorias_gasto, {
    version: 2,
    items: [{ ...canonicalMockData.categorias_gasto[0], nombre_categoria: 'Invalid overlay', presupuesto_mensual: '120' }],
    deletedIds: []
  });
  assert.deepEqual(invalidOverlay, canonicalMockData.categorias_gasto);
});

test('FF-CAT-007 reports USD 67.49 once and keeps the deductible share at 100 percent', () => {
  const expenses = transactionModel.toExpenseRecords(canonicalMockData.movimientos_financieros_mock_auxiliar, {
    projects: canonicalMockData.proyectos,
    categories: canonicalMockData.categorias_gasto
  });
  const reportData = { ...canonicalMockData, gastos: expenses };
  const summary = require(modelPath).calculateFinancialSummary(reportData, canonicalMockData.presupuestos[0], { period: '2026-06' });
  const report = require(modelPath).buildReport('expenses', reportData, { period: '2026-06' });

  assert.equal(summary.realExpenses, 67.49);
  assert.equal(Number(report.rows.reduce((sum, row) => sum + row.amount, 0).toFixed(2)), 67.49);
  assert.deepEqual(report.rows.map(({ deductibleShare }) => deductibleShare), [100, 100]);
});

test('FF-RPT-001 descarta pagos y gastos corruptos antes de calcular y exportar', () => {
  const model = require(modelPath);
  const corrupted = {
    ...data,
    pagos_factura: [
      ...data.pagos_factura,
      { id: 'pay_001', factura_id: 'fac_001', monto_pagado: 999, fecha_pago: '2026-06-11' },
      { id: '', factura_id: 'fac_001', monto_pagado: 999, fecha_pago: '2026-06-11' },
      { id: 'pay_bad_date', factura_id: 'fac_001', monto_pagado: 999, fecha_pago: '2026-06-31' },
      { id: 'pay_boolean_amount', factura_id: 'fac_001', monto_pagado: true, fecha_pago: '2026-06-11' },
      { id: 'pay_string_amount', factura_id: 'fac_001', monto_pagado: '999', fecha_pago: '2026-06-11' },
      { id: 'pay_negative', factura_id: 'fac_001', monto_pagado: -1, fecha_pago: '2026-06-11' }
    ],
    gastos: [
      ...data.gastos,
      { id: 'gasto_001', categoria_gasto_id: 'cat_001', monto: 999, fecha_gasto: '2026-06-11' },
      { id: 'gasto_empty', categoria_gasto_id: 'cat_001', monto: 999, fecha_gasto: '' },
      { id: 'gasto_boolean_amount', categoria_gasto_id: 'cat_001', monto: false, fecha_gasto: '2026-06-11' },
      { id: 'gasto_string_amount', categoria_gasto_id: 'cat_001', monto: '999', fecha_gasto: '2026-06-11' },
      { id: 'gasto_negative', categoria_gasto_id: 'cat_001', monto: -1, fecha_gasto: '2026-06-11' }
    ]
  };

  const summary = model.calculateFinancialSummary(corrupted, juneBudget, { period: '2026-06' });
  const report = model.buildReport('cashflow', corrupted, { period: '2026-06' });
  const exported = model.buildReportCsvExport(report, { period: '2026-06' });

  assert.deepEqual(
    { income: summary.realIncome, expenses: summary.realExpenses, payments: summary.paymentCount, expensesCount: summary.expenseCount },
    { income: 1350, expenses: 67.49, payments: 2, expensesCount: 2 }
  );
  assert.match(exported.content, /1350,00;67,49;1282,51/);
  assert.doesNotMatch(exported.content, /999,00/);
});

test('FF-RPT-004 neutraliza f�rmulas CSV precedidas por espacio o controles C0', () => {
  const model = require(modelPath);
  const exported = model.buildReportCsvExport({
    type: 'income',
    rows: [
      { clientName: ' =SUM(1,1)', amount: 50, share: 100 },
      { clientName: '\u0000+CMD()', amount: 25, share: 50 },
      { clientName: '\t@HYPERLINK()', amount: 25, share: 50 }
    ]
  }, { period: '2026-06' });

  assert.match(exported.content, /' =SUM\(1,1\)/);
  assert.match(exported.content, /'\u0000\+CMD\(\)/);
  assert.match(exported.content, /'\t@HYPERLINK\(\)/);
  assert.equal(exported.mimeType, 'text/csv;charset=utf-8');
  assert.match(exported.content, /^Cliente;Ingresos;% del total\r\n/);
});

test('FF-RPT-002 validates canonical budget keys, inclusive calendar windows, and period totals', () => {
  const model = require(modelPath);
  const validBudget = (periodo, periodo_clave) => model.validateBudget({
    periodo,
    periodo_clave,
    meta_ingresos: 1200,
    limites_gasto_por_categoria: [{ categoria_id: 'cat_001', limite: 300 }]
  }, data.categorias_gasto);

  assert.equal(validBudget('Mensual', '2026-06').valid, true);
  assert.equal(validBudget('Trimestral', '2026-Q2').valid, true);
  assert.equal(validBudget('Anual', '2026').valid, true);
  assert.deepEqual(model.getDateRange({ period: '2026-06' }), { from: '2026-06-01', to: '2026-06-30' });
  assert.deepEqual(model.getDateRange({ period: '2026-Q1' }), { from: '2026-01-01', to: '2026-03-31' });
  assert.deepEqual(model.getDateRange({ period: '2026' }), { from: '2026-01-01', to: '2026-12-31' });

  [
    ['Mensual', '2026-Q2'], ['Trimestral', '2026-04'], ['Anual', '2026-Q1'],
    ['Trimestral', '2026-Q5'], ['Anual', '2026-01'], [['Mensual'], '2026-06'], ['Mensual', 202606]
  ].forEach(([periodo, periodo_clave]) => assert.equal(validBudget(periodo, periodo_clave).valid, false));

  const calendarData = {
    ...data,
    pagos_factura: [
      { id: 'pay_q_start', factura_id: 'fac_001', monto_pagado: 100, fecha_pago: '2026-01-01' },
      { id: 'pay_q_end', factura_id: 'fac_001', monto_pagado: 200, fecha_pago: '2026-03-31' },
      { id: 'pay_outside', factura_id: 'fac_001', monto_pagado: 999, fecha_pago: '2026-04-01' }
    ],
    gastos: [
      { id: 'expense_q_start', categoria_gasto_id: 'cat_001', monto: 50, fecha_gasto: '2026-01-01' },
      { id: 'expense_q_end', categoria_gasto_id: 'cat_001', monto: 50, fecha_gasto: '2026-03-31' },
      { id: 'expense_outside', categoria_gasto_id: 'cat_001', monto: 999, fecha_gasto: '2026-04-01' }
    ]
  };
  const quarterlyBudget = validBudget('Trimestral', '2026-Q1').value;
  const summary = model.calculateFinancialSummary(calendarData, quarterlyBudget, { period: '2026-Q1' });

  assert.equal(summary.realIncome, 300);
  assert.equal(summary.realExpenses, 100);
  assert.equal(summary.incomeGoal, 1200);
  assert.equal(summary.budgetedExpenses, 300);
});

test('FF-RPT-002 normalizes legacy monthly budgets at the merge boundary', () => {
  const model = require(modelPath);
  const merged = model.mergeBudgets([{ id: 'budget_legacy_2026_06', periodo_clave: '2026-06' }]);

  assert.deepEqual(merged, [{
    id: 'budget_legacy_2026_06',
    periodo: 'Mensual',
    periodo_clave: '2026-06',
    meta_ingresos: 0,
    meta_horas_facturables: null,
    limites_gasto_por_categoria: [],
    fecha_actualizacion: ''
  }]);
});