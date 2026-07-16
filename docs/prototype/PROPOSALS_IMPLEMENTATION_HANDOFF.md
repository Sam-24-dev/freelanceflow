# Propuestas — handoff final de diseño a implementación

Este documento convierte la tercera iteración aprobada de Stitch en un contrato de implementación para FreelanceFlow. La meta es incorporar **Propuestas comerciales** como módulo operativo completo, coherente con Clientes, Servicios, Proyectos, Bitácora y el shell actual, sin copiar el HTML generado por Stitch ni introducir backend o dependencias innecesarias.

## Decisión ejecutiva

- Implementar el módulo en una rama nueva `feat/proposals-module` creada desde el `main` remoto más reciente.
- Trabajar en un worktree aislado, recomendado: `Proyecto-FreelanceFlow-proposals`.
- No implementar dentro del worktree actual `refactor/product-ui-redesign`: contiene cambios locales no relacionados y parte de un baseline anterior.
- Reutilizar el shell, los modelos puros, la persistencia local, la Bitácora y los patrones de Categorías/Servicios ya presentes en `main`.
- Usar Stitch como referencia de jerarquía, distribución y comportamiento responsive; **no** copiar su HTML/CSS ni reemplazar el sistema visual vigente.
- Mantener la solución frontend-only: HTML, CSS/Tailwind compilado, JavaScript vanilla, `mock-data.json`, `localStorage` y `sessionStorage`.
- Ejecutar TDD para reglas de negocio y validar el resultado final en un navegador real mediante flujos de usuario completos.
- Dejar la rama validada y lista para commit/push. No crear commit, push o PR sin autorización explícita del usuario.

### Ruta rápida

1. Confirmar que `origin/main` contiene Acceso/Bitácora, Categorías y Servicios.
2. Crear worktree y rama `feat/proposals-module` desde `origin/main`.
3. Recuperar contexto SDD desde Engram y registrar el cambio `proposals-module`.
4. Escribir primero las pruebas del modelo de propuestas y observar RED.
5. Implementar modelo, datos, shell, UI, persistencia, estados y conversión a proyecto.
6. Ejecutar validaciones técnicas.
7. Recorrer los flujos reales en PC, tablet y móvil con navegador automatizado.
8. Revisar el diff, eliminar artefactos y reportar la rama lista para publicación.

## Jerarquía de fuentes de verdad

Cuando exista una diferencia entre documentos o imágenes, aplicar este orden:

1. Código y patrones vigentes en el `main` más reciente.
2. `docs/specs/FreelanceFlow_Catalogo_Formularios_v1.md`.
3. `docs/specs/FreelanceFlow_Catalogo_Elementos_Visuales_v1.md`.
4. Este handoff.
5. Capturas finales de Stitch.

Stitch define la intención visual. No tiene autoridad para cambiar roles, nombres de campos, navegación, estados, persistencia o reglas financieras ya aceptadas.

## Fuentes visuales finales

| Dispositivo | Screen ID | Uso durante implementación |
|---|---|---|
| PC | `3593051daee04d2a8e61b5e833d32e29` | Jerarquía master-detail, lista compacta, detalle financiero y acciones contextuales. |
| Tablet | `4a97332f7d444e7696a8f1129b5a5bdc` | Estructura del editor, distribución de campos, ítems, resumen y acciones. |
| Móvil | `d2ecb03e7574488fb5c3d142b6caa08d` | Cards, filtros compactos, lectura rápida de total/validez y una sola acción primaria. |

### Cómo consultar Stitch

Usar Stitch MCP, no capturas manuales como única fuente:

```text
mcp__stitch__get_screen(
  projectId: "5303215837171127369",
  screenId: "<screen-id>",
  name: "projects/5303215837171127369/screens/<screen-id>"
)
```

No usar `edit_screens`, `generate_variants` ni modificar el proyecto de Stitch durante la implementación. La iteración visual está cerrada.

### Correcciones obligatorias al trasladar Stitch

- Mantener el sidebar actual generado por `assets/js/app-shell.js`; no copiar la navegación superior de las capturas finales.
- Mantener el workspace cálido, cards claras, sidebar navy, CTA amber y acentos teal de los módulos actuales; evitar un canvas completamente marrón/negro.
- No sumar monedas distintas. Cada propuesta tiene una sola moneda y los totales siempre muestran su código.
- El diseño tablet debe responder realmente entre `768px` y `1023px`; Stitch reporta esa captura como `DESKTOP` de `2560px`, por lo que sus dimensiones no son una especificación técnica.
- En móvil debe existir una sola acción “Nueva propuesta”; no duplicar FAB, botón central o CTA de cabecera.
- No mostrar `Facturar` desde Propuestas. El flujo correcto es `ACCEPTED → CONVERTED` mediante creación de Proyecto.
- No usar `Reenviar` ni textos que prometan envío real de correo.
- No introducir datos históricos de 2023; los mocks deben ser coherentes con el período actual del producto.

