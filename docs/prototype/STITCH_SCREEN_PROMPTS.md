# FreelanceFlow — Stitch screen prompts

Use these prompts to generate FreelanceFlow screens in Stitch/Figma before converting them to code.

## Workflow rule

For every screen:

1. Paste the **Master prompt** first.
2. Paste the **screen-specific prompt** below it.
3. Review the result against `docs/prototype/DESIGN.md` and the official specs in `docs/specs/`.
4. Iterate up to 3 times maximum.
5. Once approved, create a handoff Markdown before converting the screen to static HTML/CSS/JS.

Do not design backend, database, APIs, authentication logic, bank connections or real payment integrations during Phase 1.

---

## Master prompt for all FreelanceFlow app screens

```text
Design a high-fidelity SaaS product screen for FreelanceFlow.

Product context:
FreelanceFlow is a web-first financial management SaaS for freelancers. It helps independent workers control income, expenses, clients, projects, invoices, budgets and cash-flow health without living in spreadsheets. The product is an academic prototype now, but it must feel portfolio-grade and like a real SaaS product.

Visual direction:
Use the existing FreelanceFlow landing page style: Editorial Fintech Ledger. The UI should feel like a living financial notebook: serious, calm, modern, trustworthy and practical. Use dark navy app surfaces, warm amber financial signals, teal analytical accents, thin ledger dividers, rounded cards, compact financial data panels and asymmetric but disciplined layouts.

Brand style:
- Primary dark navy: #0F172A
- Elevated dark: #111C33
- Card dark: #17223A
- Light surface: #FFFDF8 or #F8FAFC
- Amber action/money signal: #F59E0B
- Teal analytics: #14B8A6
- Income green: #22C55E
- Expense red: #EF4444
- Borders: rgba(255,255,255,0.10) on dark, #E2E8F0 on light
- Typography: IBM Plex Sans or similar professional grotesk. Use tabular-looking numbers.

Navigation:
For the current Phase 1 product demo, primary navigation should emphasize: Dashboard, Movimientos, Clientes, Proyectos, Facturas and Reportes. If the screen being designed belongs to a future module, show that module as the active destination but keep it clearly within a static frontend prototype scope.

Do not use:
- Purple SaaS gradients
- Crypto/trading aesthetic
- Generic template dashboards
- Emoji icons
- Tiny unreadable financial numbers
- Hidden form labels
- Decorative charts without purpose

Layout requirements:
Create desktop, tablet and mobile responsive versions.
Desktop target: 1440 x 1024.
Tablet target: 768 x 1024.
Mobile target: 390 x 844.

Interaction states to represent visually:
- Hover/focus state for primary buttons
- Empty state when there is no data
- Success confirmation after saving
- Error/validation state in forms
- Active navigation item

Accessibility:
Keep strong contrast, readable labels, 44px mobile tap targets, clear focus states, and never rely only on color to distinguish income vs expense.

Output expectation:
Generate a polished product UI screen, not a wireframe. It must be detailed enough to later implement in static HTML/CSS/JS with mock data.
```

---

## Prompt 1 — Desktop Dashboard refinement

```text
Using the FreelanceFlow master style, design the Desktop Dashboard screen.

Purpose:
Answer in 5 seconds: “How healthy is my freelance money this month?”

Required content:
- Left sidebar navigation with FreelanceFlow logo.
- Top bar with month selector, quick action button “+ Movimiento”, and user profile chip.
- Metric cards: Ingresos del período, Gastos del período, Flujo de caja neto, Saldo por cobrar.
- Small operational counters: Clientes activos, Proyectos registrados, Facturas emitidas.
- Recent transactions table with date, type, description, client/project and amount.
- Client/project revenue panel.
- Budget progress panel.
- Error/empty state example for missing data.

Design notes:
Use dark navy shell, light ledger cards, amber CTA, teal analytical accents, green income and red expense. Make the numbers prominent and calm, not flashy. Keep it close to the landing visual language.
```

---

## Prompt 2 — Transactions screen

