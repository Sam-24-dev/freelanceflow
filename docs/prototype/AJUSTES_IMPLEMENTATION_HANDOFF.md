# Ajustes de facturación y preferencias — handoff final de diseño a implementación

Este documento convierte la última iteración aprobada de Stitch en un contrato de implementación para FreelanceFlow. La meta es incorporar **Ajustes** como un módulo operativo pequeño, útil y coherente con el producto actual, sin convertirlo en una configuración de cuenta, un panel administrativo ni una promesa de automatización que la Fase 1 todavía no ofrece.

## Decisión ejecutiva

- La iteración visual queda cerrada. No solicitar una cuarta variante en Stitch.
- Usar la pantalla final de PC como fuente visual y de contenido principal.
- Usar tablet y móvil solo como referencias de composición responsive.
- Implementar desde el `origin/main` más reciente en un worktree aislado; no trabajar sobre un árbol con cambios locales ajenos.
- Reutilizar el shell, la protección por perfil, la Bitácora, `localStorage`, los modelos puros y la compilación CSS vigentes.
- Mantener el alcance frontend-only: HTML, CSS/Tailwind compilado y JavaScript vanilla, sin dependencias nuevas.
- Los ajustes controlan su formulario, persistencia y vista previa. No deben modificar facturas, propuestas, reportes ni movimientos existentes.
- No afirmar en la interfaz que los valores ya cambian documentos reales si esa integración no forma parte del `main` vigente.
- Aplicar TDD mínimo al modelo de ajustes. La aceptación final depende de recorridos completos en un navegador real.
- Dejar la rama validada y lista para revisión. No hacer commit, push ni PR sin autorización explícita del usuario.

### Ruta rápida

1. Verificar Git, worktrees y el estado real de `origin/main`.
2. Confirmar que los PR previos requeridos ya estén fusionados antes de crear la rama.
3. Crear un worktree aislado desde el baseline correcto.
4. Recuperar con Engram las decisiones vigentes y registrar el cambio SDD `settings-module`.
5. Escribir primero las pruebas del modelo y observar RED.
6. Implementar modelo, página, controlador, persistencia, navegación y Bitácora.
7. Construir CSS y ejecutar los checks técnicos.
8. Validar flujos de usuario reales en PC, tablet y móvil.
9. Revisar el diff, eliminar artefactos locales y reportar si la rama está lista para publicar.

## Jerarquía de fuentes de verdad

Ante cualquier contradicción, aplicar este orden:

1. Código y patrones del `origin/main` remoto más reciente.
2. `AGENTS.md` y las reglas globales activas.
3. Especificaciones vigentes en `docs/specs/` y contexto SDD en `docs/sdd/`.
4. Reglas ya implementadas de perfiles, navegación, persistencia y Bitácora.
5. Este handoff.
6. Pantallas finales de Stitch.

Stitch define jerarquía, densidad y composición visual. No puede introducir lógica, datos, módulos o capacidades no autorizadas.

## Fuentes visuales finales

Proyecto Stitch: `5303215837171127369`.

| Dispositivo | Screen ID | Uso autorizado |
|---|---|---|
| PC | `c09c94b1d65e4c22a5131adb50e48f70` | Referencia canónica para contenido, jerarquía, distribución, cards y acciones. |
| Tablet | `16ee726225084db8bbd4bc6ce76d850e` | Referencia de composición compacta y orden vertical. |
| Móvil | `3d4ec6a62a5740348a3a08e37f5905c4` | Referencia de una columna, densidad, acciones y lectura desde 320 px. |

### URLs de consulta

- PC: `https://stitch.withgoogle.com/preview/5303215837171127369?node-id=c09c94b1d65e4c22a5131adb50e48f70`
- Tablet: `https://stitch.withgoogle.com/preview/5303215837171127369?node-id=16ee726225084db8bbd4bc6ce76d850e`
- Móvil: `https://stitch.withgoogle.com/preview/5303215837171127369?node-id=3d4ec6a62a5740348a3a08e37f5905c4`

Si Stitch MCP está disponible, consultar estas pantallas en modo **solo lectura**. No generar nuevas variantes ni copiar su HTML o CSS.

## Evaluación final y correcciones obligatorias

### Elementos aprobados

- Identidad visual de FreelanceFlow.
- Sidebar navy y workspace cálido.
- Encabezado claro y sobrio.
- Secciones diferenciadas para facturación, moneda y marca visual.
- Card de resumen que explica el comportamiento configurado.
- Acción primaria ámbar y acción secundaria discreta.
- Composición responsive específica para PC, tablet y móvil.
- Tono de producto real, sin apariencia genérica de panel administrativo.

### Correcciones que debe resolver el código

