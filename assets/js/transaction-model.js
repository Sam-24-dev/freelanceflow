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

  function validateTransaction(transaction = {}) {
    if (!TRANSACTION_TYPES.includes(transaction.tipo)) {
      return { valid: false, field: 'tipo', message: 'Selecciona un tipo de movimiento.' };
    }

    if (!Number.isFinite(Number(transaction.monto)) || Number(transaction.monto) <= 0) {
      return { valid: false, field: 'monto', message: 'Ingresa un monto mayor a cero.' };
    }

    if (!isValidDate(transaction.fecha)) {
      return { valid: false, field: 'fecha', message: 'Ingresa una fecha válida.' };
    }

    if (!transaction.categoria) {
      return { valid: false, field: 'categoria', message: 'Selecciona una categoría.' };
    }

    if (!transaction.cuenta_id) {
      return { valid: false, field: 'cuenta_id', message: 'Selecciona una cuenta mock auxiliar.' };
    }

    return { valid: true };
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
    validateTransaction
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowTransactionModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