```text
Using the FreelanceFlow master style, design the Transactions screen.

Purpose:
Let a freelancer review and register income/expense movements quickly.

Required content:
- Left sidebar navigation.
- Page title: “Movimientos financieros”.
- Filter tabs: Todos, Ingresos, Gastos.
- Search input for client/project/category.
- Date/month filter.
- Transactions table with: fecha, tipo, descripción, categoría, cliente, proyecto, monto.
- Right-side create/edit panel.
- Form fields: tipo, monto, fecha, categoría, cuenta mock auxiliar, cliente, proyecto, notas.
- Validation states: missing type, invalid amount, missing category, invalid date.
- Success state: “Transacción guardada exitosamente”.
- Empty state: “Aún no has registrado movimientos”.

Design notes:
The create panel should feel fast and practical. Amount input should be visually dominant. Use labels, not placeholders only.
```

---

## Prompt 3 — Clients screen

```text
Using the FreelanceFlow master style, design the Clientes screen.

Purpose:
Manage B2B clients while storing the required academic fields as Contacto Principal / Representante Legal.

Required content:
- Left sidebar navigation.
- Page title: “Clientes y contacto principal”.
- Intro card explaining that personal fields represent the legal representative/contact.
- Register/edit client form with required fields:
  - nombre_razon_social
  - tipo_cliente
  - nombres
  - apellidos
  - identificacion
  - telefono optional
  - celular
  - correo
  - direccion optional
  - estadoCivil: soltero, casado, divorciado, separado, unión libre
  - estado: activo, inactivo
- Client list table/cards with search by nombres, apellidos or identificación.
- Client detail panel.
- Inline controls to change estadoCivil and estado.
- Empty state: “Aún no has registrado clientes”.
- No-results state: “No encontramos clientes con ese criterio”.

Design notes:
This is an operational CRUD screen, but it should still feel premium. Use dense ledger tables, clear form grouping and strong detail panel hierarchy.
```

---

## Prompt 4 — Clients and Projects screen

```text
Using the FreelanceFlow master style, design the Clientes y Proyectos screen.

Purpose:
Show how each client connects to projects, revenue, pending payments and profitability.

Required content:
- Left sidebar navigation.
- Client cards grouped with projects underneath.
- Each client card shows: razón social, main contact, status, pending balance.
- Each project row/card shows: project name, billing mode, status, contract value, paid amount, pending amount, hours estimate.
- Revenue progress bar per project.
- CTA buttons: “Agregar cliente”, “Agregar proyecto”.
- Project detail preview panel with related invoices and expenses.
- Empty state for clients without projects.

Design notes:
Make the relationship between client → project → money visually obvious. Use connecting ledger lines or grouped cards.
```

---

## Prompt 5 — Budgets and Reports screen

```text
Using the FreelanceFlow master style, design the Presupuestos y Reportes screen.

Purpose:
Help the freelancer understand monthly limits, spending and financial performance.

Required content:
- Left sidebar navigation.
- Month selector and filters by client/project.
- Budget overview: meta de ingresos, gastos reales, flujo neto.
- Category budget cards with progress bars.
- Over-budget warning state.
- Reports access cards: Ingresos, Gastos, Flujo de caja, Rentabilidad, Pérdidas y ganancias, Cuentas por cobrar.
- Report table preview with export button visual only.
- Empty state: “No hay suficiente información financiera para generar este reporte”.

Design notes:
Use teal for analytical insights, amber for attention, red only for true over-budget/risk states. Keep charts simple and readable.
```

---

## Prompt 6 — Invoices screen

```text
Using the FreelanceFlow master style, design the Facturas screen.

Purpose:
Manage invoices, payment status and pending balances.

Required content:
- Left sidebar navigation.
- Page title: “Facturas”.
- Status filter chips: Borrador, Enviada, Parcial, Pagada, Vencida, Anulada.
- Invoice table with: número, cliente, proyecto, fecha emisión, vencimiento, total, saldo pendiente, estado.
- Highlight overdue invoices.
- Actions: Ver detalle, Registrar pago, Anular, Descargar PDF visual.
- Invoice detail side panel with items, total, paid amount, pending balance and payment history.
- Payment registration modal/panel visual.
- Empty state: “Aún no has emitido facturas”.

Design notes:
This screen must make accounts receivable obvious. Vencida and saldo pendiente should be visually easy to detect without feeling alarmist.
```

