# Servicios — handoff final de diseño a implementación

## Decisión ejecutiva

Implementar el módulo operativo **Catálogo de servicios** en la rama `feat/services-module`, usando la última iteración de Stitch como referencia de jerarquía y comportamiento, pero **sin copiar literalmente su tema oscuro ni sus inconsistencias de contenido**.

La implementación debe integrarse al shell, roles, persistencia local, bitácora, accesibilidad y patrones responsive que ya utiliza FreelanceFlow. El objetivo es sumar un módulo terminado y coherente con el producto actual, no crear un subsistema nuevo.

### Ruta de trabajo

| Elemento | Valor |
|---|---|
| Worktree | `C:\Users\USER\Documents\Proyecto-FreelanceFlow-services` |
| Rama | `feat/services-module` |
| Cambio SDD | `services-module` |
| Artifact store | Engram, para no agregar archivos de proceso al repositorio |
| Perfil autorizado | `operational` |
| Perfil administrativo | Continúa viendo únicamente Bitácora |
| Alcance técnico | HTML, CSS y JavaScript vanilla; datos mock y persistencia local |

No crear backend, API, base de datos, React, Vite, dependencias nuevas ni un design system paralelo.

## Fuentes visuales finales

| Variante | Nodo final de Stitch | Uso autorizado |
|---|---|---|
| Móvil | [5135f2b7b976427e86bf23c78b9a6876](https://stitch.withgoogle.com/preview/5303215837171127369?node-id=5135f2b7b976427e86bf23c78b9a6876) | Referencia para app bar, tarjetas, filtros compactos, acción de creación y navegación inferior. |
| Tablet | [3e9afe7f26164981b402eaf1e7b5c683](https://stitch.withgoogle.com/preview/5303215837171127369?node-id=3e9afe7f26164981b402eaf1e7b5c683) | Referencia para métricas, buscador, filtros y listado compacto. |
| PC | [d34448e0f76e4d85a24d6fa93c8eaf00](https://stitch.withgoogle.com/preview/5303215837171127369?node-id=d34448e0f76e4d85a24d6fa93c8eaf00) | Fuente principal para jerarquía, tabla, columnas, métricas y panel lateral. |

### Correcciones obligatorias sobre Stitch

Las referencias son una composición visual, no una especificación literal:

- Reutilizar el **shell real** de FreelanceFlow; no reconstruir sidebar, app bar ni bottom nav dentro del módulo.
- Mantener sidebar navy y contenido principal cálido/claro. No copiar el fondo marrón oscuro aplicado a toda la pantalla.
- En móvil, agregar la tercera métrica `Unidad más utilizada`.
- Reemplazar `Mensual` por `Entregable`.
- Reemplazar `Proyecto Fijo` por `Proyecto`.
- Usar exactamente `Hora`, `Proyecto` y `Entregable` como unidades.
- Mantener `moneda` visible en datos, tabla y formulario.
- No agregar estado activo/inactivo, categoría contable, visibilidad en propuestas, inventario, suscripciones ni facturación recurrente.
- No añadir una cuarta métrica.
- Evitar FAB, drawer, toast o bottom nav superpuestos.
- El copy público debe sentirse final y profesional; no usar “demo”, “simulación”, “prototipo”, “Fase 1” ni “mock”.

## Alcance aprobado

El perfil operativo debe poder:

1. Consultar un catálogo reutilizable de servicios.
2. Ver total de servicios, tarifa promedio y unidad más utilizada.
3. Buscar por nombre o descripción.
4. Filtrar por unidad de medida.
5. Crear un servicio.
6. Editar un servicio existente.
7. Cancelar creación o edición sin alterar datos.
8. Eliminar un servicio únicamente después de confirmarlo.
9. Distinguir catálogo vacío de búsqueda sin resultados.
10. Conservar cambios al recargar durante la sesión local del producto.
11. Generar actividad operativa útil en Bitácora sin duplicados obvios.

### Fuera de alcance

- Integrar todavía el selector de servicios dentro de Proyectos o Facturas.
- Propuestas.
- Inventario o stock.
- Suscripciones, recurrencia o planes.
- Impuestos automáticos.
- Tarifas por cliente, descuentos o paquetes.
- Historial de precios.
- Importación, exportación o carga masiva.
- Estados activo/inactivo.
- Categorías contables para servicios.
- Backend, sincronización remota o autenticación real.

El catálogo deja preparada la entidad reusable; la conexión transaccional con Proyectos y Facturas será un cambio posterior y separado.

## Contrato de dominio

### Entidad `service`

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string | Identificador estable generado localmente. |
| `nombre_servicio` | string | Obligatorio, sin espacios extremos y único al comparar de forma insensible a mayúsculas. |
| `descripcion` | string | Opcional; texto breve preservado al editar. |
| `unidad_medida` | enum | Solo `Hora`, `Proyecto` o `Entregable`. |
| `tarifa_unitaria` | number | Obligatoria, finita y estrictamente mayor que cero. |
| `moneda` | enum/string controlado | Usar las monedas ya admitidas por el producto; iniciar con `USD`, `EUR` y `MXN` si no existe un catálogo común. |

### Reglas de negocio

- Normalizar el nombre con `trim()` antes de validar y guardar.
- Rechazar nombres vacíos o duplicados.
- Rechazar unidad ausente o distinta del enum aprobado.
- Rechazar tarifa vacía, texto, `NaN`, infinito, cero o valores negativos.
- Convertir la tarifa a número antes de persistir; no guardar cadenas monetarias formateadas.
- El formato de moneda pertenece a la vista y debe usar `Intl.NumberFormat`.
- Crear y editar deben recalcular listado y métricas sin recargar la página.
- Cancelar debe descartar cambios locales del formulario.
- Eliminar debe requerir confirmación que incluya el nombre del servicio.
- La primera versión puede eliminar físicamente porque aún no existen relaciones persistidas con proyectos o facturas. Cuando esas relaciones se implementen, deberá revisarse esta regla antes de permitir borrado.
- La tarifa promedio se calcula con todos los servicios visibles del catálogo, no con la página actual de una futura paginación.
- La unidad más utilizada se obtiene por frecuencia; ante empate, conservar un resultado determinista según el orden `Hora`, `Proyecto`, `Entregable`.
- Búsqueda y filtro afectan el listado, pero las métricas superiores representan el catálogo completo para evitar que cambien de significado durante la exploración.

## Copy final

| Contexto | Texto |
|---|---|
| Título | `Catálogo de servicios` |
| Introducción | `Define servicios reutilizables con descripciones, unidades y tarifas listas para tus proyectos y facturas.` |
| CTA principal | `Crear servicio` |
| Métrica 1 | `Total de servicios` |
| Métrica 2 | `Tarifa promedio` |
| Métrica 3 | `Unidad más utilizada` |
| Buscador | `Buscar por nombre o descripción` |
| Filtro inicial | `Todas las unidades` |
| Vacío | `Aún no has creado servicios en tu catálogo` |
| Apoyo vacío | `Crea tu primer servicio para reutilizar descripciones y tarifas en tu operación.` |
| Sin resultados | `No encontramos servicios con los criterios seleccionados.` |
| Acción sin resultados | `Limpiar filtros` |
| Crear | `Crear servicio` |
| Editar | `Guardar cambios` |
| Cancelar | `Cancelar` |
| Eliminar | `Eliminar servicio` |
| Guardado | `Servicio guardado correctamente.` |
| Actualizado | `Servicio actualizado correctamente.` |
| Eliminado | `Servicio eliminado correctamente.` |

### Errores de formulario

- `Ingresá un nombre para el servicio.`
- `Seleccioná una unidad de medida.`
- `Ingresá una tarifa mayor que cero.`
- `Ya existe un servicio con ese nombre.`

Los artefactos del repositorio deben conservar español profesional coherente con el producto actual; no introducir regionalismos nuevos si el resto de la pantalla usa español neutral.

## Diseño por dispositivo

### PC — 1280 px o más

#### Estructura

1. Shell actual con `Servicios` activo.
2. Encabezado con título, introducción y CTA.
3. Tres métricas en una fila.
4. Buscador, filtro de unidad y acción `Crear servicio`.
5. Tabla de servicios.
6. Panel lateral superpuesto para crear o editar.
7. Dialog de confirmación para eliminar.

#### Tabla

Columnas exactas:

1. Servicio.
2. Descripción.
3. Unidad.
4. Tarifa.
5. Moneda.
6. Acciones.

Requisitos:

- `<caption>` accesible y encabezados con `scope="col"`.
- Números tabulares y tarifa alineada para comparación rápida.
- Descripción truncada visualmente sin eliminar el texto accesible.
- Acciones con nombre visible o accesible `Editar <servicio>` y `Eliminar <servicio>`.
- No agregar paginación si el volumen mock no la necesita. Mostrar todos los registros es más simple y suficiente.

#### Drawer

- Ancho aproximado de 400–440 px.
- Se superpone al contenido; no comprime la tabla.
- Backdrop, trap de foco y fondo no interactivo.
- Foco inicial en el título o primer campo.
- Cierre por botón, `Cancelar` y `Escape`.
- Restituir foco al disparador al cerrar.
- Acciones siempre visibles y sin solaparse con toast.
- Si hay cambios sin guardar, confirmar antes de descartarlos.

### Tablet — 768 a 1023 px

- Reutilizar el shell responsive actual; sidebar como overlay, no escalado.
- Mantener las tres métricas en una fila si cada tarjeta conserva legibilidad; pasar a cuadrícula 2 + 1 si el contenido se comprime.
- Entre 900 y 1023 px puede usarse tabla reducida.
- Entre 768 y 899 px usar filas compactas o tarjetas de dos columnas para evitar scroll horizontal de página.
- Mantener buscador, filtro y CTA visibles; permitir que se distribuyan en dos filas.
- El formulario se abre como drawer superpuesto de máximo 420 px o como pantalla completa en orientación vertical estrecha.
- No usar el menú tablet inventado por Stitch si difiere de `app-shell.js`.
- Nunca reducir tipografía o controles para encajar un desktop fijo.

### Móvil — 320 a 767 px

- Reutilizar app bar y bottom nav actuales.
- Servicios se abre desde el menú lateral si no pertenece al conjunto fijo del bottom nav; no reemplazar arbitrariamente otro módulo existente.
- Presentar las métricas en 2 + 1: total y promedio en la primera fila; unidad más utilizada en una tarjeta completa debajo.
- Buscador a ancho completo.
- Filtros de unidad como chips que puedan envolver líneas dentro del contenedor; no generar scroll horizontal de página.
- Usar tarjetas, nunca tabla.
- Cada tarjeta muestra nombre, descripción breve, unidad, tarifa, moneda, editar y eliminar.
- Si se conserva un FAB, debe tener `aria-label="Crear servicio"`, permanecer dentro del viewport y respetar el área segura y el bottom nav. Preferir el patrón CTA móvil ya existente si evita superposiciones.
- Formulario a pantalla completa con encabezado, campos y acciones accesibles.
- Reservar padding inferior para que la última tarjeta y el CTA no queden bajo el bottom nav.
- A 320 px no debe haber texto cortado, acciones superpuestas ni desplazamiento horizontal.

## Estados obligatorios

| Estado | Resultado esperado |
|---|---|
| Cargando | Mantener estructura con indicador breve o skeleton ya usado en el producto. |
| Con datos | Métricas, filtros y listado sincronizados. |
| Catálogo vacío | Copy aprobado y CTA `Crear servicio`. |
| Sin resultados | Mensaje específico y acción `Limpiar filtros`; no confundir con catálogo vacío. |
| Creación | Formulario limpio con `USD` como moneda inicial si corresponde. |
| Edición | Formulario precargado sin mutar el registro hasta guardar. |
| Validación | Error asociado al campo, resumen útil y foco en el primer error. |
| Confirmación | Dialog que nombre el servicio y permita cancelar. |
| Guardado | Actualizar UI, cerrar formulario y anunciar éxito. |
| Error local | Conservar valores ingresados y explicar cómo corregir. |

## Integración con FreelanceFlow

### Roles y navegación

- Agregar `Servicios` solo a `getNavigationGroupsForProfile('operational')`.
- Mantener `administrative` con Bitácora únicamente.
- Sin perfil: una URL directa a `servicios.html` redirige a `acceso.html`.
- Perfil administrativo: una URL directa a `servicios.html` redirige a `bitacora.html`.
- Perfil operativo: `Servicios` aparece y queda activo en su pantalla.
- No alterar el bottom nav operativo salvo que el patrón actual ya contemple módulos secundarios.
- Mantener el enlace de marca a `../index.html`.

### Datos y persistencia

- Usar mock inicial como baseline y una única clave `localStorage` para el overlay persistente del catálogo.
- Reutilizar el patrón de modelo puro + controlador de pantalla utilizado por Categorías, Clientes o Proyectos.
- No duplicar servicios en HTML, JavaScript y JSON.
- Tolerar almacenamiento ausente, JSON inválido y registros incompletos sin romper toda la pantalla.
- Mantener IDs existentes al editar.
- La vista siempre consume el resultado normalizado del modelo.

### Bitácora

Registrar únicamente actividad operacional significativa:

- ingreso al módulo;
- creación confirmada;
- edición confirmada;
- eliminación confirmada;
- búsqueda cuando exista texto real, siguiendo la deduplicación actual.

No registrar cada tecla, apertura/cierre del drawer, cancelaciones, cambios de filtro sin efecto ni actividad administrativa.

Ejemplos de descripción:

- `Creó el servicio Consultoría UX/UI.`
- `Actualizó el servicio Consultoría UX/UI.`
- `Eliminó el servicio Consultoría UX/UI.`

## Archivos previstos

### Crear

- `pages/servicios.html` — estructura semántica, estados, tabla/tarjetas, formulario y confirmación.
- `assets/js/service-model.js` — normalización, validación, métricas y operaciones puras.
- `assets/js/servicios.js` — carga, render, filtros, persistencia y eventos de UI.
- `tests/service-model.test.cjs` — contrato mínimo del dominio.

### Modificar solo si es necesario

- `assets/js/app-shell.js` — navegación operativa, ruta protegida e ícono.
- `assets/css/app.css` — estilos específicos y breakpoints; después regenerar `assets/css/styles.css`.
- `assets/data/mock-data.json` — catálogo inicial como única fuente mock.
- `assets/js/activity-log.js` — solo si necesita reconocer acciones o módulo nuevos.
- `package.json` — añadir los JS nuevos a `validate` siguiendo el patrón actual.
- Tests existentes de shell, roles, actividad, encoding y validación — ampliar cobertura sin duplicarla.
- `README.md` — marcar Servicios como disponible solo después de la validación final.

No crear helpers genéricos, repositorios, factories, servicios de aplicación, clases base ni dependencias para una sola pantalla. Primero reutilizar patrones existentes; después usar APIs nativas.

## Estrategia SDD y TDD

### SDD — Engram

Antes de implementar:

1. Confirmar el contexto `sdd-init/freelanceflow` en Engram.
2. Crear el cambio `services-module` en modo Engram.
3. Persistir y aprobar secuencialmente:
   - `sdd/services-module/proposal`;
   - `sdd/services-module/spec`;
   - `sdd/services-module/design`;
   - `sdd/services-module/tasks`.
4. Verificar que propuesta, spec, diseño y tareas respeten este handoff.
5. No usar OpenSpec ni crear archivos de proceso si Engram está disponible.
6. Durante apply, mantener `sdd/services-module/apply-progress` actualizado.
7. Finalizar con `sdd/services-module/verify-report` y archivar solo después de evidencia real.

El handoff es la fuente de producto. SDD organiza la ejecución; no puede ampliar el alcance.

### TDD — RED → GREEN → REFACTOR

Escribir primero el test más pequeño que falle por cada regla no trivial:

1. Normalización de nombre y descripción.
2. Nombre obligatorio y duplicado.
3. Enum de unidad.
4. Tarifa finita y mayor que cero.
5. Cálculo de tarifa promedio.
6. Cálculo determinista de unidad más utilizada.
7. Crear, editar y eliminar sin mutaciones accidentales.
8. Tolerancia a registros locales incompletos.
9. Navegación y guards por rol.
10. Bitácora operacional y deduplicación existente.

Después de cada RED confirmado, implementar el mínimo GREEN y refactorizar solo cuando elimine duplicación real. No construir abstracciones anticipadas.

Los tests de código son una protección durante el desarrollo. **La aprobación final depende además de recorridos reales en navegador**, no únicamente de tests unitarios.

## Plan de ejecución por pasos

### Paso 0 — Preflight seguro

**Acciones**

- Trabajar únicamente en el worktree y rama indicados.
- Ejecutar `git status --short` y preservar cambios ajenos.
- Recuperar decisiones recientes de Engram.
- Confirmar que Categorías está presente en la base actual.

**Skills**

- `architecture` para confirmar límites.
- `ponytail` para evitar alcance y abstracciones innecesarias.

**MCP/herramientas**

- Engram: `mem_context`, `mem_search`, `mem_get_observation`, `mem_review`.
- Shell: `git branch --show-current`, `git status --short`, `git log`.

**Gate**

- Rama correcta, estado conocido y ninguna edición fuera del worktree.

### Paso 1 — Planificación SDD

**Acciones**

- Ejecutar propuesta, spec, diseño y tareas para `services-module`.
- Traducir este contrato a escenarios verificables.
- Definir el límite de archivos antes de apply.

**Skills**

- `sdd-init`, `sdd-propose`, `sdd-spec`, `sdd-design`, `sdd-tasks`.
- `architecture`.
- `cognitive-doc-design` para artefactos revisables.

**MCP/herramientas**

- Engram como artifact store.
- Gentle-AI como orquestador SDD.

**Gate**

- Ningún requisito inventado; tareas cubren roles, modelo, UI, bitácora, responsive y validación real.

### Paso 2 — Modelo y TDD

**Acciones**

- Crear primero `tests/service-model.test.cjs`.
- Confirmar RED.
- Implementar `service-model.js` mínimo.
- Confirmar GREEN y refactor breve.

**Skills**

- `test-driven-development`.
- `sdd-apply`.
- `ponytail`.

**MCP/herramientas**

- Shell para `node --test tests/service-model.test.cjs`.
- Engram para guardar apply progress y descubrimientos no obvios.

**Gate**

- Reglas de dominio comprobadas sin DOM ni persistencia acoplados al modelo.

### Paso 3 — Shell, roles y estructura HTML

**Acciones**

- Añadir navegación y guards.
- Crear `pages/servicios.html` reutilizando slots del shell actual.
- Incorporar tabla, cards, estados, drawer y dialog semánticos.

**Skills**

- `frontend-design`.
- `accessibility`.
- `sdd-apply`.

**MCP/herramientas**

- Shell para búsquedas y validación de sintaxis.
- Engram para decisiones de integración.

**Gate**

- Operativo puede acceder; administrador y usuario sin perfil son redirigidos correctamente.

### Paso 4 — Diseño responsive

**Acciones**

- Reutilizar tokens y componentes actuales.
- Implementar PC, tablet y móvil según este handoff.
- Regenerar CSS compilado.

**Skills**

- `frontend-design`.
- `accessibility`.
- `ui-ux-pro-max` solo para resolver una duda concreta, no para rediseñar.
- `ponytail` para evitar CSS o componentes paralelos.

**MCP/herramientas**

- Playwright MCP para inspección real por viewport.
- Shell para `npm run build:css`.

**Gate**

- Sin scroll horizontal de página, contenido cortado ni controles superpuestos en 1440, 768, 390 y 320 px.

### Paso 5 — Controlador, persistencia y estados

**Acciones**

- Conectar mock, almacenamiento local, render, métricas, búsqueda y filtro.
- Implementar crear, editar, cancelar, eliminar y sus estados.
- Mantener foco y anuncios accesibles.

**Skills**

- `sdd-apply`.
- `debugging-strategies` si aparece una inconsistencia reproducible.
- `accessibility`.
- `ponytail`.

**MCP/herramientas**

- Playwright MCP para clicks, escritura, selects, dialogs y foco.
- Browser console mediante Playwright.
- Engram para bugfixes y gotchas.

**Gate**

- Cada acción produce un resultado visible y persistente sin recarga inesperada.

### Paso 6 — Bitácora

**Acciones**

- Registrar solo eventos operativos aprobados.
- Verificar ausencia de eventos administrativos y duplicados consecutivos.

**Skills**

- `test-driven-development` para cualquier lógica nueva.
- `sdd-apply`.
- `ponytail`.

**MCP/herramientas**

- Playwright MCP para generar actividad como operativo y revisarla como administrador.
- Engram para guardar decisiones o bugfixes.

**Gate**

- Bitácora muestra una vez cada acción significativa y nunca ruido de UI.

### Paso 7 — Verificación técnica

**Acciones**

Ejecutar:

```powershell
npm run build:css
npm run validate
npm test
python -m json.tool assets/data/mock-data.json
git diff --check
```

**Skills**

- `lint-and-validate`.
- `sdd-verify`.
- `verification-loop`.

**MCP/herramientas**

- Shell para comandos reproducibles.
- Engram para `sdd/services-module/verify-report`.

**Gate**

- Todos los comandos pasan; esto habilita la validación de usuario, pero no reemplaza esa validación.

### Paso 8 — Validación en tiempo real como usuario final

**Acciones**

1. Iniciar servidor local:

```powershell
python -m http.server 4177
```

2. Abrir `http://127.0.0.1:4177/` mediante Playwright MCP.
3. Recorrer los flujos completos descritos en la matriz siguiente.
4. Revisar consola después de cada flujo crítico.

**Skills**

- `playwright`.
- `accessibility`.
- `web-design-guidelines` para una revisión final centrada en interfaz.
- `sdd-verify`.

**MCP/herramientas**

- Playwright MCP: navegación, click, fill, select, keyboard, resize, snapshot y console.
- No inicializar TestSprite: Playwright cubre los flujos sin añadir configuración ni artefactos al repositorio.

**Gate**

- Todos los recorridos funcionan como producto real en PC, tablet y móvil; consola sin errores.

### Paso 9 — Revisión y preparación para publicar

**Acciones**

- Revisar el diff completo y eliminar archivos no necesarios.
- Actualizar README solo con estado verificado.
- Ejecutar una revisión fresca antes de PR si el diff es grande o afecta varios módulos.
- Preparar commit convencional y PR, pero no publicar sin solicitud explícita del usuario.

**Skills**

- `work-unit-commits`.
- `branch-pr` o `github-pr`.
- `ponytail-review` para detectar sobreingeniería.
- `review-readability`; revisión adicional de riesgo solo si el diff supera 400 líneas o toca rutas sensibles.

**MCP/herramientas**

- Shell/Git para revisar alcance.
- GitHub/`gh` únicamente cuando el usuario autorice commit, push y PR.
- Engram para resumen final y decisiones.

**Política de agentes**

- Trabajo rutinario con el agente principal.
- Si las reglas de Gentle-AI requieren delegación, usar como máximo un executor y un reviewer fresco, nunca más de dos subagentes sin autorización.

**Gate**

- Rama limpia salvo archivos intencionales, checks verdes, validación real aprobada y lista exacta de archivos a publicar.

## Matriz de validación real

### Roles y acceso

- [ ] Landing → Acceso → Operativo → Servicios.
- [ ] Servicios aparece en desktop y en el menú responsive operativo.
- [ ] Operativo ve Servicios activo y el resto de la navegación sigue funcionando.
- [ ] URL directa sin perfil redirige a Acceso.
- [ ] URL directa con perfil administrativo redirige a Bitácora.
- [ ] Administrador solo ve Bitácora.

### Catálogo y filtros

- [ ] Las tres métricas coinciden con el catálogo completo.
- [ ] Buscar por nombre reduce resultados.
- [ ] Buscar por descripción reduce resultados.
- [ ] Filtrar por Hora, Proyecto y Entregable funciona.
- [ ] Combinar búsqueda y filtro funciona.
- [ ] Una consulta inexistente muestra el estado sin resultados.
- [ ] `Limpiar filtros` restaura el catálogo.
- [ ] Catálogo realmente vacío muestra el empty state, no el estado sin resultados.

### Creación

- [ ] `Crear servicio` abre formulario vacío.
- [ ] Guardar sin nombre muestra error y enfoca el campo.
- [ ] Tarifa cero o negativa muestra error.
- [ ] Unidad ausente muestra error.
- [ ] Nombre duplicado muestra error sin perder otros valores.
- [ ] Un servicio válido aparece inmediatamente y actualiza métricas.
- [ ] Recargar conserva el servicio creado.

### Edición y cancelación

- [ ] Editar abre los datos correctos.
- [ ] Guardar cambios actualiza solo el servicio seleccionado.
- [ ] Cancelar no modifica el servicio.
- [ ] `Escape` cierra de forma segura o solicita confirmación si hay cambios.
- [ ] El foco vuelve al botón que abrió el formulario.

### Eliminación

- [ ] Eliminar abre dialog con el nombre del servicio.
- [ ] Cancelar el dialog conserva el registro.
- [ ] Confirmar elimina una sola vez y recalcula métricas.
- [ ] Recargar no restaura el servicio eliminado.

### Bitácora

- [ ] Ingreso a Servicios genera un único evento operativo.
- [ ] Crear, editar y eliminar generan eventos descriptivos.
- [ ] Búsqueda con texto real puede registrarse una vez según la deduplicación actual.
- [ ] Abrir/cerrar formularios, cancelar y cambiar filtros no generan ruido.
- [ ] La actividad administrativa no aparece.

### Responsive y accesibilidad

- [ ] 1440 × 900: tabla completa, drawer dentro del viewport y sin solapamientos.
- [ ] 1024 × 768: shell y contenido reorganizados sin lienzo escalado.
- [ ] 768 × 1024: listado legible y formulario contenido.
- [ ] 390 × 844: cards, tres métricas, CTA y bottom nav sin superposición.
- [ ] 320 × 568: sin scroll horizontal ni texto o acciones cortadas.
- [ ] Todos los objetivos táctiles miden al menos 44 × 44 px.
- [ ] Flujo completo realizable con teclado.
- [ ] Foco visible en todos los interactivos.
- [ ] Drawer y dialog contienen foco y lo restituyen.
- [ ] Tabla tiene caption y scope; cards usan estructura semántica.
- [ ] Cambios dinámicos se anuncian con `aria-live` o `role="status"`.
- [ ] Errores se asocian al campo y usan `role="alert"` cuando corresponde.
- [ ] `prefers-reduced-motion` evita transiciones innecesarias.
- [ ] Contraste WCAG 2.2 AA.
- [ ] Consola sin errores ni recursos 404.

## Criterio de aprobación

Servicios está listo para commit y push solo cuando:

- [ ] Cumple el contrato de dominio y el alcance aprobado.
- [ ] Se integra al perfil operativo sin alterar el administrativo.
- [ ] Reutiliza el shell y lenguaje visual actuales.
- [ ] PC, tablet y móvil pasan los recorridos reales.
- [ ] Bitácora registra únicamente actividad útil.
- [ ] Checks técnicos y consola están limpios.
- [ ] README refleja el resultado validado.
- [ ] El diff contiene únicamente archivos necesarios.
- [ ] No existen capturas, videos, logs, `.playwright-mcp`, carpetas de agentes, caches ni experimentos para subir.
- [ ] El usuario autoriza expresamente commit, push y PR.

No se necesita una cuarta iteración de Stitch. Las diferencias restantes se resuelven en código reutilizando los patrones ya probados de FreelanceFlow.
