const test = require('node:test');
const assert = require('node:assert/strict');

let model;
try {
  model = require('../assets/js/invoice-model.js');
} catch {
  model = {};
}

const invoices = [
  {
    id: 'fac_sent',
    numero_factura: 'FAC-0100',
    cliente_id: 'cli_001',
    proyecto_relacionado_id: 'proy_001',
    fecha_emision: '2026-06-01',
    fecha_vencimiento: '2026-06-30',
    moneda: 'USD',
    estado: 'SENT',
    items: [{ descripcion_item: 'Diseño', cantidad: 2, precio_unitario: 500 }],
    descuento: 50,
    impuestos: 142.5
  },
  {
    id: 'fac_overdue',
    numero_factura: 'FAC-0099',
    cliente_id: 'cli_002',
    fecha_emision: '2026-05-01',
    fecha_vencimiento: '2026-05-15',
    moneda: 'USD',
    estado: 'OVERDUE',
    items: [{ descripcion_item: 'Consultoría', cantidad: 1, precio_unitario: 600 }]
  },
  {
    id: 'fac_paid',
    numero_factura: 'FAC-0098',
    cliente_id: 'cli_001',
    fecha_emision: '2026-06-02',
    fecha_vencimiento: '2026-06-15',
    moneda: 'USD',
    estado: 'PAID',
    items: [{ descripcion_item: 'Mantenimiento', cantidad: 1, precio_unitario: 500 }]
  },
  {
    id: 'fac_void',
    numero_factura: 'FAC-0097',
    cliente_id: 'cli_001',
    fecha_emision: '2026-06-02',
    fecha_vencimiento: '2026-06-15',
    moneda: 'USD',
    estado: 'VOID',
    items: [{ descripcion_item: 'Anulada', cantidad: 1, precio_unitario: 400 }]
  }
];

const payments = [
  { id: 'pay_1', factura_id: 'fac_paid', monto_pagado: 500, fecha_pago: '2026-06-10', metodo_pago: 'Transferencia' },
  { id: 'pay_2', factura_id: 'fac_overdue', monto_pagado: 100, fecha_pago: '2026-06-05', metodo_pago: 'PayPal' }
];

test('expone la API pública del modelo de facturas', () => {
  for (const name of [
    'calculateInvoiceTotals',
    'calculatePaymentSummary',
    'deriveInvoiceState',
    'calculateInvoiceMetrics',
    'filterInvoices',
    'getAllowedActions',
    'validateInvoice',
    'validatePayment'
  ]) assert.equal(typeof model[name], 'function', `${name} debe existir`);
});

test('calcula subtotal, descuento, impuestos y total sin permitir edición manual del total', () => {
  const result = model.calculateInvoiceTotals(invoices[0]);
  assert.deepEqual(result, {
    subtotal: 1000,
    descuento: 50,
    impuestos: 142.5,
    total: 1092.5
  });
});

test('calcula pago acumulado, saldo pendiente y saldo a favor', () => {
  const partial = model.calculatePaymentSummary(invoices[1], payments);
  const credit = model.calculatePaymentSummary(invoices[2], [
    ...payments,
    { factura_id: 'fac_paid', monto_pagado: 25, fecha_pago: '2026-06-11' }
  ]);

  assert.deepEqual(partial, { paid: 100, pending: 500, credit: 0 });
  assert.deepEqual(credit, { paid: 525, pending: 0, credit: 25 });
});

test('deriva estados por pagos y vencimiento sin alterar borradores ni anuladas', () => {
  const base = {
    ...invoices[0],
    items: [{ descripcion_item: 'Servicio', cantidad: 1, precio_unitario: 100 }],
    descuento: 0,
    impuestos: 0
  };
  assert.equal(model.deriveInvoiceState({ ...base, estado: 'DRAFT' }, [], '2026-07-01'), 'DRAFT');
  assert.equal(model.deriveInvoiceState({ ...base, estado: 'VOID' }, [], '2026-07-01'), 'VOID');
  assert.equal(model.deriveInvoiceState(base, [], '2026-07-01'), 'OVERDUE');
  assert.equal(model.deriveInvoiceState(base, [{ factura_id: base.id, monto_pagado: 40 }], '2026-06-15'), 'PARTIAL');
  assert.equal(model.deriveInvoiceState(base, [{ factura_id: base.id, monto_pagado: 100 }], '2026-06-15'), 'PAID');
});

