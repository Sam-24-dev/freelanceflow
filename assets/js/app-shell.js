/*
  FreelanceFlow shared application shell.
  Provides one responsive navigation pattern for every authenticated app screen.
*/

(() => {
  'use strict';

  const SIDEBAR_STORAGE_KEY = 'freelanceflow_sidebar_collapsed';
  const LANDING_HREF = '../index.html';
  const DESKTOP_QUERY = '(min-width: 1024px)';

  const icons = {
    dashboard: '<path d="M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z"/>',
    movements: '<path d="M7 7h12m0 0-3-3m3 3-3 3M17 17H5m0 0 3 3m-3-3 3-3"/>',
    clients: '<path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20m12-10a3 3 0 1 1 0-6m4 16v-1.5a3.5 3.5 0 0 0-2.5-3.35M9.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/>',
    projects: '<path d="M4 7h6l2 2h8v10H4V7Zm0 0V5h6l2 2M9 13h6m-3-3v6"/>',
    services: '<path d="M4 7.5 12 3l8 4.5L12 12 4 7.5Zm0 5L12 17l8-4.5M4 17l8 4 8-4"/>',
    proposals: '<path d="M7 3h7l4 4v14H7V3Zm7 0v5h4M10 12h5m-5 4h5"/>',
    invoices: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3"/>',
    reports: '<path d="M5 20V10m7 10V4m7 16v-7"/>',
    log: '<path d="M7 4h10v16H7V4Zm3 5h4m-4 4h4m-4 4h2"/>',
    categories: '<path d="M4 5h16v14H4V5Zm4 4h8m-8 4h5"/>',
    fiscal: '<path d="M12 3v18m5-14.5c0-1.4-2.2-2.5-5-2.5S7 5.1 7 6.5 9.2 9 12 9s5 1.1 5 2.5S14.8 14 12 14s-5 1.1-5 2.5S9.2 19 12 19s5-1.1 5-2.5"/>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>',
    settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-3.5 2-1-2-3.5-2.2.5a8 8 0 0 0-1.6-.9L14.5 5h-5l-.7 2.1a8 8 0 0 0-1.6.9L5 7.5 3 11l2 1a8 8 0 0 0 0 2l-2 1 2 3.5 2.2-.5a8 8 0 0 0 1.6.9l.7 2.1h5l.7-2.1a8 8 0 0 0 1.6-.9l2.2.5 2-3.5-2-1a8 8 0 0 0 0-2Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    collapse: '<path d="m14 7-5 5 5 5"/>',
    home: '<path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4v-9Z"/>',
    profile: '<path d="M20 21a8 8 0 0 0-16 0m8-9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>'
  };

  const baseNavigationGroups = [
    {
      label: 'Operación',
      items: [
        ['dashboard.html', 'Dashboard', 'dashboard'],
        ['transacciones.html', 'Movimientos', 'movements'],
        ['clientes.html', 'Clientes', 'clients'],
        ['proyectos.html', 'Proyectos', 'projects'],
        ['facturas.html', 'Facturas', 'invoices'],
        ['reportes.html', 'Reportes', 'reports'],
        ['categorias.html', 'Categorías', 'categories'],
        ['servicios.html', 'Servicios', 'services']
      ]
    }
  ];


  function getStoredProfile() {
    try {
      return sessionStorage.getItem('freelanceflow_access_profile') || '';
    } catch {
      return '';
    }
  }

  function getStoredActor() {
    try {
      return sessionStorage.getItem('freelanceflow_access_actor') || 'Equipo operativo';
    } catch {
      return 'Equipo operativo';
    }
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function getNavigationGroupsForProfile(profile = 'operational') {
    if (profile === 'administrative') {
      return [{ label: 'Administración', items: [['bitacora.html', 'Bit\u00e1cora', 'log']] }];
    }
    return baseNavigationGroups.map((group) => ({ ...group, items: [...group.items] }));
  }

  function getProtectedRedirect(file, profile = '') {
    const operationalFiles = baseNavigationGroups.flatMap((group) => group.items.map((item) => item[0]));
    if (!profile && (file === 'bitacora.html' || operationalFiles.includes(file))) return 'acceso.html';
    if (file === 'bitacora.html' && profile !== 'administrative') return 'acceso.html';
    if (profile === 'administrative' && operationalFiles.includes(file)) return 'bitacora.html';
    return '';
  }

  const bottomNavigation = [
    ['dashboard.html', 'Inicio', 'home'],
    ['transacciones.html', 'Movimientos', 'movements'],
    ['clientes.html', 'Clientes', 'clients'],
    ['proyectos.html', 'Proyectos', 'projects'],
    ['facturas.html', 'Facturas', 'invoices']
  ];

  function icon(name, className = '') {
    return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
  }

  function currentFile() {
    const file = window.location.pathname.split('/').pop();
    return file || 'dashboard.html';
  }

  function pageLabel() {
    const title = document.title.split('|').pop()?.trim();
    return title || 'FreelanceFlow';
  }

  function navLink([href, label, iconName], activeFile) {
    const isActive = href === activeFile;
    return `
      <li>
        <a class="app-sidebar-nav-link${isActive ? ' app-sidebar-nav-link-active' : ''}" href="${href}" title="${label}"${isActive ? ' aria-current="page"' : ''}>
          ${icon(iconName, 'app-sidebar-nav-icon')}
          <span class="app-sidebar-nav-label">${label}</span>
        </a>
      </li>`;
  }

  function buildSidebar(activeFile, profile) {
    const aside = document.createElement('aside');
    aside.id = 'app-sidebar';
    aside.className = 'app-sidebar';
    aside.setAttribute('aria-label', 'Menú principal');
    aside.innerHTML = `
      <div class="app-sidebar-panel">
        <header class="app-sidebar-header">
          <a class="app-sidebar-brand" href="${LANDING_HREF}" aria-label="FreelanceFlow, ir a la página de inicio">
            <img src="../img/brand/freelanceflow-mark-color.svg" alt="" width="38" height="38" aria-hidden="true">
            <span class="app-sidebar-brand-name" translate="no">Freelance<span>Flow</span></span>
          </a>
          <button class="app-sidebar-toggle" type="button" data-sidebar-internal-toggle aria-controls="app-sidebar" aria-label="Contraer menú lateral">
            ${icon('collapse', 'app-sidebar-toggle-icon app-sidebar-collapse-icon')}
            ${icon('close', 'app-sidebar-toggle-icon app-sidebar-close-icon')}
          </button>
          <p class="app-sidebar-tagline">Control financiero para trabajar con claridad.</p>
        </header>
        <nav class="app-sidebar-navigation" aria-label="Navegación principal">
          ${getNavigationGroupsForProfile(profile).map((group) => `
            <section class="app-sidebar-group" aria-label="${group.label}">
              <p class="app-sidebar-section-title">${group.label}</p>
              <ul>${group.items.map((item) => navLink(item, activeFile)).join('')}</ul>
            </section>`).join('')}
        </nav>
        <footer class="app-sidebar-footer">
          <div class="app-sidebar-profile" aria-label="Usuario actual">
            <span class="app-sidebar-avatar" aria-hidden="true">AV</span>
            <span class="app-sidebar-profile-copy">
              <strong>${escapeHTML(getStoredActor())}</strong>
              <small>${profile === 'administrative' ? 'Perfil administrativo' : 'Perfil operativo'}</small>
            </span>
          </div>
        </footer>
      </div>`;
    return aside;
  }

  function buildMobileAppBar() {
    const header = document.createElement('header');
    header.className = 'app-mobile-appbar';
    header.setAttribute('data-app-mobile-header', '');
    header.setAttribute('data-generated-mobile-appbar', '');
    header.innerHTML = `
      <button class="app-mobile-menu-button" type="button" data-sidebar-mobile-trigger aria-controls="app-sidebar" aria-expanded="false" aria-label="Abrir menú principal">
        ${icon('menu', 'app-mobile-menu-icon')}
      </button>
      <a class="app-mobile-brand" href="${LANDING_HREF}" aria-label="FreelanceFlow, ir a la página de inicio">
        <img src="../img/brand/freelanceflow-mark-color.svg" alt="" width="32" height="32" fetchpriority="high" aria-hidden="true">
        <span translate="no">Freelance<span>Flow</span></span>
      </a>
      <span class="app-mobile-page-name">${pageLabel()}</span>`;
    return header;
  }

  function getBottomNavigationForProfile(profile = 'operational') {
    return profile === 'administrative' ? [] : bottomNavigation;
  }

  function buildBottomNavigation(activeFile, profile) {
    const nav = document.createElement('nav');
    nav.className = 'app-bottom-navigation';
    nav.setAttribute('aria-label', 'Navegación móvil');
    const items = getBottomNavigationForProfile(profile);
    nav.hidden = items.length === 0;
    nav.innerHTML = items.map(([href, label, iconName]) => {
      const isActive = href === activeFile;
      return `<a href="${href}"${isActive ? ' aria-current="page"' : ''} class="${isActive ? 'app-bottom-link-active' : ''}">${icon(iconName, 'app-bottom-icon')}<span>${label}</span></a>`;
    }).join('');
    return nav;
  }

  function readCollapsedPreference() {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  function writeCollapsedPreference(value) {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
    } catch {
      // The shell remains functional when storage is unavailable.
    }
  }

  function initAppShell() {
    const layout = document.querySelector('[data-app-layout]');
    const slot = document.querySelector('[data-app-sidebar-slot]');
    const main = layout?.querySelector('main');
    if (!layout || !slot || !main) return;

    const activeFile = currentFile();
    const profile = getStoredProfile();
    const redirect = getProtectedRedirect(activeFile, profile);
    if (redirect) { window.location.replace(redirect); return; }
    const sidebar = buildSidebar(activeFile, profile);
    slot.replaceWith(sidebar);

    const mobileHeaderSlot = document.querySelector('[data-app-mobile-header-slot]');
    if (mobileHeaderSlot) {
      mobileHeaderSlot.replaceWith(buildMobileAppBar());
    } else if (!document.querySelector('[data-app-mobile-header]')) {
      main.before(buildMobileAppBar());
    }

    const bottomNav = buildBottomNavigation(activeFile, profile);
    document.body.append(bottomNav);

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'app-sidebar-backdrop';
    backdrop.setAttribute('aria-label', 'Cerrar menú principal');
    document.body.append(backdrop);

    const desktopMedia = window.matchMedia(DESKTOP_QUERY);
    const internalToggle = sidebar.querySelector('[data-sidebar-internal-toggle]');
    const mobileTriggers = [...document.querySelectorAll('[data-sidebar-mobile-trigger]')];
    let collapsed = readCollapsedPreference();
    let mobileOpen = false;
    let lastTrigger = null;
    let lastDesktopState = desktopMedia.matches;
    let resizeFrame = 0;

    function setMainInert(value) {
      if (value) {
        main.setAttribute('inert', '');
        bottomNav.setAttribute('inert', '');
      } else {
        main.removeAttribute('inert');
        bottomNav.removeAttribute('inert');
      }
    }

    function syncShell() {
      const isDesktop = desktopMedia.matches;
      const sidebarIsHidden = !isDesktop && !mobileOpen;
      layout.dataset.sidebarCollapsed = isDesktop && collapsed ? 'true' : 'false';
      layout.dataset.sidebarOpen = !isDesktop && mobileOpen ? 'true' : 'false';
      document.body.classList.toggle('app-sidebar-is-open', !isDesktop && mobileOpen);
      sidebar.toggleAttribute('inert', sidebarIsHidden);
      if (sidebarIsHidden) sidebar.setAttribute('aria-hidden', 'true');
      else sidebar.removeAttribute('aria-hidden');
      if (!isDesktop && mobileOpen) {
        sidebar.setAttribute('role', 'dialog');
        sidebar.setAttribute('aria-modal', 'true');
      } else {
        sidebar.removeAttribute('role');
        sidebar.removeAttribute('aria-modal');
      }

      internalToggle?.setAttribute('aria-label', isDesktop
        ? (collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral')
        : 'Cerrar menú principal');
      internalToggle?.setAttribute('aria-expanded', String(isDesktop ? !collapsed : mobileOpen));
      mobileTriggers.forEach((trigger) => {
        trigger.setAttribute('aria-expanded', String(!isDesktop && mobileOpen));
        trigger.setAttribute('aria-label', mobileOpen ? 'Cerrar menú principal' : 'Abrir menú principal');
      });
      setMainInert(!isDesktop && mobileOpen);
    }

    function toggleInternal() {
      if (desktopMedia.matches) {
        collapsed = !collapsed;
        writeCollapsedPreference(collapsed);
      } else {
        mobileOpen = false;
        syncShell();
        lastTrigger?.focus();
        return;
      }
      syncShell();
    }

    function openMobile(trigger) {
      if (desktopMedia.matches) return;
      lastTrigger = trigger;
      mobileOpen = true;
      syncShell();
      requestAnimationFrame(() => internalToggle?.focus());
    }

    function closeMobile({ restoreFocus = true } = {}) {
      if (!mobileOpen) return;
      mobileOpen = false;
      syncShell();
      if (restoreFocus) lastTrigger?.focus();
    }

    internalToggle?.addEventListener('click', toggleInternal);
    backdrop.addEventListener('click', () => closeMobile());
    mobileTriggers.forEach((trigger) => trigger.addEventListener('click', () => {
      if (mobileOpen) closeMobile();
      else openMobile(trigger);
    }));
    sidebar.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMobile({ restoreFocus: false })));

    sidebar.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMobile();
        return;
      }
      if (event.key !== 'Tab' || desktopMedia.matches || !mobileOpen) return;
      const focusable = [...sidebar.querySelectorAll('a, button:not([disabled])')];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMobile();
    });

    function handleBreakpointChange() {
      const isDesktop = desktopMedia.matches;
      if (isDesktop !== lastDesktopState) mobileOpen = false;
      lastDesktopState = isDesktop;
      syncShell();
      if (!isDesktop && sidebar.contains(document.activeElement)) {
        mobileTriggers[0]?.focus();
      }
    }

    desktopMedia.addEventListener('change', handleBreakpointChange);
    window.addEventListener('resize', () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(handleBreakpointChange);
    });

    syncShell();
  }

  const api = { getNavigationGroupsForProfile, getProtectedRedirect, getBottomNavigationForProfile, escapeHTML, LANDING_HREF };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', initAppShell);
})();
