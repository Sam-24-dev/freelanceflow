((globalScope) => {
  'use strict';

  const STATUS_COPY = {
    DRAFT: 'Borrador',
    SENT: 'Enviada',
    PARTIAL: 'Parcial',
    PAID: 'Pagada',
    OVERDUE: 'Vencida',
    VOID: 'Anulada'
  };

  function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function formatCurrency(value, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(toNumber(value));
  }

  function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(`${value}T00:00:00Z`));
  }

  function safeText(value, fallback = 'No disponible') {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return text || fallback;
  }

  function fileSafe(value) {
    return safeText(value, 'factura').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
  }

  function pendingDisplay(invoice) {
    if (invoice.estado === 'DRAFT') return 'No exigible';
    if (invoice.estado === 'VOID') return 'Anulada';
    return formatCurrency(invoice.saldo_pendiente, invoice.moneda);
  }

  function buildInvoicePdfDescriptor({ invoice, client, project, payments = [] }) {
    const currency = invoice.moneda || 'USD';
    return {
      fileName: `FreelanceFlow-${fileSafe(invoice.numero_factura)}.pdf`,
      header: {
        eyebrow: 'Detalle de factura',
        number: safeText(invoice.numero_factura, 'Factura'),
        status: STATUS_COPY[invoice.estado] ?? safeText(invoice.estado, 'Sin estado'),
        timing: invoice.estado === 'DRAFT' ? 'Pendiente de envío' : ''
      },
      parties: {
        clientName: safeText(client?.nombre_razon_social, 'Cliente no disponible'),
        clientEmail: safeText(client?.correo ?? client?.correo_electronico, ''),
        projectName: safeText(project?.nombre_proyecto, 'Sin proyecto asociado'),
        issuedAt: formatDate(invoice.fecha_emision),
        dueAt: formatDate(invoice.fecha_vencimiento)
      },
      items: (invoice.items ?? []).map((item) => {
        const quantity = toNumber(item.cantidad);
        const price = toNumber(item.precio_unitario);
        return {
          description: safeText(item.descripcion_item, 'Concepto sin descripción'),
          quantity: String(quantity || ''),
          price: formatCurrency(price, currency),
          lineTotal: formatCurrency(quantity * price, currency)
        };
      }),
      totals: {
        subtotal: formatCurrency(invoice.subtotal_general, currency),
        discount: toNumber(invoice.descuento) > 0 ? formatCurrency(invoice.descuento, currency) : '',
        tax: formatCurrency(invoice.impuestos, currency),
        total: formatCurrency(invoice.total_factura, currency),
        paid: formatCurrency(invoice.monto_pagado_acumulado, currency),
        pendingDisplay: pendingDisplay(invoice),
        credit: toNumber(invoice.saldo_a_favor) > 0 ? formatCurrency(invoice.saldo_a_favor, currency) : ''
      },
      payments: payments.map((payment) => ({
        date: formatDate(payment.fecha_pago),
        amount: formatCurrency(payment.monto_pagado, currency),
        method: safeText(payment.metodo_pago, 'Método no registrado'),
        reference: safeText(payment.referencia_comprobante, 'Sin referencia')
      }))
    };
  }

  function drawTextBlock(doc, lines, x, y, options = {}) {
    const lineHeight = options.lineHeight ?? 5;
    const maxWidth = options.maxWidth ?? 170;
    let cursorY = y;
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(String(line), maxWidth);
      doc.text(wrapped, x, cursorY);
      cursorY += wrapped.length * lineHeight;
    });
    return cursorY;
  }

  function ensureSpace(doc, cursorY, needed = 24) {
    if (cursorY + needed <= 276) return cursorY;
    doc.addPage();
    return 24;
  }

  function addSectionTitle(doc, title, y) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(String(title).toUpperCase(), 18, y);
    return y + 8;
  }

  function setPdfTextColor(doc, color) {
    if (Array.isArray(color)) doc.setTextColor(color[0], color[1], color[2]);
    else doc.setTextColor(color);
  }

  function addKeyValue(doc, label, value, x, y, options = {}) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(String(label).toUpperCase(), x, y);
    doc.setFont('helvetica', options.boldValue ? 'bold' : 'normal');
    doc.setFontSize(options.valueSize ?? 8);
    setPdfTextColor(doc, options.color ?? [15, 23, 42]);
    return drawTextBlock(doc, [value], x, y + 5, { maxWidth: options.maxWidth ?? 78, lineHeight: 4.8 });
  }

  function renderInvoicePDF(doc, descriptor) {
    doc.setProperties({
      title: descriptor.header.number,
      subject: 'Factura FreelanceFlow',
      creator: 'FreelanceFlow'
    });
    doc.setFillColor(255, 253, 248);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(0, 121, 107);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(descriptor.header.eyebrow.toUpperCase(), 18, 24);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(22);
    doc.text(descriptor.header.number, 18, 36);
    doc.setFontSize(8);
    doc.text(descriptor.header.status, 18, 47);
    if (descriptor.header.timing) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(descriptor.header.timing, 40, 47);
    }

    let y = 68;
    y = addSectionTitle(doc, 'Información general', y);
    const leftY = addKeyValue(doc, 'Cliente', descriptor.parties.clientName, 18, y, { boldValue: true });
    if (descriptor.parties.clientEmail) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(descriptor.parties.clientEmail, 18, leftY + 1);
    }
    addKeyValue(doc, 'Proyecto', descriptor.parties.projectName, 112, y, { boldValue: true, maxWidth: 78 });
    y += 28;
    addKeyValue(doc, 'Fecha de emisión', descriptor.parties.issuedAt, 18, y, { boldValue: true });
    addKeyValue(doc, 'Fecha de vencimiento', descriptor.parties.dueAt, 112, y, { boldValue: true });

    y += 28;
    doc.setDrawColor(216, 199, 181);
    doc.line(18, y - 6, 192, y - 6);
    y = addSectionTitle(doc, 'Detalle de conceptos', y);
    descriptor.items.forEach((item) => {
      y = ensureSpace(doc, y, 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      y = drawTextBlock(doc, [item.description], 20, y, { maxWidth: 170, lineHeight: 5 });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      doc.text(`Cantidad: ${item.quantity}`, 20, y + 4);
      doc.text(`Precio: ${item.price}`, 82, y + 4);
      doc.text(`Total: ${item.lineTotal}`, 142, y + 4);
      y += 13;
    });

    y = ensureSpace(doc, y, 54);
    doc.setDrawColor(216, 199, 181);
    doc.line(18, y, 192, y);
    y += 11;
    const rows = [
      ['Subtotal', descriptor.totals.subtotal],
      ...(descriptor.totals.discount ? [['Descuento', `- ${descriptor.totals.discount}`]] : []),
      ['Impuestos', descriptor.totals.tax],
      ['Total', descriptor.totals.total],
      ['Pagado acumulado', descriptor.totals.paid],
      ['Saldo pendiente', descriptor.totals.pendingDisplay],
      ...(descriptor.totals.credit ? [['Saldo a favor', descriptor.totals.credit]] : [])
    ];
    rows.forEach(([label, value]) => {
      const isTotal = label === 'Total';
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(isTotal ? 12 : 8);
      doc.setTextColor(15, 23, 42);
      doc.text(label.toUpperCase(), 18, y);
      doc.setTextColor(label === 'Saldo pendiente' && value !== '$0.00' ? 180 : 15, label === 'Saldo a favor' ? 140 : 23, 42);
      doc.text(value, 192, y, { align: 'right' });
      y += isTotal ? 10 : 8;
    });

    y = ensureSpace(doc, y, 34);
    doc.setDrawColor(216, 199, 181);
    doc.line(18, y - 3, 192, y - 3);
    y = addSectionTitle(doc, `Historial de pagos ${descriptor.payments.length}`, y + 8);
    if (!descriptor.payments.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Aún no se han registrado pagos para esta factura.', 105, y + 8, { align: 'center' });
    } else {
      descriptor.payments.forEach((payment) => {
        y = ensureSpace(doc, y, 18);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(payment.amount, 20, y);
        doc.text(payment.method, 82, y);
        doc.text(payment.date, 142, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(payment.reference, 20, y + 5);
        y += 13;
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('FreelanceFlow', 18, 286);
      doc.text(`Página ${page} de ${pageCount}`, 192, 286, { align: 'right' });
    }
    return doc;
  }

  function downloadInvoicePDF(payload) {
    const jsPDF = globalScope.jspdf?.jsPDF;
    if (!jsPDF) throw new Error('jsPDF no está disponible.');
    const descriptor = buildInvoicePdfDescriptor(payload);
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    renderInvoicePDF(doc, descriptor);
    doc.save(descriptor.fileName);
    return descriptor;
  }

  const api = {
    buildInvoicePdfDescriptor,
    downloadInvoicePDF,
    formatCurrency,
    formatDate,
    renderInvoicePDF
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowInvoicePDF = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