test('calcula KPIs excluyendo borradores y anuladas y usa la fecha real del pago', () => {
  const result = model.calculateInvoiceMetrics(invoices, payments, {
    period: '2026-06',
    today: '2026-06-21'
  });

  assert.equal(result.pendingAmount, 1592.5);
  assert.equal(result.overdueAmount, 500);
  assert.equal(result.overdueCount, 1);
  assert.equal(result.collectedAmount, 600);
  assert.equal(result.pendingCount, 2);
});

test('filtra por texto sin acentos, estado, cliente, proyecto y período', () => {
  const clients = [
    { id: 'cli_001', nombre_razon_social: 'Bodega Andina S.A.' },
    { id: 'cli_002', nombre_razon_social: 'Estudio Ágil' }
  ];
  const projects = [{ id: 'proy_001', nombre_proyecto: 'Rediseño web' }];
  const result = model.filterInvoices(invoices, clients, projects, payments, {
    query: 'agil consultoria',
    status: 'OVERDUE',
    clientId: 'cli_002',
    projectId: 'todos',
    period: '2026-05',
    today: '2026-06-21'
  });

  assert.deepEqual(result.map((invoice) => invoice.id), ['fac_overdue']);
});

test('define acciones permitidas para cada estado y bloquea anular una pagada', () => {
  assert.deepEqual(model.getAllowedActions('DRAFT'), ['view', 'edit', 'send', 'void', 'download']);
  assert.deepEqual(model.getAllowedActions('PARTIAL'), ['view', 'pay', 'void', 'download', 'copyLink']);
  assert.equal(model.getAllowedActions('PAID').includes('void'), false);
  assert.deepEqual(model.getAllowedActions('VOID'), ['view', 'download']);
});

test('valida integridad aritmética y campos obligatorios de una factura', () => {
  const result = model.validateInvoice({
    cliente_id: '',
    fecha_emision: '2026-06-20',
    fecha_vencimiento: '2026-06-19',
    moneda: '',
    items: [{ descripcion_item: '', cantidad: 0, precio_unitario: -1 }]
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.cliente_id, 'Selecciona un cliente.');
  assert.equal(result.errors.fecha_vencimiento, 'La fecha de vencimiento no puede ser anterior a la fecha de emisión.');
  assert.equal(result.errors.moneda, 'Selecciona una moneda.');
  assert.ok(result.errors.items);
  assert.equal(result.errors.total, 'El total de la factura no puede ser cero o negativo.');
});

test('valida pagos y advierte un excedente sin bloquearlo', () => {
  const invalid = model.validatePayment({ monto_pagado: 0, fecha_pago: '2026-06-22', metodo_pago: '' }, 300, '2026-06-21');
  const overpayment = model.validatePayment({ monto_pagado: 350, fecha_pago: '2026-06-20', metodo_pago: 'Transferencia' }, 300, '2026-06-21');

  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.monto_pagado, 'El monto del pago debe ser mayor a 0.');
  assert.equal(invalid.errors.fecha_pago, 'La fecha de pago no puede ser futura.');
  assert.equal(invalid.errors.metodo_pago, 'Selecciona un método de pago.');
  assert.equal(overpayment.valid, true);
  assert.equal(overpayment.excess, 50);
});

