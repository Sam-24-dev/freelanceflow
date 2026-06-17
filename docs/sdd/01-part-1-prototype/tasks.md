# Tasks: Parte 1 - Prototipo HTML/CSS/JS

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 150-350 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No por ahora |
| Suggested split | Fase HTML -> Fase CSS -> Fase JS |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

## Phase 1: HTML foundation

- [x] 1.1 Revisar `docs/prototype/DESIGN.md` y `SCREEN_PLAN.md` antes de modificar HTML.
- [ ] 1.2 Elegir las pantallas del primer prototipo: Landing, Dashboard, Transactions, Mobile Home, Mobile Add Transaction.
- [x] 1.3 Revisar `index.html` contra `requirements.md` y confirmar secciones mínimas.
- [x] 1.4 Añadir estructura faltante para cuentas, clientes/proyectos y presupuestos si aplica.
- [ ] 1.5 Verificar que no haya `<style>`, `style=` ni `<script>` durante la fase HTML.
- [x] 1.6 Validar enlaces internos de navegación contra IDs existentes.

## Phase 2: CSS separado

- [ ] 2.1 Revisar `docs/assets/ASSET_USAGE.md` y seleccionar hero/iconos antes de diseñar.
- [x] 2.2 Crear `css/styles.css` y enlazarlo desde `index.html`.
  - Nota: cumplida mediante `assets/css/styles.css`, que es la ruta real del prototipo actual.
- [ ] 2.3 Definir layout responsive base para header, main, cards/secciones y formularios.
- [x] 2.4 Añadir estilos de foco visible y estados básicos de formulario.
- [ ] 2.5 Validar contraste, lectura móvil y peso de assets usados.

## Phase 3: JavaScript separado

- [ ] 3.1 Crear `js/app.js` y enlazarlo desde `index.html`.
- [x] 3.2 Capturar envío del formulario de transacciones sin recargar página.
- [x] 3.3 Validar tipo, monto, categoría y fecha.
- [x] 3.4 Calcular ingresos, gastos y balance simulados.
- [x] 3.5 Renderizar una lista simple de transacciones.

## Phase 4: Verification and handoff

- [x] 4.1 Probar flujo completo manualmente en navegador.
- [ ] 4.2 Documentar limitaciones del prototipo.
- [ ] 4.3 Actualizar `FreelanceFlow-Specification.md` si cambia el alcance.
- [ ] 4.4 Preparar lista de aprendizajes para Parte 2.