1. La referencia PC muestra `Net 15` y otra variante mostró `Net 30`. La fuente canónica será **15 días**, salvo que el `main` vigente ya defina otro valor explícito.
2. Los días de vencimiento deben ser un `input` numérico entero positivo, no un selector con opciones `Net`.
3. El baseline actual de Facturas usa `FAC-`, numeración de cuatro dígitos, 15 días y `USD`. La primera configuración debe respetar ese contrato, no copiar `INV-1042` de Stitch como dato real.
4. Usar el app shell vigente. No copiar búsqueda global, notificaciones, avatar, navegación ni controles decorativos de Stitch si no existen en el producto.
5. El texto visible debe decir `Restaurar valores predeterminados`, nunca `Restaurar valores demo`.
6. La marca visual es una vista de la identidad actual. No implementar carga de logos ni archivos.
7. La vista previa no debe afirmar que modifica facturas existentes.
8. PC controla contenido y valores; tablet y móvil solo controlan orden, densidad y adaptación.

## Objetivo de producto

El módulo permite que el perfil operativo:

- revise el formato previsto de la próxima factura;
- defina un prefijo y un número siguiente;
- defina los días de vencimiento predeterminados;
- seleccione una moneda admitida por el producto;
- confirme la identidad visual vigente;
- guarde o restaure la configuración local;
- comprenda el resultado mediante una vista previa inmediata.

La pantalla debe sentirse como parte del producto final. Su valor es reducir decisiones repetitivas y hacer visible una configuración coherente, no simular capacidades de cuenta o backend.

## Alcance aprobado

### Incluido

- Página operativa `pages/ajustes.html`.
- Estado inicial con valores predeterminados coherentes con Facturas.
- Formulario accesible de facturación y moneda.
- Vista de la marca actual sin edición ni carga de archivos.
- Resumen reactivo de próxima numeración, vencimiento y moneda.
- Validación inline y resumen de errores.
- Guardado en `localStorage`.
- Restauración confirmada de valores predeterminados.
- Recuperación segura ante JSON corrupto.
- Navegación exclusiva para el perfil operativo.
- Eventos significativos y seguros en Bitácora.
- Responsive real para PC, tablet y móvil.

### Fuera de alcance

- Backend, API, base de datos o sincronización entre dispositivos.
- Gestión de cuenta, contraseñas, sesiones reales o seguridad de acceso.
- Planes, suscripciones, pagos, equipos, miembros o permisos adicionales.
- API keys, webhooks, integraciones o configuración técnica avanzada.
- Subida, recorte, almacenamiento o edición de logos.
- Personalización de colores, temas o plantillas de factura.
- Reglas fiscales o configuración por país.
- Numeración legal, series fiscales, sucursales o múltiples secuencias.
- Cambio retroactivo de facturas, propuestas, reportes o movimientos.
- Historial/versionado de ajustes.
- Dependencias, frameworks o abstracciones nuevas para necesidades futuras.
- Modificar `mock-data.json` solo para guardar preferencias.

## Contrato de dominio

### Entidad `settings`

```js
{
  invoice_prefix: "FAC-",
  next_invoice_number: 25,
  default_due_days: 15,
  default_currency: "USD"
}
```

Los valores iniciales reflejan el baseline observado en Facturas: registros `FAC-0019` a `FAC-0024`, próxima numeración `FAC-0025`, vencimiento a 15 días y moneda `USD`. Durante la implementación se debe verificar nuevamente este baseline en el `origin/main` actualizado.

### Valores predeterminados

| Campo | Valor | Motivo |
|---|---:|---|
| `invoice_prefix` | `FAC-` | Prefijo vigente del módulo Facturas. |
| `next_invoice_number` | `25` | Siguiente número respecto del baseline actual; volver a verificar en `main`. |
| `default_due_days` | `15` | Comportamiento vigente al crear una factura. |
| `default_currency` | `USD` | Moneda predeterminada vigente. |

Si el `main` actualizado contiene un baseline distinto, actualizar los defaults y las pruebas para que la pantalla no contradiga al producto.

### Normalización

- Aplicar `trim()` a `invoice_prefix`.
- Convertir `next_invoice_number` y `default_due_days` a números.
- Aceptar solo enteros positivos.
- Convertir la moneda a mayúsculas.
- No mutar el objeto recibido por las funciones del modelo.
- Formatear el número con un mínimo de cuatro dígitos: `25` → `0025`; no truncar números mayores.
- No almacenar la marca visual: la identidad se obtiene de los assets vigentes.

### Catálogo de monedas

- Reutilizar el catálogo de monedas ya aceptado por el producto en el `main` vigente.
- El baseline actual contempla `USD`, `EUR` y `MXN` en el catálogo de Servicios.
- No crear una capa compartida nueva únicamente para evitar tres valores repetidos.
- Si el catálogo cambia antes de implementar, usar la fuente vigente y actualizar las pruebas.
- No mostrar símbolos ambiguos sin el código ISO.