## Alcance aprobado

### Listado y detalle

- Navegación operativa hacia `pages/propuestas.html`.
- Búsqueda sin sensibilidad a mayúsculas ni acentos por ID, cliente o título.
- Filtro por estado.
- Listado desktop/tablet y cards móviles.
- Selección de propuesta y detalle contextual.
- Datos visibles: cliente, título, emisión, validez, moneda, ítems, subtotal, descuento, total, estado e historial.
- Empty state: `Aún no has creado propuestas.`
- No-results state con acción para limpiar filtros.

### Creación y edición

- Crear una propuesta como borrador.
- Editar únicamente propuestas `DRAFT`.
- Seleccionar un cliente activo.
- Agregar uno o más ítems manuales o desde Servicios.
- Copiar descripción, unidad y tarifa al seleccionar un servicio, manteniendo el ítem como snapshot editable.
- Calcular subtotales y total; nunca permitir editar el total directamente.
- Guardar borrador.
- Marcar borrador como enviado mediante transición local `DRAFT → SENT`.
- Cancelar sin guardar con confirmación solo si existen cambios sin persistir.

### Estados y acciones

- Marcar una propuesta enviada como aceptada o rechazada.
- Derivar `EXPIRED` cuando una propuesta `SENT` supera su fecha de validez.
- Convertir una propuesta aceptada en proyecto mediante el formulario existente de Proyectos.
- Bloquear transiciones inválidas y acciones repetidas.
- Mostrar acciones según el estado real, no según estilos visuales.

### Integraciones

- Clientes: solo clientes activos para nuevas propuestas; conservar clientes inactivos en propuestas existentes.
- Servicios: reutilizar catálogo y moneda; no enlazar el ítem en vivo después de guardarlo.
- Proyectos: prellenar creación desde una propuesta aceptada y registrar `propuesta_origen`.
- Bitácora: registrar actividad operativa significativa sin duplicados ni datos sensibles.

## Fuera de alcance

- Backend, base de datos, API, autenticación real o sincronización entre dispositivos.
- Envío real de correos, reenvíos, notificaciones externas o tracking de aperturas.
- Firma electrónica, pagos, links públicos, aceptación remota o portal del cliente.
- Generación con IA, plantillas avanzadas, versionado o duplicación masiva.
- Facturación directa desde una propuesta.
- Conversión de divisas o tasas de cambio.
- Impuestos específicos por país.
- PDF de propuesta en este bloque, salvo que exista una decisión posterior explícita.
- Categorías, Servicios o Proyectos nuevos fuera de los ajustes mínimos de integración.
- Dependencias nuevas: el stack actual es suficiente.

## Contrato de dominio

### Entidad `proposal`

```js
{
  id: "prop_001",
  cliente_id: "cli_001",
  titulo_propuesta: "Rediseño web corporativo",
  fecha_emision: "2026-07-16",
  fecha_validez: "2026-08-15",
  moneda: "USD",
  notas_condiciones: "Alcance y condiciones comerciales.",
  items: [
    {
      id: "prop_item_001",
      servicio_referencia_id: "srv_001",
      descripcion_item: "Consultoría UX/UI",
      unidad_medida: "Hora",
      cantidad: 20,
      precio_unitario: 75,
      subtotal_item: 1500
    }
  ],
  subtotal_general: 1500,
  descuento: 100,
  total_propuesta: 1400,
  estado: "DRAFT",
  historial_estado: [
    {
      estado: "DRAFT",
      fecha: "2026-07-16T15:00:00.000Z",
      detalle: "Propuesta creada como borrador."
    }
  ],
  proyecto_convertido_id: "",
  fecha_creacion: "2026-07-16T15:00:00.000Z",
  fecha_actualizacion: "2026-07-16T15:00:00.000Z"
}
```

### Estados canónicos

| Estado interno | Copy visible | Tipo |
|---|---|---|
| `DRAFT` | Borrador | editable |
| `SENT` | Enviada | en decisión |
| `ACCEPTED` | Aceptada | lista para convertir |
| `REJECTED` | Rechazada | terminal |
| `EXPIRED` | Expirada | terminal derivado |
| `CONVERTED` | Convertida | terminal |

### Máquina de estados

