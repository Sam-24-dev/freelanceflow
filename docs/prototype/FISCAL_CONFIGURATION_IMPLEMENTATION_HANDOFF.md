# Configuración fiscal estimada — handoff final de diseño a implementación

Este documento convierte la tercera iteración de Stitch en un contrato de implementación para FreelanceFlow. La meta es incorporar **Configuración fiscal estimada** como un módulo operativo pequeño, confiable y coherente con el producto actual, sin convertirlo en un motor tributario ni alterar la facturación existente.

## Decisión ejecutiva

- Implementar el módulo en una rama nueva `feat/fiscal-configuration-module` creada desde el `origin/main` más reciente.
- Trabajar en un worktree aislado, recomendado: `C:\Users\USER\Documents\Proyecto-FreelanceFlow-fiscal-config`.
- No implementar dentro del worktree actual `refactor/product-ui-redesign`: contiene cambios locales no relacionados y un baseline anterior.
- Usar la pantalla final de PC como referencia visual principal.
- Usar tablet y móvil únicamente como referencias de densidad y orden responsive; su contenido fiscal no es fuente de verdad.
- Reutilizar el shell, la protección por rol, la Bitácora, el patrón de modelos puros, `localStorage`, Tailwind y las convenciones actuales.
- Mantener la solución frontend-only: HTML, CSS/Tailwind compilado, JavaScript vanilla y persistencia local.
- No modificar cálculos ni registros existentes de Facturas. En este bloque la configuración alimenta exclusivamente su propia vista previa estimada.
- Aplicar TDD mínimo a validación y cálculo; la aceptación final depende de recorridos reales en navegador.
- Dejar la rama validada y lista para commit/push. No crear commit, push o PR sin autorización explícita del usuario.

### Ruta rápida

1. Actualizar referencias remotas sin tocar el worktree sucio.
2. Crear worktree y rama desde `origin/main`.
3. Recuperar decisiones del proyecto con Engram y registrar el cambio SDD `fiscal-configuration-module`.
4. Escribir pruebas del modelo fiscal y observar RED.
5. Implementar modelo, página, controlador, persistencia, navegación y Bitácora.
6. Construir CSS y ejecutar validaciones técnicas.
7. Recorrer como usuario real los flujos de primera configuración, validación, cálculo, guardado, cancelación, roles y responsive.
8. Revisar el diff, eliminar artefactos locales y reportar la rama lista para publicación.

## Jerarquía de fuentes de verdad

Ante cualquier contradicción, aplicar este orden:

1. Código y patrones presentes en el `main` remoto más reciente.
2. `docs/specs/FreelanceFlow_Catalogo_Formularios_v1.md`, sección `FRM-007 — Configuración Fiscal`.
3. Reglas de roles, navegación y Bitácora ya implementadas.
4. Este handoff.
5. Pantallas finales de Stitch.

Stitch define jerarquía y composición visual. No puede introducir países, impuestos, regímenes, declaraciones, automatizaciones, campos o efectos financieros no autorizados.

## Fuentes visuales finales

| Dispositivo | Screen ID | Uso autorizado |
|---|---|---|
| PC | `8192e870c6474f9398e076acc7ea5d5b` | Fuente visual principal: shell navy, workspace cálido, alerta inicial, formulario, preview y acciones. |
| Tablet | `5d20779dee9d451895925d4377c4899c` | Referencia secundaria para proporción formulario/preview. No reutilizar su copy ni sus conceptos fiscales. |
| Móvil | `fce4ab2290e74d67bf26ff595330830e` | Referencia secundaria para orden vertical y CTA inferior. No reutilizar su copy ni sus conceptos fiscales. |

Proyecto Stitch: `5303215837171127369`.

### URLs de consulta

- PC: `https://stitch.withgoogle.com/preview/5303215837171127369?node-id=8192e870c6474f9398e076acc7ea5d5b`
- Tablet: `https://stitch.withgoogle.com/preview/5303215837171127369?node-id=5d20779dee9d451895925d4377c4899c`
- Móvil: `https://stitch.withgoogle.com/preview/5303215837171127369?node-id=fce4ab2290e74d67bf26ff595330830e`

Si Stitch MCP está disponible, consultar las pantallas en modo solo lectura. No generar variantes nuevas ni editar el proyecto: la iteración visual está cerrada.

### Evaluación final de las pantallas

#### PC — referencia canónica

Conservar:

