# FreelanceFlow — Full Integrated Portfolio Demo Roadmap

**Status:** Approved execution roadmap
**Strategy:** **Plan F — Full Integrated Demo**
**Baseline at approval:** `origin/main @ 3d2b66622a9eb41fb7d5f478a4acfc761ace1118`
**Cost target:** **USD 0/month** for the public demo.
**Public posture:** SaaS-oriented product shown as a **fully integrated portfolio demo**, not as production commercial infrastructure.

## 1. Goal

Finish the product behavior that already exists in FreelanceFlow, integrate the current frontend end-to-end with Django + MySQL, publish a polished public demo, document it accurately, tag `v1.0.0`, and then freeze the feature set.

Governing rule:

> **All current product behavior, not all imaginable SaaS behavior.**

If an action is intentionally visible in the final UI, it must have a coherent backend/API/persistence path. A capability does not enter v1 merely because a mature commercial SaaS might eventually need it.

## 2. Current state to preserve

At strategy approval time:

- Django 5.2.17 + MySQL modular monolith exist.
- Frontend: multi-page HTML/CSS/vanilla JavaScript.
- Frontend still relies heavily on mock data and browser storage.
- `/api/v1/*` exists, but most business domains are read-only at the public API boundary.
- Important domain logic already exists for commercial and financial areas.
- Frontend is not yet a fully integrated Django/MySQL product.
- `feat/frontend-session-bootstrap` contains recent unmerged integration work that must be audited before reuse.
- `GET /api/v1/session/` has an unresolved `active_workspace` contract.
- No production deployment path is verified yet.
- Public docs contain drift and must be aligned only after runtime behavior is proven.

Before every phase: fetch `origin/main` and revalidate facts that may have changed.

## 3. Final portfolio story

Recommended public description:

> FreelanceFlow is a SaaS-oriented financial and commercial management platform for freelancers. The public release is a fully integrated portfolio demo using synthetic data, Django, MySQL, real domain rules, APIs, testing, CI and live deployment. It is not marketed as production financial infrastructure or a commercial SaaS with SLA.

The project should demonstrate:

- backend/software engineering;
- Django application architecture;
- MySQL persistence;
- multi-tenant Workspace isolation;
- session auth and authorization;
- API design;
- domain services and lifecycle rules;
- transactions/idempotency where required;
- financial integrity constraints already designed;
- frontend/backend integration;
- automated tests;
- CI;
- deployment;
- secrets/demo-data discipline;
- product/documentation discipline.

## 4. Explicit non-goals for v1.0

Do not add these merely to make the project look more advanced:

- React/Vite/Next rewrite;
- React Native / Expo;
- DRF migration;
- PostgreSQL migration;
- microservices;
- Kubernetes;
- Kafka;
- Redis/Celery unless an existing v1 behavior truly requires background work;
- AI/RAG/agents;
- real payment-provider integration;
- subscription billing;
- production email infrastructure;
- WebSockets without a proven need;
- enterprise HA/SLA;
- production PII collection;
- features that exist only in an old/future roadmap.

## 5. Target architecture

### 5.1 Public landing

Use a separate static marketing/portfolio landing when ready, preferably on Cloudflare Pages.

Purpose:

- explain problem/value;
- screenshots;
- feature summary;
- architecture/stack;
- source link;
- `Launch Demo` CTA;
- explicit portfolio-demo disclaimer.

The landing does **not** consume the Django API.

### 5.2 Live application

Keep the application itself single-origin:

```text
Browser
   |
   v
Django HTTPS origin
   |-- existing frontend pages/assets
   |-- /api/v1/*
   |
   v
Managed MySQL
```

This keeps session cookies, CSRF and browser-origin policy simpler than splitting frontend and API across different origins.

### 5.3 Database

Preserve **MySQL**.

At roadmap creation time, **MySQL 8.4 LTS** is the preferred compatibility target for Aiven. Do not migrate database engines just to fit a free host.

## 6. Definition of “API complete”

“Complete the APIs” does **not** mean generic CRUD for every model.

The API is complete for v1 when every intentional final-UI action has the correct backend contract and persistence semantics.