| Desde | Acción | Hacia | Condición |
|---|---|---|---|
| `DRAFT` | Marcar como enviada | `SENT` | Propuesta válida y total mayor a 0. |
| `SENT` | Marcar como aceptada | `ACCEPTED` | No expirada. |
| `SENT` | Marcar como rechazada | `REJECTED` | No expirada. |
| `SENT` | Evaluar validez | `EXPIRED` efectivo | Fecha actual posterior a `fecha_validez`. |
| `ACCEPTED` | Completar creación de proyecto | `CONVERTED` | Proyecto guardado con `propuesta_origen`. |

Reglas:

- No existen transiciones inversas en este alcance.
- `DRAFT` es el único estado editable.
- `EXPIRED` puede ser un estado efectivo derivado para no mutar almacenamiento al visitar la página.
- Una propuesta `ACCEPTED` no cambia a `CONVERTED` hasta que el proyecto se guarda correctamente.
- Una propuesta convertida no puede convertirse por segunda vez.
- La UI no debe ofrecer acciones prohibidas; el modelo también debe rechazarlas.

### Cálculos

```text
subtotal_item = cantidad × precio_unitario
subtotal_general = suma(subtotal_item)
total_propuesta = subtotal_general - descuento
```

Reglas:

- `cantidad > 0`.
- `precio_unitario >= 0`.
- `descuento >= 0`.
- `descuento < subtotal_general`.
- `total_propuesta > 0`.
- Redondear valores monetarios a dos decimales en el modelo, no solo al renderizar.
- No usar aritmética con strings formateados.
- No mezclar monedas dentro de una propuesta.

### Moneda y Servicios

- Valores admitidos: los mismos de `service-model.js` (`USD`, `EUR`, `MXN`).
- Valor inicial: `USD`.
- Una propuesta completa usa una sola moneda.
- El selector de servicios muestra únicamente servicios con la moneda elegida.
- Cambiar moneda queda bloqueado mientras existan ítems; primero deben eliminarse.
- No hay conversión automática de tarifas.
- Los mocks iniciales pueden usar únicamente USD para mantener la experiencia final coherente.

### Fechas

- Usar `<input type="date">`.
- Validar fechas de calendario reales, no solo expresiones regulares.
- `fecha_validez` debe ser posterior a `fecha_emision`.
- Comparar fechas como fechas locales de calendario para evitar desfases UTC.
- Una propuesta `SENT` se considera expirada cuando la fecha local actual es posterior a `fecha_validez`.

### Reglas de cliente e ítems

- Cliente obligatorio.
- Solo clientes `activo` pueden elegirse al crear.
- Debe existir al menos un ítem.
- `servicio_referencia_id` es opcional.
- `descripcion_item` es obligatoria.
- Al seleccionar un servicio se copia su información; cambios futuros del catálogo no alteran propuestas guardadas.
- Los IDs y textos se escapan antes de insertarse en HTML o atributos `data-*`.

## Persistencia frontend

### Datos base

Agregar `propuestas` a `assets/data/mock-data.json`.

El baseline debe incluir como mínimo seis propuestas coherentes que cubran:

- `DRAFT`.
- `SENT` vigente.
- `ACCEPTED`.
- `REJECTED`.
- `SENT` ya expirada para probar estado efectivo.
- `CONVERTED` vinculada a un proyecto existente.

Mantener integridad referencial:

- `cliente_id` existe en `clientes`.
- `servicio_referencia_id`, cuando existe, pertenece a `servicios`.
- `proyecto_convertido_id`, cuando existe, pertenece a `proyectos`.
- El proyecto existente `proy_001` ya usa `propuesta_origen: "prop_001"`; crear `prop_001` de forma compatible y marcarla `CONVERTED`.
- Totales almacenados coinciden con ítems y descuento.

### Overlay local

- Clave: `freelanceflow_proposals_v1`.
- Formato: array de propuestas normalizadas.
- Fusionar baseline + overlay por `id`, igual que otros módulos.
- Si el JSON local es inválido, usar baseline y no romper la pantalla.
- Las operaciones deben ser inmutables en el modelo.
- No crear repositorios, clases, servicios o event buses para una sola implementación.

### Conversión a proyecto

Flujo recomendado para evitar duplicar el formulario de Proyectos:

1. Desde una propuesta `ACCEPTED`, guardar un draft de conversión en `sessionStorage`.
2. Navegar a `proyectos.html?proposal=<id>`.
3. Proyectos abre el formulario existente y prellena:
   - cliente;
   - propuesta de origen;
   - nombre/título;
   - descripción/notas;
   - monto fijo sugerido cuando la modalidad elegida sea tarifa fija.
4. El usuario completa los campos obligatorios de Proyecto.
5. Al guardar el proyecto:
   - persistir el proyecto con `propuesta_origen`;
   - actualizar la propuesta a `CONVERTED`;
   - guardar `proyecto_convertido_id`;
   - añadir evento al historial;
   - registrar la actividad en Bitácora.
