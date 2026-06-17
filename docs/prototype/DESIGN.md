# FreelanceFlow DESIGN.md

## Product

FreelanceFlow is a web-first SaaS product for freelancers. It starts as an academic project, but the intended scope is a real portfolio-grade product that could later become useful for actual independent workers. It helps freelancers track income, expenses, accounts, clients, projects, monthly budgets, and cash flow health. The product must feel trustworthy, calm, modern, and practical, not like a crypto/trading app.

The first prototype target is **desktop web landing + SaaS dashboard**, because the product must be presentable as a real SaaS on GitHub, LinkedIn, and a personal portfolio. Mobile screens are still important, but they come after the web value proposition and desktop control panel are clear.

## Design Direction

**Aesthetic name:** Editorial Fintech Ledger

A professional fintech interface inspired by clean financial ledgers, editorial data cards, and calm productivity dashboards. The UI must look serious enough for money management but approachable for students/freelancers.

**Differentiation anchor:** The interface should feel like a “living financial notebook”: dark navy surfaces, warm amber money signals, thin ledger lines, compact financial cards, and asymmetric dashboard panels.

**DFII score:** 13/15

- Aesthetic impact: 4/5
- Context fit: 5/5
- Implementation feasibility: 5/5
- Performance safety: 4/5
- Consistency risk: 5? Actually low risk, subtract 5? Final practical score: 13 after reducing effects and keeping components reusable.

## Target Devices

Create both desktop and mobile versions.

- Desktop: 1440 x 1024 dashboard-first layout.
- Laptop: 1280 x 800 responsive layout.
- Tablet: 768 x 1024 compact layout.
- Mobile: 390 x 844 app-like layout.

## Visual System

### Colors

Use a dark-first professional palette with optional light surfaces for reports.

```text
Background primary: #0F172A
Background elevated: #111C33
Background card: #17223A
Surface soft: #F8FAFC
Text primary dark: #F8FAFC
Text secondary dark: #CBD5E1
Text primary light: #020617
Muted light: #475569
Primary action: #F59E0B
Secondary action: #FBBF24
Accent analytical: #14B8A6
Danger/expense: #EF4444
Success/income: #22C55E
Border dark: rgba(255,255,255,0.10)
Border light: #E2E8F0
```

Do not use purple SaaS gradients as the main identity. Amber is the financial signal, teal is the analytical signal.

### Typography

Use IBM Plex Sans or a similar professional grotesk. It must feel financial, precise, readable, and academic.

- Display/headings: IBM Plex Sans SemiBold/Bold
- Body: IBM Plex Sans Regular/Medium
- Numeric data: tabular numbers where possible

### Shape and spacing

- Cards: 20-28px radius on marketing surfaces, 14-18px radius on dense app cards.
- Inputs: 12-14px radius.
- Spacing rhythm: 8px base grid.
- Dashboard: compact but not crowded.
- Mobile: bottom navigation and thumb-friendly controls.

### Icon style

Use clean outline icons for navigation and filled icons only for key metrics.

Recommended concepts:

- Wallet: accounts/saldo
- Bar chart: reports/dashboard
- Calendar: monthly budget
- Client/person: clients
- Invoice/document: projects/invoices
- Money transfer: transactions
- Mobile payment: quick mobile entry

### Imagery

Use existing project assets where applicable:

- Hero desktop: `img/photos/hero-freelancer-laptop-workspace-1920w.jpg`
- Dashboard feature: `img/photos/feature-dashboard-analytics-1920w.jpg`
- Mobile feature: `img/photos/feature-mobile-finance-app-1920w.jpg`
- Invoice/project feature: `img/photos/feature-invoice-planning-1280w.jpg`
- SVG dashboard: `img/icons/svg/illustration-analytics-dashboard-storyset-rafiki.svg`
- SVG wallet: `img/icons/svg/illustration-wallet-undraw.svg`

Avoid trading-heavy photos as primary visuals. Do not make the app look like crypto/investment software.

## UX Principles

1. The dashboard should answer: “How healthy is my money this month?”
2. Transaction entry must be fast and obvious.
3. Income and expense colors must be consistent across all screens.
4. Client/project context must be visible when money is attached to work.
5. Mobile UI prioritizes quick capture, not dense analytics.
6. Desktop UI prioritizes overview, filters, and reports.
7. Empty states should teach the user what to do next.
8. Avoid decoration that competes with financial numbers.

## Core Screens to Generate

### Desktop Web Screens

#### 1. Landing / Hero

Purpose: Explain the product quickly, position FreelanceFlow as a serious SaaS, and guide the user to start or view the dashboard demo.

Sections:

- Floating nav with logo “FreelanceFlow”
- Hero headline: “Controla tus ingresos freelance sin vivir en hojas de cálculo”
- Subheadline: “Registra ingresos, gastos, clientes, proyectos y presupuestos desde una sola plataforma.”
- Primary CTA: “Ver demo”
- Secondary CTA: “Registrar transacción”
- Hero visual: dashboard preview layered over freelancer/laptop image
- Feature chips: Cuentas, Clientes, Proyectos, Presupuestos, Reportes
- Social proof placeholder: “Diseñado para freelancers, estudiantes y profesionales independientes”
- Trust/value indicators: “Sin conexión bancaria”, “Registro manual seguro”, “Control por cliente y proyecto”

