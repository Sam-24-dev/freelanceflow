(function serviceModelFactory(globalScope) {
  'use strict';

  const SERVICE_UNIT_OPTIONS = ['Hora', 'Proyecto', 'Entregable'];
  const SERVICE_CURRENCY_OPTIONS = ['USD', 'EUR', 'MXN'];

  function normalizeText(value) {
    return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function parseRate(value) {
    if (value === '' || value === null || typeof value === 'undefined') return null;
    const rate = Number(value);
    return Number.isFinite(rate) && rate > 0 ? Math.round((rate + Number.EPSILON) * 100) / 100 : NaN;
  }

  function normalizeService(service = {}) {
    const rate = parseRate(service.tarifa_unitaria);
    const unit = String(service.unidad_medida ?? '').trim();
    const currency = String(service.moneda ?? 'USD').trim().toUpperCase();
    return {
      id: String(service.id ?? '').trim(),
      nombre_servicio: String(service.nombre_servicio ?? '').trim(),
      descripcion: String(service.descripcion ?? '').trim(),
      unidad_medida: SERVICE_UNIT_OPTIONS.includes(unit) ? unit : '',
      tarifa_unitaria: Number.isNaN(rate) ? null : rate,
      moneda: SERVICE_CURRENCY_OPTIONS.includes(currency) ? currency : 'USD'
    };
  }

  function validateService(service = {}, existingServices = []) {
    const candidate = normalizeService(service);
    const errors = {};
    if (!candidate.nombre_servicio) errors.nombre_servicio = 'Ingresá un nombre para el servicio.';
    if (candidate.nombre_servicio && existingServices.some((existing) => normalizeText(existing.nombre_servicio) === normalizeText(candidate.nombre_servicio) && String(existing.id) !== candidate.id)) {
      errors.nombre_servicio = 'Ya existe un servicio con ese nombre.';
    }
    if (!SERVICE_UNIT_OPTIONS.includes(candidate.unidad_medida)) errors.unidad_medida = 'Seleccioná una unidad de medida.';
    if (Number.isNaN(parseRate(service.tarifa_unitaria)) || candidate.tarifa_unitaria === null) errors.tarifa_unitaria = 'Ingresá una tarifa mayor que cero.';
    return { valid: Object.keys(errors).length === 0, errors };
  }

  function filterServices(services = [], filters = {}) {
    const tokens = normalizeText(filters.query).split(/\s+/).filter(Boolean);
    const unit = filters.unit || 'todas';
    return services.map(normalizeService).filter((service) => (unit === 'todas' || service.unidad_medida === unit) && (!tokens.length || tokens.every((token) => normalizeText(`${service.nombre_servicio} ${service.descripcion}`).includes(token))));
  }

  function calculateServiceMetrics(services = []) {
    const normalized = services.map(normalizeService).filter((service) => service.nombre_servicio && service.tarifa_unitaria !== null);
    const counts = SERVICE_UNIT_OPTIONS.map((unit) => [unit, normalized.filter((service) => service.unidad_medida === unit).length]);
    const currencyCounts = SERVICE_CURRENCY_OPTIONS.map((currency) => [currency, normalized.filter((service) => service.moneda === currency).length]);
    const winner = counts.reduce((best, item) => item[1] > best[1] ? item : best, ['', 0]);
    const averageCurrency = currencyCounts.reduce((best, item) => item[1] > best[1] ? item : best, ['USD', 0])[0];
    const servicesInAverageCurrency = normalized.filter((service) => service.moneda === averageCurrency);
    return {
      total: normalized.length,
      averageRate: servicesInAverageCurrency.length ? Math.round((servicesInAverageCurrency.reduce((sum, service) => sum + service.tarifa_unitaria, 0) / servicesInAverageCurrency.length + Number.EPSILON) * 100) / 100 : 0,
      averageCurrency,
      mostUsedUnit: winner[1] ? winner[0] : 'Sin registros'
    };
  }

  function createServiceRecord(service, metadata = {}) { return { ...normalizeService(service), id: metadata.id || normalizeService(service).id }; }
  function updateService(services = [], id, record) { return services.map((service) => String(service.id) === String(id) ? createServiceRecord(record, { id }) : service); }
  function removeService(services = [], id) { return services.filter((service) => String(service.id) !== String(id)); }
  function normalizeStoredCatalog(stored = []) { return Array.isArray(stored) ? { items: stored, deletedIds: [] } : { items: Array.isArray(stored?.items) ? stored.items : [], deletedIds: Array.isArray(stored?.deletedIds) ? stored.deletedIds.map(String) : [] }; }
  function mergeServices(base = [], stored = []) {
    const overlay = normalizeStoredCatalog(stored);
    const deleted = new Set(overlay.deletedIds);
    const merged = new Map(base.map((service) => [String(service.id), normalizeService(service)]).filter(([id]) => !deleted.has(id)));
    overlay.items.forEach((service) => { const normalized = normalizeService(service); if (normalized.id && !deleted.has(normalized.id)) merged.set(normalized.id, normalized); });
    return [...merged.values()];
  }

  const api = { SERVICE_UNIT_OPTIONS, SERVICE_CURRENCY_OPTIONS, normalizeText, normalizeService, validateService, filterServices, calculateServiceMetrics, createServiceRecord, updateService, removeService, normalizeStoredCatalog, mergeServices };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowServiceModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
