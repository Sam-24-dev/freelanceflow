(function accessFactory(globalScope) {
  'use strict';

  const context = () => globalScope.FreelanceFlowMembershipContext;

  function activateAccessMembership(id, options = {}) {
    return context()?.activateMembership(id, options.storage) || null;
  }

  function showAccessError(error) {
    error.hidden = false;
    error.focus?.();
  }

  function renderMemberships(container, memberships) {
    container.replaceChildren();
    memberships.forEach((membership) => {
      const card = document.createElement('article');
      card.className = 'access-membership';
      const organization = document.createElement('p');
      organization.textContent = membership.organization;
      const name = document.createElement('h2');
      name.textContent = membership.name;
      const role = document.createElement('span');
      role.textContent = `Rol: ${membership.role === 'operational' ? 'Operativo' : 'Administrativo'}`;
      const description = document.createElement('small');
      description.textContent = membership.description;
      const button = document.createElement('button');
      button.className = membership.role === 'operational' ? 'primary-cta' : 'secondary-cta';
      button.type = 'button';
      button.dataset.membershipId = membership.id;
      button.textContent = 'Continuar en este espacio';
      button.setAttribute('aria-label', `Continuar en este espacio: ${membership.name}`);
      card.append(organization, name, role, description, button);
      container.append(card);
    });
  }

  const api = { activateAccessMembership, renderMemberships };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (globalScope.document) {
    globalScope.document.addEventListener('DOMContentLoaded', () => {
      const access = context();
      const container = document.querySelector('[data-access-memberships]');
      const error = document.querySelector('[data-access-error]');
      const empty = document.querySelector('[data-access-empty]');
      const memberships = access?.MEMBERSHIPS || [];
      renderMemberships(container, memberships);
      empty.hidden = memberships.length > 0;
      container.addEventListener('click', (event) => {
        const button = event.target.closest('[data-membership-id]');
        if (!button) return;
        const membership = activateAccessMembership(button.dataset.membershipId);
        if (!membership) return showAccessError(error);
        try {
          globalScope.FreelanceFlowActivity?.record({
            module: 'Acceso',
            action: 'Contexto activado',
            description: 'Contexto de trabajo activado.'
          });
        } catch {
          // Logging is optional and must not block a valid context activation.
        }
        globalScope.location.href = membership.destination;
      });
    });
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
