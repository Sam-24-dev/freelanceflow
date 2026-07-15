const test = require('node:test');
const assert = require('node:assert/strict');

const acceso = require('../assets/js/acceso.js');

function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

test('selectAccessProfile stores operational profile and redirects to dashboard', () => {
  const session = storage();
  const result = acceso.selectAccessProfile('operational', { storage: session });

  assert.equal(result.redirectTo, 'dashboard.html');
  assert.equal(session.getItem(acceso.PROFILE_KEY), 'operational');
  assert.equal(session.getItem(acceso.ACTOR_KEY), 'Equipo operativo');
});

test('selectAccessProfile stores administrative profile and redirects to bitácora', () => {
  const session = storage();
  const result = acceso.selectAccessProfile('administrative', { storage: session });

  assert.equal(result.redirectTo, 'bitacora.html');
  assert.equal(session.getItem(acceso.PROFILE_KEY), 'administrative');
  assert.equal(session.getItem(acceso.ACTOR_KEY), 'Administración');
});
