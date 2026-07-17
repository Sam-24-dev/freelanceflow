(function settingsModule() {
  'use strict';
  const STORAGE_KEY = 'freelanceflow_settings_v1';
  const model = window.FreelanceFlowSettingsModel;
  let elements;
  document.addEventListener('DOMContentLoaded', initialize);
  function initialize() {
    if (!model) return;
    elements = { form: document.getElementById('settings-form'), summary: document.getElementById('settings-form-summary'), status: document.getElementById('settings-status'), number: document.getElementById('settings-preview-number'), due: document.getElementById('settings-preview-due'), currency: document.getElementById('settings-preview-currency'), reset: document.getElementById('settings-reset') };
    apply(readStored());
    elements.form.addEventListener('input', render);
    elements.form.addEventListener('change', render);
    elements.form.addEventListener('submit', save);
    elements.reset.addEventListener('click', restore);
    render();
  }
  function readStored() { try { return model.parseStoredSettings(localStorage.getItem(STORAGE_KEY)); } catch { return model.getDefaultSettings(); } }
  function formValue() { return Object.fromEntries(new FormData(elements.form).entries()); }
  function apply(value) { const normalized = model.normalizeSettings(value); Object.entries(normalized).forEach(([name, value]) => { elements.form.elements[name].value = value ?? ''; }); clearErrors(); }
  function render() { const preview = model.buildSettingsPreview(formValue()); elements.number.textContent = preview.invoice_number; elements.due.textContent = preview.due_behavior; elements.currency.textContent = preview.currency; elements.status.textContent = ''; elements.status.hidden = true; }
  function save(event) { event.preventDefault(); const result = model.validateSettings(formValue()); if (!result.valid) return showErrors(result.errors); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result.value)); } catch { announce('No pudimos guardar los ajustes. Inténtalo nuevamente.'); return; } clearErrors(); apply(result.value); render(); try { window.FreelanceFlowActivity?.record({ module: 'Ajustes', action: 'Ajustes guardados', description: 'Se actualizaron los ajustes de facturación y preferencias.' }); } catch {} announce('Ajustes guardados correctamente.'); }
  function restore() { if (!window.confirm('¿Restaurar los valores predeterminados? Se reemplazarán los cambios actuales.')) return; const defaults = model.getDefaultSettings(); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)); } catch { announce('No pudimos guardar los ajustes. Inténtalo nuevamente.'); return; } apply(defaults); render(); try { window.FreelanceFlowActivity?.record({ module: 'Ajustes', action: 'Ajustes restaurados', description: 'Se restauraron los valores predeterminados.' }); } catch {} announce('Valores predeterminados restaurados.'); }
  function showErrors(errors) { clearErrors(); const names = Object.keys(errors); names.forEach((name) => { const field = elements.form.elements[name]; field?.setAttribute('aria-invalid', 'true'); const message = elements.form.querySelector(`[data-field-error="${name}"]`); if (message) message.textContent = errors[name]; }); elements.summary.textContent = 'Revisa los campos marcados para guardar los ajustes.'; elements.summary.hidden = false; elements.form.elements[names[0]]?.focus(); render(); }
  function clearErrors() { elements?.form?.querySelectorAll('[data-field-error]').forEach((node) => { node.textContent = ''; }); elements?.form && [...elements.form.elements].forEach((field) => field.removeAttribute?.('aria-invalid')); if (elements) elements.summary.hidden = true; }
  function announce(message) { elements.status.textContent = message; elements.status.hidden = false; }
}());
