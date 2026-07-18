(function profileModelFactory(globalScope) {
  'use strict';

  const PROFILE_STORAGE_KEY = 'freelanceflow.profile.v1';
  const PROFILE_VERSION = 1;
  const EMPTY_PROFILE = Object.freeze({ fullName: '', email: '', country: '' });
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function getDefaultProfile() { return { ...EMPTY_PROFILE }; }
  function normalizeProfile(profile = {}) {
    return {
      fullName: String(profile.fullName ?? '').trim(),
      email: String(profile.email ?? '').trim(),
      country: String(profile.country ?? '').trim()
    };
  }
  function validateProfile(profile = {}) {
    const value = normalizeProfile(profile);
    const errors = {};
    if (!value.fullName) errors.fullName = 'El nombre completo es obligatorio.';
    else if (value.fullName.length < 2 || value.fullName.length > 80) errors.fullName = 'El nombre completo debe tener entre 2 y 80 caracteres.';
    if (!value.email) errors.email = 'El correo electrónico es obligatorio.';
    else if (value.email.length > 160 || !EMAIL_PATTERN.test(value.email)) errors.email = 'Ingresa un correo electrónico válido.';
    if (!value.country) errors.country = 'El país es obligatorio.';
    else if (value.country.length < 2 || value.country.length > 80) errors.country = 'El país debe tener entre 2 y 80 caracteres.';
    return { valid: Object.keys(errors).length === 0, errors, value };
  }
  function parseStoredProfile(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object' || parsed.version !== PROFILE_VERSION) return getDefaultProfile();
      if (typeof parsed.fullName !== 'string' || typeof parsed.email !== 'string' || typeof parsed.country !== 'string') return getDefaultProfile();
      const result = validateProfile(parsed);
      return result.valid ? result.value : getDefaultProfile();
    } catch { return getDefaultProfile(); }
  }
  function getSafeStorage(scope = globalScope) {
    try { return scope?.localStorage || null; } catch { return null; }
  }
  function readProfile(storage) {
    try { return parseStoredProfile(storage?.getItem(PROFILE_STORAGE_KEY)); } catch { return getDefaultProfile(); }
  }
  function serializeProfile(profile = {}) {
    const value = normalizeProfile(profile);
    return JSON.stringify({ version: PROFILE_VERSION, fullName: value.fullName, email: value.email, country: value.country });
  }
  function initials(fullName = '') {
    return String(fullName).trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '—';
  }

  const api = { PROFILE_STORAGE_KEY, PROFILE_VERSION, getDefaultProfile, normalizeProfile, validateProfile, parseStoredProfile, getSafeStorage, readProfile, serializeProfile, initials };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowProfileModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));