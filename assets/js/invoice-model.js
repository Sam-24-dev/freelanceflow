(function invoiceModelFactory(globalScope) {
  'use strict';

  const INVOICE_STATES = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];
  const ACTIONS_BY_STATE = {
    DRAFT: ['view', 'edit', 'send', 'void', 'download'],
    SENT: ['view', 'pay', 'void', 'download', 'copyLink'],
    PARTIAL: ['view', 'pay', 'void', 'download', 'copyLink'],
    PAID: ['view', 'download', 'copyLink'],
    OVERDUE: ['view', 'pay', 'void', 'download', 'copyLink'],
    VOID: ['view', 'download']
  };

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
  }

  function normalizeText(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function calculateInvoiceTotals(invoice = {}) {
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const calculatedSubtotal = items.reduce((sum, item) => (
      sum + Math.max(0, toNumber(item.cantidad)) * Math.max(0, toNumber(item.precio_unitario))
    ), 0);
    const subtotal = items.length
      ? round(calculatedSubtotal)
      : round(invoice.subtotal_general ?? invoice.total_factura);
    const descuento = round(Math.max(0, toNumber(invoice.descuento)));
    const impuestos = round(Math.max(0, toNumber(invoice.impuestos)));
    return {
      subtotal,
      descuento,
      impuestos,
      total: round(Math.max(0, subtotal - descuento + impuestos))
    };
  }

  function getInvoicePayments(invoiceId, payments = []) {
    return payments.filter((payment) => String(payment.factura_id) === String(invoiceId));
  }

  function calculatePaymentSummary(invoice = {}, payments = []) {
    const total = calculateInvoiceTotals(invoice).total;
    const related = getInvoicePayments(invoice.id, payments);
    const paidFromRecords = related.reduce((sum, payment) => sum + Math.max(0, toNumber(payment.monto_pagado)), 0);
    const paid = round(related.length ? paidFromRecords : Math.max(0, toNumber(invoice.monto_pagado_acumulado)));
    const difference = round(total - paid);
    return {
      paid,
      pending: round(Math.max(0, difference)),
      credit: round(Math.max(0, -difference))
    };
  }

  function deriveInvoiceState(invoice = {}, payments = [], today = new Date().toISOString().slice(0, 10)) {
    const current = INVOICE_STATES.includes(invoice.estado) ? invoice.estado : 'DRAFT';
    if (current === 'DRAFT' || current === 'VOID') return current;
    const summary = calculatePaymentSummary(invoice, payments);
    if (summary.pending === 0 && calculateInvoiceTotals(invoice).total > 0) return 'PAID';
    if (isValidDate(invoice.fecha_vencimiento) && invoice.fecha_vencimiento < today) return 'OVERDUE';
    if (summary.paid > 0) return 'PARTIAL';
    return 'SENT';
  }

  function hydrateInvoice(invoice = {}, payments = [], today) {
    const totals = calculateInvoiceTotals(invoice);
    const paymentSummary = calculatePaymentSummary(invoice, payments);
    return {
      ...invoice,
      estado: deriveInvoiceState(invoice, payments, today),
      subtotal_general: totals.subtotal,
      descuento: totals.descuento,
      impuestos: totals.impuestos,
      total_factura: totals.total,
      monto_pagado_acumulado: paymentSummary.paid,
      saldo_pendiente: paymentSummary.pending,
      saldo_a_favor: paymentSummary.credit
    };
  }

  function calculateInvoiceMetrics(invoices = [], payments = [], options = {}) {
    const today = options.today || new Date().toISOString().slice(0, 10);
    const period = options.period || today.slice(0, 7);
    const hydrated = invoices.map((invoice) => hydrateInvoice(invoice, payments, today));
    const receivable = hydrated.filter((invoice) => ['SENT', 'PARTIAL', 'OVERDUE'].includes(invoice.estado));
    const overdue = hydrated.filter((invoice) => invoice.estado === 'OVERDUE');
    const collectedAmount = round(payments
      .filter((payment) => String(payment.fecha_pago ?? '').slice(0, 7) === period)
      .reduce((sum, payment) => sum + Math.max(0, toNumber(payment.monto_pagado)), 0));

    return {
      pendingAmount: round(receivable.reduce((sum, invoice) => sum + invoice.saldo_pendiente, 0)),
      overdueAmount: round(overdue.reduce((sum, invoice) => sum + invoice.saldo_pendiente, 0)),
      overdueCount: overdue.length,
      collectedAmount,
      pendingCount: receivable.filter((invoice) => invoice.saldo_pendiente > 0).length
    };
  }

  function filterInvoices(invoices = [], clients = [], projects = [], payments = [], filters = {}) {
    const clientsById = new Map(clients.map((client) => [String(client.id), client]));
    const projectsById = new Map(projects.map((project) => [String(project.id), project]));
    const tokens = normalizeText(filters.query).split(/\s+/).filter(Boolean);
    const today = filters.today || new Date().toISOString().slice(0, 10);

    return invoices
      .map((invoice) => hydrateInvoice(invoice, payments, today))
      .filter((invoice) => !filters.status || filters.status === 'todos' || invoice.estado === filters.status)
      .filter((invoice) => !filters.clientId || filters.clientId === 'todos' || String(invoice.cliente_id) === String(filters.clientId))
      .filter((invoice) => !filters.projectId || filters.projectId === 'todos' || String(invoice.proyecto_relacionado_id) === String(filters.projectId))
      .filter((invoice) => !filters.period || filters.period === 'todos' || String(invoice.fecha_emision).slice(0, 7) === filters.period)
      .filter((invoice) => {
        if (!tokens.length) return true;
        const client = clientsById.get(String(invoice.cliente_id)) ?? {};
        const project = projectsById.get(String(invoice.proyecto_relacionado_id)) ?? {};
        const itemDescriptions = (invoice.items ?? []).map((item) => item.descripcion_item).join(' ');
        const haystack = normalizeText([
          invoice.numero_factura,
          client.nombre_razon_social,
          client.nombres,
          client.apellidos,
          project.nombre_proyecto,
          itemDescriptions
        ].join(' '));
        return tokens.every((token) => haystack.includes(token));
      })
      .sort((first, second) => String(second.fecha_emision).localeCompare(String(first.fecha_emision)));
  }

  function getAllowedActions(state) {
    return [...(ACTIONS_BY_STATE[state] ?? ACTIONS_BY_STATE.DRAFT)];
  }

  function validateInvoice(invoice = {}) {
    const errors = {};
    if (!String(invoice.cliente_id ?? '').trim()) errors.cliente_id = 'Selecciona un cliente.';
    if (!isValidDate(invoice.fecha_emision)) errors.fecha_emision = 'Ingresa una fecha de emisión válida.';
    if (!isValidDate(invoice.fecha_vencimiento)) {
      errors.fecha_vencimiento = 'Ingresa una fecha de vencimiento válida.';
    } else if (isValidDate(invoice.fecha_emision) && invoice.fecha_vencimiento < invoice.fecha_emision) {
      errors.fecha_vencimiento = 'La fecha de vencimiento no puede ser anterior a la fecha de emisión.';
    }
    if (!String(invoice.moneda ?? '').trim()) errors.moneda = 'Selecciona una moneda.';

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (!items.length || items.some((item) => (
      !String(item.descripcion_item ?? '').trim()
      || toNumber(item.cantidad) <= 0
      || toNumber(item.precio_unitario) < 0
    ))) errors.items = 'Completa al menos un ítem con descripción, cantidad mayor a cero y precio válido.';

    if (calculateInvoiceTotals(invoice).total <= 0) {
      errors.total = 'El total de la factura no puede ser cero o negativo.';
    }
    return { valid: Object.keys(errors).length === 0, errors };
  }

  function validatePayment(payment = {}, pendingBalance = 0, today = new Date().toISOString().slice(0, 10)) {
    const errors = {};
    const amount = toNumber(payment.monto_pagado);
    if (amount <= 0) errors.monto_pagado = 'El monto del pago debe ser mayor a 0.';
    if (!isValidDate(payment.fecha_pago)) errors.fecha_pago = 'Ingresa una fecha de pago válida.';
    else if (payment.fecha_pago > today) errors.fecha_pago = 'La fecha de pago no puede ser futura.';
    if (!String(payment.metodo_pago ?? '').trim()) errors.metodo_pago = 'Selecciona un método de pago.';
    return {
      valid: Object.keys(errors).length === 0,
      errors,
      excess: round(Math.max(0, amount - Math.max(0, toNumber(pendingBalance))))
    };
  }

  function mergeById(base = [], stored = []) {
    const merged = new Map(base.map((item) => [String(item.id), item]));
    stored.forEach((item) => {
      if (item?.id) merged.set(String(item.id), item);
    });
    return [...merged.values()];
  }

  const api = {
    INVOICE_STATES,
    calculateInvoiceMetrics,
    calculateInvoiceTotals,
    calculatePaymentSummary,
    deriveInvoiceState,
    filterInvoices,
    getAllowedActions,
    getInvoicePayments,
    hydrateInvoice,
    isValidDate,
    mergeById,
    normalizeText,
    round,
    validateInvoice,
    validatePayment
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowInvoiceModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
