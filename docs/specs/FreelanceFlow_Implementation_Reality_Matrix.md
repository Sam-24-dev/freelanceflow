# FreelanceFlow — Matriz de realidad implementada e integración

Public-safe normalization: machine-local metadata was generalized without changing product evidence or business conclusions.
**Estado: BORRADOR — Fase 3 de 5**
**Snapshot: origin/main 097d0a2cef3455a6b7956c1fe0bb3c792f19f287**
**Validación: estática y automatizada; sin navegador**
**Fecha de corte:** 2026-07-18
**Worktree:** `<audit-worktree>`
**Rama:** `docs/product-requirements-baseline`

> Este documento describe lo que existe y cómo está conectado en el snapshot indicado. No convierte una intención documental, una coincidencia de datos mock ni un enlace entre páginas en una integración real. Las afirmaciones se acompañan de ruta, rango de líneas, comando o evidencia del repositorio.

## 1. Resumen ejecutivo

- El snapshot auditado contiene **16 módulos/pantallas visibles**: una landing pública y 15 páginas bajo `pages/`. Evidencia: `Get-ChildItem -File -Filter '*.html'` y `Get-ChildItem pages -File -Filter '*.html'` ejecutados en `097d0a2`; rutas enumeradas en la sección 4.
- La implementación de producto comprende **32 archivos JavaScript**: 15 controladores de página, 13 modelos y 4 utilidades compartidas. Evidencia: `Get-ChildItem assets/js -File -Filter '*.js'` sobre `097d0a2`; mapa de la sección 17.
- Se detectaron **19 claves de persistencia**, distribuidas en 4 claves de `sessionStorage` y 15 de `localStorage`. Evidencia: contratos enumerados en la sección 5 y rutas de sus lectores/escritores.
- Se inventariaron **25 archivos de prueba** y **141 subpruebas** en la ejecución actual: 140 pasaron y 1 falló por ausencia local de `jspdf`. Evidencia: `npm test`, salida TAP `tests 141 / pass 140 / fail 1`; `package.json` declara `jspdf ^4.2.1` y el comando `Test-Path node_modules` devolvió `false`.
- El registro de actividad expone **52 etiquetas de acción distintas** repartidas entre los 16 módulos; la Bitácora administrativa no registra sus propias visitas. Evidencia: `assets/js/activity-log.js:L40-L134` y llamadas de los controladores resumidas en la sección 7.
- Las **14 integraciones obligatorias** quedan clasificadas así: 4 `INTEGRACIÓN REAL`, 2 `DATOS MOCK COMPARTIDOS`, 1 `NAVEGACIÓN ÚNICAMENTE`, 2 `DERIVACIÓN LOCAL`, 4 `IMPLEMENTACIÓN PARCIAL`, 0 `DOCUMENTADA, NO IMPLEMENTADA`, 1 `EN CONFLICTO` y 0 `NO APLICA`. Además existe una integración real no incluida en esas 14: Movimientos → Dashboard mediante una clave local compartida.
- El producto sigue siendo un frontend estático: los perfiles son selecciones del cliente, la persistencia está en el navegador y no se detectó backend, API, base de datos, autenticación ni cierre de sesión. Evidencia: `AGENTS.md`; `assets/js/acceso.js:L4-L33`; `assets/js/app-shell.js:L34-L100`; búsqueda estática de rutas y controladores en `097d0a2`.
- La mayor discontinuidad de producto confirmada es que las ediciones locales de entidades no se propagan de manera uniforme a módulos relacionados. Ejemplos comprobables: Ajustes no alimenta Facturas, Configuración fiscal no alimenta Facturas, y registrar un pago no crea un Movimiento ni actualiza Reportes o Notificaciones. Evidencia detallada en las secciones 10, 12 y 14.

### 1.1 Leyenda de clasificación

| Clasificación | Criterio aplicado en esta fase |
|---|---|
| `INTEGRACIÓN REAL` | Existe un contrato de estado o un flujo de datos consumido por el módulo destino en el código del snapshot. “Real” significa cableado estático comprobable, no validación en navegador ni producción. |
| `DATOS MOCK COMPARTIDOS` | Los módulos parten de registros o identificadores comunes en el mock, pero sus cambios locales no se propagan entre ellos. |
| `NAVEGACIÓN ÚNICAMENTE` | Hay un enlace o destino de página, sin traspaso suficiente de identidad/estado de la entidad. |
| `DERIVACIÓN LOCAL` | El resultado se calcula dentro del módulo desde sus datos cargados o una base fija, sin contrato compartido con el supuesto origen. |
| `IMPLEMENTACIÓN PARCIAL` | Existe solo una parte del flujo esperado o conviven fuentes de verdad desconectadas. |
| `DOCUMENTADA, NO IMPLEMENTADA` | La relación aparece en documentación, pero no se detecta cableado equivalente en el snapshot. |
| `EN CONFLICTO` | Dos fuentes o contratos implementados prometen comportamientos incompatibles. |
| `NO APLICA` | La relación no corresponde al alcance o al modelo del producto. |

### 1.2 Conteo de las 14 integraciones obligatorias

| Clasificación | Cantidad | Relaciones |
|---|---:|---|
| `INTEGRACIÓN REAL` | 4 | perfil operativo → módulos operativos; perfil administrativo → Bitácora; propuesta aceptada → proyecto; actividad operativa → Bitácora |
| `DATOS MOCK COMPARTIDOS` | 2 | Categorías → Movimientos; Clientes → Propuestas/Proyectos/Facturas |
| `NAVEGACIÓN ÚNICAMENTE` | 1 | Notificaciones → módulo relacionado |
| `DERIVACIÓN LOCAL` | 2 | Proyectos → tiempo/costo/ganancia; Configuración fiscal → estimaciones |
| `IMPLEMENTACIÓN PARCIAL` | 4 | Landing → Acceso → perfil; Servicios → Propuestas/Proyectos/Facturas; Facturas → pagos/movimientos/reportes/notificaciones; Cuenta/Perfil → identidad visual operativa |
| `DOCUMENTADA, NO IMPLEMENTADA` | 0 | Ninguna de las 14 |
| `EN CONFLICTO` | 1 | Ajustes → numeración/moneda/vencimiento de Facturas |
| `NO APLICA` | 0 | Ninguna de las 14 |
| **Total** | **14** | Conteo verificado contra las secciones 9 a 12 |

## 2. Método, fuentes y límites

### 2.1 Método aplicado

