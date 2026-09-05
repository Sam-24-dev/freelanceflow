const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const shell = require('../assets/js/app-shell.js');

test('app shell derives protected-page access only from the server session', async () => {
  const calls = [];
  const context = await shell.resolveSessionContext({
    session: async () => {
      calls.push('/api/v1/session/');
      return {
        authenticated: true,
        active_workspace: {
          workspace_public_id: 'workspace-a',
          workspace_name: 'Studio A',
          workspace_slug: 'studio-a',
          role: 'OPERATIONAL'
        }
      };
    }
  });

  assert.deepEqual(calls, ['/api/v1/session/']);
  assert.equal(context.status, 'valid');
  assert.equal(shell.getProtectedRedirect('dashboard.html', context), '');
  assert.equal(shell.getProtectedRedirect('bitacora.html', context), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('dashboard.html', { status: 'anonymous' }), 'acceso.html');
  assert.equal(shell.getProtectedRedirect('dashboard.html', { status: 'workspace_required' }), 'acceso.html');
});

test('app shell routes exact server workspace roles without an access-dashboard bounce', () => {
  for (const role of ['OWNER', 'OPERATIONAL']) {
    const context = shell.sessionContext({
      authenticated: true,
      active_workspace: { workspace_public_id: 'workspace-a', workspace_name: 'Studio A', role }
    });
    assert.equal(context.status, 'valid');
    assert.equal(shell.getProtectedRedirect('dashboard.html', context), '');
    assert.equal(shell.getNavigationGroupsForWorkspace(context.workspace)[0].label, 'Operaci\u00f3n');
  }

  const administrative = shell.sessionContext({
    authenticated: true,
    active_workspace: { workspace_public_id: 'workspace-b', workspace_name: 'Studio B', role: 'ADMINISTRATIVE' }
  });
  assert.equal(administrative.status, 'valid');
  assert.equal(shell.getProtectedRedirect('bitacora.html', administrative), '');
  assert.equal(shell.getProtectedRedirect('dashboard.html', administrative), 'bitacora.html');
  assert.equal(shell.getNavigationGroupsForWorkspace(administrative.workspace)[0].label, 'Administraci\u00f3n');
});

test('app shell does not derive authorization from browser storage', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/app-shell.js'), 'utf8');
  assert.doesNotMatch(source, /sessionStorage|ACTIVE_MEMBERSHIP|readActiveMembership|activateMembership|MEMBERSHIPS/);
});