test('snapshots the current enabled fiscal default for new invoices without changing historical records', () => {
  const draft = { items: [{ descripcion_item: 'Service', cantidad: 2, precio_unitario: 100 }], descuento: 0 };
  const first = model.resolveEstimatedTaxForNewInvoice(draft, { aplica_impuesto_valor_agregado: true, porcentaje_impuesto: 12 });
  const second = model.resolveEstimatedTaxForNewInvoice(draft, { aplica_impuesto_valor_agregado: true, porcentaje_impuesto: 15 });
  const manualTwelve = model.resolveEstimatedTaxForNewInvoice({ ...draft, impuestos: 12 }, { aplica_impuesto_valor_agregado: true, porcentaje_impuesto: 15 });
  const manualZero = model.resolveEstimatedTaxForNewInvoice({ ...draft, impuestos: 0 }, { aplica_impuesto_valor_agregado: true, porcentaje_impuesto: 15 });

  assert.equal(first, 24);
  assert.equal(second, 30);
  assert.equal(manualTwelve, 12);
  assert.equal(manualZero, 0);
  assert.equal(model.calculateInvoiceTotals({ ...draft, impuestos: first }).impuestos, 24);
  assert.equal(model.resolveEstimatedTaxForNewInvoice(draft, { aplica_impuesto_valor_agregado: 'true', porcentaje_impuesto: 12 }), 0);
});

test('keeps an editable stored tax amount durable through hydrate and totals', () => {
  const saved = { ...invoices[0], impuestos: 35.5 };
  const reloaded = model.hydrateInvoice(saved);
  assert.equal(reloaded.impuestos, 35.5);
  assert.equal(reloaded.total_factura, 985.5);
});

test('keeps the persisted historical tax snapshot unchanged after the fiscal default changes', () => {
  const invoice = {
    id: 'fac_snapshot',
    items: [{ descripcion_item: 'Service', cantidad: 1, precio_unitario: 200 }],
    impuestos: model.resolveEstimatedTaxForNewInvoice({ items: [{ cantidad: 1, precio_unitario: 200 }] }, { aplica_impuesto_valor_agregado: true, porcentaje_impuesto: 12 })
  };
  const laterDefault = model.resolveEstimatedTaxForNewInvoice(invoice, { aplica_impuesto_valor_agregado: true, porcentaje_impuesto: 15 });

  assert.equal(invoice.impuestos, 24);
  assert.equal(laterDefault, 24);
  assert.equal(model.hydrateInvoice(invoice).impuestos, 24);
});

test('commits an edited applied value that remains durable when the saved invoice is re-read', () => {
  const existing = [{ id: 'fac_edit', items: [{ cantidad: 1, precio_unitario: 100 }], impuestos: 12 }];
  let durable = [];
  const result = model.commitInvoiceRecord(existing, { ...existing[0], impuestos: 35.5 }, (next) => { durable = next; return true; });

  assert.equal(result.committed, true);
  assert.equal(model.hydrateInvoice(durable[0]).impuestos, 35.5);
});

test('does not commit state or record success activity when durable invoice storage fails', () => {
  const existing = [{ id: 'fac_failure', impuestos: 12 }];
  const activity = [];
  const result = model.commitInvoiceRecord(existing, { id: 'fac_failure', impuestos: 35.5 }, () => false, () => activity.push('activity'));

  assert.equal(result.committed, false);
  assert.strictEqual(result.invoices, existing);
  assert.deepEqual(activity, []);
});

test('records invoice activity only after successful durable persistence', () => {
  const events = [];
  const result = model.commitInvoiceRecord([], { id: 'fac_order', impuestos: 12 }, () => { events.push('persist'); return true; }, () => events.push('activity'));

  assert.equal(result.committed, true);
  assert.deepEqual(events, ['persist', 'activity']);
});

test('does not send an invoice or record activity when durable persistence fails', () => {
  const existingInvoices = [{ id: 'fac_send', estado: 'DRAFT' }];
  const existingPayments = [];
  const activity = [];
  const result = model.commitInvoiceTransition(
    existingInvoices,
    existingPayments,
    [{ ...existingInvoices[0], estado: 'SENT' }],
    existingPayments,
    () => false,
    () => activity.push('activity')
  );

  assert.equal(result.committed, false);
  assert.strictEqual(result.invoices, existingInvoices);
  assert.strictEqual(result.payments, existingPayments);
  assert.deepEqual(activity, []);
});