1. Se fijó la base en `origin/main@097d0a2cef3455a6b7956c1fe0bb3c792f19f287` y se comprobó que `HEAD` del worktree aislado coincide con esa referencia. Evidencia: `git rev-parse HEAD` y `git rev-parse origin/main`.
2. Se conservaron sin cambios los artefactos de Fase 1 y Fase 2. Evidencia previa a la escritura: `git status --short` mostraba únicamente `FreelanceFlow_Product_Audit_Source_Map.md` y `FreelanceFlow_Product_Requirements_Baseline.md` como no rastreados.
3. Se inspeccionaron de forma read-only 16 páginas, 32 archivos JavaScript, dos fuentes mock y 25 archivos de prueba; no se editó, ejecutó ni abrió navegador.
4. Las integraciones se clasificaron por lectura de productores, consumidores, claves de persistencia e identificadores. Una URL compartida o un ID coincidente no se consideró integración real sin consumidor comprobable.
5. Las cuatro validaciones exigidas se ejecutaron sin instalar dependencias ni corregir fallos. Resultados en la sección 3.
6. No se ejecutó `npm run build:css`, servidor local ni navegador, por restricción expresa de la fase.

### 2.2 Convención de evidencia

- `origin/main@097d0a2:ruta:Lx-Ly`: evidencia estática del snapshot.
- `CMD`: comando ejecutado y su código de salida.
- Contexto interno: antecedente contrastado con el snapshot; nunca sustituye el código actual.
- `PENDIENTE DE NAVEGADOR`: comportamiento que no puede declararse reproducido en esta fase.

### 2.3 Contexto interno y vigencia

Se revisó el contexto interno persistido del proyecto y se contrastó con evidencia del repositorio.

### 2.4 Límite de interpretación

Esta fase demuestra presencia de código, contratos estáticos y resultados de pruebas Node. No demuestra que los flujos funcionen en todos los navegadores, que el CSS renderice correctamente, que las descargas se abran, que los guards resistan manipulación del cliente ni que exista consistencia transaccional. Esas comprobaciones permanecen explícitamente fuera del alcance.

## 3. Validaciones automatizadas

| Comando | Resultado | Evidencia e interpretación |
|---|---|---|
| `npm run validate` | **PASS**, exit 0 | `node --check` aceptó los 32 archivos incluidos en el script `validate`. Evidencia: salida del comando y `package.json:scripts.validate`. |
| `python -m json.tool assets/data/mock-data.json` | **PASS**, exit 0 | El mock principal es JSON sintácticamente válido en `097d0a2`. |
| `npm test` | **FAIL**, exit 1 | TAP: `tests 141`, `pass 140`, `fail 1`. `tests/invoice-pdf.test.cjs` no cargó: `Error: Cannot find module 'jspdf'` bajo Node `v22.20.0`. |
| `git diff --check` | **PASS**, exit 0 | No se detectaron errores de whitespace en cambios rastreados. Los archivos no rastreados requieren la validación documental adicional de la sección 18. |
| `Test-Path node_modules` / `Test-Path node_modules/jspdf` | `false` / `false` | `package.json` declara `jspdf: ^4.2.1`, pero no había instalación local. El fallo se documentó; no se ejecutó `npm install` ni `npm ci`. |
| `npm run build:css` | **NO EJECUTADO** | Exclusión expresa de Fase 3; no se regeneró `assets/css/styles.css`. |
| Servidor/navegador | **NO EJECUTADO** | Validación declarada “estática y automatizada; sin navegador”. |

**Bloqueo de validación:** la suite completa no está verde en este worktree por disponibilidad de dependencia, no por una aserción funcional fallida. No se afirma que `invoice-pdf.js` pase sus pruebas hasta reinstalar de forma autorizada las dependencias y repetir `npm test`.

## 4. Matriz de módulos implementados

### 4.1 Estructura, datos, persistencia, guardas y cobertura

