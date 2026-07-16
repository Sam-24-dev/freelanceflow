const test = require('node:test');
const assert = require('node:assert/strict');

const proposal = require('../assets/js/proposal-model.js');

const clients = [{ id: 'cli_001', estado: 'activo' }, { id: 'cli_002', estado: 'inactivo' }];
const services = [{ id: 'srv_001', nombre_servicio: 'Consultoría UX', descripcion: 'Auditoría UX', unidad_medida: 'Hora', tarifa_unitaria: 75, moneda: 'USD' }];
const validDraft = {
  id: 'prop_test', cliente_id: 'cli_001', titulo_propuesta: 'Rediseño web', fecha_emision: '2026-07-16', fecha_validez: '2026-08-16', moneda: 'USD', descuento: 10,
  items: [{ descripcion_item: 'Diseño', unidad_medida: 'Hora', cantidad: 2.333, precio_unitario: 75.555 }]
};

test('normalizes monetary values and calculates rounded totals immutably', () => {
  const source = structuredClone(validDraft);
  const normalized = proposal.normalizeProposal(source);
  assert.equal(normalized.items[0].subtotal_item, 176.05);
  assert.equal(normalized.subtotal_general, 176.05);
  assert.equal(normalized.total_propuesta, 166.05);
  assert.deepEqual(source, validDraft);
});

test('validates active clients, dates, items, discount and one currency', () => {
  const invalid = { ...validDraft, id: '', cliente_id: 'cli_002', fecha_validez: '2026-07-16', descuento: 200, items: [{ ...validDraft.items[0], cantidad: 0, precio_unitario: -1, moneda: 'EUR' }] };
  const result = proposal.validateProposal(invalid, clients);
  assert.equal(result.valid, false);
  assert.ok(result.errors.cliente_id && result.errors.fecha_validez && result.errors.items && result.errors.descuento);
});

test('uses calendar dates and derives expiration only after validity date', () => {
  assert.equal(proposal.isValidDate('2026-02-29'), false);
  assert.equal(proposal.getEffectiveStatus({ estado: 'SENT', fecha_validez: '2026-07-16' }, '2026-07-16'), 'SENT');
  assert.equal(proposal.getEffectiveStatus({ estado: 'SENT', fecha_validez: '2026-07-16' }, '2026-07-17'), 'EXPIRED');
});

test('filters and searches proposals without accents or case sensitivity', () => {
  const records = [{ ...validDraft, id: 'prop_001', cliente_id: 'cli_001', titulo_propuesta: 'Diseño ágil', estado: 'SENT' }];
  const result = proposal.filterProposals(records, [{ id: 'cli_001', nombre_razon_social: 'Ñandú Labs' }], { query: 'nandu diseno', status: 'SENT' });
  assert.equal(result.length, 1);
});

test('only permits canonical state transitions and keeps inputs immutable', () => {
  const sent = proposal.normalizeProposal({ ...validDraft, estado: 'SENT' });
  const accepted = proposal.transitionProposal(sent, 'ACCEPTED', { today: '2026-07-20', now: '2026-07-20T12:00:00.000Z' });
  assert.equal(accepted.estado, 'ACCEPTED');
  assert.equal(sent.estado, 'SENT');
  assert.throws(() => proposal.transitionProposal(accepted, 'REJECTED', { today: '2026-07-20' }), /no está disponible/);
});

test('creates service item snapshots and merges local overlay without mutation', () => {
  const item = proposal.createItemFromService(services[0]);
  assert.deepEqual(item, { id: '', servicio_referencia_id: 'srv_001', descripcion_item: 'Auditoría UX', unidad_medida: 'Hora', cantidad: 1, precio_unitario: 75, subtotal_item: 75 });
  const base = [{ ...validDraft, id: 'prop_001' }];
  const merged = proposal.mergeProposals(base, [{ ...validDraft, id: 'prop_001', titulo_propuesta: 'Actualizada' }, { ...validDraft, id: 'prop_002' }]);
  assert.equal(merged.length, 2);
  assert.equal(merged.find((item) => item.id === 'prop_001').titulo_propuesta, 'Actualizada');
  assert.equal(base[0].titulo_propuesta, validDraft.titulo_propuesta);
});

test('builds one project prefill payload and prevents duplicate conversion', () => {
  const accepted = proposal.normalizeProposal({ ...validDraft, estado: 'ACCEPTED', total_propuesta: 0 });
  const payload = proposal.createProjectPrefill(accepted);
  assert.equal(payload.propuesta_origen, 'prop_test');
  assert.equal(payload.monto_fijo, 166.05);
  const converted = proposal.completeConversion(accepted, 'proy_009', '2026-07-20T12:00:00.000Z');
  assert.equal(converted.estado, 'CONVERTED');
  assert.equal(converted.proyecto_convertido_id, 'proy_009');
  assert.throws(() => proposal.completeConversion(converted, 'proy_010'), /no está disponible/);
});
