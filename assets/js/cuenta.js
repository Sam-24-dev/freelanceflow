(function profilePage() {
  'use strict';
  const model = window.FreelanceFlowProfileModel;
  let elements; let saved; let storage; let saving = false;
  document.addEventListener('DOMContentLoaded', initialize);
  function initialize() {
    if (!model) return;
    elements = { form: document.getElementById('profile-form'), summary: document.getElementById('profile-form-summary'), status: document.getElementById('profile-status'), discard: document.getElementById('profile-discard'), save: document.getElementById('profile-save'), initials: document.getElementById('profile-initials'), name: document.querySelector('[data-profile-name]'), email: document.querySelector('[data-profile-email]'), country: document.querySelector('[data-profile-country]') };
    storage = model.getSafeStorage(window); saved = model.readProfile(storage); apply(saved); render();
    elements.form.addEventListener('input', render); elements.form.addEventListener('submit', save); elements.discard.addEventListener('click', discard);
    window.addEventListener('beforeunload', (event) => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } });
  }
  function formValue() { return Object.fromEntries(new FormData(elements.form).entries()); }
  function isDirty() { return JSON.stringify(model.normalizeProfile(formValue())) !== JSON.stringify(saved); }
  function apply(value) { Object.entries(model.normalizeProfile(value)).forEach(([name, fieldValue]) => { elements.form.elements[name].value = fieldValue; }); clearErrors(); }
  function render() { const value = model.normalizeProfile(formValue()); elements.initials.textContent = model.initials(value.fullName); elements.name.textContent = value.fullName || 'Tu perfil'; elements.email.textContent = value.email || 'Completá tus datos para personalizar esta presentación local.'; elements.country.textContent = value.country || '—'; elements.discard.disabled = !isDirty(); }
  function save(event) { event.preventDefault(); if (saving) return; const result = model.validateProfile(formValue()); if (!result.valid) return showErrors(result.errors); saving = true; elements.save.disabled = true; try { localStorage.setItem(model.PROFILE_STORAGE_KEY, model.serializeProfile(result.value)); } catch { announce('No pudimos guardar tu perfil. Revisá el almacenamiento del navegador e intentá nuevamente.'); saving = false; elements.save.disabled = false; return; } saved = result.value; clearErrors(); apply(saved); render(); try { window.FreelanceFlowActivity?.record({ module: 'Cuenta', action: 'Perfil actualizado', description: 'Información básica del perfil actualizada.' }); } catch {} announce('Perfil actualizado. Tus cambios se guardaron correctamente.'); saving = false; elements.save.disabled = false; }
  function discard() { if (!isDirty() || !window.confirm('¿Descartar los cambios sin guardar?')) return; apply(saved); render(); announce('Cambios descartados.'); }
  function showErrors(errors) { clearErrors(); const names = Object.keys(errors); names.forEach((name) => { const field = elements.form.elements[name]; field?.setAttribute('aria-invalid', 'true'); const message = elements.form.querySelector(`[data-field-error="${name}"]`); if (message) message.textContent = errors[name]; }); elements.summary.textContent = 'Revisá los campos marcados para guardar tu perfil.'; elements.summary.hidden = false; elements.form.elements[names[0]]?.focus(); }
  function clearErrors() { elements?.form?.querySelectorAll('[data-field-error]').forEach((node) => { node.textContent = ''; }); elements?.form && [...elements.form.elements].forEach((field) => field.removeAttribute?.('aria-invalid')); if (elements) elements.summary.hidden = true; }
  function announce(message) { elements.status.textContent = message; elements.status.hidden = false; }
}());