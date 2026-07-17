(function settingsModelFactory(globalScope) {
  'use strict';
  const SETTINGS_DEFAULTS = Object.freeze({ invoice_prefix: 'FAC-', next_invoice_number: 25, default_due_days: 15, default_currency: 'USD' });
  const SETTINGS_CURRENCY_OPTIONS = Object.freeze(['USD', 'EUR', 'MXN']);
  function positiveInteger(value) { if (value === '' || value === null || typeof value === 'undefined') return null; const number = Number(value); return Number.isInteger(number) && number > 0 ? number : null; }
  function getDefaultSettings() { return { ...SETTINGS_DEFAULTS }; }
  function normalizeSettings(settings = {}) { const prefix = String(settings.invoice_prefix ?? '').trim(); const currency = String(settings.default_currency ?? '').trim().toUpperCase(); return { invoice_prefix: prefix, next_invoice_number: positiveInteger(settings.next_invoice_number), default_due_days: positiveInteger(settings.default_due_days), default_currency: currency }; }
  function validateSettings(settings = {}) { const value = normalizeSettings(settings); const errors = {}; if (!value.invoice_prefix) errors.invoice_prefix = 'El prefijo de factura es obligatorio.'; if (!value.next_invoice_number) errors.next_invoice_number = 'Ingresa un número de factura entero mayor que 0.'; if (!value.default_due_days) errors.default_due_days = 'Ingresa una cantidad de días entera mayor que 0.'; if (!SETTINGS_CURRENCY_OPTIONS.includes(value.default_currency)) errors.default_currency = 'Selecciona una moneda predeterminada.'; return { valid: Object.keys(errors).length === 0, errors, value }; }
  function formatInvoiceNumber(prefix, number) { const normalizedPrefix = String(prefix ?? '').trim(); const normalizedNumber = positiveInteger(number); return normalizedPrefix && normalizedNumber ? `${normalizedPrefix}${String(normalizedNumber).padStart(4, '0')}` : '—'; }
  function buildSettingsPreview(settings = {}) { const value = normalizeSettings(settings); return { invoice_number: formatInvoiceNumber(value.invoice_prefix, value.next_invoice_number), due_behavior: value.default_due_days ? `${value.default_due_days} días después de la emisión` : '—', currency: SETTINGS_CURRENCY_OPTIONS.includes(value.default_currency) ? value.default_currency : '—' }; }
  function parseStoredSettings(raw) { try { const parsed = JSON.parse(raw); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return getDefaultSettings(); const result = validateSettings(parsed); return result.valid ? result.value : getDefaultSettings(); } catch { return getDefaultSettings(); } }
  const api = { SETTINGS_DEFAULTS, SETTINGS_CURRENCY_OPTIONS, getDefaultSettings, normalizeSettings, validateSettings, formatInvoiceNumber, buildSettingsPreview, parseStoredSettings };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowSettingsModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