- Sidebar navy y workspace claro.
- Alerta superior de primera configuración.
- Título, subtítulo e información de alcance.
- Card de formulario y card de vista previa.
- Acciones `Cancelar` y `Guardar configuración`.
- Jerarquía sobria y números tabulares.

Corregir en código:

- El estado inicial no puede mostrar retención o impuesto calculados si los campos están vacíos y el switch está apagado.
- Si `aplica_impuesto_valor_agregado` está apagado, `porcentaje_impuesto` debe ocultarse y el impuesto efectivo debe ser `0`.
- El aviso inferior del preview no debe afirmar que se modifican facturas existentes ni prometer automatización tributaria.
- El destino activo debe llamarse `Configuración fiscal`, no el genérico `Configuración` si existen ambos módulos.
- Usar el shell real de `assets/js/app-shell.js`, no copiar la navegación dibujada por Stitch.

#### Tablet — referencia parcial

No copiar:

- `Monotributo / Simplificado`.
- IIBB, ISR, retenciones locales o referencias a autoridades fiscales.
- Identificación fiscal como campo opcional.
- Marca `Freelancer Ledger`.
- Canvas oscuro completo.

Implementar tablet a partir del contrato de PC y los breakpoints reales del producto.

#### Móvil — referencia parcial

No copiar:

- `Income Tax`, IVA por defecto, cálculo automático o impuestos aplicados a movimientos.
- Ausencia de `regimen_tributario`.
- Aplicación automática a facturas futuras.
- Layout horizontal reducido que simula móvil sin serlo.

Implementar móvil como una sola columna real, desde `320px`, usando el app header y drawer vigentes.

## Alcance aprobado

### Funciones incluidas

- Pantalla operativa `pages/configuracion-fiscal.html`.
- Estado inicial cuando todavía no existe configuración local.
- Formulario con los cinco campos autorizados.
- Validación inline y resumen de errores accesible.
- Vista previa reactiva sobre una base neutral de `USD 1,000.00`.
- Guardado y lectura local en el navegador.
- Cancelación que restaura el último estado persistido.
- Confirmación antes de descartar cambios sin guardar.
- Toast o mensaje de éxito después del guardado.
- Navegación exclusiva del perfil operativo.
- Evento significativo de guardado en la Bitácora, sin exponer valores fiscales.
- Responsive real para PC, tablet y móvil.

### Fuera de alcance

- Backend, API, base de datos o sincronización entre dispositivos.
- Autenticación o autorización real.
- Integraciones con autoridades tributarias.
- Declaraciones, formularios oficiales, reportes fiscales o presentación de impuestos.
- Reglas por país, provincia, estado, municipio o tipo de contribuyente.
- RFC, RIF, NIF, DNI, RUC, CUIT u otros formatos validados por jurisdicción.
- Monotributo, ISR, IIBB, impuestos locales o tasas predeterminadas por país.
- Asesoría legal, contable o fiscal.
- Automatización de obligaciones, retenciones o liquidaciones.
- Modificación de totales de Facturas, Movimientos, Reportes o Propuestas existentes.
- Campo de moneda, ya que no forma parte de `FRM-007`.
- Historial de configuraciones, auditoría legal, versionado o restauración avanzada.
- Dependencias nuevas, framework nuevo o servicio externo.

## Contrato de dominio

### Entidad `fiscalConfiguration`

```js
{
  identificacion_fiscal: "ABC-12345",
  regimen_tributario: "General",
  porcentaje_retencion_estimado: 10,
  aplica_impuesto_valor_agregado: true,
  porcentaje_impuesto: 16,
  fecha_actualizacion: "2026-07-16T18:00:00.000Z"
}
```

Los valores son supuestos editables del usuario. El producto no interpreta su significado legal.

### Normalización

- Aplicar `trim()` a `identificacion_fiscal` y `regimen_tributario`.
- Convertir porcentajes a números finitos.
- Redondear porcentajes y resultados monetarios a dos decimales.
- Permitir `0` y `100` como límites válidos.
- Si `aplica_impuesto_valor_agregado === false`, normalizar `porcentaje_impuesto` a `0` al persistir.
- No guardar cadenas vacías como configuración válida.
- No mutar el objeto recibido por las funciones del modelo.

### Régimen tributario

El catálogo oficial define `regimen_tributario` como `select`, pero no define opciones canónicas.

Regla de implementación:

1. Revisar primero si el `main` vigente ya añadió un catálogo autorizado.
2. Si existe, reutilizarlo sin duplicarlo.
3. Si no existe, usar un control nativo `input` con `datalist` y sugerencias neutrales (`General`, `Simplificado`, `Otro`) permitiendo texto libre.
4. No asociar esas sugerencias a reglas, porcentajes o jurisdicciones.

Esta adaptación evita inventar un catálogo legal cerrado y conserva una experiencia similar a selección.

## Validaciones

| Campo | Regla | Mensaje visible |
|---|---|---|
| `identificacion_fiscal` | requerido después de `trim()` | `La identificación fiscal es obligatoria.` |
| `regimen_tributario` | requerido después de `trim()` | `Selecciona o ingresa un régimen tributario.` |
| `porcentaje_retencion_estimado` | requerido, finito, entre 0 y 100 | `El porcentaje debe estar entre 0 y 100.` |
| `aplica_impuesto_valor_agregado` | booleano | Sin error textual; usar checkbox nativo. |
| `porcentaje_impuesto` | requerido y entre 0 y 100 solo si el switch está activo | `El porcentaje debe estar entre 0 y 100.` |

Comportamiento al fallar:

- Mostrar todos los errores relevantes, no solo el primero.
- Asociar cada mensaje mediante `aria-describedby`.
- Aplicar `aria-invalid="true"` al control inválido.
- Enfocar el primer control inválido después del submit.
- No actualizar `localStorage`, la Bitácora ni el estado guardado.

## Cálculo de la vista previa

La vista previa usa una base fija solo para explicar el efecto de los supuestos:

```js
const base = 1000;
const retention = round(base * retentionRate / 100);
const tax = appliesTax ? round(base * taxRate / 100) : 0;
const estimatedTotal = round(base - retention + tax);
```

### Ejemplos verificables

| Retención | Impuesto activo | % impuesto | Resultado |
|---:|---|---:|---:|
| 0 | No | 0 | `USD 1,000.00` |
| 10 | No | 0 | `USD 900.00` |
| 10 | Sí | 16 | `USD 1,060.00` |
| 100 | No | 0 | `USD 0.00` |

Reglas:

- Usar `Intl.NumberFormat` con moneda `USD` solo en la vista previa.
- No agregar campo de moneda al formulario.
- No calcular con valores inválidos; mostrar `—` o `USD 0.00` hasta que sean utilizables.
- Ocultar la fila `Impuesto estimado` cuando el switch esté apagado, o mostrarla explícitamente como `USD 0.00`; elegir una opción y mantenerla en todos los breakpoints.
- Mostrar siempre que se trata de una estimación.
- No persistir la base `1000`; es una constante de presentación.

## Persistencia frontend

### Clave

```text
freelanceflow_fiscal_config_v1
```

### Reglas

- Guardar un único objeto JSON, no un array ni un historial.
- Si no existe la clave, renderizar el estado de primera configuración.
- Si el JSON está corrupto o no es un objeto, tratarlo como ausencia de configuración sin romper la pantalla.
- Mantener los cambios actuales solo en memoria hasta un submit válido.
- Al cancelar, restaurar el último objeto válido persistido.
- Al guardar, actualizar `fecha_actualizacion` y ocultar el estado inicial.
- Si `localStorage.setItem` falla, mantener el formulario visible y mostrar un mensaje que no afirme que el cambio fue persistido.
- No crear datos fiscales en `mock-data.json` si no son necesarios; el estado inicial real es parte del alcance.

## Información y copy final

### Encabezado

- Eyebrow: `Ajustes operativos`.
- Título: `Configuración fiscal estimada`.
- Descripción: `Define los supuestos utilizados para estimar retenciones e impuestos en tus facturas.`

### Estado inicial

- Título: `Aún no has configurado tus supuestos fiscales.`
- Descripción: `Completa estos datos para visualizar estimaciones en tus facturas.`

### Aviso de alcance

`Estos valores son estimaciones de referencia y no reemplazan asesoría fiscal profesional.`

No mostrar `prototipo`, `demo`, `simulación`, `automatización tributaria` ni disclaimers técnicos sobre `localStorage`.

### Formulario

- Card: `Detalles fiscales`.
- `Identificación fiscal`.
- Placeholder: `Ingresa tu identificación fiscal`.
- `Régimen tributario`.
- Placeholder: `Selecciona o ingresa un régimen tributario`.
- `Retención estimada (%)`.
- `Aplicar impuesto al valor agregado`.
- Ayuda: `Calcula un impuesto estimado en la vista previa.`
- Campo condicional: `Porcentaje de impuesto (%)`.