---

## Prompt 7 — Mobile Home

```text
Using the FreelanceFlow master style, design the Mobile Home screen at 390 x 844.

Purpose:
Give the freelancer a quick financial snapshot on mobile.

Required content:
- Greeting and current month.
- Main balance/cash-flow card.
- Income and expense mini cards.
- Pending invoices alert chip.
- Primary floating/sticky action “+ Movimiento”.
- Last 3 transactions.
- Small clients/projects summary.
- Bottom nav: Inicio, Movimientos, Clientes, Reportes.

Design notes:
Mobile should feel app-like, thumb-friendly and fast. Prioritize quick capture over dense analytics.
```

---

## Prompt 8 — Mobile Add Transaction

```text
Using the FreelanceFlow master style, design the Mobile Add Transaction screen at 390 x 844.

Purpose:
Allow fast income/expense capture in under 20 seconds.

Required content:
- Header with back button and title “Nuevo movimiento”.
- Segmented control: Ingreso / Gasto.
- Large amount input first.
- Date field.
- Category selector chips.
- Account selector labeled as mock auxiliary.
- Optional client/project link.
- Notes field.
- Sticky bottom save button.
- Validation state for missing type/category and invalid amount.
- Success state after save.

Design notes:
Amount-first layout. Large touch targets. Minimal distractions. Strong visible labels.
```

---

## Prompt 9 — Mobile Project Detail

```text
Using the FreelanceFlow master style, design the Mobile Project Detail screen at 390 x 844.

Purpose:
Show money attached to a single freelance project.

Required content:
- Header with client name and project title.
- Project status badge.
- Contract value, paid amount and pending amount.
- Revenue progress bar.
- Hours registered vs estimated.
- Related invoices list.
- Related expenses list.
- CTA: “Agregar ingreso” or “Registrar tiempo”.
- Empty state if no invoices/expenses exist.

Design notes:
The user should immediately understand whether the project is profitable and whether money is pending.
```

---

## Prompt 10 — Empty state / onboarding

```text
Using the FreelanceFlow master style, design an Empty State / Onboarding screen.

Purpose:
Teach a first-time freelancer how to set up the app.

Required content:
- Friendly but professional headline: “Tu flujo financiero empieza con el primer registro”.
- Three setup steps:
  1. Agrega tu primer cliente.
  2. Crea un proyecto o servicio.
  3. Registra tu primer ingreso o gasto.
- CTA: “Crear primer cliente”.
- Secondary CTA: “Ver demo con datos simulados”.
- Small trust notes: sin conexión bancaria, registro manual seguro, datos por cliente/proyecto.
- Illustration style should match ledger/document + amber/teal flow, not cartoons or crypto.

Design notes:
Avoid childish onboarding. It should feel like a calm financial notebook guiding the user.
```

---

## Remaining module prompts

These prompts are for modules that should be designed before implementation. They are intentionally scoped so the UI feels like a real SaaS without inventing backend behavior.

### Priority 1 — Categories screen / Categorías