| Domain | Expected v1 posture |
|---|---|
| Auth | session, login, logout |
| Workspace | list/select active Workspace |
| Clients | lifecycle required by current UI |
| Services | lifecycle required by current UI |
| Categories | create/update/inactivate/delete only where domain rules permit |
| Proposals | commands required by lifecycle |
| Projects | commands required by lifecycle/conversion |
| Fiscal | operations required by current UI/domain |
| Invoices | lifecycle required by UI |
| Payments | record/reverse only where domain permits |
| Ledger | domain-owned/append-only; arbitrary CRUD is not required |
| Reports | read APIs |
| Preferences | only settings actually used by UI |
| Notifications | read/ack/archive only if supported in UI |
| Audit | read-only is acceptable and preferable |
| Dashboard | backend-derived read model/data contract |

The backend is the source of truth for durable business data. Browser storage may remain only for explicitly non-sensitive, non-authoritative UI state.

# 7. Phased execution

## Phase 0 — Runtime Proof & MySQL Compatibility

**Objective:** prove that the backend in current `main` is reproducible before building more.

### Work

- Fetch current `origin/main`.
- Create isolated worktree/branch.
- Isolated Python environment.
- Install pinned backend requirements.
- Run against **MySQL 8.4** or exact future target.
- Verify DB connection, `utf8mb4`, InnoDB, `READ COMMITTED`, migrations, drift, constraints, custom triggers, transactions, tenant isolation, idempotency and backend/API tests.
- Run:
  - `python manage.py check`
  - `python manage.py makemigrations --check --dry-run`
  - `python manage.py showmigrations`
  - `python manage.py migrate`
  - backend tests
  - `python manage.py check --deploy` as diagnostic only.
- Audit `feat/frontend-session-bootstrap` read-only.
- Define the intended `active_workspace` contract before implementation.

### Deliverable

`docs/PHASE0_RUNTIME_COMPATIBILITY_REPORT.md`

### Exit

- Django runtime reproducible.
- MySQL compatibility proven or concrete blocker identified.
- Migration/test evidence recorded.
- Session/workspace contract unambiguous.
- Bootstrap branch verdict: reuse / partial reuse / reject.

**STOP and request approval for Phase 1.**

---

## Phase 1 — Authentication, Session & Workspace Integration

**Objective:** replace UI-only identity/workspace behavior with real Django session + active Workspace context.

### Work

- Implement/fix agreed session contract.
- Contract-test session/workspace behavior.
- Selectively reuse compatible bootstrap code.
- Create one reusable frontend API client.
- Correct CSRF handling.
- Integrate session probe, login, logout, Workspace list and active selection.
- Remove browser-local state that pretends to be authentication/authorization.

### Deliverable

`docs/PHASE1_AUTH_WORKSPACE_REPORT.md`

### Exit

Browser can authenticate, select/use a Workspace, refresh consistently with the contract and logout; server permissions remain authoritative.

**STOP and request approval for Phase 2.**

---

## Phase 2 — Core Operational Integration: Clients, Services, Categories

**Objective:** migrate foundational operational modules from mock/local durable state to API + MySQL.

### Work per module

1. Inventory every visible UI action.
2. Map each action to existing domain service or missing command.
3. Add only the write APIs required by the UI.
4. Integrate frontend → API → MySQL.
5. Remove mock/localStorage as durable truth for that module.
6. Preserve tenant isolation, archive/inactivate semantics, protected history, validation and monetary precision where relevant.
7. Add backend, frontend and browser-flow evidence.

Suggested order:

1. Clients
2. Services
3. Categories

### Deliverable

`docs/PHASE2_CORE_OPERATIONAL_INTEGRATION_REPORT.md`

### Exit

Every intentional Client/Service/Category action in the final UI operates on Django/MySQL and survives browser refresh/device-state loss.

**STOP and request approval for Phase 3.**

---

## Phase 3 — Commercial Integration: Proposals & Projects

**Objective:** complete the commercial lifecycle already designed.

### Work

- Inventory Proposal/Project UI actions.
- Complete only required command APIs.
- Integrate frontend with Django/MySQL.
- Prove tenant boundaries, lifecycle transitions, immutable/frozen snapshots, Proposal acceptance, Proposal→Project conversion, atomicity/idempotency where designed, and origin traceability.
- Remove mock/browser durable persistence.
- Add E2E tests.