### Vista previa

- Card: `Vista previa de estimación`.
- Base: `Base de cálculo` / `USD 1,000.00`.
- `Subtotal`.
- `Retención estimada`.
- `Impuesto estimado`.
- `Total estimado`.
- Nota: `Esta vista previa es referencial y no modifica tus registros financieros.`

### Acciones y mensajes

- Primaria: `Guardar configuración`.
- Secundaria: `Cancelar`.
- Éxito: `Configuración fiscal guardada correctamente.`
- Error de persistencia: `No pudimos guardar la configuración. Inténtalo nuevamente.`
- Confirmación al cancelar cambios: `¿Descartar los cambios sin guardar?`

## Estados de UI obligatorios

1. Primera configuración sin valores persistidos.
2. Formulario válido con preview reactivo.
3. Switch de impuesto apagado y campo condicional oculto.
4. Switch encendido y porcentaje visible/requerido.
5. Uno o varios errores inline.
6. Guardado exitoso.
7. Cancelación con cambios pendientes.
8. Error al leer o escribir persistencia local.
9. Acceso bloqueado por perfil administrativo.

## Diseño responsive

### Sistema visual

- Sidebar navy vigente del producto.
- Workspace cálido `#FFFDF8` o el token actual equivalente.
- Cards claras, borde fino y radios coherentes con Categorías, Servicios y Propuestas.
- CTA amber para `Guardar configuración`.
- Teal solo para información y análisis.
- Rojo únicamente para errores reales.
- Números con `font-variant-numeric: tabular-nums`.
- Nada de canvas oscuro completo, gradientes SaaS, emojis o iconos renderizados como texto.

### PC — `1280px` o más

- Reutilizar sidebar expandido/compacto del shell.
- Contenido con ancho máximo legible, sin convertirse en una maqueta diminuta centrada.
- Encabezado y avisos en la parte superior.
- Grid principal: formulario flexible + preview de aproximadamente `320–360px`.
- Preview sticky solo si el patrón existente lo admite sin tapar contenido; de lo contrario, estático.
- Acciones al final del formulario, alineadas a la derecha.

### Tablet — `768px` a `1279px`

- Reutilizar app header y drawer del shell; no copiar una navegación web horizontal.
- Entre `900px` y `1279px`, permitir dos columnas si ambas conservan labels y campos legibles.
- Debajo de `900px`, apilar formulario y preview.
- Mantener acciones visibles al final; no reducir tipografía para forzar dos columnas.
- No usar contenido ni opciones fiscales de la referencia Stitch tablet.

### Móvil — `320px` a `767px`

- App header compacto y acceso mediante drawer.
- Una sola columna: estado inicial, título, aviso, formulario, preview y acciones.
- Inputs y botones de ancho completo.
- `Guardar configuración` como CTA principal de ancho completo.
- `Cancelar` debajo o antes de la primaria según el patrón vigente.
- Touch targets mínimos de `44 × 44px`.
- Sin scroll horizontal a `320px`.
- La navegación inferior operativa existente no debe recibir un sexto acceso fiscal.
- No copiar el layout horizontal ni el copy fiscal de la referencia Stitch móvil.

## Accesibilidad — WCAG 2.2 AA

- Un único `<h1>` y jerarquía de headings correcta.
- `<form>` con labels visibles; no depender de placeholders.
- `inputmode="decimal"` para porcentajes en móvil cuando corresponda.
- Checkbox nativo para el switch, con nombre accesible y estado perceptible.
- Al ocultar `porcentaje_impuesto`, aplicar `hidden` y `disabled` para sacarlo del árbol y del submit.
- Resumen de errores con `role="alert"`.
- Mensaje de guardado con `role="status"`, `aria-live="polite"` y `aria-atomic="true"`.
- Foco visible en enlaces, inputs, checkbox y botones.
- Orden de tabulación igual al orden visual.
- Contraste AA en texto secundario, bordes, errores y estados deshabilitados.
- No depender solo de color en valores de retención e impuesto.
- Respetar `prefers-reduced-motion` y evitar animaciones innecesarias.

## Roles, navegación y Bitácora

### Perfil operativo

- Puede ver `Configuración fiscal` en la navegación de ajustes/operación.
- Puede abrir `configuracion-fiscal.html` directamente.
- Puede editar y guardar la configuración.

