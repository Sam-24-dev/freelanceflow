(function clientModelFactory(globalScope) {
  const CIVIL_STATUS_OPTIONS = ['soltero', 'casado', 'divorciado', 'separado', 'unión libre'];
  const CLIENT_STATUS_OPTIONS = ['activo', 'inactivo'];

  function normalizeText(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeClient(client = {}) {
    const identification = String(client.identificacion ?? client.identificacion_fiscal ?? '').trim();
    const email = String(client.correo ?? client.correo_electronico ?? '').trim();

    return {
      id: String(client.id ?? ''),
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
      normalizeText(existing.identificacion ?? existing.identificacion_fiscal) === normalizeText(candidate.identificacion)
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
    const merged = new Map(baseClients.map((client) => [String(client.id), normalizeClient(client)]));
    storedClients.forEach((client) => {
      const normalized = normalizeClient(client);
      merged.set(normalized.id, normalized);
    });
    return [...merged.values()];
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
    CIVIL_STATUS_OPTIONS,
    CLIENT_STATUS_OPTIONS,
    createClientRecord,
    filterClients,
    mergeClients,
    normalizeClient,
    normalizeText,
    validateClient
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowClientModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
