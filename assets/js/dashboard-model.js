(function dashboardModelFactory(globalScope) {
  'use strict';

  const DESKTOP_TRANSACTION_LIMIT = 5;
  const MOBILE_TRANSACTION_LIMIT = 3;

  function sortMovementsByNewest(movements = []) {
    return [...movements].sort((first, second) => (
      String(second.fecha || '').localeCompare(String(first.fecha || ''))
    ));
  }

  function createDashboardTransactionPreviews(movements = {}) {
    const sorted = sortMovementsByNewest(Array.isArray(movements) ? movements : []);

    return {
      desktop: sorted.slice(0, DESKTOP_TRANSACTION_LIMIT),
      mobile: sorted.slice(0, MOBILE_TRANSACTION_LIMIT)
    };
  }

  function buildMobileInvoiceAlert(invoices = []) {
    const pendingInvoices = (Array.isArray(invoices) ? invoices : [])
      .filter((invoice) => Number(invoice.saldo_pendiente || 0) > 0 && invoice.estado !== 'VOID');
    const overdueInvoices = pendingInvoices.filter((invoice) => invoice.estado === 'OVERDUE');
    const amount = pendingInvoices.reduce((total, invoice) => total + Number(invoice.saldo_pendiente || 0), 0);

    if (overdueInvoices.length > 0) {
      return {
        kind: 'overdue',
        count: overdueInvoices.length,
        amount: overdueInvoices.reduce((total, invoice) => total + Number(invoice.saldo_pendiente || 0), 0)
      };
    }

    if (pendingInvoices.length > 0) {
      return {
        kind: 'pending',
        count: pendingInvoices.length,
        amount
      };
    }

    return {
      kind: 'clear',
      count: 0,
      amount: 0
    };
  }

  const api = {
    buildMobileInvoiceAlert,
    createDashboardTransactionPreviews,
    sortMovementsByNewest
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  globalScope.FreelanceFlowDashboardModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : window));