### Perfil administrativo

- Continúa viendo únicamente Bitácora.
- Si intenta abrir la URL fiscal directamente, debe volver a `bitacora.html`.
- No añadir Configuración fiscal a su sidebar ni navegación móvil.

### Sin perfil

- Una URL directa debe redirigir a `acceso.html` mediante el shell existente.

### Navegación móvil

- Mantener el bottom nav operativo actual sin agregar Configuración fiscal.
- Acceder al módulo desde el drawer/menu completo.

### Bitácora

Agregar el nombre de módulo a `assets/js/activity-log.js` y registrar solo actividad útil:

| Acción | Momento | Descripción segura |
|---|---|---|
| `Ingreso a pantalla` | Lo registra el mecanismo compartido al entrar | Copy estándar del shell. |
| `Configuración fiscal guardada` | Después de persistir correctamente | `Se actualizó la configuración fiscal estimada.` |

No registrar:

- Identificación fiscal.
- Régimen tributario.
- Porcentajes.
- Cada pulsación, toggle, cancelación o cálculo reactivo.
- Actividad administrativa.

La deduplicación compartida debe evitar eventos consecutivos equivalentes.

## Archivos previstos

### Crear

| Archivo | Responsabilidad |
|---|---|
| `pages/configuracion-fiscal.html` | Estructura semántica de la pantalla. |
| `assets/js/fiscal-config-model.js` | Normalización, validación y cálculo puros. |
| `assets/js/configuracion-fiscal.js` | Estado UI, persistencia, render y eventos. |
| `tests/fiscal-config-model.test.cjs` | Pruebas mínimas del contrato fiscal. |

### Modificar

| Archivo | Cambio mínimo |
|---|---|
| `assets/css/app.css` | Estilos fuente del módulo y breakpoints. |
| `assets/css/styles.css` | Regenerado exclusivamente con `npm run build:css`. |
| `assets/js/app-shell.js` | Navegación operativa y protección por rol. |
| `assets/js/activity-log.js` | Mapeo de módulo fiscal. |
| `tests/app-shell-access.test.cjs` | Navegación y redirects por rol. |
| `package.json` | Incluir los nuevos JS en `npm run validate`. |
| `README.md` | Añadir el módulo y su persistencia local. |

### Modificar solo si una prueba demuestra necesidad

- Tests globales de encoding/copy para incluir la nueva pantalla.
- `assets/data/mock-data.json` únicamente si `main` ya posee un catálogo fiscal reutilizable.

No modificar Facturas, Reportes, Movimientos, Propuestas ni sus modelos en este bloque.

## Estrategia SDD y TDD

### Cambio SDD

- Nombre: `fiscal-configuration-module`.
- Artifact store recomendado: Engram, salvo que el proyecto vigente ya use OpenSpec para el cambio.
- Delivery strategy: `ask-on-risk`.
- Alcance: un módulo frontend cohesivo; evitar encadenar PRs salvo que el diff real lo exija.

Artefactos mínimos:

| Fase | Resultado esperado |
|---|---|
| Explore | Confirmar baseline, campos oficiales, shell, roles y ausencia de integración fiscal real. |
| Proposal | Definir pantalla, persistencia local, preview y no-objetivos. |
| Spec | Escenarios de validación, cálculo, guardado, roles y responsive. |
| Design | Modelo puro + controlador DOM + shell existente. |
| Tasks | Pasos ejecutables con gates de validación. |
| Apply | Implementación TDD y progreso registrado. |
| Verify | Evidencia técnica y recorridos reales. |

### TDD mínimo — RED → GREEN → REFACTOR

Antes del modelo, escribir pruebas que fallen para:

1. Normalizar texto y porcentajes sin mutar el input.
2. Rechazar identificación y régimen vacíos.
3. Aceptar únicamente porcentajes finitos entre `0` y `100`.
4. Requerir impuesto solo cuando el switch está activo.
5. Forzar impuesto efectivo `0` cuando el switch está apagado.
6. Calcular `1000 - retención + impuesto` con redondeo monetario.
7. Ignorar JSON local corrupto mediante el controlador o una función pequeña testeable, si ya existe un patrón reutilizable.

Mantener una sola suite enfocada. No crear repositorios, servicios, factories ni capas para un único objeto local.

## Skills y MCPs por fase