test('does not void an invoice or record activity when durable persistence fails', () => {
  const existingInvoices = [{ id: 'fac_void_failure', estado: 'SENT', saldo_pendiente: 100 }];
  const existingPayments = [];
  const activity = [];
  const result = model.commitInvoiceTransition(
    existingInvoices,
    existingPayments,
    [{ ...existingInvoices[0], estado: 'VOID', saldo_pendiente: 0 }],
    existingPayments,
    () => false,
    () => activity.push('activity')
  );

  assert.equal(result.committed, false);
  assert.strictEqual(result.invoices, existingInvoices);
  assert.strictEqual(result.payments, existingPayments);
  assert.deepEqual(activity, []);
});

test('does not register a payment or record activity when durable persistence fails', () => {
  const existingInvoices = [{ id: 'fac_pay', estado: 'SENT', saldo_pendiente: 100 }];
  const existingPayments = [];
  const activity = [];
  const nextPayment = { id: 'pay_failure', factura_id: 'fac_pay', monto_pagado: 100 };
  const result = model.commitInvoiceTransition(
    existingInvoices,
    existingPayments,
    [{ ...existingInvoices[0], estado: 'PAID', saldo_pendiente: 0 }],
    [...existingPayments, nextPayment],
    () => false,
    () => activity.push('activity')
  );

  assert.equal(result.committed, false);
  assert.strictEqual(result.invoices, existingInvoices);
  assert.strictEqual(result.payments, existingPayments);
  assert.deepEqual(activity, []);
});

test('records transition activity only after its invoice and payment snapshot persists', () => {
  const events = [];
  const result = model.commitInvoiceTransition(
    [{ id: 'fac_order', estado: 'SENT' }],
    [],
    [{ id: 'fac_order', estado: 'PAID' }],
    [{ id: 'pay_order', factura_id: 'fac_order', monto_pagado: 100 }],
    () => { events.push('persist'); return true; },
    () => events.push('activity')
  );

  assert.equal(result.committed, true);
  assert.deepEqual(events, ['persist', 'activity']);
  assert.equal(result.invoices[0].estado, 'PAID');
  assert.equal(result.payments.length, 1);
});

test('recovers only the last committed invoice snapshot when the second staged write fails', () => {
  const entries = new Map();
  const writes = [];
  let failKey = null;
  const storage = {
    getItem(key) { return entries.has(key) ? entries.get(key) : null; },
    setItem(key, value) {
      writes.push(key);
      if (key === failKey) throw new Error('Storage blocked');
      entries.set(key, value);
    }
  };
  const transitionKey = 'invoice-transition';
  const committed = {
    invoices: [validPaidInvoice({ id: 'fac_before' })],
    payments: [validStoredPayment({ id: 'pay_before', factura_id: 'fac_before' })]
  };
  const candidate = {
    invoices: [validPaidInvoice({ id: 'fac_after' })],
    payments: [validStoredPayment({ id: 'pay_after', factura_id: 'fac_after' })]
  };

  assert.equal(model.persistInvoiceTransition(storage, transitionKey, committed.invoices, committed.payments, 'committed', invoiceReferences), true);
  failKey = `${transitionKey}:failed:payments`;

  assert.equal(model.persistInvoiceTransition(storage, transitionKey, candidate.invoices, candidate.payments, 'failed', invoiceReferences), false);
  assert.deepEqual(writes.slice(-2), [`${transitionKey}:failed:invoices`, `${transitionKey}:failed:payments`]);
  assert.deepEqual(model.readInvoiceTransition(storage, transitionKey, invoiceReferences), committed);
});

test('recovers both legacy invoice keys when no transition marker exists', () => {
  const invoices = [validPaidInvoice({ id: 'fac_legacy' })];
  const payments = [validStoredPayment({ id: 'pay_legacy', factura_id: 'fac_legacy' })];
  const entries = new Map([
    ['freelanceflow_invoices_v1', JSON.stringify(invoices)],
    ['freelanceflow_invoice_payments_v1', JSON.stringify(payments)]
  ]);
  const storage = { getItem(key) { return entries.has(key) ? entries.get(key) : null; } };

  assert.deepEqual(
    model.readInvoiceStorage(storage, 'freelanceflow_invoice_transition_v1', 'freelanceflow_invoices_v1', 'freelanceflow_invoice_payments_v1', invoiceReferences),
    { invoices, payments }
  );
});

