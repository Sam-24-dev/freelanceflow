# Phase 0 Runtime Compatibility Report

**Status:** READY FOR REVIEW - Phase 0 runtime/MySQL evidence is complete; Phase 1 has not started.
**Baseline:** `origin/main` and this worktree `HEAD` = `3d2b66622a9eb41fb7d5f478a4acfc761ace1118` after a fresh `git fetch --no-tags origin main`.
**Worktree/branch:** `Proyecto-FreelanceFlow-phase0-runtime-proof` / `chore/phase0-runtime-proof`.
**Evidence labels:** **Observed** = executed against the configured local runtime; **Diagnostic** = non-blocking future-deployment feedback; **Static** = source/branch inspection retained from the initial Phase 0 audit.

## Scope and Safety Boundaries

- Phase 0 only. No Phase 1 code, dependency, migration authoring, deployment, commit, push, PR, merge, or worktree deletion was performed.
- The six required inherited variables were confirmed by name and presence only: `DJANGO_DB_NAME`, `DJANGO_DB_USER`, `DJANGO_DB_PASSWORD`, `DJANGO_DB_HOST`, `DJANGO_DB_PORT`, and `DJANGO_SECRET_KEY`. No values, credentials, connection strings, or secrets were printed or persisted.
- Every Python invocation used the interpreter supplied through `%PY%`. It reported Python `3.11.9`, Django `5.2.17`, and mysqlclient `2.2.8`.
- The configured target was verified internally as the expected local MySQL environment; `SELECT DATABASE()` matched the configured target. No target value was disclosed.
- Before tests, a read-only `information_schema.schemata` check confirmed that `test_freelanceflow_local` did **not** already exist. Therefore no pre-existing test database, session, InnoDB transaction, data lock, metadata lock, writer, or user data was dropped or disturbed.
- Django's configured `ImmutableTriggerSafeDiscoverRunner` created and destroyed only disposable test databases. Final read-only inspection confirmed `test_freelanceflow_local` is absent.

## Runtime and Server Receipts

| Check | Observed result | Terminal result |
| --- | --- | --- |
| Python/Django/mysqlclient imports | Python `3.11.9`; Django `5.2.17`; mysqlclient `2.2.8` | PASS |
| Django connection | Configured local target accepted and `SELECT DATABASE()` matched configuration | PASS |
| `SELECT VERSION()` | `8.4.10` | PASS - MySQL 8.4 |
| Database character set/collation | `utf8mb4` / `utf8mb4_0900_ai_ci` | PASS |
| Client and connection character sets/collation | `utf8mb4`, `utf8mb4`, `utf8mb4_0900_ai_ci` | PASS |
| Transaction isolation | `READ-COMMITTED` | PASS |
| Storage engine | 28/28 application base tables are InnoDB | PASS |
| Pre-test database preflight | `test_freelanceflow_local`: absent | PASS |
| Post-focused-suite database check | `test_freelanceflow_local`: absent | PASS |
| Post-full-suite database check | `test_freelanceflow_local`: absent | PASS |

## Django and Migration Receipts

| Command | Result | Receipt |
| --- | --- | --- |
| `%PY% manage.py check` | PASS | `System check identified no issues (0 silenced).`; exit `0` |
| `%PY% manage.py makemigrations --check --dry-run` | PASS | `No changes detected`; exit `0` |
| `%PY% manage.py showmigrations` (before migrate) | PASS with three pending versioned migrations | `invoices.0003`, `invoices.0004`, `preferences.0001` were the only unapplied entries |
| `%PY% manage.py migrate --plan` | PASS | The plan contained only those three versioned migrations |
| `%PY% manage.py migrate --no-input` | PASS | Applied `invoices.0003_block_void_with_active_payments`, `invoices.0004_enforce_invoice_total_capacity`, and `preferences.0001_initial`; exit `0` |
| `%PY% manage.py showmigrations` (after migrate) | PASS | Every listed migration is `[X]`; exit `0` |

The only persistent-DB mutation in this run was the approved application of those versioned migrations. The two invoice migrations contain their own versioned trigger replacement SQL; no manual SQL or database deletion was used.

## Actual MySQL Constraints and Triggers

