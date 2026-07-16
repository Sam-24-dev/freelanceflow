const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../assets/data/mock-data.json');
const proposal = require('../assets/js/proposal-model.js');

test('proposal baseline covers every approved state and has referential integrity', () => {
  assert.equal(data.propuestas.length >= 6, true);
  const states = new Set(data.propuestas.map((item) => proposal.getEffectiveStatus(item, '2026-07-16')));
  ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'].forEach((state) => assert.ok(states.has(state)));
  const clients = new Set(data.clientes.map((item) => item.id));
  const services = new Set(data.servicios.map((item) => item.id));
  const projects = new Set(data.proyectos.map((item) => item.id));
  data.propuestas.forEach((item) => {
    assert.ok(clients.has(item.cliente_id));
    item.items.forEach((line) => assert.ok(!line.servicio_referencia_id || services.has(line.servicio_referencia_id)));
    assert.ok(!item.proyecto_convertido_id || projects.has(item.proyecto_convertido_id));
    assert.equal(proposal.normalizeProposal(item).total_propuesta, item.total_propuesta);
  });
  assert.equal(data.proyectos.find((item) => item.id === 'proy_001').propuesta_origen, 'prop_001');
});
