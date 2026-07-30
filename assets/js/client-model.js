(function clientModelFactory(globalScope) {
  const CLIENT_STORAGE_KEY = 'freelanceflow_clients_v2';
  const LEGACY_CLIENT_STORAGE_KEY = 'freelanceflow_clients_mock';
  const CIVIL_STATUS_OPTIONS = ['soltero', 'casado', 'divorciado', 'separado', 'unión libre'];
  const CLIENT_STATUS_OPTIONS = ['activo', 'inactivo'];

  function normalizeText(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeIdentification(value) {
    return normalizeText(value).replace(/[^a-z0-9]/g, '');
  }

  function normalizeClient(client = {}) {
    const identification = String(client.identificacion ?? client.identificacion_fiscal ?? '').trim();
    const email = String(client.correo ?? client.correo_electronico ?? '').trim();

    return {
      id: String(client.id ?? '').trim(),
      nombre_razon_social: String(client.nombre_razon_social ?? '').trim(),
      tipo_cliente: String(client.tipo_cliente ?? 'Empresa').trim() || 'Empresa',
      nombres: String(client.nombres ?? '').trim(),
      apellidos: String(client.apellidos ?? '').trim(),
      identificacion: identification,
      identificacion_fiscal: String(client.identificacion_fiscal ?? identification).trim(),
      telefono: String(client.telefono ?? '').trim(),
      celular: String(client.celular ?? '').trim(),
      correo: email,
      correo_electronico: String(client.correo_electronico ?? email).trim(),
      direccion: String(client.direccion ?? '').trim(),
      estadoCivil: CIVIL_STATUS_OPTIONS.includes(client.estadoCivil) ? client.estadoCivil : 'soltero',
      estado: CLIENT_STATUS_OPTIONS.includes(client.estado) ? client.estado : 'activo',
      fecha_registro: String(client.fecha_registro ?? '').trim()
    };
  }

  function validateClient(client = {}, existingClients = []) {
    const candidate = normalizeClient(client);
    const errors = {};
    const required = {
      nombre_razon_social: 'Completa este campo.',
      tipo_cliente: 'Selecciona el tipo de cliente.',
      nombres: 'Completa este campo.',
      apellidos: 'Completa este campo.',
      identificacion: 'Completa este campo.',
      celular: 'Ingresa un número de celular válido.',
      correo: 'Ingresa un correo electrónico válido.'
    };

    Object.entries(required).forEach(([field, message]) => {
      if (!String(client[field] ?? '').trim()) errors[field] = message;
    });

    if (candidate.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.correo)) {
      errors.correo = 'Ingresa un correo electrónico válido.';
    }

    const mobileDigits = candidate.celular.replace(/\D/g, '');
    if (candidate.celular && (mobileDigits.length < 7 || mobileDigits.length > 15)) {
      errors.celular = 'Ingresa un número de celular válido.';
    }

    if (!CIVIL_STATUS_OPTIONS.includes(client.estadoCivil)) {
      errors.estadoCivil = 'Selecciona el estado civil del contacto principal.';
    }

    if (!CLIENT_STATUS_OPTIONS.includes(client.estado)) {
      errors.estado = 'Selecciona si el cliente está activo o inactivo.';
    }

    const duplicate = existingClients.some((existing) => (
      normalizeIdentification(existing.identificacion ?? existing.identificacion_fiscal) === normalizeIdentification(candidate.identificacion)
      && String(existing.id) !== String(candidate.id)
    ));
    if (candidate.identificacion && duplicate) {
      errors.identificacion = 'Ya existe un cliente con esta identificación.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  function filterClients(clients = [], filters = {}) {
    const queryTokens = normalizeText(filters.query).split(/\s+/).filter(Boolean);
    const status = filters.status || 'todos';

    return clients
      .map(normalizeClient)
      .filter((client) => status === 'todos' || client.estado === status)
      .filter((client) => {
        if (!queryTokens.length) return true;
        const haystack = normalizeText([
          client.nombre_razon_social,
          client.nombres,
          client.apellidos,
          client.identificacion
        ].join(' '));
        return queryTokens.every((token) => haystack.includes(token));
      })
      .sort((first, second) => first.nombre_razon_social.localeCompare(
        second.nombre_razon_social,
        'es',
        { sensitivity: 'base' }
      ));
  }

  function mergeClients(baseClients = [], storedClients = []) {
    const baseline = Array.isArray(baseClients)
      ? baseClients
        .filter((client) => client && typeof client === 'object' && !Array.isArray(client))
        .map(normalizeClient)
        .filter((client) => client.id)
      : [];
    const merged = new Map(baseline.map((client) => [client.id, client]));
    if (Array.isArray(storedClients)) {
      storedClients
        .filter((client) => client && typeof client === 'object' && !Array.isArray(client))
        .map(normalizeClient)
        .filter((client) => client.id)
        .forEach((client) => merged.set(client.id, client));
    }
    return [...merged.values()];
  }

  function sanitizeStoredClients(storedClients = [], baseClients = []) {
    if (!Array.isArray(storedClients)) return [];

    const candidates = storedClients
      .filter((client) => client && typeof client === 'object' && !Array.isArray(client))
      .filter((client) => CLIENT_STATUS_OPTIONS.includes(client.estado) && CIVIL_STATUS_OPTIONS.includes(client.estadoCivil))
      .map(normalizeClient)
      .filter((client) => client.id && validateClient(client, []).valid);
    const idCounts = new Map();
    const identificationIds = new Map();

    candidates.forEach((client) => {
      idCounts.set(client.id, (idCounts.get(client.id) || 0) + 1);
      const identification = normalizeIdentification(client.identificacion);
      if (!identificationIds.has(identification)) identificationIds.set(identification, new Set());
      identificationIds.get(identification).add(client.id);
    });

    const baseline = Array.isArray(baseClients) ? baseClients.map(normalizeClient) : [];
    return candidates.reduce((accepted, client) => {
      const identification = normalizeIdentification(client.identificacion);
      if (idCounts.get(client.id) > 1 || identificationIds.get(identification).size > 1) return accepted;
      if (!validateClient(client, [...baseline, ...accepted]).valid) return accepted;
      accepted.push(client);
      return accepted;
    }, []);
  }

  function getEffectiveClients(baseClients = [], storage) {
    try {
      const targetStorage = storage ?? globalScope.localStorage;
      const serialized = targetStorage?.getItem(CLIENT_STORAGE_KEY) ?? targetStorage?.getItem(LEGACY_CLIENT_STORAGE_KEY);
      if (!serialized) return mergeClients(baseClients, []);
      const parsed = JSON.parse(serialized);
      return mergeClients(baseClients, sanitizeStoredClients(parsed, baseClients));
    } catch {
      return mergeClients(baseClients, []);
    }
  }

  function persistClients(clients, storage) {
    try {
      (storage ?? globalScope.localStorage).setItem(CLIENT_STORAGE_KEY, JSON.stringify(clients));
      return true;
    } catch {
      return false;
    }
  }

  function getSelectableClients(clients = [], selectedId = '') {
    return clients.filter((client) => client.estado !== 'inactivo' || String(client.id) === String(selectedId));
  }

  function createClientRecord(client, metadata = {}) {
    const normalized = normalizeClient(client);
    return {
      ...normalized,
      id: metadata.id,
      identificacion_fiscal: normalized.identificacion,
      correo_electronico: normalized.correo,
      fecha_registro: metadata.date
    };
  }

  const api = {
    CLIENT_STORAGE_KEY,
    LEGACY_CLIENT_STORAGE_KEY,
    CIVIL_STATUS_OPTIONS,
    CLIENT_STATUS_OPTIONS,
    createClientRecord,
    filterClients,
    getEffectiveClients,
    getSelectableClients,
    mergeClients,
    normalizeClient,
    normalizeIdentification,
    normalizeText,
    persistClients,
    sanitizeStoredClients,
    validateClient
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowClientModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
