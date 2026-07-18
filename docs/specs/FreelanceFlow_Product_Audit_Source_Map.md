# Mapa verificable de fuentes de FreelanceFlow — Fase 1

Public-safe normalization: machine-local metadata was generalized without changing product evidence or business conclusions.
> **Corte verificado:** 2026-07-18 (America/Guayaquil)
> **Snapshot analizado:** `origin/main` en `097d0a2cef3455a6b7956c1fe0bb3c792f19f287`
> **Alcance:** inventario y clasificación de fuentes. No incluye auditoría funcional, arquitectura, requisitos ni historias de usuario.

## 1. Estado y SHAs de Git

### 1.1 Repositorio original

| Dato | Resultado | Evidencia |
|---|---|---|
| Ruta | `<repository-root>` | Ruta solicitada y `git worktree list --porcelain` |
| Remoto | `origin https://github.com/Sam-24-dev/freelanceflow.git` | `git remote -v` |
| `main` local | `99c3f62fe01f4dd2ee6780d94f82b160014d6ec2` | `git rev-parse main` |
| `origin/main` conocido antes de fetch | `c4459d19f75f9f40e6af2a7bbd53773ea3a0d0de` | `git rev-parse origin/main`, antes de `git fetch` |
| `origin/main` después de fetch | `097d0a2cef3455a6b7956c1fe0bb3c792f19f287` | `git fetch origin --prune`; `git rev-parse origin/main` |

El worktree original contenía cambios locales ajenos al alcance. Fueron preservados sin modificación y el análisis se realizó en un worktree aislado.

No se ejecutaron `pull`, `merge`, `rebase`, `reset`, `clean`, `stash` ni `checkout` sobre este worktree.

### 1.2 Worktree aislado utilizado

| Dato | Resultado | Evidencia |
|---|---|---|
| Ruta | `<audit-worktree>` | `git worktree add` y `git worktree list --porcelain` |
| Rama | `docs/product-requirements-baseline` | `git branch --show-current` |
| Base y HEAD inicial | `097d0a2cef3455a6b7956c1fe0bb3c792f19f287` | `git rev-parse HEAD` |
| Upstream | `origin/main` | `git rev-parse --abbrev-ref --symbolic-full-name "@{u}"` |
| Estado antes del documento | Limpio | `git status --short` sin salida |

La rama y la ruta no existían antes de su creación; se verificaron con `git show-ref --verify refs/heads/docs/product-requirements-baseline` y `Test-Path`.

## 2. Diferencias entre `main` local y `origin/main`

`main` local y `origin/main` **no estaban sincronizados** después del fetch.

| Medición | Resultado | Evidencia |
|---|---:|---|
| Commits exclusivos de `main` local | 0 | `git rev-list --left-right --count main...origin/main` → `0 12` |
| Commits exclusivos de `origin/main` | 12 | Mismo comando |
| Merge-base | `99c3f62fe01f4dd2ee6780d94f82b160014d6ec2` | `git merge-base main origin/main` |
| Rutas distintas | 107 | `git diff --name-status main..origin/main` |
| Rutas agregadas | 83 | Agrupación de la salida anterior |
| Rutas modificadas | 9 | Agrupación de la salida anterior |
| Rutas eliminadas | 15 | Agrupación de la salida anterior |

El merge-base coincide con `main` local; por evidencia Git, `main` local está exactamente 12 commits detrás y no diverge con commits propios.

Commits presentes en `origin/main` y ausentes de `main` local:

```text
097d0a2 feat(account): add profile module (#11)
c4459d1 feat(notifications): add notification center (#9)
855006b feat(settings): add billing preferences module (#7)
5ada92a feat(fiscal): add estimated tax configuration (#6)
79760cc feat(proposals): add commercial proposal workflow (#5)
6f7f540 feat(services): add operational service catalogue (#4)
99d4ae0 feat(categories): add expense category management (#3)
94bc8bb Merge pull request #2 from Sam-24-dev/feat/access-bitacora-product
d4f45d0 feat: add profile access and activity log
f5c7cbc Delete AGENTS.md
0865d80 Merge pull request #1 from Sam-24-dev/refactor/product-ui-redesign
8b40dcf refactor: trim prototype to core phase 1 demo
```

Las diferencias incluyen la migración de páginas raíz hacia `pages/`, nuevos modelos/controladores/tests y la eliminación de `AGENTS.md` del snapshot remoto. La lista verificable completa se obtiene con `git diff --name-status main..origin/main`.

