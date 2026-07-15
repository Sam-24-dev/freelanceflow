(function accessFactory(globalScope) {
  'use strict';

  const PROFILE_KEY = 'freelanceflow_access_profile';
  const ACTOR_KEY = 'freelanceflow_access_actor';
  const profiles = {
    operational: { actor: 'Equipo operativo', redirectTo: 'dashboard.html', label: 'Perfil operativo' },
    administrative: { actor: 'Administración', redirectTo: 'bitacora.html', label: 'Perfil administrativo' }
  };

  function selectAccessProfile(profile, options = {}) {
    const selected = profiles[profile] ? profile : 'operational';
    const config = profiles[selected];
    const storage = options.storage || globalScope.sessionStorage;
    storage.setItem(PROFILE_KEY, selected);
    storage.setItem(ACTOR_KEY, config.actor);
    return { profile: selected, ...config };
  }

  const api = { selectAccessProfile, PROFILE_KEY, ACTOR_KEY, profiles };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (globalScope.document) {
    globalScope.document.addEventListener('DOMContentLoaded', () => {
      globalScope.document.querySelectorAll('[data-access-profile]').forEach((button) => {
        button.addEventListener('click', () => {
          const result = selectAccessProfile(button.dataset.accessProfile);
          globalScope.FreelanceFlowActivity?.record({
            module: 'Acceso',
            action: 'Perfil seleccionado',
            description: `${result.label} seleccionado.`
          });
          globalScope.location.href = result.redirectTo;
        });
      });
    });
  }
}(typeof globalThis !== 'undefined' ? globalThis : window));