### Vista previa

El modelo debe producir al menos:

```js
{
  invoice_number: "FAC-0025",
  due_behavior: "15 días después de la emisión",
  currency: "USD"
}
```

Reglas:

- La vista previa cambia mientras el usuario edita, aunque los valores todavía no estén guardados.
- Si un valor requerido es inválido, mostrar `—` en el dato afectado; no inventar un reemplazo silencioso.
- La numeración combina prefijo normalizado y número con padding de cuatro dígitos.
- La descripción de vencimiento expresa el comportamiento relativo; no necesita una fecha fija ni cálculos dependientes de zona horaria.
- Mostrar el código de moneda con `font-variant-numeric: tabular-nums` cuando corresponda.
- Añadir la aclaración: `Esta vista previa no modifica facturas existentes.`

## Validaciones

| Campo | Regla | Mensaje visible |
|---|---|---|
| `invoice_prefix` | requerido después de `trim()` | `El prefijo de factura es obligatorio.` |
| `next_invoice_number` | número entero mayor que 0 | `Ingresa un número de factura entero mayor que 0.` |
| `default_due_days` | número entero mayor que 0 | `Ingresa una cantidad de días entera mayor que 0.` |
| `default_currency` | requerido y perteneciente al catálogo vigente | `Selecciona una moneda predeterminada.` |

Comportamiento al fallar:

- Mostrar todos los errores relevantes.
- Asociar cada mensaje con `aria-describedby`.
- Aplicar `aria-invalid="true"` al control inválido.
- Enfocar el primer control inválido al enviar.
- No escribir en `localStorage`.
- No registrar un evento de Bitácora.
- Conservar los valores escritos para que el usuario pueda corregirlos.

No añadir máximos arbitrarios, expresiones regulares complejas ni reglas legales que no existan en las especificaciones.

## Persistencia frontend

### Clave

```text
freelanceflow_settings_v1
```

### Reglas

- Guardar un único objeto JSON, no un historial.
- Si no existe la clave, renderizar los defaults sin escribirlos automáticamente.
- Si el JSON está corrupto, no es un objeto o no supera la normalización, usar defaults sin romper la pantalla.
- Los cambios permanecen en memoria hasta un guardado válido.
- Al guardar con éxito, actualizar el estado persistido y mostrar confirmación.
- Si `localStorage.setItem` falla, mantener el formulario y mostrar un error honesto.
- `Restaurar valores predeterminados` debe pedir confirmación nativa con `window.confirm()` salvo que el `main` ya tenga un patrón accesible reutilizable.
- Confirmar la restauración reemplaza y persiste los defaults; cancelar no cambia el formulario ni el almacenamiento.
- No guardar imágenes, HTML, estilos ni información de sesión.

## Integración con Facturas

### Obligatorio en este cambio

- Mantener coherencia visual y semántica con la numeración, los días y la moneda actuales.
- No modificar facturas existentes ni sus cálculos.
- No afirmar que la configuración ya altera la creación de facturas si el flujo no la consume.

### No obligatorio en este cambio

- Hacer que `facturas.js` consuma estos ajustes.
- Incrementar automáticamente `next_invoice_number` al crear una factura.
- Migrar la generación actual de `FAC-####` a un servicio compartido.

Solo integrar estos defaults en el formulario de nueva factura si el `main` actualizado ya ofrece un punto compartido y probado que permita hacerlo con un cambio pequeño y sin alterar documentos existentes. Si no existe, dejarlo fuera y registrarlo como siguiente mejora; no abrir esa arquitectura dentro de esta rama.

## Copy final de interfaz

No mostrar `demo`, `prototipo`, `simulación`, `mock`, `Fase 1` ni explicaciones técnicas sobre `localStorage`.

### Encabezado

- Eyebrow: `Configuración operativa`.
- Título: `Ajustes de facturación y preferencias`.
- Descripción: `Define los valores predeterminados de tu flujo de facturación.`

### Facturación

- Sección: `Estructura de facturación`.
- Ayuda: `Configura cómo se presenta la numeración y el vencimiento en la vista previa.`
- Campo: `Prefijo de factura`.
- Campo: `Siguiente número de factura`.
- Campo: `Días de vencimiento predeterminados`.

### Moneda

- Sección: `Moneda predeterminada`.
- Ayuda: `Selecciona la moneda principal para la vista previa de facturación.`
- Campo: `Moneda`.

### Marca visual

- Sección: `Marca visual`.
- Texto: `Identidad actual de FreelanceFlow`.
- Ayuda: `Esta identidad se utiliza como referencia visual del producto.`

### Resumen

