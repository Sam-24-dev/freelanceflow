(function activityLogFactory(globalScope) {
  'use strict';

  const STORAGE_KEY = 'freelanceflow_activity_log_session';
  const PROFILE_KEY = 'freelanceflow_access_profile';
  const ACTOR_KEY = 'freelanceflow_access_actor';
  const DEFAULT_LIMIT = 80;
  const pageModules = {
    'dashboard.html': 'Dashboard',
    'transacciones.html': 'Movimientos',
    'clientes.html': 'Clientes',
    'proyectos.html': 'Proyectos',
    'facturas.html': 'Facturas',
    'reportes.html': 'Reportes',
    'categorias.html': 'Categorías',
    'servicios.html': 'Servicios',
    'bitacora.html': 'Bitácora'
  };

  function safeStorage(storage) {
    if (storage) return storage;
    try { return globalScope.sessionStorage; } catch { return null; }
  }

  function createActivityLog(options = {}) {
    const storage = safeStorage(options.storage);
    const key = options.key || STORAGE_KEY;
    const limit = options.limit || DEFAULT_LIMIT;
    const now = options.now || (() => new Date().toISOString());
    const random = options.random || Math.random;
    const getActor = options.getActor || (() => storage?.getItem(ACTOR_KEY) || 'Equipo operativo');
    const getProfile = options.getProfile || (() => storage?.getItem(PROFILE_KEY) || '');
    let memory = [];

    function read() {
      if (!storage) return [...memory];
      try {
        const parsed = JSON.parse(storage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function write(items) {
      const next = items.slice(0, limit);
      memory = next;
      try { storage?.setItem(key, JSON.stringify(next)); } catch { /* keep memory fallback */ }
    }

    function record(entry = {}) {
      if (!entry.action || !entry.description) return null;
      const profile = getProfile();
      if (profile !== 'operational') return null;
      const actor = getActor();
      const existing = read();
      const previous = existing[0];
      if (previous
        && previous.profile === profile
        && previous.module === (entry.module || 'FreelanceFlow')
        && previous.action === entry.action
        && previous.description === entry.description) {
        return null;
      }
      const item = {
        id: `act_${Date.now()}_${String(random()).slice(2)}`,
        timestamp: now(),
        actor,
        profile,
        module: entry.module || 'FreelanceFlow',
        action: entry.action,
        description: entry.description
      };
      write([item, ...existing]);
      return item;
    }

    function clear() { write([]); }

    return { read, record, clear };
  }

  function shouldRecordPageVisit(file, profile = 'operational') {
    return profile === 'operational' && file !== 'bitacora.html';
  }

  const api = { createActivityLog, shouldRecordPageVisit, pageModules, STORAGE_KEY, PROFILE_KEY, ACTOR_KEY };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (globalScope.document) {
    const log = createActivityLog();
    const browserApi = {
      read: log.read,
      clear() {
        log.clear();
        globalScope.dispatchEvent?.(new CustomEvent('freelanceflow:activity-cleared'));
      },
      record(entry) {
        const item = log.record(entry);
        if (item) globalScope.dispatchEvent?.(new CustomEvent('freelanceflow:activity-updated', { detail: item }));
        return item;
      },
      recordPageVisit() {
        const file = globalScope.location?.pathname?.split('/').pop() || 'dashboard.html';
        const module = pageModules[file];
        const profile = globalScope.sessionStorage?.getItem(PROFILE_KEY) || '';
        if (!module || !shouldRecordPageVisit(file, profile)) return null;
        return browserApi.record({ module, action: 'Ingreso a pantalla', description: `Ingreso al módulo ${module}.` });
      },
      recordSearch(module, query) {
        const text = String(query || '').trim();
        if (text.length < 2) return null;
        return browserApi.record({ module, action: 'Búsqueda realizada', description: `Búsqueda en ${module}: ${text}.` });
      }
    };
    globalScope.FreelanceFlowActivity = browserApi;
    globalScope.document.addEventListener('DOMContentLoaded', () => {
      browserApi.recordPageVisit();
      const file = globalScope.location?.pathname?.split('/').pop() || 'dashboard.html';
      const module = pageModules[file];
      let timer = 0;
      globalScope.document.querySelectorAll('input[type="search"]').forEach((input) => {
        input.addEventListener('input', () => {
          globalScope.clearTimeout?.(timer);
          timer = globalScope.setTimeout?.(() => browserApi.recordSearch(module, input.value), 700);
        });
      });
    });
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