Portfolio journey:

```text
Client + Service
      |
      v
Proposal
      |
   accepted
      |
      v
Project
```

### Deliverable

`docs/PHASE3_COMMERCIAL_INTEGRATION_REPORT.md`

### Exit

The real UI completes the commercial journey entirely through backend/API/MySQL.

**STOP and request approval for Phase 4.**

---

## Phase 4 — Financial Integration: Fiscal, Invoices, Payments, Ledger & Reports

**Objective:** expose and integrate the financial behavior intentionally shown in the UI.

### Work

Migrate:

- Fiscal configuration;
- Invoices;
- Payments;
- reversals if final UI supports them;
- Ledger reads;
- financial/cash reports.

Rules:

- Money remains Decimal/server-owned.
- No arbitrary ledger mutation if domain services own ledger creation.
- No generic delete for immutable financial history.
- Preserve idempotency, locking, transactions and lifecycle restrictions.
- Prove important constraints/triggers against target MySQL.
- Migrate frontend data source away from mock/local durable state.

Portfolio journey:

```text
Project
   |
   v
Invoice
   |
   v
Payment
   |
   +--> Ledger
   |
   +--> Report
```

### Deliverable

`docs/PHASE4_FINANCIAL_INTEGRATION_REPORT.md`

### Exit

Every financial action intentionally offered by v1 UI is backed by real domain/API/MySQL behavior and critical integrity rules have automated evidence.

**STOP and request approval for Phase 5.**

---

## Phase 5 — Remaining UI Integration & Removal of Dual Truth

**Objective:** make the application one coherent product.

### Work

Finish integration for current UI areas such as:

- Dashboard/read models;
- Preferences;
- Notifications;
- Audit log;
- account/profile UI if in scope;
- remaining reports/alerts;
- navigation/guards.

Classify every remaining browser-storage key:

- `REMOVE — server business truth`
- `KEEP — non-sensitive UI preference`
- `KEEP TEMPORARILY — documented exception`
- `DELETE — legacy/mock`

Search final frontend for mock imports, fixture dependencies, fake auth, duplicate business logic and dead static-only paths.

### Deliverable

`docs/PHASE5_FULL_FRONTEND_MIGRATION_REPORT.md`

### Exit

- No visible v1 business feature silently uses mock/local durable truth.
- Remaining browser storage is documented and non-authoritative.
- Full UI operates against Django/MySQL.
- Core E2E journeys pass.

**STOP and request approval for Phase 6.**

---

## Phase 6 — CI, Security, Synthetic Demo Data & Polish

**Objective:** make the integrated product a repeatable release candidate.

### CI

Frontend job:

- deterministic dependency install;
- validation;
- frontend tests;
- relevant browser/build checks.

Backend job:

- pinned Python runtime;
- **MySQL service container matching target major version**;
- Django checks;
- migration-drift check;
- migrations;
- full MySQL suite.

Do not substitute SQLite.

### Security/dependencies

- Review npm advisories deliberately.
- Complete Python dependency audit.
- No blind `--force` upgrades.
- Verify secrets via environment, session/cookie settings, CSRF, hosts, HTTPS assumptions, sensitive logging, tenant isolation and demo permissions.

### Demo data

Public data must be clearly synthetic.

Use visibly fictional names, organizations, identifiers, invoices and project descriptions. Prefer reserved/example-style email domains where practical.

Show inside the app:

> **Demo environment — synthetic data only**

Create a repeatable seed/reset approach without unnecessary async infrastructure.

### Polish

- Empty states.
- Error states.
- Loading feedback.
- Form feedback.
- Responsive checks.
- Accessibility basics.
- Consistent navigation.

### Deliverable

`docs/PHASE6_RELEASE_CANDIDATE_QUALITY_REPORT.md`

### Exit

CI green, synthetic data confirmed, no open P0/P1, security/dependency posture accepted, product ready for hosting evaluation.

**STOP and request approval for Phase 7.**

---

## Phase 7 — Zero-Cost Landing & Deployment Candidate

**Objective:** publish the integrated portfolio demo at **USD 0/month** without bending the architecture around a provider.