- Título: `Resumen de configuración`.
- Etiqueta: `Próxima factura`.
- Etiqueta: `Vencimiento`.
- Etiqueta: `Moneda`.
- Nota: `Esta vista previa no modifica facturas existentes.`

### Acciones y mensajes

- Primaria: `Guardar ajustes`.
- Secundaria: `Restaurar valores predeterminados`.
- Confirmación: `¿Restaurar los valores predeterminados? Se reemplazarán los cambios actuales.`
- Éxito al guardar: `Ajustes guardados correctamente.`
- Éxito al restaurar: `Valores predeterminados restaurados.`
- Error de persistencia: `No pudimos guardar los ajustes. Inténtalo nuevamente.`
- Estado inicial: `Estás usando los valores predeterminados actuales.`

## Estados de interfaz

### 1. Primera visita

- Formulario precargado con defaults.
- Mensaje informativo breve.
- Vista previa completa y coherente.
- Sin escritura automática en almacenamiento.

### 2. Edición válida

- Preview reactivo.
- Botón de guardar disponible.
- Sin mensaje de éxito anterior después de un nuevo cambio.

### 3. Edición inválida

- Errores inline y resumen accesible.
- Preview afectado muestra `—`.
- Guardado bloqueado por validación del submit, no solo por `disabled`.

### 4. Guardado exitoso

- Mensaje de estado en región `aria-live="polite"`.
- Formulario conserva los valores guardados.
- Un único evento significativo en Bitácora.

### 5. Restauración

- Cancelar la confirmación conserva todo sin cambios.
- Confirmar reemplaza el formulario y el almacenamiento por defaults.
- Mostrar un único mensaje de éxito y un único evento de Bitácora.

### 6. Error de almacenamiento

- Mensaje visible y accionable.
- No afirmar que se guardó o restauró.
- No registrar actividad exitosa.
- Mantener los datos editados en pantalla.

## Diseño y comportamiento responsive

### PC — 1280 y 1440 px

- Reutilizar sidebar expandida y shell actual.
- Workspace cálido, sin canvas oscuro completo.
- Encabezado alineado con los módulos operativos vigentes.
- Layout principal de dos columnas, aproximadamente 2:1.
- Columna principal: Facturación, Moneda y Marca visual.
- Columna secundaria: Resumen de configuración.
- Acciones visibles al final del formulario, sin flotar sobre contenido.
- Cards entre 14 y 18 px de radio, bordes finos y sombra sobria.
- Números con cifras tabulares.

### Tablet — 768 y 1024 px

- Reutilizar el shell compacto vigente.
- Una sola columna para evitar formularios estrechos.
- Orden: encabezado → resumen → facturación → moneda → marca → acciones.
- Mantener separación clara entre grupos; no dejar espacios vacíos heredados del layout PC.
- No añadir paneles laterales ni navegación inventada.

### Móvil — 320 y 390 px

- Reutilizar header, drawer y bottom navigation vigentes.
- Una sola columna, sin scroll horizontal.
- Título en un máximo razonable de dos líneas a 390 px; permitir tres líneas a 320 px antes que reducir legibilidad.
- Controles y botones de ancho completo.
- Targets táctiles de al menos 44 × 44 px.
- El resumen debe leerse antes del formulario o inmediatamente después del encabezado.
- Si las acciones son sticky, ubicarlas por encima de la bottom nav y reservar padding inferior equivalente. Si el shell no ofrece una altura reutilizable, mantenerlas en el flujo normal en lugar de hardcodear offsets frágiles.
- No agregar `Ajustes` como sexto ítem de la bottom nav; el acceso móvil debe vivir en la navegación completa.

## Sistema visual

- Dirección: `Editorial Fintech Ledger`.
- Fondo principal: marfil cálido.
- Sidebar: navy profundo.
- CTA principal: ámbar.
- Acentos analíticos y estados informativos: teal.
- Texto principal: navy/negro cálido de alto contraste.
- Fuente: IBM Plex Sans.
- Iconos SVG de línea, sin emojis.
- Evitar gradientes SaaS genéricos, estética crypto, glassmorphism y decoración competitiva.
- Reutilizar tokens, utilidades y componentes actuales antes de crear clases nuevas.

## Accesibilidad — WCAG 2.2 AA

- Un único `<h1>` y jerarquía de encabezados sin saltos.
- Enlace de salto y `<main id="main-content">` según el shell vigente.
- `<label>` real para cada control.
- Para números: `type="number"`, `min="1"`, `step="1"` e `inputmode="numeric"` cuando sea útil.
- Mensajes asociados mediante `aria-describedby`.
- `aria-invalid` solo cuando exista un error.
- Resumen de errores con `role="alert"` y foco en el primer control inválido.
- Confirmaciones y mensajes de éxito accesibles por teclado y lector de pantalla.
- Foco visible en todos los controles y acciones.
- Contraste mínimo AA y estados que no dependan solo del color.
- Targets táctiles mínimos de 44 × 44 px.
- Respetar `prefers-reduced-motion`.
- No robar foco en cada cambio de preview.

