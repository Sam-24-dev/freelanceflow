(function fiscalConfigModelFactory(globalScope) {
  'use strict';

  const RATE_ERROR = 'El porcentaje debe estar entre 0 y 100.';
  const round = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

  function parseRate(value) {
    if (value === null || typeof value === 'undefined' || String(value).trim() === '') return null;
    const rate = Number(value);
    return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? round(rate) : NaN;
  }

  function normalizeFiscalConfiguration(configuration = {}) {
    const appliesTax = Boolean(configuration.aplica_impuesto_valor_agregado);
    const retention = parseRate(configuration.porcentaje_retencion_estimado);
    const tax = parseRate(configuration.porcentaje_impuesto);
    return {
      identificacion_fiscal: String(configuration.identificacion_fiscal ?? '').trim(),
      regimen_tributario: String(configuration.regimen_tributario ?? '').trim(),
      porcentaje_retencion_estimado: Number.isNaN(retention) ? null : retention,
      aplica_impuesto_valor_agregado: appliesTax,
      porcentaje_impuesto: appliesTax && !Number.isNaN(tax) ? tax : 0
    };
  }

  function validateFiscalConfiguration(configuration = {}) {
    const candidate = normalizeFiscalConfiguration(configuration);
    const errors = {};
    if (!candidate.identificacion_fiscal) errors.identificacion_fiscal = 'La identificación fiscal es obligatoria.';
    if (!candidate.regimen_tributario) errors.regimen_tributario = 'Selecciona o ingresa un régimen tributario.';
    if (Number.isNaN(parseRate(configuration.porcentaje_retencion_estimado)) || candidate.porcentaje_retencion_estimado === null) errors.porcentaje_retencion_estimado = RATE_ERROR;
    if (candidate.aplica_impuesto_valor_agregado && (Number.isNaN(parseRate(configuration.porcentaje_impuesto)) || candidate.porcentaje_impuesto === null)) errors.porcentaje_impuesto = RATE_ERROR;
    return { valid: Object.keys(errors).length === 0, errors, value: candidate };
  }

  function calculateFiscalEstimate(configuration = {}) {
    const value = normalizeFiscalConfiguration(configuration);
    const retentionRate = parseRate(configuration.porcentaje_retencion_estimado);
    const taxRate = parseRate(configuration.porcentaje_impuesto);
    if (retentionRate === null || Number.isNaN(retentionRate) || (value.aplica_impuesto_valor_agregado && (taxRate === null || Number.isNaN(taxRate)))) return null;
    const base = 1000;
    const retention = round(base * retentionRate / 100);
    const tax = value.aplica_impuesto_valor_agregado ? round(base * taxRate / 100) : 0;
    return { base, retention, tax, estimatedTotal: round(base - retention + tax) };
  }

  function parseStoredFiscalConfiguration(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return null;
      const validation = validateFiscalConfiguration(parsed);
      return validation.valid ? validation.value : null;
    } catch {
      return null;
    }
  }

  const api = { normalizeFiscalConfiguration, validateFiscalConfiguration, calculateFiscalEstimate, parseStoredFiscalConfiguration };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowFiscalConfigModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