### Landing candidate

**Cloudflare Pages**.

Landing includes:

- product hook;
- problem/value;
- screenshots;
- features;
- architecture;
- stack;
- limitations/demo disclaimer;
- GitHub;
- `Launch Demo`.

No API calls from the landing.

### Django application host candidates

Re-check current terms at deployment time.

#### Render Free

Pros:
- official Django docs;
- free Python web service;
- Git deployment;
- HTTPS/custom domains.

Known limitations:
- sleeps after 15 minutes idle;
- wake can take about one minute;
- ephemeral filesystem;
- explicitly not production infrastructure.

#### Koyeb Free

Candidate if still available/compatible:
- 512 MB RAM;
- 0.1 vCPU;
- 2 GB SSD;
- scales to zero after 1 hour idle;
- deep-sleep wake typically 1–5 seconds.

Benchmark the actual application before choosing.

### Managed MySQL candidate

**Aiven Free MySQL**, after compatibility proof.

At roadmap creation time:

- 1 node;
- 1 CPU;
- 1 GB RAM;
- 1 GB disk;
- backups;
- 76 max connections;
- no SLA;
- may power off inactive free services.

Target MySQL 8.4 unless availability changes.

Verify TLS/certificates, migration/trigger privileges, collation, `READ COMMITTED`, connection limits and access restrictions/allowlisting where feasible.

### Django deployment requirements

Before public launch:

- production WSGI/ASGI server;
- no `runserver`;
- environment secrets;
- `DEBUG=False`;
- correct `ALLOWED_HOSTS`;
- HTTPS;
- secure cookies as appropriate;
- static collection/serving;
- logging/error reporting;
- tested migration procedure;
- `manage.py check --deploy`.

Do not assume paid pre-deploy features exist on a free plan.

### Deliverable

`docs/PHASE7_DEPLOYMENT_REPORT.md`

### Exit

- Landing reachable.
- Demo app reachable.
- Hosted Django/MySQL integration works.
- Cold-start behavior measured and accepted.
- Cost is USD 0/month under selected plans.
- Limitations documented.
- No production-SaaS claim.

**STOP and request approval for Phase 8.**

---

## Phase 8 — Documentation, v1.0 Release & Feature Freeze

**Objective:** turn the working deployment into a finished portfolio artifact.

### Work

Align public docs with observed behavior:

- `README.md`
- product overview
- decisions/ADR
- architecture
- local run instructions
- demo limitations
- synthetic-data statement
- CI/testing evidence
- deployment topology
- security boundaries.

Remove stale statements such as “no backend/API” once they are false.

Prepare:

- final screenshots;
- architecture diagram;
- project description;
- demo/source URLs;
- portfolio entry;
- LinkedIn material.

### v1.0 Definition of Done

- [ ] Django/MySQL runtime proof reproducible.
- [ ] Auth/session/workspace integrated.
- [ ] Intentional Client/Service/Category behavior backend-backed.
- [ ] Proposal/Project lifecycle integrated.
- [ ] Financial UI in v1 backend-backed.
- [ ] Remaining visible v1 modules have one coherent source of truth.
- [ ] Browser storage is non-authoritative/documented.
- [ ] Critical E2E journeys pass.
- [ ] MySQL-backed CI passes.
- [ ] Synthetic demo data verified.
- [ ] No open P0/P1.
- [ ] Dependency/security baseline accepted.
- [ ] Landing and demo public.
- [ ] Public docs match runtime.
- [ ] Demo limitations explicit.
- [ ] `v1.0.0` tag/release created.

### Feature freeze

After v1.0 accept only:

- real bugs;
- security fixes;
- compatibility/dependency maintenance;
- deployment reliability fixes;
- improvements supported by actual user/recruiter feedback.

---

## 8. Mandatory execution protocol

Every phase:

1. Read this roadmap.
2. Fetch current remote state.
3. Verify current `origin/main`.
4. Inspect related existing branches/worktrees before duplicating work.
5. Use a clean isolated branch/worktree.
6. Preserve dirty/stale worktrees until explicitly reviewed.
7. Define the smallest bounded phase change.
8. Implement only that phase.
9. Run scoped tests during work.
10. Run the phase validation suite.
11. Perform read-only review of the final diff.
12. Create/update the phase report.
13. Report evidence and unresolved problems.
14. **STOP.**
15. Wait for explicit approval before the next phase.