| # | Módulo | Página | Controlador / modelo | Datos y persistencia | Guarda y navegación | Pruebas directas | Evidencia principal |
|---:|---|---|---|---|---|---|---|
| 1 | Landing | `index.html` | Sin controlador/modelo dedicado | Contenido estático; sin storage de módulo | Pública; CTA/enlaces hacia Acceso | Sin test funcional dedicado; copy cubierto parcialmente por encoding | `index.html:L58-L72,L147`|
| 2 | Acceso | `pages/acceso.html` | `acceso.js` / sin modelo | Escribe `freelanceflow_access_profile` y `freelanceflow_access_actor` en sesión | Pública; deriva a Dashboard o Bitácora según selección | `acceso.test.cjs`, `app-shell-access.test.cjs` | `assets/js/acceso.js:L4-L33` |
| 3 | Dashboard | `pages/dashboard.html` | `dashboard.js` / `dashboard-model.js` | `mock-data.json` más `freelanceflow_transactions_mock` | Solo perfil operativo; entrada principal del shell | `dashboard-model.test.cjs` | `assets/js/dashboard.js:L28-L40,L58-L123`|
| 4 | Movimientos | `pages/transacciones.html` | `transacciones.js` / `transaction-model.js` | Mock financiero + `freelanceflow_transactions_mock` | Solo operativo; sidebar y navegación inferior | `transaction-model.test.cjs` | `assets/js/transacciones.js:L43-L80,L369-L395,L635-L649` |
| 5 | Clientes | `pages/clientes.html` | `clientes.js` / `client-model.js` | `clientes` mock + `freelanceflow_clients_v2`; fallback legado `freelanceflow_clients_mock` | Solo operativo; sidebar | `client-model.test.cjs` | `assets/js/clientes.js:L122-L155,L241-L341,L446-L503` |
| 6 | Proyectos | `pages/proyectos.html` | `proyectos.js` / `project-model.js` | Mock + `freelanceflow_projects_v1`, propuestas locales y conversión de sesión | Solo operativo; sidebar | `project-model.test.cjs` | `assets/js/proyectos.js:L154-L237,L716-L842` |
| 7 | Facturas | `pages/facturas.html` | `facturas.js` / `invoice-model.js`; `invoice-pdf.js` | Mock + `freelanceflow_invoices_v1` y `freelanceflow_invoice_payments_v1` | Solo operativo; sidebar/navegación inferior | `invoice-model.test.cjs`; `invoice-pdf.test.cjs` bloqueado por `jspdf` | `assets/js/facturas.js:L121-L136,L361-L366,L425-L608,L735-L757` |
| 8 | Reportes | `pages/reportes.html` | `reportes.js` / `report-model.js` | Mock financiero + `freelanceflow_budgets_v1` | Solo operativo; sidebar | `report-model.test.cjs` | `assets/js/reportes.js:L38-L70,L240-L375,L491-L515` |
| 9 | Categorías | `pages/categorias.html` | `categorias.js` / `category-model.js` | `categorias_gasto` y gastos mock + `freelanceflow_expense_categories_v1` | Solo operativo; sidebar | tres archivos category | `assets/js/categorias.js:L104-L167,L324-L409` |
| 10 | Servicios | `pages/servicios.html` | `servicios.js` / `service-model.js` | `servicios` mock + `freelanceflow_services_v1` | Solo operativo; sidebar | tres archivos service | `assets/js/servicios.js:L30-L54` |
| 11 | Propuestas | `pages/propuestas.html` | `propuestas.js` / `proposal-model.js` | clientes/servicios/propuestas mock + `freelanceflow_proposals_v1` y conversión de sesión | Solo operativo; sidebar | `proposal-mock-data.test.cjs`, `proposal-model.test.cjs` | `assets/js/propuestas.js:L10-L12,L21-L45` |
| 12 | Configuración fiscal | `pages/configuracion-fiscal.html` | `configuracion-fiscal.js` / `fiscal-config-model.js` | Defaults y `freelanceflow_fiscal_config_v1`; cálculo sobre base local fija | Solo operativo; sidebar | `fiscal-config-model.test.cjs` | `assets/js/configuracion-fiscal.js:L31-L99` |
| 13 | Ajustes | `pages/ajustes.html` | `ajustes.js` / `settings-model.js` | Defaults + `freelanceflow_settings_v1` | Solo operativo; sidebar | `settings-model.test.cjs`, `settings-controller.test.cjs` | `assets/js/ajustes.js:L17-L25` |
| 14 | Notificaciones | `pages/notificaciones.html` | `notificaciones.js` / `notification-model.js` | Alertas derivadas del mock + `freelanceflow_notifications_v1` | Solo operativo; shell; destinos relacionados sin ID de entidad | `notification-model.test.cjs` | `assets/js/notificaciones.js:L14-L23` |
| 15 | Cuenta/Perfil | `pages/cuenta.html` | `cuenta.js` / `profile-model.js` | `freelanceflow.profile.v1` local | Solo operativo; shell | `profile-model.test.cjs` | `assets/js/cuenta.js:L9-L21` |
| 16 | Bitácora | `pages/bitacora.html` | `bitacora.js` / sin modelo separado; usa `activity-log.js` | `freelanceflow_activity_log_session` en sesión | Solo administrativo; los demás perfiles son redirigidos | `activity-log.test.cjs`, `bitacora.test.cjs`, `app-shell-access.test.cjs` | `assets/js/bitacora.js:L18-L24,L39-L78`; `assets/js/activity-log.js:L40-L134` |

### 4.2 Acciones, validaciones, estados y dependencias funcionales

| Módulo | Acciones detectadas | Validaciones/estados detectados | ActivityLog | Dependencias funcionales |
|---|---|---|---|---|
| Landing | Recorrer contenido y navegar a Acceso/producto | Sin estado de aplicación; solo navegación estática | 0 etiquetas | HTML/CSS y enlaces |
| Acceso | Seleccionar perfil operativo o administrativo; redirigir | Selección explícita; perfil desconocido/ausente no habilita rutas protegidas | 1 | `sessionStorage`, `activity-log.js` |
| Dashboard | Cargar resumen, movimientos, vencimientos y clientes | carga, error, vacío y contenido; previews desktop/móvil | 1 | mock loader, dashboard model, transacciones locales |
| Movimientos | Crear, editar, buscar y filtrar; abrir drawer | campos de negocio, fecha calendario, cliente/proyecto; carga/error/vacío/filtrado | 4 | mock loader, transaction model, clientes/proyectos/categorías de la carga |
| Clientes | Crear, editar, ver detalle, filtrar, cambiar/inactivar estado | campos B2B y representante, email/celular/estado civil/estado, identificación única; carga/error/vacío | 4 | mock loader, client model, storage propio |
| Proyectos | Crear, editar, filtrar, abrir detalle y consumir conversión | campos comunes, fechas, modalidad, cliente activo; lista/detalle/drawer/error/vacío | 4 | clientes, facturas, pagos, tiempo mock; propuestas locales |
| Facturas | Guardar, enviar, registrar pago, anular, generar PDF y enlace | integridad aritmética, campos requeridos, reglas de pago/estado; borrador/enviada/vencida/pagada/anulada | 6 | clientes/proyectos mock, invoice model, invoice PDF, `jspdf`, storages propios |
| Reportes | Aplicar filtros, generar vistas, exportar CSV y guardar presupuesto | rango de fechas, límites positivos y categorías únicas; carga/error/vacío/reporte | 4 | entidades financieras mock, report model, Blob/CSV, budgets local |
| Categorías | Crear, editar, buscar, inactivar si tiene uso y eliminar si no lo tiene | nombre único, presupuesto no negativo, deducible/estado; carga/error/vacío | 6 | categorías/gastos mock, category model, storage propio |
| Servicios | Crear, editar, buscar/filtrar y eliminar | nombre único, unidad autorizada, tarifa positiva, moneda; carga/error/vacío | 5 | servicios mock, service model, storage propio |
| Propuestas | Crear/editar, enviar, aceptar, rechazar y convertir | cliente activo, fechas, ítems, descuento, una moneda; DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED/CONVERTED | 8 | clientes, servicios y propuestas; proposal model; proyectos vía session prefill |
| Configuración fiscal | Editar, previsualizar y guardar | texto requerido, tasas finitas 0–100 y tasa condicional; impuesto activo/inactivo, válido/inválido | 2 | fiscal model, storage propio, base de ejemplo local |
| Ajustes | Editar, guardar, restaurar y previsualizar | prefijo requerido, enteros positivos y moneda autorizada; dirty/guardado/restaurado/error | 3 | settings model, storage propio |
| Notificaciones | Ver, marcar lectura local y guardar preferencias | al menos un canal; leída/no leída, preferencias válidas, vacío/carga/error | 2 | facturas/propuestas/pagos mock, notification model, storage propio |
| Cuenta/Perfil | Editar, guardar y descartar | todos los campos requeridos, longitudes/email; dirty/guardado/error | 2 | profile model, storage propio; no alimenta actor de sesión |
| Bitácora | Listar, resumir, buscar y limpiar con confirmación | admin-only; vacío/lista/filtro; búsqueda desde 2 caracteres | 0 | activity log de sesión, actor/perfil de Acceso |