## Perfiles, navegación y protección

### Perfil operativo

- Puede ver y abrir `Ajustes` desde la navegación completa.
- La entrada debe ubicarse junto a otros módulos de configuración existentes, sin crear un grupo duplicado.
- Puede guardar y restaurar preferencias.

### Perfil administrativo

- Continúa viendo únicamente Bitácora.
- Acceso directo a `pages/ajustes.html` redirige a `bitacora.html`.
- `Ajustes` no aparece en sidebar, drawer ni bottom nav.

### Sin perfil

- Acceso directo redirige a `acceso.html`.

### Reglas del shell

- Mantener el link de marca hacia `../index.html`.
- No alterar la navegación core ni reordenar módulos no relacionados.
- No añadir un destino móvil redundante si la navegación completa ya lo resuelve.
- Verificar rutas relativas desde `pages/`.

## Bitácora

Registrar únicamente actividad del perfil operativo.

| Momento | Módulo | Acción | Detalle seguro |
|---|---|---|---|
| Entrada mediante shell | `Ajustes` | `Ingreso a pantalla` | Usar el patrón compartido y su deduplicación vigente. |
| Guardado válido | `Ajustes` | `Ajustes guardados` | `Se actualizaron los ajustes de facturación y preferencias.` |
| Restauración confirmada | `Ajustes` | `Ajustes restaurados` | `Se restauraron los valores predeterminados.` |

No registrar:

- valores del prefijo, número, días o moneda;
- cada pulsación o actualización de preview;
- validaciones fallidas;
- cancelación de la confirmación;
- fallos de almacenamiento;
- actividad administrativa;
- eventos consecutivos equivalentes duplicados.

## Arquitectura mínima

### Modelo puro

Crear `assets/js/settings-model.js` como IIFE/UMD compatible con navegador y CommonJS, siguiendo los modelos actuales.

API mínima sugerida:

```js
{
  SETTINGS_DEFAULTS,
  SETTINGS_CURRENCY_OPTIONS,
  getDefaultSettings,
  normalizeSettings,
  validateSettings,
  formatInvoiceNumber,
  buildSettingsPreview,
  parseStoredSettings
}
```

No crear clases, repositorios, factories, servicios, buses de eventos ni una capa de estado global.

### Controlador de página

`assets/js/ajustes.js` debe limitarse a:

- resolver elementos DOM;
- cargar y persistir el objeto;
- renderizar formulario, preview y mensajes;
- ejecutar validación del modelo;
- restaurar defaults con confirmación;
- registrar actividad exitosa;
- limpiar listeners y estados solo si el patrón actual lo exige.

La lógica de normalización, validación y formato no debe quedar duplicada en el controlador.

## Archivos previstos

### Crear

- `pages/ajustes.html`
- `assets/js/settings-model.js`
- `assets/js/ajustes.js`
- `tests/settings-model.test.cjs`

### Modificar solo si es necesario

- `assets/js/app-shell.js` — destino, visibilidad y protección por perfil.
- `assets/js/activity-log.js` — solo si el contrato actual no admite el nuevo módulo sin cambios.
- `assets/css/app.css` — estilos fuente mínimos del módulo.
- `assets/css/styles.css` — salida generada mediante `npm run build:css`; no editar manualmente.
- `tests/app-shell-access.test.cjs` — navegación y redirecciones.
- `tests/activity-log.test.cjs` — únicamente si cambia el contrato compartido.
- `package.json` — incluir los nuevos JS en `validate` si el script usa una lista explícita.
- `README.md` — solo si el README vigente enumera módulos disponibles o comandos que realmente cambian.

### No modificar

- `assets/data/mock-data.json` y `assets/data/mock-data.js` para persistir ajustes.
- Lógica de totales o estados de Facturas, Propuestas, Reportes o Movimientos.
- Archivos de otras ramas o worktrees.
- HTML/CSS exportado por Stitch.
- Carpetas de agentes, MCP, Playwright, screenshots, videos, logs o trazas.

## SDD y TDD mínimos

### Cambio SDD

- Nombre: `settings-module`.
- Artifact store preferido: Engram, salvo que el proyecto vigente haya establecido otro.
- Topic keys sugeridos:
  - `sdd/settings-module/proposal`
  - `sdd/settings-module/spec`
  - `sdd/settings-module/design`
  - `sdd/settings-module/tasks`
  - `sdd/settings-module/apply-progress`
  - `sdd/settings-module/verify-report`
