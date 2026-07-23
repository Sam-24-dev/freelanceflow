(function bitacoraFactory(globalScope) {
  'use strict';

  function getAdminRedirect(membershipContext) {
    return membershipContext?.status === 'valid'
      && membershipContext.membership?.role === 'administrative'
      ? ''
      : 'acceso.html';
  }

  function summarizeEntries(entries = []) {
    const modules = [...new Set(entries.map((entry) => entry.module).filter(Boolean))];
    return {
      total: entries.length,
      lastAction: entries[0]?.action || 'Sin actividad',
      lastTime: entries[0]?.timestamp || '',
      modules
    };
  }

  function getVisibleEntries(entries = []) {
    return entries.filter((entry) => entry.role === 'operational');
  }

  function getRecentEntries(entries = [], limit = 5) {
    return getVisibleEntries(entries).slice(0, limit);
  }

  const api = { getAdminRedirect, summarizeEntries, getVisibleEntries, getRecentEntries };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (globalScope.document) {
    const formatter = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
    const elements = {};

    globalScope.document.addEventListener('DOMContentLoaded', () => {
      const membershipContext = globalScope.FreelanceFlowMembershipContext?.readActiveMembership() || { status: 'unavailable' };
      const redirect = getAdminRedirect(membershipContext);
      if (redirect) return;

      const selectors = { total: 'total', lastAction: 'last-action', lastTime: 'last-time', modules: 'modules', tableBody: 'table-body', mobileList: 'mobile-list', empty: 'empty', tableWrap: 'table-wrap', clear: 'clear', status: 'status' };
      Object.entries(selectors).forEach(([key, attr]) => { elements[key] = globalScope.document.querySelector(`[data-bitacora-${attr}]`); });

      elements.clear?.addEventListener('click', () => {
        if (!globalScope.confirm?.('¿Limpiar la actividad de esta sesión?')) return;
        globalScope.FreelanceFlowActivity?.clear();
        render();
        if (elements.status) elements.status.textContent = 'Actividad de esta sesión limpiada.';
      });
      globalScope.addEventListener?.('freelanceflow:activity-updated', render);
      globalScope.addEventListener?.('freelanceflow:activity-cleared', render);
      render();
    });

    function formatDate(value) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : formatter.format(date);
    }

    function render() {
      const entries = getVisibleEntries(globalScope.FreelanceFlowActivity?.read?.() || []);
      const recentEntries = getRecentEntries(entries);
      const summary = summarizeEntries(entries);
      if (elements.total) elements.total.textContent = String(summary.total);
      if (elements.lastAction) elements.lastAction.textContent = summary.lastAction;
      if (elements.lastTime) elements.lastTime.textContent = summary.lastTime ? formatDate(summary.lastTime) : 'Sin registro';
      if (elements.modules) elements.modules.textContent = summary.modules.length ? summary.modules.join(', ') : 'Sin módulos';
      if (elements.empty) elements.empty.hidden = entries.length > 0;
      if (elements.tableWrap) elements.tableWrap.hidden = entries.length === 0;
      if (elements.mobileList) elements.mobileList.hidden = entries.length === 0;
      if (elements.tableBody) elements.tableBody.replaceChildren(...entries.map(renderRow));
      if (elements.mobileList) elements.mobileList.replaceChildren(...recentEntries.map(renderCard));
    }

    function renderRow(entry) {
      const row = globalScope.document.createElement('tr');
      const date = globalScope.document.createElement('td');
      date.textContent = formatDate(entry.timestamp);
      const actor = globalScope.document.createElement('td');
      const actorName = globalScope.document.createElement('strong');
      actorName.textContent = entry.actor;
      actor.append(actorName);
      const module = globalScope.document.createElement('td');
      module.textContent = entry.module;
      const action = globalScope.document.createElement('td');
      action.textContent = entry.action;
      const description = globalScope.document.createElement('td');
      description.textContent = entry.description;
      row.append(date, actor, module, action, description);
      return row;
    }

    function renderCard(entry) {
      const card = globalScope.document.createElement('article');
      card.className = 'report-access-card';
      const icon = globalScope.document.createElement('span');
      icon.className = 'report-access-icon report-access-teal';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '✓';
      const content = globalScope.document.createElement('span');
      const action = globalScope.document.createElement('strong');
      action.textContent = entry.action;
      const details = globalScope.document.createElement('small');
      details.textContent = `${formatDate(entry.timestamp)} · ${entry.module}`;
      const actor = globalScope.document.createElement('small');
      actor.textContent = `${entry.actor} · ${entry.description}`;
      content.append(action, details, actor);
      card.append(icon, content);
      return card;
    }
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
