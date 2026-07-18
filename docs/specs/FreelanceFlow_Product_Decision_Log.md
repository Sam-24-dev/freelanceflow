# Registro de decisiones de producto de FreelanceFlow

## PO-008 — Roles Operativo y Administrativo

| Campo | Valor |
|---|---|
| Estado | APPROVED |
| Fecha | 2026-07-18 |
| Decisor | Product Owner |

### Decisión

- Operativo y Administrativo son roles reales del SaaS objetivo.
- Operativo usa los módulos operativos aprobados.
- Administrativo está restringido a Bitácora según el modelo vigente.
- `sessionStorage` y las guardas frontend actuales son una representación provisional; **NO** constituyen autenticación ni autorización real.

### Implicaciones futuras

La evolución requiere autenticación real y autorización en un límite confiable, con mínimo privilegio y fallo cerrado. PO-006 permanece abierto para credenciales, SSO, recuperación y verificación de identidad. Esta decisión no inventa backend, proveedor de identidad ni stack técnico.

### Relación con el snapshot

Esta es una decisión posterior al snapshot de Fase 5. Supera únicamente el pendiente PO-008 y no reescribe retrospectivamente la auditoría.