```text
Using the FreelanceFlow master style, design the Categorías de gasto screen as the next operational module.

Purpose:
Let a freelancer organize the expense categories used by Movimientos, Reportes and budget controls, so the SaaS feels complete without adding backend complexity.

Required content:
- Left sidebar navigation with the current operational modules: Dashboard, Movimientos, Clientes, Proyectos, Facturas, Reportes, and Categorías active.
- Page title: “Categorías de gasto”.
- Header action: “Nueva categoría”.
- Short explanation: categories keep movements, budgets and reports organized.
- Summary cards:
  - total categories
  - deductible categories
  - most used category
  - categories with monthly budget attention
- Search and filter row:
  - search by category name or description
  - filter by deductible / non-deductible
- Category table for desktop and cards for mobile with:
  - nombre
  - descripción
  - deductible flag
  - usage count
  - monthly budget reference
  - status
- Create/edit side panel with clear labels:
  - nombre_categoria
  - descripcion optional
  - es_deducible_por_defecto boolean
  - presupuesto_mensual optional
- Actions: Crear categoría, Guardar cambios, Editar, Eliminar with confirmation, Cancelar.
- Validation states: required category name, duplicate category name.
- Empty state: “Aún no has creado categorías de gasto”.
- No-results state for search/filter.

Design notes:
Keep this screen lightweight and operational. Use the Editorial Fintech Ledger style: amber primary action, dark ledger sidebar, sober cards, readable numbers and clear focus states. Do not add tax automation, accounting rules, charts, bank integrations or backend behavior. The screen should feel like a finished product module, not a placeholder.
```

### Prompt 12 — Services screen / Servicios

```text
Using the FreelanceFlow master style, design the Servicios screen.

Purpose:
Let a freelancer maintain a reusable service catalog for projects, invoices and future proposals.

Required content:
- Left sidebar navigation, with Servicios as the active future/administration module.
- Page title: “Catálogo de servicios”.
- Intro card explaining that services define reusable descriptions, units and rates.
- Service summary cards: total services, average rate, most used unit.
- Service list table/cards with: nombre_servicio, unidad_medida, tarifa_unitaria, moneda, description preview.
- Create/edit side panel with fields:
  - nombre_servicio
  - descripcion optional
  - unidad_medida: Hora, Proyecto, Entregable
  - tarifa_unitaria
  - moneda
- Actions: Crear servicio, Editar, Eliminar with confirmation, Cancelar.
- Validation states: required service name, required unit, rate must be greater than 0.
- Empty state: “Aún no has creado servicios en tu catálogo”.
- No-results state for search/filter.

Design notes:
Make it feel useful but not overbuilt. Do not add inventory, recurring billing or subscriptions. The service catalog should visually connect to projects and invoices.
```

### Prompt 13 — Proposals screen / Propuestas

```text
Using the FreelanceFlow master style, design the Propuestas screen.

Purpose:
Show how a freelancer can prepare commercial proposals before converting accepted work into projects.

Required content:
- Left sidebar navigation, with Propuestas as the active future module.
- Page title: “Propuestas comerciales”.
- Status chips: Borrador, Enviada, Aceptada, Rechazada, Expirada, Convertida.
- Proposal table/cards with: cliente, título, fecha_emision, fecha_validez, total_propuesta, estado.
- Detail side panel with proposal items, subtotal, discount, total and status timeline.
- Create/edit visual panel with header fields and dynamic item rows.
- Actions: Crear propuesta, Guardar borrador, Enviar, Marcar aceptada/rechazada, Convertir a proyecto.
- Validation states: required client, at least one item, valid dates, total must be greater than 0.
- Empty state: “Aún no has creado propuestas”.

Design notes:
Keep the state machine visible but simple. Do not add e-signature, real email sending, payment links, AI generation or backend workflows. This screen is optional for Phase 1 and can remain a future sales-flow module.
```

### Prompt 14 — Fiscal configuration screen / Configuración fiscal

```text
Using the FreelanceFlow master style, design a lightweight Configuración Fiscal screen.

Purpose:
Show the freelancer where estimated tax assumptions would be configured without pretending to provide legal or country-specific tax automation.

Required content:
- Left sidebar navigation, with Configuración fiscal as the active future/settings module.
- Page title: “Configuración fiscal estimada”.
- Clear warning/info card: “Estos valores son supuestos de prototipo y no reemplazan asesoría fiscal”.
- Form preview with fields from the current catalog only:
  - identificacion_fiscal
  - regimen_tributario
  - porcentaje_retencion_estimado
  - aplica_impuesto_valor_agregado
  - porcentaje_impuesto conditional
- Preview card showing how these values would affect an invoice estimate.
- Actions: Guardar configuración, Cancelar.
- Validation states: required fiscal ID, percentages between 0 and 100.
- Empty state or first-time state for missing fiscal setup.

Design notes:
This screen must stay conservative. Do not invent country-specific rules, tax filings, declarations, legal advice or advanced calculations. It should look trustworthy and intentionally limited.
```

