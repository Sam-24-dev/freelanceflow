const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shell = require('../assets/js/app-shell.js');
const acceso = require('../assets/js/acceso.js');
const activity = require('../assets/js/activity-log.js');
const bitacora = require('../assets/js/bitacora.js');

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

test('shell owns the exact membership catalog and unknown navigation fails closed', () => {
  assert.equal(shell.MEMBERSHIPS.length, 2);
  assert.deepEqual(shell.getNavigationGroupsForMembership(), []);
  assert.deepEqual(shell.getNavigationGroupsForMembership({ role: 'unknown' }), []);
});

test('activation does not persist a membership when legacy cleanup fails', () => {
  let writes = 0;
  const session = {
    getItem: () => null,
    setItem() { writes += 1; },
    removeItem() { throw new Error('blocked'); }
  };
  assert.equal(acceso.activateAccessMembership('ff-operational-v1', { storage: session }), null);
  assert.equal(writes, 0);
});

test('all protected routes fail closed when membership storage is unavailable', () => {
  const unavailable = shell.readActiveMembership({
    getItem() { throw new Error('blocked'); }
  });
  assert.equal(unavailable.status, 'unavailable');
  for (const file of ['dashboard.html', 'clientes.html', 'bitacora.html']) {
    assert.equal(shell.getProtectedRedirect(file, unavailable), 'acceso.html');
  }
});

test('raw and legacy values cannot override a recognized membership', () => {
  const session = storage({
    [shell.ACTIVE_MEMBERSHIP_KEY]: 'ff-operational-v1',
    [shell.LEGACY_PROFILE_KEY]: 'administrative',
    [shell.LEGACY_ACTOR_KEY]: 'Injected actor',
    role: 'administrative',
    actor: 'Injected actor'
  });
  const active = shell.readActiveMembership(session);
  assert.equal(active.membership.role, 'operational');
  assert.equal(active.membership.actor, 'Equipo operativo');
  assert.equal(active.membership.destination, 'dashboard.html');
});

test('Bitácora reads only role-derived operational entries and discards legacy free-form entries', () => {
  const entries = [
    { role: 'operational', module: 'Dashboard' },
    { role: 'administrative', module: 'Bitacora' },
    { profile: 'operational', module: 'Legacy' }
  ];
  assert.deepEqual(
    bitacora.getVisibleEntries(entries).map((entry) => entry.module),
    ['Dashboard']
  );
});

test('Bitacora defers redirects to the shared shell guard to avoid double navigation', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/bitacora.js'), 'utf8');
  assert.doesNotMatch(source, /location\.replace/);
});

test('activity preserves limit and clear for a valid operational membership', () => {
  const session = storage();
  const membershipContext = { status: 'valid', membership: shell.MEMBERSHIPS[0] };
  const log = activity.createActivityLog({
    storage: session,
    limit: 1,
    getContext: () => membershipContext
  });
  log.record({ module: 'Clientes', action: 'Cliente registrado', description: 'Cliente privado.' });
  log.record({ module: 'Servicios', action: 'Servicio creado', description: 'Servicio privado.' });
  assert.deepEqual(log.read().map((entry) => entry.module), ['Servicios']);
  log.clear();
  assert.deepEqual(log.read(), []);
});

test('activity rejects administrative and absent contexts', () => {
  const contexts = [
    { status: 'valid', membership: shell.MEMBERSHIPS[1] },
    { status: 'available', membership: null }
  ];
  for (const membershipContext of contexts) {
    const log = activity.createActivityLog({
      storage: storage(),
      getContext: () => membershipContext
    });
    assert.equal(log.record({ module: 'X', action: 'Y', description: 'Z' }), null);
  }
});

test('activity derives trusted mapped data and never persists or exposes producer free text', () => {
  const session = storage();
  const log = activity.createActivityLog({
    storage: session,
    now: () => '2026-06-27T10:00:00.000Z',
    getContext: () => ({ status: 'valid', membership: shell.MEMBERSHIPS[0] })
  });
  const entry = log.record({
    module: 'Clientes',
    action: 'Cliente registrado',
    description: '<img src=x onerror=alert(1)> ACME RUC 0999999999001 token secreto $500'
  });
  assert.equal(entry.actor, 'Equipo operativo');
  assert.equal(entry.role, 'operational');
  assert.deepEqual(JSON.parse(session.getItem(activity.STORAGE_KEY)), [{
    version: 1,
    type: 'clients.registered',
    timestamp: '2026-06-27T10:00:00.000Z',
    membershipId: 'ff-operational-v1'
  }]);
  assert.equal(entry.description, 'Se registró un cliente.');
  assert.doesNotMatch(JSON.stringify(entry), /ACME|0999999999001|token secreto|\$500|<img/);
});

test('shell keeps expected operational mobile exclusions', () => {
  const links = shell.getBottomNavigationForMembership(shell.MEMBERSHIPS[0]);
  assert.equal(links.length, 5);
  assert.equal(links.some(([href]) => href === 'categorias.html'), false);
  assert.equal(shell.escapeHTML('<Admin & Co>'), '&lt;Admin &amp; Co&gt;');
});

test('Access preserves the public shell and renders scoped membership UI', () => {
  const html = fs.readFileSync(path.join(__dirname, '../pages/acceso.html'), 'utf8');
  const script = fs.readFileSync(path.join(__dirname, '../assets/js/acceso.js'), 'utf8');
  assert.match(html, /class="skip-link"/);
  assert.match(html, /class="landing-nav"/);
  assert.match(html, /class="brand-lockup"/);
  assert.match(html, /Volver al inicio/);
  assert.match(html, /class="landing-footer"/);
  assert.equal((html.match(/<h1/g) || []).length, 1);
  assert.match(script, /membership\.description/);
});

test('Access gives each allowed membership button a distinct accessible name', () => {
  const createElement = () => ({
    dataset: {},
    attributes: {},
    children: [],
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute(name, value) { this.attributes[name] = value; }
  });
  const previousDocument = global.document;
  global.document = { createElement };
  try {
    const container = createElement();
    acceso.renderMemberships(container, shell.MEMBERSHIPS);
    const buttons = container.children.map((card) => card.children.at(-1));
    assert.deepEqual(buttons.map((button) => button.dataset.membershipId), shell.MEMBERSHIPS.map((membership) => membership.id));
    assert.deepEqual(buttons.map((button) => button.attributes['aria-label']), shell.MEMBERSHIPS.map((membership) => `Continuar en este espacio: ${membership.name}`));
    assert.notEqual(buttons[0].attributes['aria-label'], buttons[1].attributes['aria-label']);
  } finally {
    global.document = previousDocument;
  }
});

test('Access responsive CSS presents real cards without hiding return navigation or footer', () => {
  const html = fs.readFileSync(path.join(__dirname, '../pages/acceso.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');
  assert.match(html, /class="landing-shell access-page/);
  assert.match(css, /\.access-page \.access-membership\s*\{[^}]*display:\s*grid/i);
  assert.match(css, /\.access-page \.access-membership\s*\{[^}]*border:\s*1px solid/i);
  assert.doesNotMatch(css, /@media \(max-height: 480px\)[\s\S]*?\.landing-(?:nav|footer)[^{}]*\{[^}]*display:\s*none/i);
});
