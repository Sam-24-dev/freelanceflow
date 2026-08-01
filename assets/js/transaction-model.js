(function transactionModelFactory(globalScope) {
  const TRANSACTION_TYPES = ['ingreso', 'gasto'];

  function normalizeText(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return false;
    const parsed = new Date(`${value}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function validateTransaction(transaction = {}, context = {}) {
    if (!TRANSACTION_TYPES.includes(transaction.tipo)) return { valid: false, field: 'tipo', message: 'Selecciona un tipo de movimiento.' };
    if (!Number.isFinite(Number(transaction.monto)) || Number(transaction.monto) <= 0) return { valid: false, field: 'monto', message: 'Ingresa un monto mayor a cero.' };
    if (!isValidDate(transaction.fecha)) return { valid: false, field: 'fecha', message: 'Ingresa una fecha válida.' };
    if (!transaction.categoria) return { valid: false, field: 'categoria', message: 'Selecciona una categoría.' };
    if (!transaction.cuenta_id) return { valid: false, field: 'cuenta_id', message: 'Selecciona una cuenta.' };
    if (transaction.tipo === 'gasto') {
      const category = Array.isArray(context.categories)
        ? context.categories.find((item) => String(item?.id) === String(transaction.categoria))
        : null;
      const selectedInactive = String(context.selectedCategoryId || '') === String(transaction.categoria);
      if (!category || (category.estado !== 'activo' && !selectedInactive)) {
        return { valid: false, field: 'categoria', message: 'Selecciona una categoría de gasto válida.' };
      }
    }
    if (transaction.moneda && transaction.moneda !== 'USD') return { valid: false, field: 'moneda', message: 'Solo se admite USD.' };
    if (transaction.origen_oficial === 'pago_factura' && !transaction.origen_id) return { valid: false, field: 'origen_id', message: 'El pago debe tener un origen verificable.' };
    if (transaction.proyecto_id) {
      const project = (context.projects || []).find((item) => item.id === transaction.proyecto_id);
      if (!project || (transaction.cliente_id && project.cliente_id !== transaction.cliente_id)) return { valid: false, field: 'proyecto_id', message: 'El proyecto debe pertenecer al cliente seleccionado.' };
    }
    return { valid: true };
  }

  function validateStoredTransaction(transaction, context) {
    if (!transaction || typeof transaction !== 'object' || !String(transaction.id || '').trim()) return { valid: false, field: 'id' };
    const expenseCategoryId = transaction.categoria_gasto_id || transaction.categoria_mock_auxiliar;
    return validateTransaction({
      ...transaction,
      categoria: transaction.tipo === 'ingreso' ? 'income_invoice' : expenseCategoryId,
      moneda: transaction.moneda
    }, { ...context, selectedCategoryId: transaction.tipo === 'gasto' ? expenseCategoryId : '' });
  }

  function sanitizeTransactions(items = [], context = {}) {
    if (!Array.isArray(items)) return { items: [], rejected: [{ field: 'storage' }] };
    const ids = new Set();
    const duplicates = new Set();
    items.forEach((item) => { const id = String(item?.id || ''); if (ids.has(id)) duplicates.add(id); ids.add(id); });
    const rejected = [];
    const valid = items.filter((item) => {
      if (duplicates.has(String(item?.id || ''))) { rejected.push({ item, field: 'id' }); return false; }
      const result = validateStoredTransaction(item, context);
      if (!result.valid) rejected.push({ item, field: result.field });
      return result.valid;
    }).map((item) => {
      const project = (context.projects || []).find((candidate) => candidate.id === item.proyecto_id);
      return project && !item.cliente_id ? { ...item, cliente_id: project.cliente_id } : item;
    });
    return { items: valid, rejected };
  }

  function toExpenseRecords(items = [], context = {}) {
    return sanitizeTransactions(items, context).items
      .filter((item) => item.tipo === 'gasto')
      .map((item) => {
        const category = context.categories.find((candidate) => String(candidate.id) === String(item.categoria_gasto_id));
        return {
          id: item.id,
          categoria_gasto_id: item.categoria_gasto_id,
          monto: Number(item.monto),
          fecha_gasto: item.fecha,
          cliente_id: item.cliente_id || (context.projects || []).find((project) => project.id === item.proyecto_id)?.cliente_id || '',
          proyecto_relacionado_id: item.proyecto_id || '',
          es_deducible: category.es_deducible_por_defecto === true
        };
      });
  }

  function calculateSummary(items = []) {
    const summary = items.reduce((result, item) => {
      const amount = Number(item.monto || 0);
      if (item.tipo === 'ingreso') result.income += amount;
      if (item.tipo === 'gasto') result.expense += amount;
      result.count += 1;
      return result;
    }, { income: 0, expense: 0, count: 0 });

    const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
    summary.income = roundMoney(summary.income);
    summary.expense = roundMoney(summary.expense);
    summary.net = roundMoney(summary.income - summary.expense);
    return summary;
  }

  function filterTransactions(items = [], filters = {}) {
    const type = filters.type || 'todos';
    const month = filters.month || '';
    const category = filters.category || '';
    const queryTokens = normalizeText(filters.query).split(/\s+/).filter(Boolean);

    return [...items]
      .filter((item) => type === 'todos' || item.tipo === type)
      .filter((item) => !month || String(item.fecha || '').startsWith(month))
      .filter((item) => !category || item.categoria === category || item.categoria_id === category)
      .filter((item) => {
        if (!queryTokens.length) return true;
        const haystack = normalizeText([
          item.descripcion,
          item.categoria,
          item.cliente,
          item.proyecto,
          item.tipo
        ].join(' '));
        return queryTokens.every((token) => haystack.includes(token));
      })
      .sort((first, second) => String(second.fecha || '').localeCompare(String(first.fecha || '')));
  }

  function getProjectsForClient(projects = [], clientId = '') {
    if (!clientId) return [];
    return projects.filter((project) => project.cliente_id === clientId);
  }

  function shouldOpenTransactionFormFromHash(hash = '') {
    return String(hash).replace(/^#/, '') === 'transaction-form-panel';
  }

  const api = {
    calculateSummary,
    filterTransactions,
    getProjectsForClient,
    isValidDate,
    normalizeText,
    shouldOpenTransactionFormFromHash,
    sanitizeTransactions,
    toExpenseRecords,
    validateStoredTransaction,
    validateTransaction
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowTransactionModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