| Paso | Skills a cargar | MCP/herramienta | Uso concreto |
|---|---|---|---|
| Preflight | `architecture`, `ponytail` | Shell/Git, Engram | Confirmar rama, worktrees, baseline y alcance mínimo. |
| SDD | `sdd-init`, `sdd-explore`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks` | Engram | Recuperar contexto y persistir decisiones sin inflar el repo. |
| Modelo | `test-driven-development` | Node test runner | Ejecutar RED → GREEN → REFACTOR. |
| UI | `frontend-design`, `ui-ux-pro-max` | Stitch solo lectura | Traducir jerarquía visual al sistema vigente, no copiar HTML. |
| Accesibilidad | `accessibility` | Playwright/browser | Labels, foco, teclado, switch, errores, contraste y responsive. |
| Integración | `architecture`, `ponytail` | Engram | Reutilizar shell, roles y Bitácora; evitar acoplar Facturas. |
| Validación técnica | `lint-and-validate` | Shell | Build CSS, syntax, JSON, tests y diff check. |
| Validación de producto | `playwright`, `verification-loop`, `web-design-guidelines` | Playwright MCP o Browser MCP | Recorrer flujos de usuario reales y revisar consola/viewport. |
| Publicación | `work-unit-commits`, `github-pr` | Git/GitHub CLI | Revisar scope y publicar solo tras autorización. |

Reglas de ejecución:

- Resolver y leer cada `SKILL.md` antes de usar la skill.
- Usar Ponytail: ninguna dependencia nueva y la menor cantidad de archivos/lógica posible.
- Engram debe guardar decisiones, descubrimientos, bugs y resumen de sesión.
- Gentle-AI no requiere subagentes para implementación rutinaria. Si una revisión de alto riesgo lo justifica, usar como máximo un subagente económico/medio y esperar su resultado.
- No usar TestSprite por defecto: Playwright cubre los recorridos reales sin añadir configuración al repositorio.
- No guardar screenshots, videos, trazas, logs ni carpetas MCP en Git.

## Plan de ejecución por pasos

### Paso 0 — Preflight seguro

Objetivo: trabajar sobre el baseline correcto sin tocar cambios ajenos.

1. Ejecutar `git status --short`, `git branch --show-current` y `git worktree list`.
2. Ejecutar `git fetch origin --prune`.
3. Confirmar que `origin/main` contiene el merge de Propuestas y los módulos Categorías/Servicios.
4. Confirmar que no existen rama o worktree fiscal previos.
5. Crear:

```powershell
git worktree add -b feat/fiscal-configuration-module `
  ..\Proyecto-FreelanceFlow-fiscal-config `
  origin/main
```

6. Copiar este handoff al nuevo worktree, porque el documento nace como archivo local del ciclo de diseño:

```powershell
Copy-Item `
  .\docs\prototype\FISCAL_CONFIGURATION_IMPLEMENTATION_HANDOFF.md `
  ..\Proyecto-FreelanceFlow-fiscal-config\docs\prototype\FISCAL_CONFIGURATION_IMPLEMENTATION_HANDOFF.md
