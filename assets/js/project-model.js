(function projectModelFactory(globalScope) {
  const PROJECT_STATES = ['ACTIVE', 'ON_HOLD', 'COMPLETED'];
  const BILLING_MODES = ['Tarifa fija', 'Por horas', 'Por hitos'];

  function normalizeText(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round((toNumber(value) + Number.EPSILON) * factor) / factor;
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function normalizeProject(project = {}) {
    const mode = BILLING_MODES.includes(project.modalidad_cobro)
      ? project.modalidad_cobro
      : 'Tarifa fija';
    const status = PROJECT_STATES.includes(project.estado) ? project.estado : 'ACTIVE';

    return {
      id: String(project.id ?? ''),
      nombre_proyecto: String(project.nombre_proyecto ?? '').trim(),
      cliente_id: String(project.cliente_id ?? project.cliente ?? '').trim(),
      propuesta_origen: String(project.propuesta_origen ?? '').trim(),
      descripcion: String(project.descripcion ?? '').trim(),
      fecha_inicio: String(project.fecha_inicio ?? '').trim(),
      fecha_fin_estimada: String(project.fecha_fin_estimada ?? '').trim(),
      estado: status,
      modalidad_cobro: mode,
      tarifa_hora: toNumber(project.tarifa_hora),
      monto_fijo: toNumber(project.monto_fijo),
      presupuesto_horas_estimado: toNumber(project.presupuesto_horas_estimado)
    };
  }

  function validateProject(project = {}, clients = []) {
    const candidate = normalizeProject(project);
    const errors = {};

    if (!candidate.nombre_proyecto) errors.nombre_proyecto = 'Ingresa el nombre del proyecto.';
    if (!candidate.cliente_id) errors.cliente_id = 'Selecciona un cliente.';
    if (!isValidDate(candidate.fecha_inicio)) errors.fecha_inicio = 'Ingresa una fecha de inicio válida.';
    if (!BILLING_MODES.includes(project.modalidad_cobro)) {
      errors.modalidad_cobro = 'Selecciona una modalidad de cobro.';
    }

    if (candidate.fecha_fin_estimada) {
      if (!isValidDate(candidate.fecha_fin_estimada) || candidate.fecha_fin_estimada <= candidate.fecha_inicio) {
        errors.fecha_fin_estimada = 'La fecha de fin estimada debe ser posterior a la fecha de inicio.';
      }
    }

    if (project.modalidad_cobro === 'Tarifa fija' && candidate.monto_fijo <= 0) {
      errors.monto_fijo = 'Ingresa un monto fijo mayor a cero.';
    }

    if (project.modalidad_cobro === 'Por horas' && candidate.tarifa_hora <= 0) {
      errors.tarifa_hora = 'Ingresa una tarifa por hora mayor a cero.';
    }

    if (project.presupuesto_horas_estimado !== ''
      && project.presupuesto_horas_estimado !== undefined
      && candidate.presupuesto_horas_estimado <= 0) {
      errors.presupuesto_horas_estimado = 'Las horas estimadas deben ser mayores a cero.';
    }

    if (candidate.cliente_id) {
      const client = clients.find((item) => String(item.id) === candidate.cliente_id);
      if (!client) errors.cliente_id = 'Selecciona un cliente válido.';
      else if (!candidate.id && client.estado === 'inactivo') {
        errors.cliente_id = 'Activa este cliente antes de registrar un proyecto nuevo.';
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  function filterProjects(projects = [], clients = [], filters = {}) {
    const clientsById = new Map(clients.map((client) => [String(client.id), client]));
    const queryTokens = normalizeText(filters.query).split(/\s+/).filter(Boolean);
    const status = filters.status || 'todos';
    const billingMode = filters.billingMode || 'todas';
    const clientId = filters.clientId || 'todos';

    return projects
      .map(normalizeProject)
      .filter((project) => status === 'todos' || project.estado === status)
      .filter((project) => billingMode === 'todas' || project.modalidad_cobro === billingMode)
      .filter((project) => clientId === 'todos' || project.cliente_id === clientId)
      .filter((project) => {
        if (!queryTokens.length) return true;
        const client = clientsById.get(project.cliente_id) ?? {};
        const haystack = normalizeText([
          project.nombre_proyecto,
          project.descripcion,
          client.nombre_razon_social,
          client.nombres,
          client.apellidos
        ].join(' '));
        return queryTokens.every((token) => haystack.includes(token));
      })
      .sort((first, second) => first.nombre_proyecto.localeCompare(
        second.nombre_proyecto,
        'es',
        { sensitivity: 'base' }
      ));
  }

  function calculateProjectMetrics(project, data = {}) {
    const normalized = normalizeProject(project);
    const invoices = (data.invoices ?? []).filter((invoice) => (
      String(invoice.proyecto_relacionado_id ?? invoice.proyecto_id ?? '') === normalized.id
      && invoice.estado !== 'VOID'
    ));
    const expensesList = (data.expenses ?? []).filter((expense) => (
      String(expense.proyecto_relacionado_id ?? expense.proyecto_id ?? '') === normalized.id
    ));
    const timeEntries = (data.timeEntries ?? []).filter((entry) => (
      String(entry.proyecto_id ?? entry.proyecto_relacionado_id ?? '') === normalized.id
    ));

    const invoiced = round(invoices.reduce((sum, invoice) => sum + toNumber(invoice.total_factura), 0));
    const paid = round(invoices.reduce((sum, invoice) => sum + toNumber(invoice.monto_pagado_acumulado), 0));
    const receivable = round(invoices.reduce((sum, invoice) => {
      const explicit = Number(invoice.saldo_pendiente);
      const balance = Number.isFinite(explicit)
        ? explicit
        : toNumber(invoice.total_factura) - toNumber(invoice.monto_pagado_acumulado);
      return sum + Math.max(0, balance);
    }, 0));
    const expenses = round(expensesList.reduce((sum, expense) => sum + toNumber(expense.monto), 0));
    const hours = round(timeEntries.reduce((sum, entry) => sum + toNumber(entry.horas_trabajadas), 0));
    const estimatedValue = round(normalized.modalidad_cobro === 'Tarifa fija'
      ? normalized.monto_fijo
      : normalized.modalidad_cobro === 'Por horas'
        ? hours * normalized.tarifa_hora
        : invoiced);
    const unbilledValue = round(Math.max(0, estimatedValue - invoiced));
    const invoiceValueDifference = round(Math.max(0, invoiced - estimatedValue));
    const invoicedAboveLoggedWork = normalized.modalidad_cobro === 'Por horas'
      && hours > 0
      && invoiceValueDifference > 0;
    const profit = round(invoiced - expenses);
    const margin = invoiced > 0 ? round((profit / invoiced) * 100) : null;
    const billingProgress = estimatedValue > 0
      ? Math.min(100, round((invoiced / estimatedValue) * 100))
      : null;
    const collectionProgress = invoiced > 0
      ? Math.min(100, round((paid / invoiced) * 100))
      : estimatedValue > 0 ? 0 : null;
    const hoursProgress = normalized.presupuesto_horas_estimado > 0
      ? Math.min(100, round((hours / normalized.presupuesto_horas_estimado) * 100))
      : null;
    const financialStatus = getFinancialStatus({
      project: normalized,
      invoiced,
      paid,
      receivable,
      estimatedValue,
      unbilledValue,
      invoiceValueDifference,
      invoicedAboveLoggedWork,
      invoiceCount: invoices.length
    });

    return {
      invoiced,
      paid,
      receivable,
      expenses,
      estimatedValue,
      unbilledValue,
      invoiceValueDifference,
      invoicedAboveLoggedWork,
      profit,
      margin,
      hours,
      billingProgress,
      collectionProgress,
      hoursProgress,
      financialStatus,
      invoiceCount: invoices.length,
      overdueCount: invoices.filter((invoice) => invoice.estado === 'OVERDUE').length,
      invoices,
      expensesList,
      timeEntries
    };
  }

  function getFinancialStatus(metrics) {
    if (metrics.project.estado === 'COMPLETED'
      && metrics.invoiceCount === 0
      && metrics.estimatedValue > 0) {
      return 'completed_without_invoice';
    }
    if (metrics.unbilledValue > 0 && metrics.invoiced === 0) return 'work_not_invoiced';
    if (metrics.unbilledValue > 0) return 'partially_invoiced';
    if (metrics.receivable > 0 && metrics.paid > 0) return 'partial_collection';
    if (metrics.receivable > 0) return 'pending_collection';
    if (metrics.invoiced > 0 && metrics.receivable === 0) return 'collected';
    return 'no_financial_activity';
  }

  function groupProjectsByClient(clients = [], projects = [], data = {}) {
    return [...clients]
      .sort((first, second) => String(first.nombre_razon_social).localeCompare(
        String(second.nombre_razon_social),
        'es',
        { sensitivity: 'base' }
      ))
      .map((client) => {
        const clientProjects = projects
          .map(normalizeProject)
          .filter((project) => project.cliente_id === String(client.id))
          .map((project) => ({
            ...project,
            metrics: calculateProjectMetrics(project, data)
          }));
        return {
          client,
          projects: clientProjects,
          outstanding: round(clientProjects.reduce((sum, project) => sum + project.metrics.receivable, 0))
        };
      });
  }

  function mergeProjects(baseProjects = [], storedProjects = []) {
    const merged = new Map(baseProjects.map((project) => {
      const normalized = normalizeProject(project);
      return [normalized.id, normalized];
    }));
    storedProjects.forEach((project) => {
      const normalized = normalizeProject(project);
      if (normalized.id) merged.set(normalized.id, normalized);
    });
    return [...merged.values()];
  }

  function createProjectRecord(project, metadata = {}) {
    return {
      ...normalizeProject({ ...project, estado: 'ACTIVE' }),
      id: String(metadata.id ?? '')
    };
  }

  const api = {
    BILLING_MODES,
    PROJECT_STATES,
    calculateProjectMetrics,
    createProjectRecord,
    filterProjects,
    groupProjectsByClient,
    isValidDate,
    mergeProjects,
    normalizeProject,
    normalizeText,
    validateProject
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowProjectModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