## 5. Persistencia y fuentes de verdad locales

### 5.1 Claves de `sessionStorage`

| # | Clave | Escritor | Lectores/consumidores | Efecto observable estático |
|---:|---|---|---|---|
| 1 | `freelanceflow_access_profile` | Acceso | app-shell, activity-log, Bitácora | Selecciona `operational` o `administrative`; no es autenticación. |
| 2 | `freelanceflow_access_actor` | Acceso | app-shell, activity-log | Copia visible del actor de sesión; no se sincroniza con Cuenta. |
| 3 | `freelanceflow_activity_log_session` | activity-log | Bitácora | Máximo de 80 entradas, lectura más reciente primero y deduplicación consecutiva. |
| 4 | `freelanceflow_proposal_conversion_v1` | Propuestas | Proyectos | Prefill de una conversión; Proyectos lo consume y elimina. |

Evidencia: `assets/js/acceso.js:L4-L33`; `assets/js/app-shell.js:L34-L100`; `assets/js/activity-log.js:L40-L90`; `assets/js/proyectos.js:L716-L842`.

### 5.2 Claves de `localStorage`

| # | Clave | Propietario / lectores | Integración comprobada |
|---:|---|---|---|
| 5 | `freelanceflow_sidebar_collapsed` | app-shell | Preferencia visual compartida del shell. |
| 6 | `freelanceflow_settings_v1` | Ajustes | Solo Ajustes; Facturas no la lee. |
| 7 | `freelanceflow_expense_categories_v1` | Categorías | Solo Categorías; Movimientos no consume sus ediciones. |
| 8 | `freelanceflow_clients_v2` | Clientes | Solo Clientes. |
| 9 | `freelanceflow_clients_mock` | Clientes | Fallback legado de Clientes. |
| 10 | `freelanceflow_fiscal_config_v1` | Configuración fiscal | Solo Configuración fiscal; Facturas no la lee. |
| 11 | `freelanceflow.profile.v1` | Cuenta | Solo Cuenta; no actualiza actor/perfil de sesión. |
| 12 | `freelanceflow_transactions_mock` | Movimientos y Dashboard | **Integración real adicional:** Dashboard lee movimientos persistidos. |
| 13 | `freelanceflow_invoices_v1` | Facturas | Solo Facturas. |
| 14 | `freelanceflow_invoice_payments_v1` | Facturas | Solo Facturas. |
| 15 | `freelanceflow_notifications_v1` | Notificaciones | Lecturas y preferencias; no recibe eventos de escritura de Facturas. |
| 16 | `freelanceflow_proposals_v1` | Propuestas y Proyectos | Proyectos consulta/reconcilia propuestas durante conversión. |
| 17 | `freelanceflow_projects_v1` | Proyectos | Solo Proyectos. |
| 18 | `freelanceflow_budgets_v1` | Reportes | Solo Reportes. |
| 19 | `freelanceflow_services_v1` | Servicios | Solo Servicios; Propuestas conserva snapshots provenientes de su carga, no consume cambios del catálogo local en otros módulos. |

**Conclusión:** no existe un repositorio local único de entidades ni una capa de transacción. Cada módulo combina el mock inicial con uno o más overlays propios. Evidencia: constantes de storage en los controladores listados en la sección 17; `assets/js/dashboard.js:L28-L40` para la excepción Movimientos → Dashboard.

### 5.3 Mocks y fallback

- Fuente primaria: `assets/data/mock-data.json`, JSON válido según el comando de la sección 3.
- Fallback: `assets/data/mock-data.js`, cargado por `assets/js/mock-data-loader.js:L4-L20`.
- El fallback no reproduce completamente el mock JSON actual: no expone los catálogos de Servicios y Propuestas. Evidencia: comparación estática de `assets/data/mock-data.js` con `assets/data/mock-data.json:L78-L189,L190-L456,L485-L544`.
- Notificaciones no incluye el fallback de `mock-data.js` en su página; por tanto el camino `file:`/fallo de `fetch` no dispone del mismo contrato que otros módulos. Evidencia: `pages/notificaciones.html` y `assets/js/notificaciones.js:L14-L23`.

## 6. Roles, guardas y navegación

| Estado de perfil | Rutas permitidas detectadas | Comportamiento |
|---|---|---|
| Ausente o desconocido | Landing y Acceso | Las páginas protegidas redirigen a Acceso. |
| `operational` | 13 módulos operativos: Dashboard, Movimientos, Clientes, Proyectos, Facturas, Reportes, Categorías, Servicios, Propuestas, Configuración fiscal, Ajustes, Notificaciones y Cuenta | El shell muestra navegación operativa; Bitácora redirige fuera. |
| `administrative` | Bitácora | Las rutas operativas redirigen; la actividad administrativa no se registra. |

- Guarda central: `assets/js/app-shell.js:L85-L91`; construcción de navegación: `assets/js/app-shell.js:L34-L100,L182-L224`.
- Guarda redundante de Bitácora: `assets/js/bitacora.js:L39-L45`.
- Registro condicionado por perfil: `assets/js/activity-log.js:L40-L90`.
- No se detectó acción de logout/cierre de sesión en el inventario de páginas y controladores del snapshot.
- Las guardas dependen de valores manipulables en `sessionStorage`. Esto confirma control de navegación en cliente, no autorización de seguridad.

## 7. Eventos registrados en ActivityLog

### 7.1 Contrato compartido

`activity-log.js` persiste objetos con `id`, `date`, `actor`, `profile`, `module`, `action` y `description`; limita el historial a 80, ordena por fecha descendente, deduplica eventos consecutivos equivalentes y omite actividad administrativa o sin perfil. Evidencia: `assets/js/activity-log.js:L40-L134`; pruebas `activity-log.test.cjs`.

### 7.2 Inventario por módulo

