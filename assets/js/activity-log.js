(function activityLogFactory(globalScope) {
  'use strict';

  const STORAGE_KEY = 'freelanceflow_activity_log_session';
  const DEFAULT_LIMIT = 80;
  const MAX_TEXT_LENGTH = 280;
  const pageModules = {
    'dashboard.html': 'Dashboard',
    'transacciones.html': 'Movimientos',
    'clientes.html': 'Clientes',
    'proyectos.html': 'Proyectos',
    'propuestas.html': 'Propuestas',
    'facturas.html': 'Facturas',
    'reportes.html': 'Reportes',
    'notificaciones.html': 'Notificaciones',
    'categorias.html': 'Categor\u00edas',
    'servicios.html': 'Servicios',
    'configuracion-fiscal.html': 'Configuraci\u00f3n fiscal',
    'ajustes.html': 'Ajustes',
    'cuenta.html': 'Cuenta',
    'bitacora.html': 'Bit\u00e1cora'
  };
  const context = () => globalScope.FreelanceFlowMembershipContext;
  const safeText = (value, limit = MAX_TEXT_LENGTH) => String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ff-(?:operational|administrative)-v1/g, '')
    .trim()
    .slice(0, limit);

  function safeStorage(storage) {
    if (storage) return storage;
    try {
      return globalScope.sessionStorage;
    } catch {
      return null;
    }
  }

  function createActivityLog(options = {}) {
    const storage = safeStorage(options.storage);
    const key = options.key || STORAGE_KEY;
    const limit = options.limit || DEFAULT_LIMIT;
    const now = options.now || (() => new Date().toISOString());
    const random = options.random || Math.random;
    const getContext = options.getContext
      || (() => context()?.readActiveMembership(storage) || { status: 'unavailable' });
    let memory = [];

    function read() {
      if (!storage) return [...memory];
      try {
        const parsed = JSON.parse(storage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [...memory];
      }
    }

    function write(items) {
      const next = items.slice(0, limit);
      memory = next;
      try {
        storage?.setItem(key, JSON.stringify(next));
      } catch {
        // Keep the in-memory fallback when session storage is unavailable.
      }
    }

    function record(entry = {}) {
      const membershipContext = getContext();
      const membership = membershipContext?.status === 'valid'
        ? membershipContext.membership
        : null;
      const action = safeText(entry.action, 160);
      const description = safeText(entry.description);

      if (!membership || membership.role !== 'operational' || !action || !description) {
        return null;
      }

      const module = safeText(entry.module || 'FreelanceFlow', 160);
      const existing = read();
      const previous = existing[0];
      const isDuplicate = entry.deduplicate !== false
        && previous
        && previous.membershipId === membership.id
        && previous.module === module
        && previous.action === action
        && previous.description === description;

      if (isDuplicate) return null;

      const item = {
        id: `act_${Date.now()}_${String(random()).slice(2)}`,
        timestamp: now(),
        actor: membership.actor,
        role: membership.role,
        membershipId: membership.id,
        module,
        action,
        description
      };
      write([item, ...existing]);
      return item;
    }

    return { read, record, clear: () => write([]) };
  }

  function shouldRecordPageVisit(file, membershipContext) {
    return membershipContext?.status === 'valid'
      && membershipContext.membership?.role === 'operational'
      && file !== 'bitacora.html';
  }

  const api = { createActivityLog, shouldRecordPageVisit, pageModules, STORAGE_KEY };
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
        if (item) {
          globalScope.dispatchEvent?.(new CustomEvent('freelanceflow:activity-updated', {
            detail: item
          }));
        }
        return item;
      },
      recordPageVisit() {
        const file = globalScope.location?.pathname?.split('/').pop() || 'dashboard.html';
        const module = pageModules[file];
        const membershipContext = context()?.readActiveMembership();
        if (!module || !shouldRecordPageVisit(file, membershipContext)) return null;
        return browserApi.record({
          module,
          action: 'Ingreso a pantalla',
          description: `Ingreso al m\u00f3dulo ${module}.`
        });
      },
      recordSearch(module, query) {
        const text = safeText(query);
        return text.length < 2
          ? null
          : browserApi.record({
            module,
            action: 'B\u00fasqueda realizada',
            description: `B\u00fasqueda en ${safeText(module, 120)}: ${text}.`
          });
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
