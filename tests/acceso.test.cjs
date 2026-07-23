const test = require('node:test');
const assert = require('node:assert/strict');
const context = require('../assets/js/app-shell.js');
const acceso = require('../assets/js/acceso.js');

function storage(initial = {}) { const data = new Map(Object.entries(initial)); return { getItem: (key) => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) }; }

test('membership context only accepts exact membership IDs and derives role, actor, and destination', () => {
  const session = storage({ [context.ACTIVE_MEMBERSHIP_KEY]: 'ff-operational-v1' });
  const active = context.readActiveMembership(session);
  assert.equal(active.status, 'valid');
  assert.equal(active.membership.role, 'operational');
  assert.equal(active.membership.actor, 'Equipo operativo');
  assert.equal(active.membership.destination, 'dashboard.html');
  for (const value of [null, ' unknown ', 'FF-OPERATIONAL-V1', '{"role":"operational"}', '']) assert.notEqual(context.readActiveMembership(storage({ [context.ACTIVE_MEMBERSHIP_KEY]: value })).status, 'valid');
  assert.equal(context.MEMBERSHIPS.length, 2);
  assert.deepEqual(context.MEMBERSHIPS.map(({ role }) => role), ['operational', 'administrative']);
});

test('legacy profile and actor values never grant access', () => {
  const session = storage({ [context.LEGACY_PROFILE_KEY]: 'operational', [context.LEGACY_ACTOR_KEY]: 'Administraci\u00f3n' });
  assert.equal(context.readActiveMembership(session).status, 'available');
  assert.equal(context.readActiveMembership(storage({ [context.ACTIVE_MEMBERSHIP_KEY]: 'administrative' })).status, 'invalid');
});

test('activation stores only a recognized membership ID and clears legacy state after success', () => {
  const session = storage({ [context.LEGACY_PROFILE_KEY]: 'operational', [context.LEGACY_ACTOR_KEY]: 'Equipo operativo' });
  const active = acceso.activateAccessMembership('ff-administrative-v1', { storage: session });
  assert.equal(active.destination, 'bitacora.html');
  assert.equal(session.getItem(context.ACTIVE_MEMBERSHIP_KEY), 'ff-administrative-v1');
  assert.equal(session.getItem(context.LEGACY_PROFILE_KEY), null);
  assert.equal(session.getItem(context.LEGACY_ACTOR_KEY), null);
  assert.equal(acceso.activateAccessMembership('unknown', { storage: session }), null);
  assert.equal(session.getItem(context.ACTIVE_MEMBERSHIP_KEY), 'ff-administrative-v1');
});

test('access screen exposes required copy, membership-only actions, and accessible error', () => {
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '../pages/acceso.html'), 'utf8').replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
  assert.match(html, /Contexto de trabajo/);
  assert.match(html, /Eleg\u00ed d\u00f3nde trabajar/);
  assert.match(html, /Estos espacios y roles ya est\u00e1n asignados\. Elegir un espacio no modifica tus permisos\./);
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '../assets/js/acceso.js'), 'utf8'), /Continuar en este espacio/);
  assert.match(html, /No hay espacios disponibles para esta identidad\. Contact\u00e1 al administrador\./);
  assert.match(html, /No pudimos cargar tus accesos\. Volv\u00e9 a intentarlo\./);
  assert.match(html, /data-access-error[^>]*role="alert"[^>]*aria-live="assertive"/);
  assert.doesNotMatch(html, /data-access-(?:profile|role|actor)/);
});

test('access activation never emits an operational activity event', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '../assets/js/acceso.js'), 'utf8');
  assert.doesNotMatch(source, /Contexto activado|FreelanceFlowActivity/);
});