## 3. Criterios de clasificación

| Clasificación | Uso en este mapa |
|---|---|
| **CONFIRMADA** | Existencia, ausencia, enlace o estado demostrado directamente en el snapshot o por Git. No implica validación funcional. |
| **SECUNDARIA** | Handoff, índice, catálogo o contexto útil que no es evidencia runtime primaria. |
| **POSIBLEMENTE OBSOLETA** | Fuente cuyo estado o referencias quedaron detrás del snapshot actual. |
| **EN CONFLICTO** | Afirmación que contradice directamente otra fuente o el árbol actual. |
| **PENDIENTE DE VERIFICACIÓN** | Fuente futura o punto que requiere análisis posterior para concluir. |

## 4. Tabla de fuentes documentales

### 4.1 `docs/specs/`

| Fuente | Clasificación | Evidencia |
|---|---|---|
| `docs/specs/FreelanceFlow_Context_Pack_v4.md` | CONFIRMADA | Se identifica como “Estado oficial consolidado” (`:1-2`) y separa la Fase 1 frontend mock de backend/API/móvil (`:15-21`). Se confirma su presencia en HEAD `097d0a2`. |
| `docs/specs/FreelanceFlow_Catalogo_Formularios_v1.md` | SECUNDARIA | Declara derivación del Context Pack v3 (`:3-9`) y conserva decisiones abiertas (`:664-670`). |
| `docs/specs/FreelanceFlow_Catalogo_Elementos_Visuales_v1.md` | SECUNDARIA | Se presenta como catálogo derivado/metodológico (`:3-12`); P-34/P-35/P-36 siguen sin definición (`:362-379`). |
| `docs/specs/FreelanceFlow-Specification.md` | EN CONFLICTO | Formaliza `Cuentas` como entidad (`:50-66`); el Context Pack v4 la deja sin confirmación y pendiente (`FreelanceFlow_Context_Pack_v4.md:137-152`). |
| `docs/specs/PROJECT_NOTES.md` | EN CONFLICTO | Afirma que existen `AGENTS.md`, `docs/assets/*` y otras guías (`:22-46`); `Test-Path` confirma que no existen en este snapshot. También indica que Git debía inicializarse (`:10`) aunque el snapshot está versionado. |

### 4.2 `docs/sdd/`

| Fuente | Clasificación | Evidencia |
|---|---|---|
| `docs/sdd/README.md` | SECUNDARIA | Índice operativo y reglas de mantenimiento (`:1-40`); no demuestra el estado runtime. |
| `docs/sdd/00-project-context.md` | EN CONFLICTO | Presenta Cuenta como entidad (`:13-23`), frente al pendiente del Context Pack v4 (`:137-152`). |
| `docs/sdd/01-part-1-prototype/requirements.md` | EN CONFLICTO | Exige dashboard, transacciones y clientes dentro de `index.html` (`:13-24`); el `index.html` actual es una landing que enlaza a `pages/acceso.html` (`index.html:54-73`). |
| `docs/sdd/01-part-1-prototype/design.md` | POSIBLEMENTE OBSOLETA | Propone `css/styles.css` y `js/app.js` (`:27-34`), rutas inexistentes en el snapshot, y deja abiertas decisiones ya materializadas (`:64-68`). |
| `docs/sdd/01-part-1-prototype/tasks.md` | POSIBLEMENTE OBSOLETA | Mantiene tareas incompletas y referencias inexistentes como `docs/assets/ASSET_USAGE.md` y `js/app.js` (`:19-49`). |
| `docs/sdd/02-part-2-final-product/requirements.md` | PENDIENTE DE VERIFICACIÓN | Describe el sistema futuro con backend/API/móvil (`:3-76`); esas capas no están en el snapshot. |
| `docs/sdd/02-part-2-final-product/design.md` | PENDIENTE DE VERIFICACIÓN | Propone React, DRF, PostgreSQL y Expo (`:3-29`, `:65-86`); no se evalúa su vigencia en esta fase. |
| `docs/sdd/02-part-2-final-product/tasks.md` | PENDIENTE DE VERIFICACIÓN | Sus tareas futuras siguen sin marcar (`:19-64`); `backend/`, `frontend/` y `mobile/` no existen. |

### 4.3 `docs/prototype/`

