const test = require('node:test');
const assert = require('node:assert/strict');
const { jsPDF } = require('jspdf');

const pdf = require('../assets/js/invoice-pdf.js');

const invoice = {
  id: 'fac_024',
  numero_factura: 'FAC-0024',
  estado: 'DRAFT',
  fecha_emision: '2026-06-20',
  fecha_vencimiento: '2026-07-10',
  moneda: 'USD',
  subtotal_general: 700,
  descuento: 0,
  impuestos: 0,
  total_factura: 700,
  monto_pagado_acumulado: 0,
  saldo_pendiente: 700,
  saldo_a_favor: 0,
  items: [
    {
      descripcion_item: 'Auditoría de experiencia para campaña',
      cantidad: 1,
      precio_unitario: 700
    }
  ]
};

test('buildInvoicePdfDescriptor contains invoice-only data and no browser print metadata', () => {
  const descriptor = pdf.buildInvoicePdfDescriptor({
    invoice,
    client: {
      nombre_razon_social: 'BrightWave Marketing LLC',
      correo: 'daniel.morrison@brightwavemkt.com'
    },
    project: null,
    payments: []
  });

  const serialized = JSON.stringify(descriptor);
  assert.equal(descriptor.fileName, 'FreelanceFlow-FAC-0024.pdf');
  assert.equal(descriptor.header.number, 'FAC-0024');
  assert.equal(descriptor.parties.clientName, 'BrightWave Marketing LLC');
  assert.equal(descriptor.totals.pendingDisplay, 'No exigible');
  assert.equal(descriptor.items[0].lineTotal, '$700.00');
  assert.equal(descriptor.payments.length, 0);
  assert.doesNotMatch(serialized, /127\.0\.0\.1|localhost|facturas\.html|Vista previa preparada|FreelanceFlow \\| Facturas/i);
});

test('buildInvoicePdfDescriptor shows paid invoices and client credit correctly', () => {
  const descriptor = pdf.buildInvoicePdfDescriptor({
    invoice: {
      ...invoice,
      estado: 'PAID',
      monto_pagado_acumulado: 725,
      saldo_pendiente: 0,
      saldo_a_favor: 25
    },
    client: { nombre_razon_social: 'Bodega Andina S.A.' },
    project: { nombre_proyecto: 'Mantenimiento mensual plataforma e-commerce' },
    payments: [{ fecha_pago: '2026-06-21', monto_pagado: 725, metodo_pago: 'Transferencia bancaria', referencia_comprobante: 'TRX-1' }]
  });

  assert.equal(descriptor.totals.pendingDisplay, '$0.00');
  assert.equal(descriptor.totals.credit, '$25.00');
  assert.equal(descriptor.payments[0].amount, '$725.00');
  assert.equal(descriptor.parties.projectName, 'Mantenimiento mensual plataforma e-commerce');
});

test('renderInvoicePDF creates a one-page invoice document without browser URL metadata', () => {
  const descriptor = pdf.buildInvoicePdfDescriptor({
    invoice,
    client: { nombre_razon_social: 'BrightWave Marketing LLC' },
    project: null,
    payments: []
  });
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });

  pdf.renderInvoicePDF(doc, descriptor);
  const bytes = Buffer.from(doc.output('arraybuffer'));
  const content = bytes.toString('latin1');

  assert.equal(doc.getNumberOfPages(), 1);
  assert.match(content, /^%PDF-/);
  assert.doesNotMatch(content, /127\.0\.0\.1|localhost|facturas\.html|Vista previa preparada|FreelanceFlow \| Facturas/i);
});
