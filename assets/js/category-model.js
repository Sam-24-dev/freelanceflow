(function categoryModelFactory(globalScope) {
  'use strict';

  const CATEGORY_STORAGE_KEY = 'freelanceflow_expense_categories_v1';
  const CATALOG_VERSION = 2;
  const CATEGORY_STATUS_OPTIONS = ['activo', 'inactivo'];
  const CATEGORY_FIELDS = new Set([
    'id',
    'nombre_categoria',
    'descripcion',
    'es_deducible_por_defecto',
    'presupuesto_mensual',
    'estado'
  ]);
  const CATEGORY_ID_PATTERN = /^cat_[A-Za-z0-9_-]+$/;

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function normalizeText(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function parseBudget(value) {
    if (value === '' || value === null || typeof value === 'undefined') return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? Math.round((amount + Number.EPSILON) * 100) / 100 : NaN;
  }

  function normalizeCategory(category = {}) {
    const source = isPlainObject(category) ? category : {};
    const budget = parseBudget(source.presupuesto_mensual);
    return {
      id: String(source.id ?? '').trim(),
      nombre_categoria: String(source.nombre_categoria ?? '').trim(),
      descripcion: String(source.descripcion ?? '').trim(),
      es_deducible_por_defecto: source.es_deducible_por_defecto === true,
      presupuesto_mensual: Number.isNaN(budget) ? null : budget,
      estado: CATEGORY_STATUS_OPTIONS.includes(source.estado) ? source.estado : 'activo'
    };
  }

  function validateCategory(category = {}, existingCategories = []) {
    const errors = {};
    if (!isPlainObject(category)) return { valid: false, errors: { category: 'La categoría debe ser un objeto válido.' } };
    const candidate = normalizeCategory(category);
    const unknownFields = Object.keys(category).filter((field) => !CATEGORY_FIELDS.has(field));

    if (unknownFields.length) errors.category = 'La categoría contiene propiedades no permitidas.';
    if (typeof category.id !== 'string' || !CATEGORY_ID_PATTERN.test(candidate.id)) {
      errors.id = 'La categoría debe tener un identificador válido.';
    } else if (existingCategories.some((existing) => String(existing?.id ?? '').trim() === candidate.id)) {
      errors.id = 'Ya existe una categoría con ese identificador.';
    }

    if (typeof category.nombre_categoria !== 'string' || !candidate.nombre_categoria) {
      errors.nombre_categoria = 'Escribe el nombre de la categoría.';
    }

    const duplicate = existingCategories.some((existing) => (
      normalizeText(existing.nombre_categoria) === normalizeText(candidate.nombre_categoria)
      && String(existing.id) !== String(candidate.id)
    ));
    if (candidate.nombre_categoria && duplicate) {
      errors.nombre_categoria = 'Ya existe una categoría con ese nombre.';
    }

    if (category.presupuesto_mensual !== null
      && (typeof category.presupuesto_mensual !== 'number'
        || !Number.isFinite(category.presupuesto_mensual)
        || category.presupuesto_mensual < 0)) {
      errors.presupuesto_mensual = 'Ingresa un presupuesto mensual mayor o igual a cero.';
    }

    if (!Object.hasOwn(category, 'presupuesto_mensual')) {
      errors.presupuesto_mensual = 'Ingresa un presupuesto mensual mayor o igual a cero.';
    }
    if (typeof category.es_deducible_por_defecto !== 'boolean') {
      errors.es_deducible_por_defecto = 'Selecciona si la categoría es deducible.';
    }
    if (!Object.hasOwn(category, 'estado') || !CATEGORY_STATUS_OPTIONS.includes(category.estado)) {
      errors.estado = 'Selecciona un estado válido.';
    }
    if (Object.hasOwn(category, 'descripcion') && typeof category.descripcion !== 'string') {
      errors.descripcion = 'Ingresa una descripción válida.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  function validateCatalog(categories) {
    if (!Array.isArray(categories)) return { valid: false, errors: [{ category: 'El catálogo debe ser una lista.' }] };
    const accepted = [];
    const errors = [];
    categories.forEach((category, index) => {
      const result = validateCategory(category, accepted);
      if (!result.valid) errors[index] = result.errors;
      else accepted.push(normalizeCategory(category));
    });
    return { valid: errors.length === 0, errors, items: accepted };
  }

  function filterCategories(categories = [], filters = {}) {
    const queryTokens = normalizeText(filters.query).split(/\s+/).filter(Boolean);
    const deductible = filters.deductible || 'todas';
    const status = filters.status || 'todos';

    return categories
      .map(normalizeCategoryWithUsage)
      .filter((category) => status === 'todos' || category.estado === status)
      .filter((category) => deductible === 'todas'
        || (deductible === 'deducible' && category.es_deducible_por_defecto)
        || (deductible === 'no-deducible' && !category.es_deducible_por_defecto))
      .filter((category) => {
        if (!queryTokens.length) return true;
        const haystack = normalizeText([category.nombre_categoria, category.descripcion].join(' '));
        return queryTokens.every((token) => haystack.includes(token));
      })
      .sort((first, second) => first.nombre_categoria.localeCompare(second.nombre_categoria, 'es', { sensitivity: 'base' }));
  }

  function normalizeCategoryWithUsage(category = {}) {
    return {
      ...normalizeCategory(category),
      usos: Number(category.usos || 0),
      gasto_mensual: roundMoney(category.gasto_mensual || 0)
    };
  }

  function roundMoney(value) {
    return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
  }

  function expenseCategoryId(expense = {}) {
    return String(expense.categoria_gasto_id ?? expense.categoria_id ?? expense.categoria ?? '').trim();
  }

  function expenseDate(expense = {}) {
    return String(expense.fecha_gasto ?? expense.fecha ?? '').slice(0, 7);
  }

  function applyCategoryUsage(categories = [], expenses = [], month = '') {
    return categories.map((category) => {
      const normalized = normalizeCategory(category);
      const matching = expenses.filter((expense) => expenseCategoryId(expense) === normalized.id);
      const monthly = month ? matching.filter((expense) => expenseDate(expense) === month) : matching;
      return {
        ...normalized,
        usos: matching.length,
        gasto_mensual: roundMoney(monthly.reduce((sum, expense) => sum + Number(expense.monto || 0), 0))
      };
    });
  }

  function calculateCategoryMetrics(categories = []) {
    const normalized = categories.map(normalizeCategoryWithUsage);
    const mostUsed = normalized.reduce((winner, category) => (
      category.usos > (winner?.usos ?? -1) ? category : winner
    ), null);
    const attention = normalized.filter((category) => (
      category.presupuesto_mensual !== null
      && category.presupuesto_mensual > 0
      && category.gasto_mensual >= category.presupuesto_mensual * 0.8
    ));

    return {
      total: normalized.length,
      deducible: normalized.filter((category) => category.es_deducible_por_defecto).length,
      mostUsed: mostUsed && mostUsed.usos > 0 ? mostUsed.nombre_categoria : 'Sin uso registrado',
      budgetAttention: {
        count: attention.length,
        label: attention.length === 1 ? '1 categoría requiere atención' : `${attention.length} categorías requieren atención`
      }
    };
  }

  function validateStoredCatalog(storedCategories, baseCategories = []) {
    if (!isPlainObject(storedCategories)
      || storedCategories.version !== CATALOG_VERSION
      || !Array.isArray(storedCategories.items)
      || !Array.isArray(storedCategories.deletedIds)
      || Object.keys(storedCategories).some((field) => !['version', 'items', 'deletedIds'].includes(field))) {
      return { valid: false };
    }

    const baseline = validateCatalog(baseCategories);
    const overlay = validateCatalog(storedCategories.items);
    if (!baseline.valid || !overlay.valid) return { valid: false };

    const baseIds = new Set(baseline.items.map(({ id }) => id));
    const overlayIds = new Set(overlay.items.map(({ id }) => id));
    const deletedIds = storedCategories.deletedIds;
    if (deletedIds.some((id) => typeof id !== 'string' || !CATEGORY_ID_PATTERN.test(id) || !baseIds.has(id) || overlayIds.has(id))
      || new Set(deletedIds).size !== deletedIds.length) {
      return { valid: false };
    }

    const deleted = new Set(deletedIds);
    const merged = new Map(baseline.items.filter(({ id }) => !deleted.has(id)).map((category) => [category.id, category]));
    overlay.items.forEach((category) => merged.set(category.id, category));
    const effective = validateCatalog([...merged.values()]);
    if (!effective.valid) return { valid: false };

    return {
      valid: true,
      payload: { version: CATALOG_VERSION, items: overlay.items, deletedIds: [...deletedIds] },
      categories: effective.items
    };
  }

  function normalizeStoredCatalog(storedCategories = {}, baseCategories = []) {
    const result = validateStoredCatalog(storedCategories, baseCategories);
    return result.valid ? result.payload : { version: CATALOG_VERSION, items: [], deletedIds: [] };
  }

  function mergeCategories(baseCategories = [], storedCategories = []) {
    const baseline = validateCatalog(baseCategories);
    if (!baseline.valid) return [];
    const stored = validateStoredCatalog(storedCategories, baseline.items);
    return stored.valid ? stored.categories : baseline.items;
  }

  function readEffectiveCatalog(baseCategories = [], storage, key = CATEGORY_STORAGE_KEY) {
    const baseline = validateCatalog(baseCategories);
    if (!baseline.valid) return { ok: false, categories: [], deletedIds: [], error: new Error('Invalid baseline catalog') };
    try {
      const target = storage ?? globalScope.localStorage;
      if (!target?.getItem) throw new Error('Category storage is unavailable');
      const raw = target.getItem(key);
      if (!raw) return { ok: true, categories: baseline.items, deletedIds: [] };
      const stored = validateStoredCatalog(JSON.parse(raw), baseline.items);
      return stored.valid
        ? { ok: true, categories: stored.categories, deletedIds: stored.payload.deletedIds }
        : { ok: false, categories: baseline.items, deletedIds: [], error: new Error('Invalid stored catalog') };
    } catch (error) {
      return { ok: false, categories: baseline.items, deletedIds: [], error };
    }
  }

  function saveEffectiveCatalog(baseCategories = [], categories = [], deletedIds = [], storage, key = CATEGORY_STORAGE_KEY) {
    try {
      const target = storage ?? globalScope.localStorage;
      target?.getItem(key);
      if (!target?.setItem) throw new Error('Category storage is unavailable');
      const stored = validateStoredCatalog({ version: CATALOG_VERSION, items: categories, deletedIds }, baseCategories);
      if (!stored.valid) throw new Error('Invalid category catalog candidate');
      target.setItem(key, JSON.stringify(stored.payload));
      return { ok: true, payload: stored.payload };
    } catch (error) {
      return { ok: false, error };
    }
  }

  function getSelectableCategories(categories = [], selectedValue = '') {
    return categories
      .map(normalizeCategory)
      .filter((category) => category.estado === 'activo' || category.id === selectedValue);
  }

  function createCategoryRecord(category, metadata = {}) {
    const normalized = normalizeCategory(category);
    return { ...normalized, id: metadata.id || normalized.id };
  }

  function getCategoryRemovalAction(category = {}) {
    return Number(category.usos || 0) > 0 ? 'inactivate' : 'delete';
  }

  const api = {
    CATALOG_VERSION,
    CATEGORY_STORAGE_KEY,
    CATEGORY_STATUS_OPTIONS,
    applyCategoryUsage,
    calculateCategoryMetrics,
    createCategoryRecord,
    filterCategories,
    getSelectableCategories,
    getCategoryRemovalAction,
    mergeCategories,
    normalizeCategory,
    normalizeStoredCatalog,
    normalizeText,
    readEffectiveCatalog,
    saveEffectiveCatalog,
    validateCatalog,
    validateCategory
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowCategoryModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