| Fuente | Clasificación | Evidencia |
|---|---|---|
| `docs/prototype/ACCOUNT_PROFILE_IMPLEMENTATION_HANDOFF.md` | SECUNDARIA | Handoff previo; mantiene `acceso.html` como autoridad y difiere autenticación (`:3-10`, `:25-47`). |
| `docs/prototype/AJUSTES_IMPLEMENTATION_HANDOFF.md` | SECUNDARIA | Contrato previo de implementación con alcance aprobado (`:3-12`, `:30-37`, `:99-116`). |
| `docs/prototype/BRAND_PROMPTS.md` | CONFIRMADA | Lista assets finales (`:3-30`); los paths declarados existen bajo `img/brand/`. |
| `docs/prototype/CATEGORIES_IMPLEMENTATION_HANDOFF.md` | SECUNDARIA | Handoff de alcance aprobado anterior a la implementación (`:3-34`, `:208-268`). |
| `docs/prototype/DESIGN.md` | SECUNDARIA | Dirección visual y plan de pantallas (`:3-5`, `:103-298`); no prueba estado runtime. |
| `docs/prototype/FISCAL_CONFIGURATION_IMPLEMENTATION_HANDOFF.md` | SECUNDARIA | Contrato de diseño/implementación (`:3-11`, `:29-41`, `:103-136`). |
| `docs/prototype/NOTIFICATIONS_IMPLEMENTATION_HANDOFF.md` | SECUNDARIA | Se identifica como fuente previa de implementación y referencia parcial a Stitch (`:3-16`, `:28-37`). |
| `docs/prototype/PROPOSALS_IMPLEMENTATION_HANDOFF.md` | SECUNDARIA | Handoff final cuya jerarquía coloca primero el código vigente (`:1-14`, `:27-37`). |
| `docs/prototype/SCREEN_PLAN.md` | POSIBLEMENTE OBSOLETA | Coloca Settings/Profile/Account como “Later” (`:35-40`), pero `pages/ajustes.html` y `pages/cuenta.html` existen. |
| `docs/prototype/SERVICES_IMPLEMENTATION_HANDOFF.md` | SECUNDARIA | Handoff final de módulo con alcance frontend (`:1-21`, `:47-77`). |
| `docs/prototype/STITCH_SCREEN_PROMPTS.md` | POSIBLEMENTE OBSOLETA | Describe Propuestas, Fiscal, Ajustes y Notificaciones como futuros (`:421-505`); sus páginas y controladores existen en HEAD `097d0a2`. |

### 4.4 Contexto y configuración raíz

| Fuente | Clasificación | Evidencia |
|---|---|---|
| `README.md` | EN CONFLICTO | Afirma paridad entre JSON y fallback JS (`:58-65`), pero el fallback no contiene `servicios` ni `propuestas`. El índice/árbol también omite Ajustes, Cuenta y Notificaciones (`:9-23`, `:67-91`). |
| `AGENTS.md` en el snapshot | CONFIRMADA — ausencia | `Test-Path AGENTS.md=False`; `git log main..origin/main` incluye `f5c7cbc Delete AGENTS.md`. El archivo sí existe modificado en el worktree original, por lo que se usó como instrucción de ejecución, no como fuente confirmada de `origin/main`. |
| `package.json` | EN CONFLICTO | Declara scripts reales en `:9-13`, pero `"main": "index.js"` (`:5`) apunta a un archivo inexistente. |
| `package-lock.json` | CONFIRMADA | Lockfile v3 y dependencias declaradas en `:1-16`. |
| `tailwind.config.js` | CONFIRMADA | Su `content` escanea HTML raíz, `pages/` y JavaScript (`:1-6`). |
| `site.webmanifest` | CONFIRMADA | Declara identidad, start URL e icono (`:1-16`); el icono existe. |
| `robots.txt` | CONFIRMADA | Permite rastreo (`:1-2`). |
| `.gitignore` | CONFIRMADA | Define exclusiones de tooling, temporales y builds (`:1-35`). |

## 5. Módulos implementados detectados

**Límite de esta clasificación:** “implementado detectado” significa que existe una página y su JavaScript está enlazado en el snapshot. No significa que el flujo haya sido ejecutado ni aceptado funcionalmente.

