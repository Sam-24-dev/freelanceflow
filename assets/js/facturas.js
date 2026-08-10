(() => {
  'use strict';

  const model = window.FreelanceFlowInvoiceModel;
  const settingsModel = window.FreelanceFlowSettingsModel;
  const fiscalModel = window.FreelanceFlowFiscalConfigModel;
  const clientModel = window.FreelanceFlowClientModel;
  const projectModel = window.FreelanceFlowProjectModel;
  if (!model || !settingsModel || !clientModel) return;

  const invoiceWebLocks = window.navigator?.locks;

  const STORAGE_KEYS = {
    invoices: 'freelanceflow_invoices_v1',
    payments: 'freelanceflow_invoice_payments_v1',
    transition: 'freelanceflow_invoice_transition_v1',
    fiscal: 'freelanceflow_fiscal_config_v1',
    settings: 'freelanceflow_settings_v1'
  };
  const STATUS_COPY = {
    DRAFT: 'Borrador',
    SENT: 'Enviada',
    PARTIAL: 'Parcial',
    PAID: 'Pagada',
    OVERDUE: 'Vencida',
    VOID: 'Anulada'
  };
  const ACTION_COPY = {
    edit: 'Editar factura',
    send: 'Enviar factura',
    pay: 'Registrar pago',
    void: 'Anular factura',
    download: 'Descargar PDF',
    copyLink: 'Copiar enlace'
  };
  const iconPaths = {
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
    edit: '<path d="m4 20 4.2-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm9.7-12.7 3 3"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>',
    pay: '<path d="M3 6h18v12H3zM3 10h18m-5 4h2"/>',
    download: '<path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
    void: '<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8"/>'
  };

  const state = {
    clients: [],
    projects: [],
    baselineInvoices: [],
    baselinePayments: [],
    invoices: [],
    payments: [],
    selectedId: null,
    editingId: null,
    editingSnapshot: null,
    filters: {
      query: '',
      status: 'todos',
      period: new Date().toISOString().slice(0, 7),
      clientId: 'todos',
      projectId: 'todos'
    },
    lastFocus: null,
    toastTimer: 0
  };
  let transitionSequence = 0;

  const selectors = {
    loading: document.querySelector('[data-invoice-loading]'),
    error: document.querySelector('[data-invoice-error]'),
    tableWrap: document.querySelector('[data-invoice-table-wrap]'),
    tableBody: document.querySelector('[data-invoice-table-body]'),
    mobileList: document.querySelector('[data-invoice-mobile-list]'),
    empty: document.querySelector('[data-invoice-empty]'),
    emptyTitle: document.querySelector('[data-empty-title]'),
    emptyCopy: document.querySelector('[data-empty-copy]'),
    emptyAction: document.querySelector('[data-empty-action]'),
    resultCount: document.querySelector('[data-result-count]'),
    filters: document.querySelector('[data-invoice-filters]'),
    clearFilters: document.querySelector('[data-clear-filters]'),
    statusTabs: document.querySelector('[data-status-tabs]'),
    detail: document.querySelector('[data-invoice-detail]'),
    detailBody: document.querySelector('[data-detail-body]'),
    detailActions: document.querySelector('[data-detail-actions]'),
    backdrop: document.querySelector('[data-panel-backdrop]'),
    invoiceFormPanel: document.querySelector('[data-invoice-form]'),
    invoiceForm: document.querySelector('[data-invoice-form-element]'),
    invoiceItems: document.querySelector('[data-invoice-items]'),
    itemTemplate: document.querySelector('#invoice-item-template'),
    paymentDialog: document.querySelector('[data-payment-dialog]'),
    paymentForm: document.querySelector('[data-payment-form]'),
    voidDialog: document.querySelector('[data-void-dialog]'),
    voidForm: document.querySelector('[data-void-form]'),
    toast: document.querySelector('[data-invoice-toast]')
  };

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function icon(name, className = '') {
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
  }

  function formatCurrency(value, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  function isReceivable(invoice) {
    return ['SENT', 'PARTIAL', 'OVERDUE'].includes(invoice.estado);
  }

  function pendingDisplay(invoice) {
    if (invoice.estado === 'DRAFT') return 'No exigible';
    if (invoice.estado === 'VOID') return 'Anulada';
    return formatCurrency(invoice.saldo_pendiente, invoice.moneda);
  }

  function pendingClass(invoice) {
    return isReceivable(invoice) && Number(invoice.saldo_pendiente) > 0 ? 'invoice-pending-value' : 'invoice-muted-value';
  }

  function formatDate(value, options = {}) {
    if (!model.isValidDate(value)) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-EC', {
      day: '2-digit', month: options.short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(`${value}T00:00:00Z`));
  }

  function readFiscalConfiguration() {
    try { return fiscalModel?.parseStoredFiscalConfiguration(localStorage.getItem(STORAGE_KEYS.fiscal)); } catch { return null; }
  }

  function readSettingsEnvelope() {
    try {
      return settingsModel.resolveStoredSettingsEnvelope(
        localStorage.getItem(STORAGE_KEYS.settings),
        model.readInvoiceTransitionSettings(localStorage, STORAGE_KEYS.transition)
      );
    } catch { return null; }
  }

  function readStoredInvoiceTransition() {
    const stored = model.readInvoiceStorage(
      localStorage,
      STORAGE_KEYS.transition,
      STORAGE_KEYS.invoices,
      STORAGE_KEYS.payments,
      { clients: state.clients, projects: state.projects }
    );
    return {
      invoices: model.mergeById(state.baselineInvoices, stored.invoices),
      payments: model.mergeById(state.baselinePayments, stored.payments)
    };
  }

  function persistTransition(invoices, payments, settingsEnvelope = null) {
    const transactionId = `tx-${Date.now()}-${++transitionSequence}`;
    return model.persistInvoiceTransition(localStorage, STORAGE_KEYS.transition, invoices, payments, transactionId, {
      clients: state.clients, projects: state.projects
    }, settingsEnvelope);
  }

  function showInvoiceMutationFailure(reason, focusTarget) {
    const lockFailure = String(reason ?? '').startsWith('lock-');
    const message = reason === 'stale'
      ? 'Esta factura cambi\u00f3 en otra pesta\u00f1a. Recarga los datos antes de intentar nuevamente.'
      : lockFailure
        ? 'No pudimos asegurar el guardado. Tu navegador no permiti\u00f3 bloquear esta operaci\u00f3n.'
        : 'No pudimos completar el guardado de forma segura.';
    showToast(message, 'error');
    focusTarget?.focus?.();
  }

  async function commitSerializedInvoiceMutation(mutation, focusTarget) {
    const result = await model.runSerializedInvoiceMutation(invoiceWebLocks, () => {
      const lockedSnapshot = readStoredInvoiceTransition();
      state.invoices = lockedSnapshot.invoices;
      state.payments = lockedSnapshot.payments;
      return lockedSnapshot;
    }, mutation);
    if (!result?.committed && result?.reason !== 'validation') showInvoiceMutationFailure(result?.reason, focusTarget);
    return result || { committed: false, reason: 'lock-failed' };
  }

  function commitLockedTransition(nextInvoices, nextPayments, recordActivityAfterCommit, settingsEnvelope = null) {
    const committed = model.commitInvoiceTransition(
      state.invoices,
      state.payments,
      nextInvoices,
      nextPayments,
      (invoices, payments) => persistTransition(invoices, payments, settingsEnvelope),
      recordActivityAfterCommit
    );
    if (committed.committed) {
      state.invoices = committed.invoices;
      state.payments = committed.payments;
    }
    return committed;
  }

  function showToast(message, tone = 'success') {
    window.clearTimeout(state.toastTimer);
    selectors.toast.textContent = message;
    selectors.toast.dataset.tone = tone;
    selectors.toast.hidden = false;
    requestAnimationFrame(() => selectors.toast.classList.add('is-visible'));
    state.toastTimer = window.setTimeout(() => {
      selectors.toast.classList.remove('is-visible');
      window.setTimeout(() => { selectors.toast.hidden = true; }, 200);
    }, 4200);
  }

  function clientFor(invoice) {
    return state.clients.find((client) => String(client.id) === String(invoice.cliente_id));
  }

  function projectFor(invoice) {
    return state.projects.find((project) => String(project.id) === String(invoice.proyecto_relacionado_id));
  }

  function invoiceFor(id) {
    const invoice = state.invoices.find((item) => String(item.id) === String(id));
    return invoice ? model.hydrateInvoice(invoice, state.payments) : null;
  }

  function statusBadge(status) {
    return `<span class="invoice-status-badge is-${status.toLowerCase()}">${STATUS_COPY[status] ?? status}</span>`;
  }

  function daysBetween(dateA, dateB) {
    const first = new Date(`${dateA}T00:00:00Z`).getTime();
    const second = new Date(`${dateB}T00:00:00Z`).getTime();
    return Math.round((second - first) / 86400000);
  }

  function timingCopy(invoice) {
    const today = new Date().toISOString().slice(0, 10);
    if (invoice.estado === 'VOID') return 'Factura anulada';
    if (invoice.estado === 'PAID') {
      const related = model.getInvoicePayments(invoice.id, state.payments).sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)));
      return related[0] ? `Pagada el ${formatDate(related[0].fecha_pago, { short: true })}` : 'Pagada';
    }
    if (invoice.estado === 'DRAFT') return 'Pendiente de envío';
    const difference = daysBetween(today, invoice.fecha_vencimiento);
    if (difference < 0) return `Vencida hace ${Math.abs(difference)} ${Math.abs(difference) === 1 ? 'día' : 'días'}`;
    if (difference === 0) return 'Vence hoy';
    return `Vence en ${difference} ${difference === 1 ? 'día' : 'días'}`;
  }

  function renderMetrics() {
    const metrics = model.calculateInvoiceMetrics(state.invoices, state.payments, {
      period: state.filters.period === 'todos' ? new Date().toISOString().slice(0, 7) : state.filters.period
    });
    document.querySelector('[data-metric-pending]').textContent = formatCurrency(metrics.pendingAmount);
    document.querySelector('[data-metric-overdue]').textContent = formatCurrency(metrics.overdueAmount);
    document.querySelector('[data-metric-collected]').textContent = formatCurrency(metrics.collectedAmount);
    document.querySelector('[data-metric-count]').textContent = String(metrics.pendingCount);
    document.querySelector('[data-metric-pending-copy]').textContent = metrics.pendingCount
      ? `${metrics.pendingCount} ${metrics.pendingCount === 1 ? 'factura requiere' : 'facturas requieren'} seguimiento`
      : 'Sin saldos pendientes';
    document.querySelector('[data-metric-overdue-copy]').textContent = metrics.overdueCount
      ? `${metrics.overdueCount} ${metrics.overdueCount === 1 ? 'factura vencida' : 'facturas vencidas'}`
      : 'No tienes facturas vencidas';
  }

  function renderTableRow(invoice) {
    const client = clientFor(invoice);
    const project = projectFor(invoice);
    const selected = state.selectedId === invoice.id;
    return `<tr class="${invoice.estado === 'OVERDUE' ? 'is-overdue ' : ''}${selected ? 'is-selected' : ''}" data-invoice-id="${escapeHTML(invoice.id)}"${selected ? ' aria-selected="true"' : ''}>
      <td><strong>${escapeHTML(invoice.numero_factura)}</strong></td>
      <td><span class="invoice-cell-primary">${escapeHTML(client?.nombre_razon_social ?? 'Cliente no disponible')}</span><small>${escapeHTML(client?.correo ?? client?.correo_electronico ?? '')}</small></td>
      <td><span class="invoice-cell-primary">${escapeHTML(project?.nombre_proyecto ?? 'Sin proyecto asociado')}</span></td>
      <td><time datetime="${escapeHTML(invoice.fecha_emision)}">${formatDate(invoice.fecha_emision, { short: true })}</time><small class="${invoice.estado === 'OVERDUE' ? 'is-danger' : ''}">${escapeHTML(timingCopy(invoice))}</small></td>
      <td class="is-numeric">${formatCurrency(invoice.total_factura, invoice.moneda)}</td>
      <td class="is-numeric"><strong class="${pendingClass(invoice)}">${pendingDisplay(invoice)}</strong></td>
      <td>${statusBadge(invoice.estado)}</td>
      <td><button class="invoice-row-action" type="button" data-open-detail="${escapeHTML(invoice.id)}" aria-label="Ver detalle de la factura ${escapeHTML(invoice.numero_factura)}">${icon('eye')}</button></td>
    </tr>`;
  }

  function renderMobileCard(invoice) {
    const client = clientFor(invoice);
    const project = projectFor(invoice);
    return `<article class="invoice-mobile-card ${invoice.estado === 'OVERDUE' ? 'is-overdue' : ''}">
      <header><div><p>${escapeHTML(invoice.numero_factura)}</p><h3>${escapeHTML(client?.nombre_razon_social ?? 'Cliente no disponible')}</h3></div>${statusBadge(invoice.estado)}</header>
      <p class="invoice-mobile-project">${escapeHTML(project?.nombre_proyecto ?? 'Sin proyecto asociado')}</p>
      <div class="invoice-mobile-balance"><span>Saldo pendiente</span><strong class="${pendingClass(invoice)}">${pendingDisplay(invoice)}</strong></div>
      <dl><div><dt>Total</dt><dd>${formatCurrency(invoice.total_factura, invoice.moneda)}</dd></div><div><dt>Vencimiento</dt><dd>${formatDate(invoice.fecha_vencimiento, { short: true })}</dd></div></dl>
      <p class="invoice-mobile-timing ${invoice.estado === 'OVERDUE' ? 'is-danger' : ''}">${escapeHTML(timingCopy(invoice))}</p>
      <button class="invoices-secondary-button" type="button" data-open-detail="${escapeHTML(invoice.id)}">Ver detalle</button>
    </article>`;
  }

  function activeFilters() {
    return Boolean(state.filters.query
      || state.filters.status !== 'todos'
      || state.filters.clientId !== 'todos'
      || state.filters.projectId !== 'todos'
      || state.filters.period !== new Date().toISOString().slice(0, 7));
  }

  function renderList() {
    renderMetrics();
    const filtered = model.filterInvoices(state.invoices, state.clients, state.projects, state.payments, state.filters);
    const hasInvoices = state.invoices.length > 0;
    const hasResults = filtered.length > 0;

    selectors.loading.hidden = true;
    selectors.error.hidden = true;
    selectors.tableWrap.hidden = !hasResults;
    selectors.mobileList.hidden = !hasResults;
    selectors.empty.hidden = hasResults;
    selectors.clearFilters.hidden = !activeFilters();
    selectors.resultCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'factura encontrada' : 'facturas encontradas'}`;

    if (hasResults) {
      selectors.tableBody.innerHTML = filtered.map(renderTableRow).join('');
      selectors.mobileList.innerHTML = filtered.map(renderMobileCard).join('');
    } else {
      selectors.emptyTitle.textContent = hasInvoices ? 'No encontramos facturas con ese criterio' : 'Aún no has emitido facturas';
      selectors.emptyCopy.textContent = hasInvoices
        ? 'Prueba otra búsqueda o limpia los filtros aplicados.'
        : 'Crea tu primera factura para comenzar a controlar cobros y vencimientos.';
      selectors.emptyAction.textContent = hasInvoices ? 'Limpiar filtros' : 'Crear primera factura';
      selectors.emptyAction.dataset.mode = hasInvoices ? 'clear' : 'create';
    }
  }

  function renderClientAndProjectOptions() {
    const clientOptions = state.clients.map((client) => `<option value="${escapeHTML(client.id)}">${escapeHTML(client.nombre_razon_social)}</option>`).join('');
    selectors.filters.elements.clientId.innerHTML = '<option value="todos">Todos los clientes</option>';
    selectors.filters.elements.clientId.insertAdjacentHTML('beforeend', clientOptions);
    populateInvoiceClientOptions();
    const projectOptions = state.projects.map((project) => `<option value="${escapeHTML(project.id)}">${escapeHTML(project.nombre_proyecto)}</option>`).join('');
    selectors.filters.elements.projectId.innerHTML = '<option value="todos">Todos los proyectos</option>';
    selectors.invoiceForm.elements.proyecto_relacionado_id.innerHTML = '<option value="">Sin proyecto asociado</option>';
    selectors.filters.elements.projectId.insertAdjacentHTML('beforeend', projectOptions);
    selectors.invoiceForm.elements.proyecto_relacionado_id.insertAdjacentHTML('beforeend', projectOptions);
  }

  function populateInvoiceClientOptions(selectedId = '') {
    const clients = clientModel.getSelectableClients(state.clients, selectedId);
    selectors.invoiceForm.elements.cliente_id.innerHTML = '<option value="">Selecciona un cliente</option>'
      + clients.map((client) => `<option value="${escapeHTML(client.id)}">${escapeHTML(client.nombre_razon_social)}</option>`).join('');
  }

  function detailMarkup(invoice) {
    const client = clientFor(invoice);
    const project = projectFor(invoice);
    const payments = model.getInvoicePayments(invoice.id, state.payments).sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)));
    const itemRows = (invoice.items ?? []).map((item) => `<tr><td>${escapeHTML(item.descripcion_item)}</td><td>${escapeHTML(item.cantidad)}</td><td>${formatCurrency(item.precio_unitario, invoice.moneda)}</td><td>${formatCurrency(Number(item.cantidad) * Number(item.precio_unitario), invoice.moneda)}</td></tr>`).join('');
    const paymentRows = payments.length
      ? payments.map((payment) => `<article><div><strong>${formatCurrency(payment.monto_pagado, invoice.moneda)}</strong><span>${formatDate(payment.fecha_pago)} · ${escapeHTML(payment.metodo_pago)}</span></div><div><span>${escapeHTML(payment.referencia_comprobante || 'Sin referencia')}</span>${payment.notas ? `<small>${escapeHTML(payment.notas)}</small>` : ''}</div></article>`).join('')
      : `<div class="invoice-detail-empty"><p>Aún no se han registrado pagos para esta factura.</p>${model.getAllowedActions(invoice.estado).includes('pay') ? '<button class="invoices-text-button" type="button" data-detail-action="pay">Registrar primer pago</button>' : ''}</div>`;
    return `<section class="invoice-detail-section invoice-detail-general" aria-labelledby="detail-general-title">
        <h3 id="detail-general-title">Información general</h3>
        <dl><div><dt>Cliente</dt><dd>${escapeHTML(client?.nombre_razon_social ?? 'No disponible')}<small>${escapeHTML(client?.correo ?? client?.correo_electronico ?? '')}</small></dd></div><div><dt>Proyecto</dt><dd>${escapeHTML(project?.nombre_proyecto ?? 'Sin proyecto asociado')}</dd></div><div><dt>Fecha de emisión</dt><dd>${formatDate(invoice.fecha_emision)}</dd></div><div><dt>Fecha de vencimiento</dt><dd>${formatDate(invoice.fecha_vencimiento)}</dd></div></dl>
      </section>
      <section class="invoice-detail-section" aria-labelledby="detail-items-title"><h3 id="detail-items-title">Detalle de conceptos</h3><div class="invoice-detail-table-wrap"><table><thead><tr><th>Concepto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead><tbody>${itemRows}</tbody></table></div></section>
      <section class="invoice-detail-section invoice-detail-totals" aria-labelledby="detail-totals-title"><h3 id="detail-totals-title" class="sr-only">Resumen financiero</h3><dl><div><dt>Subtotal</dt><dd>${formatCurrency(invoice.subtotal_general, invoice.moneda)}</dd></div>${invoice.descuento ? `<div><dt>Descuento</dt><dd>− ${formatCurrency(invoice.descuento, invoice.moneda)}</dd></div>` : ''}<div><dt>Impuestos</dt><dd>${formatCurrency(invoice.impuestos, invoice.moneda)}</dd></div><div class="is-total"><dt>Total</dt><dd>${formatCurrency(invoice.total_factura, invoice.moneda)}</dd></div><div class="is-paid"><dt>Pagado acumulado</dt><dd>${formatCurrency(invoice.monto_pagado_acumulado, invoice.moneda)}</dd></div><div class="is-pending"><dt>Saldo pendiente</dt><dd>${pendingDisplay(invoice)}</dd></div>${invoice.saldo_a_favor ? `<div class="is-credit"><dt>Saldo a favor</dt><dd>${formatCurrency(invoice.saldo_a_favor, invoice.moneda)}</dd></div>` : ''}</dl></section>
      <section class="invoice-detail-section invoice-payment-history" aria-labelledby="payment-history-title"><h3 id="payment-history-title">Historial de pagos <span>${payments.length}</span></h3>${paymentRows}</section>
      ${invoice.estado === 'VOID' && invoice.motivo_anulacion ? `<section class="invoice-void-note"><strong>Motivo de anulación</strong><p>${escapeHTML(invoice.motivo_anulacion)}</p></section>` : ''}`;
  }

  function renderDetail() {
    const invoice = invoiceFor(state.selectedId);
    if (!invoice) return closeDetail();
    document.querySelector('[data-detail-number]').textContent = invoice.numero_factura;
    document.querySelector('[data-detail-status]').innerHTML = statusBadge(invoice.estado);
    document.querySelector('[data-detail-timing]').textContent = timingCopy(invoice);
    document.querySelector('[data-close-detail]').setAttribute('aria-label', `Cerrar detalle de la factura ${invoice.numero_factura}`);
    selectors.detailBody.innerHTML = detailMarkup(invoice);
    const actions = model.getAllowedActions(invoice.estado).filter((action) => action !== 'view');
    selectors.detailActions.innerHTML = actions.map((action) => {
      const iconName = action === 'copyLink' ? 'link' : action;
      const tone = action === 'pay' ? ' invoices-primary-button' : action === 'void' ? ' invoices-danger-text-button' : ' invoices-secondary-button';
      return `<button class="${tone.trim()}" type="button" data-detail-action="${action}">${icon(iconName)}${ACTION_COPY[action]}</button>`;
    }).join('');
  }

  function syncOverlay() {
    const openPanel = selectors.detail.classList.contains('is-open') || selectors.invoiceFormPanel.classList.contains('is-open');
    selectors.backdrop.hidden = !openPanel;
    document.body.classList.toggle('invoice-overlay-open', openPanel || selectors.paymentDialog.open || selectors.voidDialog.open);
  }

  function isUsableFocusTarget(target, panel = null) {
    return Boolean(target?.isConnected
      && target !== document.body
      && !panel?.contains(target)
      && !target.hidden
      && !target.disabled
      && target.getClientRects().length);
  }

  function openPanel(panel, focusTarget) {
    if (isUsableFocusTarget(document.activeElement, panel)) state.lastFocus = document.activeElement;
    [selectors.detail, selectors.invoiceFormPanel].forEach((item) => {
      if (item !== panel) {
        item.classList.remove('is-open');
        item.setAttribute('aria-hidden', 'true');
        item.setAttribute('inert', '');
      }
    });
    panel.removeAttribute('inert');
    panel.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      panel.classList.add('is-open');
      syncOverlay();
      focusTarget?.focus();
    });
  }

  function closePanel(panel, preferredFocusTarget = null) {
    const fallbackTargets = panel === selectors.detail
      ? [
        ...document.querySelectorAll(`[data-open-detail="${state.selectedId}"]`),
        document.querySelector('[data-open-detail]'),
        document.querySelector('[data-open-invoice-form]')
      ]
      : [document.querySelector('[data-open-invoice-form]')];
    const focusTarget = [preferredFocusTarget, state.lastFocus, ...fallbackTargets]
      .find((target) => isUsableFocusTarget(target, panel));
    panel.classList.remove('is-open');
    focusTarget?.focus?.();
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('inert', '');
    syncOverlay();
  }

  function openDetail(id, trigger) {
    state.selectedId = id;
    state.lastFocus = trigger || document.activeElement;
    renderList();
    state.lastFocus = [...document.querySelectorAll(`[data-open-detail="${id}"]`)]
      .find((candidate) => isUsableFocusTarget(candidate, selectors.detail)) || state.lastFocus;
    renderDetail();
    openPanel(selectors.detail, document.querySelector('[data-close-detail]'));
  }

  function closeDetail() {
    const closedInvoiceId = state.selectedId;
    state.selectedId = null;
    renderList();
    const reRenderedTrigger = [...document.querySelectorAll(`[data-open-detail="${closedInvoiceId}"]`)]
      .find((candidate) => isUsableFocusTarget(candidate, selectors.detail));
    closePanel(selectors.detail, reRenderedTrigger);
  }

  function nextInvoiceNumber() {
    const envelope = readSettingsEnvelope();
    return envelope ? settingsModel.formatInvoiceNumber(envelope.settings.invoice_prefix, envelope.settings.next_invoice_number) : '—';
  }

  function addInvoiceItem(item = {}) {
    const fragment = selectors.itemTemplate.content.cloneNode(true);
    const row = fragment.querySelector('.invoice-item-row');
    row.querySelector('[name="origen_item"]').value = item.origen_item || 'Manual';
    row.querySelector('[name="descripcion_item"]').value = item.descripcion_item || '';
    row.querySelector('[name="cantidad"]').value = item.cantidad ?? 1;
    row.querySelector('[name="precio_unitario"]').value = item.precio_unitario ?? 0;
    selectors.invoiceItems.append(row);
    updateFormTotals();
  }

  function collectInvoiceItems() {
    return [...selectors.invoiceItems.querySelectorAll('.invoice-item-row')].map((row, index) => ({
      id: `${state.editingId || 'new'}_item_${index + 1}`,
      origen_item: row.querySelector('[name="origen_item"]').value,
      descripcion_item: row.querySelector('[name="descripcion_item"]').value.trim(),
      cantidad: Number(row.querySelector('[name="cantidad"]').value),
      precio_unitario: Number(row.querySelector('[name="precio_unitario"]').value)
    }));
  }

  function updateFormTotals() {
    const invoice = {
      items: collectInvoiceItems(),
      descuento: Number(selectors.invoiceForm.elements.descuento.value),
      impuestos: Number(selectors.invoiceForm.elements.impuestos.value)
    };
    const totals = model.calculateInvoiceTotals(invoice);
    document.querySelector('[data-form-subtotal]').textContent = formatCurrency(totals.subtotal);
    document.querySelector('[data-form-discount]').textContent = formatCurrency(totals.descuento);
    document.querySelector('[data-form-tax]').textContent = formatCurrency(totals.impuestos);
    document.querySelector('[data-form-total]').textContent = formatCurrency(totals.total);
    selectors.invoiceItems.querySelectorAll('.invoice-item-row').forEach((row) => {
      const quantity = Number(row.querySelector('[name="cantidad"]').value) || 0;
      const price = Number(row.querySelector('[name="precio_unitario"]').value) || 0;
      row.querySelector('[data-item-subtotal]').textContent = formatCurrency(quantity * price);
    });
  }

  function clearErrors(form) {
    form.querySelectorAll('[data-error-for]').forEach((node) => { node.textContent = ''; });
    form.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  }

  function displayErrors(form, errors) {
    clearErrors(form);
    Object.entries(errors).forEach(([name, message]) => {
      const error = form.querySelector(`[data-error-for="${name}"]`);
      if (error) error.textContent = message;
      const field = form.elements[name];
      field?.setAttribute?.('aria-invalid', 'true');
    });
    const first = form.querySelector('[aria-invalid="true"]') || form.querySelector('[data-error-for]:not(:empty)');
    first?.focus?.();
  }

  function resetInvoiceForm(invoice = null) {
    selectors.invoiceForm.reset();
    selectors.invoiceItems.innerHTML = '';
    clearErrors(selectors.invoiceForm);
    state.editingId = invoice?.id ?? null;
    state.editingSnapshot = invoice ? JSON.parse(JSON.stringify(invoice)) : null;
    populateInvoiceClientOptions(invoice?.cliente_id ?? '');
    document.querySelector('#invoice-form-title').textContent = invoice ? `Editar ${invoice.numero_factura}` : 'Nueva factura';
    const settings = readSettingsEnvelope()?.settings || settingsModel.getDefaultSettings();
    selectors.invoiceForm.elements.numero_factura.value = invoice?.numero_factura ?? settingsModel.formatInvoiceNumber(settings.invoice_prefix, settings.next_invoice_number);
    selectors.invoiceForm.elements.fecha_emision.value = invoice?.fecha_emision ?? new Date().toISOString().slice(0, 10);
    const due = new Date();
    due.setDate(due.getDate() + settings.default_due_days);
    selectors.invoiceForm.elements.fecha_vencimiento.value = invoice?.fecha_vencimiento ?? due.toISOString().slice(0, 10);
    selectors.invoiceForm.elements.cliente_id.value = invoice?.cliente_id ?? '';
    selectors.invoiceForm.elements.proyecto_relacionado_id.value = invoice?.proyecto_relacionado_id ?? '';
    selectors.invoiceForm.elements.moneda.value = invoice?.moneda ?? settings.default_currency;
    selectors.invoiceForm.elements.descuento.value = invoice?.descuento ?? 0;
    selectors.invoiceForm.elements.impuestos.value = invoice?.impuestos ?? '';
    (invoice?.items?.length ? invoice.items : [{}]).forEach(addInvoiceItem);
    updateProjectOptions(selectors.invoiceForm.elements.cliente_id.value, selectors.invoiceForm.elements.proyecto_relacionado_id.value);
  }

  function openInvoiceForm(invoice = null) {
    resetInvoiceForm(invoice);
    openPanel(selectors.invoiceFormPanel, document.querySelector('[data-close-invoice-form]'));
  }

  function closeInvoiceForm() {
    closePanel(selectors.invoiceFormPanel);
    state.editingId = null;
    state.editingSnapshot = null;
  }

  function updateProjectOptions(clientId, selectedValue = 'todos') {
    const target = selectors.invoiceForm.elements.proyecto_relacionado_id;
    [...target.options].forEach((option) => {
      if (!option.value) return;
      const project = state.projects.find((item) => String(item.id) === option.value);
      option.hidden = Boolean(clientId && project && String(project.cliente_id) !== String(clientId));
    });
    if (selectedValue && [...target.options].some((option) => option.value === selectedValue && !option.hidden)) target.value = selectedValue;
    else if (target.selectedOptions[0]?.hidden) target.value = '';
  }

  async function handleInvoiceSubmit(event) {
    event.preventDefault();
    const submitter = event.submitter;
    const intent = submitter?.value || 'draft';
    const editingId = state.editingId;
    const editingSnapshot = state.editingSnapshot;
    const taxValue = selectors.invoiceForm.elements.impuestos.value;
    const manualInvoiceNumber = selectors.invoiceForm.elements.numero_factura.value.trim();
    const formCandidate = {
      cliente_id: selectors.invoiceForm.elements.cliente_id.value,
      proyecto_relacionado_id: selectors.invoiceForm.elements.proyecto_relacionado_id.value,
      fecha_emision: selectors.invoiceForm.elements.fecha_emision.value,
      fecha_vencimiento: selectors.invoiceForm.elements.fecha_vencimiento.value,
      moneda: selectors.invoiceForm.elements.moneda.value,
      estado: intent === 'send' ? 'SENT' : 'DRAFT',
      items: collectInvoiceItems(),
      descuento: Number(selectors.invoiceForm.elements.descuento.value),
      ...(taxValue === '' ? {} : { impuestos: Number(taxValue) })
    };
    const committed = await commitSerializedInvoiceMutation(() => {
      const current = editingId ? state.invoices.find((invoice) => invoice.id === editingId) : null;
      if (editingId && (!current || !model.matchesInvoiceSnapshot(current, editingSnapshot))) {
        return { committed: false, reason: 'stale' };
      }
      const id = editingId || window.crypto?.randomUUID?.();
      if (!id) return { committed: false, reason: 'identity-unavailable' };
      const settingsEnvelope = current ? null : readSettingsEnvelope();
      if (!current && !settingsEnvelope) return { committed: false, reason: 'settings-unavailable' };
      const settings = settingsEnvelope?.settings;
      const invoiceNumber = current ? current.numero_factura : manualInvoiceNumber || settingsModel.formatInvoiceNumber(settings.invoice_prefix, settings.next_invoice_number);
      if (!current && state.invoices.some((invoice) => invoice.numero_factura === invoiceNumber)) return { committed: false, reason: 'invoice-number-conflict' };
      const candidate = {
        ...formCandidate,
        id,
        numero_factura: invoiceNumber
      };
      if (!editingId) candidate.impuestos = model.resolveEstimatedTaxForNewInvoice(candidate, readFiscalConfiguration() || {});
      const validation = model.validateInvoice(candidate, { clients: state.clients, projects: state.projects });
      if (!validation.valid) {
        displayErrors(selectors.invoiceForm, validation.errors);
        showToast('Revisa los campos marcados antes de guardar la factura.', 'error');
        return { committed: false, reason: 'validation' };
      }
      const totals = model.calculateInvoiceTotals(candidate);
      const record = {
        ...candidate,
        subtotal_general: totals.subtotal,
        total_factura: totals.total,
        monto_pagado_acumulado: current?.monto_pagado_acumulado ?? 0,
        saldo_pendiente: current?.saldo_pendiente ?? totals.total
      };
      const nextInvoices = current
        ? state.invoices.map((invoice) => invoice.id === record.id ? record : invoice)
        : [record, ...state.invoices];
      const advancedSettings = current ? null : settingsModel.createSettingsEnvelope(
        { ...settings, next_invoice_number: settings.next_invoice_number + 1 },
        settingsEnvelope.revision + 1
      );
      if (!current && !advancedSettings) return { committed: false, reason: 'settings-unavailable' };
      return commitLockedTransition(
        nextInvoices,
        state.payments,
        () => recordActivity('Facturas', intent === 'send' ? 'Factura enviada' : 'Factura guardada', `${record.numero_factura}.`),
        current ? null : settingsModel.serializeSettingsEnvelope(advancedSettings)
      );
    }, submitter || selectors.invoiceForm);
    if (!committed.committed) return;
    closeInvoiceForm();
    renderList();
    showToast(intent === 'send' ? 'Factura enviada. Estado actualizado a Enviada.' : 'Factura guardada como borrador.');
  }

  function openPaymentDialog() {
    const invoice = invoiceFor(state.selectedId);
    if (!invoice || !model.getAllowedActions(invoice.estado).includes('pay')) return;
    selectors.paymentForm.reset();
    clearErrors(selectors.paymentForm);
    document.querySelector('[data-payment-total]').textContent = formatCurrency(invoice.total_factura, invoice.moneda);
    document.querySelector('[data-payment-paid]').textContent = formatCurrency(invoice.monto_pagado_acumulado, invoice.moneda);
    document.querySelector('[data-payment-pending]').textContent = formatCurrency(invoice.saldo_pendiente, invoice.moneda);
    selectors.paymentForm.elements.monto_pagado.value = invoice.saldo_pendiente.toFixed(2);
    selectors.paymentForm.elements.fecha_pago.value = new Date().toISOString().slice(0, 10);
    document.querySelector('[data-payment-warning]').hidden = true;
    selectors.paymentDialog.showModal();
    syncOverlay();
    requestAnimationFrame(() => selectors.paymentForm.elements.monto_pagado.focus());
  }

  function closeDialog(dialog) {
    dialog.close();
    syncOverlay();
    document.querySelector('[data-close-detail]')?.focus();
  }

  function updatePaymentWarning() {
    const invoice = invoiceFor(state.selectedId);
    if (!invoice) return;
    const amount = Number(selectors.paymentForm.elements.monto_pagado.value);
    const validation = model.validatePayment({
      monto_pagado: amount,
      fecha_pago: selectors.paymentForm.elements.fecha_pago.value || new Date().toISOString().slice(0, 10),
      metodo_pago: selectors.paymentForm.elements.metodo_pago.value || 'pendiente'
    }, invoice.saldo_pendiente);
    const warning = document.querySelector('[data-payment-warning]');
    warning.hidden = validation.excess <= 0;
    warning.textContent = validation.excess > 0
      ? `Este pago supera el saldo por ${formatCurrency(validation.excess, invoice.moneda)}. El excedente quedará como saldo a favor del cliente.`
      : '';
  }

  async function handlePaymentSubmit(event) {
    event.preventDefault();
    const baseline = state.invoices.find((invoice) => invoice.id === state.selectedId);
    if (!baseline) return;
    const paymentInput = {
      monto_pagado: Number(selectors.paymentForm.elements.monto_pagado.value),
      fecha_pago: selectors.paymentForm.elements.fecha_pago.value,
      metodo_pago: selectors.paymentForm.elements.metodo_pago.value,
      referencia_comprobante: selectors.paymentForm.elements.referencia_comprobante.value.trim(),
      notas: selectors.paymentForm.elements.notas.value.trim()
    };
    const committed = await commitSerializedInvoiceMutation(() => {
      const current = state.invoices.find((invoice) => invoice.id === baseline.id);
      if (!current || !model.matchesInvoiceSnapshot(current, baseline)) return { committed: false, reason: 'stale' };
      const invoice = model.hydrateInvoice(current, state.payments);
      if (!model.getAllowedActions(invoice.estado).includes('pay')) return { committed: false, reason: 'stale' };
      const payment = { ...paymentInput, id: window.crypto?.randomUUID?.(), factura_id: current.id };
      if (!payment.id) return { committed: false, reason: 'identity-unavailable' };
      const validation = model.validatePayment(payment, invoice.saldo_pendiente);
      if (!validation.valid) {
        displayErrors(selectors.paymentForm, validation.errors);
        return { committed: false, reason: 'validation' };
      }
      const nextPayments = [...state.payments, payment];
      const nextInvoices = state.invoices.map((item) => item.id === current.id
        ? model.hydrateInvoice(current, nextPayments)
        : item);
      const transition = commitLockedTransition(
        nextInvoices,
        nextPayments,
        () => recordActivity('Facturas', 'Pago registrado', `${invoice.numero_factura} por ${formatCurrency(payment.monto_pagado, invoice.moneda)}.`)
      );
      return { ...transition, excess: validation.excess, invoice };
    }, selectors.paymentForm.elements.monto_pagado);
    if (!committed.committed) return;
    closeDialog(selectors.paymentDialog);
    renderList();
    renderDetail();
    showToast(committed.excess > 0
      ? `Pago registrado. ${formatCurrency(committed.excess, committed.invoice.moneda)} quedaron como saldo a favor.`
      : 'Pago registrado correctamente. Saldo actualizado.');
  }

  function openVoidDialog() {
    const invoice = invoiceFor(state.selectedId);
    if (!invoice) return;
    if (!model.getAllowedActions(invoice.estado).includes('void')) {
      showToast(invoice.estado === 'PAID' ? 'Esta factura ya fue pagada y no puede anularse.' : 'Esta factura no puede anularse.', 'error');
      return;
    }
    selectors.voidForm.reset();
    clearErrors(selectors.voidForm);
    selectors.voidDialog.showModal();
    syncOverlay();
    requestAnimationFrame(() => selectors.voidForm.elements.motivo_anulacion.focus());
  }

  async function handleVoidSubmit(event) {
    event.preventDefault();
    const reason = selectors.voidForm.elements.motivo_anulacion.value.trim();
    const confirmed = selectors.voidForm.elements.confirmacion_anulacion.checked;
    const errors = {};
    if (reason.length < 10) errors.motivo_anulacion = 'Escribe un motivo de al menos 10 caracteres.';
    if (!confirmed) errors.confirmacion_anulacion = 'Confirma que deseas anular la factura.';
    if (Object.keys(errors).length) return displayErrors(selectors.voidForm, errors);
    const baseline = state.invoices.find((invoice) => invoice.id === state.selectedId);
    if (!baseline) return;
    const committed = await commitSerializedInvoiceMutation(() => {
      const current = state.invoices.find((invoice) => invoice.id === baseline.id);
      if (!current || !model.matchesInvoiceSnapshot(current, baseline)) return { committed: false, reason: 'stale' };
      if (!model.getAllowedActions(model.hydrateInvoice(current, state.payments).estado).includes('void')) return { committed: false, reason: 'stale' };
      const nextInvoices = state.invoices.map((invoice) => invoice.id === current.id ? {
        ...current, estado: 'VOID', saldo_pendiente: 0,
        motivo_anulacion: reason, fecha_anulacion: new Date().toISOString().slice(0, 10)
      } : invoice);
      return commitLockedTransition(
        nextInvoices,
        state.payments,
        () => recordActivity('Facturas', 'Factura anulada', `${current.numero_factura}.`)
      );
    }, selectors.voidForm.elements.motivo_anulacion);
    if (!committed.committed) return;
    closeDialog(selectors.voidDialog);
    renderList();
    renderDetail();
    showToast('Factura anulada. Este cambio queda registrado en el historial.');
  }

  async function copyInvoiceLink(invoice) {
    const link = `${window.location.origin}${window.location.pathname}?factura=${encodeURIComponent(invoice.id)}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Enlace de la factura copiado.');
    } catch {
      showToast('No pudimos copiar el enlace automáticamente.', 'error');
    }
  }

  function downloadPDF(invoice) {
    const pdf = window.FreelanceFlowInvoicePDF;
    if (!pdf) {
      showToast('No fue posible generar el PDF. Intenta recargar la página.', 'error');
      return;
    }
    try {
      const payments = model.getInvoicePayments(invoice.id, state.payments)
        .sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)));
      const descriptor = pdf.downloadInvoicePDF({
        invoice,
        client: clientFor(invoice),
        project: projectFor(invoice),
        payments
      });
      showToast(`PDF generado: ${descriptor.fileName}`);
    } catch {
      showToast('No fue posible generar el PDF de esta factura.', 'error');
    }
  }

  async function handleDetailAction(action) {
    const invoice = invoiceFor(state.selectedId);
    if (!invoice) return;
    if (action === 'pay') return openPaymentDialog();
    if (action === 'void') return openVoidDialog();
    if (action === 'download') return downloadPDF(invoice);
    if (action === 'copyLink') return copyInvoiceLink(invoice);
    if (action === 'edit') return openInvoiceForm(invoice);
    if (action === 'send') {
      const baseline = state.invoices.find((item) => item.id === invoice.id);
      if (!baseline) return;
      const committed = await commitSerializedInvoiceMutation(() => {
        const current = state.invoices.find((item) => item.id === baseline.id);
        if (!current || !model.matchesInvoiceSnapshot(current, baseline)) return { committed: false, reason: 'stale' };
        if (!model.getAllowedActions(model.hydrateInvoice(current, state.payments).estado).includes('send')) return { committed: false, reason: 'stale' };
        const nextInvoices = state.invoices.map((item) => item.id === current.id ? { ...current, estado: 'SENT' } : item);
        return commitLockedTransition(
          nextInvoices,
          state.payments,
          () => recordActivity('Facturas', 'Factura enviada', `${current.numero_factura}.`)
        );
      }, document.querySelector('[data-detail-action="send"]'));
      if (!committed.committed) return;
      renderList();
      renderDetail();
      showToast('Factura enviada. Estado actualizado a Enviada.');
    }
  }

  function recordActivity(module, action, description) {
    window.FreelanceFlowActivity?.record({ module, action, description });
  }

  function resetFilters() {
    const defaultPeriod = new Date().toISOString().slice(0, 7);
    state.filters = { query: '', status: 'todos', period: defaultPeriod, clientId: 'todos', projectId: 'todos' };
    selectors.filters.reset();
    selectors.filters.elements.period.value = defaultPeriod;
    selectors.statusTabs.querySelectorAll('button').forEach((button) => {
      const active = button.dataset.status === 'todos';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    renderList();
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const detailTrigger = event.target.closest('[data-open-detail]');
      if (detailTrigger) return openDetail(detailTrigger.dataset.openDetail, detailTrigger);
      if (event.target.closest('[data-open-invoice-form]')) return openInvoiceForm();
      if (event.target.closest('[data-close-detail]')) return closeDetail();
      if (event.target.closest('[data-close-invoice-form], [data-cancel-invoice-form]')) return closeInvoiceForm();
      const detailAction = event.target.closest('[data-detail-action]');
      if (detailAction) return handleDetailAction(detailAction.dataset.detailAction);
      if (event.target.closest('[data-add-invoice-item]')) return addInvoiceItem();
      const remove = event.target.closest('[data-remove-invoice-item]');
      if (remove) {
        if (selectors.invoiceItems.children.length === 1) return showToast('La factura debe conservar al menos un ítem.', 'warning');
        remove.closest('.invoice-item-row').remove(); updateFormTotals(); return;
      }
      if (event.target.closest('[data-close-payment]')) return closeDialog(selectors.paymentDialog);
      if (event.target.closest('[data-close-void]')) return closeDialog(selectors.voidDialog);
      if (event.target === selectors.backdrop) {
        if (selectors.invoiceFormPanel.classList.contains('is-open')) closeInvoiceForm();
        else closeDetail();
      }
      if (event.target.closest('[data-empty-action]')) {
        if (selectors.emptyAction.dataset.mode === 'clear') resetFilters();
        else openInvoiceForm();
      }
      if (event.target.closest('[data-retry-load]')) loadData();
    });

    selectors.statusTabs.addEventListener('click', (event) => {
      const button = event.target.closest('[data-status]');
      if (!button) return;
      state.filters.status = button.dataset.status;
      selectors.statusTabs.querySelectorAll('button').forEach((item) => {
        const active = item === button;
        item.classList.toggle('is-active', active);
        item.setAttribute('aria-pressed', String(active));
      });
      renderList();
    });
    selectors.filters.addEventListener('input', () => {
      state.filters.query = selectors.filters.elements.query.value;
      state.filters.period = selectors.filters.elements.period.value || 'todos';
      state.filters.clientId = selectors.filters.elements.clientId.value;
      state.filters.projectId = selectors.filters.elements.projectId.value;
      renderList();
    });
    selectors.filters.addEventListener('reset', (event) => { event.preventDefault(); resetFilters(); });
    selectors.invoiceForm.addEventListener('submit', handleInvoiceSubmit);
    selectors.invoiceForm.addEventListener('input', updateFormTotals);
    selectors.invoiceForm.elements.cliente_id.addEventListener('change', (event) => updateProjectOptions(event.target.value));
    selectors.paymentForm.addEventListener('submit', handlePaymentSubmit);
    selectors.paymentForm.elements.monto_pagado.addEventListener('input', updatePaymentWarning);
    selectors.voidForm.addEventListener('submit', handleVoidSubmit);
    selectors.paymentDialog.addEventListener('close', syncOverlay);
    selectors.voidDialog.addEventListener('close', syncOverlay);
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (selectors.invoiceFormPanel.classList.contains('is-open')) closeInvoiceForm();
      else if (selectors.detail.classList.contains('is-open')) closeDetail();
    });
  }

  async function loadData() {
    selectors.loading.hidden = false;
    selectors.error.hidden = true;
    selectors.tableWrap.hidden = true;
    selectors.mobileList.hidden = true;
    selectors.empty.hidden = true;
    try {
      const data = await window.FreelanceFlowDataLoader.loadJson('../assets/data/mock-data.json');
      const { proyectos: baselineProjects = [] } = data;
      state.clients = clientModel.getEffectiveClients(data.clientes ?? []);
      state.projects = projectModel ? projectModel.getEffectiveProjects(data.proyectos ?? []) : baselineProjects;
      state.baselineInvoices = (data.facturas ?? []).map((invoice) => ({ ...invoice, items: (invoice.items ?? []).map((item) => ({ ...item })) }));
      state.baselinePayments = (data.pagos_factura ?? []).map((payment) => ({ ...payment }));
      const storedTransition = readStoredInvoiceTransition();
      state.invoices = model.mergeById(state.baselineInvoices, storedTransition.invoices);
      state.payments = model.mergeById(state.baselinePayments, storedTransition.payments);
      renderClientAndProjectOptions();
      selectors.filters.elements.period.value = state.filters.period;
      renderList();
      const requested = new URLSearchParams(window.location.search).get('factura');
      if (requested && state.invoices.some((invoice) => invoice.id === requested)) openDetail(requested);
    } catch (error) {
      console.error('No se pudo cargar el módulo de facturas:', error);
      selectors.loading.hidden = true;
      selectors.error.hidden = false;
      selectors.resultCount.textContent = 'No se pudieron cargar las facturas';
    }
  }

  bindEvents();
  loadData();
})();
