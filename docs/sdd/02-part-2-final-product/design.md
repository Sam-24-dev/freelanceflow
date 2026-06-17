# Design: Parte 2 - Producto Final Funcional

## Technical Approach

La Parte 2 implementa una arquitectura cliente-servidor: frontend web React consume una API DRF; móvil Expo consume la misma API; PostgreSQL persiste el dominio financiero. El backend concentra reglas de negocio, autenticación y consistencia de saldos.

## Architecture Decisions

| Decisión | Elección | Alternativas consideradas | Razón |
|---|---|---|---|
| Frontend web | React + Vite + Tailwind | HTML puro, Next.js | React/Vite es suficiente para SPA académica y dashboard. |
| Backend | Django REST Framework | FastAPI | DRF prioriza ecosistema académico, ORM maduro y rapidez CRUD. |
| DB | PostgreSQL | SQLite, MySQL | ACID y consultas analíticas más sólidas para finanzas. |
| Mobile | React Native + Expo | App nativa, Flutter | Reutiliza patrones React y acelera pruebas en dispositivo. |
| Auth | JWT | Sesiones server-side | API stateless compartida por web y móvil. |

## System Architecture

```text
Web React + Tailwind          Mobile Expo
        |                         |
        +------ HTTPS / JSON -----+
                  |
            Django REST API
                  |
        Domain services / ORM
                  |
              PostgreSQL
```

## Backend Domains

| App Django sugerida | Responsabilidad |
|---|---|
| `users` | Registro, perfil y autenticación. |
| `accounts` | Cuentas financieras y saldos. |
| `clients` | Clientes y proyectos. |
| `transactions` | Ingresos, gastos y categorías. |
| `budgets` | Presupuestos mensuales. |
| `reports` | Consultas agregadas para dashboard. |

## API Contracts iniciales

```text
POST   /api/auth/login/
POST   /api/auth/refresh/
GET    /api/accounts/
POST   /api/accounts/
GET    /api/clients/
POST   /api/projects/
GET    /api/categories/
POST   /api/transactions/
GET    /api/reports/monthly-summary/
GET    /api/budgets/
POST   /api/budgets/
```

## Data Consistency

- Las escrituras de transacciones deben ejecutarse dentro de transacciones atómicas.
- El saldo de cuenta no debe calcularse en el cliente.
- Los reportes pueden derivarse desde transacciones para auditoría.
- Las operaciones críticas deben pertenecer al usuario autenticado.

## File Changes previstos

| Ruta | Acción | Descripción |
|---|---|---|
| `backend/` | Crear | Proyecto Django + DRF. |
| `frontend/` | Crear | Proyecto React/Vite/Tailwind. |
| `mobile/` | Crear | Proyecto Expo. |
| `docs/sdd/02-part-2-final-product/*` | Mantener | Requisitos, diseño y tareas finales. |

## Testing Strategy

| Capa | Qué probar | Enfoque |
|---|---|---|
| Backend unit | Modelos, serializers, services | pytest/Django tests. |
| Backend integration | Endpoints auth/transacciones/reportes | APIClient/pytest. |
| Frontend | Componentes, formularios, estados | Testing Library cuando se configure. |
| E2E | Login, crear cuenta, registrar transacción, ver dashboard | Playwright cuando exista app servida. |
| Mobile | Registro rápido y consumo API | Expo/manual inicial; tests después. |

## Migration / Rollout

Primero backend y modelo de datos; luego frontend web; después móvil. PostgreSQL MCP se configurará al iniciar esta parte.

## Open Questions

- [ ] Definir si la app web será SPA pura o tendrá routing avanzado.
- [ ] Definir hosting/despliegue académico.
- [ ] Definir si se manejará multi-moneda en v1 o se limita a una moneda.