| Módulo visible | Clasificación | Evidencia de página | Evidencia de JavaScript |
|---|---|---|---|
| Landing pública | CONFIRMADA | `index.html:26,54-73` | Página estática sin controlador propio. |
| Acceso por perfil | CONFIRMADA | `pages/acceso.html:9,29-33` | `pages/acceso.html:65-66` enlaza `activity-log.js` y `acceso.js`. |
| Dashboard | CONFIRMADA | `pages/dashboard.html:8,122` | `pages/dashboard.html:215-220`. |
| Movimientos | CONFIRMADA | `pages/transacciones.html:9,27,102-176` | `pages/transacciones.html:251-256`. |
| Clientes | CONFIRMADA | `pages/clientes.html:9,25,147-268` | `pages/clientes.html:290-295`. |
| Proyectos | CONFIRMADA | `pages/proyectos.html:9,25,161-259` | `pages/proyectos.html:267-273`. |
| Facturas | CONFIRMADA | `pages/facturas.html:9,26,82,165-241` | `pages/facturas.html:250-257`, incluido PDF/jsPDF. |
| Presupuestos y reportes | CONFIRMADA | `pages/reportes.html:9,25,128-153` | `pages/reportes.html:201-206`. |
| Categorías de gasto | CONFIRMADA | `pages/categorias.html:9,25,110-156` | `pages/categorias.html:175-180`. |
| Servicios | CONFIRMADA | `pages/servicios.html:6,11-24` | Scripts enlazados en `pages/servicios.html:24`. |
| Propuestas | CONFIRMADA | `pages/propuestas.html:5,13-32` | Scripts enlazados en `pages/propuestas.html:32`. |
| Configuración fiscal | CONFIRMADA | `pages/configuracion-fiscal.html:6,11-30` | Scripts enlazados en `pages/configuracion-fiscal.html:30`. |
| Ajustes | CONFIRMADA | `pages/ajustes.html:2-3` | `settings-model.js`, shell, log y controlador en `:3`. |
| Notificaciones | CONFIRMADA | `pages/notificaciones.html:1` | Modelo, loader, log, shell y controlador en `:1`. |
| Mi cuenta / perfil | CONFIRMADA | `pages/cuenta.html:2-3` | `profile-model.js`, shell, log y controlador en `:3`; esta página no prueba una entidad financiera Cuenta. |
| Bitácora administrativa | CONFIRMADA | `pages/bitacora.html:9,21-25` | `pages/bitacora.html:70-72`. |

`assets/js/app-shell.js:34-53` declara 13 destinos operativos y `:78-91` reserva Bitácora al perfil administrativo.

### 5.1 Inventario JavaScript de producto

Se detectaron **32 archivos**, todos clasificados como **CONFIRMADA** por existencia en HEAD y por inclusión en `package.json:13`.

- **Controladores (15):** `acceso.js`, `ajustes.js`, `bitacora.js`, `categorias.js`, `clientes.js`, `configuracion-fiscal.js`, `cuenta.js`, `dashboard.js`, `facturas.js`, `notificaciones.js`, `propuestas.js`, `proyectos.js`, `reportes.js`, `servicios.js`, `transacciones.js`.
- **Modelos (13):** `category-model.js`, `client-model.js`, `dashboard-model.js`, `fiscal-config-model.js`, `invoice-model.js`, `notification-model.js`, `profile-model.js`, `project-model.js`, `proposal-model.js`, `report-model.js`, `service-model.js`, `settings-model.js`, `transaction-model.js`.
- **Compartidos (4):** `activity-log.js`, `app-shell.js`, `invoice-pdf.js`, `mock-data-loader.js`.

Los modelos exponen API CommonJS/browser; ejemplos verificables: `category-model.js:177-178`, `invoice-model.js:216-217` y `report-model.js:448-449`.

### 5.2 Datos mock

| Fuente | Clasificación | Evidencia |
|---|---|---|
| `assets/data/mock-data.json` | CONFIRMADA | Claves y registros presentes en `:8-525`: 1 usuario, 2 clientes, 4 categorías, 3 servicios, 3 proyectos, 5 registros de tiempo, 6 facturas, 3 pagos, 2 gastos, 4 movimientos, 1 presupuesto, 6 propuestas y 3 cuentas auxiliares. |
| `assets/data/mock-data.js` | EN CONFLICTO | Comparación semántica read-only: `SEMANTIC_EQUAL=False`; faltan `servicios` y `propuestas`. `assets/js/mock-data-loader.js:9-20` usa este objeto bajo `file:`. |

