(function proposalModelFactory(globalScope) {
  'use strict';

  const PROPOSAL_STATES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];
  const CURRENCIES = ['USD', 'EUR', 'MXN'];

  function text(value) { return String(value ?? '').trim(); }
  function normalizeText(value) { return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  function round(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
  function number(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? round(parsed) : fallback; }
  function isValidDate(value) {
    const date = text(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }
  function todayDate() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
  function normalizeItem(item = {}) {
    const quantity = number(item.cantidad);
    const price = number(item.precio_unitario);
    return {
      id: text(item.id), servicio_referencia_id: text(item.servicio_referencia_id), descripcion_item: text(item.descripcion_item), unidad_medida: text(item.unidad_medida),
      cantidad: quantity, precio_unitario: price, subtotal_item: round(quantity * price)
    };
  }
  function calculateTotals(items = [], discount = 0) {
    const normalizedItems = Array.isArray(items) ? items.map(normalizeItem) : [];
    const subtotal_general = round(normalizedItems.reduce((sum, item) => sum + item.subtotal_item, 0));
    const descuento = number(discount);
    return { items: normalizedItems, subtotal_general, descuento, total_propuesta: round(subtotal_general - descuento) };
  }
  function normalizeProposal(proposal = {}) {
    const totals = calculateTotals(proposal.items, proposal.descuento);
    const status = PROPOSAL_STATES.includes(text(proposal.estado)) ? text(proposal.estado) : 'DRAFT';
    return {
      id: text(proposal.id), cliente_id: text(proposal.cliente_id), titulo_propuesta: text(proposal.titulo_propuesta), fecha_emision: text(proposal.fecha_emision), fecha_validez: text(proposal.fecha_validez),
      moneda: CURRENCIES.includes(text(proposal.moneda).toUpperCase()) ? text(proposal.moneda).toUpperCase() : 'USD', notas_condiciones: text(proposal.notas_condiciones), ...totals,
      estado: status, historial_estado: Array.isArray(proposal.historial_estado) ? proposal.historial_estado.map((entry) => ({ estado: text(entry.estado), fecha: text(entry.fecha), detalle: text(entry.detalle) })) : [],
      proyecto_convertido_id: text(proposal.proyecto_convertido_id), fecha_creacion: text(proposal.fecha_creacion), fecha_actualizacion: text(proposal.fecha_actualizacion)
    };
  }
  function validateProposal(proposal = {}, clients = []) {
    const candidate = normalizeProposal(proposal); const errors = {};
    const client = clients.find((item) => text(item.id) === candidate.cliente_id);
    if (!candidate.cliente_id || !client || (!candidate.id && text(client.estado).toLowerCase() === 'inactivo')) errors.cliente_id = 'Selecciona un cliente activo.';
    if (!candidate.titulo_propuesta) errors.titulo_propuesta = 'Ingresa un título para la propuesta.';
    if (!isValidDate(candidate.fecha_emision) || !isValidDate(candidate.fecha_validez) || candidate.fecha_validez <= candidate.fecha_emision) errors.fecha_validez = 'La fecha de validez debe ser posterior a la fecha de emisión.';
    if (!candidate.items.length) errors.items = 'Debes agregar al menos un ítem a la propuesta.';
    if (candidate.items.some((item) => !item.descripcion_item || item.cantidad <= 0 || item.precio_unitario < 0)) errors.items = candidate.items.some((item) => item.cantidad <= 0) ? 'La cantidad debe ser mayor a 0.' : candidate.items.some((item) => item.precio_unitario < 0) ? 'El precio unitario no puede ser negativo.' : 'Debes agregar al menos un ítem a la propuesta.';
    if (candidate.descuento < 0 || candidate.descuento >= candidate.subtotal_general) errors.descuento = 'El descuento debe ser menor que el subtotal.';
    if (candidate.total_propuesta <= 0) errors.total_propuesta = 'El total de la propuesta debe ser mayor a 0.';
    return { valid: !Object.keys(errors).length, errors };
  }
  function getEffectiveStatus(proposal = {}, today = todayDate()) { const item = normalizeProposal(proposal); return item.estado === 'SENT' && isValidDate(item.fecha_validez) && today > item.fecha_validez ? 'EXPIRED' : item.estado; }
  function filterProposals(proposals = [], clients = [], filters = {}) {
    const clientsById = new Map(clients.map((client) => [text(client.id), client])); const query = normalizeText(filters.query).split(/\s+/).filter(Boolean); const status = filters.status || 'todos';
    return proposals.map(normalizeProposal).filter((proposal) => (status === 'todos' || getEffectiveStatus(proposal, filters.today) === status) && (!query.length || query.every((token) => normalizeText(`${proposal.id} ${proposal.titulo_propuesta} ${clientsById.get(proposal.cliente_id)?.nombre_razon_social || ''}`).includes(token))));
  }
  function transitionProposal(proposal, nextStatus, options = {}) {
    const current = normalizeProposal(proposal); const effective = getEffectiveStatus(current, options.today); const allowed = { DRAFT: ['SENT'], SENT: ['ACCEPTED', 'REJECTED'], ACCEPTED: [] };
    if (!allowed[effective]?.includes(nextStatus)) throw new Error('Esta acción no está disponible para el estado actual.');
    if (nextStatus === 'SENT' && !options.valid) { const validation = validateProposal(current, options.clients || []); if (!validation.valid) throw new Error('Esta acción no está disponible para el estado actual.'); }
    const now = options.now || new Date().toISOString(); const details = { SENT: 'Propuesta marcada como enviada.', ACCEPTED: 'Propuesta marcada como aceptada.', REJECTED: 'Propuesta marcada como rechazada.' };
    return { ...current, estado: nextStatus, historial_estado: [...current.historial_estado, { estado: nextStatus, fecha: now, detalle: details[nextStatus] }], fecha_actualizacion: now };
  }
  function createItemFromService(service = {}) { const item = normalizeItem({ servicio_referencia_id: service.id, descripcion_item: service.descripcion || service.nombre_servicio, unidad_medida: service.unidad_medida, cantidad: 1, precio_unitario: service.tarifa_unitaria }); return { ...item, id: '' }; }
  function mergeProposals(base = [], overlay = []) { const merged = new Map((base || []).map((item) => { const normalized = normalizeProposal(item); return [normalized.id, normalized]; })); (Array.isArray(overlay) ? overlay : []).forEach((item) => { const normalized = normalizeProposal(item); if (normalized.id) merged.set(normalized.id, normalized); }); return [...merged.values()]; }
  function createProjectPrefill(proposal) { const item = normalizeProposal(proposal); if (getEffectiveStatus(item) !== 'ACCEPTED' || item.proyecto_convertido_id) throw new Error('Esta acción no está disponible para el estado actual.'); return { propuesta_origen: item.id, cliente_id: item.cliente_id, nombre_proyecto: item.titulo_propuesta, descripcion: item.notas_condiciones, monto_fijo: item.total_propuesta }; }
  function completeConversion(proposal, projectId, now = new Date().toISOString()) { const item = normalizeProposal(proposal); if (item.estado !== 'ACCEPTED' || item.proyecto_convertido_id || !text(projectId)) throw new Error('Esta acción no está disponible para el estado actual.'); return { ...item, estado: 'CONVERTED', proyecto_convertido_id: text(projectId), fecha_actualizacion: now, historial_estado: [...item.historial_estado, { estado: 'CONVERTED', fecha: now, detalle: 'Proyecto creado desde la propuesta.' }] }; }
  const api = { PROPOSAL_STATES, CURRENCIES, normalizeText, round, isValidDate, normalizeItem, calculateTotals, normalizeProposal, validateProposal, getEffectiveStatus, filterProposals, transitionProposal, createItemFromService, mergeProposals, createProjectPrefill, completeConversion };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowProposalModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
