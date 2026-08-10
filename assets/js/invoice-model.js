(function invoiceModelFactory(globalScope) {
  'use strict';

  const INVOICE_STATES = ['DRAFT', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID'];
  const INVOICE_STORAGE_VERSION = 1;
  const INVOICE_WEB_LOCK_NAME = 'freelanceflow-invoice-mutations-v1';
  const SUPPORTED_CURRENCIES = ['USD'];
  const INVOICE_FIELDS = new Set([
    'id', 'numero_factura', 'cliente_id', 'proyecto_relacionado_id', 'fecha_emision', 'fecha_vencimiento',
    'moneda', 'estado', 'items', 'descuento', 'impuestos', 'total_factura', 'monto_pagado_acumulado',
    'saldo_pendiente', 'subtotal_general', 'saldo_a_favor', 'fecha_anulacion', 'motivo_anulacion'
  ]);
  const INVOICE_ITEM_FIELDS = new Set(['id', 'origen_item', 'descripcion_item', 'cantidad', 'precio_unitario']);
  const PAYMENT_FIELDS = new Set(['id', 'factura_id', 'monto_pagado', 'fecha_pago', 'metodo_pago', 'referencia_comprobante', 'notas']);
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

  function isPlainRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function hasOnlyAllowedFields(record, allowedFields) {
    return isPlainRecord(record) && Object.keys(record).every((field) => allowedFields.has(field));
  }

  function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() === value && value.length > 0;
  }

  function isFiniteNonNegative(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  function isFinitePositive(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  }

  function hasUniqueInvoiceNumbers(invoices = []) {
    const numbers = new Set();
    return invoices.every((invoice) => {
      if (!isNonEmptyString(invoice?.numero_factura) || numbers.has(invoice.numero_factura)) return false;
      numbers.add(invoice.numero_factura);
      return true;
    });
  }

  function hasUniqueIds(records = []) {
    const ids = new Set();
    return records.every((record) => {
      if (!isNonEmptyString(record?.id) || ids.has(record.id)) return false;
      ids.add(record.id);
      return true;
    });
  }

  function validateStoredInvoice(invoice = {}, context = {}) {
    if (!hasOnlyAllowedFields(invoice, INVOICE_FIELDS)
      || !isNonEmptyString(invoice.id)
      || !isNonEmptyString(invoice.numero_factura)
      || !isNonEmptyString(invoice.cliente_id)
      || !isValidDate(invoice.fecha_emision)
      || !isValidDate(invoice.fecha_vencimiento)
      || invoice.fecha_vencimiento < invoice.fecha_emision
      || !SUPPORTED_CURRENCIES.includes(invoice.moneda)
      || !INVOICE_STATES.includes(invoice.estado)
      || !Array.isArray(invoice.items)
      || invoice.items.length === 0
      || !isFiniteNonNegative(invoice.descuento)
      || !isFiniteNonNegative(invoice.impuestos)) return false;

    if (invoice.proyecto_relacionado_id !== '' && !isNonEmptyString(invoice.proyecto_relacionado_id)) return false;
    if (invoice.fecha_anulacion !== undefined && !isValidDate(invoice.fecha_anulacion)) return false;
    if (invoice.motivo_anulacion !== undefined && typeof invoice.motivo_anulacion !== 'string') return false;
    if (['total_factura', 'monto_pagado_acumulado', 'saldo_pendiente'].some((field) => !isFiniteNonNegative(invoice[field]))) return false;
    if (invoice.subtotal_general !== undefined && (!isFiniteNonNegative(invoice.subtotal_general) || invoice.subtotal_general !== calculateInvoiceTotals(invoice).subtotal)) return false;
    if (invoice.saldo_a_favor !== undefined && !isFiniteNonNegative(invoice.saldo_a_favor)) return false;
    if (invoice.items.some((item) => !hasOnlyAllowedFields(item, INVOICE_ITEM_FIELDS)
      || !isNonEmptyString(item.descripcion_item)
      || !isFinitePositive(item.cantidad)
      || !isFiniteNonNegative(item.precio_unitario)
      || (item.id !== undefined && !isNonEmptyString(item.id))
      || (item.origen_item !== undefined && typeof item.origen_item !== 'string'))) return false;

    const clients = Array.isArray(context.clients) ? context.clients : null;
    const projects = Array.isArray(context.projects) ? context.projects : null;
    if (!clients || !projects) return false;
    if (!clients.some((client) => String(client?.id) === invoice.cliente_id)) return false;
    if (invoice.proyecto_relacionado_id) {
      const project = projects.find((candidate) => String(candidate?.id) === invoice.proyecto_relacionado_id);
      if (!project || String(project.cliente_id) !== invoice.cliente_id) return false;
    }
    return true;
  }

  function validateStoredPayment(payment = {}, invoices = []) {
    return hasOnlyAllowedFields(payment, PAYMENT_FIELDS)
      && isNonEmptyString(payment.id)
      && isNonEmptyString(payment.factura_id)
      && isFinitePositive(payment.monto_pagado)
      && isValidDate(payment.fecha_pago)
      && isNonEmptyString(payment.metodo_pago)
      && (payment.referencia_comprobante === undefined || typeof payment.referencia_comprobante === 'string')
      && (payment.notas === undefined || typeof payment.notas === 'string')
      && invoices.some((invoice) => invoice.id === payment.factura_id && invoice.estado !== 'DRAFT' && invoice.estado !== 'VOID');
  }

  function calculateStoredPaymentSummary(invoice = {}, payments = []) {
    const total = calculateInvoiceTotals(invoice).total;
    const paid = round(getInvoicePayments(invoice.id, payments)
      .reduce((sum, payment) => sum + payment.monto_pagado, 0));
    return {
      paid,
      pending: round(Math.max(0, total - paid)),
      credit: round(Math.max(0, paid - total))
    };
  }

  function hasFinanciallyCompatibleState(invoice, summary) {
    const total = calculateInvoiceTotals(invoice).total;
    if (invoice.estado === 'VOID') return summary.paid === 0 && invoice.saldo_pendiente === 0 && (invoice.saldo_a_favor === undefined || invoice.saldo_a_favor === 0);
    if (invoice.estado === 'DRAFT' || invoice.estado === 'SENT' || invoice.estado === 'OVERDUE') return summary.paid === 0;
    if (invoice.estado === 'PARTIAL') return summary.paid > 0 && summary.paid < total;
    return invoice.estado === 'PAID' && total > 0 && summary.paid >= total;
  }

  function validateStoredFinancials(invoice = {}, payments = []) {
    const totals = calculateInvoiceTotals(invoice);
    const summary = calculateStoredPaymentSummary(invoice, payments);
    return invoice.total_factura === totals.total
      && invoice.monto_pagado_acumulado === summary.paid
      && invoice.saldo_pendiente === (invoice.estado === 'VOID' ? 0 : summary.pending)
      && (invoice.saldo_a_favor === undefined || invoice.saldo_a_favor === summary.credit)
      && hasFinanciallyCompatibleState(invoice, summary);
  }

  function validateInvoiceStorage(invoices = [], payments = [], context = {}) {
    if (!Array.isArray(invoices) || !Array.isArray(payments) || !hasUniqueIds(invoices) || !hasUniqueIds(payments) || !hasUniqueInvoiceNumbers(invoices)) {
      return { valid: false };
    }
    if (!invoices.every((invoice) => validateStoredInvoice(invoice, context))) return { valid: false };
    if (!payments.every((payment) => validateStoredPayment(payment, invoices))) return { valid: false };
    if (!invoices.every((invoice) => validateStoredFinancials(invoice, payments))) return { valid: false };
    return { valid: true };
  }

  function parseJson(value) {
    if (typeof value !== 'string') return null;
    return JSON.parse(value);
  }

  function parseTransitionMarker(value) {
    const marker = parseJson(value);
    if (!isPlainRecord(marker)
      || marker.version !== INVOICE_STORAGE_VERSION
      || !isNonEmptyString(marker.transactionId)) return null;
    const keys = Object.keys(marker).sort();
    return keys.length === 2 && keys[0] === 'transactionId' && keys[1] === 'version' ? marker : null;
  }

  function parseTransitionCollection(value, field, version) {
    const parsed = parseJson(value);
    if (!isPlainRecord(parsed) || parsed.version !== version || !Array.isArray(parsed[field])) return null;
    const keys = Object.keys(parsed).sort();
    return keys.length === 2 && keys[0] === field && keys[1] === 'version' ? parsed[field] : null;
  }

  function resolveEstimatedTaxForNewInvoice(invoice = {}, fiscalConfiguration = {}) {
    if (Object.prototype.hasOwnProperty.call(invoice, 'impuestos')) return toNumber(invoice.impuestos);
    if (fiscalConfiguration.aplica_impuesto_valor_agregado !== true) return 0;
    const rate = Number(fiscalConfiguration.porcentaje_impuesto);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return 0;
    const subtotal = calculateInvoiceTotals({ ...invoice, impuestos: 0 }).subtotal;
    return round(subtotal * rate / 100);
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

  function commitInvoiceRecord(invoices = [], record = {}, persistInvoice = () => false, recordActivity = () => {}) {
    const index = invoices.findIndex((invoice) => invoice.id === record.id);
    const nextInvoices = index >= 0
      ? invoices.map((invoice, position) => position === index ? record : invoice)
      : [record, ...invoices];
    if (persistInvoice(nextInvoices) !== true) return { committed: false, invoices };
    recordActivity(record);
    return { committed: true, invoices: nextInvoices };
  }

  function commitInvoiceTransition(invoices = [], payments = [], nextInvoices = [], nextPayments = [], persistTransition = () => false, recordActivity = () => {}) {
    if (persistTransition(nextInvoices, nextPayments) !== true) {
      return { committed: false, invoices, payments };
    }
    recordActivity();
    return { committed: true, invoices: nextInvoices, payments: nextPayments };
  }

  function persistInvoiceTransition(storage, transitionKey, invoices = [], payments = [], transactionId = String(Date.now()), context = {}, settingsEnvelope = null) {
    if (!isNonEmptyString(transactionId) || !validateInvoiceStorage(invoices, payments, context).valid || (settingsEnvelope !== null && typeof settingsEnvelope !== 'string')) return false;
    const stageKey = `${transitionKey}:${transactionId}`;
    try {
      storage.setItem(`${stageKey}:invoices`, JSON.stringify({ version: INVOICE_STORAGE_VERSION, invoices }));
      storage.setItem(`${stageKey}:payments`, JSON.stringify({ version: INVOICE_STORAGE_VERSION, payments }));
      if (settingsEnvelope !== null) storage.setItem(`${stageKey}:settings`, settingsEnvelope);
      storage.setItem(transitionKey, JSON.stringify({ version: INVOICE_STORAGE_VERSION, transactionId }));
      return true;
    } catch {
      return false;
    }
  }

  function readInvoiceTransition(storage, transitionKey, context = {}) {
    try {
      const marker = parseTransitionMarker(storage.getItem(transitionKey));
      if (!marker) return null;
      const stageKey = `${transitionKey}:${marker.transactionId}`;
      const invoices = parseTransitionCollection(storage.getItem(`${stageKey}:invoices`), 'invoices', marker.version);
      const payments = parseTransitionCollection(storage.getItem(`${stageKey}:payments`), 'payments', marker.version);
      return validateInvoiceStorage(invoices, payments, context).valid ? { invoices, payments } : null;
    } catch {
      return null;
    }
  }

  function readInvoiceTransitionSettings(storage, transitionKey) {
    try {
      const marker = parseTransitionMarker(storage.getItem(transitionKey));
      return marker ? storage.getItem(`${transitionKey}:${marker.transactionId}:settings`) : null;
    } catch { return null; }
  }

  function readInvoiceStorage(storage, transitionKey, invoiceKey, paymentKey, context = {}) {
    try {
      const marker = parseTransitionMarker(storage.getItem(transitionKey));
      if (marker) {
        const transition = readInvoiceTransition(storage, transitionKey, context);
        return transition || { invoices: [], payments: [] };
      }
      const invoices = parseJson(storage.getItem(invoiceKey) || '[]');
      const payments = parseJson(storage.getItem(paymentKey) || '[]');
      return validateInvoiceStorage(invoices, payments, context).valid
        ? { invoices, payments }
        : { invoices: [], payments: [] };
    } catch {
      return { invoices: [], payments: [] };
    }
  }

  function nextInvoiceNumber(invoices = []) {
    const maximum = invoices.reduce((max, invoice) => {
      const match = String(invoice?.numero_factura ?? '').match(/^FAC-(\d+)$/);
      return Math.max(max, Number(match?.[1] ?? 0));
    }, 0);
    return `FAC-${String(maximum + 1).padStart(4, '0')}`;
  }

  function stableSerialize(value) {
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
    if (!isPlainRecord(value)) return JSON.stringify(value);
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }

  function matchesInvoiceSnapshot(current, baseline) {
    return isPlainRecord(current) && isPlainRecord(baseline) && stableSerialize(current) === stableSerialize(baseline);
  }

  async function runSerializedInvoiceMutation(lockManager, readSnapshot, mutateSnapshot) {
    if (!lockManager || typeof lockManager.request !== 'function') return { committed: false, reason: 'lock-unavailable' };
    try {
      return await lockManager.request(INVOICE_WEB_LOCK_NAME, { mode: 'exclusive' }, async () => {
        let snapshot;
        try {
          snapshot = await readSnapshot();
        } catch {
          return { committed: false, reason: 'snapshot-failed' };
        }
        if (!isPlainRecord(snapshot) || !Array.isArray(snapshot.invoices) || !Array.isArray(snapshot.payments)) {
          return { committed: false, reason: 'snapshot-failed' };
        }
        const result = await mutateSnapshot(snapshot);
        return isPlainRecord(result) && typeof result.committed === 'boolean'
          ? result
          : { committed: false, reason: 'mutation-failed' };
      });
    } catch {
      return { committed: false, reason: 'lock-failed' };
    }
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
    const estado = deriveInvoiceState(invoice, payments, today);
    const paymentSummary = estado === 'VOID'
      ? { paid: 0, pending: 0, credit: 0 }
      : calculatePaymentSummary(invoice, payments);
    return {
      ...invoice,
      estado,
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

  function validateInvoice(invoice = {}, context = {}) {
    const errors = {};
    if (!String(invoice.cliente_id ?? '').trim()) errors.cliente_id = 'Selecciona un cliente.';
    else if (Array.isArray(context.clients) && !context.clients.some((client) => String(client?.id) === String(invoice.cliente_id))) errors.cliente_id = 'Selecciona un cliente v?lido.';
    if (Array.isArray(context.projects) && invoice.proyecto_relacionado_id) {
      const project = context.projects.find((candidate) => String(candidate?.id) === String(invoice.proyecto_relacionado_id));
      if (!project || String(project.cliente_id) !== String(invoice.cliente_id)) errors.proyecto_relacionado_id = 'El proyecto debe pertenecer al cliente seleccionado.';
    }
    if (!isValidDate(invoice.fecha_emision)) errors.fecha_emision = 'Ingresa una fecha de emisión válida.';
    if (!isValidDate(invoice.fecha_vencimiento)) {
      errors.fecha_vencimiento = 'Ingresa una fecha de vencimiento válida.';
    } else if (isValidDate(invoice.fecha_emision) && invoice.fecha_vencimiento < invoice.fecha_emision) {
      errors.fecha_vencimiento = 'La fecha de vencimiento no puede ser anterior a la fecha de emisión.';
    }
    if (!SUPPORTED_CURRENCIES.includes(invoice.moneda)) errors.moneda = 'Selecciona una moneda.';

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
    INVOICE_STORAGE_VERSION,
    INVOICE_WEB_LOCK_NAME,
    calculateInvoiceMetrics,
    commitInvoiceRecord,
    commitInvoiceTransition,
    calculateInvoiceTotals,
    calculatePaymentSummary,
    deriveInvoiceState,
    filterInvoices,
    getAllowedActions,
    getInvoicePayments,
    hydrateInvoice,
    isValidDate,
    matchesInvoiceSnapshot,
    mergeById,
    nextInvoiceNumber,
    normalizeText,
    persistInvoiceTransition,
    readInvoiceTransition,
    readInvoiceTransitionSettings,
    readInvoiceStorage,
    round,
    runSerializedInvoiceMutation,
    resolveEstimatedTaxForNewInvoice,
    validateInvoice,
    validateInvoiceStorage,
    validatePayment
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowInvoiceModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
