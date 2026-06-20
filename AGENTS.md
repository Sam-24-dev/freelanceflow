# AGENTS.md - FreelanceFlow working rules

This file documents how AI agents should work in this repository.

## Current phase

FreelanceFlow is in **Phase 1: static frontend prototype**.

Allowed:
- HTML, CSS and vanilla JavaScript.
- Local mock data in `assets/data/mock-data.json`.
- Browser-only interactions with `localStorage` when a module needs simulated persistence.

Not allowed in Phase 1:
- Django, databases, APIs or backend code.
- React/Vite implementation unless Phase 2 is explicitly started.
- Unused media, generated experiments or local agent/tooling artifacts.

## Design workflow

1. Define or refine screens visually first in **Figma/Stitch** when the UI is not yet clear.
2. Validate the screen against the official docs in `docs/specs/` and SDD docs in `docs/sdd/`.
3. Convert the approved screen to static HTML/CSS/JS.
4. Validate navigation, forms, mock data and console behavior before calling it complete.

The landing page is already accepted as the public entry screen. Future missing app screens should follow the same visual quality direction: warm fintech/editorial SaaS, clear hierarchy, accessible forms and no generic placeholder UI unless the screen is intentionally out of scope.

## Module integration rules

- Keep business entities aligned with `docs/specs/FreelanceFlow_Context_Pack_v4.md` and the catalogs.
- If an academic requirement adds mandatory fields, integrate them as an extension without breaking the B2B model.
- For clients, personal fields such as `nombres`, `apellidos`, `identificacion`, `estadoCivil` and `celular` represent the **contacto principal / representante legal** of the B2B customer.
- Keep compatibility fields when needed, for example `nombre_razon_social`, `tipo_cliente`, `correo_electronico` and `identificacion_fiscal`.

## Validation before reporting completion

Run the minimum checks available:

```bash
node --check assets/js/dashboard.js
node --check assets/js/clientes.js
python -m json.tool assets/data/mock-data.json
python -m http.server 4177
```

Then verify locally at `http://127.0.0.1:4177/`.

## Repository hygiene

- Commit with conventional commits.
- Do not add AI attribution or `Co-Authored-By` lines.
- Do not commit local agent folders, skill caches, screenshots, videos or unused generated images.
- Keep production-facing assets under `img/brand/` only when they are actually used.