A phase is complete only when its exit criteria have evidence.

## 9. Git/change discipline

- Never develop directly on `main`.
- Never wholesale-merge stale historical branches.
- Compare useful unmerged work against current main before reuse.
- Keep PRs reviewable.
- Prefer conventional commits.
- Never hide failing tests.
- Do not fix unrelated code during a bounded phase.
- Do not delete old worktrees without explicit approval.
- No secrets in commits, reports, logs, screenshots or fixtures.

## 10. Decision rules

### If a phase reveals a bug
Fix it if it blocks the current phase and stays within the approved architecture.

### If hosting incompatibility appears
Diagnose the concrete incompatibility first. Do not immediately replace MySQL, rewrite frontend or adopt a new API framework.

### If a UI action lacks a backend command
Add the smallest domain-correct API command needed by that UI action.

### If backend functionality is not exposed in UI
It does not automatically require a public endpoint for v1.

### If a feature is historical/roadmap-only
Do not revive it without explicit approval.

## 11. Zero-cost research snapshot

Re-check these official sources during Phase 7 because free tiers can change.

### Django 5.2
- MySQL 8.0.11+ supported.
- InnoDB recommended.
- Production deployment requires WSGI/ASGI, static-file handling and deployment checks.

Official:
- https://docs.djangoproject.com/en/5.2/ref/databases/
- https://docs.djangoproject.com/en/5.2/howto/deployment/

### Aiven Free MySQL
Current published free-tier characteristics at roadmap creation:
- no-card signup;
- indefinite free use;
- 1 CPU / 1 GB RAM / 1 GB disk;
- backups;
- 76 max connections;
- no SLA;
- inactivity power-off possible;
- MySQL 8.4 is a supported LTS line for new deployments.

Official:
- https://aiven.io/docs/products/mysql/concepts/mysql-free-tier
- https://aiven.io/docs/products/mysql/howto/manage-mysql-version
- https://aiven.io/docs/products/mysql/reference/version-lifecycle

### Render Free
- free Python/Django web service;
- hobby/testing/preview posture;
- spins down after 15 minutes idle;
- wake about one minute;
- ephemeral filesystem.

Official:
- https://render.com/docs/free
- https://render.com/docs/deploy-django
- https://render.com/docs/deploys

### Koyeb Free
- one free web instance;
- 512 MB RAM / 0.1 vCPU / 2 GB SSD;
- scales to zero after one hour idle;
- deep-sleep wake typically 1–5 seconds.

Official:
- https://www.koyeb.com/docs/reference/instances
- https://www.koyeb.com/docs/run-and-scale/scale-to-zero

### Cloudflare Pages
- preferred for the separate static landing;
- Free currently allows 500 builds/month and 20,000 files;
- static asset requests are free/unlimited under current terms.

Official:
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/functions/pricing/

### GitHub Actions
Use MySQL service containers for reproducible integration tests.

Official:
- https://docs.github.com/en/actions/tutorials/use-containerized-services

## 12. Final product boundary

FreelanceFlow v1.0 is finished when:

> every intentional existing product capability in the final demo has one coherent implementation path; the application runs on Django/MySQL; the UI no longer lies about persistence; CI proves critical behavior; synthetic demo data is safe; public deployment works; documentation is truthful; and the project is frozen.

It does **not** need to become commercial production infrastructure.

## 13. Approved sequence

```text
Phase 0  Runtime/MySQL proof
   ↓
Phase 1  Auth + Session + Workspace
   ↓
Phase 2  Clients + Services + Categories
   ↓
Phase 3  Proposals + Projects
   ↓
Phase 4  Fiscal + Invoices + Payments + Ledger + Reports
   ↓
Phase 5  Remaining UI + remove dual truth
   ↓
Phase 6  CI + Security + Synthetic Demo + Polish
   ↓
Phase 7  Zero-cost Landing + Deployment
   ↓
Phase 8  v1.0 Release + Feature Freeze
```

**Do not skip phase gates. Do not start the next phase without explicit approval.**