6. Si el usuario cancela el formulario de Proyecto, la propuesta permanece `ACCEPTED`.

No crear silenciosamente un proyecto con fechas, modalidad o tarifas inventadas.

## Copy final

### Página

- Título: `Propuestas comerciales`.
- Descripción: `Organiza tus ofertas comerciales antes de convertir el trabajo aceptado en un proyecto.`
- CTA: `Nueva propuesta`.
- Búsqueda: `Buscar por cliente, título o ID`.
- Filtro: `Todos los estados`.

### Formulario

- Título creación: `Nueva propuesta`.
- Título edición: `Editar propuesta`.
- Secciones: `Información comercial`, `Servicios incluidos`, `Resumen de propuesta`.
- Acciones: `Añadir servicio`, `Guardar borrador`, `Marcar como enviada`, `Cancelar`.
- No usar `Enviar correo`, `Reenviar`, `Facturar`, `Añadir grupo` ni `Generar con IA`.

### Confirmaciones

- `Propuesta guardada como borrador.`
- `Propuesta actualizada.`
- `Propuesta marcada como enviada.`
- `Propuesta marcada como aceptada.`
- `Propuesta marcada como rechazada.`
- `Proyecto creado desde la propuesta.`

### Errores

- `Selecciona un cliente activo.`
- `Ingresa un título para la propuesta.`
- `Debes agregar al menos un ítem a la propuesta.`
- `La fecha de validez debe ser posterior a la fecha de emisión.`
- `La cantidad debe ser mayor a 0.`
- `El precio unitario no puede ser negativo.`
- `El descuento debe ser menor que el subtotal.`
- `El total de la propuesta debe ser mayor a 0.`
- `Esta acción no está disponible para el estado actual.`

No usar copy visible como `demo`, `simulación`, `prototipo`, `mock`, `fase` o explicaciones internas de almacenamiento.

## Diseño por dispositivo

### PC — `1280px` o más

- Reutilizar sidebar y header del shell actual.
- Workspace cálido, no navegación superior de Stitch.
- Layout master-detail:
  - columna de listado de aproximadamente `340–400px`;
  - panel de detalle flexible;
  - separación clara sin sacrificar densidad.
- Cabecera del listado con título, contador y CTA.
- Búsqueda y filtro visibles.
- Filas seleccionables con estado, cliente, título y total.
- Panel de detalle con fechas, notas, tabla de ítems, descuento, total e historial.
- CTA contextual alineado con el estado.
- No usar texto financiero menor que el tamaño legible del resto de la aplicación.

### Tablet — `768px` a `1279px`

- Reutilizar shell responsive actual.
- No copiar el canvas de `2560px` generado por Stitch.
- Vista de listado en cards o tabla compacta de una columna.
- Detalle en drawer o panel de ancho completo.
- Crear/editar en workspace centrado con `max-width` razonable.
- Campos de cabecera en dos columnas cuando el ancho lo permita.
- Ítems apilados o tabla compacta sin scroll horizontal de página.
- Resumen financiero visible al final y acciones persistentes sin cubrir contenido.

### Móvil — `320px` a `767px`

- Reutilizar bottom navigation vigente; no agregar una segunda navegación.
- Propuestas no reemplaza ninguno de los cinco destinos actuales del bottom nav.
- Mostrar el módulo activo en cabecera y mantener acceso mediante el menú móvil del shell.
- Un solo CTA `Nueva propuesta`.
- Chips de estado con scroll horizontal interno o select compacto; nunca recortados.
- Cards con título, cliente, total, validez y estado.
- Detalle y formulario en vista completa o sheet accesible.
- Formulario en una columna.
- Resumen financiero antes de las acciones.
- Área de acciones sticky solo si no tapa campos ni bottom nav.
- Targets táctiles mínimos de `44×44px`.
- Probar explícitamente `320px`, `375px` y `390px`.

## Estados de UI obligatorios

- Carga inicial.
- Error al cargar `mock-data.json` con mensaje recuperable.
- Listado con datos.
- Búsqueda sin resultados.
- Empty state real.
- Detalle seleccionado.
- Formulario nuevo.
- Formulario edición de borrador.
- Errores inline.
- Confirmación de cambios sin guardar.
- Guardado exitoso.
- Estado expirado derivado.
- Conversión pendiente, cancelada y completada.
- Error de persistencia local sin pérdida silenciosa.

## Accesibilidad — WCAG 2.2 AA

