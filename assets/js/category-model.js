(function categoryModelFactory(globalScope) {
  'use strict';

  const CATEGORY_STATUS_OPTIONS = ['activo', 'inactivo'];

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
    const budget = parseBudget(category.presupuesto_mensual);
    return {
      id: String(category.id ?? '').trim(),
      nombre_categoria: String(category.nombre_categoria ?? '').trim(),
      descripcion: String(category.descripcion ?? '').trim(),
      es_deducible_por_defecto: category.es_deducible_por_defecto === true,
      presupuesto_mensual: Number.isNaN(budget) ? null : budget,
      estado: CATEGORY_STATUS_OPTIONS.includes(category.estado) ? category.estado : 'activo'
    };
  }

  function validateCategory(category = {}, existingCategories = []) {
    const candidate = normalizeCategory(category);
    const errors = {};

    if (!candidate.nombre_categoria) {
      errors.nombre_categoria = 'Escribe el nombre de la categoría.';
    }

    const duplicate = existingCategories.some((existing) => (
      normalizeText(existing.nombre_categoria) === normalizeText(candidate.nombre_categoria)
      && String(existing.id) !== String(candidate.id)
    ));
    if (candidate.nombre_categoria && duplicate) {
      errors.nombre_categoria = 'Ya existe una categoría con ese nombre.';
    }

    if (Number.isNaN(parseBudget(category.presupuesto_mensual))) {
      errors.presupuesto_mensual = 'Ingresa un presupuesto mensual mayor o igual a cero.';
    }

    if (!CATEGORY_STATUS_OPTIONS.includes(candidate.estado)) {
      errors.estado = 'Selecciona un estado válido.';
    }

    return { valid: Object.keys(errors).length === 0, errors };
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

  function normalizeStoredCatalog(storedCategories = []) {
    if (Array.isArray(storedCategories)) return { items: storedCategories, deletedIds: [] };
    return {
      items: Array.isArray(storedCategories.items) ? storedCategories.items : [],
      deletedIds: Array.isArray(storedCategories.deletedIds) ? storedCategories.deletedIds.map(String) : []
    };
  }

  function mergeCategories(baseCategories = [], storedCategories = []) {
    const stored = normalizeStoredCatalog(storedCategories);
    const deletedIds = new Set(stored.deletedIds);
    const merged = new Map(baseCategories
      .map((category) => [String(category.id), normalizeCategory(category)])
      .filter(([id]) => !deletedIds.has(id)));
    stored.items.forEach((category) => {
      const normalized = normalizeCategory(category);
      if (normalized.id && !deletedIds.has(normalized.id)) merged.set(normalized.id, normalized);
    });
    return [...merged.values()];
  }

  function createCategoryRecord(category, metadata = {}) {
    const normalized = normalizeCategory(category);
    return { ...normalized, id: metadata.id || normalized.id };
  }

  function getCategoryRemovalAction(category = {}) {
    return Number(category.usos || 0) > 0 ? 'inactivate' : 'delete';
  }

  const api = {
    CATEGORY_STATUS_OPTIONS,
    applyCategoryUsage,
    calculateCategoryMetrics,
    createCategoryRecord,
    filterCategories,
    getCategoryRemovalAction,
    mergeCategories,
    normalizeCategory,
    normalizeStoredCatalog,
    normalizeText,
    validateCategory
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowCategoryModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
