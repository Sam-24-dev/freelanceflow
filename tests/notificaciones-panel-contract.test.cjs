const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '../assets/js/notificaciones.js');
const pagePath = path.resolve(__dirname, '../pages/notificaciones.html');
const notificationModel = require('../assets/js/notification-model.js');

function field(value = '') {
  return { value, checked: false, hidden: true, textContent: '', disabled: false, dataset: {}, focus() {}, setAttribute() {} };
}

function element(tagName = 'div') {
  return {
    tagName, className: '', textContent: '', hidden: false, disabled: false, dataset: {}, children: [],
    setAttribute() {}, append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; }
  };
}

function loadController(storage, invoiceModel, proposalModel, activities) {
  const document = {
    addEventListener() {},
    createElement: element,
    querySelector(selector) { return selector === '[name="notification-filter"]:checked' ? { value: 'all' } : null; },
    querySelectorAll() { return []; }
  };
  const context = {
    __FREELANCEFLOW_TEST__: true, document, localStorage: storage, window: null,
    FreelanceFlowNotificationModel: notificationModel, FreelanceFlowInvoiceModel: invoiceModel,
    FreelanceFlowProposalModel: proposalModel, FreelanceFlowActivity: { record(event) { activities.push(event); } },
    Intl, Date
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), context);
  return context.FreelanceFlowNotificationsControllerTest;
}

test('uses producer readers and merges to derive notifications from effective overlays', () => {
  const calls = [];
  const invoiceModel = {
    readInvoiceStorage(storage, transition, invoices, payments, context) {
      calls.push({ transition, invoices, payments, context });
      return { invoices: [{ id: 'invoice-1', estado: 'SENT', saldo_pendiente: 20, fecha_vencimiento: '2026-07-16' }], payments: [] };
    },
    mergeById(base, stored) { return [...base.filter((item) => !stored.some((next) => next.id === item.id)), ...stored]; }
  };
  const proposalModel = {
    readProposalStorage() { return { ok: true, proposals: [{ id: 'proposal-1', estado: 'SENT', fecha_validez: '2026-07-20' }] }; },
    mergeProposals(base, stored) { return [...base.filter((item) => !stored.some((next) => next.id === item.id)), ...stored]; }
  };
  const controller = loadController({ getItem() { return null; }, setItem() {} }, invoiceModel, proposalModel, []);
  const effective = controller.effectiveData({
    clientes: [{ id: 'client-1' }], proyectos: [{ id: 'project-1' }],
    facturas: [{ id: 'invoice-1', estado: 'DRAFT', saldo_pendiente: 0 }], pagos_factura: [],
    propuestas: [{ id: 'proposal-1', estado: 'DRAFT' }]
  });

  assert.equal(calls.length, 1);
  assert.equal(effective.facturas[0].estado, 'SENT');
  assert.equal(effective.propuestas[0].estado, 'SENT');
  assert.deepEqual(notificationModel.deriveNotifications(effective, '2026-07-17').map((item) => item.id), [
    'proposal-expiring:proposal-1', 'invoice-overdue:invoice-1'
  ]);
});

test('does not change read state or preference controls when storage rejects', () => {
  const activities = [];
  const controller = loadController({ getItem() { return null; }, setItem() { throw new DOMException('blocked', 'SecurityError'); } }, null, null, activities);
  const invoice = field(); const proposal = field(); const payment = field();
  const email = field(); email.value = 'email'; const inApp = field(); inApp.value = 'in_app';
  const form = { elements: { notificar_facturas_vencidas: invoice, notificar_propuestas_por_expirar: proposal, notificar_pagos_recibidos: payment, channels: [email, inApp] } };
  const status = field(); const list = element('ul'); const readAll = field();
  controller.setTestElements({ form, channels: field(), channelError: field(), status, list, readAll, summaries: [] });
  controller.setTestState({ readIds: [], preferences: notificationModel.DEFAULT_PREFERENCES });
  controller.setTestAlerts([{ id: 'invoice-overdue:invoice-1', type: 'invoice_overdue', eventDate: '2026-07-16', targetHref: 'facturas.html', message: 'Due' }]);

  controller.readOne({ target: { dataset: { readId: 'invoice-overdue:invoice-1' } } });
  controller.readAll();
  invoice.checked = false; email.checked = true; inApp.checked = false;
  controller.savePreferences({ preventDefault() {} });

  assert.deepEqual(controller.getTestState().readIds, []);
  assert.equal(controller.getTestState().preferences.notificar_facturas_vencidas, true);
  assert.equal(invoice.checked, true);
  assert.equal(inApp.checked, true);
  assert.equal(email.checked, false);
  assert.equal(activities.length, 0);
  assert.doesNotMatch(status.textContent, /marcada|actualizadas/i);
});

test('uses semantic ul/li notification list items', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  assert.match(page, /<ul id="notifications-list"[^>]*>/);
  const controller = loadController({ getItem() { return null; }, setItem() {} }, null, null, []);
  const item = controller.buildItem({ id: 'invoice-overdue:invoice-1', type: 'invoice_overdue', eventDate: '2026-07-16', targetHref: 'facturas.html', message: 'Due', read: false });
  assert.equal(item.tagName, 'li');
});