### 5.3 Documentado pero no implementado o pendiente

| Estado del mapa | Elemento | Evidencia directa y límite |
|---|---|---|
| Ausencia directa detectada | Registro, login, recuperación/cambio de contraseña y autenticación real | Context Pack `:38-42`; catálogo FRM-001–006; `ACCOUNT_PROFILE_IMPLEMENTATION_HANDOFF.md:7-10` difiere autenticación. `pages/acceso.html:33` es selector de perfil, no formulario de credenciales. |
| Ausencia directa detectada | Portal externo de factura por token | Context Pack `:25-27,42`; no existe una página HTML correspondiente. |
| Futuro documentado | Backend, API, PostgreSQL, React/Vite y Expo | Context Pack `:15-19`; SDD Parte 2; `backend/`, `frontend/` y `mobile/` no existen. |
| Pendiente documental | P-34, P-35 y P-36 | Context Pack `:130-133,156-163` los mantiene sin definición funcional cerrada. |
| Pendiente de decisión | Cuenta financiera como entidad | Context Pack `:137-152`; `pages/cuenta.html` implementa perfil y el mock conserva `cuentas_mock_auxiliar`. No se resuelve la contradicción en esta fase. |
| Pendiente de mapeo funcional | Pantalla independiente de tiempo P-19 | Context Pack `:57-60`; no existe `tiempo.html`, pero Proyectos contiene referencias a horas (`pages/proyectos.html:92,126,218-231`). No se afirma ausencia funcional. |
| Pendiente de mapeo funcional | Pantallas independientes de gastos P-24/P-25 | Context Pack `:64-65`; no existe `gastos.html`, pero Movimientos integra ingresos y gastos (`pages/transacciones.html:6,102-176`). No se afirma ausencia funcional. |

## 6. Índice de pruebas y scripts disponibles

No se ejecutaron pruebas, builds, validadores ni servidores. Esta sección confirma únicamente su disponibilidad.

### 6.1 Scripts de `package.json`

| Script | Comando declarado | Evidencia |
|---|---|---|
| `build:css` | Tailwind minificado | `package.json:10` |
| `watch:css` | Tailwind en modo watch | `package.json:11` |
| `test` | `node --test tests/*.test.cjs` | `package.json:12` |
| `validate` | `node --check` sobre los 32 JS | `package.json:13` |

### 6.2 Pruebas

Se identificaron **25 archivos**, todos **CONFIRMADA** por existencia; no hay resultado de ejecución en esta fase.

- Acceso, shell y actividad: `acceso.test.cjs`, `activity-log.test.cjs`, `app-shell-access.test.cjs`, `bitacora.test.cjs`.
- Categorías: `category-mock-data.test.cjs`, `category-model.test.cjs`, `category-page.test.cjs`.
- Clientes y dashboard: `client-model.test.cjs`, `dashboard-model.test.cjs`.
- Calidad transversal: `encoding.test.cjs`, `tailwind-config.test.cjs`.
- Fiscal y facturas: `fiscal-config-model.test.cjs`, `invoice-model.test.cjs`, `invoice-pdf.test.cjs`.
- Notificaciones, perfil y proyectos: `notification-model.test.cjs`, `profile-model.test.cjs`, `project-model.test.cjs`.
- Propuestas: `proposal-mock-data.test.cjs`, `proposal-model.test.cjs`.
- Reportes: `report-model.test.cjs`.
- Servicios: `service-mock-data.test.cjs`, `service-model.test.cjs`.
- Ajustes: `settings-controller.test.cjs`, `settings-model.test.cjs`.
- Movimientos: `transaction-model.test.cjs`.

## 7. Contexto interno y vigencia

Se revisó el contexto interno persistido del proyecto y se contrastó con evidencia del repositorio.

## 8. Conflictos, posibles obsoletos y vacíos