- No crear `openspec/` ni archivos SDD nuevos en el repo si el artifact store activo es Engram.

El cambio debe especificar como mínimo:

- acceso solo operativo;
- persistencia y recuperación segura;
- reglas de validación;
- preview reactivo;
- restauración confirmada;
- eventos seguros de Bitácora;
- responsive y accesibilidad;
- no afectación de documentos existentes.

### Ciclo TDD

Escribir `tests/settings-model.test.cjs` antes del modelo y comprobar RED por ausencia de implementación.

Casos mínimos:

1. devuelve defaults sin compartir referencias mutables;
2. normaliza prefijo y moneda;
3. rechaza prefijo vacío;
4. rechaza número siguiente `0`, negativo, decimal o no numérico;
5. rechaza días `0`, negativos, decimales o no numéricos;
6. rechaza moneda fuera del catálogo;
7. formatea `FAC-` + `25` como `FAC-0025`;
8. produce el resumen de vencimiento y moneda;
9. no muta la entrada;
10. recupera defaults ante JSON corrupto o forma inválida;
11. conserva un objeto válido al serializar y volver a leer.

Después:

- **GREEN:** implementar el mínimo necesario para pasar.
- **REFACTOR:** eliminar únicamente duplicación real.
- No crear tests DOM extensos si los flujos de navegador cubren la interfaz con mayor fidelidad.

## Skills y MCPs por paso

