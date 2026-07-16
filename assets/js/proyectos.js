/* FreelanceFlow — Proyectos. Browser-only prototype; no backend or external APIs. */

(function projectsModule() {
  const DATA_URL = '../assets/data/mock-data.json';
  const STORAGE_KEY = 'freelanceflow_projects_v1';
  const DETAIL_QUERY = '(min-width: 1280px)';
  const model = window.FreelanceFlowProjectModel;

  const state = {
    clients: [],
    projects: [],
    invoices: [],
    expenses: [],
    timeEntries: [],
    categories: [],
    proposals: [],
    filters: { query: '', status: 'todos', billingMode: 'todas', clientId: 'todos' },
    selectedProjectId: null,
    detailTab: 'invoices',
    collapsedClients: new Set(),
    formMode: null,
    formDirty: false,
    lastTrigger: null,
    toastTimer: null
  };

  const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });
  const dateFormatter = new Intl.DateTimeFormat('es-EC', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const detailMedia = window.matchMedia(DETAIL_QUERY);
  let elements = {};

  document.addEventListener('DOMContentLoaded', initialize);

  async function initialize() {
    if (!model) {
      showFatalError(new Error('El modelo de proyectos no está disponible.'));
      return;
    }

    cacheElements();
    readFiltersFromUrl();
    bindEvents();
    syncFilterControls();
    await loadData();
  }

  function cacheElements() {
    elements = {
      layout: document.querySelector('[data-app-layout]'),
      createButton: document.getElementById('project-create-button'),
      retryButton: document.getElementById('projects-retry-button'),
      dataError: document.getElementById('projects-data-error'),
      loading: document.getElementById('projects-loading'),
      content: document.getElementById('projects-content'),
      groups: document.getElementById('project-groups'),
      emptyState: document.getElementById('projects-empty-state'),
      noResults: document.getElementById('projects-no-results'),
      resultsCount: document.getElementById('projects-results-count'),
      totalCount: document.getElementById('projects-total-count'),
      activeCount: document.getElementById('projects-active-count'),
      receivableTotal: document.getElementById('projects-receivable-total'),
      profitTotal: document.getElementById('projects-profit-total'),
      search: document.getElementById('project-search'),
      billingFilter: document.getElementById('project-billing-filter'),
      clientFilter: document.getElementById('project-client-filter'),
      clearFilters: document.getElementById('projects-clear-filters'),
      statusTabs: [...document.querySelectorAll('[data-project-status]')],
      detailPanel: document.getElementById('project-detail-panel'),
      detailBackdrop: document.getElementById('project-detail-backdrop'),
      detailClose: document.getElementById('project-detail-close'),
      detailTitle: document.getElementById('project-detail-title'),
      detailClient: document.getElementById('project-detail-client'),
      detailBody: document.getElementById('project-detail-body'),
      formDrawer: document.getElementById('project-form-drawer'),
      formBackdrop: document.getElementById('project-form-backdrop'),
      formClose: document.getElementById('project-form-close'),
      formTitle: document.getElementById('project-form-title'),
      formDescription: document.getElementById('project-form-description'),
      form: document.getElementById('project-form'),
      formSummary: document.getElementById('project-form-summary'),
      formCancel: document.getElementById('project-form-cancel'),
      submitButton: document.getElementById('project-submit-button'),
      formClient: document.getElementById('project-client'),
      formProposal: document.getElementById('project-proposal'),
      billingMode: document.getElementById('project-billing-mode'),
      fixedFields: document.getElementById('project-fixed-fields'),
      hourlyFields: document.getElementById('project-hourly-fields'),
      milestoneNote: document.getElementById('project-milestone-note'),
      toast: document.getElementById('project-toast')
    };
  }

  function bindEvents() {
    elements.createButton.addEventListener('click', (event) => openCreateForm(event.currentTarget));
    elements.retryButton.addEventListener('click', loadData);
    elements.search.addEventListener('input', () => {
      state.filters.query = elements.search.value;
      updateFilterUrl();
      renderDirectory();
    });
    elements.billingFilter.addEventListener('change', () => {
      state.filters.billingMode = elements.billingFilter.value;
      updateFilterUrl();
      renderDirectory();
    });
    elements.clientFilter.addEventListener('change', () => {
      state.filters.clientId = elements.clientFilter.value;
      updateFilterUrl();
      renderDirectory();
    });
    elements.statusTabs.forEach((tab) => tab.addEventListener('click', () => {
      state.filters.status = tab.dataset.projectStatus;
      syncFilterControls();
      updateFilterUrl();
      renderDirectory();
    }));
    elements.clearFilters.addEventListener('click', clearFilters);
    elements.groups.addEventListener('click', handleGroupAction);
    elements.content.addEventListener('click', handleContentAction);

    elements.detailClose.addEventListener('click', closeDetail);
    elements.detailBackdrop.addEventListener('click', closeDetail);
    elements.detailBody.addEventListener('click', handleDetailClick);
    elements.detailBody.addEventListener('change', handleDetailChange);

    elements.formClose.addEventListener('click', () => closeForm({ confirmDirty: true }));
    elements.formCancel.addEventListener('click', () => closeForm({ confirmDirty: true }));
    elements.formBackdrop.addEventListener('click', () => closeForm({ confirmDirty: true }));
    elements.form.addEventListener('submit', handleFormSubmit);
    elements.form.addEventListener('input', () => { state.formDirty = true; });
    elements.form.addEventListener('change', () => { state.formDirty = true; });
    elements.form.addEventListener('focusout', validateFieldOnBlur);
    elements.billingMode.addEventListener('change', syncBillingFields);
    elements.formDrawer.addEventListener('keydown', trapFormFocus);
    elements.detailPanel.addEventListener('keydown', trapDetailFocus);

    document.addEventListener('keydown', handleGlobalKeydown);
    detailMedia.addEventListener('change', handleDetailViewportChange);
    window.addEventListener('popstate', () => {
      readFiltersFromUrl();
      syncFilterControls();
      renderDirectory();
    });
  }

  async function loadData() {
    showLoadingState();
    try {
      const data = await window.FreelanceFlowDataLoader.loadJson(DATA_URL);
      state.clients = Array.isArray(data.clientes) ? data.clientes : [];
      state.invoices = Array.isArray(data.facturas) ? data.facturas : [];
      state.expenses = Array.isArray(data.gastos) ? data.gastos : [];
      state.timeEntries = Array.isArray(data.registros_tiempo) ? data.registros_tiempo : [];
      state.categories = Array.isArray(data.categorias_gasto) ? data.categorias_gasto : [];
      state.proposals = window.FreelanceFlowProposalModel
        ? window.FreelanceFlowProposalModel.mergeProposals(Array.isArray(data.propuestas) ? data.propuestas : [], readStoredProposals())
        : (Array.isArray(data.propuestas) ? data.propuestas : []);
      state.projects = model.mergeProjects(
        Array.isArray(data.proyectos) ? data.proyectos : [],
        readStoredProjects()
      );
      reconcileProposalConversions();

      populateClientControls();
      populateProposalOptions();
      const requestedProject = new URLSearchParams(window.location.search).get('proyecto');
      state.selectedProjectId = state.projects.some((project) => project.id === requestedProject)
        ? requestedProject
        : shouldAutoSelectDetail()
          ? state.projects[0]?.id ?? null
          : null;
      renderAll();
      elements.loading.hidden = true;
      elements.content.hidden = false;
      elements.dataError.hidden = true;
      openProposalConversionIfRequested();
    } catch (error) {
      showFatalError(error);
    }
  }

  function readStoredProjects() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readStoredProposals() {
    try {
      const parsed = JSON.parse(localStorage.getItem('freelanceflow_proposals_v1') || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  function openProposalConversionIfRequested() {
    const requested = new URLSearchParams(window.location.search).get('proposal');
    let draft = null;
    try { draft = JSON.parse(sessionStorage.getItem('freelanceflow_proposal_conversion_v1') || 'null'); } catch { draft = null; }
    if (!requested || !draft || draft.propuesta_origen !== requested) return;
    const proposal = state.proposals.find((item) => item.id === requested);
    if (!proposal || proposal.estado !== 'ACCEPTED' || proposal.proyecto_convertido_id || state.projects.some((project) => project.propuesta_origen === requested)) return;
    openCreateForm(null, draft.cliente_id);
    setFormValue('project-proposal', draft.propuesta_origen);
    setFormValue('project-name', draft.nombre_proyecto);
    setFormValue('project-description', draft.descripcion);
    setFormValue('project-fixed-amount', draft.monto_fijo);
  }

  function reconcileProposalConversions() {
    if (!window.FreelanceFlowProposalModel) return;
    let changed = false;
    state.proposals = state.proposals.map((proposal) => {
      const project = state.projects.find((item) => item.propuesta_origen === proposal.id);
      if (!project || proposal.estado !== 'ACCEPTED' || proposal.proyecto_convertido_id) return proposal;
      changed = true;
      return window.FreelanceFlowProposalModel.completeConversion(proposal, project.id);
    });
    if (changed) localStorage.setItem('freelanceflow_proposals_v1', JSON.stringify(state.proposals));
  }

  function saveProjects() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.projects));
    } catch {
      showToast('Los cambios se aplicaron en esta sesión, pero no pudieron guardarse localmente.', 'warning');
    }
  }

  function showLoadingState() {
    elements.loading.hidden = false;
    elements.content.hidden = true;
    elements.dataError.hidden = true;
    elements.resultsCount.textContent = 'Cargando proyectos…';
  }

  function showFatalError(error) {
    console.error('No se pudo cargar Proyectos:', error);
    if (!elements.dataError) return;
    elements.loading.hidden = true;
    elements.content.hidden = true;
    elements.dataError.hidden = false;
    elements.resultsCount.textContent = 'No se pudo cargar la cartera';
  }

  function renderAll() {
    renderSummary();
    renderDirectory();
  }

  function renderSummary() {
    const totals = state.projects.reduce((result, project) => {
      const metrics = getMetrics(project);
      result.receivable += metrics.receivable;
      result.profit += metrics.profit;
      return result;
    }, { receivable: 0, profit: 0 });

    elements.totalCount.textContent = String(state.projects.length);
    elements.activeCount.textContent = String(state.projects.filter((project) => project.estado === 'ACTIVE').length);
    elements.receivableTotal.textContent = formatMoney(totals.receivable);
    elements.profitTotal.textContent = formatMoney(totals.profit);
  }

  function renderDirectory() {
    const filtered = getFilteredProjects();
    const hasFilters = Boolean(state.filters.query.trim())
      || state.filters.status !== 'todos'
      || state.filters.billingMode !== 'todas'
      || state.filters.clientId !== 'todos';
    let groups = model.groupProjectsByClient(state.clients, filtered, metricData());
    if (hasFilters) groups = groups.filter((group) => group.projects.length > 0);

    if (filtered.length && !filtered.some((project) => project.id === state.selectedProjectId)) {
      state.selectedProjectId = shouldAutoSelectDetail() ? filtered[0].id : null;
      updateSelectedProjectUrl();
    }
    if (!filtered.length && hasFilters) state.selectedProjectId = null;

    elements.groups.innerHTML = groups.map(renderClientGroup).join('');
    elements.emptyState.hidden = state.projects.length !== 0;
    elements.noResults.hidden = state.projects.length === 0 || filtered.length !== 0;
    elements.clearFilters.hidden = !hasFilters;
    elements.resultsCount.textContent = resultCountCopy(filtered.length);
    renderDetail();
  }

  function renderClientGroup(group) {
    const { client, projects } = group;
    const collapsed = state.collapsedClients.has(String(client.id));
    const isActive = client.estado !== 'inactivo';
    const allProjects = state.projects.filter((project) => project.cliente_id === String(client.id));
    const outstanding = allProjects.reduce((sum, project) => sum + getMetrics(project).receivable, 0);
    const fullName = `${client.nombres ?? ''} ${client.apellidos ?? ''}`.trim();

    return `
      <section class="project-client-group${collapsed ? ' is-collapsed' : ''}" aria-labelledby="client-projects-${escapeAttribute(client.id)}">
        <header class="project-client-header">
          <div class="project-client-identity">
            <span aria-hidden="true">${initials(client.nombre_razon_social)}</span>
            <div>
              <div class="project-client-title-row">
                <h3 id="client-projects-${escapeAttribute(client.id)}">${escapeHtml(client.nombre_razon_social)}</h3>
                <span class="project-client-status project-client-status-${isActive ? 'active' : 'inactive'}">${isActive ? 'Activo' : 'Inactivo'}</span>
              </div>
              <p>${escapeHtml(fullName || 'Contacto no registrado')} · ${escapeHtml(client.tipo_cliente || 'Cliente')}</p>
            </div>
          </div>
          <dl class="project-client-summary">
            <div><dt>Proyectos</dt><dd>${allProjects.length}</dd></div>
            <div><dt>Saldo pendiente</dt><dd>${formatMoney(outstanding)}</dd></div>
          </dl>
          <button class="project-collapse-button" type="button" data-action="toggle-client" data-client-id="${escapeAttribute(client.id)}" aria-expanded="${String(!collapsed)}" aria-label="${collapsed ? 'Expandir' : 'Contraer'} proyectos de ${escapeAttribute(client.nombre_razon_social)}">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </header>
        <div class="project-client-body"${collapsed ? ' hidden' : ''}>
          ${projects.length ? `<div class="project-card-list">${projects.map(renderProjectCard).join('')}</div>` : renderClientEmpty(client)}
          <footer class="project-client-footer">
            <button class="projects-client-action" type="button" data-action="create-project-for-client" data-client-id="${escapeAttribute(client.id)}"${isActive ? '' : ' disabled'}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
              ${isActive ? 'Crear proyecto para este cliente' : 'Cliente inactivo'}
            </button>
            ${isActive ? '' : '<p>Activa este cliente para registrar un proyecto nuevo.</p>'}
          </footer>
        </div>
      </section>`;
  }

  function renderClientEmpty(client) {
    const active = client.estado !== 'inactivo';
    return `
      <div class="project-client-empty">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h6l2 2h8v10H4V7Zm8 5v5m-2.5-2.5h5"/></svg>
        <div><strong>Este cliente aún no tiene proyectos.</strong><p>${active ? 'Crea el primero para vincular trabajo y finanzas.' : 'Reactívalo desde Clientes para comenzar uno nuevo.'}</p></div>
      </div>`;
  }

  function renderProjectCard(project) {
    const metrics = project.metrics ?? getMetrics(project);
    const selected = project.id === state.selectedProjectId;
    const progress = getProgress(project, metrics);
    const modeValue = project.modalidad_cobro === 'Tarifa fija'
      ? formatMoney(project.monto_fijo)
      : project.modalidad_cobro === 'Por horas'
        ? `${formatMoney(project.tarifa_hora)}/h`
        : 'Según facturas';
    const primaryMetricLabel = project.modalidad_cobro === 'Tarifa fija'
      ? 'Monto fijo'
      : project.modalidad_cobro === 'Por horas'
        ? 'Tarifa'
        : 'Modalidad';
    const valueMetric = project.modalidad_cobro === 'Por horas'
      ? `<div><dt>Valor trabajado</dt><dd>${formatMoney(metrics.estimatedValue)}</dd></div>`
      : '';

    return `
      <article class="project-card${selected ? ' is-selected' : ''}" data-project-id="${escapeAttribute(project.id)}">
        <header>
          <div>
            <div class="project-card-badges">
              <span class="project-mode-badge">${escapeHtml(project.modalidad_cobro)}</span>
              ${renderProjectStatus(project.estado)}
            </div>
            <h4>${escapeHtml(project.nombre_proyecto)}</h4>
            <p>${formatProjectDates(project)}</p>
          </div>
          <button class="project-icon-button" type="button" data-action="edit-project" data-project-id="${escapeAttribute(project.id)}" aria-label="Editar ${escapeAttribute(project.nombre_proyecto)}">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 16-1 5 5-1L19 9l-4-4L4 16ZM13.5 6.5l4 4"/></svg>
          </button>
        </header>
        <div class="project-progress-block">
          <div><span>${escapeHtml(progress.label)}</span><strong>${progress.value === null ? 'Sin datos' : `${formatNumber(progress.value, 0)}%`}</strong></div>
          <div class="project-progress-track" role="progressbar" aria-label="${escapeAttribute(progress.label)} de ${escapeAttribute(project.nombre_proyecto)}" aria-valuemin="0" aria-valuemax="100"${progress.value === null ? '' : ` aria-valuenow="${escapeAttribute(progress.value)}"`}><span style="width:${progress.value ?? 0}%"></span></div>
          <p class="project-collection-line">${renderCollectionSummary(metrics)}</p>
        </div>
        ${renderFinancialInsight(project, metrics)}
        <dl class="project-card-metrics${project.modalidad_cobro === 'Por horas' ? ' is-hourly' : ''}">
          <div><dt>${primaryMetricLabel}</dt><dd>${escapeHtml(modeValue)}</dd></div>
          ${valueMetric}
          <div><dt>Facturado</dt><dd>${formatMoney(metrics.invoiced)}</dd></div>
          <div><dt>Cobrado</dt><dd class="project-positive">${formatMoney(metrics.paid)}</dd></div>
          <div><dt>Por cobrar</dt><dd class="${metrics.receivable > 0 ? 'project-negative' : ''}">${formatMoney(metrics.receivable)}</dd></div>
        </dl>
        ${project.modalidad_cobro === 'Por horas' ? `<p class="project-hours-line"><strong>${formatNumber(metrics.hours)} h</strong> registradas${project.presupuesto_horas_estimado ? ` de ${formatNumber(project.presupuesto_horas_estimado)} h estimadas` : ''}</p>` : ''}
        <footer>
          <button class="projects-secondary-action" type="button" data-action="view-project" data-project-id="${escapeAttribute(project.id)}" aria-expanded="${String(selected)}">Ver detalle</button>
        </footer>
      </article>`;
  }

  function renderDetail() {
    const project = findProject(state.selectedProjectId);
    if (!project) {
      setDetailOpen(false);
      return;
    }
    const client = findClient(project.cliente_id);
    const metrics = getMetrics(project);
    elements.detailTitle.textContent = project.nombre_proyecto;
    elements.detailClient.textContent = client?.nombre_razon_social || 'Cliente no disponible';
    elements.detailBody.innerHTML = renderDetailContent(project, client, metrics);
    setDetailOpen(true);
  }

  function renderDetailContent(project, client, metrics) {
    return `
      <div class="project-detail-meta">
        ${renderProjectStatus(project.estado)}
        <span class="project-mode-badge">${escapeHtml(project.modalidad_cobro)}</span>
        <span>${escapeHtml(formatProjectDates(project))}</span>
      </div>

      <div class="project-detail-controls">
        <label>Estado
          <select id="project-detail-status" aria-label="Cambiar estado de ${escapeAttribute(project.nombre_proyecto)}"${project.estado === 'COMPLETED' ? ' disabled' : ''}>
            ${statusOptions(project.estado)}
          </select>
        </label>
        <button class="projects-primary-action" type="button" data-action="edit-selected-project">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m4 16-1 5 5-1L19 9l-4-4L4 16ZM13.5 6.5l4 4"/></svg>
          Editar
        </button>
      </div>
      ${project.estado === 'COMPLETED' ? '<p class="project-detail-note">La reactivación de proyectos completados se definirá en una fase posterior.</p>' : ''}
      ${renderDetailFinancialSummary(project, metrics)}

      <section class="project-detail-metrics" aria-label="Métricas financieras del proyecto">
        ${detailMetric(project.modalidad_cobro === 'Por horas' ? 'Valor trabajado estimado' : 'Valor estimado', formatMoney(metrics.estimatedValue), 'teal')}
        ${detailMetric('Pendiente de facturar', formatMoney(metrics.unbilledValue), metrics.unbilledValue > 0 ? 'warning' : 'neutral')}
        ${detailMetric('Facturado', formatMoney(metrics.invoiced), 'neutral')}
        ${detailMetric('Cobrado', formatMoney(metrics.paid), 'positive')}
        ${detailMetric('Por cobrar', formatMoney(metrics.receivable), metrics.receivable > 0 ? 'negative' : 'neutral')}
        ${detailMetric('Gastos', formatMoney(metrics.expenses), metrics.expenses > 0 ? 'negative' : 'neutral')}
        ${detailMetric('Resultado sobre facturado', metrics.invoiced > 0 ? formatMoney(metrics.profit) : 'Sin datos', metrics.profit >= 0 ? 'teal' : 'negative')}
        ${detailMetric('Horas', `${formatNumber(metrics.hours)} h`, 'neutral')}
      </section>

      <div class="project-detail-tabs" role="tablist" aria-label="Información del proyecto">
        ${detailTabButton('invoices', `Facturas (${metrics.invoiceCount})`)}
        ${detailTabButton('expenses', 'Gastos')}
        ${detailTabButton('time', 'Tiempo')}
        ${detailTabButton('details', 'Detalles')}
      </div>
      <section id="project-tab-panel" class="project-tab-panel" role="tabpanel" tabindex="0" aria-labelledby="project-tab-${escapeAttribute(state.detailTab)}">
        ${renderDetailTab(project, client, metrics)}
      </section>`;
  }

  function renderDetailTab(project, client, metrics) {
    if (state.detailTab === 'invoices') return renderInvoiceTab(metrics);
    if (state.detailTab === 'expenses') return renderExpenseTab(metrics);
    if (state.detailTab === 'time') return renderTimeTab(metrics);
    return renderProjectInfoTab(project, client);
  }

  function renderInvoiceTab(metrics) {
    if (!metrics.invoices.length) return renderDetailEmpty('Este proyecto no tiene facturas asociadas.', 'Crea una factura cuando el trabajo esté listo para cobrar.', 'Nueva factura', 'facturas.html');
    return `
      <div class="project-detail-list">
        ${metrics.invoices.map((invoice) => `
          <article>
            <div><strong>${escapeHtml(invoice.numero_factura || invoice.id)}</strong><p>${formatDate(invoice.fecha_emision)} · ${invoiceStatusLabel(invoice.estado)}</p></div>
            <div><strong>${formatMoney(invoice.total_factura)}</strong><small>${invoice.saldo_pendiente > 0 ? `${formatMoney(invoice.saldo_pendiente)} pendientes` : 'Sin saldo pendiente'}</small></div>
          </article>`).join('')}
      </div>
      <a class="projects-secondary-action project-detail-link" href="facturas.html">Gestionar facturas</a>`;
  }

  function renderExpenseTab(metrics) {
    if (!metrics.expensesList.length) return renderDetailEmpty('Este proyecto no tiene gastos asociados.', 'Registra gastos para obtener una rentabilidad más precisa.', 'Registrar gasto', 'transacciones.html#transaction-form-panel');
    return `
      <div class="project-detail-list">
        ${metrics.expensesList.map((expense) => `
          <article>
            <div><strong>${escapeHtml(expense.descripcion || categoryName(expense.categoria_gasto_id))}</strong><p>${formatDate(expense.fecha_gasto)} · ${escapeHtml(categoryName(expense.categoria_gasto_id))}</p></div>
            <div><strong class="project-negative">${formatMoney(expense.monto)}</strong><small>${expense.es_deducible ? 'Deducible' : 'No deducible'}</small></div>
          </article>`).join('')}
      </div>`;
  }

  function renderTimeTab(metrics) {
    if (!metrics.timeEntries.length) return renderDetailEmpty('Aún no se ha registrado tiempo en este proyecto.', 'Añade horas para comparar el esfuerzo real con el presupuesto.', 'Registrar tiempo', 'transacciones.html');
    return `
      <div class="project-detail-list">
        ${metrics.timeEntries.map((entry) => `
          <article>
            <div><strong>${escapeHtml(entry.descripcion_actividad || 'Trabajo registrado')}</strong><p>${formatDate(entry.fecha_trabajo)} · ${entry.facturable ? 'Facturable' : 'No facturable'}</p></div>
            <div><strong>${formatNumber(entry.horas_trabajadas)} h</strong></div>
          </article>`).join('')}
      </div>`;
  }

  function renderProjectInfoTab(project, client) {
    return `
      <dl class="project-info-grid">
        <div><dt>Cliente</dt><dd>${escapeHtml(client?.nombre_razon_social || 'No disponible')}</dd></div>
        <div><dt>Modalidad</dt><dd>${escapeHtml(project.modalidad_cobro)}</dd></div>
        <div><dt>Inicio</dt><dd>${formatDate(project.fecha_inicio)}</dd></div>
        <div><dt>Fin estimado</dt><dd>${project.fecha_fin_estimada ? formatDate(project.fecha_fin_estimada) : 'Sin fecha definida'}</dd></div>
        <div><dt>Propuesta de origen</dt><dd>${escapeHtml(project.propuesta_origen || 'Sin propuesta vinculada')}</dd></div>
        <div><dt>Presupuesto de horas</dt><dd>${project.presupuesto_horas_estimado ? `${formatNumber(project.presupuesto_horas_estimado)} h` : 'Sin presupuesto'}</dd></div>
      </dl>
      <div class="project-description-block"><h3>Descripción</h3><p>${escapeHtml(project.descripcion || 'Este proyecto todavía no tiene una descripción.')}</p></div>`;
  }

  function renderDetailEmpty(title, copy, action, href) {
    return `<div class="project-tab-empty"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h6l2 2h8v10H4V7"/></svg><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p><a class="projects-secondary-action" href="${escapeAttribute(href)}">${escapeHtml(action)}</a></div>`;
  }

  function handleGroupAction(event) {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    if (action === 'toggle-client') toggleClient(trigger.dataset.clientId);
    if (action === 'create-project-for-client') openCreateForm(trigger, trigger.dataset.clientId);
    if (action === 'view-project') selectProject(trigger.dataset.projectId, trigger);
    if (action === 'edit-project') openEditForm(trigger.dataset.projectId, trigger);
  }

  function handleContentAction(event) {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    if (trigger.dataset.action === 'create-project') openCreateForm(trigger);
    if (trigger.dataset.action === 'clear-project-filters') clearFilters();
  }

  function handleDetailClick(event) {
    const tab = event.target.closest('[data-project-tab]');
    if (tab) {
      state.detailTab = tab.dataset.projectTab;
      renderDetail();
      document.getElementById(`project-tab-${state.detailTab}`)?.focus();
      return;
    }
    const trigger = event.target.closest('[data-action]');
    if (trigger?.dataset.action === 'edit-selected-project') {
      openEditForm(state.selectedProjectId, trigger);
    }
  }

  function handleDetailChange(event) {
    if (event.target.id !== 'project-detail-status') return;
    const project = findProject(state.selectedProjectId);
    if (!project || project.estado === 'COMPLETED') return;
    const nextStatus = event.target.value;
    if (!model.PROJECT_STATES.includes(nextStatus)) return;
    state.projects = state.projects.map((item) => item.id === project.id ? { ...item, estado: nextStatus } : item);
    saveProjects();
    renderAll();
    showToast('Estado del proyecto actualizado.', 'success');
  }

  function toggleClient(clientId) {
    const id = String(clientId);
    if (state.collapsedClients.has(id)) state.collapsedClients.delete(id);
    else state.collapsedClients.add(id);
    renderDirectory();
  }

  function selectProject(projectId, trigger) {
    const project = findProject(projectId);
    if (!project) return;
    state.selectedProjectId = project.id;
    state.detailTab = 'invoices';
    state.lastTrigger = trigger;
    updateSelectedProjectUrl();
    renderDirectory();
    requestAnimationFrame(() => elements.detailTitle.focus?.());
  }

  function setDetailOpen(open) {
    elements.detailPanel.classList.toggle('is-open', open);
    elements.content.classList.toggle('has-detail', open);
    elements.detailPanel.setAttribute('aria-hidden', String(!open));
    elements.detailPanel.toggleAttribute('inert', !open);
    syncDetailPresentation();
  }

  function syncDetailPresentation() {
    const open = elements.detailPanel.classList.contains('is-open');
    const compact = !detailMedia.matches;
    elements.detailBackdrop.classList.toggle('is-open', open && compact);
    document.body.classList.toggle('project-detail-modal-open', open && compact);
    if (open && compact) {
      elements.detailPanel.setAttribute('role', 'dialog');
      elements.detailPanel.setAttribute('aria-modal', 'true');
      document.querySelector('.projects-master-column')?.setAttribute('inert', '');
    } else {
      elements.detailPanel.removeAttribute('role');
      elements.detailPanel.removeAttribute('aria-modal');
      document.querySelector('.projects-master-column')?.removeAttribute('inert');
      elements.detailBackdrop.classList.remove('is-open');
    }
  }

  function handleDetailViewportChange() {
    if (shouldAutoSelectDetail() && !state.selectedProjectId) {
      const [firstProject] = getFilteredProjects();
      if (firstProject) {
        state.selectedProjectId = firstProject.id;
        updateSelectedProjectUrl();
        renderDirectory();
        return;
      }
    }
    syncDetailPresentation();
  }

  function shouldAutoSelectDetail() {
    return detailMedia.matches;
  }

  function getFilteredProjects() {
    return model.filterProjects(state.projects, state.clients, state.filters);
  }

  function closeDetail() {
    state.selectedProjectId = null;
    updateSelectedProjectUrl();
    setDetailOpen(false);
    elements.groups.querySelectorAll('.project-card.is-selected').forEach((card) => card.classList.remove('is-selected'));
    state.lastTrigger?.focus();
  }

  function openCreateForm(trigger, clientId = '') {
    state.formMode = 'create';
    state.lastTrigger = trigger;
    elements.form.reset();
    clearFormErrors();
    populateProjectClientOptions(clientId, false);
    setFormValue('project-id', '');
    setFormValue('project-start-date', getTodayDate());
    elements.formTitle.textContent = 'Nuevo proyecto';
    elements.formDescription.textContent = clientId
      ? `Crea un proyecto para ${findClient(clientId)?.nombre_razon_social || 'este cliente'}.`
      : 'Define el cliente, las fechas y la modalidad de cobro.';
    elements.submitButton.textContent = 'Guardar proyecto';
    syncBillingFields();
    openFormPanel();
  }

  function openEditForm(projectId, trigger) {
    const project = findProject(projectId);
    if (!project) return;
    state.formMode = 'edit';
    state.lastTrigger = trigger;
    elements.form.reset();
    clearFormErrors();
    populateProjectClientOptions(project.cliente_id, true);
    setFormValue('project-id', project.id);
    setFormValue('project-name', project.nombre_proyecto);
    setFormValue('project-client', project.cliente_id);
    setFormValue('project-proposal', project.propuesta_origen);
    setFormValue('project-description', project.descripcion);
    setFormValue('project-start-date', project.fecha_inicio);
    setFormValue('project-end-date', project.fecha_fin_estimada);
    setFormValue('project-hours-budget', project.presupuesto_horas_estimado || '');
    setFormValue('project-billing-mode', project.modalidad_cobro);
    setFormValue('project-fixed-amount', project.monto_fijo || '');
    setFormValue('project-hourly-rate', project.tarifa_hora || '');
    elements.formTitle.textContent = 'Editar proyecto';
    elements.formDescription.textContent = 'Actualiza la planificación sin alterar su historial financiero.';
    elements.submitButton.textContent = 'Guardar cambios';
    syncBillingFields();
    openFormPanel();
  }

  function openFormPanel() {
    state.formDirty = false;
    elements.formDrawer.classList.add('is-open');
    elements.formBackdrop.classList.add('is-open');
    elements.formDrawer.removeAttribute('inert');
    elements.formDrawer.setAttribute('aria-hidden', 'false');
    elements.layout.setAttribute('inert', '');
    document.querySelector('.app-bottom-navigation')?.setAttribute('inert', '');
    document.body.classList.add('project-form-open');
    requestAnimationFrame(() => document.getElementById('project-name')?.focus());
  }

  function closeForm({ confirmDirty = false } = {}) {
    if (confirmDirty && state.formDirty && !window.confirm('¿Descartar los cambios de este proyecto?')) return;
    elements.formDrawer.classList.remove('is-open');
    elements.formBackdrop.classList.remove('is-open');
    elements.formDrawer.setAttribute('aria-hidden', 'true');
    elements.formDrawer.setAttribute('inert', '');
    elements.layout.removeAttribute('inert');
    document.querySelector('.app-bottom-navigation')?.removeAttribute('inert');
    document.body.classList.remove('project-form-open');
    state.formDirty = false;
    state.formMode = null;
    state.lastTrigger?.focus();
  }

  function syncBillingFields() {
    const mode = elements.billingMode.value;
    const fixed = mode === 'Tarifa fija';
    const hourly = mode === 'Por horas';
    elements.fixedFields.hidden = !fixed;
    elements.hourlyFields.hidden = !hourly;
    elements.milestoneNote.hidden = mode !== 'Por hitos';
    document.getElementById('project-fixed-amount').required = fixed;
    document.getElementById('project-hourly-rate').required = hourly;
  }

  function handleFormSubmit(event) {
    event.preventDefault();
    const draft = readForm();
    const validation = model.validateProject(draft, state.clients);
    clearFormErrors();

    if (!validation.valid) {
      Object.entries(validation.errors).forEach(([field, message]) => setFieldError(field, message));
      elements.formSummary.textContent = 'Revisa los campos señalados antes de guardar.';
      elements.formSummary.hidden = false;
      elements.form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    elements.submitButton.disabled = true;
    elements.submitButton.textContent = draft.id ? 'Guardando…' : 'Creando…';
    let savedProject;

    if (draft.id) {
      const existing = findProject(draft.id);
      savedProject = model.normalizeProject({ ...existing, ...draft, estado: existing.estado });
      state.projects = state.projects.map((project) => project.id === draft.id ? savedProject : project);
    } else {
      savedProject = model.createProjectRecord(draft, { id: generateProjectId() });
      state.projects.unshift(savedProject);
    }

    saveProjects();
    completeProposalConversion(savedProject);
    state.selectedProjectId = savedProject.id;
    updateSelectedProjectUrl();
    renderAll();
    state.formDirty = false;
    closeForm();
    recordActivity('Proyectos', draft.id ? 'Proyecto actualizado' : 'Proyecto creado', `${savedProject.nombre_proyecto}.`);
    showToast(draft.id ? 'Proyecto actualizado correctamente.' : 'Proyecto creado correctamente.', 'success');
    elements.submitButton.disabled = false;
    elements.submitButton.textContent = draft.id ? 'Guardar cambios' : 'Guardar proyecto';
  }

  function recordActivity(module, action, description) {
    window.FreelanceFlowActivity?.record({ module, action, description });
  }

  function readForm() {
    const data = new FormData(elements.form);
    return {
      id: String(data.get('id') ?? '').trim(),
      nombre_proyecto: String(data.get('nombre_proyecto') ?? '').trim(),
      cliente_id: String(data.get('cliente_id') ?? '').trim(),
      propuesta_origen: String(data.get('propuesta_origen') ?? '').trim(),
      descripcion: String(data.get('descripcion') ?? '').trim(),
      fecha_inicio: String(data.get('fecha_inicio') ?? '').trim(),
      fecha_fin_estimada: String(data.get('fecha_fin_estimada') ?? '').trim(),
      modalidad_cobro: String(data.get('modalidad_cobro') ?? '').trim(),
      tarifa_hora: String(data.get('tarifa_hora') ?? '').trim(),
      monto_fijo: String(data.get('monto_fijo') ?? '').trim(),
      presupuesto_horas_estimado: String(data.get('presupuesto_horas_estimado') ?? '').trim()
    };
  }

  function validateFieldOnBlur(event) {
    const field = event.target.closest('input, select, textarea');
    if (!field?.name || ['id', 'propuesta_origen', 'descripcion'].includes(field.name)) return;
    const validation = model.validateProject(readForm(), state.clients);
    setFieldError(field.name, validation.errors[field.name] ?? '');
  }

  function clearFormErrors() {
    elements.formSummary.hidden = true;
    elements.formSummary.textContent = '';
    elements.form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    });
    elements.form.querySelectorAll('.has-error').forEach((wrapper) => wrapper.classList.remove('has-error'));
    elements.form.querySelectorAll('[data-field-error]').forEach((error) => { error.textContent = ''; });
  }

  function setFieldError(fieldName, message) {
    const field = elements.form.elements.namedItem(fieldName);
    const error = elements.form.querySelector(`[data-field-error="${fieldName}"]`);
    if (!(field instanceof HTMLElement) || !error) return;
    if (!error.id) error.id = `project-${fieldName}-error`;
    error.textContent = message;
    field.closest('.project-field, .project-form-section')?.classList.toggle('has-error', Boolean(message));
    if (message) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', error.id);
    } else {
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    }
  }

  function populateClientControls() {
    const sorted = [...state.clients].sort((first, second) => String(first.nombre_razon_social).localeCompare(String(second.nombre_razon_social), 'es'));
    elements.clientFilter.innerHTML = '<option value="todos">Todos los clientes</option>'
      + sorted.map((client) => `<option value="${escapeAttribute(client.id)}">${escapeHtml(client.nombre_razon_social)}</option>`).join('');
    elements.clientFilter.value = sorted.some((client) => client.id === state.filters.clientId) ? state.filters.clientId : 'todos';
  }

  function populateProjectClientOptions(selectedId = '', editing = false) {
    const options = state.clients.filter((client) => client.estado !== 'inactivo' || (editing && String(client.id) === String(selectedId)));
    elements.formClient.innerHTML = '<option value="">Selecciona un cliente</option>'
      + options.map((client) => `<option value="${escapeAttribute(client.id)}"${String(client.id) === String(selectedId) ? ' selected' : ''}>${escapeHtml(client.nombre_razon_social)}${client.estado === 'inactivo' ? ' — Inactivo' : ''}</option>`).join('');
  }

  function populateProposalOptions() {
    const selectedId = elements.formProposal.value;
    elements.formProposal.innerHTML = '<option value="">Sin propuesta vinculada</option>'
      + state.proposals.filter((proposal) => (proposal.estado === 'ACCEPTED' && !proposal.proyecto_convertido_id) || proposal.id === selectedId).map((proposal) => `<option value="${escapeAttribute(proposal.id)}">${escapeHtml(proposal.titulo_propuesta || proposal.id)}</option>`).join('');
  }

  function completeProposalConversion(project) {
    const proposalId = String(project.propuesta_origen || '');
    if (!proposalId || !window.FreelanceFlowProposalModel) return;
    const proposal = state.proposals.find((item) => item.id === proposalId);
    if (!proposal || proposal.estado !== 'ACCEPTED' || proposal.proyecto_convertido_id) return;
    try {
      const converted = window.FreelanceFlowProposalModel.completeConversion(proposal, project.id);
      state.proposals = state.proposals.map((item) => item.id === proposalId ? converted : item);
      localStorage.setItem('freelanceflow_proposals_v1', JSON.stringify(state.proposals));
      sessionStorage.removeItem('freelanceflow_proposal_conversion_v1');
      recordActivity('Propuestas', 'Propuesta convertida', `${proposalId}: ${project.id}.`);
      showToast('Proyecto creado desde la propuesta.', 'success');
    } catch { /* A second save cannot convert the proposal again. */ }
  }

  function clearFilters() {
    state.filters = { query: '', status: 'todos', billingMode: 'todas', clientId: 'todos' };
    syncFilterControls();
    updateFilterUrl();
    renderDirectory();
    elements.search.focus();
  }

  function readFiltersFromUrl() {
    const params = new URLSearchParams(window.location.search);
    state.filters.query = params.get('q') ?? '';
    const status = params.get('estado') ?? 'todos';
    state.filters.status = ['todos', ...model.PROJECT_STATES].includes(status) ? status : 'todos';
    const billingMode = params.get('modalidad') ?? 'todas';
    state.filters.billingMode = ['todas', ...model.BILLING_MODES].includes(billingMode) ? billingMode : 'todas';
    state.filters.clientId = params.get('cliente') ?? 'todos';
    state.selectedProjectId = params.get('proyecto');
  }

  function syncFilterControls() {
    if (!elements.search) return;
    elements.search.value = state.filters.query;
    elements.billingFilter.value = state.filters.billingMode;
    if ([...elements.clientFilter.options].some((option) => option.value === state.filters.clientId)) {
      elements.clientFilter.value = state.filters.clientId;
    }
    elements.statusTabs.forEach((tab) => {
      const active = tab.dataset.projectStatus === state.filters.status;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-pressed', String(active));
    });
  }

  function updateFilterUrl() {
    const url = new URL(window.location.href);
    setOrDelete(url, 'q', state.filters.query.trim());
    setOrDelete(url, 'estado', state.filters.status === 'todos' ? '' : state.filters.status);
    setOrDelete(url, 'modalidad', state.filters.billingMode === 'todas' ? '' : state.filters.billingMode);
    setOrDelete(url, 'cliente', state.filters.clientId === 'todos' ? '' : state.filters.clientId);
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function updateSelectedProjectUrl() {
    const url = new URL(window.location.href);
    setOrDelete(url, 'proyecto', state.selectedProjectId || '');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function setOrDelete(url, key, value) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }

  function handleGlobalKeydown(event) {
    if (event.key !== 'Escape') return;
    if (elements.formDrawer.classList.contains('is-open')) closeForm({ confirmDirty: true });
    else if (elements.detailPanel.classList.contains('is-open') && !detailMedia.matches) closeDetail();
  }

  function trapFormFocus(event) {
    trapFocus(event, elements.formDrawer);
  }

  function trapDetailFocus(event) {
    if (detailMedia.matches) return;
    trapFocus(event, elements.detailPanel);
  }

  function trapFocus(event, container) {
    if (event.key !== 'Tab') return;
    const focusable = [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')]
      .filter((item) => !item.closest('[hidden]'));
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function getMetrics(project) {
    return model.calculateProjectMetrics(project, metricData());
  }

  function metricData() {
    return { invoices: state.invoices, expenses: state.expenses, timeEntries: state.timeEntries };
  }

  function renderCollectionSummary(metrics) {
    if (!metrics.invoiceCount) return 'Sin facturas emitidas todavía.';
    if (metrics.receivable <= 0) return 'Cobro completo sobre la facturación emitida.';
    return `Cobro recibido: ${formatNumber(metrics.collectionProgress, 0)}% · ${formatMoney(metrics.receivable)} por cobrar.`;
  }

  function renderFinancialInsight(project, metrics) {
    let title = '';
    let copy = '';
    let tone = 'info';

    if (metrics.financialStatus === 'completed_without_invoice') {
      title = 'Completado sin facturas';
      copy = `${formatMoney(metrics.unbilledValue)} de trabajo estimado está pendiente de facturar.`;
      tone = 'warning';
    } else if (metrics.invoicedAboveLoggedWork) {
      title = 'Revisa horas y facturas';
      copy = `La facturación supera en ${formatMoney(metrics.invoiceValueDifference)} el valor calculado con las horas registradas. Puede haber conceptos adicionales o tiempo pendiente de registrar.`;
    } else if (metrics.financialStatus === 'work_not_invoiced' || metrics.financialStatus === 'partially_invoiced') {
      title = 'Trabajo pendiente de facturar';
      copy = `${formatMoney(metrics.unbilledValue)} todavía no está respaldado por facturas emitidas.`;
      tone = 'warning';
    } else if (metrics.receivable > 0) {
      title = 'Cobro pendiente';
      copy = `${formatMoney(metrics.receivable)} sigue pendiente sobre la facturación emitida.`;
    } else if (metrics.financialStatus === 'collected') {
      title = 'Facturación cobrada';
      copy = 'No hay saldo pendiente en las facturas de este proyecto.';
      tone = 'success';
    }

    if (!title) return '';
    return `<aside class="project-financial-insight is-${tone}" aria-label="Estado financiero del proyecto"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(copy)}</span></aside>`;
  }

  function renderDetailFinancialSummary(project, metrics) {
    if (metrics.financialStatus === 'completed_without_invoice') {
      return `<aside class="project-detail-financial-summary is-warning"><strong>Este proyecto está completado, pero no tiene facturas.</strong><span>Las ${formatNumber(metrics.hours)} h registradas equivalen a ${formatMoney(metrics.estimatedValue)} según la tarifa. Por eso “Facturado”, “Cobrado” y “Por cobrar” permanecen en ${formatMoney(0)} hasta que se emita una factura.</span></aside>`;
    }
    if (metrics.invoicedAboveLoggedWork) {
      return `<aside class="project-detail-financial-summary is-info"><strong>La facturación supera el valor de las horas registradas.</strong><span>Hay una diferencia de ${formatMoney(metrics.invoiceValueDifference)}. Revisa si faltan registros de tiempo o si las facturas incluyen otros conceptos.</span></aside>`;
    }
    if (metrics.unbilledValue > 0) {
      return `<aside class="project-detail-financial-summary is-warning"><strong>Hay trabajo pendiente de facturar.</strong><span>${formatMoney(metrics.unbilledValue)} del valor estimado todavía no está incluido en facturas.</span></aside>`;
    }
    if (metrics.receivable > 0) {
      return `<aside class="project-detail-financial-summary is-info"><strong>La facturación no está totalmente cobrada.</strong><span>Se cobró el ${formatNumber(metrics.collectionProgress, 0)}% y quedan ${formatMoney(metrics.receivable)} pendientes.</span></aside>`;
    }
    return '<aside class="project-detail-financial-summary is-success"><strong>Situación financiera al día.</strong><span>No hay trabajo estimado sin facturar ni saldos pendientes de cobro.</span></aside>';
  }

  function getProgress(project, metrics) {
    if (project.modalidad_cobro === 'Tarifa fija') return { label: 'Facturación emitida', value: metrics.billingProgress };
    if (project.modalidad_cobro === 'Por horas') return { label: 'Horas registradas', value: metrics.hoursProgress };
    return { label: 'Facturación registrada', value: metrics.billingProgress };
  }

  function resultCountCopy(count) {
    if (!state.projects.length) return 'Tu cartera está lista para el primer proyecto';
    if (!count) return '0 proyectos encontrados';
    return `${count} ${count === 1 ? 'proyecto encontrado' : 'proyectos encontrados'}`;
  }

  function detailMetric(label, value, tone) {
    return `<article class="project-detail-metric project-detail-metric-${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
  }

  function detailTabButton(tab, label) {
    const active = state.detailTab === tab;
    return `<button id="project-tab-${tab}" type="button" role="tab" data-project-tab="${tab}" aria-selected="${String(active)}" aria-controls="project-tab-panel" tabindex="${active ? '0' : '-1'}" class="${active ? 'is-active' : ''}">${escapeHtml(label)}</button>`;
  }

  function statusOptions(current) {
    const allowed = current === 'COMPLETED' ? ['COMPLETED'] : model.PROJECT_STATES;
    return allowed.map((status) => `<option value="${status}"${status === current ? ' selected' : ''}>${statusLabel(status)}</option>`).join('');
  }

  function renderProjectStatus(status) {
    return `<span class="project-status-badge project-status-${escapeAttribute(status.toLowerCase())}"><span aria-hidden="true"></span>${escapeHtml(statusLabel(status))}</span>`;
  }

  function statusLabel(status) {
    return { ACTIVE: 'Activo', ON_HOLD: 'En pausa', COMPLETED: 'Completado' }[status] || 'Activo';
  }

  function invoiceStatusLabel(status) {
    return {
      DRAFT: 'Borrador', SENT: 'Enviada', PARTIAL: 'Pago parcial', PAID: 'Pagada', OVERDUE: 'Vencida', VOID: 'Anulada'
    }[status] || status || 'Sin estado';
  }

  function formatProjectDates(project) {
    if (!project.fecha_inicio) return 'Fechas por definir';
    return project.fecha_fin_estimada
      ? `${formatDate(project.fecha_inicio)} — ${formatDate(project.fecha_fin_estimada)}`
      : `Desde ${formatDate(project.fecha_inicio)}`;
  }

  function categoryName(categoryId) {
    return state.categories.find((category) => category.id === categoryId)?.nombre_categoria || 'Sin categoría';
  }

  function findProject(id) {
    return state.projects.find((project) => String(project.id) === String(id));
  }

  function findClient(id) {
    return state.clients.find((client) => String(client.id) === String(id));
  }

  function setFormValue(id, value) {
    const field = document.getElementById(id);
    if (field) field.value = value ?? '';
  }

  function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function generateProjectId() {
    if (window.crypto?.randomUUID) return `proy_${window.crypto.randomUUID()}`;
    return `proy_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function formatMoney(value) {
    return moneyFormatter.format(Number(value) || 0);
  }

  function formatNumber(value, digits = 1) {
    return new Intl.NumberFormat('es-EC', { maximumFractionDigits: digits }).format(Number(value) || 0);
  }

  function formatDate(value) {
    if (!value) return 'Fecha no disponible';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : dateFormatter.format(date);
  }

  function initials(value) {
    return String(value ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }

  function showToast(message, type = 'success') {
    window.clearTimeout(state.toastTimer);
    elements.toast.textContent = message;
    elements.toast.dataset.type = type;
    elements.toast.hidden = false;
    requestAnimationFrame(() => elements.toast.classList.add('is-visible'));
    state.toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove('is-visible');
      window.setTimeout(() => { elements.toast.hidden = true; }, 220);
    }, 3800);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll('`', '&#096;');
  }
}());