#### 2. Desktop Dashboard

Purpose: Main control panel.

Layout:

- Left sidebar navigation
- Top bar with month selector and user profile
- Main grid:
  - Monthly income card
  - Monthly expenses card
  - Net balance card
  - Cash flow trend chart
  - Expenses by category chart
  - Recent transactions table
  - Budget progress cards
  - Client/project revenue card

Important UI:

- Income green, expenses red, balance amber/teal.
- Use ledger-like thin dividers.
- Add “Quick action” button to create transaction.

#### 3. Transactions Screen

Purpose: List and create income/expense records.

Content:

- Filter tabs: All, Income, Expenses
- Search by client/project/category
- Transaction table
- Right-side create/edit transaction panel
- Fields: type, amount, date, category, account, client, project, notes
- Validation states and empty state

#### 4. Clients and Projects Screen

Purpose: Manage work relationships and contract values.

Content:

- Client cards
- Projects grouped by client
- Project value, paid amount, pending amount
- Revenue progress bar
- CTA: Add client / Add project

#### 5. Budgets and Reports Screen

Purpose: Understand monthly limits and spending.

Content:

- Monthly budget overview
- Category budget cards
- Over-budget warning state
- Report filters by month/client/project
- Export/report button visual only

### Mobile Screens

#### 6. Mobile Home

Purpose: Quick financial snapshot.

Content:

- Greeting and current month
- Balance card
- Income/expense summary
- Quick action button “+ Movimiento”
- Last 3 transactions
- Bottom nav: Inicio, Movimientos, Clientes, Reportes

#### 7. Mobile Add Transaction

Purpose: Fast on-the-go capture.

Content:

- Segmented control: Income / Expense
- Amount-first input
- Category selector chips
- Account selector
- Optional client/project link
- Date picker
- Save button sticky bottom
- Success microinteraction state

#### 8. Mobile Project Detail

Purpose: See money related to a project.

Content:

- Client name and project title
- Contract value
- Paid/pending amounts
- Related transactions
- Add income CTA

#### 9. Mobile Empty State / Onboarding

Purpose: Teach first-time user.

Content:

- Illustration
- Three setup steps: create account, add client/project, record first transaction
- CTA: “Crear mi primera cuenta”

## Navigation Model

Desktop:

- Dashboard
- Transacciones
- Cuentas
- Clientes y Proyectos
- Presupuestos
- Reportes
- Configuración

Mobile bottom nav:

- Inicio
- Movimientos
- Clientes
- Reportes

Primary global action:

- “+ Movimiento”

## Prototype Interactions

- Landing CTA “Ver demo” goes to Desktop Dashboard.
- Dashboard “+ Movimiento” opens transaction panel.
- Mobile “+ Movimiento” goes to Add Transaction.
- Save transaction shows success feedback.
- Client card opens Project Detail.
- Budget card opens Budgets/Reports.

## Accessibility Requirements

- Minimum 4.5:1 contrast for text.
- Visible focus states.
- Do not rely on color alone for income/expense; include labels and icons.
- Form fields must have labels.
- Mobile tap targets at least 44px.
- Reduce motion alternative for animations.

## Avoid

- Generic purple gradient SaaS look.
- Crypto/trading-heavy aesthetic.
- Emoji icons.
- Overly decorative charts.
- Tiny financial numbers.
- Hidden labels in forms.
- Autoplay audio/video in the actual app.

## Deliverable expectation

Generate high-fidelity screens that can guide implementation in HTML/CSS/JS first, then later React/Django/Expo. Prioritize desktop dashboard and mobile add transaction because those are the core product experiences.

## Landing Refinement Notes

The first generated Stitch landing is a good starting point, but it must be refined before implementation.

### Light and dark palette clarification

The product supports a dark-first fintech identity, but the public landing may use a warm editorial light mode. The light mode must remain readable.

#### Light mode

```text
Background: #FFFDF8
Surface: #F7EFE5
Surface elevated: #FFFFFF
Text primary: #1C130D
Text secondary: #6B5B4B
Border: #D8C7B5
Primary action: #F59E0B
Primary action hover: #D97706
Teal analytical: #14B8A6
Income: #16A34A
Expense: #DC2626
Dark ledger card: #1E160F
```

#### Dark mode

```text
Background: #0F172A
Surface: #111C33
Card: #17223A
Text primary: #F8FAFC
Text secondary: #CBD5E1
Border: rgba(255,255,255,0.10)
Primary action: #F59E0B
Teal analytical: #14B8A6
Income: #22C55E
Expense: #EF4444
```

### Landing quality requirements

- Primary hero text must have strong contrast. Do not use pale cream text on white.
- The hero visual must show the product/dashboard, not only a generic desk photo.
- Secondary CTA must not look disabled.
- Add trust chips: no bank connection, client/project tracking, fast manual entry, monthly reports.
- Module cards should include microcopy, not only icon + label.
- Add a 3-step “Cómo funciona” section.
- Keep the SaaS positioning: this is a real product concept, not only a university assignment.

### Responsive requirements

- Desktop: two-column hero, full navigation, dashboard preview visible.
- Tablet: compact nav, 2-column feature/module cards.
- Mobile: single-column hero, stacked CTAs, readable headline, vertical cards, bottom-safe spacing.