| Hallazgo | Clasificación | Evidencia |
|---|---|---|
| Fallback mock desincronizado | EN CONFLICTO | JSON contiene Servicios y Propuestas; `mock-data.js` no. |
| Autoridad de agentes ausente del snapshot | EN CONFLICTO | `PROJECT_NOTES.md:24` y handoffs citan `AGENTS.md`; `origin/main` lo eliminó en `f5c7cbc`. |
| Referencias documentales rotas | EN CONFLICTO | `PROJECT_NOTES.md` y SDD citan `docs/assets/*`, `css/styles.css` y `js/app.js`, ausentes. |
| SDD Parte 1 no refleja el árbol actual | POSIBLEMENTE OBSOLETA | Describe una app monolítica en `index.html`; el snapshot usa landing + `pages/` + `assets/`. |
| Entidad Cuenta no reconciliada | EN CONFLICTO | Specification/SDD la formalizan; Context Pack v4 la deja pendiente; Cuenta actual es perfil. |
| Planes/prompts llaman “futuros” a módulos presentes | POSIBLEMENTE OBSOLETA | `SCREEN_PLAN.md` y `STITCH_SCREEN_PROMPTS.md` frente a páginas/controladores existentes. |
| README no refleja el snapshot completo | EN CONFLICTO | Omite Ajustes, Cuenta y Notificaciones y afirma paridad de mocks no demostrada. |
| `package.json` apunta a `index.js` ausente | EN CONFLICTO | `package.json:5` y `Test-Path index.js=False`. |
| `main` local no representa producción remota actual | CONFIRMADA | Está 12 commits detrás de `origin/main` después del fetch. |

Estos hallazgos identifican fuentes que requieren reconciliación; no califican la calidad funcional de los módulos.

## 9. Fuentes que deberán analizarse en la Fase 2

1. `docs/specs/FreelanceFlow_Context_Pack_v4.md` y ambos catálogos, contrastados campo por campo.
2. Las 16 páginas HTML y `assets/js/app-shell.js`.
3. Cada pareja controlador/modelo de los módulos detectados.
4. `assets/data/mock-data.json`, `assets/data/mock-data.js` y `assets/js/mock-data-loader.js`.
5. Los 25 tests como evidencia declarativa de reglas, sin asumir que pasan.
6. Los handoffs específicos de Cuenta, Ajustes, Categorías, Fiscal, Notificaciones, Propuestas y Servicios.
7. `README.md`, `PROJECT_NOTES.md` y SDD únicamente para reconciliar drift; no como hechos actuales sin contraste.
8. El contexto interno persistido relevante debe contrastarse nuevamente con el SHA vigente al iniciar la Fase 2.

## 10. Alcance explícitamente no evaluado todavía

Esta Fase 1 **no**:

- define ni modifica arquitectura;
- deriva requisitos, criterios de aceptación ni historias de usuario;
- determina si los módulos cumplen el negocio documentado;
- ejecuta o interpreta pruebas, builds o validaciones;
- valida navegación, formularios, persistencia, errores o consola en navegador;
- evalúa UX, accesibilidad, seguridad, rendimiento o mantenibilidad;
- decide prioridades, alcance de implementación ni trabajo futuro;
- modifica código, README, mocks, tests o documentación distinta de este archivo;
- inicia una revisión ni un presupuesto de Gentle-AI;
- crea commit, push o PR.

## 11. Conteo de fuentes identificadas

El inventario del snapshot contiene **106 archivos reales + 1 ausencia verificada (`AGENTS.md`) = 107 entradas**. Se excluyeron CSS, imágenes y el vendor minificado porque esta fase pidió fuentes documentales, HTML, JavaScript de producto, mocks y tests.

| Tipo de fuente | CONFIRMADA | SECUNDARIA | POSIBLEMENTE OBSOLETA | EN CONFLICTO | PENDIENTE DE VERIFICACIÓN | Total |
|---|---:|---:|---:|---:|---:|---:|
| Documentación | 2 | 11 | 4 | 4 | 3 | 24 |
| Contexto/configuración raíz | 6 | 0 | 0 | 2 | 0 | 8 |
| HTML | 16 | 0 | 0 | 0 | 0 | 16 |
| JavaScript de producto | 32 | 0 | 0 | 0 | 0 | 32 |
| Datos mock | 1 | 0 | 0 | 1 | 0 | 2 |
| Tests | 25 | 0 | 0 | 0 | 0 | 25 |
| **Subtotal repositorio** | **82** | **11** | **4** | **7** | **3** | **107** |
| Contexto interno relevante | 5 | 0 | 2 | 0 | 0 | 7 |
| **Total de entradas de evidencia** | **87** | **11** | **6** | **7** | **3** | **114** |

Los cuatro scripts de `package.json` se indexan como capacidades dentro de la fuente `package.json`; no se cuentan como archivos adicionales.