```

7. Ejecutar todo el trabajo posterior dentro del nuevo worktree.

Gate:

- Rama `feat/fiscal-configuration-module`.
- Base igual a `origin/main`.
- Worktree fiscal limpio.
- Handoff disponible dentro del worktree fiscal.
- Worktree original sin cambios adicionales.

### Paso 1 — Contexto y SDD

1. Consultar Engram por `fiscal configuration`, roles, shell, Bitácora y módulos anteriores.
2. Revisar `AGENTS.md`, `README.md`, `FRM-007` y los patrones actuales de Categorías/Servicios/Propuestas.
3. Confirmar que la configuración no afectará cálculos de Facturas.
4. Crear o continuar el cambio SDD `fiscal-configuration-module`.
5. Registrar propuesta, spec, design y tasks antes de aplicar.

Gate:

- Alcance y no-objetivos explícitos.
- Contrato de cálculo cerrado.
- Sin reglas fiscales por país.

### Paso 2 — Modelo con TDD

1. Crear `tests/fiscal-config-model.test.cjs` en estado RED.
2. Implementar `assets/js/fiscal-config-model.js` como módulo puro reutilizable en navegador y Node.
3. Exponer solo funciones necesarias, por ejemplo:
   - `normalizeFiscalConfiguration`.
   - `validateFiscalConfiguration`.
   - `calculateFiscalEstimate`.
4. Ejecutar la prueba enfocada hasta GREEN.
5. Refactorizar solo duplicación real.

Gate:

- Casos límite `0`, `100`, `NaN`, negativos y switch apagado cubiertos.
- Input inmutable.
- Sin dependencias.

### Paso 3 — HTML y shell

1. Crear `pages/configuracion-fiscal.html` con shell compartido.
2. Añadir skip link, `<main>`, `<h1>`, avisos, `<form>`, preview y live region.
3. Cargar scripts en orden: modelo, activity log, app shell y controlador.
4. Añadir el módulo a la navegación operativa.
5. Mantener admin solo en Bitácora y sin perfil en Acceso.
6. Mantener el bottom nav móvil sin cambios.

Gate:

- No hay sidebar duplicado en HTML.
- La protección ocurre antes de exponer contenido operativo significativo.
- Todos los controles tienen labels visibles.

### Paso 4 — Diseño responsive

1. Añadir estilos fuente a `assets/css/app.css` reutilizando tokens/patrones existentes.
2. Implementar PC desde la referencia canónica.
3. Derivar tablet y móvil desde CSS real, no desde el contenido incorrecto de Stitch.
4. Comprobar `320`, `390`, `768`, `1024` y `1440px`.
5. Ejecutar `npm run build:css`.

Gate:

- Workspace cálido y sidebar navy.
- Sin overflow horizontal.
- Preview y campos legibles sin reducir tipografía.
- Acción primaria evidente en cada breakpoint.

### Paso 5 — Controlador y persistencia

1. Crear `assets/js/configuracion-fiscal.js`.
2. Leer configuración local con fallback seguro.
3. Renderizar primera configuración o valores persistidos.
4. Actualizar preview al cambiar campos válidos.
5. Mostrar/ocultar y habilitar/deshabilitar el porcentaje condicional.
6. Validar submit, persistir y mostrar éxito.
7. Implementar cancelación y confirmación de cambios pendientes.
8. Gestionar errores de `localStorage` sin perder silenciosamente datos.

Gate:

- Guardado y recarga conservan datos.
- Cancelar restaura el último guardado.
- Switch apagado elimina impuesto efectivo.
- No hay `innerHTML` con datos del usuario.

### Paso 6 — Bitácora y documentación

1. Añadir el nombre de pantalla al mapeo compartido.
2. Registrar un solo evento después de un guardado exitoso.
3. No registrar valores ni datos identificatorios.
4. Actualizar `README.md` con el módulo y su persistencia local.
5. Añadir nuevos scripts a `npm run validate`.

Gate:

- Evento operativo visible para admin en Bitácora.
- Sin actividad administrativa ni duplicada.
- README no promete backend ni cumplimiento fiscal.

### Paso 7 — Validación técnica

Ejecutar:

```powershell
npm run build:css
npm run validate
python -m json.tool assets/data/mock-data.json
npm test
git diff --check
```

También:

- Buscar mojibake y términos prohibidos en archivos públicos.
- Revisar enlaces relativos y orden de scripts.
- Confirmar que no se añadieron dependencias.
- Confirmar que no se modificaron módulos financieros fuera del alcance.

Los checks técnicos son obligatorios, pero no sustituyen la validación como usuario.

### Paso 8 — Validación real en navegador

1. Iniciar servidor local desde el worktree fiscal.
2. Abrir la landing y entrar como perfil operativo.
3. Navegar mediante la UI hasta Configuración fiscal.
4. Recorrer todos los escenarios de la matriz siguiente.
5. Repetir en PC, tablet y móvil.
6. Revisar errores de consola y requests fallidos.
7. Limpiar artefactos de Playwright antes de preparar Git.

Gate:

- Todos los recorridos de usuario pasan.
- Consola sin errores.
- Sin 404.
- UI comprensible para una persona que nunca vio el producto.

### Paso 9 — Revisión y preparación para publicar

1. Ejecutar `git status --short` y revisar cada archivo.
2. Comparar el diff contra la lista prevista.
3. Eliminar screenshots, trazas, logs, PID, carpetas MCP y temporales.
4. Ejecutar nuevamente los checks finales.
5. Hacer stage explícito por ruta, nunca `git add .`.
6. Revisar `git diff --cached --name-status`, `--stat` y `--check`.
7. Reportar archivos, validaciones y riesgos pendientes.
8. Esperar autorización para commit/push/PR.

Commit recomendado cuando exista autorización:

```text
feat(fiscal): add estimated fiscal configuration
```

## Matriz de validación real

### Acceso y navegación

- [ ] Landing → Acceso → Operativo → Dashboard.
- [ ] El menú completo muestra `Configuración fiscal`.
- [ ] El enlace abre `pages/configuracion-fiscal.html` sin 404.
- [ ] Acceso administrativo → Bitácora; no muestra el módulo fiscal.
- [ ] Admin abre URL fiscal directa → vuelve a Bitácora.
- [ ] Sin perfil abre URL fiscal directa → vuelve a Acceso.
- [ ] El bottom nav móvil conserva sus destinos actuales.

### Primera configuración

- [ ] Sin clave local aparece `Aún no has configurado tus supuestos fiscales.`
- [ ] Los campos empiezan vacíos, la retención efectiva es `0` y el impuesto está apagado.
- [ ] La base visual muestra `USD 1,000.00` sin deducciones inventadas.
- [ ] El campo de porcentaje de impuesto está oculto y deshabilitado.

### Validaciones

- [ ] Submit vacío muestra identificación, régimen y retención requeridos.
- [ ] `-1`, `101`, `Infinity`, letras y separadores inválidos no se guardan.
- [ ] `0` y `100` se aceptan.
- [ ] Al activar impuesto, su porcentaje pasa a ser obligatorio.
- [ ] El primer control inválido recibe foco.
- [ ] Los mensajes son anunciados por lector de pantalla.

### Preview

- [ ] Retención `10`, impuesto apagado → total `USD 900.00`.
- [ ] Retención `10`, impuesto `16` activo → total `USD 1,060.00`.
- [ ] Apagar impuesto nuevamente → campo oculto y total `USD 900.00`.
- [ ] Cambiar valores actualiza la vista previa sin recargar.
- [ ] No aparecen ISR, IIBB, Monotributo ni nombres de país.

### Guardado y cancelación

- [ ] Guardar valores válidos muestra confirmación profesional.
- [ ] Recargar conserva exactamente la configuración guardada.
- [ ] Editar y cancelar restaura los últimos valores persistidos.
- [ ] Cancelar cambios pendientes solicita confirmación.
- [ ] Rechazar la confirmación conserva el formulario editado.
- [ ] Un fallo de persistencia no muestra éxito falso.

### Bitácora

- [ ] Guardar genera un único evento operativo.
- [ ] El evento no expone identificación, régimen ni porcentajes.
- [ ] Navegar o recalcular no llena la Bitácora de ruido.
- [ ] Admin puede revisar el evento únicamente desde Bitácora.

### Responsive y accesibilidad

- [ ] `1440 × 1024`: sidebar y grid formulario/preview correctos.
- [ ] `1024 × 768`: layout legible sin navegación web horizontal.
- [ ] `768 × 1024`: cards apiladas o dos columnas utilizables.
- [ ] `390 × 844`: una columna y CTA fácil de alcanzar.
- [ ] `320 × 700`: sin overflow horizontal ni texto cortado.
- [ ] Todo el formulario funciona con teclado.
- [ ] Foco visible y orden lógico.
- [ ] Touch targets mínimos de 44px.
- [ ] Contraste suficiente y valores no diferenciados solo por color.

### Calidad de producto

- [ ] No aparece `demo`, `prototipo`, `simulación` ni copy interno.
- [ ] No se promete cálculo fiscal automático, cumplimiento o asesoría.
- [ ] No hay reglas, siglas o tasas específicas de una jurisdicción.
- [ ] La pantalla se siente parte de FreelanceFlow y no una plantilla aislada.
- [ ] Una persona nueva entiende qué configura, qué estima y qué no hace el módulo.
- [ ] Facturas y módulos actuales conservan su comportamiento.

## Criterio de aprobación

La implementación está lista para solicitar commit/push únicamente cuando:

1. Usa una rama/worktree nuevos desde el `origin/main` vigente.
2. Implementa solo los cinco campos autorizados.
3. El cálculo y las validaciones cumplen el contrato.
4. El estado inicial, el switch condicional, guardado y cancelación funcionan.
5. Los roles y la Bitácora respetan las reglas actuales.
6. PC, tablet y móvil pasan los recorridos reales.
7. La consola está limpia y no existen 404.
8. Build, validación, JSON, tests y `git diff --check` pasan.
9. El diff no contiene artefactos, dependencias ni cambios fuera de alcance.
10. El usuario autoriza explícitamente publicar.
