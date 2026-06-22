(function reportModelFactory(globalScope) {
  'use strict';

  const PERIOD_TYPES = ['Mensual', 'Trimestral', 'Anual'];
  const REPORT_TYPES = ['income', 'expenses', 'cashflow', 'profitability', 'pnl', 'receivables'];
  const NEAR_LIMIT_THRESHOLD = 80;

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function validateDateRange(dateFrom, dateTo) {
    if (!dateFrom || !dateTo) {
      return { valid: false, message: 'Selecciona la fecha inicial y la fecha final.' };
    }
    if (!isValidDate(dateFrom) || !isValidDate(dateTo)) {
      return { valid: false, message: 'Ingresa un rango de fechas válido.' };
    }
    if (dateTo < dateFrom) {
      return { valid: false, message: 'La fecha final no puede ser anterior a la fecha inicial.' };
    }
    return { valid: true };
  }

  function normalizeBudget(budget = {}) {
    return {
      id: String(budget.id ?? ''),
      periodo: PERIOD_TYPES.includes(budget.periodo) ? budget.periodo : 'Mensual',
      periodo_clave: String(budget.periodo_clave ?? ''),
      meta_ingresos: toNumber(budget.meta_ingresos),
      meta_horas_facturables: budget.meta_horas_facturables === '' || budget.meta_horas_facturables == null
        ? null
        : toNumber(budget.meta_horas_facturables),
      limites_gasto_por_categoria: (budget.limites_gasto_por_categoria ?? []).map((row) => ({
        categoria_id: String(row.categoria_id ?? ''),
        limite: toNumber(row.limite)
      })),
      fecha_actualizacion: String(budget.fecha_actualizacion ?? '')
    };
  }

  function validateBudget(budget = {}, categories = []) {
    const candidate = normalizeBudget(budget);
    const errors = {};
    const rowErrors = candidate.limites_gasto_por_categoria.map(() => ({}));
    const validCategoryIds = new Set(categories.map((category) => String(category.id)));
    const usedCategories = new Set();

    if (!PERIOD_TYPES.includes(budget.periodo)) errors.periodo = 'Selecciona un período.';
    if (!candidate.periodo_clave) errors.periodo_clave = 'Selecciona el período que deseas planificar.';
    if (candidate.meta_ingresos <= 0) errors.meta_ingresos = 'La meta de ingresos debe ser mayor a 0.';
    if (candidate.meta_horas_facturables !== null && candidate.meta_horas_facturables <= 0) {
      errors.meta_horas_facturables = 'Las horas facturables deben ser mayores a 0.';
    }

    candidate.limites_gasto_por_categoria.forEach((row, index) => {
      if (!row.categoria_id || (validCategoryIds.size && !validCategoryIds.has(row.categoria_id))) {
        rowErrors[index].categoria_id = 'Selecciona una categoría válida.';
      } else if (usedCategories.has(row.categoria_id)) {
        rowErrors[index].categoria_id = 'Ya definiste un límite para esta categoría.';
      }
      usedCategories.add(row.categoria_id);
      if (row.limite <= 0) rowErrors[index].limite = 'El límite de gasto debe ser mayor a 0.';
    });

    const hasRowErrors = rowErrors.some((row) => Object.keys(row).length > 0);
    return { valid: Object.keys(errors).length === 0 && !hasRowErrors, errors, rowErrors, value: candidate };
  }

  function getDateRange(filters = {}) {
    if (isValidDate(filters.dateFrom) && isValidDate(filters.dateTo)) {
      return { from: filters.dateFrom, to: filters.dateTo };
    }
    const period = /^\d{4}-\d{2}$/.test(filters.period ?? '') ? filters.period : '';
    if (!period) return { from: '', to: '' };
    const [year, month] = period.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return { from: `${period}-01`, to: `${period}-${String(lastDay).padStart(2, '0')}` };
  }

  function inDateRange(value, range) {
    if (!range.from || !range.to) return true;
    if (!isValidDate(value)) return true;
    return value >= range.from && value <= range.to;
  }

  function createRelations(data = {}) {
    const projects = new Map((data.proyectos ?? []).map((project) => [String(project.id), project]));
    const clients = new Map((data.clientes ?? []).map((client) => [String(client.id), client]));
    const invoices = new Map((data.facturas ?? []).map((invoice) => [String(invoice.id), invoice]));
    const categories = new Map((data.categorias_gasto ?? []).map((category) => [String(category.id), category]));
    return { projects, clients, invoices, categories };
  }

  function matchesScope({ clientId = '', projectId = '' }, filters = {}, relations) {
    const relatedProject = projectId ? relations.projects.get(String(projectId)) : null;
    const resolvedClientId = String(clientId || relatedProject?.cliente_id || '');
    if (filters.projectId && String(projectId) !== String(filters.projectId)) return false;
    if (filters.clientId && resolvedClientId !== String(filters.clientId)) return false;
    return true;
  }

  function getFilteredPayments(data = {}, filters = {}, relations = createRelations(data)) {
    const range = getDateRange(filters);
    return (data.pagos_factura ?? []).filter((payment) => {
      const invoice = relations.invoices.get(String(payment.factura_id));
      if (!invoice || invoice.estado === 'VOID') return false;
      return inDateRange(payment.fecha_pago, range) && matchesScope({
        clientId: invoice.cliente_id,
        projectId: invoice.proyecto_relacionado_id ?? invoice.proyecto_id
      }, filters, relations);
    });
  }

  function getFilteredExpenses(data = {}, filters = {}, relations = createRelations(data)) {
    const range = getDateRange(filters);
    return (data.gastos ?? []).filter((expense) => inDateRange(expense.fecha_gasto, range)
      && matchesScope({
        clientId: expense.cliente_id,
        projectId: expense.proyecto_relacionado_id ?? expense.proyecto_id
      }, filters, relations));
  }

  function calculateFinancialSummary(data = {}, budget = {}, filters = {}) {
    const relations = createRelations(data);
    const payments = getFilteredPayments(data, filters, relations);
    const expenses = getFilteredExpenses(data, filters, relations);
    const normalizedBudget = normalizeBudget(budget);
    const realIncome = round(payments.reduce((sum, item) => sum + toNumber(item.monto_pagado), 0));
    const realExpenses = round(expenses.reduce((sum, item) => sum + toNumber(item.monto), 0));
    const budgetedExpenses = round(normalizedBudget.limites_gasto_por_categoria
      .reduce((sum, row) => sum + row.limite, 0));
    const incomeGoal = round(normalizedBudget.meta_ingresos);

    return {
      incomeGoal,
      realIncome,
      budgetedExpenses,
      realExpenses,
      netFlow: round(realIncome - realExpenses),
      incomeProgress: incomeGoal > 0 ? round((realIncome / incomeGoal) * 100) : null,
      expenseProgress: budgetedExpenses > 0 ? round((realExpenses / budgetedExpenses) * 100) : null,
      hasBudget: Boolean(normalizedBudget.id || normalizedBudget.periodo_clave),
      paymentCount: payments.length,
      expenseCount: expenses.length
    };
  }

  function getBudgetStatus(consumed, spent) {
    if (spent === 0) return 'no_activity';
    if (consumed > 100) return 'over_budget';
    if (consumed >= NEAR_LIMIT_THRESHOLD) return 'near_limit';
    return 'available';
  }

  function calculateBudgetRows(data = {}, budget = {}, filters = {}) {
    const relations = createRelations(data);
    const expenses = getFilteredExpenses(data, filters, relations);
    const normalizedBudget = normalizeBudget(budget);
    return normalizedBudget.limites_gasto_por_categoria.map((limit) => {
      const category = relations.categories.get(limit.categoria_id) ?? {};
      const spent = round(expenses
        .filter((expense) => String(expense.categoria_gasto_id) === limit.categoria_id)
        .reduce((sum, expense) => sum + toNumber(expense.monto), 0));
      const available = round(limit.limite - spent);
      const consumed = limit.limite > 0 ? round((spent / limit.limite) * 100) : null;
      return {
        categoryId: limit.categoria_id,
        categoryName: category.nombre_categoria || 'Categoría sin nombre',
        budgeted: round(limit.limite),
        spent,
        available,
        consumed,
        visualProgress: consumed === null ? 0 : Math.min(100, Math.max(0, consumed)),
        status: consumed === null ? 'no_budget' : getBudgetStatus(consumed, spent)
      };
    });
  }

  function filterInvoices(data, filters, relations) {
    const range = getDateRange(filters);
    return (data.facturas ?? []).filter((invoice) => invoice.estado !== 'VOID'
      && inDateRange(invoice.fecha_emision, range)
      && matchesScope({
        clientId: invoice.cliente_id,
        projectId: invoice.proyecto_relacionado_id ?? invoice.proyecto_id
      }, filters, relations));
  }

  function buildIncomeReport(data, filters, relations) {
    const payments = getFilteredPayments(data, filters, relations);
    const totals = new Map();
    payments.forEach((payment) => {
      const invoice = relations.invoices.get(String(payment.factura_id));
      const clientId = String(invoice?.cliente_id || 'unassigned');
      totals.set(clientId, round((totals.get(clientId) ?? 0) + toNumber(payment.monto_pagado)));
    });
    const total = round([...totals.values()].reduce((sum, value) => sum + value, 0));
    return [...totals].map(([clientId, amount]) => ({
      clientId,
      clientName: relations.clients.get(clientId)?.nombre_razon_social || 'Sin cliente',
      amount,
      share: total > 0 ? round((amount / total) * 100) : 0
    }));
  }

  function buildExpenseReport(data, filters, relations) {
    const expenses = getFilteredExpenses(data, filters, relations);
    const totals = new Map();
    expenses.forEach((expense) => {
      const key = String(expense.categoria_gasto_id || 'unassigned');
      const current = totals.get(key) ?? { amount: 0, deductible: 0 };
      current.amount += toNumber(expense.monto);
      if (expense.es_deducible) current.deductible += toNumber(expense.monto);
      totals.set(key, current);
    });
    return [...totals].map(([categoryId, values]) => ({
      categoryId,
      categoryName: relations.categories.get(categoryId)?.nombre_categoria || 'Sin categoría',
      amount: round(values.amount),
      deductibleShare: values.amount > 0 ? round((values.deductible / values.amount) * 100) : 0
    }));
  }

  function buildCashflowReport(data, filters, relations) {
    const buckets = new Map();
    getFilteredPayments(data, filters, relations).forEach((payment) => {
      const key = String(payment.fecha_pago).slice(0, 7);
      const bucket = buckets.get(key) ?? { period: key, income: 0, expenses: 0 };
      bucket.income += toNumber(payment.monto_pagado);
      buckets.set(key, bucket);
    });
    getFilteredExpenses(data, filters, relations).forEach((expense) => {
      const key = String(expense.fecha_gasto).slice(0, 7);
      const bucket = buckets.get(key) ?? { period: key, income: 0, expenses: 0 };
      bucket.expenses += toNumber(expense.monto);
      buckets.set(key, bucket);
    });
    let accumulated = 0;
    return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period)).map((bucket) => {
      const net = round(bucket.income - bucket.expenses);
      accumulated = round(accumulated + net);
      return { period: bucket.period, income: round(bucket.income), expenses: round(bucket.expenses), net, accumulated };
    });
  }

  function buildProfitabilityReport(data, filters, relations) {
    const invoices = filterInvoices(data, filters, relations);
    const expenses = getFilteredExpenses(data, filters, relations);
    const range = getDateRange(filters);
    const projectIds = new Set([
      ...invoices.map((item) => String(item.proyecto_relacionado_id ?? item.proyecto_id ?? '')).filter(Boolean),
      ...expenses.map((item) => String(item.proyecto_relacionado_id ?? item.proyecto_id ?? '')).filter(Boolean)
    ]);
    if (filters.projectId) projectIds.add(String(filters.projectId));

    return [...projectIds].map((projectId) => {
      const project = relations.projects.get(projectId) ?? {};
      const invoiced = round(invoices.filter((item) => String(item.proyecto_relacionado_id ?? item.proyecto_id ?? '') === projectId)
        .reduce((sum, item) => sum + toNumber(item.total_factura), 0));
      const projectExpenses = round(expenses.filter((item) => String(item.proyecto_relacionado_id ?? item.proyecto_id ?? '') === projectId)
        .reduce((sum, item) => sum + toNumber(item.monto), 0));
      const hours = round((data.registros_tiempo ?? []).filter((entry) => String(entry.proyecto_id ?? entry.proyecto_relacionado_id ?? '') === projectId
        && inDateRange(entry.fecha_trabajo, range)).reduce((sum, entry) => sum + toNumber(entry.horas_trabajadas), 0));
      const profit = round(invoiced - projectExpenses);
      return {
        projectId,
        projectName: project.nombre_proyecto || 'Proyecto sin nombre',
        invoiced,
        expenses: projectExpenses,
        hours,
        profit,
        margin: invoiced > 0 ? round((profit / invoiced) * 100) : null
      };
    }).sort((a, b) => b.profit - a.profit);
  }

  function buildPnlReport(data, filters, relations) {
    const summary = calculateFinancialSummary(data, {}, filters);
    const expenseRows = buildExpenseReport(data, filters, relations);
    if (summary.realIncome === 0 && summary.realExpenses === 0) return [];
    return [
      { label: 'Ingresos totales', type: 'income', amount: summary.realIncome },
      ...expenseRows.map((row) => ({ label: row.categoryName, type: 'expense', amount: row.amount })),
      { label: 'Gastos totales', type: 'expense_total', amount: summary.realExpenses },
      { label: 'Resultado neto', type: 'net', amount: summary.netFlow }
    ];
  }

  function buildReceivablesReport(data, filters, relations) {
    const today = filters.today || new Date().toISOString().slice(0, 10);
    return filterInvoices(data, filters, relations)
      .filter((invoice) => toNumber(invoice.saldo_pendiente) > 0)
      .map((invoice) => {
        const overdueDays = invoice.fecha_vencimiento && invoice.fecha_vencimiento < today
          ? Math.max(0, Math.floor((new Date(`${today}T00:00:00`) - new Date(`${invoice.fecha_vencimiento}T00:00:00`)) / 86400000))
          : 0;
        return {
          invoiceId: String(invoice.id),
          invoiceNumber: invoice.numero_factura,
          clientName: relations.clients.get(String(invoice.cliente_id))?.nombre_razon_social || 'Sin cliente',
          balance: round(invoice.saldo_pendiente),
          overdueDays,
          status: invoice.estado
        };
      }).sort((a, b) => b.overdueDays - a.overdueDays || b.balance - a.balance);
  }

  function buildReport(type, data = {}, filters = {}) {
    const reportType = REPORT_TYPES.includes(type) ? type : 'income';
    const relations = createRelations(data);
    const builders = {
      income: buildIncomeReport,
      expenses: buildExpenseReport,
      cashflow: buildCashflowReport,
      profitability: buildProfitabilityReport,
      pnl: buildPnlReport,
      receivables: buildReceivablesReport
    };
    return { type: reportType, rows: builders[reportType](data, filters, relations) };
  }

  const CSV_REPORT_DEFINITIONS = {
    income: {
      slug: 'ingresos',
      columns: [
        ['Cliente', (row) => row.clientName],
        ['Ingresos', (row) => toNumber(row.amount)],
        ['% del total', (row) => `${toNumber(row.share)}%`]
      ]
    },
    expenses: {
      slug: 'gastos',
      columns: [
        ['Categoría', (row) => row.categoryName],
        ['Gasto total', (row) => toNumber(row.amount)],
        ['% deducible', (row) => `${toNumber(row.deductibleShare)}%`]
      ]
    },
    cashflow: {
      slug: 'flujo-de-caja',
      columns: [
        ['Período', (row) => row.period],
        ['Ingresos', (row) => toNumber(row.income)],
        ['Gastos', (row) => toNumber(row.expenses)],
        ['Flujo neto', (row) => toNumber(row.net)],
        ['Saldo acumulado', (row) => toNumber(row.accumulated)]
      ]
    },
    profitability: {
      slug: 'rentabilidad',
      columns: [
        ['Proyecto', (row) => row.projectName],
        ['Facturado', (row) => toNumber(row.invoiced)],
        ['Gastos', (row) => toNumber(row.expenses)],
        ['Horas', (row) => toNumber(row.hours)],
        ['Rentabilidad neta', (row) => toNumber(row.profit)],
        ['Margen', (row) => row.margin == null ? 'Sin datos' : `${toNumber(row.margin)}%`]
      ]
    },
    pnl: {
      slug: 'perdidas-y-ganancias',
      columns: [
        ['Concepto', (row) => row.label],
        ['Tipo', (row) => ({ income: 'Ingreso', expense: 'Gasto', expense_total: 'Total de gastos', net: 'Resultado neto' }[row.type] || row.type)],
        ['Monto', (row) => toNumber(row.amount)]
      ]
    },
    receivables: {
      slug: 'cuentas-por-cobrar',
      columns: [
        ['Cliente', (row) => row.clientName],
        ['Factura', (row) => row.invoiceNumber],
        ['Saldo pendiente', (row) => toNumber(row.balance)],
        ['Días vencidos', (row) => toNumber(row.overdueDays)],
        ['Estado', (row) => row.status]
      ]
    }
  };

  function serializeCsvCell(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value.toFixed(2).replace('.', ',');
    let text = String(value ?? '');
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function buildReportCsvExport(report = {}, options = {}) {
    const type = REPORT_TYPES.includes(report.type) ? report.type : 'income';
    const definition = CSV_REPORT_DEFINITIONS[type];
    const rows = Array.isArray(report.rows) ? report.rows : [];
    const lines = [
      definition.columns.map(([label]) => serializeCsvCell(label)).join(';'),
      ...rows.map((row) => definition.columns.map(([, getValue]) => serializeCsvCell(getValue(row))).join(';'))
    ];
    const range = options.dateFrom && options.dateTo
      ? `${options.dateFrom}-a-${options.dateTo}`
      : String(options.period || 'reporte');
    const safeRange = range.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'reporte';

    return {
      filename: `freelanceflow-${definition.slug}-${safeRange}.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content: lines.join('\r\n'),
      rowCount: rows.length
    };
  }

  function mergeBudgets(baseBudgets = [], storedBudgets = []) {
    const merged = new Map();
    [...baseBudgets, ...storedBudgets].forEach((budget) => {
      const normalized = normalizeBudget(budget);
      const key = `${normalized.periodo}:${normalized.periodo_clave}`;
      merged.set(key, normalized);
    });
    return [...merged.values()].sort((a, b) => b.periodo_clave.localeCompare(a.periodo_clave));
  }

  const api = {
    NEAR_LIMIT_THRESHOLD,
    PERIOD_TYPES,
    REPORT_TYPES,
    buildReport,
    buildReportCsvExport,
    calculateBudgetRows,
    calculateFinancialSummary,
    getBudgetStatus,
    getDateRange,
    isValidDate,
    mergeBudgets,
    normalizeBudget,
    validateBudget,
    validateDateRange
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowReportModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
