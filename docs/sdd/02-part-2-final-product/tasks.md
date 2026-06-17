# Tasks: Parte 2 - Producto Final Funcional

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 2000+ |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Backend foundation -> API domains -> Frontend web -> Mobile -> Reports/testing |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

## Phase 1: Foundation

- [ ] 1.1 Inicializar Git y activar GGA (`gga init`, `gga install`) cuando el repo esté listo.
- [ ] 1.2 Configurar PostgreSQL MCP antes de trabajar con base de datos real.
- [ ] 1.3 Crear estructura `backend/`, `frontend/`, `mobile/`.
- [ ] 1.4 Definir variables de entorno sin commitear secretos.

## Phase 2: Backend Django/DRF

- [ ] 2.1 Crear proyecto Django y apps de dominio.
- [ ] 2.2 Modelar Usuario, Cuenta, Cliente, Proyecto, Categoría, Transacción y Presupuesto.
- [ ] 2.3 Crear migraciones iniciales y validarlas.
- [ ] 2.4 Implementar JWT con simplejwt.
- [ ] 2.5 Implementar endpoints CRUD mínimos por dominio.
- [ ] 2.6 Implementar servicio atómico para registrar transacciones y actualizar saldos.

## Phase 3: Backend tests and reports

- [ ] 3.1 Probar autenticación y permisos por usuario.
- [ ] 3.2 Probar creación de transacciones ingreso/gasto.
- [ ] 3.3 Probar consistencia de saldo.
- [ ] 3.4 Implementar endpoint de resumen mensual.
- [ ] 3.5 Probar filtros por cliente/proyecto/categoría.

## Phase 4: Frontend web

- [ ] 4.1 Crear app React con Vite y Tailwind.
- [ ] 4.2 Implementar layout base y navegación.
- [ ] 4.3 Implementar login y manejo de tokens.
- [ ] 4.4 Implementar dashboard financiero.
- [ ] 4.5 Implementar formularios de cuentas, clientes, proyectos y transacciones.

## Phase 5: Mobile Expo

- [ ] 5.1 Crear app Expo.
- [ ] 5.2 Implementar autenticación móvil.
- [ ] 5.3 Implementar pantalla de registro rápido de transacción.
- [ ] 5.4 Validar sincronización con API.

## Phase 6: Final verification

- [ ] 6.1 Ejecutar tests backend.
- [ ] 6.2 Ejecutar build frontend.
- [ ] 6.3 Probar flujo e2e web.
- [ ] 6.4 Probar flujo móvil básico.
- [ ] 6.5 Actualizar documentación final y decisiones técnicas.
