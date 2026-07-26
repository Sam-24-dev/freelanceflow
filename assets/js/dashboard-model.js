(function dashboardModelFactory(globalScope) {
  'use strict';

  const DESKTOP_TRANSACTION_LIMIT = 5;
  const MOBILE_TRANSACTION_LIMIT = 3;
  const RECEIVABLE_STATES = new Set(['SENT', 'PARTIAL', 'OVERDUE']);

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isPeriod(value) {
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(value ?? ''));
  }

  function round(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  function validCurrency(value) {
    return /^[A-Z]{3}$/.test(String(value ?? '').trim());
  }

  function getAvailablePeriods(data = {}) {
    const periods = [
      ...asArray(data.pagos_factura).map((payment) => payment?.fecha_pago),
      ...asArray(data.movimientos_financieros_mock_auxiliar).map((movement) => movement?.fecha),
      ...asArray(data.facturas).map((invoice) => invoice?.fecha_emision),
      ...asArray(data.presupuestos).map((budget) => budget?.periodo_clave),
      data.presupuestos?.periodo_clave
    ].map((value) => String(value ?? '').slice(0, 7))
      .filter(isPeriod);
    return [...new Set(periods)].sort().reverse();
  }

  function getPeriodNavigation(period) {
    const suffix = isPeriod(period) ? `?period=${period}` : '';
    return {
      movements: `transacciones.html${suffix}`,
      reports: `reportes.html${suffix}`
    };
  }

  function getBudgetForPeriod(budgets, period) {
    const values = asArray(budgets);
    const single = budgets && !Array.isArray(budgets) ? [budgets] : [];
    return [...values, ...single].find((budget) => budget?.periodo_clave === period) ?? {};
  }

  function composeDashboardData(data = {}, overlays = {}, models = {}) {
    const sourceValidity = { receipts: Array.isArray(data.facturas) && Array.isArray(data.pagos_factura), movements: Array.isArray(data.movimientos_financieros_mock_auxiliar) };
    const invoices = models.invoiceModel?.mergeById?.(asArray(data.facturas), asArray(overlays.invoices)) ?? asArray(data.facturas);
    const payments = models.invoiceModel?.mergeById?.(asArray(data.pagos_factura), asArray(overlays.payments)) ?? asArray(data.pagos_factura);
    const clients = models.clientModel?.mergeClients?.(asArray(data.clientes), asArray(overlays.clients)) ?? asArray(data.clientes);
    const projects = models.projectModel?.mergeProjects?.(asArray(data.proyectos), asArray(overlays.projects)) ?? asArray(data.proyectos);
    const baseBudgets = Array.isArray(data.presupuestos) ? data.presupuestos : (data.presupuestos ? [data.presupuestos] : []);
    const budgets = models.reportModel?.mergeBudgets?.(baseBudgets, asArray(overlays.budgets)) ?? baseBudgets;
    const settings = models.settingsModel?.parseStoredSettings?.(JSON.stringify(overlays.settings ?? {})) ?? {};
    return { ...data, facturas: invoices, pagos_factura: payments, clientes: clients, proyectos: projects, presupuestos: budgets, settings, sourceValidity };
  }

  function buildDashboardSnapshot(data = {}, options = {}) {
    const period = isPeriod(options.period) ? options.period : '';
    const today = String(options.today ?? '').slice(0, 10);
    const invoiceModel = options.invoiceModel ?? globalScope.FreelanceFlowInvoiceModel;
    const availability = data.sourceValidity ?? { receipts: Array.isArray(data.facturas) && Array.isArray(data.pagos_factura), movements: Array.isArray(data.movimientos_financieros_mock_auxiliar) };
    const invoices = asArray(data.facturas);
    const movements = asArray(data.movimientos_financieros_mock_auxiliar);
    const payments = asArray(data.pagos_factura);
    const budget = getBudgetForPeriod(data.presupuestos, period);
    const validInvoices = invoices.filter((invoice) => invoice && !['DRAFT', 'VOID'].includes(invoice.estado));
    const validInvoiceIds = new Set(validInvoices.map((invoice) => String(invoice.id)));
    const invoicesById = new Map(validInvoices.map((invoice) => [String(invoice.id), invoice]));
    const validPayments = payments.filter((payment) => { const invoice = invoicesById.get(String(payment?.factura_id)); return invoice && validInvoiceIds.has(String(payment.factura_id)) && isPeriod(String(payment.fecha_pago).slice(0, 7)) && invoiceModel?.validatePayment?.(payment, invoiceModel.hydrateInvoice(invoice, [], today).saldo_pendiente, today).valid; });
    const paymentCurrencies = validPayments.filter((payment) => String(payment.fecha_pago).startsWith(period)).map((payment) => invoicesById.get(String(payment.factura_id))?.moneda);
    const movementCurrencies = movements
      .filter((movement) => String(movement?.fecha ?? '').startsWith(period))
      .map((movement) => movement?.moneda);
    const receivableCurrencies = validInvoices.filter((invoice) => RECEIVABLE_STATES.has(invoice.estado)).map((invoice) => invoice.moneda);
    const currencies = [...new Set([...paymentCurrencies, ...movementCurrencies, ...receivableCurrencies].map((value) => String(value ?? '').trim()))];
    const currencyIsInvalid = currencies.some((currency) => !validCurrency(currency));
    const hasMixedCurrency = currencies.length > 1;
    const canHydrate = typeof invoiceModel?.hydrateInvoice === 'function';
    const hydrated = canHydrate
      ? validInvoices.map((invoice) => invoiceModel.hydrateInvoice(invoice, validPayments, today))
      : [];
    const receivables = hydrated
      .filter((invoice) => RECEIVABLE_STATES.has(invoice.estado) && Number(invoice.saldo_pendiente) > 0)
      .sort((first, second) => String(first.fecha_vencimiento ?? '').localeCompare(String(second.fecha_vencimiento ?? '')));
    const registered = movements.filter((movement) => String(movement?.fecha ?? '').startsWith(period));
    const receipts = round(validPayments
      .filter((payment) => String(payment.fecha_pago).startsWith(period))
      .reduce((sum, payment) => sum + Math.max(0, Number(payment.monto_pagado) || 0), 0));
    const registeredIncome = round(registered
      .filter((movement) => movement?.tipo === 'ingreso')
      .reduce((sum, movement) => sum + Math.max(0, Number(movement.monto) || 0), 0));
    const registeredExpenses = round(registered
      .filter((movement) => movement?.tipo === 'gasto')
      .reduce((sum, movement) => sum + Math.max(0, Number(movement.monto) || 0), 0));
    const unavailable = !period || !canHydrate || !availability.receipts || !availability.movements || currencyIsInvalid || hasMixedCurrency;
    if (currencyIsInvalid || hasMixedCurrency) availability.receipts = availability.movements = false;
    const message = currencyIsInvalid ? 'Hay una moneda no válida en los datos del período.' : (hasMixedCurrency ? 'No se puede consolidar monedas distintas' : (!availability.receipts || !availability.movements ? 'Los datos financieros están incompletos.' : (canHydrate ? '' : 'No se pudo preparar el resumen financiero.')));

    const currency = validCurrency(currencies[0]) ? currencies[0] : (validCurrency(data.settings?.default_currency) ? String(data.settings.default_currency).trim() : 'USD');
    return {
      status: unavailable ? 'unavailable' : 'ready',
      message,
      availability,
      period,
      today,
      currency,
      receipts,
      registeredIncome,
      registeredExpenses,
      result: round(receipts - registeredExpenses),
      incomeGoal: round(Number(budget.meta_ingresos) || 0),
      receivables,
      receivablesTotal: round(receivables.reduce((sum, invoice) => sum + Number(invoice.saldo_pendiente || 0), 0)),
      movements: registered
    };
  }

  function sortMovementsByNewest(movements = []) {
    return [...movements].sort((first, second) => (
      String(second.fecha || '').localeCompare(String(first.fecha || ''))
    ));
  }

  function createDashboardTransactionPreviews(movements = {}) {
    const sorted = sortMovementsByNewest(Array.isArray(movements) ? movements : []);

    return {
      desktop: sorted.slice(0, DESKTOP_TRANSACTION_LIMIT),
      mobile: sorted.slice(0, MOBILE_TRANSACTION_LIMIT)
    };
  }

  function buildMobileInvoiceAlert(invoices = []) {
    const pendingInvoices = (Array.isArray(invoices) ? invoices : [])
      .filter((invoice) => Number(invoice.saldo_pendiente || 0) > 0 && invoice.estado !== 'VOID');
    const overdueInvoices = pendingInvoices.filter((invoice) => invoice.estado === 'OVERDUE');
    const amount = pendingInvoices.reduce((total, invoice) => total + Number(invoice.saldo_pendiente || 0), 0);

    if (overdueInvoices.length > 0) {
      return {
        kind: 'overdue',
        count: overdueInvoices.length,
        amount: overdueInvoices.reduce((total, invoice) => total + Number(invoice.saldo_pendiente || 0), 0)
      };
    }

    if (pendingInvoices.length > 0) {
      return {
        kind: 'pending',
        count: pendingInvoices.length,
        amount
      };
    }

    return {
      kind: 'clear',
      count: 0,
      amount: 0
    };
  }

  const api = {
    buildDashboardSnapshot,
    buildMobileInvoiceAlert,
    composeDashboardData,
    createDashboardTransactionPreviews,
    getAvailablePeriods,
    getPeriodNavigation,
    sortMovementsByNewest
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowDashboardModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