| Módulo | Etiquetas distintas | Familias de evento detectadas | Evidencia |
|---|---:|---|---|
| Landing | 0 | Ninguna | `index.html` |
| Acceso | 1 | selección de perfil operativo | `assets/js/acceso.js:L23-L33` |
| Dashboard | 1 | ingreso a pantalla | `activity-log.js` + `dashboard.js` |
| Movimientos | 4 | ingreso, búsqueda, registro, actualización | `assets/js/transacciones.js:L369-L395` |
| Clientes | 4 | ingreso, búsqueda, registro, actualización | `assets/js/clientes.js:L446-L503` |
| Proyectos | 4 | ingreso/búsqueda y creación/actualización | `assets/js/proyectos.js:L716-L757` |
| Facturas | 6 | ingreso, guardar, enviar, pago y anulación | `assets/js/facturas.js:L425-L657` |
| Reportes | 4 | ingreso/filtros, exportación y presupuesto | `assets/js/reportes.js:L240-L375,L491-L515` |
| Categorías | 6 | ingreso, búsqueda, crear, actualizar, inactivar, eliminar | `assets/js/categorias.js:L324-L430` |
| Servicios | 5 | ingreso/búsqueda y crear/actualizar/eliminar | `assets/js/servicios.js:L30-L54` |
| Propuestas | 8 | ingreso/edición y transiciones enviar/aceptar/rechazar/convertir | `assets/js/propuestas.js:L21-L45`; `proyectos.js:L840` |
| Configuración fiscal | 2 | ingreso y guardado | `assets/js/configuracion-fiscal.js:L31-L99` |
| Ajustes | 3 | ingreso, guardado y restauración | `assets/js/ajustes.js:L17-L25` |
| Notificaciones | 2 | ingreso y preferencias actualizadas | `assets/js/notificaciones.js:L14-L23` |
| Cuenta/Perfil | 2 | ingreso y perfil actualizado | `assets/js/cuenta.js:L9-L21` |
| Bitácora | 0 | No registra actividad administrativa ni el borrado del historial | `activity-log.js`; `bitacora.js` |
| **Total** | **52** | Suma: 0+1+1+4+4+4+6+4+6+5+8+2+3+2+2+0 | Inventario estático del snapshot |

**Vacío confirmado:** no todas las mutaciones secundarias están auditadas. Marcar notificaciones como leídas, algunos cambios inline y limpiar la Bitácora no producen una traza equivalente. Esto no se presenta como defecto funcional reproducido, sino como ausencia de llamadas en los controladores citados.

## 8. Cobertura de pruebas

| Área | Archivos | Qué cubren | Límite |
|---|---|---|---|
| Acceso/roles/Bitácora | `acceso.test.cjs`, `activity-log.test.cjs`, `app-shell-access.test.cjs`, `bitacora.test.cjs` | selección de perfil, guardas, navegación, registro, resumen/lista | Sin navegador ni manipulación real de URL/storage entre páginas. |
| Categorías | `category-mock-data.test.cjs`, `category-model.test.cjs`, `category-page.test.cjs` | mock, reglas puras y contratos estáticos de página | No ejecuta CRUD completo en DOM real. |
| Clientes | `client-model.test.cjs` | normalización B2B, validación, filtros, merge | Controlador no ejecutado de extremo a extremo. |
| Dashboard | `dashboard-model.test.cjs` | previews y alerta móvil | No valida render ni sincronización en navegador. |
| Encoding/copy | `encoding.test.cjs` | mojibake y términos prohibidos en archivos definidos | No prueba renderizado de fuentes ni contenido generado dinámicamente completo. |
| Fiscal | `fiscal-config-model.test.cjs` | normalización, validación y cálculo | Controlador/storage real no ejecutado. |
| Facturas | `invoice-model.test.cjs`, `invoice-pdf.test.cjs` | aritmética, estados, filtros, acciones y PDF | PDF no pudo cargar por ausencia de `jspdf`; cobertura actual incompleta. |
| Notificaciones | `notification-model.test.cjs` | derivación, preferencias, storage corrupto y deduplicación | No prueba enlaces ni lectura real en DOM. |
| Cuenta | `profile-model.test.cjs` | normalización, storage versionado y boundary seguro | No prueba identidad compartida porque no existe contrato compartido. |
| Proyectos | `project-model.test.cjs` | reglas, métricas, merge y relaciones mock | No prueba conversión completa en navegador. |
| Propuestas | `proposal-mock-data.test.cjs`, `proposal-model.test.cjs` | integridad referencial, estados y payload de conversión | No ejecuta Propuestas → Proyectos como flujo multi-página. |
| Reportes | `report-model.test.cjs` | métricas, presupuestos, CSV e inyección de fórmula | No ejecuta descarga ni deep link real. |
| Servicios | `service-mock-data.test.cjs`, `service-model.test.cjs` | catálogo, validación, métricas y overlay | No verifica consumo por módulos comerciales. |
| Ajustes | `settings-controller.test.cjs`, `settings-model.test.cjs` | reglas y feedback/controlador en VM | No verifica aplicación en Facturas. |
| Configuración CSS | `tailwind-config.test.cjs` | rutas escaneadas | No se compiló CSS en esta fase. |
| Movimientos | `transaction-model.test.cjs` | resumen, filtros, validación y relaciones | No prueba drawer/URL/storage con navegador. |

**Índice total:** 25 archivos, enumerados por `Get-ChildItem tests -Filter '*.test.cjs'`.
**Vacíos transversales confirmados:** no hay prueba funcional dedicada de Landing; no hay E2E Propuesta → Proyecto → Factura → Pago → Movimiento/Reporte/Notificación; no hay prueba multi-página de propagación de overlays; no hay navegador; no hay prueba del fallback `file:`/fallo de `fetch`; no hay prueba de coherencia de parámetros `invoice`/`factura`.

## 9. Integraciones reales

Las siguientes relaciones tienen productor y consumidor comprobables en el snapshot. La etiqueta no implica backend, atomicidad ni prueba en navegador.

