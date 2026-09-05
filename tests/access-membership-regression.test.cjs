const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const shell = require('../assets/js/app-shell.js');
const activity = require('../assets/js/activity-log.js');
const bitacora = require('../assets/js/bitacora.js');

function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, String(value)) };
}

test('server workspace role controls shell navigation and protected routes', () => {
  const operational = shell.sessionContext({ authenticated: true, active_workspace: { workspace_public_id: 'workspace-a', workspace_name: 'Studio A', workspace_slug: 'studio-a', role: 'OPERATIONAL' } });
  const administrative = shell.sessionContext({ authenticated: true, active_workspace: { workspace_public_id: 'workspace-b', workspace_name: 'Office B', workspace_slug: 'office-b', role: 'ADMINISTRATIVE' } });
  assert.equal(shell.getProtectedRedirect('dashboard.html', operational), '');
  assert.equal(shell.getProtectedRedirect('bitacora.html', operational), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('dashboard.html', administrative), 'bitacora.html');
  assert.deepEqual(shell.getNavigationGroupsForWorkspace({ role: 'unknown' }), []);
});

test('activity storage contains only a closed local event contract', () => {
  const session = storage();
  const log = activity.createActivityLog({ storage: session, now: () => '2026-06-27T10:00:00.000Z' });
  const entry = log.record({ module: 'Clientes', action: 'Cliente registrado', description: 'Cliente privado.' });
  assert.deepEqual(JSON.parse(session.getItem(activity.STORAGE_KEY)), [{ version: 1, type: 'clients.registered', timestamp: '2026-06-27T10:00:00.000Z' }]);
  assert.equal(entry.actor, 'Actividad local');
  assert.deepEqual(bitacora.getVisibleEntries([entry]), [entry]);
});

test('access keeps its public navigation and cards', () => {
  const html = fs.readFileSync(path.join(__dirname, '../pages/acceso.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');
  assert.match(html, /class="landing-shell access-page/);
  assert.match(css, /\.access-page \.access-membership\s*\{[^}]*display:\s*grid/i);
  assert.match(html, /Volver al inicio/);
});
