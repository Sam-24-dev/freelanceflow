(function settingsModule() {
  'use strict';

  const STORAGE_KEY = 'freelanceflow_settings_v1';
  const TRANSITION_KEY = 'freelanceflow_invoice_transition_v1';
  const model = window.FreelanceFlowSettingsModel;
  const invoiceModel = window.FreelanceFlowInvoiceModel;
  let elements;
  let durableEnvelope;
  let storageAvailable = true;
  let persistentStatus = '';

  document.addEventListener('DOMContentLoaded', initialize);
  window.addEventListener?.('pageshow', (event) => {
    if (event.persisted) refreshFromStorage();
  });

  function initialize() {
    if (!model) return;
    elements = {
      form: document.getElementById('settings-form'), summary: document.getElementById('settings-form-summary'), status: document.getElementById('settings-status'),
      number: document.getElementById('settings-preview-number'), due: document.getElementById('settings-preview-due'), currency: document.getElementById('settings-preview-currency'),
      reset: document.getElementById('settings-reset')
    };
    const stored = readStored();
    durableEnvelope = stored.envelope;
    apply(durableEnvelope.settings);
    setStorageAvailability(stored.available);
    elements.form.addEventListener('input', render);
    elements.form.addEventListener('change', render);
    elements.form.addEventListener('submit', save);
    elements.reset.addEventListener('click', restore);
    render();
  }

  function readStored() {
    try {
      const staged = invoiceModel?.readInvoiceTransitionSettings(localStorage, TRANSITION_KEY);
      const direct = localStorage.getItem(STORAGE_KEY);
      return { available: true, envelope: model.resolveStoredSettingsEnvelope(direct, staged) };
    } catch { return { available: false, envelope: model.getDefaultSettingsEnvelope() }; }
  }

  function refreshFromStorage() {
    if (!elements || !model) return;
    const stored = readStored();
    durableEnvelope = stored.envelope;
    persistentStatus = '';
    apply(durableEnvelope.settings);
    setStorageAvailability(stored.available);
    render();
  }

  function formValue() { return Object.fromEntries(new FormData(elements.form).entries()); }

  function apply(value) {
    const normalized = model.normalizeSettings(value);
    Object.entries(normalized).forEach(([name, fieldValue]) => { elements.form.elements[name].value = fieldValue ?? ''; });
    clearErrors();
  }

  function render() {
    const preview = model.buildSettingsPreview(formValue());
    elements.number.textContent = preview.invoice_number;
    elements.due.textContent = preview.due_behavior;
    elements.currency.textContent = preview.currency;
    if (!persistentStatus) { elements.status.textContent = ''; elements.status.hidden = true; }
  }

  function setStorageAvailability(available) {
    storageAvailable = available;
    elements.form.querySelectorAll('button').forEach((button) => { button.disabled = !available; });
    if (!available) {
      persistentStatus = 'No podemos acceder al almacenamiento de ajustes. Guardar y restaurar están bloqueados hasta que vuelva a estar disponible.';
      announce(persistentStatus, true);
    }
  }

  function storageFailure() {
    apply(durableEnvelope.settings);
    setStorageAvailability(false);
    render();
  }

  function persist(envelope) {
    const serialized = model.serializeSettingsEnvelope(envelope);
    if (!serialized) return false;
    try { localStorage.setItem(STORAGE_KEY, serialized); return true; } catch { return false; }
  }

  async function runSerializedSettingsMutation(mutation) {
    const lockManager = window.navigator?.locks;
    const lockName = invoiceModel?.INVOICE_WEB_LOCK_NAME;
    if (!lockName || !lockManager || typeof lockManager.request !== 'function') return { committed: false, reason: 'lock-unavailable' };
    try {
      return await lockManager.request(lockName, { mode: 'exclusive' }, async (lock) => {
        if (!lock) return { committed: false, reason: 'lock-unavailable' };
        const result = await mutation();
        return result && typeof result.committed === 'boolean' ? result : { committed: false, reason: 'mutation-failed' };
      });
    } catch { return { committed: false, reason: 'lock-failed' }; }
  }

  function lockFailure() {
    persistentStatus = 'No se pudo obtener el bloqueo de facturaci?n. Los ajustes no se guardaron.';
    announce(persistentStatus, true);
  }

  async function save(event) {
    event.preventDefault();
    if (!storageAvailable) return storageFailure();
    const result = model.validateSettings(formValue());
    if (!result.valid) return showErrors(result.errors);
    const committed = await runSerializedSettingsMutation(() => {
      const stored = readStored();
      if (!stored.available) return { committed: false, reason: 'storage-unavailable' };
      const current = stored.envelope;
      const envelope = model.createSettingsEnvelope({
        ...result.value,
        next_invoice_number: Math.max(result.value.next_invoice_number, current.settings.next_invoice_number)
      }, current.revision + 1);
      return envelope && persist(envelope)
        ? { committed: true, envelope }
        : { committed: false, reason: 'storage-unavailable' };
    });
    if (!committed?.committed) return committed?.reason === 'storage-unavailable' ? storageFailure() : lockFailure();
    durableEnvelope = committed.envelope;
    persistentStatus = '';
    clearErrors();
    apply(durableEnvelope.settings);
    render();
    try { window.FreelanceFlowActivity?.record({ module: 'Ajustes', action: 'Ajustes guardados', description: 'Se actualizaron los ajustes de facturaci?n y preferencias.' }); } catch {}
    announce('Ajustes guardados correctamente.');
  }

  async function restore() {
    if (!storageAvailable) return storageFailure();
    if (!window.confirm('?Restaurar los valores predeterminados? Se reemplazar?n los cambios actuales.')) return;
    const defaults = model.getDefaultSettings();
    const committed = await runSerializedSettingsMutation(() => {
      const stored = readStored();
      if (!stored.available) return { committed: false, reason: 'storage-unavailable' };
      const current = stored.envelope;
      const envelope = model.createSettingsEnvelope({
        ...defaults,
        next_invoice_number: Math.max(defaults.next_invoice_number, current.settings.next_invoice_number)
      }, current.revision + 1);
      return envelope && persist(envelope)
        ? { committed: true, envelope }
        : { committed: false, reason: 'storage-unavailable' };
    });
    if (!committed?.committed) return committed?.reason === 'storage-unavailable' ? storageFailure() : lockFailure();
    durableEnvelope = committed.envelope;
    persistentStatus = '';
    apply(durableEnvelope.settings);
    render();
    try { window.FreelanceFlowActivity?.record({ module: 'Ajustes', action: 'Ajustes restaurados', description: 'Se restauraron los valores predeterminados.' }); } catch {}
    announce('Valores predeterminados restaurados.');
  }

  function showErrors(errors) {
    clearErrors();
    const names = Object.keys(errors);
    names.forEach((name) => {
      const field = elements.form.elements[name];
      field?.setAttribute('aria-invalid', 'true');
      const message = elements.form.querySelector(`[data-field-error="${name}"]`);
      if (message) message.textContent = errors[name];
    });
    elements.summary.textContent = 'Revisa los campos marcados para guardar los ajustes.';
    elements.summary.hidden = false;
    elements.form.elements[names[0]]?.focus();
    render();
  }

  function clearErrors() {
    elements?.form?.querySelectorAll('[data-field-error]').forEach((node) => { node.textContent = ''; });
    elements?.form && [...elements.form.elements].forEach((field) => field.removeAttribute?.('aria-invalid'));
    if (elements) elements.summary.hidden = true;
  }

  function announce(message, persistent = false) {
    elements.status.setAttribute?.('role', persistent ? 'alert' : 'status');
    elements.status.textContent = message;
    elements.status.hidden = false;
  }
}());
