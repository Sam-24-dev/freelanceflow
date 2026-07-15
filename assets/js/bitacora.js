(function bitacoraFactory(globalScope) {
  'use strict';

  function getAdminRedirect(profile) {
    return profile === 'administrative' ? '' : 'acceso.html';
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
    return entries.filter((entry) => entry.profile === 'operational');
  }

  function getRecentEntries(entries = [], limit = 5) {
    return getVisibleEntries(entries).slice(0, limit);
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  const api = { getAdminRedirect, summarizeEntries, getVisibleEntries, getRecentEntries };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (globalScope.document) {
    const formatter = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
    const elements = {};

    globalScope.document.addEventListener('DOMContentLoaded', () => {
      const profile = globalScope.sessionStorage?.getItem('freelanceflow_access_profile') || '';
      const redirect = getAdminRedirect(profile);
      if (redirect) {
        globalScope.location.replace(redirect);
        return;
      }

      const selectors = { total: 'total', lastAction: 'last-action', lastTime: 'last-time', modules: 'modules', tableBody: 'table-body', mobileList: 'mobile-list', empty: 'empty', tableWrap: 'table-wrap', clear: 'clear', status: 'status' };
      Object.entries(selectors).forEach(([key, attr]) => { elements[key] = globalScope.document.querySelector(`[data-bitacora-${attr}]`); });

      elements.clear?.addEventListener('click', () => {
        if (!globalScope.confirm?.('¿Limpiar toda la actividad operativa registrada en esta sesión?')) return;
        globalScope.FreelanceFlowActivity?.clear();
        render();
        if (elements.status) elements.status.textContent = 'Bitácora limpiada.';
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
      if (elements.tableBody) elements.tableBody.innerHTML = entries.map(renderRow).join('');
      if (elements.mobileList) elements.mobileList.innerHTML = recentEntries.map(renderCard).join('');
    }

    function renderRow(entry) {
      return `<tr><td>${escapeHTML(formatDate(entry.timestamp))}</td><td><strong>${escapeHTML(entry.actor)}</strong></td><td>${escapeHTML(entry.module)}</td><td>${escapeHTML(entry.action)}</td><td>${escapeHTML(entry.description)}</td></tr>`;
    }

    function renderCard(entry) {
      return `<article class="report-access-card"><span class="report-access-icon report-access-teal" aria-hidden="true">✓</span><span><strong>${escapeHTML(entry.action)}</strong><small>${escapeHTML(formatDate(entry.timestamp))} · ${escapeHTML(entry.module)}</small><small>${escapeHTML(entry.actor)} · ${escapeHTML(entry.description)}</small></span></article>`;
    }
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
