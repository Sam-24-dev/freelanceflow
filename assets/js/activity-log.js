(function activityLogFactory(globalScope) {
  'use strict';

  const STORAGE_KEY = 'freelanceflow_activity_log_session';
  const DEFAULT_LIMIT = 80;
  const SCHEMA_VERSION = 1;
  const pageModules = Object.freeze({
    'dashboard.html': 'Dashboard',
    'transacciones.html': 'Movimientos',
    'clientes.html': 'Clientes',
    'proyectos.html': 'Proyectos',
    'propuestas.html': 'Propuestas',
    'facturas.html': 'Facturas',
    'reportes.html': 'Reportes',
    'notificaciones.html': 'Notificaciones',
    'categorias.html': 'Categorías',
    'servicios.html': 'Servicios',
    'configuracion-fiscal.html': 'Configuración fiscal',
    'ajustes.html': 'Ajustes',
    'cuenta.html': 'Cuenta',
    'bitacora.html': 'Bitácora'
  });
  const context = () => globalScope.FreelanceFlowMembershipContext;
  const producerKey = (module, action) => `${module}\u0000${action}`;
  const typeSegment = (value) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const catalogEntry = (type, module, action, description) => Object.freeze({ type, module, action, description });
  const EVENT_CATALOG = Object.freeze([
    ...Object.entries(pageModules)
      .filter(([file]) => file !== 'bitacora.html')
      .map(([, module]) => catalogEntry(`page.${typeSegment(module)}.visit`, module, 'Ingreso a pantalla', `Se ingresó al módulo ${module}.`)),
    catalogEntry('movements.recorded', 'Movimientos', 'Movimiento registrado', 'Se registró un movimiento.'),
    catalogEntry('movements.updated', 'Movimientos', 'Movimiento actualizado', 'Se actualizó un movimiento.'),
    catalogEntry('clients.registered', 'Clientes', 'Cliente registrado', 'Se registró un cliente.'),
    catalogEntry('clients.updated', 'Clientes', 'Cliente actualizado', 'Se actualizó un cliente.'),
    catalogEntry('projects.created', 'Proyectos', 'Proyecto creado', 'Se creó un proyecto.'),
    catalogEntry('projects.updated', 'Proyectos', 'Proyecto actualizado', 'Se actualizó un proyecto.'),
    catalogEntry('proposals.created', 'Propuestas', 'Propuesta creada', 'Se creó una propuesta.'),
    catalogEntry('proposals.updated', 'Propuestas', 'Propuesta actualizada', 'Se actualizó una propuesta.'),
    catalogEntry('proposals.sent', 'Propuestas', 'Propuesta marcada como enviada', 'Se marcó una propuesta como enviada.'),
    catalogEntry('proposals.accepted', 'Propuestas', 'Propuesta marcada como aceptada', 'Se marcó una propuesta como aceptada.'),
    catalogEntry('proposals.rejected', 'Propuestas', 'Propuesta marcada como rechazada', 'Se marcó una propuesta como rechazada.'),
    catalogEntry('proposals.converted', 'Propuestas', 'Propuesta convertida', 'Se convirtió una propuesta en proyecto.'),
    catalogEntry('invoices.saved', 'Facturas', 'Factura guardada', 'Se guardó una factura.'),
    catalogEntry('invoices.sent', 'Facturas', 'Factura enviada', 'Se envió una factura.'),
    catalogEntry('invoices.payment-recorded', 'Facturas', 'Pago registrado', 'Se registró un pago de factura.'),
    catalogEntry('invoices.voided', 'Facturas', 'Factura anulada', 'Se anuló una factura.'),
    catalogEntry('reports.filters-applied', 'Reportes', 'Filtros aplicados', 'Se actualizaron los filtros del reporte.'),
    catalogEntry('reports.exported', 'Reportes', 'Reporte exportado', 'Se exportó un reporte.'),
    catalogEntry('reports.budget-saved', 'Reportes', 'Presupuesto guardado', 'Se guardó un presupuesto.'),
    catalogEntry('categories.created', 'Categorías', 'Categoría creada', 'Se creó una categoría.'),
    catalogEntry('categories.updated', 'Categorías', 'Categoría actualizada', 'Se actualizó una categoría.'),
    catalogEntry('categories.deactivated', 'Categorías', 'Categoría inactivada', 'Se inactivó una categoría.'),
    catalogEntry('categories.deleted', 'Categorías', 'Categoría eliminada', 'Se eliminó una categoría.'),
    catalogEntry('services.created', 'Servicios', 'Servicio creado', 'Se creó un servicio.'),
    catalogEntry('services.updated', 'Servicios', 'Servicio actualizado', 'Se actualizó un servicio.'),
    catalogEntry('services.deleted', 'Servicios', 'Servicio eliminado', 'Se eliminó un servicio.'),
    ...Object.values(pageModules)
      .filter((module) => module !== 'Bitácora')
      .map((module) => catalogEntry(`search.${typeSegment(module)}`, module, 'Búsqueda realizada', `Se realizó una búsqueda en ${module}.`)),
    catalogEntry('fiscal-config.saved', 'Configuración fiscal', 'Configuración fiscal guardada', 'Se guardó la configuración fiscal.'),
    catalogEntry('settings.saved', 'Ajustes', 'Ajustes guardados', 'Se guardaron los ajustes.'),
    catalogEntry('settings.restored', 'Ajustes', 'Ajustes restaurados', 'Se restauraron los ajustes predeterminados.'),
    catalogEntry('account.updated', 'Cuenta', 'Perfil actualizado', 'Se actualizó el perfil.'),
    catalogEntry('notifications.preferences-updated', 'Notificaciones', 'Preferencias actualizadas', 'Se actualizaron las preferencias de notificaciones.')
  ]);
  const EVENT_BY_TYPE = Object.freeze(Object.fromEntries(EVENT_CATALOG.map((entry) => [entry.type, entry])));
  const EVENT_BY_PRODUCER = Object.freeze(Object.fromEntries(EVENT_CATALOG.map((entry) => [producerKey(entry.module, entry.action), entry])));

  function safeStorage(storage) {
    if (storage) return storage;
    try {
      return globalScope.sessionStorage;
    } catch {
      return null;
    }
  }

  function isValidTimestamp(value) {
    if (typeof value !== 'string') return false;
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString() === value;
  }

  function trustedOperationalMembership(id) {
    const membership = context()?.MEMBERSHIPS?.find((item) => item.id === id) || null;
    return membership?.role === 'operational' ? membership : null;
  }

  function normalizeStoredEntry(entry) {
    if (!entry || entry.version !== SCHEMA_VERSION || !EVENT_BY_TYPE[entry.type] || !isValidTimestamp(entry.timestamp)) return null;
    if (!trustedOperationalMembership(entry.membershipId)) return null;
    return { version: SCHEMA_VERSION, type: entry.type, timestamp: entry.timestamp, membershipId: entry.membershipId };
  }

  function deriveEntry(entry) {
    const event = EVENT_BY_TYPE[entry.type];
    const membership = trustedOperationalMembership(entry.membershipId);
    return event && membership ? {
      timestamp: entry.timestamp,
      actor: membership.actor,
      role: membership.role,
      membershipId: membership.id,
      module: event.module,
      action: event.action,
      description: event.description
    } : null;
  }

  function createActivityLog(options = {}) {
    const storage = safeStorage(options.storage);
    const key = options.key || STORAGE_KEY;
    const limit = options.limit || DEFAULT_LIMIT;
    const now = options.now || (() => new Date().toISOString());
    const getContext = options.getContext || (() => context()?.readActiveMembership(storage) || { status: 'unavailable' });
    let memory = [];
    let storageFailed = false;

    function readStored() {
      if (!storage || storageFailed) return memory;
      try {
        const parsed = JSON.parse(storage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : memory;
      } catch {
        return memory;
      }
    }

    function validStored() {
      return readStored()
        .map(normalizeStoredEntry)
        .filter(Boolean)
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
        .slice(0, limit);
    }

    function read() {
      return validStored().map(deriveEntry).filter(Boolean);
    }

    function write(items) {
      const next = items.slice(0, limit);
      memory = next;
      try {
        storage?.setItem(key, JSON.stringify(next));
      } catch {
        // Keep the in-memory fallback when session storage is unavailable.
        storageFailed = true;
      }
    }

    function record(entry = {}) {
      try {
        const membershipContext = getContext();
        const membership = membershipContext?.status === 'valid'
          ? trustedOperationalMembership(membershipContext.membership?.id)
          : null;
        const event = EVENT_BY_PRODUCER[producerKey(entry.module, entry.action)];
        const timestamp = now();
        if (!membership || !event || !isValidTimestamp(timestamp)) return null;

        const existing = validStored();
        const previous = existing[0];
        if (entry.deduplicate !== false && previous?.membershipId === membership.id && previous.type === event.type) return null;

        const item = { version: SCHEMA_VERSION, type: event.type, timestamp, membershipId: membership.id };
        write([item, ...existing]);
        return deriveEntry(item);
      } catch {
        return null;
      }
    }

    return { read, record, clear: () => write([]) };
  }

  function shouldRecordPageVisit(file, membershipContext) {
    return membershipContext?.status === 'valid'
      && membershipContext.membership?.role === 'operational'
      && file !== 'bitacora.html';
  }

  const api = { createActivityLog, shouldRecordPageVisit, pageModules, STORAGE_KEY, SCHEMA_VERSION, EVENT_CATALOG };
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
        const membershipContext = context()?.readActiveMembership();
        if (!module || !shouldRecordPageVisit(file, membershipContext)) return null;
        return browserApi.record({ module, action: 'Ingreso a pantalla' });
      },
      recordSearch(module, query) {
        return String(query ?? '').trim().length < 2
          ? null
          : browserApi.record({ module, action: 'Búsqueda realizada' });
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
