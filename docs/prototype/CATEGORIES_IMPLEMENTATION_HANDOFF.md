# Categorías de gasto — handoff de diseño a implementación

## Decisión

Las tres variantes de Stitch sirven como **referencia compuesta**, pero ninguna debe copiarse literalmente. La implementación debe conservar el shell, las reglas de roles y los patrones accesibles ya existentes en FreelanceFlow.

- **Móvil** es la referencia visual más sólida para métricas y tarjetas.
- **Tablet** aporta el contenido funcional más completo, pero no es responsive: muestra un lienzo desktop reducido y el panel queda fuera del viewport.
- **PC** tiene una jerarquía limpia, pero se aleja del alcance y del sistema visual actual.

El resultado final será una pantalla operativa de **categorías de gasto**, no un catálogo mixto de ingresos/gastos ni una pantalla de configuración contable.

## Fuentes revisadas

| Variante | Nodo de Stitch | Veredicto |
|---|---|---|
| PC | [ee69d6212ba3486d8083b5795947b66b](https://stitch.withgoogle.com/preview/5303215837171127369?node-id=ee69d6212ba3486d8083b5795947b66b) | Referencia parcial de jerarquía; requiere corregir tema, navegación, métricas, tabla y formulario. |
| Móvil | [7a4e3a6720b84e079fca91c78dd682b6](https://stitch.withgoogle.com/preview/5303215837171127369?node-id=7a4e3a6720b84e079fca91c78dd682b6) | Mejor referencia responsive; requiere integrarse al shell real y al alcance exclusivo de gastos. |
| Tablet | [277667de94ed4ac39e57eedded91d2e3](https://stitch.withgoogle.com/preview/5303215837171127369?node-id=277667de94ed4ac39e57eedded91d2e3) | Buena referencia de información; no usar su layout fijo de 1280 px ni su panel fuera de pantalla. |

## Alcance aprobado

La pantalla debe permitir que el perfil operativo:

1. Consulte categorías de gasto.
2. Busque por nombre o descripción.
3. Filtre por deducible y estado.
4. Cree y edite una categoría.
5. Inactive o elimine una categoría con confirmación, según sus usos.
6. Consulte cantidad de usos, presupuesto mensual y atención presupuestaria.

No se agregan reglas fiscales automáticas, cuentas contables, exportación, categorías de ingreso, gráficos, integraciones bancarias, Servicios ni Propuestas.

## Contrato funcional

### Datos de una categoría

| Campo | Regla |
|---|---|
| `id` | Identificador interno estable. |
| `nombre_categoria` | Obligatorio, visible y único al comparar sin mayúsculas ni espacios extremos. |
| `descripcion` | Opcional; texto breve. |
| `es_deducible_por_defecto` | Booleano explícito; nunca comunicarlo solo por color. |
| `presupuesto_mensual` | Opcional; número mayor o igual a cero en USD. Vacío significa “sin presupuesto”. |
| `estado` | `active` o `inactive`; permite conservar referencias históricas. |
| `usos` | Valor derivado de Movimientos; no se edita manualmente. |
| `gasto_mensual` | Valor derivado de Movimientos para calcular atención presupuestaria. |

El ícono puede ser una elección visual de un catálogo corto si aporta claridad, pero no debe convertirse en una dependencia del dominio. No se incorpora un campo `tipo`: las categorías de este módulo son exclusivamente de gasto.

### Reglas de negocio

- El nombre es obligatorio y no puede duplicar otra categoría existente después de normalizarlo.
- El presupuesto acepta vacío o un importe no negativo; debe rechazarse texto, `NaN` y valores negativos.
- Una categoría con movimientos asociados no debe borrarse físicamente. La acción segura es **inactivarla** y explicar el efecto.
- Una categoría sin usos puede eliminarse con confirmación explícita si el modelo local lo permite.
- Las categorías inactivas permanecen visibles al aplicar el filtro correspondiente, pero no deben ofrecerse para nuevos movimientos.
- “Más utilizada” se calcula por cantidad de movimientos del período.
- “Atención de presupuesto” aparece cuando el gasto mensual alcanza el umbral definido por producto; la primera implementación usará 80 % para advertencia y 100 % para límite alcanzado.
- La pantalla debe recalcular métricas y resultados después de crear, editar, inactivar o eliminar, sin recargar la página.

## Implementación visual por dispositivo

### PC — 1280 px o más

#### Conservar

- Encabezado con título, explicación breve y acción primaria visible.
- Cuatro métricas en una fila.
- Tabla como representación principal.
- Panel lateral para crear y editar sin abandonar el contexto.

#### Corregir respecto de Stitch

- Reutilizar el sidebar real de FreelanceFlow: Dashboard, Movimientos, Clientes, Proyectos, Facturas, Reportes y Categorías activa.
- No incluir “Ajustes”, “Exportar”, “Ledger Pro”, “Plan Pro” ni acciones inventadas.
- Mantener el dark ledger en la navegación y superficies cálidas, claras y sobrias en el contenido. No copiar el fondo marrón oscuro de toda la pantalla.
- Mostrar exactamente estas métricas: total de categorías, deducibles, más utilizada y atención de presupuesto.
- Usar filtros de búsqueda, deducibilidad y estado. No mostrar filtros de “tipo”.
- La tabla debe incluir: categoría, descripción, deducible, usos, presupuesto mensual, estado y acciones.
- Las acciones de fila deben tener nombre accesible; un ícono sin etiqueta no alcanza.

#### Comportamiento objetivo

- Contenido principal fluido, sin ancho fijo de lienzo.
- Tabla con `caption`, encabezados `scope="col"`, importes con números tabulares y scroll horizontal solo como último recurso entre 1024 y 1279 px.
- Panel lateral de aproximadamente 400–440 px sobre el contenido, con backdrop; el layout principal no debe comprimirse.
- Al abrir el panel: mover foco al título o primer campo, impedir interacción con el fondo y devolver foco al disparador al cerrar.
- Cerrar con botón, Cancelar o `Escape`; si hay cambios sin guardar, pedir confirmación antes de descartarlos.

### Móvil — 320 a 767 px

#### Conservar

- Fondo claro, jerarquía compacta y métricas en cuadrícula 2 × 2.
- Buscador y acceso a filtros en una sola fila.
- Tarjetas verticales con nombre, estado, deducibilidad, usos y presupuesto.
- Acción primaria fácil de alcanzar.

#### Corregir respecto de Stitch

- Reutilizar la app bar móvil actual: menú, marca FreelanceFlow y nombre de pantalla. No inventar navegación con flecha atrás.
- Mantener el bottom nav existente: Inicio, Movimientos, Clientes, Proyectos y Facturas.
- No marcar “Movimientos” como activo al estar en Categorías. Categorías se abre desde el menú lateral móvil y no necesita ocupar una sexta posición inferior.
- Sustituir métricas Ingreso/Gasto por las cuatro métricas aprobadas del módulo.
- No mostrar selector de tipo ni badges de ingreso.
- Reservar padding inferior suficiente para que la última tarjeta y la acción primaria no queden bajo el bottom nav o el área segura.

#### Comportamiento objetivo

- No renderizar la tabla; usar una lista semántica de tarjetas.
- Cada tarjeta debe exponer una acción clara “Editar categoría” y un menú secundario con etiqueta accesible para inactivar/eliminar.
- El formulario debe ocupar la pantalla disponible, con encabezado y acciones Guardar/Cancelar visibles; no usar un drawer desktop encogido.
- Los filtros se presentan en un panel inferior o bloque desplegable con botón “Aplicar filtros” y acción “Limpiar”.
- Todos los objetivos táctiles deben medir al menos 44 × 44 px.
- A 320 px no debe existir scroll horizontal, texto cortado ni botones superpuestos.

### Tablet — 768 a 1023 px

#### Problema detectado en Stitch

La variante muestra internamente un lienzo de 1280 px reducido dentro del preview. El sidebar ocupa 256 px del lienzo, la tabla conserva ocho columnas y el panel de 400 px comienza fuera del contenido visible. Esto no es responsive: solo parece una miniatura del desktop.

#### Comportamiento objetivo

- Usar el shell responsive actual: app bar y sidebar como overlay, no una barra fija de 256 px.
- Presentar encabezado y acción primaria en una fila cuando entren; apilarlos con separación clara en tablet estrecha.
- Mantener las cuatro métricas en cuadrícula 2 × 2 para preservar legibilidad.
- Entre 768 y 899 px, preferir tarjetas compactas de dos columnas.
- Desde 900 px, se puede usar una tabla reducida con categoría, deducible, usos, presupuesto, estado y acciones; la descripción pasa a texto secundario dentro de la celda de categoría.
- El formulario se abre como panel superpuesto de máximo 420 px, siempre dentro del viewport. En orientación vertical estrecha puede usar pantalla completa.
- No escalar tipografía ni controles para hacer caber un desktop; reorganizar el contenido por breakpoint.

## Estados de producto obligatorios

| Estado | Experiencia esperada |
|---|---|
| Cargando | Skeleton o estado breve que conserve la estructura; sin saltos bruscos de layout. |
| Con datos | Métricas y listado sincronizados con los filtros activos. |
| Vacío | “Aún no has creado categorías de gasto”, explicación breve y CTA “Crear primera categoría”. |
| Sin resultados | Mensaje específico y acción “Limpiar filtros”; no confundirlo con una cuenta sin categorías. |
| Error de datos | Mensaje útil, sin perder lo escrito en el formulario. |
| Guardado | Toast discreto con `role="status"`; actualizar listado y devolver foco de forma predecible. |
| Nombre duplicado | Error asociado al campo y resumen de error; enfocar el primer campo inválido. |
| Confirmación | Dialog nativo o equivalente accesible que explique si se elimina o se inactiva. |

## Formulario de crear/editar

Orden de campos:

1. Nombre de categoría — obligatorio.
2. Descripción — opcional.
3. Deducible por defecto — control con texto explicativo.
4. Presupuesto mensual — opcional, USD.
5. Estado — visible al editar; una categoría nueva inicia activa.

Requisitos:

- Cada control tiene `<label>` real, ayuda asociada y error específico.
- El asterisco visual no reemplaza `required` ni la explicación de campos obligatorios.
- Guardar se bloquea durante el envío local para evitar dobles registros.
- Crear usa “Crear categoría”; editar usa “Guardar cambios”.
- Cancelar no modifica datos.
- El nombre ingresado se conserva si falla otra validación.

## Accesibilidad y UX

- Mantener contraste WCAG 2.2 AA: 4.5:1 para texto normal.
- Foco visible amber en todos los controles; no retirar `outline`.
- Deducible, estado y atención presupuestaria deben combinar texto, ícono y color.
- Añadir skip link y `<main id="main-content">` como en las pantallas existentes.
- Anunciar cantidad de resultados y cambios de filtros con una región `aria-live="polite"`.
- Toasts con `role="status"`; errores de formulario con `role="alert"`.
- Respetar `prefers-reduced-motion` en paneles, toasts y transiciones.
- Confirmar el orden de tabulación, el cierre con `Escape`, el trap de foco y la restitución de foco.
- El copy debe describir acciones reales del producto y evitar “demo”, “simulación”, “prototipo” o promesas fiscales.

## Integración con el producto actual

### Roles y navegación

- Agregar Categorías únicamente a la navegación del perfil `operational`.
- El perfil `administrative` continúa viendo solo Bitácora.
- Una URL directa a `categorias.html` sin perfil debe redirigir a Acceso.
- Una URL directa de administrador debe redirigir a Bitácora.
- Categorías no se agrega al bottom nav; se accede desde el menú lateral responsive.

### Datos y persistencia

- Usar datos iniciales del mock actual y persistencia local coherente con los módulos existentes.
- Definir una única fuente local para categorías; no duplicar registros entre mock, controlador y vistas.
- Derivar usos y gasto mensual desde Movimientos cuando estén disponibles.
- Si un movimiento referencia una categoría inexistente, mostrar una etiqueta segura (“Sin categoría”) sin romper la pantalla.
- Versionar o validar la forma almacenada para tolerar datos antiguos incompletos.

### Bitácora

Registrar solo acciones operativas significativas:

- ingreso al módulo;
- creación de categoría;
- edición de categoría;
- inactivación o eliminación confirmada;
- búsqueda únicamente cuando exista texto real, siguiendo la deduplicación actual.

No registrar cada tecla, apertura/cierre de panel, cambio de filtro sin efecto ni navegación administrativa.

## Archivos previstos

### Crear

- `pages/categorias.html` — estructura semántica, estados, tabla/tarjetas, formulario y confirmación.
- `assets/js/category-model.js` — normalización, validación y operaciones puras del dominio local.
- `assets/js/categorias.js` — render, filtros, persistencia, panel y eventos de interfaz.
- `tests/category-model.test.cjs` — reglas de nombre, presupuesto, duplicados, estado y referencias.

### Modificar

- `assets/js/app-shell.js` — navegación operativa, ícono y protección de ruta.
- `assets/css/app.css` — estilos del módulo y breakpoints; después regenerar `assets/css/styles.css` con el comando existente.
- `assets/data/mock-data.json` — categorías iniciales únicamente si no existe una fuente canónica reutilizable.
- `assets/js/activity-log.js` — solo si necesita reconocer el módulo o nuevas acciones explícitas.
- `package.json` — incluir nuevos scripts en `validate` si el patrón actual los enumera.
- Tests existentes de navegación, encoding y validación — ampliar sin duplicar cobertura.
- `README.md` — actualizar el estado del módulo cuando la implementación haya sido validada, no antes.

No crear dependencias, frameworks, un design system paralelo ni abstracciones genéricas para una sola pantalla.

## Orden de implementación

1. **RED:** escribir pruebas de modelo y navegación que fallen por la funcionalidad faltante.
2. **GREEN:** implementar el modelo mínimo y agregar Categorías al shell operativo y a sus guards.
3. Crear el HTML semántico reutilizando slots y patrones de Clientes.
4. Implementar estilos desktop-first del contenido y luego adaptar tablet/móvil sin anchos fijos.
5. Conectar render, filtros, formulario, confirmación y persistencia.
6. Integrar únicamente los eventos útiles de Bitácora.
7. Regenerar CSS y ejecutar validaciones estáticas/unitarias.
8. Validar en navegador como usuario final en PC, tablet y móvil antes de considerar el módulo terminado.

## Matriz de validación

### Automatizada

- [ ] Categorías aparece para operativo y no para administrativo.
- [ ] Los guards protegen acceso sin perfil y acceso administrativo directo.
- [ ] Crear y editar validan nombre obligatorio, duplicado y presupuesto.
- [ ] Una categoría usada no se elimina físicamente.
- [ ] Filtros y métricas usan la misma fuente de datos.
- [ ] Datos antiguos o incompletos no rompen el render.
- [ ] HTML/JS nuevos no contienen mojibake.
- [ ] `npm run validate`, `npm test`, validación JSON y `git diff --check` pasan.

### Navegador — usuario final

- [ ] Operativo abre Categorías desde el sidebar desktop y desde el menú móvil.
- [ ] Administrador no ve ni puede abrir Categorías.
- [ ] Crear, editar, cancelar, inactivar y eliminar producen resultados comprensibles.
- [ ] Búsqueda, filtros, vacío y sin resultados se distinguen correctamente.
- [ ] Tabla desktop y tarjetas móviles muestran la misma información esencial.
- [ ] 1440 × 900: sin superposición ni contenido cortado.
- [ ] 768 × 1024: sin lienzo desktop escalado ni drawer fuera del viewport.
- [ ] 390 × 844 y 320 × 568: sin scroll horizontal, FAB solapado ni contenido bajo el bottom nav.
- [ ] Flujo completo realizable con teclado y foco visible.
- [ ] Consola del navegador sin errores.

## Criterio de aprobación antes de codear

La implementación puede comenzar cuando se confirme este handoff como fuente de verdad. No hace falta una cuarta iteración de Stitch: las correcciones pendientes son de integración, responsive real, reglas de dominio y accesibilidad, y deben resolverse directamente contra el código y los patrones actuales de FreelanceFlow.
