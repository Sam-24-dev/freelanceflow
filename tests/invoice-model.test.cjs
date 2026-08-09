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
