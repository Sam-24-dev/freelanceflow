(function settingsModelFactory(globalScope) {
  'use strict';

  const SETTINGS_STORAGE_VERSION = 1;
  const SETTINGS_DEFAULTS = Object.freeze({ invoice_prefix: 'FAC-', next_invoice_number: 25, default_due_days: 15, default_currency: 'USD' });
  const SETTINGS_CURRENCY_OPTIONS = Object.freeze(['USD']);
  const SETTINGS_FIELDS = new Set(Object.keys(SETTINGS_DEFAULTS));
  const ENVELOPE_FIELDS = new Set(['version', 'revision', 'settings']);

  function isPlainRecord(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
  function hasOnlyFields(value, fields) { return isPlainRecord(value) && Object.keys(value).every((key) => fields.has(key)); }
  function positiveInteger(value) { if (value === '' || value === null || typeof value === 'undefined') return null; const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null; }
  function nonNegativeInteger(value) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null; }

  function getDefaultSettings() { return { ...SETTINGS_DEFAULTS }; }
  function getDefaultSettingsEnvelope() { return { version: SETTINGS_STORAGE_VERSION, revision: 0, settings: getDefaultSettings() }; }

  function normalizeSettings(settings = {}) {
    const prefix = String(settings.invoice_prefix ?? '').trim();
    const currency = String(settings.default_currency ?? '').trim().toUpperCase();
    return { invoice_prefix: prefix, next_invoice_number: positiveInteger(settings.next_invoice_number), default_due_days: positiveInteger(settings.default_due_days), default_currency: currency };
  }

  function validateSettings(settings = {}) {
    const value = normalizeSettings(settings);
    const errors = {};
    if (!value.invoice_prefix) errors.invoice_prefix = 'El prefijo de factura es obligatorio.';
    if (!value.next_invoice_number) errors.next_invoice_number = 'Ingresa un número de factura entero mayor que 0.';
    if (!value.default_due_days) errors.default_due_days = 'Ingresa una cantidad de días entera mayor que 0.';
    if (!SETTINGS_CURRENCY_OPTIONS.includes(value.default_currency)) errors.default_currency = 'Selecciona una moneda predeterminada.';
    return { valid: Object.keys(errors).length === 0, errors, value };
  }

  function createSettingsEnvelope(settings = {}, revision = 0) {
    const result = validateSettings(settings);
    return result.valid && nonNegativeInteger(revision) !== null
      ? { version: SETTINGS_STORAGE_VERSION, revision, settings: result.value }
      : null;
  }

  function validateStoredSettingsEnvelope(envelope) {
    if (!hasOnlyFields(envelope, ENVELOPE_FIELDS) || Object.keys(envelope).length !== ENVELOPE_FIELDS.size) return false;
    if (envelope.version !== SETTINGS_STORAGE_VERSION || nonNegativeInteger(envelope.revision) === null) return false;
    if (!hasOnlyFields(envelope.settings, SETTINGS_FIELDS) || Object.keys(envelope.settings).length !== SETTINGS_FIELDS.size) return false;
    const settings = envelope.settings;
    return typeof settings.invoice_prefix === 'string'
      && settings.invoice_prefix === settings.invoice_prefix.trim()
      && typeof settings.next_invoice_number === 'number'
      && typeof settings.default_due_days === 'number'
      && typeof settings.default_currency === 'string'
      && validateSettings(settings).valid;
  }

  function parseStoredSettingsEnvelope(raw) {
    try {
      const envelope = JSON.parse(raw);
      return validateStoredSettingsEnvelope(envelope) ? { version: envelope.version, revision: envelope.revision, settings: { ...envelope.settings } } : null;
    } catch { return null; }
  }

  function serializeSettingsEnvelope(envelope) {
    return validateStoredSettingsEnvelope(envelope) ? JSON.stringify(envelope) : null;
  }

  function resolveStoredSettingsEnvelope(...rawValues) {
    return rawValues.map(parseStoredSettingsEnvelope)
      .filter(Boolean)
      .reduce((latest, envelope) => (!latest || envelope.revision > latest.revision ? envelope : latest), null)
      || getDefaultSettingsEnvelope();
  }

  function formatInvoiceNumber(prefix, number) {
    const normalizedPrefix = String(prefix ?? '').trim();
    const normalizedNumber = positiveInteger(number);
    return normalizedPrefix && normalizedNumber ? `${normalizedPrefix}${String(normalizedNumber).padStart(4, '0')}` : '—';
  }

  function buildSettingsPreview(settings = {}) {
    const value = normalizeSettings(settings);
    return { invoice_number: formatInvoiceNumber(value.invoice_prefix, value.next_invoice_number), due_behavior: value.default_due_days ? `${value.default_due_days} días después de la emisión` : '—', currency: SETTINGS_CURRENCY_OPTIONS.includes(value.default_currency) ? value.default_currency : '—' };
  }

  function parseStoredSettings(raw) { return (parseStoredSettingsEnvelope(raw) || getDefaultSettingsEnvelope()).settings; }

  const api = { SETTINGS_STORAGE_VERSION, SETTINGS_DEFAULTS, SETTINGS_CURRENCY_OPTIONS, getDefaultSettings, getDefaultSettingsEnvelope, normalizeSettings, validateSettings, createSettingsEnvelope, validateStoredSettingsEnvelope, parseStoredSettingsEnvelope, serializeSettingsEnvelope, resolveStoredSettingsEnvelope, formatInvoiceNumber, buildSettingsPreview, parseStoredSettings };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowSettingsModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