Read-only `information_schema` inventory after migration found **170 constraints**: **57 CHECK**, **47 FOREIGN KEY**, **38 UNIQUE**, and **28 PRIMARY KEY**. All 57 CHECK clauses were retrieved and hashed for the terminal receipt. This verifies actual MySQL metadata rather than source declarations alone.

Read-only `information_schema.triggers` inventory found **38 actual triggers**, all `BEFORE` triggers, with each action statement hashed for the terminal receipt:

| Table | Actual triggers |
| --- | --- |
| `audit_auditevent` | `audit_event_immutable_delete`, `audit_event_immutable_update`, `audit_event_validate_insert` |
| `categories_category` | `category_normalize_validate_insert`, `category_normalize_validate_update`, `category_no_delete` |
| `fiscal_fiscalconfiguration` | `fiscal_configuration_immutable_delete`, `fiscal_configuration_immutable_update`, `fiscal_configuration_validate_insert` |
| `invoices_invoice` | `invoice_no_delete`, `invoice_validate_insert`, `invoice_validate_update` |
| `invoices_invoicelineitem` | `invoice_line_no_delete`, `invoice_line_no_update`, `invoice_line_validate_insert` |
| `invoices_invoicesequence` | `invoice_sequence_no_delete`, `invoice_sequence_validate_insert`, `invoice_sequence_validate_update` |
| `ledger_ledgerentry` | `ledger_no_delete`, `ledger_no_update`, `ledger_validate_insert` |
| `notifications_inappnotification` | `notification_no_delete`, `notification_validate_insert`, `notification_validate_update` |
| `payments_payment` | `payment_no_delete`, `payment_no_update`, `payment_validate_insert` |
| `payments_paymentreversal` | `payment_reversal_no_delete`, `payment_reversal_no_update`, `payment_reversal_validate_insert` |
| `projects_project` | `project_no_delete`, `project_source_immutable_on_update`, `project_source_matches_proposal_on_insert` |
| `proposals_proposal` | `proposal_no_commercial_update_after_sent`, `proposal_no_delete_after_sent` |
| `proposals_proposallineitem` | `proposal_line_no_delete_after_sent`, `proposal_line_no_insert_after_sent`, `proposal_line_no_update_after_sent` |

The migration state, metadata inventory, and dedicated immutable-trigger tests below together prove installation and behavior on MySQL 8.4.

## Test Receipts

| Scope | Command | Observed result |
| --- | --- | --- |
| Focused transactions, idempotency, tenant isolation, and APIs | `%PY% manage.py test audit.tests invoices.tests ledger.tests payments.tests notifications.tests api.tests --verbosity 1` | PASS, exit `0`: 217 ordinary tests plus 17 isolated immutable-trigger/concurrency child tests = **220 passed, 14 skipped (234 discovered)**. |
| Complete configured suite | `%PY% manage.py test --verbosity 1` | PASS, exit `0`: 334 ordinary tests in `1215.373s` plus 26 isolated immutable-trigger/concurrency child tests = **346 passed, 14 skipped (360 discovered)**. |

The focused and complete invocations used the configured `ImmutableTriggerSafeDiscoverRunner` without `--keepdb` or parallel execution. Its child work uses synchronous `subprocess.run`; the terminal exit `0` was collected only after every disposable child process completed. The full-suite child evidence covered audit cross-tenant/immutability, category integrity, fiscal concurrency, invoice sequence concurrency, ledger idempotent reversal/integrity, notification duplicate-recipient concurrency, payment capacity/void concurrency, preferences races/integrity, and project conversion atomicity.

## Final MySQL Notification Trigger Gate

- **Preflight:** read-only inspection confirmed `test_freelanceflow_local` was absent. No existing test database was deleted.
- **Temporary process flag:** `FREELANCEFLOW_RUN_MYSQL_NOTIFICATION_TRIGGER_TESTS=1` was set only for the targeted parent process and removed in `finally`; it was absent after the parent exited.
- **Command:** `%PY% manage.py test notifications.tests.NotificationMySqlTriggerTests.test_raw_sql_rejects_public_id_mutation_and_direct_delete notifications.tests.NotificationMySqlTriggerTests.test_membership_delete_cascades_without_a_session_marker notifications.tests.NotificationMySqlTriggerTests.test_cross_workspace_insert_and_variable_spoof_are_rejected --verbosity 2`
- **Terminal receipt:** **3 passed, 0 failed, 0 skipped** (`Ran 3 tests in 7.919s`); parent exit `0`. The runner created and destroyed only `test_freelanceflow_local`.
- **Postflight:** read-only inspection confirmed `test_freelanceflow_local` is absent.

