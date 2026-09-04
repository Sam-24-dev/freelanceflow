(function accessFactory(globalScope) {
  'use strict';

  const api = () => globalScope.FreelanceFlowApi;
  const destination = 'dashboard.html';

  function setMessage(elements, text, isError = false) {
    elements.status.textContent = isError ? '' : text;
    elements.status.hidden = isError || !text;
    elements.error.hidden = !isError;
    if (isError) {
      elements.error.textContent = text;
      elements.error.focus();
    }
  }

  function setPending(elements, state, pending) {
    state.pending = pending;
    const disabled = pending || !state.ready;
    elements.login.querySelectorAll('input, button').forEach((control) => { control.disabled = disabled; });
    elements.memberships.querySelectorAll('button').forEach((button) => { button.disabled = disabled; });
    elements.retry.disabled = pending;
  }

  function showLogin(elements) {
    elements.login.hidden = false;
    elements.workspaceSection.hidden = true;
    elements.empty.hidden = true;
  }

  function renderWorkspaces(elements, workspaces) {
    elements.memberships.replaceChildren();
    workspaces.forEach((workspace) => {
      const card = document.createElement('article');
      card.className = 'access-membership';
      const slug = document.createElement('p');
      slug.textContent = workspace.workspace_slug;
      const name = document.createElement('h2');
      name.textContent = workspace.workspace_name;
      const role = document.createElement('span');
      role.textContent = `Rol: ${workspace.role}`;
      const button = document.createElement('button');
      button.className = 'primary-cta';
      button.type = 'button';
      button.dataset.workspaceId = workspace.workspace_public_id;
      button.textContent = 'Continuar en este espacio';
      button.setAttribute('aria-label', `Continuar en este espacio: ${workspace.workspace_name}`);
      card.append(slug, name, role, button);
      elements.memberships.append(card);
    });
  }

  async function loadWorkspaces(elements) {
    setMessage(elements, 'Cargando espacios disponibles…');
    const data = await api().workspaces();
    const workspaces = Array.isArray(data?.workspaces) ? data.workspaces : [];
    elements.workspaceSection.hidden = false;
    elements.empty.hidden = workspaces.length > 0;
    renderWorkspaces(elements, workspaces);
    setMessage(elements, '');
  }

  function errorMessage(error, action) {
    if (error.code === 'invalid_credentials') return 'El correo o la contraseña no son correctos.';
    if (error.code === 'workspace_not_available') return 'Ese espacio ya no está disponible para tu cuenta.';
    if (error.code === 'authentication_required') return 'Tu sesión venció. Ingresá nuevamente.';
    if (error.status === 403) return 'No tenés permiso para realizar esta acción.';
    return action === 'login' ? 'No pudimos iniciar sesión. Volvé a intentarlo.' : 'No pudimos cargar tus accesos. Volvé a intentarlo.';
  }

  function bind(elements, state) {
    elements.login.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!state.ready) return;
      setPending(elements, state, true);
      setMessage(elements, 'Iniciando sesión…');
      try {
        const form = new FormData(elements.login);
        await api().login(form.get('email'), form.get('password'));
      } catch (error) {
        showLogin(elements);
        setMessage(elements, errorMessage(error, 'login'), true);
        setPending(elements, state, false);
        return;
      }
      elements.login.hidden = true;
      try {
        await loadWorkspaces(elements);
      } catch (error) {
        setMessage(elements, errorMessage(error, 'workspace'), true);
      } finally {
        setPending(elements, state, false);
      }
    });

    elements.memberships.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-workspace-id]');
      if (!button || !state.ready) return;
      setPending(elements, state, true);
      setMessage(elements, 'Activando espacio…');
      try {
        await api().selectWorkspace(button.dataset.workspaceId);
        globalScope.location.assign(destination);
      } catch (error) {
        if (error.code === 'authentication_required') showLogin(elements);
        setMessage(elements, errorMessage(error, 'workspace'), true);
      } finally {
        setPending(elements, state, false);
      }
    });

    elements.retry.addEventListener('click', () => bootstrap(elements, state));
  }

  async function bootstrap(elements, state) {
    state.ready = false;
    elements.retry.hidden = true;
    setPending(elements, state, true);
    setMessage(elements, 'Preparando acceso…');
    let session;
    try {
      session = await api().session();
    } catch (error) {
      showLogin(elements);
      elements.retry.hidden = false;
      setMessage(elements, 'No pudimos preparar el acceso. Volvé a intentarlo.', true);
      setPending(elements, state, false);
      return;
    }
    state.ready = true;
    if (session?.authenticated) {
      elements.login.hidden = true;
      try {
        await loadWorkspaces(elements);
      } catch (error) {
        setMessage(elements, errorMessage(error, 'workspace'), true);
      }
    } else {
      showLogin(elements);
      setMessage(elements, '');
    }
    setPending(elements, state, false);
  }

  if (globalScope.document) {
    globalScope.document.addEventListener('DOMContentLoaded', () => {
      const elements = {
        login: document.querySelector('[data-access-login]'),
        workspaceSection: document.querySelector('[data-access-workspace-section]'),
        memberships: document.querySelector('[data-access-memberships]'),
        error: document.querySelector('[data-access-error]'),
        empty: document.querySelector('[data-access-empty]'),
        status: document.querySelector('[data-access-status]'),
        retry: document.querySelector('[data-access-retry]')
      };
      if (Object.values(elements).some((element) => !element)) return;
      const state = { pending: false, ready: false };
      bind(elements, state);
      bootstrap(elements, state);
    });
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