| Relación | Clasificación | Mecanismo comprobado | Evidencia | Límite |
|---|---|---|---|---|
| Perfil operativo → módulos operativos | `INTEGRACIÓN REAL` | Acceso escribe perfil de sesión; app-shell lo lee y permite rutas operativas | `acceso.js:L4-L33`; `app-shell.js:L85-L91`; `app-shell-access.test.cjs` | El valor es manipulable en cliente. |
| Perfil administrativo → Bitácora | `INTEGRACIÓN REAL` | Acceso escribe `administrative`; guardas permiten solo Bitácora | `acceso.js`; `bitacora.js:L39-L45`; tests de guardas | No es autorización de servidor. |
| Propuesta aceptada → Proyecto | `INTEGRACIÓN REAL` | Propuestas genera payload en sesión; Proyectos lo consume, crea/persiste proyecto y reconcilia propuesta | `proposal-model.js`; `propuestas.js`; `proyectos.js:L716-L842`; `proposal-model.test.cjs` | Sin ejecución multi-página en esta fase. |
| Actividad operativa → Bitácora | `INTEGRACIÓN REAL` | Controladores escriben en el logger compartido; Bitácora lee la misma clave de sesión | `activity-log.js:L40-L134`; `bitacora.js:L18-L78`; tests de activity/bitácora | Memoria de sesión, borrable por el cliente. |
| Movimientos → Dashboard | `INTEGRACIÓN REAL` **adicional** | Ambos leen/escriben `freelanceflow_transactions_mock` | `transacciones.js:L43-L80,L369-L395`; `dashboard.js:L28-L40,L58-L123`| No forma parte de las 14 relaciones obligatorias; no se probó en navegador. |

## 10. Integraciones parciales

| Relación | Clasificación | Parte implementada | Parte ausente o desconectada | Evidencia |
|---|---|---|---|---|
| Landing → Acceso → perfil | `IMPLEMENTACIÓN PARCIAL` | Landing navega a Acceso; Acceso crea perfil/actor de sesión | Landing no transmite identidad ni contexto; no hay autenticación, alta ni logout | `index.html:L58-L72,L147`; `acceso.js:L4-L33` |
| Servicios → Propuestas/Proyectos/Facturas | `IMPLEMENTACIÓN PARCIAL` | Propuestas crea snapshots de ítems de servicio desde su carga | Cambios en `freelanceflow_services_v1` no se consumen de forma uniforme; Proyectos y Facturas no leen el catálogo local | `service-model.js`; `propuestas.js`; claves de la sección 5 |
| Facturas → pagos/movimientos/reportes/notificaciones | `IMPLEMENTACIÓN PARCIAL` | Facturas persiste facturas y pagos propios y recalcula su estado local | Registrar pago no crea Movimiento ni actualiza los overlays/alertas de Reportes y Notificaciones | `facturas.js:L425-L608`; `reportes.js:L38-L70`; `notificaciones.js:L14-L23` |
| Cuenta/Perfil → identidad visual operativa | `IMPLEMENTACIÓN PARCIAL` | Cuenta guarda perfil local; app-shell muestra actor de sesión; Dashboard carga usuario mock | Son tres fuentes distintas sin reconciliación: `freelanceflow.profile.v1`, `freelanceflow_access_actor` y usuario mock | `cuenta.js:L9-L21`; `app-shell.js`; `dashboard.js`; `mock-data.json` |

## 11. Integraciones documentadas pero no implementadas

Entre las **14 integraciones obligatorias**, el conteo `DOCUMENTADA, NO IMPLEMENTADA` es **0**: cada una mostró al menos cableado parcial, mock compartido, derivación, navegación o un conflicto implementado y por ello se clasificó con mayor precisión en las secciones 9, 10 y 12.

Esto no significa que toda la visión documental esté implementada. Backend, API, base de datos, autenticación real, multiusuario/multitenancy y persistencia central pertenecen a una arquitectura futura o quedan fuera de la Fase 1 estática. Evidencia: `AGENTS.md` y `docs/specs/FreelanceFlow_Product_Requirements_Baseline.md`. No se evaluaron como integraciones de los 16 módulos en esta matriz.

## 12. Datos y estados aislados

### 12.1 Relaciones obligatorias restantes

| Relación | Clasificación | Hallazgo comprobable | Evidencia |
|---|---|---|---|
| Categorías → Movimientos | `DATOS MOCK COMPARTIDOS` | Comparten categorías iniciales/IDs del mock; el overlay `freelanceflow_expense_categories_v1` no es leído por Movimientos | `mock-data.json`; `categorias.js`; `transacciones.js` |
| Clientes → Propuestas/Proyectos/Facturas | `DATOS MOCK COMPARTIDOS` | Parten de `clientes` del mock; los consumidores no leen `freelanceflow_clients_v2` | `clientes.js`; `propuestas.js`; `proyectos.js`; `facturas.js` |
| Proyectos → tiempo/costo/ganancia | `DERIVACIÓN LOCAL` | Las métricas se calculan en memoria desde arrays mock de proyectos, horas, facturas, pagos y gastos | `project-model.js`; `proyectos.js:L154-L237`; `project-model.test.cjs` |
| Configuración fiscal → estimaciones | `DERIVACIÓN LOCAL` | La previsualización usa configuración local y una base neutral fija de USD 1.000 | `fiscal-config-model.js:L36-L44`; `configuracion-fiscal.js:L31-L99`|
| Notificaciones → módulo relacionado | `NAVEGACIÓN ÚNICAMENTE` | El destino identifica una página/módulo, pero no transporta un ID de factura/propuesta/pago suficiente para abrir la entidad | `notification-model.js`; `notificaciones.js:L14-L23` |
| Ajustes → numeración/moneda/vencimiento de Facturas | `EN CONFLICTO` | Ajustes promete prefijo, moneda y plazo configurables; Facturas usa `FAC-`, USD y +15 días sin leer `freelanceflow_settings_v1` | `settings-model.js:L3-L11`; `ajustes.js:L17-L25`; `facturas.js:L361-L366,L425-L503` |

### 12.2 Efecto de los overlays aislados

| Overlay editado | Módulos que sí lo consumen | Módulos relacionados que no lo consumen |
|---|---|---|
| Clientes local | Clientes | Propuestas, Proyectos, Facturas |
| Categorías local | Categorías | Movimientos, Reportes |
| Servicios local | Servicios | Propuestas, Proyectos, Facturas |
| Proyectos local | Proyectos | Facturas, Reportes, Notificaciones |
| Facturas/pagos local | Facturas | Dashboard, Movimientos, Reportes, Notificaciones |
| Fiscal local | Configuración fiscal | Facturas |
| Ajustes local | Ajustes | Facturas |
| Cuenta local | Cuenta | app-shell, Dashboard, ActivityLog |
| Movimientos local | Movimientos, Dashboard | Reportes y Notificaciones no comparten el mismo overlay |

La tabla describe lectores detectados, no una expectativa inferida. Evidencia: constantes y llamadas `localStorage.getItem/setItem` en los controladores del mapa de la sección 17.

## 13. Dependencias y componentes compartidos