### Complete skipped-test classification

- **5 SQLite-only skips:** do not apply to the MySQL 8.4 target.
- **6 inherited Payments skips:** duplicate evidence already executed by the Payments coverage.
- **3 unique MySQL notification-trigger tests:** executed separately in this gate with the opt-in process flag; **3/3 PASS**.
## Retained Phase 0 Integration Findings

### `feat/frontend-session-bootstrap` (`d70895ccdce3ed4088611786f683e43b80238459`, PR #159)

**Verdict: PARTIAL REUSE; do not merge wholesale.** Its same-origin CSRF-aware API client, login/workspace paths, and browser-rendered workspace controls populated from `GET /api/v1/workspaces/` are reusable only after Phase 1 contract tests. It is not directly reusable because current protected pages still depend on browser-held membership data, and `SessionView.get` still emits `active_workspace: null` despite persisted selection.

### Intended Phase 1 `GET /api/v1/session/` contract

Keep the existing no-store `200` outer envelope `{ "data": { ... } }`. Its `data` payload returns `{ "authenticated": false, "active_workspace": null }` for unauthenticated/expired/malformed sessions; returns authenticated `true` with `null` when no valid selection exists; and serializes only the selected, currently revalidated membership's public ID, name, slug, and role. It must never select a first workspace as fallback, leak a foreign workspace, or turn a stale selection into an error. This is a documented Phase 1 contract only; no Phase 1 implementation was started.

## `check --deploy` Diagnostic

`%PY% manage.py check --deploy` exited `0` and emitted five warnings: `security.W004` (`SECURE_HSTS_SECONDS`), `security.W008` (`SECURE_SSL_REDIRECT`), `security.W012` (`SESSION_COOKIE_SECURE`), `security.W016` (`CSRF_COOKIE_SECURE`), and `security.W020` (empty `ALLOWED_HOSTS`).

These are real deployment-security warnings, not a local Django/MySQL failure. No settings or deployment behavior was changed in Phase 0. They are a mandatory pre-public-deployment item for the later CI/security/deployment phases; HSTS especially must not be enabled casually.

## Known Problems P0-P3

| Priority | Finding | Evidence / disposition |
| --- | --- | --- |
| P0 | None open for Phase 0. | Runtime, migrations, constraints, triggers, focused tests, full suite, and test-database cleanup all passed. |
| P1 | No Phase 0 runtime blocker. Future deployment must resolve the five `check --deploy` security warnings before public hosting. | Diagnostic only in this local, non-deployed phase; no deployment change is authorized here. |
| P2 | `SessionView.get` currently returns `active_workspace: null` despite persisted selection. | Static Phase 1 contract defect; documented above, not implemented. |
| P2 | PR #159 removes browser membership activation while current protected pages still rely on browser membership storage. | Static integration mismatch; partial reuse only. |
| P3 | Immutable-trigger tests use one disposable database process per `TransactionTestCase`. | Observed safe and deterministic, but it lengthens the full suite; retain this protection rather than using `--keepdb` or manual cleanup. |

## Exit Criteria

| Criterion | Result |
| --- | --- |
| Django runtime reproducible | PASS - `%PY%` provides Python 3.11.9, Django 5.2.17, and mysqlclient 2.2.8. |
| MySQL compatibility proven | PASS - live MySQL 8.4.10 connection, utf8mb4/collation, InnoDB, READ-COMMITTED, migrations, constraints, triggers, and runtime tests verified. |
| Migration/test evidence recorded | PASS - zero-drift receipt, versioned migration plan/application, post-migrate all-applied state, focused 234-test receipt, full 360-test receipt, and final 3/3 MySQL notification-trigger receipt. |
| Session/workspace contract unambiguous | PASS - Phase 1 contract documented without implementation. |
| Bootstrap branch verdict | PASS - partial reuse only; no merge. |
| Test database clean after tests | PASS - final read-only check confirms `test_freelanceflow_local` is absent. |
| Phase 0 overall gate | PASS - READY FOR REVIEW. |

## Recommendation: STOP AND REQUEST APPROVAL FOR PHASE 1

Phase 0 is complete. Do not start Phase 1 until explicit approval is given.
