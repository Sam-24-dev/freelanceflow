(function fiscalConfigurationModule() {
  'use strict';

  const STORAGE_KEY = 'freelanceflow_fiscal_config_v1';
  const model = window.FreelanceFlowFiscalConfigModel;
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', currencyDisplay: 'code' });
  let saved = null;
  let elements = {};

  document.addEventListener('DOMContentLoaded', initialize);

  function initialize() {
    if (!model) return;
    elements = {
      form: document.getElementById('fiscal-form'), firstTime: document.getElementById('fiscal-first-time'), taxToggle: document.getElementById('fiscal-tax-toggle'), taxField: document.getElementById('fiscal-tax-field'), taxInput: document.getElementById('fiscal-tax'), summary: document.getElementById('fiscal-form-summary'), status: document.getElementById('fiscal-status'), cancel: document.getElementById('fiscal-cancel'), base: document.getElementById('fiscal-base'), retention: document.getElementById('fiscal-retention-preview'), taxRow: document.getElementById('fiscal-tax-row'), tax: document.getElementById('fiscal-tax-preview'), total: document.getElementById('fiscal-total')
    };
    saved = readSaved();
    applyToForm(saved || {});
    bindEvents();
    render();
  }

  function bindEvents() {
    elements.form.addEventListener('input', render);
    elements.form.addEventListener('change', render);
    elements.taxToggle.addEventListener('change', syncTaxField);
    elements.form.addEventListener('submit', save);
    elements.cancel.addEventListener('click', cancel);
  }

  function readSaved() {
    try { return model.parseStoredFiscalConfiguration(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }

  function formValue() {
    const data = Object.fromEntries(new FormData(elements.form).entries());
    data.aplica_impuesto_valor_agregado = elements.taxToggle.checked;
    return data;
  }

  function applyToForm(value) {
    const normalized = model.normalizeFiscalConfiguration(value);
    elements.form.elements.identificacion_fiscal.value = normalized.identificacion_fiscal;
    elements.form.elements.regimen_tributario.value = normalized.regimen_tributario;
    elements.form.elements.porcentaje_retencion_estimado.value = normalized.porcentaje_retencion_estimado ?? '';
    elements.taxToggle.checked = normalized.aplica_impuesto_valor_agregado;
    elements.taxInput.value = normalized.aplica_impuesto_valor_agregado ? normalized.porcentaje_impuesto ?? '' : '';
    syncTaxField();
    clearErrors();
  }

  function syncTaxField() {
    const enabled = elements.taxToggle.checked;
    elements.taxField.hidden = !enabled;
    elements.taxInput.disabled = !enabled;
    elements.taxInput.required = enabled;
    if (!enabled) {
      elements.taxInput.value = '';
      clearFieldError('porcentaje_impuesto');
      if (!Object.keys(model.validateFiscalConfiguration(formValue()).errors).length) elements.summary.hidden = true;
    }
    render();
  }

  function render() {
    const value = formValue();
    const blankFirstTime = !saved
      && !String(value.identificacion_fiscal || '').trim()
      && !String(value.regimen_tributario || '').trim()
      && !String(value.porcentaje_retencion_estimado || '').trim()
      && !value.aplica_impuesto_valor_agregado;
    const estimate = model.calculateFiscalEstimate(blankFirstTime
      ? { porcentaje_retencion_estimado: 0, aplica_impuesto_valor_agregado: false }
      : value);
    elements.firstTime.hidden = Boolean(saved);
    elements.base.textContent = formatMoney(1000);
    elements.retention.textContent = estimate ? formatMoney(estimate.retention) : '—';
    elements.taxRow.hidden = !value.aplica_impuesto_valor_agregado;
    elements.tax.textContent = estimate ? formatMoney(estimate.tax) : '—';
    elements.total.textContent = estimate ? formatMoney(estimate.estimatedTotal) : '—';
  }

  function save(event) {
    event.preventDefault();
    const result = model.validateFiscalConfiguration(formValue());
    if (!result.valid) { showErrors(result.errors); return; }
    const record = { ...result.value, fecha_actualizacion: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      announce('No pudimos guardar la configuración. Inténtalo nuevamente.');
      return;
    }
    saved = result.value;
    applyToForm(saved);
    render();
    window.FreelanceFlowActivity?.record({ module: 'Configuración fiscal', action: 'Configuración fiscal guardada', description: 'Se actualizó la configuración fiscal estimada.' });
    announce('Configuración fiscal guardada correctamente.');
  }

  function cancel() {
    if (!isDirty() || window.confirm('¿Descartar los cambios sin guardar?')) {
      applyToForm(saved || {});
      render();
    }
  }

  function isDirty() {
    const current = model.normalizeFiscalConfiguration(formValue());
    const prior = model.normalizeFiscalConfiguration(saved || {});
    return JSON.stringify(current) !== JSON.stringify(prior);
  }

  function showErrors(errors) {
    clearErrors();
    const fields = Object.keys(errors);
    fields.forEach((name) => {
      const field = elements.form.elements[name];
      const message = elements.form.querySelector(`[data-field-error="${name}"]`);
      field?.setAttribute('aria-invalid', 'true');
      if (message) message.textContent = errors[name];
    });
    elements.summary.textContent = 'Revisa los campos marcados para guardar la configuración.';
    elements.summary.hidden = false;
    elements.form.elements[fields[0]]?.focus();
  }

  function clearErrors() {
    elements.form.querySelectorAll('[data-field-error]').forEach((node) => { node.textContent = ''; });
    [...elements.form.elements].forEach((field) => field.removeAttribute?.('aria-invalid'));
    elements.summary.hidden = true;
  }

  function clearFieldError(name) {
    elements.form.elements[name]?.removeAttribute('aria-invalid');
    const message = elements.form.querySelector(`[data-field-error="${name}"]`);
    if (message) message.textContent = '';
  }

  function announce(message) {
    elements.status.textContent = message;
    elements.status.hidden = false;
  }

  function formatMoney(value) { return money.format(value).replace(/\s/g, ' '); }
}());