const invoiceReferences = {
  clients: [{ id: 'cli_001' }, { id: 'cli_002' }],
  projects: [{ id: 'proy_001', cliente_id: 'cli_001' }]
};

function validStoredInvoice(overrides = {}) {
  return {
    id: 'fac_schema',
    numero_factura: 'FAC-0200',
    cliente_id: 'cli_001',
    proyecto_relacionado_id: 'proy_001',
    fecha_emision: '2026-06-01',
    fecha_vencimiento: '2026-06-30',
    moneda: 'USD',
    estado: 'SENT',
    items: [{ id: 'item_schema', descripcion_item: 'Servicio', cantidad: 1, precio_unitario: 100 }],
    descuento: 0,
    impuestos: 0,
    total_factura: 100,
    monto_pagado_acumulado: 0,
    saldo_pendiente: 100,
    ...overrides
  };
}

function validStoredPayment(overrides = {}) {
  return {
    id: 'pay_schema',
    factura_id: 'fac_schema',
    monto_pagado: 100,
    fecha_pago: '2026-06-02',
    metodo_pago: 'Transferencia bancaria',
    ...overrides
  };
}

function validPaidInvoice(overrides = {}) {
  return validStoredInvoice({
    estado: 'PAID',
    monto_pagado_acumulado: 100,
    saldo_pendiente: 0,
    ...overrides
  });
}

test('FF-INV-002 rejects malformed, unknown-version, and invalid persisted invoice snapshots', () => {
  const valid = { invoices: [validPaidInvoice()], payments: [validStoredPayment()] };
  assert.equal(model.validateInvoiceStorage(valid.invoices, valid.payments, invoiceReferences).valid, true);

  for (const invalid of [
    { invoices: {}, payments: [] },
    { invoices: [{ ...valid.invoices[0], id: '' }], payments: [] },
    { invoices: [valid.invoices[0], { ...valid.invoices[0] }], payments: [] },
    { invoices: [{ ...valid.invoices[0], fecha_emision: '2026-02-30' }], payments: [] },
    { invoices: [{ ...valid.invoices[0], estado: 'UNKNOWN' }], payments: [] },
    { invoices: [{ ...valid.invoices[0], moneda: 'EUR' }], payments: [] },
    { invoices: [{ ...valid.invoices[0], impuestos: Infinity }], payments: [] },
    { invoices: [{ ...valid.invoices[0], descuento: -1 }], payments: [] },
    { invoices: [{ ...valid.invoices[0], cliente_id: 'cli_missing' }], payments: [] },
    { invoices: [{ ...valid.invoices[0], proyecto_relacionado_id: 'proy_missing' }], payments: [] },
    { invoices: [{ ...valid.invoices[0], cliente_id: 'cli_002' }], payments: [] },
    { invoices: [valid.invoices[0]], payments: [{ ...valid.payments[0], factura_id: 'fac_missing' }] },
    { invoices: [valid.invoices[0]], payments: [{ ...valid.payments[0], monto_pagado: -1 }] },
    { invoices: [valid.invoices[0]], payments: [valid.payments[0], { ...valid.payments[0] }] }
  ]) assert.equal(model.validateInvoiceStorage(invalid.invoices, invalid.payments, invoiceReferences).valid, false);
});

test('FF-INV-002 requires persisted invoice totals while accepting established optional aggregates', () => {
  const canonical = validStoredInvoice();
  for (const field of ['total_factura', 'monto_pagado_acumulado', 'saldo_pendiente']) {
    const invoice = { ...canonical };
    delete invoice[field];
    assert.equal(model.validateInvoiceStorage([invoice], [], invoiceReferences).valid, false, `${field} is required`);
  }

  for (const field of ['subtotal_general', 'saldo_a_favor']) {
    const invoice = { ...canonical };
    delete invoice[field];
    assert.equal(model.validateInvoiceStorage([invoice], [], invoiceReferences).valid, true, `${field} remains backward-compatible`);
  }
});