| Recurso | Consumidores | Función | Evidencia / límite |
|---|---|---|---|
| `assets/js/app-shell.js` | 13 páginas operativas y Bitácora | navegación, actor, colapso de sidebar y guardas | `app-shell.js:L34-L100,L182-L224`; control de cliente |
| `assets/js/activity-log.js` | controladores operativos y Bitácora | contrato y persistencia de eventos | `activity-log.js:L40-L134`; sesión local |
| `assets/js/mock-data-loader.js` | módulos con datos mock | `fetch` de JSON y fallback global | `mock-data-loader.js:L4-L20`; fallback incompleto |
| `assets/data/mock-data.json` | Dashboard y módulos financieros/comerciales | baseline de entidades relacionadas | JSON válido; no es fuente mutable común |
| `assets/data/mock-data.js` | fallback de algunos módulos | baseline embebido | no contiene el contrato completo actual |
| `assets/js/invoice-pdf.js` | Facturas | generación de PDF | depende de `jspdf`; prueba bloqueada en el entorno |
| `assets/css/app.css` / `styles.css` | toda la UI | fuente y CSS compilado | no se ejecutó `build:css` en esta fase |
| `jspdf ^4.2.1` | invoice PDF/test | PDF en cliente | declarado en `package.json`; no instalado en el worktree actual |
| `tailwindcss ^3.4.17` | build de estilos | compilación CSS | devDependency; build excluido |
| APIs del navegador | controladores | storage, URL, fetch, Blob/descargas, DOM | sin navegador en esta fase |
| Modelos CommonJS/browser | controladores y pruebas Node | reglas puras y validaciones | 13 archivos model; cobertura por módulo desigual |

No se detectaron servicios de red, endpoints, SDK de backend, framework SPA ni capa de repositorio compartida en los 32 JavaScript inventariados.

## 14. Inconsistencias confirmadas

| # | Inconsistencia | Evidencia estática | Consecuencia que debe verificarse después |
|---:|---|---|---|
| 1 | `mock-data.js` no replica Servicios/Propuestas del JSON principal | `assets/data/mock-data.js` vs `mock-data.json:L78-L189,L190-L456,L485-L544` | El fallback puede entregar contratos diferentes. |
| 2 | Notificaciones no carga el fallback compartido | `pages/notificaciones.html`; `notificaciones.js:L14-L23` | Apertura por `file:` o fallo de fetch puede divergir. |
| 3 | Ajustes afirma influir en nuevas facturas, pero Facturas no lee su clave | `ajustes.js:L17-L25`; `facturas.js:L361-L366,L425-L503` | Prefijo, moneda y plazo configurados pueden no aplicarse. |
| 4 | Facturas fija `FAC-`, USD y vencimiento +15 | `facturas.js:L361-L366,L425-L503` | Conflicto directo con Ajustes. |
| 5 | Configuración fiscal ofrece estimaciones, pero Facturas no lee su clave | `configuracion-fiscal.js:L31-L99`; `facturas.js` | Tasa/configuración no se refleja en factura. |
| 6 | Reportes enlaza `facturas.html?invoice=...`; Facturas espera `?factura=...` | `reportes.js`; `facturas.js:L735-L757` | El deep link puede no seleccionar la factura. |
| 7 | `buildReport()` devuelve `{ type, rows }`, mientras el log de exportación usa `report.title` | `report-model.js:L321-L332`; `reportes.js:L344` | La descripción de Bitácora puede contener título ausente. |
| 8 | Identidad fragmentada en perfil local, actor de sesión y usuario mock | `cuenta.js`; `acceso.js`; `app-shell.js`; `dashboard.js` | El nombre/rol visible puede no coincidir entre pantallas. |
| 9 | Overlays de Clientes/Categorías/Servicios no se propagan a consumidores relacionados | sección 5; controladores respectivos | Datos editados pueden quedar aislados. |
| 10 | Pago de factura no crea Movimiento ni actualiza Reportes/Notificaciones | `facturas.js:L503-L568`; `transacciones.js`; `reportes.js`; `notificaciones.js` | No hay efecto financiero transversal atómico. |
| 11 | ActivityLog no cubre todas las acciones secundarias | sección 7 y ausencia de llamadas en los handlers | Auditoría local incompleta. |
| 12 | Dashboard usa referencias/períodos fijos donde otros módulos usan fecha del cliente | `dashboard.js:L58-L123`; modelos de Categorías/Propuestas/Notificaciones | Métricas pueden divergir por fecha y zona horaria. |
| 13 | No se detectó logout | inventario de `index.html`, `pages/*.html` y `assets/js/*.js` | El perfil de sesión no tiene cierre explícito desde la UI. |

Estas inconsistencias son diferencias de contratos o ausencias de consumo confirmadas por código. Sus efectos visuales/interactivos no fueron reproducidos en navegador.

## 15. Riesgos para evolución SaaS

| Riesgo | Evidencia actual | Impacto potencial, no validado aún |
|---|---|---|
| Perfil manipulable | roles en `sessionStorage` y guardas JS | No sirve como autorización real. |
| Sin fuente de verdad central | 19 claves y overlays por módulo | Divergencia, duplicados y pérdida de integridad referencial. |
| Datos financieros/personales en navegador | clientes, facturas, pagos, perfil en `localStorage` | Privacidad, borrado accidental y falta de control multiusuario. |
| Bitácora efímera y borrable | `sessionStorage`, acción limpiar | No cumple auditoría inmutable ni retención SaaS. |
| Sin operación atómica de cobro | pago aislado en Facturas | Movimientos, reportes y alertas pueden quedar desalineados. |
| Identidad triple | Cuenta, Acceso y mock de Dashboard | Experiencia y trazabilidad inconsistentes. |
| IDs generados en cliente y sin concurrencia | creación local por controladores/modelos | Colisiones o sobrescrituras al evolucionar a múltiples actores. |
| Fecha/moneda/fiscalidad locales o fijas | modelos/controladores citados | Resultados dependientes del reloj, zona o jurisdicción. |
| Migraciones de storage heterogéneas | claves versionadas y fallback legado | Compatibilidad difícil entre versiones del frontend. |
| Mock/fallback divergentes | `mock-data.json` vs `mock-data.js` | Comportamiento distinto según protocolo/carga. |
| Dependencia no materializada | `jspdf` declarado, `node_modules` ausente | Validación y generación PDF no reproducibles sin setup explícito. |

## 16. Preguntas que deberá resolver la Fase 4

