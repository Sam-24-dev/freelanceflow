(function notificationModelFactory(globalScope) {
  'use strict';
  const TYPES = ['invoice_overdue', 'proposal_expiring', 'payment_received'];
  const DEFAULT_PREFERENCES = { notificar_facturas_vencidas: true, notificar_propuestas_por_expirar: true, notificar_pagos_recibidos: true, channels: ['in_app'] };
  const DEFAULT_STATE = { readIds: [], preferences: DEFAULT_PREFERENCES };
  const TYPE_PREFERENCES = { invoice_overdue: 'notificar_facturas_vencidas', proposal_expiring: 'notificar_propuestas_por_expirar', payment_received: 'notificar_pagos_recibidos' };
  function parseDate(value) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '')); return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null; }
  function dateValue(value) { const date = parseDate(value); return date ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) : NaN; }
  function normalizePreferences(value = {}) { const hasChannels = Array.isArray(value.channels); const channels = hasChannels ? value.channels.filter((channel) => ['email', 'in_app'].includes(channel)) : DEFAULT_PREFERENCES.channels; return { notificar_facturas_vencidas: value.notificar_facturas_vencidas !== false, notificar_propuestas_por_expirar: value.notificar_propuestas_por_expirar !== false, notificar_pagos_recibidos: value.notificar_pagos_recibidos !== false, channels: [...new Set(channels)] }; }
  function validatePreferences(value = {}) { const normalized = normalizePreferences(value); if (!Array.isArray(value.channels) || !normalized.channels.length) return { valid: false, errors: { channels: 'Debes seleccionar al menos un canal de notificación.' }, value: normalized }; return { valid: true, errors: {}, value: normalized }; }
  function notification(id, type, eventDate, entityType, entityId, targetHref, message) { return { id, type, eventDate, entityType, entityId, targetHref, message, read: false }; }
  function deriveNotifications(data = {}, referenceDate) {
    const today = dateValue(referenceDate) || Date.now(); const horizon = today + (30 * 86400000); const invoices = Array.isArray(data.facturas) ? data.facturas : []; const invoiceById = new Map(invoices.map((item) => [item.id, item]));
    const overdue = invoices.filter((item) => ['SENT', 'PARTIAL', 'OVERDUE'].includes(item.estado) && Number(item.saldo_pendiente) > 0 && dateValue(item.fecha_vencimiento) < today).map((item) => notification(`invoice-overdue:${item.id}`, 'invoice_overdue', item.fecha_vencimiento, 'invoice', item.id, 'facturas.html', `La factura ${item.numero_factura || item.id} tiene saldo pendiente.`));
    const proposals = (Array.isArray(data.propuestas) ? data.propuestas : []).filter((item) => item.estado === 'SENT' && dateValue(item.fecha_validez) >= today && dateValue(item.fecha_validez) <= horizon).map((item) => notification(`proposal-expiring:${item.id}`, 'proposal_expiring', item.fecha_validez, 'proposal', item.id, 'propuestas.html', `La propuesta ${item.titulo_propuesta || item.id} está próxima a vencer.`));
    const payments = (Array.isArray(data.pagos_factura) ? data.pagos_factura : []).filter((item) => item?.id && parseDate(item.fecha_pago)).map((item) => { const invoice = invoiceById.get(item.factura_id); const label = invoice?.numero_factura || item.factura_id || 'una factura'; const amount = new Intl.NumberFormat('es', { style: 'currency', currency: invoice?.moneda || item.moneda || 'USD' }).format(Number(item.monto_pagado) || 0); return notification(`payment-received:${item.id}`, 'payment_received', item.fecha_pago, 'payment', item.id, 'transacciones.html', `Se registró un pago de ${amount} para ${label}.`); });
    return [...new Map([...overdue, ...proposals, ...payments].map((item) => [item.id, item])).values()].sort((a, b) => dateValue(b.eventDate) - dateValue(a.eventDate));
  }
  function applyPreferences(items = [], preferences = DEFAULT_PREFERENCES) { const normalized = normalizePreferences(preferences); return items.filter((item) => normalized[TYPE_PREFERENCES[item.type]]); }
  function parseStoredState(raw) { try { const value = JSON.parse(raw || ''); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error(); return { readIds: Array.isArray(value.readIds) ? [...new Set(value.readIds.filter((id) => typeof id === 'string'))] : [], preferences: normalizePreferences(value.preferences) }; } catch { return { readIds: [], preferences: normalizePreferences(DEFAULT_PREFERENCES) }; } }
  function pruneState(state = DEFAULT_STATE, liveIds = []) { const allowed = new Set(liveIds); return { readIds: [...new Set(state.readIds || [])].filter((id) => allowed.has(id)), preferences: normalizePreferences(state.preferences) }; }
  function markRead(state, id) { return { ...state, readIds: [...new Set([...(state.readIds || []), id])] }; }
  function markAllRead(state, ids = []) { return { ...state, readIds: [...new Set([...(state.readIds || []), ...ids])] }; }
  const api = { TYPES, DEFAULT_PREFERENCES, deriveNotifications, normalizePreferences, validatePreferences, applyPreferences, parseStoredState, pruneState, markRead, markAllRead, parseDate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowNotificationModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
