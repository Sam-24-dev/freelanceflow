# FreelanceFlow Backend Roadmap

**Status:** Active engineering roadmap. Baseline: `origin/main` `8524c84` (Audit Slice C merged).

> This document governs the backend program. Static frontend documentation remains a historical reference until its module is deliberately migrated.

## Product goal

FreelanceFlow is becoming a professional B2B, multi-tenant SaaS for the commercial and financial lifecycle of freelance work. The backend owns durable business facts, authorization, tenant isolation, financial integrity, auditability, and delivery contracts. The existing static frontend is a migration reference, never the source of truth.

## Architectural direction

FreelanceFlow will remain a **modular Django monolith** until a concrete scale, isolation, or operational need proves otherwise.

```text
Web frontend / React Native
          v
Versioned Django API
          v
Domain services and authorization boundaries
          v
MySQL durable data and database constraints
          v
Async workers only for proven background jobs
```

This is deliberate: a modular monolith keeps domain rules, transactions, migrations, testing, and tenant policy in one deployable unit while the product is still evolving. Microservices, Kafka, Kubernetes, WebSockets, and a database migration are not default milestones.

## Non-negotiable engineering rules

- Every durable business model is scoped to `Workspace`; every query and command starts from the active Workspace context.
- A superuser without a valid Membership has no tenant bypass.
- `OWNER` and `OPERATIONAL` are business roles unless a domain explicitly defines a stricter rule. Audit reads are intentionally `ADMINISTRATIVE` only.
- Money uses `Decimal`, never `float`; USD remains canonical until a dedicated FX decision.
- Financial and commercial history is snapshot-based and immutable after its lifecycle boundary.
- Model validation improves ergonomics; database constraints, triggers, transactions, idempotency keys, and locks protect durable integrity.
- Migrations are forward-only and are validated both by Django and MySQL.
- Browser `localStorage`, `sessionStorage`, mock JSON, and static frontend state are reference-only, never backend truth.
- Every change is isolated, tested, independently reviewed, and kept within a reviewable delivery size.

## Completed backend foundation

| Area | Delivered outcome |
|---|---|
| Accounts | Custom email-first User model. |
| Workspaces | Workspace/Membership tenant boundary, explicit active context, roles, and last-OWNER protection. |
| Clients | Tenant-scoped client records, normalization, archive/restore, and protected commercial history. |
| Services | Tenant-scoped USD catalog, decimal rates, immutable future snapshots, and archive/restore. |
| Proposals | Frozen line snapshots, lifecycle, derived totals, tenant isolation, and durable post-send immutability. |
| Projects | Atomic, idempotent conversion from accepted Proposals with immutable origin. |
| Fiscal | Immutable, sequential, tenant-scoped fiscal configuration. |
| Invoices and payments | Issuance lifecycle, fiscal snapshots, idempotent payment/reversal ledger, and direct-SQL guards. |
| Categories and ledger | Tenant-scoped categories plus immutable, idempotent financial ledger entries. |
| Reports | Read-only cash/activity report services based on durable streams. |
| Audit | Immutable source events for Workspace/Membership mutations and administrative-only tenant-scoped reads. |

## Delivery sequence

### 2.2B — Durable preferences

**Next implementation slice.** Persist a small preference profile scoped to the active Membership and Workspace.

- Store only approved settings such as display/timezone and future notification channel choices.
- Re-fetch current Membership on every command and read.
- No notification generation, email sending, scheduler, API, frontend migration, or browser-state import.
- Decide explicit defaults and whether revoking a Membership removes or protects its preferences before implementation.

**Why first:** it fixes the unsafe global browser-state boundary without inventing notification events or delivery infrastructure.

### 2.2C — In-app notifications

Create durable, tenant-safe in-app notification state only after the product defines:

- recipient identity: Membership versus User;
- event sources that are allowed to create notifications;
- read/unread and archival lifecycle;
- authorization for listing and acknowledging a notification;
- retention and privacy policy.

Notification generation must be explicit domain behavior, not a side effect of frontend data or generic Audit events. Email is not part of this slice.

### 2.2D — Async delivery and email

Add an outbox-based asynchronous boundary only when an approved job exists: email delivery, scheduled reminders, exports, proposal expiry, or retryable integrations.

- Introduce Celery and Redis together with the first real background workload.
- Persist an idempotent outbox record in the source transaction.
- Dispatch only after commit; workers are retryable and observable.
- Choose an email provider and delivery policy in a dedicated decision record.

### 2.3 — Authentication delivery and versioned API

Introduce Django REST Framework after core domains and preference/notification authorization are stable.

- Version endpoints under `/api/v1/`.
- Resolve Workspace only from trusted server-side context; clients never select a tenant by passing an arbitrary ID.
- Define authentication, default-deny permissions, pagination, throttling, validation, error contract, and API documentation.
- Expose one domain at a time, beginning with identity/workspace context and then Clients/Services.

### 2.4 — Frontend migration

Replace static mock/localStorage modules one at a time with the versioned API.

- Keep each migration vertical: backend endpoint, frontend client, UI state, tests, and rollback plan.
- Do not run a big-bang frontend rewrite.
- Remove browser persistence only after the replacement flow is proven.

### 2.5 — Mobile and production readiness

React Native consumes the same versioned API; it does not duplicate commercial rules.

Production readiness is a separate, evidence-based delivery:

- containerized application and repeatable migrations;
- HTTPS, secure cookies, environment-only secrets, `DEBUG=False`, `ALLOWED_HOSTS`, and `check --deploy`;
- managed MySQL backups plus restore drills;
- structured logs, error monitoring, health checks, metrics, and alerting;
- CI/CD with tests, migration checks, dependency updates, and deployment verification;
- static/media storage and retention policy;
- incident, rollback, and release documentation.

## Technology adoption checkpoints

| Technology | Adopt when | Not before |
|---|---|---|
| Django REST Framework | There is an approved API contract and stable domain behavior to expose. | The current domain-first phase. |
| Celery + Redis | A durable, retryable background job is approved. | Preferences or in-app state alone. |
| Email provider | A product decision defines recipients, templates, consent, retry, and delivery evidence. | Merely adding an email preference toggle. |
| WebSockets | A validated real-time requirement cannot be met by ordinary polling. | Initial in-app notifications. |
| Object storage | User-uploaded documents become a durable product feature. | Static mock assets. |
| PostgreSQL | Measured MySQL limitations, an isolation/compliance requirement, or a separately approved migration plan exists. | Speculation. |
| Microservices/Kubernetes/Kafka | Independent scaling, deployment, ownership, or throughput requirements are demonstrated. | The modular-monolith phase. |

## Quality gates for every delivery

1. Read-only architecture/design decision with explicit scope and non-goals.
2. Isolated branch/worktree and bounded implementation with RED -> GREEN tests.
3. Runtime validation: Django checks, migration drift/plan, scoped tests, full suite when applicable, MySQL integrity evidence, diff check, and test-database teardown.
4. Independent read-only review of the exact candidate.
5. Issue, conventional commit, PR, squash merge, and post-merge verification against `origin/main`.

## Definition of professional readiness

FreelanceFlow is production-ready only when every published API path preserves active-Workspace isolation, authorization, financial integrity, idempotency, auditability, observability, recovery, and tested backups. A successful merge is not production proof by itself.

## Scope discipline

This roadmap is an architectural guide, not permission to build all milestones at once. Each section requires its own ADR, bounded allowlist, test plan, independent review, and delivery approval.