- Mantener skip link y `<main id="main-content">` del shell.
- Cada campo usa `<label>` real.
- Asociar hints y errores mediante `aria-describedby`.
- Errores generales con `role="alert"`.
- Cambios de filtros y resultados con región `aria-live="polite"`.
- Tabla desktop con `<caption>`, `<thead>` y `<th scope="col">`.
- Filas seleccionables implementadas con controles semánticos, no `div` con click.
- Botones de eliminar ítem nombran el servicio afectado.
- Estados incluyen texto; no dependen solo del color.
- Drawer/dialog gestiona foco inicial, trap, Escape y restauración del foco.
- Foco visible en todos los controles.
- Contraste mínimo `4.5:1` para texto normal.
- Respetar `prefers-reduced-motion`.
- El orden DOM debe coincidir con el orden visual.
- Probar todo el flujo solo con teclado.

## Integración con FreelanceFlow

### Roles y navegación

- Agregar `['propuestas.html', 'Propuestas', 'proposals']` al grupo operativo.
- Añadir un icono outline `proposals` al mapa existente.
- No mostrar Propuestas al perfil administrativo.
- Acceso sin perfil: redirigir a `acceso.html`.
- Acceso administrativo directo: redirigir a `bitacora.html`.
- Mantener el bottom nav operativo actual sin añadir un sexto elemento.

### Bitácora

Agregar `propuestas.html: 'Propuestas'` al mapa de módulos.

Registrar solo acciones operativas útiles:

| Acción | Descripción recomendada |
|---|---|
| Ingreso a pantalla | Ya cubierto por ActivityLog compartido. |
| Búsqueda | Solo texto real y no cada tecla. |
| Crear borrador | ID y título, sin notas comerciales completas. |
| Editar borrador | ID y título. |
| Marcar enviada | ID y cliente. |
| Marcar aceptada/rechazada | ID y nuevo estado. |
| Convertir | ID de propuesta e ID de proyecto. |

No registrar:

- cada cambio de campo;
- totales repetidos al renderizar;
- actividad administrativa;
- notas o condiciones completas;
- eventos equivalentes consecutivos.

### Proyectos

- Reutilizar `project-model.js` y el formulario actual.
- Proyectos debe leer propuestas baseline + overlay local para que una propuesta creada por el usuario pueda convertirse.
- El selector `propuesta_origen` debe mostrar solo propuestas `ACCEPTED` no convertidas al crear, además de conservar la opción seleccionada al editar proyectos existentes.
- La creación desde query/session draft debe abrir el formulario automáticamente.
- No duplicar reglas de validación de Proyecto dentro de Propuestas.

## Archivos previstos

### Crear

- `pages/propuestas.html`.
- `assets/js/proposal-model.js`.
- `assets/js/propuestas.js`.
- `tests/proposal-model.test.cjs`.
- `tests/proposal-mock-data.test.cjs`.
- `docs/prototype/PROPOSALS_IMPLEMENTATION_HANDOFF.md`.

### Modificar

- `assets/data/mock-data.json` — agregar propuestas coherentes.
- `assets/js/app-shell.js` — navegación, icono y guard.
- `assets/js/activity-log.js` — nombre de módulo y eventos aprobados.
- `assets/js/proyectos.js` — leer overlay de propuestas y prefill de conversión.
- `pages/proyectos.html` — cargar `proposal-model.js` solo si la integración lo requiere.
- `assets/css/app.css` — estilos mínimos del módulo.
- `assets/css/styles.css` — salida compilada, nunca edición manual.
- `package.json` — incluir nuevos JS en `npm run validate`.
- `tests/app-shell-access.test.cjs` — navegación y roles.
- `tests/activity-log.test.cjs` — acciones operativas.
- Pruebas de Proyectos afectadas por conversión.
- `README.md` — módulo operativo y persistencia local.

No crear:

- dependencias nuevas;
- carpetas de agentes;
- screenshots o videos versionados;
- configuraciones Playwright/TestSprite si no existían;
- helpers genéricos “para después”;
- una segunda implementación de Clientes, Servicios o Proyectos.

## Estrategia SDD y TDD

### SDD — Engram

Usar Engram como artifact store para no llenar el repositorio con documentación temporal.

Topic keys recomendados:

```text
sdd/proposals-module/proposal
sdd/proposals-module/spec
sdd/proposals-module/design
sdd/proposals-module/tasks
sdd/proposals-module/apply-progress
sdd/proposals-module/verify-report
```

El handoff es el contrato de producto. Los artefactos SDD deben convertirlo en tareas verificables, no inventar alcance.

### TDD — RED → GREEN → REFACTOR

Orden obligatorio:

1. Crear `tests/proposal-model.test.cjs`.
2. Escribir una prueba de comportamiento.
3. Ejecutarla y confirmar que falla por funcionalidad ausente.
4. Implementar lo mínimo en `proposal-model.js`.
5. Confirmar GREEN.
6. Refactorizar solo con todas las pruebas verdes.
7. Repetir para el siguiente comportamiento.

Cobertura mínima del modelo:

- normalización segura;
- cálculo y redondeo de ítems/totales;
- validaciones de cliente, título, fechas, ítems y descuento;
- fechas reales y expiración local;
- búsqueda sin acentos;
- filtro por estado efectivo;
- transiciones permitidas y bloqueadas;
- edición solo en `DRAFT`;
- merge baseline/overlay;
- inmutabilidad;
- snapshot de Servicio;
- moneda única;
- prevención de conversión duplicada;
- payload de prefill de Proyecto.

Las pruebas unitarias protegen reglas. La aprobación final depende además de flujos reales en navegador.

## Plan de ejecución por pasos

### Paso 0 — Preflight seguro

**Objetivo:** empezar desde el baseline correcto sin mezclar cambios.

**Skills:** `architecture`, `ponytail`, `work-unit-commits`.

**MCP/herramientas:** Engram `mem_context`, `mem_search`, `mem_review`; Git/GitHub CLI.

**Acciones:**

1. Ejecutar `git fetch origin --prune`.
2. Confirmar que `origin/main` incluye el merge de Servicios.
3. Revisar `git worktree list` y no tocar worktrees sucios.
4. Crear rama/worktree desde `origin/main`.
5. Confirmar status limpio y remoto correcto.
6. Leer este handoff, specs de Propuestas y patrones existentes.

**Gate:** rama correcta, worktree limpio y ninguna mutación fuera del worktree.

### Paso 1 — Planificación SDD

**Objetivo:** transformar este contrato en especificación, diseño y tareas.