### Prompt 15 — Settings screen / Ajustes

```text
Using the FreelanceFlow master style, design a lightweight Ajustes screen.

Purpose:
Let a freelancer review basic product preferences used by the static prototype.

Required content:
- Left sidebar navigation, with Ajustes as the active future/settings module.
- Page title: “Ajustes de facturación y preferencias”.
- Sections:
  - Facturación: prefijo de numeración, siguiente número de factura, días de vencimiento predeterminado.
  - Moneda: moneda predeterminada.
  - Marca visual: logo placeholder or current brand preview.
- Preview card showing the next invoice number and due date behavior.
- Actions: Guardar ajustes, Restaurar valores demo.
- Validation states: invoice number must be positive, due days must be greater than 0.
- Empty/default state with current demo values.

Design notes:
Keep it shallow and product-grade. Do not add account security, billing plans, subscriptions, teams, API keys or backend settings.
```

### Prompt 16 — Notifications screen / Notificaciones

```text
Using the FreelanceFlow master style, design a Notificaciones screen for a future phase.

Purpose:
Show a lightweight notification center based on existing mock financial events.

Required content:
- Left sidebar navigation, with Notificaciones as the active future module.
- Page title: “Notificaciones”.
- Notification preference summary: facturas vencidas, propuestas por expirar, pagos recibidos.
- Notification list with: type icon, message, date, read/unread style, related entity link visual.
- Preference panel with channels: Email and In-app.
- Actions: Marcar como leída, Marcar todas como leídas, Guardar preferencias.
- Empty state: “No tienes notificaciones nuevas”.
- Validation state: at least one channel selected.

Design notes:
Do not imply scheduled jobs, push notifications, real email delivery or background workers. This is a future-phase notification center using derived mock alerts only.
```

### Prompt 17 — Auth and profile shell / Cuenta

```text
Using the FreelanceFlow master style, design a lightweight Account/Profile shell.

Purpose:
Show where registration, login and profile settings will live in a future authentication phase.

Required content:
- Public auth card for Registro / Inicio de sesión.
- Profile summary card with name, email, country and avatar placeholder.
- Clearly visible labels and password fields, but no real authentication flow.
- Empty/profile-first state.
- Actions: Crear cuenta, Iniciar sesión, Guardar perfil visual only.

Design notes:
Do not design real session handling, OAuth, email verification, password reset delivery or backend security. Keep this as future auth structure only.
```


---

## Iteration prompts

### Iteration 1 — Fix layout and hierarchy

```text
Refine this screen to match FreelanceFlow's Editorial Fintech Ledger style more closely.
Improve hierarchy, spacing and readability.
Make it feel less generic and more like the accepted landing page.
Keep the same functional content, but strengthen the financial ledger feeling with navy surfaces, amber CTA, teal analytical accents, thin dividers and premium cards.
Return desktop, tablet and mobile variants.
```

### Iteration 2 — Fix product accuracy

```text
Revise the screen for product accuracy.
Make sure all visible fields and actions match FreelanceFlow's current Phase 1 scope.
Do not add backend, bank connections, real payments, AI automation or unsupported entities.
For client fields, treat nombres/apellidos/identificacion/estadoCivil as Contacto Principal or Representante Legal data inside the B2B client model.
Improve empty, validation and success states.
```

### Iteration 3 — Final implementation handoff

```text
Prepare this screen as a final implementation handoff for static HTML/CSS/JS.
Make spacing, component states, responsive behavior, colors and typography precise.
Label all important UI sections.
Ensure forms have visible labels and accessible states.
Avoid visual elements that would be hard to implement in simple HTML/CSS/JS.
The final result should be ready to translate into code without inventing new functionality.
```
