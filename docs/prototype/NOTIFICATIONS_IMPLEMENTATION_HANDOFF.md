# Handoff de implementación — Notificaciones

## Decisión y ruta rápida

Implementar `Notificaciones` como un módulo operativo, frontend-only y coherente con el shell vigente de FreelanceFlow. La pantalla debe derivar alertas desde los datos financieros existentes, permitir administrar su estado de lectura y guardar preferencias locales sin prometer correo real, tareas programadas, push, polling ni procesos en segundo plano.

Ruta recomendada:

1. Crear un worktree aislado desde el `origin/main` más reciente.
2. Confirmar el contrato real del shell, roles, Bitácora y datos mock.
3. Definir el modelo puro y escribir primero sus pruebas mínimas.
4. Implementar página, controlador e integración del shell.
5. Validar como usuario real en navegador y en todos los breakpoints.
6. Ejecutar controles estáticos, revisión pre-commit y revisar el alcance antes de solicitar autorización para publicar.

Este documento es la fuente de implementación. Stitch es una referencia visual parcial, no una especificación funcional ni código para copiar.

---

## 1. Referencias visuales finales

| Dispositivo | Referencia Stitch | Uso correcto |
|---|---|---|
| PC | [172a6ea4c7664c1e86f053dddf2d5624](https://stitch.withgoogle.com/preview/5303215837171127369?node-id=172a6ea4c7664c1e86f053dddf2d5624) | Solo contenido, estados y preferencias; no copiar su columna móvil centrada ni el canvas oscuro. |
| Tablet | [56e7e617e1894f1694ca1771142b0fc4](https://stitch.withgoogle.com/preview/5303215837171127369?node-id=56e7e617e1894f1694ca1771142b0fc4) | Referencia principal para jerarquía de resumen, bandeja y acciones. Corregir marca, shell, color y preferencias. |
| Móvil | [69847d5e7c064a64adfad2ba22dba5ec](https://stitch.withgoogle.com/preview/5303215837171127369?node-id=69847d5e7c064a64adfad2ba22dba5ec) | Referencia funcional para tarjetas, enlaces, lectura individual y canales. Corregir shell, orden, contraste y tamaños táctiles. |

### Precedencia de fuentes

Cuando exista una contradicción, aplicar este orden:

1. `AGENTS.md` y reglas globales vigentes.
2. Código y comportamiento del `origin/main` actualizado.
3. `docs/specs/FreelanceFlow_Catalogo_Elementos_Visuales_v1.md`, bloque P-37 / VIS-040.
4. `docs/specs/FreelanceFlow_Catalogo_Formularios_v1.md`, FRM-022.
5. Este handoff.
6. Stitch, únicamente como referencia de composición.

---

## 2. Correcciones obligatorias respecto de Stitch

Las pantallas finales todavía contienen inconsistencias. No deben trasladarse literalmente a código.

### PC

- No usar un contenido de 390 px centrado dentro de un lienzo de escritorio.
- No usar un canvas oscuro completo.
- No resumir por `Nuevas`, `Leídas` y `Alertas`; los tres indicadores correctos son los tipos financieros requeridos.
- Sustituir `Notificaciones Push` por `En la aplicación`.
- Eliminar `Resúmenes diarios`, `Alertas instantáneas` y cualquier promesa de entrega automática.
- El botón `Guardar preferencias` debe pertenecer al panel o flujo de preferencias, no ocupar todo el ancho inferior de la aplicación.

### Tablet

- Conservar la jerarquía de resumen + bandeja + preferencias, pero usar el shell real de FreelanceFlow.
- Reemplazar `LedgerSaaS` por la marca y navegación compartidas; no crear un segundo shell.
- No mantener un sidebar fijo si el shell vigente lo convierte en drawer en ese breakpoint.
- Incluir etiquetas accesibles y contenido visible para los canales y sus validaciones.
- No introducir acciones inexistentes ni enlaces `#` sin navegación real.

### Móvil

- Mantener las tarjetas y acciones relacionadas, pero mostrar primero el resumen y luego la bandeja.
- Integrar el header/drawer y bottom navigation existentes; no crear una cabecera paralela.
- No añadir un sexto elemento a la navegación inferior.
- Los enlaces `Ver factura`, `Ver propuesta`, `Ver movimiento` y `Marcar como leída` deben tener áreas táctiles de al menos 44 × 44 px.
- El botón de guardado no debe quedar fijo si puede cubrir contenido; un botón normal al final del formulario es suficiente.
- Evitar que el texto financiero, la fecha o las acciones se solapen a 320 px.

### Correcciones compartidas

- Workspace cálido y claro; sidebar navy; amber como acción principal; teal como acento analítico.
- No mostrar nombres crudos de iconos Material.
- No usar contenido de otra marca, datos genéricos ni fechas desconectadas del mock actual.
- No afirmar que se enviaron correos, push, resúmenes o recordatorios reales.
- Incluir los estados vacío, validación, éxito y error de carga aunque Stitch no los muestre todos.

---

## 3. Objetivo del módulo

El perfil operativo debe poder:

- revisar alertas derivadas de facturas vencidas, propuestas próximas a vencer y pagos registrados;
- distinguir notificaciones leídas y no leídas;
- marcar una notificación o todas como leídas;
- navegar al módulo relacionado;
- elegir qué tipos de alertas desea visualizar;
- guardar los canales preferidos `Email` y `En la aplicación`;
- conservar lectura y preferencias después de recargar.

El perfil administrativo continúa limitado exclusivamente a Bitácora.

---

## 4. Alcance y no alcance

### Incluido

- HTML, CSS/Tailwind y JavaScript vanilla.
- Datos derivados de `assets/data/mock-data.json`.
- Modelo puro y testeable para derivación, filtrado, lectura y preferencias.
- Persistencia browser-only mediante `localStorage` con recuperación segura.
- Integración con shell, roles y Bitácora existentes.
- Estados responsive, accesibles y completos.
- Navegación real a Facturas, Propuestas y Movimientos.

### Excluido

- Backend, API, base de datos o autenticación nueva.
- Envío de correos, push notifications, service workers o Web Push.
- Polling, timers recurrentes, cron jobs o background workers.
- Recordatorios automáticos, plantillas de correo o entregas programadas.
- Modificación de cálculos o estados de Facturas, Propuestas, Movimientos y Reportes.
- Deep linking nuevo dentro de esos módulos si el baseline no lo soporta.
- Dependencias nuevas, frameworks o abstracciones para una sola implementación.
- Inicializar TestSprite, guardar screenshots, trazas, videos o carpetas MCP.

---

## 5. Seguridad de rama y worktree

El worktree raíz contiene cambios documentales ajenos y no es el lugar de implementación.

Antes de programar:

```powershell
git -C C:\Users\USER\Documents\Proyecto-FreelanceFlow status --short
git -C C:\Users\USER\Documents\Proyecto-FreelanceFlow fetch origin main --prune
git -C C:\Users\USER\Documents\Proyecto-FreelanceFlow worktree list
```

Crear desde el `origin/main` más reciente:

- Rama: `feat/notifications-module`
- Worktree: `C:\Users\USER\Documents\Proyecto-FreelanceFlow-notifications`

Comando orientativo, solo después de verificar que rama y ruta no existen:

```powershell
git -C C:\Users\USER\Documents\Proyecto-FreelanceFlow worktree add `
  -b feat/notifications-module `
  C:\Users\USER\Documents\Proyecto-FreelanceFlow-notifications `
  origin/main
```

Copiar este handoff al nuevo worktree sin modificar ni limpiar los archivos ajenos del worktree raíz.

Baseline observado al redactar este documento: `origin/main` en `855006b`, con Ajustes, Configuración fiscal, Propuestas, Servicios, Categorías, roles y Bitácora. El agente debe volver a comprobarlo; el SHA no reemplaza `git fetch`.

---

## 6. Contrato funcional y modelo de datos

### 6.1 Tipos permitidos

Usar únicamente:

```text
invoice_overdue
proposal_expiring
payment_received
```

Cada notificación derivada debe exponer un objeto normalizado equivalente a:

```js
{
  id,
  type,
  message,
  eventDate,
  entityType,
  entityId,
  targetHref,
  read
}
```

No persistir copias completas de facturas, propuestas, pagos ni mensajes derivados.

### 6.2 Identificadores deterministas

Formato recomendado:

```text
invoice-overdue:<factura_id>
proposal-expiring:<propuesta_id>
payment-received:<pago_id>
```

Esto evita duplicados y permite conservar el estado leído después de regenerar la lista.

### 6.3 Reglas de derivación

#### Facturas vencidas

Generar una alerta cuando:

- `fecha_vencimiento` sea anterior a la fecha de referencia;
- `saldo_pendiente > 0`;
- el estado permita cobro: `SENT`, `PARTIAL` u `OVERDUE`;
- excluir `DRAFT`, `PAID` y `VOID`.

La acción relacionada navega a `facturas.html`. No modificar Facturas para enfocar una fila salvo que el baseline ya tenga un contrato de deep link verificado.

#### Propuestas por expirar

Generar una alerta cuando:

- `estado === 'SENT'`;
- `fecha_validez` sea hoy o una fecha futura;
- venza dentro de los próximos 30 días naturales.

Definir el horizonte como una constante del modelo, no como una preferencia nueva. Excluir propuestas vencidas, aceptadas, rechazadas, convertidas o en borrador.

La acción relacionada navega a `propuestas.html`.

#### Pagos recibidos

Generar una alerta por cada registro válido de `pagos_factura`.

- Relacionar el pago con su factura cuando exista.
- Formatear monto y moneda desde los datos reales.
- La acción navega a `transacciones.html`.

### 6.4 Fechas y moneda

- Inyectar `referenceDate` en las funciones puras para mantener pruebas deterministas.
- Parsear fechas `YYYY-MM-DD` sin desplazamientos de zona horaria.
- Reutilizar formateadores existentes cuando estén disponibles.
- Si no existen, usar `Intl.DateTimeFormat` e `Intl.NumberFormat` sin fijar reglas de un país específico.
- No asumir que toda entidad usa USD.

### 6.5 Orden y filtros

- Ordenar por `eventDate` descendente.
- Filtros visibles mínimos: `Todas` y `No leídas`.
- No agregar búsqueda, paginación, categorías extra ni filtros avanzados.
- El resumen se calcula desde alertas derivadas y habilitadas, no desde valores hardcodeados.

---

## 7. Preferencias y persistencia

### 7.1 Preferencias requeridas por FRM-022

Tipos de alerta:

- `notificar_facturas_vencidas`
- `notificar_propuestas_por_expirar`
- `notificar_pagos_recibidos`

Canales:

- `email`
- `in_app`

Valores iniciales recomendados: los tres tipos habilitados y `in_app` habilitado. `email` puede mostrarse habilitado según la composición final, pero nunca debe disparar solicitudes de red.

### 7.2 Validación

- Debe existir al menos un canal seleccionado.
- Los tres booleanos de tipos deben estar presentes; pueden quedar todos deshabilitados.
- Si ambos canales están apagados, no guardar y mostrar:

```text
Debes seleccionar al menos un canal de notificación.
```

- Después de guardar correctamente:

```text
Preferencias de notificación actualizadas.
```

### 7.3 Almacenamiento

Usar una sola clave versionada, por ejemplo:

```text
freelanceflow_notifications_v1
```

Contenido mínimo:

```js
{
  readIds: [],
  preferences: {
    notificar_facturas_vencidas: true,
    notificar_propuestas_por_expirar: true,
    notificar_pagos_recibidos: true,
    channels: ['in_app']
  }
}
```

Reglas:

- lectura segura con `try/catch`;
- JSON inválido vuelve a defaults sin romper la pantalla;
- escritura fallida conserva la UI estable y muestra un error claro;
- podar IDs que ya no pertenecen a notificaciones derivadas actuales;
- no almacenar información fiscal, datos completos de clientes ni mensajes de Bitácora;
- no crear múltiples claves si una sola cubre el caso.

---

## 8. Contrato de UI

### 8.1 Shell

- Reutilizar `[data-app-layout]`, `[data-app-sidebar-slot]` y `assets/js/app-shell.js`.
- No duplicar sidebar, header, marca, perfil ni bottom navigation dentro de `notificaciones.html`.
- Mantener el workspace cálido y claro usado por los módulos recientes.
- La nueva pantalla vive en `pages/notificaciones.html`.

### 8.2 Encabezado

```text
Eyebrow: CONTROL OPERATIVO
Título: Notificaciones
Descripción: Revisa alertas financieras y mantén al día tu operación.
Acción secundaria: Marcar todas como leídas
```

Deshabilitar `Marcar todas como leídas` cuando no existan elementos pendientes.

### 8.3 Resumen

Tres tarjetas, siempre con números derivados:

1. `Facturas vencidas`
2. `Propuestas por expirar`
3. `Pagos recibidos`

Usar icono + texto + número. No depender solo de rojo, amber o verde.

### 8.4 Bandeja

Cada fila o tarjeta debe incluir:

- icono decorativo por tipo;
- título breve;
- mensaje derivado;
- fecha legible;
- etiqueta textual `Nueva` cuando no esté leída;
- enlace real al módulo relacionado;
- acción `Marcar como leída` solo cuando corresponda.

No hacer que toda la tarjeta sea un botón si contiene acciones internas.

### 8.5 Preferencias

Separar visualmente:

1. `Alertas activas`: los tres toggles de tipo.
2. `Canales`: `Email` y `En la aplicación`.
3. Error inline y región de estado.
4. `Guardar preferencias`.

Usar `input type="checkbox"` con labels reales. Un switch visual puede envolver el checkbox, pero no reemplazar su semántica.

### 8.6 Estados

| Estado | Comportamiento/copy |
|---|---|
| Cargando | Indicador sobrio dentro del área de contenido, sin bloquear el shell. |
| Lista con datos | Render derivado, ordenado y filtrable. |
| Sin no leídas | `No tienes notificaciones nuevas.` |
| Filtro sin resultados | `No hay notificaciones con este filtro.` |
| Datos no disponibles | Mensaje claro y acción `Reintentar`; no dejar la pantalla vacía. |
| Validación | Error junto a canales y foco en el grupo inválido. |
| Guardado | Confirmación visible mediante `role="status"`. |
| Storage corrupto | Defaults seguros; sin error de consola ni bloqueo. |

---

## 9. Responsive

### PC — 1440 px

- Shell completo vigente.
- Resumen de tres columnas.
- Grid principal: bandeja flexible + panel de preferencias de 320–360 px.
- Área útil amplia; nunca una columna móvil centrada.
- Máximo ancho coherente con Dashboard/Ajustes, no con el iframe de Stitch.

### Tablet — 1024 y 768 px

- Respetar el breakpoint real del shell.
- Resumen de tres columnas si cabe sin comprimir; en 768 puede pasar a una o dos columnas.
- Bandeja y preferencias se apilan verticalmente.
- No usar un rail angosto para los canales.
- Acciones pueden envolver en una segunda línea sin solaparse.

### Móvil — 390 y 320 px

Orden:

1. encabezado;
2. resumen;
3. filtros;
4. bandeja;
5. preferencias;
6. confirmación/error.

Además:

- una columna;
- sin scroll horizontal;
- áreas táctiles de 44 × 44 px;
- acciones con texto visible;
- bottom navigation existente sin un sexto acceso;
- botón de guardar dentro del flujo, sin cubrir contenido.

---

## 10. Roles, navegación y Bitácora

### Perfil operativo

- Puede ver Notificaciones.
- Añadir `notificaciones.html` al grupo operativo de `assets/js/app-shell.js` usando el icono `notifications` existente.
- Ubicarlo después de Reportes y antes de módulos de configuración, sin reorganizar toda la navegación.
- No añadirlo a `bottomNavigation`; se accede desde drawer/sidebar.

### Perfil administrativo

- Continúa viendo únicamente Bitácora.
- Acceso directo a `pages/notificaciones.html` redirige a `bitacora.html`.

### Sin perfil o perfil inválido

- Redirigir a `acceso.html` mediante el guard compartido.
- No crear lógica de roles dentro de `notificaciones.js` que duplique `app-shell.js`.

### Bitácora

- Añadir `notificaciones.html: 'Notificaciones'` al mapa de módulos de `assets/js/activity-log.js` para registrar el ingreso operativo mediante el mecanismo compartido.
- Registrar un único evento adicional después de guardar preferencias correctamente:

```text
Módulo: Notificaciones
Acción: Preferencias actualizadas
Descripción: Preferencias de notificación actualizadas.
```

- No registrar canales, valores booleanos, mensajes financieros ni IDs.
- No registrar `Marcar como leída` ni `Marcar todas como leídas`; producirían ruido administrativo.
- Un fallo opcional del logger no debe convertir un guardado exitoso en error.

---

## 11. Accesibilidad, seguridad y rendimiento

### Accesibilidad — WCAG 2.2 AA

- `h1` único y jerarquía de headings coherente.
- Skip link y `main#main-content` según el shell.
- Contraste mínimo 4.5:1 para texto normal.
- Foco visible amber en todos los controles.
- Navegación completa por teclado.
- `aria-live="polite"` para filtros, lectura, éxito y errores no críticos.
- `role="alert"` para validación de canales.
- Estado leído/no leído con texto o badge además de color.
- Iconos decorativos con `aria-hidden="true"`.
- Checkboxes con `fieldset` y `legend` cuando formen grupos.
- Respetar `prefers-reduced-motion`.

### Seguridad y resiliencia

- Renderizar datos dinámicos con `textContent` o escape compartido; evitar `innerHTML` con datos mock.
- No evaluar HTML, URLs o scripts provenientes del JSON.
- Usar hrefs internos conocidos, no construir destinos arbitrarios.
- Recuperar storage corrupto o inaccesible sin caída total.
- No enviar requests fuera de los assets estáticos existentes.
- No exponer datos completos de cliente en Bitácora.

### Rendimiento

- Un solo fetch de `mock-data.json`.
- Derivación lineal sobre colecciones existentes.
- Sin polling, intervalos, observers globales ni librerías nuevas.
- Reutilizar listeners y utilidades existentes; event delegation solo si reduce duplicación real.
- No crear un store global, bus de eventos o arquitectura genérica para tres tipos.

---

## 12. Archivos previstos

### Crear

| Archivo | Responsabilidad |
|---|---|
| `pages/notificaciones.html` | Estructura semántica y slots del shell. |
| `assets/js/notification-model.js` | Derivación pura, preferencias, lectura, filtros y validación. |
| `assets/js/notificaciones.js` | Fetch, render, eventos, storage y feedback accesible. |
| `tests/notification-model.test.cjs` | TDD mínimo del dominio. |
| `docs/prototype/NOTIFICATIONS_IMPLEMENTATION_HANDOFF.md` | Contrato de diseño e implementación. |

### Modificar

| Archivo | Cambio mínimo |
|---|---|
| `assets/js/app-shell.js` | Ruta operativa y protección automática de Notificaciones. |
| `assets/js/activity-log.js` | Mapa de módulo; reutilizar API pública existente. |
| `assets/css/app.css` | Estilos específicos y responsive del módulo. |
| `assets/css/styles.css` | Resultado generado por `npm run build:css`. |
| `package.json` | Añadir los dos scripts nuevos a `npm run validate`. |
| `tests/app-shell-access.test.cjs` | Roles y navegación del nuevo módulo. |
| `tests/activity-log.test.cjs` | Reconocimiento del módulo y contrato de eventos si corresponde. |
| `tests/encoding.test.cjs` | Incluir nuevos archivos si la suite usa una lista explícita. |

### No modificar por defecto

- `assets/data/mock-data.json`: ya contiene facturas, propuestas y pagos suficientes; derivar desde ellos.
- Controladores de Facturas, Propuestas, Movimientos o Reportes.
- Landing y Acceso, salvo evidencia real de un enlace roto.
- README, excepto si el `origin/main` actualizado mantiene una lista explícita de módulos que deba reflejar Notificaciones.

---

## 13. Flujo de trabajo por pasos, skills y MCPs

### Paso 1 — Preflight y contexto

**Acciones**

- Leer `AGENTS.md` completo.
- Recuperar Engram para roles, Bitácora, Categorías, Servicios, Propuestas, Fiscal y Ajustes.
- Revisar memoria marcada `needs_review` como contexto no confiable y verificarla contra `origin/main`.
- Confirmar Git, worktrees, rama y cambios ajenos.

**Skills**

- `architecture`
- `cognitive-doc-design`
- `ponytail`

**MCP/herramientas**

- Engram: contexto, decisiones y posteriores hallazgos.
- Shell: `git status`, `git fetch`, `git worktree list`, lectura de archivos.

**Salida**

- Worktree aislado y baseline confirmado; ningún archivo ajeno modificado.

### Paso 2 — SDD mínimo

**Acciones**

- Cambio SDD: `notifications-module`.
- Usar Engram como artifact store, salvo que el proyecto vigente ya haya fijado OpenSpec/híbrido.
- Registrar propuesta, escenarios, diseño y tareas de forma breve.
- Mantener el alcance de este handoff; no volver a diseñar el producto.

**Skills**

- `sdd-init` solo si no existe contexto vigente.
- `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`.
- `architecture`, `ponytail`.

**MCP/herramientas**

- Engram como artifact store y memoria persistente.
- Stitch únicamente en lectura si hace falta confirmar composición.

**Salida**

- Requisitos y tareas recuperables, sin crear documentación duplicada innecesaria.

### Paso 3 — TDD del modelo

**Acciones**

1. Crear pruebas del modelo.
2. Ejecutarlas y observar RED por ausencia de implementación.
3. Implementar GREEN.
4. Refactorizar únicamente duplicación real.

**Skills**

- `test-driven-development`
- `ponytail`
- `architecture`

**MCP/herramientas**

- Shell con `node --test tests/notification-model.test.cjs`.

**Salida**

- Modelo puro, determinista y sin DOM.

### Paso 4 — Implementación visual e integración

**Acciones**

- Construir HTML semántico dentro del shell vigente.
- Implementar controlador, storage y render.
- Añadir navegación, rol y Bitácora con cambios mínimos.
- Construir CSS desde `app.css`; no editar solo el CSS generado.

**Skills**

- `frontend-design`
- `accessibility`
- `web-design-guidelines`
- `ponytail`

**MCP/herramientas**

- Shell para edición, checks y build.
- Stitch read-only para contraste visual, nunca para copiar código.

**Salida**

- Módulo funcional en PC, tablet y móvil, coherente con los demás módulos.

### Paso 5 — Validación como usuario real

**Acciones**

- Levantar servidor local.
- Recorrer los flujos de la sección 15 en navegador real.
- Revisar teclado, responsive, consola y requests.
- Corregir defectos encontrados y repetir el flujo afectado.

**Skills**

- `playwright`
- `accessibility`
- `verification-loop`
- `web-design-guidelines`

**MCP/herramientas**

- Playwright MCP o Browser MCP.
- DevTools/consola y requests mediante el MCP.
- Shell para el servidor y validaciones.

**Salida**

- Evidencia de comportamiento de usuario, no solo tests unitarios verdes.

### Paso 6 — Cierre técnico y revisión

**Acciones**

- Ejecutar todos los checks.
- Revisar el diff y asegurar que solo contiene archivos necesarios.
- Aplicar el lifecycle vigente de Gentle-AI definido en `AGENTS.md`.
- No hacer commit, push ni PR sin autorización posterior.

**Skills**

- `lint-and-validate`
- `work-unit-commits`
- `verification-loop`
- `branch-pr` únicamente después de autorización para publicar.

**MCP/herramientas**

- Shell: validación, Git y Gentle-AI.
- Engram: guardar decisiones, bugs y resumen de sesión.

**Delegación**

- El agente principal realiza el trabajo rutinario.
- Si una regla obligatoria o un riesgo real exige delegar, usar como máximo un subagente `Terra Medium`, esperar su resultado y cerrarlo.
- No crear revisores adicionales ni gastar un nuevo presupuesto de revisión en gates pre-commit/pre-push/pre-PR; validar el recibo existente.

---

## 14. TDD mínimo obligatorio

Casos del modelo:

1. deriva facturas vencidas solo desde estados cobrables y saldo pendiente;
2. excluye borradores, pagadas y anuladas;
3. deriva propuestas `SENT` dentro de 30 días y excluye vencidas o cerradas;
4. deriva pagos con ID estable y relación de factura;
5. ordena por fecha descendente sin mutar entrada;
6. evita IDs duplicados;
7. aplica preferencias de los tres tipos;
8. valida al menos un canal;
9. marca una y todas como leídas;
10. conserva únicamente IDs vigentes;
11. normaliza storage vacío o corrupto a defaults;
12. maneja fechas `YYYY-MM-DD` sin desfase de zona horaria.

Pruebas de integración existentes a extender:

- operativo ve Notificaciones en navegación;
- admin ve solo Bitácora;
- admin directo a Notificaciones redirige a Bitácora;
- sin perfil o perfil inválido redirige a Acceso;
- el módulo se reconoce en ActivityLog;
- nuevos archivos no contienen mojibake.

Los tests no reemplazan la validación real del navegador.

---

## 15. Validación real de usuario

### Preparación

```powershell
python -m http.server 4177
```

Abrir `http://127.0.0.1:4177/`.

### Flujos funcionales

#### A. Acceso operativo

1. Landing → Acceso.
2. Elegir perfil operativo.
3. Abrir Notificaciones desde sidebar/drawer.
4. Confirmar que el shell y navegación coinciden con otros módulos.

#### B. Derivación y resumen

1. Confirmar tarjetas de facturas vencidas, propuestas por expirar y pagos recibidos.
2. Verificar que los valores coinciden con el mock y no están hardcodeados.
3. Confirmar orden descendente y mensajes con entidades reales.

#### C. Lectura

1. Marcar una notificación como leída.
2. Confirmar badge/estilo, conteo y filtro.
3. Recargar y confirmar persistencia.
4. Marcar todas como leídas.
5. Confirmar `No tienes notificaciones nuevas.` en el filtro correspondiente.

#### D. Navegación relacionada

1. `Ver factura` abre Facturas sin 404.
2. `Ver propuesta` abre Propuestas sin 404.
3. `Ver movimiento` abre Movimientos sin 404.
4. Volver a Notificaciones y confirmar que el estado se conserva.

#### E. Preferencias

1. Desactivar un tipo de alerta y guardar.
2. Confirmar que lista y resumen se actualizan de forma coherente.
3. Recargar y confirmar persistencia.
4. Desactivar Email y En la aplicación.
5. Confirmar error, foco y que no se guarda.
6. Seleccionar al menos un canal, guardar y confirmar mensaje de éxito.
7. Confirmar que no se genera ninguna request de correo o push.

#### F. Estado vacío

1. Desactivar los tres tipos de alerta y guardar con un canal válido.
2. Confirmar empty state profesional y acceso visible a preferencias.
3. Reactivar los tipos y recuperar la lista.

#### G. Storage defectuoso

1. Colocar JSON inválido en la clave local desde DevTools/MCP.
2. Recargar.
3. Confirmar defaults seguros, pantalla operativa y consola sin errores no controlados.

#### H. Roles

1. Admin → solo Bitácora.
2. Admin intenta `pages/notificaciones.html` → Bitácora.
3. Sin perfil → Acceso.
4. Perfil inválido → Acceso.

#### I. Bitácora

1. Como operativo, abrir Notificaciones y guardar preferencias.
2. Cambiar a admin.
3. Confirmar un ingreso al módulo y un único guardado exitoso.
4. Confirmar que no aparecen canales, booleanos, IDs ni eventos por cada lectura.

### Responsive y accesibilidad

Validar en:

- PC: 1440 px.
- Tablet: 1024 px y 768 px.
- Móvil: 390 px y 320 px.

En cada viewport:

- sin scroll horizontal;
- sin elementos cortados o superpuestos;
- navegación usable;
- targets táctiles adecuados;
- zoom de navegador al 200 % sin pérdida funcional crítica.

Con teclado:

1. usar Tab desde el inicio;
2. verificar skip link;
3. recorrer filtros, tarjetas, enlaces, lectura y preferencias;
4. confirmar foco visible y orden lógico;
5. guardar y corregir el error sin mouse.

### Consola y red

- Cero errores de consola de la aplicación.
- Cero 404 internos.
- Cero requests de email, push, analytics nuevos o endpoints inexistentes.
- Solo assets locales ya previstos.

---

## 16. Checks finales

Durante TDD:

```powershell
node --test tests/notification-model.test.cjs
```

Antes de reportar listo:

```powershell
npm run build:css
npm run validate
python -m json.tool assets/data/mock-data.json
npm test
git diff --check
git status --short
```

Después:

- inspeccionar `git diff --stat` y `git diff --name-only`;
- revisar que no existan `.playwright-mcp`, screenshots, logs, videos, traces, PID files o temporales;
- confirmar que no se modificaron archivos fuera del alcance;
- stagear únicamente el alcance revisado cuando corresponda al gate;
- ejecutar el gate nativo requerido por `AGENTS.md` sin iniciar una segunda revisión;
- dejar la rama lista para solicitar autorización de commit y push, pero no publicarla todavía.

---

## 17. Criterios de aceptación

### Producto

- [ ] Notificaciones se siente parte del SaaS y no una pantalla genérica.
- [ ] Copy profesional, claro y sin `demo`, `simulación`, `prototipo` o promesas falsas.
- [ ] Los tres tipos requeridos se derivan de datos existentes.
- [ ] Lectura y preferencias persisten localmente.
- [ ] Navegación relacionada funciona.
- [ ] No existe automatización o envío real implícito en el comportamiento.

### Roles y trazabilidad

- [ ] Operativo puede usar el módulo.
- [ ] Administrativo continúa limitado a Bitácora.
- [ ] Sin perfil/perfil inválido falla cerrado hacia Acceso.
- [ ] Bitácora registra ingreso y guardado exitoso sin datos sensibles ni ruido.

### UI/UX y accesibilidad

- [ ] Shell y Editorial Fintech Ledger consistentes con módulos vigentes.
- [ ] PC, tablet y móvil son la misma experiencia responsive.
- [ ] Estados loading, empty, validation, success y error están presentes.
- [ ] Teclado, foco, contraste y targets cumplen el contrato.
- [ ] No hay scroll horizontal, solapes ni contenido cubierto.

### Calidad

- [ ] RED → GREEN del modelo documentado en la sesión.
- [ ] Build, validación, JSON, tests y `diff --check` pasan.
- [ ] Flujos reales recorridos en navegador.
- [ ] Consola y requests sin errores.
- [ ] Diff limitado a archivos necesarios.
- [ ] Sin artefactos temporales ni dependencias nuevas.
- [ ] Rama lista para autorización de commit/push/PR.

---

## 18. Informe final esperado del agente

Al terminar debe informar:

1. rama, worktree y SHA base;
2. archivos creados y modificados;
3. decisiones y correcciones aplicadas respecto de Stitch;
4. evidencia RED → GREEN del modelo;
5. resultado exacto de cada comando final;
6. flujos reales recorridos y viewports verificados;
7. resultado de teclado, consola y requests;
8. eventos observados en Bitácora;
9. riesgos o limitaciones pendientes;
10. estado de Git y si está listo para pedir autorización de commit y push.

No hacer commit, push ni abrir PR hasta recibir esa autorización.