test('FF-INV-002 keeps durable transition and activity unchanged when a candidate fails storage validation', () => {
  const existingInvoices = [validStoredInvoice({ estado: 'DRAFT' })];
  const existingPayments = [];
  const activity = [];
  const writes = [];
  const storage = {
    getItem() { return null; },
    setItem(key) { writes.push(key); }
  };
  const persist = (invoices, payments) => model.persistInvoiceTransition(
    storage,
    'invoice-transition',
    invoices,
    payments,
    'invalid-candidate',
    invoiceReferences
  );
  const result = model.commitInvoiceTransition(
    existingInvoices,
    existingPayments,
    [{ ...existingInvoices[0], cliente_id: 'cli_missing', estado: 'SENT' }],
    existingPayments,
    persist,
    () => activity.push('activity')
  );

  assert.equal(result.committed, false);
  assert.strictEqual(result.invoices, existingInvoices);
  assert.strictEqual(result.payments, existingPayments);
  assert.deepEqual(activity, []);
  assert.deepEqual(writes, []);
});

test('FF-INV-002 reads only a valid versioned marker snapshot and retains the valid legacy fallback', () => {
  const entries = new Map([
    ['transition', JSON.stringify({ version: 999, transactionId: 'unknown' })],
    ['invoices', JSON.stringify([validPaidInvoice()])],
    ['payments', JSON.stringify([validStoredPayment()])]
  ]);
  const storage = { getItem(key) { return entries.has(key) ? entries.get(key) : null; } };
  assert.deepEqual(
    model.readInvoiceStorage(storage, 'transition', 'invoices', 'payments', invoiceReferences),
    { invoices: [validPaidInvoice()], payments: [validStoredPayment()] }
  );

  entries.set('transition', JSON.stringify({ transactionId: 'legacy-marker' }));
  entries.set('transition:legacy-marker:invoices', JSON.stringify([validPaidInvoice()]));
  entries.set('transition:legacy-marker:payments', JSON.stringify([validStoredPayment()]));
  assert.deepEqual(
    model.readInvoiceStorage(storage, 'transition', 'invoices', 'payments', invoiceReferences),
    { invoices: [validPaidInvoice()], payments: [validStoredPayment()] }
  );

  entries.set('transition', JSON.stringify({ version: model.INVOICE_STORAGE_VERSION, transactionId: 'valid' }));
  entries.set('transition:valid:invoices', JSON.stringify({ version: model.INVOICE_STORAGE_VERSION, invoices: [validPaidInvoice()] }));
  entries.set('transition:valid:payments', JSON.stringify({ version: model.INVOICE_STORAGE_VERSION, payments: [validStoredPayment()] }));
  assert.deepEqual(
    model.readInvoiceStorage(storage, 'transition', 'invoices', 'payments', invoiceReferences),
    { invoices: [validPaidInvoice()], payments: [validStoredPayment()] }
  );
});

test('FF-INV-002 rejects unknown fields while retaining established invoice, item, and payment compatibility fields', () => {
  const compatibleInvoice = validStoredInvoice({
    subtotal_general: 100,
    saldo_a_favor: 0,
    fecha_anulacion: undefined,
    motivo_anulacion: undefined,
    items: [{ id: 'item_schema', origen_item: 'Manual', descripcion_item: 'Servicio', cantidad: 1, precio_unitario: 100 }]
  });
  const compatiblePayment = validStoredPayment({ referencia_comprobante: 'TRX-1', notas: 'Confirmed' });
  const paidInvoice = validPaidInvoice({
    items: compatibleInvoice.items,
    subtotal_general: 100,
    saldo_a_favor: 0
  });

  assert.equal(model.validateInvoiceStorage([compatibleInvoice], [], invoiceReferences).valid, true);
  assert.equal(model.validateInvoiceStorage([paidInvoice], [compatiblePayment], invoiceReferences).valid, true);
  assert.equal(model.validateInvoiceStorage([{ ...compatibleInvoice, forged: true }], [], invoiceReferences).valid, false);
  assert.equal(model.validateInvoiceStorage([{ ...compatibleInvoice, items: [{ ...compatibleInvoice.items[0], forged: true }] }], [], invoiceReferences).valid, false);
  assert.equal(model.validateInvoiceStorage([paidInvoice], [{ ...compatiblePayment, forged: true }], invoiceReferences).valid, false);
});