**Skills:** `sdd-init`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`, `architecture`.

**MCP:** Engram como store principal.

**Acciones:**

- Recuperar `sdd-init/freelanceflow`; ejecutarlo solo si no existe.
- Registrar propuesta, escenarios, diseño y tareas de `proposals-module`.
- Mantener alcance frontend-only y usar el patrón UMD/IIFE actual.
- Incluir forecast de archivos y riesgo de conversión Propuesta→Proyecto.
- No generar `openspec/` salvo solicitud explícita.

**Gate:** requisitos, estados, conversiones y responsive tienen escenarios verificables.

### Paso 2 — Modelo y TDD

**Objetivo:** cerrar reglas antes de tocar la UI.

**Skills:** `test-driven-development`, `ponytail`.

**Herramientas:** `node --test`, Engram para registrar decisiones no obvias.

**Acciones:**

- Ejecutar ciclos RED/GREEN/REFACTOR pequeños.
- Mantener el modelo puro, sin DOM ni `localStorage`.
- Exportar API CommonJS para tests y global para navegador, igual que otros modelos.
- No crear clases, factories o interfaces de una sola implementación.

**Gate:** pruebas del modelo verdes y cada comportamiento observado en RED previamente.

### Paso 3 — Datos e integridad

**Objetivo:** proveer baseline representativo y coherente.

**Skills:** `test-driven-development`, `lint-and-validate`.

**Herramientas:** Python `json.tool`, Node test runner.

**Acciones:**

- Añadir propuestas con todos los estados.
- Validar referencias a clientes, servicios y proyectos.
- Verificar totales y fechas mediante test, no inspección manual solamente.
- Mantener UTF-8 sin mojibake.

**Gate:** JSON válido y test de integridad verde.

### Paso 4 — Shell, roles y HTML semántico

**Objetivo:** integrar el módulo sin romper navegación.

**Skills:** `frontend-design`, `accessibility`, `test-driven-development`.

**MCP:** Stitch `get_screen` para referencia visual; no generación.

**Acciones:**

- Agregar navegación e icono.
- Actualizar guards y tests.
- Crear estructura semántica de listado, detalle, form, estados y live regions.
- Conservar el shell actual como fuente de verdad.

**Gate:** operativo accede; administrativo y perfil ausente son redirigidos correctamente.

### Paso 5 — Diseño responsive

**Objetivo:** reproducir la intención final dentro del sistema visual actual.

**Skills:** `frontend-design`, `accessibility`, `ui-ux-pro-max` solo para dudas puntuales; no crear un segundo design system.

**MCP:** Stitch `get_screen`; navegador para inspección incremental.

**Acciones:**

- Implementar PC master-detail.
- Implementar tablet real, no escalar desktop.
- Implementar cards y formularios móviles.
- Reusar tokens y clases existentes antes de añadir CSS.
- Compilar Tailwind después de cambios de clases.

**Gate:** sin overflow, sin CTA duplicado y con jerarquía coherente en 320/768/1280px.

### Paso 6 — Controlador, persistencia y estados

**Objetivo:** completar el flujo operativo.

**Skills:** `sdd-apply`, `test-driven-development`, `debugging-strategies`, `ponytail`.

**Herramientas:** browser DevTools, Node tests.

**Acciones:**

- Cargar baseline y overlay.
- Renderizar listado/detalle/formulario.
- Implementar búsqueda, filtros y estados.
- Implementar ítems y cálculos desde el modelo.
- Manejar dirty state y persistencia fallida.
- Implementar transiciones mediante el modelo, nunca solo con UI.

**Gate:** refresh conserva cambios; transiciones inválidas no modifican datos.

### Paso 7 — Conversión y Bitácora

**Objetivo:** cerrar integraciones sin duplicar módulos.

**Skills:** `architecture`, `test-driven-development`, `ponytail`.

**MCP:** Engram para registrar cualquier decisión de integración.

**Acciones:**

- Integrar prefill con Proyectos.
- Marcar `CONVERTED` solo tras guardar Proyecto.
- Evitar proyectos duplicados.
- Registrar eventos operativos aprobados.
- Verificar que admin solo ve la actividad, sin generar actividad propia.

**Gate:** propuesta y proyecto quedan vinculados y persisten tras recarga.

### Paso 8 — Verificación técnica

**Objetivo:** detectar regresiones antes del navegador final.

**Skills:** `lint-and-validate`, `sdd-verify`.

**Herramientas:** npm, Node, Python, Git.

Ejecutar:

```powershell
npm run build:css
npm run validate
npm test
python -m json.tool assets/data/mock-data.json > $null
git diff --check
```

Además:

- comprobar enlaces relativos;
- revisar strings prohibidos;
- revisar mojibake;
- verificar que no existen secretos ni artefactos locales;
- confirmar consola sin errores.

**Gate:** todos los comandos pasan sin fallos.

### Paso 9 — Validación en tiempo real como usuario final

**Objetivo:** probar el producto, no la estructura interna del código.

**Skills:** `playwright`, `accessibility`, `verification-loop`.

**MCP/herramientas:** Browser MCP con Playwright; si no está disponible, Playwright CLI en modo headed. No crear suites E2E permanentes salvo solicitud.

Proceso:

1. Iniciar servidor local en un puerto libre.
2. Abrir la landing como usuario nuevo.
3. Seleccionar perfil operativo.
4. Navegar con controles visibles, no URLs internas salvo pruebas de guard.
5. Completar cada flujo de la matriz siguiente.
6. Repetir con perfil administrativo.
7. Repetir responsive en viewports reales.
8. Revisar consola y requests 404.
9. Eliminar datos locales y artefactos temporales.

**Gate:** un usuario sin conocimiento interno puede completar los recorridos sin explicación externa.

### Paso 10 — Revisión y preparación para publicar

**Objetivo:** dejar un diff profesional y mínimo.

**Skills:** `ponytail-review`, `web-design-guidelines`, `work-unit-commits`, `branch-pr`, `github-pr`.

**Herramientas:** Git, GitHub CLI, Engram.

**Acciones:**

- Revisar el diff completo y eliminar abstracciones/estilos duplicados.
- Usar como máximo un fresh reviewer si el acoplamiento de conversión o el tamaño del diff lo justifica.
- Confirmar lista exacta de archivos antes de stage.
- No incluir `.agents`, screenshots, videos, logs, perfiles de navegador o temporales.
- Stage explícito por rutas; no usar `git add .` a ciegas.
- Mostrar `git diff --cached --stat` y checks al usuario.
- Esperar autorización para commit y push.
- Commit recomendado: `feat(proposals): add commercial proposal workflow`.
- Abrir PR solo si el usuario lo solicita.

**Gate:** worktree limpio después de publicar y hash remoto igual al local.

## Matriz de validación real

### Acceso y navegación

- [ ] Landing → Acceso → Operativo → Dashboard.
- [ ] Operativo abre Propuestas desde navegación.
- [ ] Admin no ve Propuestas.
- [ ] Admin abre `propuestas.html` directamente y vuelve a Bitácora.
- [ ] Sin perfil, URL directa redirige a Acceso.
- [ ] Marca del shell vuelve a `../index.html`.

### Listado, búsqueda y detalle

- [ ] Baseline renderiza sin errores.
- [ ] Buscar por ID devuelve la propuesta correcta.
- [ ] Buscar por cliente sin acentos funciona.
- [ ] Filtrar cada estado muestra solo resultados válidos.
- [ ] Limpiar filtros restaura el listado.
- [ ] Seleccionar una propuesta actualiza el detalle una vez.
- [ ] Empty/no-results no comparten el mismo mensaje.
- [ ] Totales y moneda coinciden entre card/fila y detalle.

### Crear borrador

- [ ] `Nueva propuesta` abre formulario vacío.
- [ ] Solo clientes activos son seleccionables.
- [ ] Seleccionar Servicio copia descripción, unidad, tarifa y moneda correctas.
- [ ] Añadir/eliminar ítems recalcula totales.
- [ ] Guardar borrador persiste tras recarga.
- [ ] Cancelar sin cambios cierra directamente.
- [ ] Cancelar con cambios solicita confirmación.

### Validaciones

- [ ] Cliente vacío muestra error junto al control.
- [ ] Título vacío muestra error.
- [ ] Sin ítems bloquea guardado/envío.
- [ ] Cantidad 0 o negativa se rechaza.
- [ ] Precio negativo se rechaza.
- [ ] Fecha inválida o invertida se rechaza.
- [ ] Descuento igual/mayor al subtotal se rechaza.
- [ ] Total 0 se rechaza.
- [ ] Servicio de otra moneda no puede mezclarse.
- [ ] Primer campo inválido recibe foco al enviar.

### Editar y enviar

- [ ] Borrador existente puede editarse.
- [ ] Guardar conserva ID e historial.
- [ ] Marcar enviada cambia `DRAFT → SENT`.
- [ ] SENT ya no muestra edición.
- [ ] Recargar conserva estado.
- [ ] No aparece copy de envío real de email.

### Aceptar, rechazar y expirar

- [ ] SENT vigente permite aceptar.
- [ ] SENT vigente permite rechazar.
- [ ] ACCEPTED solo ofrece convertir.
- [ ] REJECTED es read-only.
- [ ] SENT vencida se muestra EXPIRED.
- [ ] EXPIRED no permite aceptar/rechazar.
- [ ] La UI y el modelo bloquean acciones repetidas.

### Convertir a proyecto

- [ ] ACCEPTED abre formulario de Proyecto prellenado.
- [ ] Cancelar mantiene la propuesta ACCEPTED.
- [ ] Guardar proyecto crea un único registro.
- [ ] Proyecto conserva `propuesta_origen`.
- [ ] Propuesta queda CONVERTED y guarda el ID de proyecto.
- [ ] Recarga en ambos módulos conserva la relación.
- [ ] Repetir la URL/acción no crea duplicados.

### Bitácora

- [ ] Ingreso a Propuestas se registra una sola vez consecutiva.
- [ ] Crear/editar/enviar/aceptar/rechazar/convertir generan eventos útiles.
- [ ] No se registran teclas ni renders.
- [ ] No aparecen eventos administrativos.
- [ ] Detalles no exponen notas comerciales completas.

### Responsive y accesibilidad

- [ ] PC `1440×900` y `1280×800`: master-detail legible.
- [ ] Tablet `1024×768` y `768×1024`: layout real sin escala desktop.
- [ ] Móvil `390×844`, `375×812` y `320×568`: sin overflow.
- [ ] Solo existe un CTA de nueva propuesta.
- [ ] Bottom nav no tapa acciones.
- [ ] Todo se completa con teclado.
- [ ] Escape cierra drawer/dialog y restaura foco.
- [ ] Focus visible en todos los controles.
- [ ] Labels, errores, tabla y estados son comprensibles con lector de pantalla.
- [ ] Contraste AA y targets mínimos de 44px.

### Calidad de producto

- [ ] Copy final sin lenguaje interno.
- [ ] No hay importes inconsistentes ni mezcla de moneda.
- [ ] No hay fechas de ejemplo obsoletas.
- [ ] No hay consola roja, 404 o enlaces rotos.
- [ ] Landing y módulos existentes mantienen su comportamiento.
- [ ] No se añadieron dependencias o abstracciones innecesarias.

## Criterio de aprobación

El módulo está listo para solicitar commit/push únicamente cuando:

- todas las reglas de dominio tienen pruebas TDD verdes;
- todos los checks técnicos pasan;
- todos los recorridos críticos fueron ejecutados en navegador real;
- PC, tablet y móvil cumplen la matriz responsive;
- roles, Bitácora y conversión a Proyecto funcionan tras recarga;
- no existen regresiones en módulos actuales;
- el diff contiene solo archivos necesarios;
- no quedan temporales, screenshots, perfiles de navegador ni datos de prueba persistidos;
- un fresh review no encuentra defectos críticos;
- el usuario recibe la lista exacta de archivos y autoriza publicar.

Si cualquiera de estos puntos falla, corregir y repetir la validación afectada antes de declarar la rama lista.
