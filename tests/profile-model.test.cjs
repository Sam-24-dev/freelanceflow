const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const model = require('../assets/js/profile-model.js');
const activity = require('../assets/js/activity-log.js');

function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

test('normalizes valid profile values without mutating the input', () => {
  const input = { fullName: '  Ana María  ', email: '  ANA@example.com ', country: ' Ecuador ' };
  assert.deepEqual(model.normalizeProfile(input), { fullName: 'Ana María', email: 'ANA@example.com', country: 'Ecuador' });
  assert.equal(input.fullName, '  Ana María  ');
});

test('requires every profile field and enforces valid lengths and email shape', () => {
  const required = model.validateProfile({ fullName: ' ', email: '', country: '' }).errors;
  assert.equal(required.fullName, 'El nombre completo es obligatorio.');
  assert.equal(required.email, 'El correo electrónico es obligatorio.');
  assert.equal(required.country, 'El país es obligatorio.');
  assert.ok(model.validateProfile({ fullName: 'A', email: 'ana@example.com', country: 'EC' }).errors.fullName);
  assert.ok(model.validateProfile({ fullName: 'Ana', email: 'invalido', country: 'Ecuador' }).errors.email);
  assert.ok(model.validateProfile({ fullName: 'Ana', email: `${'a'.repeat(150)}@example.com`, country: 'Ecuador' }).errors.email);
  assert.ok(model.validateProfile({ fullName: 'Ana', email: 'ana@example.com', country: 'E'.repeat(81) }).errors.country);
});

test('recovers profile-first state from corrupt, wrong-version, and invalid stored values', () => {
  const defaults = model.getDefaultProfile();
  assert.deepEqual(model.readProfile(storage({ [model.PROFILE_STORAGE_KEY]: '{bad json' })), defaults);
  assert.deepEqual(model.readProfile(storage({ [model.PROFILE_STORAGE_KEY]: JSON.stringify({ version: 2, fullName: 'Ana', email: 'ana@example.com', country: 'Ecuador' }) })), defaults);
  assert.deepEqual(model.readProfile(storage({ [model.PROFILE_STORAGE_KEY]: JSON.stringify({ version: 1, fullName: 'Ana', email: 42, country: 'Ecuador' }) })), defaults);
});

test('serializes only the versioned allowed profile properties', () => {
  assert.equal(model.serializeProfile({ fullName: ' Ana ', email: ' ana@example.com ', country: ' Ecuador ', role: 'administrative', token: 'secret' }), JSON.stringify({ version: 1, fullName: 'Ana', email: 'ana@example.com', country: 'Ecuador' }));
});

test('returns a safe null storage boundary when the browser storage getter throws', () => {
  const scope = {};
  Object.defineProperty(scope, 'localStorage', { get() { throw new Error('storage unavailable'); } });

  assert.equal(model.getSafeStorage(scope), null);
  assert.deepEqual(model.readProfile(model.getSafeStorage(scope)), model.getDefaultProfile());
});

test('saves profiles only through the guarded profile storage boundary', () => {
  const data = new Map();
  const profileStorage = storage();
  profileStorage.setItem = (key, value) => data.set(key, String(value));

  assert.equal(model.saveProfile(profileStorage, { fullName: ' Ana ', email: ' ana@example.com ', country: ' Ecuador ' }), true);
  assert.equal(data.get(model.PROFILE_STORAGE_KEY), JSON.stringify({ version: 1, fullName: 'Ana', email: 'ana@example.com', country: 'Ecuador' }));
  assert.equal(model.saveProfile(null, { fullName: 'Ana', email: 'ana@example.com', country: 'Ecuador' }), false);
  assert.equal(model.saveProfile({ setItem() { throw new Error('blocked'); } }, { fullName: 'Ana', email: 'ana@example.com', country: 'Ecuador' }), false);
});

test('Cuenta uses the profile model boundary and records every valid save', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/cuenta.js'), 'utf8');

  assert.match(source, /model\.saveProfile\(storage,\s*result\.value\)/);
  assert.doesNotMatch(source, /localStorage\.setItem\(/);
  assert.match(source, /deduplicate:\s*false/);
});

test('Cuenta exposes accessible feedback when storage is unavailable', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/cuenta.js'), 'utf8');

  assert.match(source, /showStorageUnavailable/);
  assert.match(source, /almacenamiento local/i);
});

test('profile toast does not intercept save-button pointer input', () => {
  const css = fs.readFileSync(path.join(__dirname, '../assets/css/app.css'), 'utf8');

  assert.match(css, /\.profile-toast\{[^}]*pointer-events:\s*none/);
});

test('current public stories describe membership spaces instead of obsolete profile selection', () => {
  const stories = fs.readFileSync(path.join(__dirname, '../docs/user-stories.md'), 'utf8');

  assert.match(stories, /espacio de membres/i);
  assert.doesNotMatch(stories, /elegir un perfil de trabajo/i);
});


test('records each successful Cuenta save without weakening the default activity deduplication', () => {
  const data = new Map();
  const storage = {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value))
  };
  const log = activity.createActivityLog({ storage, getContext: () => ({ status: 'valid', membership: require('../assets/js/app-shell.js').MEMBERSHIPS[0] }) });
  const save = { module: 'Cuenta', action: 'Perfil actualizado', description: 'Informaci?n b?sica del perfil actualizada.', deduplicate: false };

  log.record(save);
  log.record(save);

  assert.equal(log.read().length, 2);
});