test('FF-INV-002 rejects persisted invoice totals that do not match the current rounding semantics', () => {
  const invoice = validStoredInvoice({
    items: [{ id: 'item_rounding', origen_item: 'Manual', descripcion_item: 'Fractional service', cantidad: 3, precio_unitario: 0.1 }],
    descuento: 0.1,
    impuestos: 0.2,
    total_factura: 0.4,
    saldo_pendiente: 0.4
  });

  assert.equal(model.validateInvoiceStorage([invoice], [], invoiceReferences).valid, true);
  assert.equal(model.validateInvoiceStorage([{ ...invoice, total_factura: 0.39 }], [], invoiceReferences).valid, false);
});

test('FF-INV-002 rejects persisted payment aggregates that disagree with linked payments and total', () => {
  const invoice = validPaidInvoice({ monto_pagado_acumulado: 120, saldo_pendiente: 0, saldo_a_favor: 20 });
  const payment = validStoredPayment({ monto_pagado: 120 });

  assert.equal(model.validateInvoiceStorage([invoice], [payment], invoiceReferences).valid, true);
  assert.equal(model.validateInvoiceStorage([{ ...invoice, monto_pagado_acumulado: 119 }], [payment], invoiceReferences).valid, false);
  assert.equal(model.validateInvoiceStorage([{ ...invoice, saldo_pendiente: 1 }], [payment], invoiceReferences).valid, false);
  assert.equal(model.validateInvoiceStorage([{ ...invoice, saldo_a_favor: 0 }], [payment], invoiceReferences).valid, false);
});

test('FF-INV-002 rejects invoice states that are incompatible with their financial position', () => {
  const partialPayment = validStoredPayment({ monto_pagado: 25 });
  const partialInvoice = validStoredInvoice({ estado: 'PARTIAL', monto_pagado_acumulado: 25, saldo_pendiente: 75 });
  const paidInvoice = validPaidInvoice();
  const voidInvoice = validStoredInvoice({ estado: 'VOID', saldo_pendiente: 0, motivo_anulacion: 'Duplicate issue', fecha_anulacion: '2026-06-02' });

  assert.equal(model.validateInvoiceStorage([validStoredInvoice()], [], invoiceReferences).valid, true);
  assert.equal(model.validateInvoiceStorage([partialInvoice], [partialPayment], invoiceReferences).valid, true);
  assert.equal(model.validateInvoiceStorage([paidInvoice], [validStoredPayment()], invoiceReferences).valid, true);
  assert.equal(model.validateInvoiceStorage([voidInvoice], [], invoiceReferences).valid, true);
  assert.equal(model.validateInvoiceStorage([validStoredInvoice()], [validStoredPayment()], invoiceReferences).valid, false);
  assert.equal(model.validateInvoiceStorage([validStoredInvoice({ estado: 'PARTIAL', monto_pagado_acumulado: 0, saldo_pendiente: 100 })], [], invoiceReferences).valid, false);
  assert.equal(model.validateInvoiceStorage([validStoredInvoice({ estado: 'PAID', monto_pagado_acumulado: 0, saldo_pendiente: 100 })], [], invoiceReferences).valid, false);
  assert.equal(model.validateInvoiceStorage([voidInvoice], [validStoredPayment()], invoiceReferences).valid, false);
  assert.equal(model.validateInvoiceStorage([validStoredInvoice({ estado: 'DRAFT' })], [validStoredPayment()], invoiceReferences).valid, false);
});