1. ¿Cuál será la fuente de verdad única para clientes, categorías, servicios, proyectos, propuestas, facturas, pagos y movimientos?
2. ¿Qué permisos existen por acción además de los dos perfiles de navegación y cómo se validarán fuera del cliente?
3. ¿Qué efectos obligatorios y atómicos debe producir registrar, editar o revertir un pago?
4. ¿Cuáles son las máquinas de estado canónicas de Propuesta, Proyecto, Factura y Pago, y qué transiciones cruzadas generan?
5. ¿Qué componente es dueño del prefijo, secuencia, moneda, vencimiento, impuestos y retenciones de una factura?
6. ¿Cómo se unifican actor de acceso, perfil de cuenta, usuario del dashboard y actor de Bitácora?
7. ¿Qué identificador debe transportar una Notificación o un Reporte para abrir la entidad exacta?
8. ¿Qué eventos exige la auditoría, cuánto se retienen y quién puede borrarlos?
9. ¿Qué semántica temporal y zona horaria gobierna vencimientos, períodos, “hoy” y reportes?
10. ¿Qué comportamiento se mantiene offline/local y qué datos requieren backend inmediato?
11. ¿Cómo se migran las claves locales existentes sin perder datos ni mezclar versiones?
12. ¿Qué contrato de fallback es obligatorio cuando falla `fetch` o se abre el prototipo con `file:`?

Estas son preguntas de verificación futura; no se responden ni se convierten en requisitos/historias en esta fase.

## 17. Mapa archivo → comportamiento → evidencia

| Archivo(s) | Comportamiento comprobado estáticamente | Evidencia |
|---|---|---|
| `index.html` | entrada pública y navegación a Acceso | `L58-L72,L147`|
| `pages/acceso.html` + `assets/js/acceso.js` | selección de perfil/actor y redirección | `acceso.js:L4-L33`; `acceso.test.cjs` |
| `assets/js/app-shell.js` | shell, navegación y guardas | `L34-L100,L182-L224`; `app-shell-access.test.cjs` |
| `assets/js/activity-log.js` + `bitacora.js` | contrato de eventos y vista administrativa | `activity-log.js:L40-L134`; `bitacora.js:L18-L78` |
| `dashboard.js` + `dashboard-model.js` | resumen y consumo de movimientos locales | `dashboard.js:L28-L40,L58-L123`; `dashboard-model.test.cjs` |
| `transacciones.js` + `transaction-model.js` | CRUD, filtros, drawer y persistencia de movimientos | `transacciones.js:L43-L80,L369-L395,L635-L649`; test de modelo |
| `clientes.js` + `client-model.js` | CRUD B2B, detalle, estados y overlay propio | `clientes.js:L122-L155,L241-L341,L446-L503`; test de modelo |
| `proyectos.js` + `project-model.js` | cartera, métricas, CRUD y consumo de conversión | `proyectos.js:L154-L237,L716-L842`; test de modelo |
| `facturas.js` + `invoice-model.js` + `invoice-pdf.js` | facturas/pagos, estados, PDF y deep link | `facturas.js:L121-L136,L361-L366,L425-L608,L735-L757`; tests invoice |
| `reportes.js` + `report-model.js` | seis reportes, presupuestos y CSV | `reportes.js:L38-L70,L240-L375,L491-L515`; `report-model.js:L321-L332` |
| `categorias.js` + `category-model.js` | catálogo, uso derivado, CRUD/inactivar/eliminar | `categorias.js:L104-L167,L324-L409`; tres tests category |
| `servicios.js` + `service-model.js` | catálogo comercial CRUD y métricas | `servicios.js:L30-L54`; tests service|
| `propuestas.js` + `proposal-model.js` | estados comerciales y payload de conversión | `propuestas.js:L10-L45`; tests proposal|
| `configuracion-fiscal.js` + `fiscal-config-model.js` | configuración y estimación local | `configuracion-fiscal.js:L31-L99`; `fiscal-config-model.js:L36-L44` |
| `ajustes.js` + `settings-model.js` | defaults, guardar/restaurar y preview | `ajustes.js:L17-L25`; `settings-model.js:L3-L11` |
| `notificaciones.js` + `notification-model.js` | alertas derivadas, lecturas y preferencias | `notificaciones.js:L14-L23`; test de modelo |
| `cuenta.js` + `profile-model.js` | perfil local versionado, validación y dirty state | `cuenta.js:L9-L21`; test de modelo |
| `mock-data-loader.js` + `mock-data.json` + `mock-data.js` | carga primaria y fallback de baseline | `loader:L4-L20`; JSON válido; fallback incompleto |
| `package.json` + `tests/*.test.cjs` | scripts y cobertura automatizada | `npm run validate` PASS; `npm test` 140/141 por `jspdf` ausente |

Todas las referencias corresponden al snapshot del encabezado. Los rangos de línea son evidencia de ubicación, no garantía de ejecución en navegador.

## 18. Alcance de navegador diferido y control documental final

### 18.1 Alcance explícitamente diferido

No se verificó:

- navegación real Landing → Acceso → perfil ni redirecciones con historial;
- persistencia entre recargas, pestañas o sesiones reales;
- conversión Propuesta → Proyecto en dos páginas;
- creación/edición/anulación de Facturas y registro de pagos en DOM;
- PDF, CSV, enlaces de factura ni descargas del navegador;
- foco, trap, `inert`, lectores de pantalla o anuncios ARIA;
- responsive a 320/390/768/1440 px, overflow, contraste o layout;
- consola, errores de `fetch`, apertura con `file:` o fallback;
- simultaneidad, corrupción de storage, cuotas o `SecurityError` reales;
- seguridad, autorización, privacidad o cumplimiento SaaS;
- ninguna evaluación propia de la Fase 4.

### 18.2 Criterios de cierre documental de Fase 3

El artefacto se considera listo para entrega cuando se compruebe, después de escribirlo:

1. archivo UTF-8 sin BOM y sin marcadores de mojibake;
2. las 18 secciones requeridas presentes;
3. las tablas de módulos, storage, pruebas e integraciones contienen evidencia;
4. el conteo de las 14 integraciones suma exactamente 14;
5. no se presenta navegación, mock compartido o derivación local como integración real;
6. `git status --short` solo añade este archivo a los dos artefactos previos;
7. `git diff --check` permanece sin errores;
8. no se modificaron código, mocks, tests, configuración, README ni los documentos de Fases 1 y 2;
9. no se ejecutaron navegador, servidor, `build:css`, commit, push, PR ni Gentle-AI review;
10. no se inició la Fase 4.