| Paso | Skills obligatorias | MCPs/herramientas | Resultado esperado |
|---|---|---|---|
| Preflight | `architecture`, `ponytail`, `work-unit-commits` | Engram, Shell/Git | Baseline correcto y worktree aislado, sin tocar cambios ajenos. |
| Especificación | `sdd-init`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks` | Engram | Alcance, escenarios, diseño y tareas recuperables. |
| Modelo | `test-driven-development`, `ponytail` | Shell/Node | RED → GREEN del contrato puro. |
| Shell y roles | `architecture`, `accessibility`, `frontend-design` | Shell, navegador local | Navegación y redirecciones coherentes. |
| Interfaz | `frontend-design`, `accessibility`, `ui-ux-pro-max` solo si aporta una decisión concreta | Stitch solo lectura, Browser MCP | Página fiel al sistema visual y responsive. |
| Controlador | `sdd-apply`, `test-driven-development`, `debugging-strategies`, `ponytail` | Shell, DevTools | Persistencia, estados y Bitácora sin duplicación. |
| Checks | `lint-and-validate`, `verification-loop` | Shell | Build, sintaxis, tests y diff limpios. |
| Flujos reales | `playwright`, `accessibility`, `web-design-guidelines` | Playwright o Browser MCP | Evidencia de uso real en todos los breakpoints. |
| Cierre | `sdd-verify`, `ponytail-review`, `work-unit-commits`, `branch-pr` solo tras autorización | Engram, Git/GitHub | Diff revisado y rama lista, sin publicar aún. |

### Regla de subagentes

- El agente principal realiza la implementación rutinaria.
- No crear subagentes para lectura, CSS, tests o validación normal.
- Si una revisión fresca realmente reduce un riesgo relevante, usar como máximo **un** subagente `Terra Medium`, esperar su resultado y cerrarlo.
- No usar Luna.
- Terra High queda reservado para una dificultad excepcional; Sol High solo para arquitectura o seguridad crítica.
- No superar un subagente en este cambio sin autorización explícita del usuario.

## Plan de implementación por pasos

### Paso 0 — Preflight seguro

**Objetivo:** no trabajar sobre un baseline incorrecto ni contaminar el worktree actual.

**Acciones:**

1. Leer `AGENTS.md` completo.
2. Leer este handoff completo.
3. Ejecutar `git status --short --branch`, `git worktree list` y `git remote -v`.
4. Ejecutar `git fetch origin --prune`.
5. Verificar el último commit de `origin/main` y si los módulos previos requeridos ya fueron fusionados.
6. No asumir que un PR está fusionado solo porque fue abierto.
7. Crear, cuando el baseline sea correcto:

```powershell
git worktree add -b feat/settings-module C:\Users\USER\Documents\Proyecto-FreelanceFlow-settings origin/main
```

8. Copiar este handoff al nuevo worktree si todavía no forma parte de `origin/main`.
9. Confirmar que el nuevo worktree esté limpio antes de editar.

**Gate:** rama `feat/settings-module`, worktree aislado y baseline confirmado.

### Paso 1 — Recuperar contexto y fijar el cambio SDD

**Objetivo:** evitar contradicciones con módulos ya entregados.

**Acciones:**

1. Consultar Engram por Acceso, perfiles, Bitácora, Categorías, Servicios, Propuestas y Configuración fiscal.
2. Revisar memorias marcadas `needs_review` contra el código vigente antes de confiar en ellas.
3. Verificar `sdd-init/FreelanceFlow` o ejecutar el init requerido por las reglas actuales.
4. Crear proposal, spec, design y tasks para `settings-module` en el artifact store activo.
5. Mantener fuera de alcance cualquier cambio a documentos existentes.

**Gate:** requisitos y escenarios recuperables, sin alcance inventado.

### Paso 2 — TDD del modelo

**Objetivo:** fijar las reglas sin depender del DOM.

**Acciones:**

1. Crear primero `tests/settings-model.test.cjs`.
2. Ejecutar solo esa prueba y observar RED.
3. Crear `assets/js/settings-model.js` con la API mínima.
4. Ejecutar GREEN.
5. Refactorizar solo duplicación comprobada.

**Gate:** contrato puro aprobado, sin clases ni dependencias.

### Paso 3 — Integrar navegación y protección

**Objetivo:** respetar los perfiles existentes.

**Acciones:**

1. Añadir `Ajustes` a la navegación operativa completa.
2. No añadirlo a la navegación administrativa ni a la bottom nav.
3. Añadir la protección de ruta para operativo, administrativo y sin perfil.
4. Mantener el link de marca a `../index.html`.
5. Extender pruebas de app shell antes de continuar con la página.

**Gate:** operativo accede; admin vuelve a Bitácora; sin perfil vuelve a Acceso.

### Paso 4 — Construir la página semántica

**Objetivo:** montar primero una estructura accesible y fiel al shell.

**Acciones:**

1. Crear `pages/ajustes.html` usando el mismo orden de assets y scripts del `main`.
2. Añadir encabezado, formulario, secciones, resumen, estado y acciones.
3. Reutilizar el logo actual; no crear assets nuevos.
4. Incluir labels, hints, errores, `aria-live` y skip link.
5. No copiar el shell dibujado por Stitch.

**Gate:** la página carga sin JS error y conserva una lectura lógica sin CSS.

### Paso 5 — Implementar controlador y persistencia

**Objetivo:** completar el flujo de edición sin mezclar reglas con renderizado.

**Acciones:**

1. Cargar storage mediante `parseStoredSettings`.
2. Renderizar defaults o valores persistidos.
3. Actualizar preview en eventos `input`/`change`.
4. Validar al guardar; enfocar el primer error.
5. Persistir solo después de una validación exitosa.
6. Implementar restauración con confirmación nativa o patrón existente.
7. Manejar fallos de `localStorage` sin falso éxito.
8. Registrar solo los eventos exitosos definidos.

**Gate:** guardar, recargar, cancelar restauración, confirmar restauración y storage corrupto funcionan.

### Paso 6 — Aplicar el diseño responsive

**Objetivo:** reproducir la intención de Stitch dentro del sistema real.

**Acciones:**

1. Reutilizar tokens y clases existentes.
2. Añadir solo los estilos que no resuelva el sistema vigente.
3. Implementar PC en dos columnas.
4. Colapsar tablet y móvil a una columna.
5. Revisar 320 px antes de considerar el responsive terminado.
6. Compilar CSS; no editar el archivo generado a mano.

**Gate:** sin overflow, controles legibles, acciones accesibles y shell intacto.

### Paso 7 — Ejecutar validaciones técnicas

```powershell
npm run build:css
npm run validate
python -m json.tool assets/data/mock-data.json
npm test
git diff --check
```

Además:

- confirmar que los nuevos JS estén incluidos en `validate`;
- revisar que `styles.css` solo cambie por el build;
- comprobar que no aparezca mojibake;
- revisar `git status --short` y `git diff --stat`;
- confirmar que no existan archivos temporales.

**Gate:** todos los comandos con salida exitosa y sin cambios inesperados.

### Paso 8 — Validar como usuario real

Levantar el servidor local según el comando vigente, por ejemplo:

```powershell
python -m http.server 4177
```

Usar Playwright o Browser MCP para recorrer la interfaz como una persona que no conoce el producto. No reemplazar estos recorridos por inspección de funciones.

**Gate:** todos los escenarios de la matriz siguiente pasan en navegador real.

### Paso 9 — Revisión y preparación para publicación

**Acciones:**

1. Revisar únicamente el diff de la rama.
2. Ejecutar un `ponytail-review`: eliminar abstracciones y estilos innecesarios.
3. Confirmar que no se tocaron módulos financieros fuera del alcance.
4. Eliminar screenshots, trazas, logs, videos, PID y carpetas MCP.
5. Enumerar exactamente los archivos que entrarían al commit.
6. Reportar resultados, riesgos y estado de Git.
7. Esperar autorización explícita antes de commit, push o PR.

**Gate:** diff enfocado, reproducible y listo para revisión humana.

## Matriz de validación real

### Acceso y navegación

- [ ] Landing → Acceso → perfil operativo → Dashboard → Ajustes mediante navegación visible.
- [ ] URL directa sin perfil → `acceso.html`.
- [ ] URL directa con perfil administrativo → `bitacora.html`.
- [ ] Admin ve únicamente Bitácora.
- [ ] Ajustes no aparece en la bottom nav operativa.
- [ ] Link de marca vuelve a `../index.html` sin `Cannot GET`.

### Primera visita

- [ ] Se muestran defaults coherentes con el `main` actualizado.
- [ ] Preview inicial muestra próxima factura, vencimiento y moneda correctos.
- [ ] No se escribe storage solo por visitar la página.
- [ ] No hay texto de demo, prototipo o simulación.

### Edición y validación

- [ ] Cambiar prefijo actualiza la preview.
- [ ] Cambiar número actualiza padding y preview.
- [ ] Cambiar días actualiza el comportamiento de vencimiento.
- [ ] Cambiar moneda actualiza el resumen.
- [ ] Prefijo vacío muestra error asociado.
- [ ] Número `0`, negativo, decimal y texto no se guardan.
- [ ] Días `0`, negativos, decimales y texto no se guardan.
- [ ] Moneda inválida no se guarda.
- [ ] Submit inválido enfoca el primer control con error.
- [ ] La preview afectada muestra `—`, no un valor inventado.

### Guardado y persistencia

- [ ] Guardado válido muestra éxito.
- [ ] Recargar conserva exactamente la configuración válida.
- [ ] Una segunda visita carga el objeto persistido.
- [ ] JSON corrupto cae a defaults sin excepción ni pantalla rota.
- [ ] Fallo simulado de `setItem` no muestra éxito ni registra Bitácora.

### Restauración

- [ ] Cancelar la confirmación conserva formulario y storage.
- [ ] Confirmar restaura los defaults vigentes.
- [ ] Recargar después de restaurar conserva defaults.
- [ ] No se producen dobles mensajes ni dobles eventos.

### Bitácora

- [ ] Guardado exitoso produce exactamente un evento seguro.
- [ ] Restauración exitosa produce exactamente un evento seguro.
- [ ] Los eventos no contienen prefijo, número, días ni moneda.
- [ ] Validaciones y fallos no generan eventos exitosos.
- [ ] No aparece actividad administrativa.

### Responsive y accesibilidad

- [ ] PC 1440 px y 1280 px: dos columnas, jerarquía clara y sin solapamientos.
- [ ] Tablet 1024 px y 768 px: una columna, sin espacios residuales ni overflow.
- [ ] Móvil 390 px y 320 px: una columna, botones completos y sin scroll horizontal.
- [ ] Recorrido completo con teclado, orden lógico y foco visible.
- [ ] Targets táctiles de al menos 44 × 44 px.
- [ ] Errores y éxito anunciados por tecnología asistiva.
- [ ] Contraste AA y estados comprensibles sin depender del color.

### Regresión

- [ ] Dashboard, Facturas, Configuración fiscal y Bitácora siguen cargando.
- [ ] La navegación operativa no pierde destinos existentes.
- [ ] La navegación administrativa continúa aislada.
- [ ] Consola con 0 errores y 0 warnings atribuibles al cambio.
- [ ] Requests locales con 0 respuestas 404.
- [ ] Todos los enlaces internos usados en el flujo responden correctamente.

## Criterio final de aceptación

La rama está lista para solicitar autorización de commit y push únicamente si:

- el alcance coincide con este documento;
- las pruebas del modelo demuestran RED → GREEN;
- todos los checks técnicos pasan;
- todos los flujos reales pasan en navegador;
- no existen errores de consola, 404 ni overflow;
- roles y Bitácora mantienen sus contratos;
- no se modificaron documentos financieros existentes;
- el diff contiene solo archivos necesarios;
- no quedaron artefactos temporales;
- el agente informa los archivos, decisiones, pruebas, flujos, riesgos y estado exacto de Git.

## Formato del informe final del implementador

1. Rama y worktree utilizados.
2. Baseline exacto de `origin/main`.
3. Archivos creados y modificados.
4. Decisiones y correcciones respecto de Stitch.
5. Evidencia RED → GREEN.
6. Resultado exacto de build, validate, JSON, tests y diff check.
7. Flujos de usuario recorridos y breakpoints verificados.
8. Estado de consola y requests.
9. Eventos confirmados en Bitácora.
10. Artefactos temporales eliminados.
11. Estado de Git y lista exacta de archivos candidatos a commit.
12. Riesgos pendientes o confirmación de que no existen bloqueadores.
13. Declaración de si la rama está lista para solicitar autorización de publicación.