test('FF-INV-002 hydrates a valid persisted VOID invoice without restoring a receivable balance', () => {
  const persisted = validStoredInvoice({
    id: 'fac_void_hydration',
    estado: 'VOID',
    saldo_pendiente: 0,
    saldo_a_favor: 0,
    fecha_anulacion: '2026-06-02',
    motivo_anulacion: 'Duplicate issue'
  });

  assert.equal(model.validateInvoiceStorage([persisted], [], invoiceReferences).valid, true);

  const hydrated = model.hydrateInvoice(persisted, [], '2026-07-01');
  assert.equal(hydrated.estado, 'VOID');
  assert.equal(hydrated.monto_pagado_acumulado, 0);
  assert.equal(hydrated.saldo_pendiente, 0);
  assert.equal(hydrated.saldo_a_favor, 0);
});

test('FF-INV-002 hydrates a persisted past-due SENT invoice as OVERDUE', () => {
  const persisted = validStoredInvoice({
    id: 'fac_sent_overdue_hydration',
    fecha_vencimiento: '2026-06-30'
  });

  assert.equal(model.validateInvoiceStorage([persisted], [], invoiceReferences).valid, true);

  const hydrated = model.hydrateInvoice(persisted, [], '2026-07-01');
  assert.equal(hydrated.estado, 'OVERDUE');
  assert.equal(hydrated.saldo_pendiente, 100);
  assert.equal(hydrated.saldo_a_favor, 0);
});

test('FF-INV-002 accepts only matching versioned marker staging and direct legacy keys without a valid marker', () => {
  const direct = { invoices: [validStoredInvoice({ id: 'fac_direct' })], payments: [] };
  const staged = { invoices: [validStoredInvoice({ id: 'fac_staged' })], payments: [] };
  const entries = new Map([
    ['invoices', JSON.stringify(direct.invoices)],
    ['payments', JSON.stringify(direct.payments)]
  ]);
  const storage = { getItem(key) { return entries.has(key) ? entries.get(key) : null; } };

  assert.deepEqual(model.readInvoiceStorage(storage, 'transition', 'invoices', 'payments', invoiceReferences), direct);

  entries.set('transition', JSON.stringify({ transactionId: 'legacy' }));
  entries.set('transition:legacy:invoices', JSON.stringify(staged.invoices));
  entries.set('transition:legacy:payments', JSON.stringify(staged.payments));
  assert.deepEqual(model.readInvoiceStorage(storage, 'transition', 'invoices', 'payments', invoiceReferences), direct);

  entries.set('transition', JSON.stringify({ version: model.INVOICE_STORAGE_VERSION, transactionId: 'versioned' }));
  entries.set('transition:versioned:invoices', JSON.stringify({ version: model.INVOICE_STORAGE_VERSION + 1, invoices: staged.invoices }));
  entries.set('transition:versioned:payments', JSON.stringify({ version: model.INVOICE_STORAGE_VERSION, payments: staged.payments }));
  assert.deepEqual(model.readInvoiceStorage(storage, 'transition', 'invoices', 'payments', invoiceReferences), { invoices: [], payments: [] });

  entries.set('transition:versioned:invoices', JSON.stringify({ version: model.INVOICE_STORAGE_VERSION, invoices: staged.invoices }));
  assert.deepEqual(model.readInvoiceStorage(storage, 'transition', 'invoices', 'payments', invoiceReferences), staged);
});

test('FF-INV-002 fails closed before persistence or success activity for financial boundary violations', () => {
  const existingInvoices = [validStoredInvoice()];
  const writes = [];
  const activity = [];
  const storage = {
    getItem() { return null; },
    setItem(key) { writes.push(key); }
  };
  const result = model.commitInvoiceTransition(
    existingInvoices,
    [],
    [{ ...existingInvoices[0], total_factura: 99 }],
    [],
    (nextInvoices, nextPayments) => model.persistInvoiceTransition(storage, 'transition', nextInvoices, nextPayments, 'invalid-total', invoiceReferences),
    () => activity.push('activity')
  );

  assert.equal(result.committed, false);
  assert.strictEqual(result.invoices, existingInvoices);
  assert.deepEqual(writes, []);
  assert.deepEqual(activity, []);
});
