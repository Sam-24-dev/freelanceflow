# FreelanceFlow — Catálogo de Elementos Visuales del Frontend (v1)

## Nota metodológica

Este catálogo se construye sobre dos bases ya cerradas en este proyecto: (1) las entidades y campos definidos en `FreelanceFlow_Catalogo_Formularios_v1.md` (Cliente, Servicio, Propuesta, Proyecto, Factura, Pago, Gasto, Registro de tiempo, Presupuesto), y (2) los puntos de dolor descritos explícitamente en el enunciado del problema (sección 1 del Context Pack v3): pérdida de control sobre facturas vencidas, incapacidad de proyectar flujo de caja, imposibilidad de calcular rentabilidad real por proyecto, confusión entre finanzas personales y de negocio.

Cada elemento visual indica su origen:
- **[Regla cerrada]** — la información o el dato proviene directamente de una regla de negocio, máquina de estado o campo ya definido.
- **[Derivado]** — es un cálculo o agregación sobre datos ya definidos (ej. "saldo pendiente" = total_factura − pagos registrados). No es un dato nuevo, es una vista de datos existentes.
- **[Propuesta]** — es una decisión de presentación (tipo de gráfico, agrupación) no confirmada explícitamente en el documento.

No se inventó contenido para P-34, P-35 y P-36: el Context Pack solo los etiqueta como "fiscal y otros reportes relacionados" sin especificar su alcance. Quedan señalados como pendientes en la sección final.

---

## Índice

| Código | Elemento | Pantalla | Tipo |
|---|---|---|---|
| VIS-001 | Saldo Pendiente por Cobrar | P-08 | Tarjeta |
| VIS-002 | Facturas Vencidas | P-08 | Tarjeta |
| VIS-003 | Ingresos del Período | P-08 | Tarjeta |
| VIS-004 | Gastos del Período | P-08 | Tarjeta |
| VIS-005 | Flujo de Caja Neto | P-08 | Tarjeta |
| VIS-006 | Facturas Próximas a Vencer | P-08 | Tabla |
| VIS-007 | Accesos Rápidos | P-08 | Lista |
| VIS-008 | Listado de Clientes | P-09 | Tabla |
| VIS-009 | Saldo Pendiente del Cliente | P-11 | Tarjeta |
| VIS-010 | Propuestas del Cliente | P-11 | Tabla |
| VIS-011 | Proyectos del Cliente | P-11 | Tabla |
| VIS-012 | Facturas del Cliente | P-11 | Tabla |
| VIS-013 | Catálogo de Servicios | P-12 | Tabla |
| VIS-014 | Listado de Propuestas | P-13 | Tabla |
| VIS-015 | Ítems de la Propuesta | P-15 | Tabla |
| VIS-016 | Total de Propuesta | P-15 | Tarjeta |
| VIS-017 | Listado de Proyectos | P-16 | Tabla |
| VIS-018 | Horas Registradas (Proyecto) | P-18 | Tarjeta |
| VIS-019 | Monto Facturado / Pagado (Proyecto) | P-18 | Tarjeta |
| VIS-020 | Rentabilidad del Proyecto | P-18 | Tarjeta |
| VIS-021 | Registro de Tiempo del Proyecto | P-18 | Tabla |
| VIS-022 | Facturas del Proyecto | P-18 | Tabla |
| VIS-023 | Gastos del Proyecto | P-18 | Tabla |
| VIS-024 | Registro de Tiempo (vista general) | P-19 | Tabla |
| VIS-025 | Listado de Facturas | P-20 | Tabla |
| VIS-026 | Ítems de Factura | P-22 | Tabla |
| VIS-027 | Total / Saldo Pendiente (Factura) | P-22 | Tarjeta |
| VIS-028 | Historial de Pagos | P-22 | Tabla |
| VIS-029 | Resumen de Factura (Cliente Externo) | P-23 | Tarjeta |
| VIS-030 | Listado de Gastos | P-24 | Tabla |
| VIS-031 | Progreso de Meta de Ingresos | P-26 | Tarjeta |
| VIS-032 | Progreso por Categoría de Gasto | P-26 | Tabla |
| VIS-033 | Acceso a Reportes | P-27 | Tarjetas |
| VIS-034 | Ingresos por Cliente/Período | P-28 | Tabla |
| VIS-035 | Gastos por Categoría | P-29 | Tabla |
| VIS-036 | Flujo de Caja (detalle) | P-30 | Gráfico+Tabla |
| VIS-037 | Rentabilidad por Proyecto | P-31 | Tabla |
| VIS-038 | Pérdidas y Ganancias | P-32 | Tabla |
| VIS-039 | Cuentas por Cobrar | P-33 | Tabla |
| VIS-040 | Notificaciones | P-37 | Lista |

---

## Bloque A — Dashboard (P-08)

### VIS-001 — Tarjeta de Saldo Pendiente por Cobrar
**Tipo:** Tarjeta de métrica
**Datos exactos:** Suma de (total_factura − monto_pagado_acumulado) de todas las facturas en estado SENT, PARTIAL u OVERDUE [Derivado de reglas de Factura].
**Acciones:** Click → navega a P-20 filtrado por esos tres estados.
**Empty state:** "Aún no tienes facturas pendientes de cobro."

### VIS-002 — Tarjeta de Facturas Vencidas
**Tipo:** Tarjeta de métrica (alerta)
**Datos exactos:** Conteo de facturas en estado OVERDUE + suma de su saldo pendiente [Regla cerrada: transición a OVERDUE por vencimiento con saldo pendiente].
**Acciones:** Click → navega a P-20 filtrado por OVERDUE.
**Empty state:** "No tienes facturas vencidas." (estado positivo)

### VIS-003 — Tarjeta de Ingresos del Período
**Tipo:** Tarjeta de métrica
**Datos exactos:** Suma de monto_pagado registrado en el período seleccionado (mes en curso por defecto) [Derivado de pagos registrados].
**Acciones:** Selector de período; click → navega a P-28.
**Empty state:** "Aún no registras ingresos en este período."

### VIS-004 — Tarjeta de Gastos del Período
**Tipo:** Tarjeta de métrica
**Datos exactos:** Suma de monto de gastos en el período seleccionado.
**Acciones:** Selector de período; click → navega a P-29.
**Empty state:** "Aún no registras gastos en este período."

### VIS-005 — Tarjeta de Flujo de Caja Neto
**Tipo:** Tarjeta de métrica
**Datos exactos:** Ingresos del período − Gastos del período [Derivado, atiende directamente el dolor "incapacidad de proyectar flujo de caja" del enunciado del problema].
**Acciones:** Click → navega a P-30.
**Empty state:** "Registra tu primera factura o gasto para ver tu flujo de caja."

### VIS-006 — Tabla de Facturas Próximas a Vencer
**Tipo:** Tabla resumen (máx. 5–10 filas)
**Datos exactos por fila:** numero_factura, cliente, fecha_vencimiento, saldo_pendiente, estado (badge de color según estado).
**Acciones:** Click en fila → P-22; link "Ver todas" → P-20.
**Empty state:** "No tienes facturas próximas a vencer."

### VIS-007 — Lista de Accesos Rápidos
**Tipo:** Lista de botones [Regla cerrada: la imagen del diagrama de navegación confirma "Accesos rápidos" en P-08]
**Datos exactos:** Nuevo cliente, Nueva propuesta, Nuevo proyecto, Nueva factura, Nuevo gasto, Registrar tiempo.
**Acciones:** Cada ítem navega al formulario de creación correspondiente (FRM-010, FRM-012, FRM-013, FRM-015, FRM-019, FRM-014).
**Empty state:** No aplica (siempre visible).

---

## Bloque B — Clientes (P-09, P-11)

### VIS-008 — Tabla de Clientes
**Pantalla:** P-09
**Tipo:** Tabla
**Datos exactos por fila:** nombre_razon_social, tipo_cliente, identificacion_fiscal, correo_electronico, telefono, saldo_pendiente [Derivado].
**Acciones:** Ver detalle (→P-11), Editar (→FRM-010), Eliminar (con confirmación).
**Empty state:** "Aún no has registrado clientes."

### VIS-009 — Tarjeta de Saldo Pendiente del Cliente
**Pantalla:** P-11
**Tipo:** Tarjeta de métrica
**Datos exactos:** Suma de saldo pendiente de las facturas de ese cliente [Derivado].
**Acciones:** Click → P-20 filtrado por ese cliente.
**Empty state:** "Este cliente no tiene saldo pendiente."

### VIS-010 — Tabla de Propuestas del Cliente
**Pantalla:** P-11
**Tipo:** Tabla
**Datos exactos por fila:** titulo_propuesta, fecha_emision, total_propuesta, estado (badge).
**Acciones:** Ver detalle (→P-15), botón "Nueva propuesta para este cliente".
**Empty state:** "Aún no has enviado propuestas a este cliente."

### VIS-011 — Tabla de Proyectos del Cliente
**Pantalla:** P-11
**Tipo:** Tabla
**Datos exactos por fila:** nombre_proyecto, estado (badge), fecha_inicio, modalidad_cobro.
**Acciones:** Ver detalle (→P-18).
**Empty state:** "Este cliente no tiene proyectos registrados."

### VIS-012 — Tabla de Facturas del Cliente
**Pantalla:** P-11
**Tipo:** Tabla
**Datos exactos por fila:** numero_factura, fecha_emision, total_factura, saldo_pendiente, estado (badge).
**Acciones:** Ver detalle (→P-22).
**Empty state:** "Este cliente no tiene facturas emitidas."

---

## Bloque C — Servicios (P-12)

### VIS-013 — Tabla de Catálogo de Servicios
**Tipo:** Tabla
**Datos exactos por fila:** nombre_servicio, unidad_medida, tarifa_unitaria, moneda.
**Acciones:** Editar (→FRM-011), Eliminar.
**Empty state:** "Aún no has creado servicios en tu catálogo."

---

## Bloque D — Propuestas (P-13, P-15)

### VIS-014 — Tabla de Listado de Propuestas
**Pantalla:** P-13
**Tipo:** Tabla
**Datos exactos por fila:** cliente, titulo_propuesta, fecha_emision, fecha_validez, total_propuesta, estado (badge) [Regla cerrada: estados DRAFT/SENT/ACCEPTED/REJECTED/EXPIRED/CONVERTED].
**Acciones:** Ver detalle, Editar (solo si DRAFT), Enviar, Eliminar (solo si DRAFT).
**Empty state:** "Aún no has creado propuestas."

### VIS-015 — Tabla de Ítems de la Propuesta
**Pantalla:** P-15
**Tipo:** Tabla
**Datos exactos por fila:** descripcion_item, cantidad, precio_unitario, subtotal_item.
**Acciones:** Ninguna en modo lectura (edición vía FRM-012 si está en DRAFT).
**Empty state:** No aplica — una propuesta siempre tiene al menos 1 ítem [Regla cerrada].

### VIS-016 — Tarjeta de Total de Propuesta
**Pantalla:** P-15
**Tipo:** Tarjeta de métrica
**Datos exactos:** subtotal_general, descuento, total_propuesta, estado (badge), fecha_validez (con alerta visual si está próxima a EXPIRED).
**Acciones:** Enviar, Marcar Aceptada/Rechazada, Convertir a proyecto (solo si ACCEPTED) [Regla cerrada: ACCEPTED → CONVERTED].
**Empty state:** No aplica.

---

## Bloque E — Proyectos y Tiempo (P-16, P-18, P-19)

### VIS-017 — Tabla de Listado de Proyectos
**Pantalla:** P-16
**Tipo:** Tabla
**Datos exactos por fila:** nombre_proyecto, cliente, estado (badge), fecha_inicio, modalidad_cobro.
**Acciones:** Ver detalle, Editar, Cambiar estado (transiciones según máquina de estados).
**Empty state:** "Aún no tienes proyectos."

### VIS-018 — Tarjeta de Horas Registradas
**Pantalla:** P-18
**Tipo:** Tarjeta de métrica
**Datos exactos:** Suma de horas_trabajadas del proyecto vs presupuesto_horas_estimado (si fue definido en FRM-013).
**Acciones:** Click → tabla completa (VIS-021).
**Empty state:** "Aún no se ha registrado tiempo en este proyecto."

### VIS-019 — Tarjeta de Monto Facturado / Pagado
**Pantalla:** P-18
**Tipo:** Tarjeta de métrica
**Datos exactos:** Suma de total_factura de las facturas del proyecto, y suma de monto_pagado correspondiente [Derivado].
**Acciones:** Click → tabla de facturas del proyecto (VIS-022).
**Empty state:** "Aún no se han emitido facturas para este proyecto."

### VIS-020 — Tarjeta de Rentabilidad del Proyecto
**Pantalla:** P-18
**Tipo:** Tarjeta de métrica
**Datos exactos:** (Monto facturado del proyecto − gastos asociados al proyecto), en monto y en margen % [Derivado, atiende directamente el dolor "imposibilidad de calcular rentabilidad real por proyecto" del enunciado del problema].
**Acciones:** Click → P-31 filtrado por ese proyecto.
**Empty state:** "No hay suficiente información para calcular la rentabilidad de este proyecto."

### VIS-021 — Tabla de Registro de Tiempo del Proyecto
**Pantalla:** P-18
**Tipo:** Tabla
**Datos exactos por fila:** fecha_trabajo, horas_trabajadas, descripcion_actividad, facturable.
**Acciones:** Editar, Eliminar (solo si aún no facturado), botón "Nuevo registro" (→FRM-014).
**Empty state:** "Aún no has registrado tiempo en este proyecto."

### VIS-022 — Tabla de Facturas del Proyecto
**Pantalla:** P-18
**Tipo:** Tabla
**Datos exactos por fila:** numero_factura, fecha_emision, total_factura, estado (badge).
**Acciones:** Ver detalle (→P-22).
**Empty state:** "Este proyecto no tiene facturas asociadas."

### VIS-023 — Tabla de Gastos del Proyecto
**Pantalla:** P-18
**Tipo:** Tabla
**Datos exactos por fila:** fecha_gasto, categoria_gasto, monto, es_deducible.
**Acciones:** Ver detalle, botón "Nuevo gasto" asociado al proyecto.
**Empty state:** "Este proyecto no tiene gastos asociados."

### VIS-024 — Tabla de Registro de Tiempo (vista general)
**Pantalla:** P-19
**Tipo:** Tabla
**Datos exactos por fila:** proyecto, fecha_trabajo, horas_trabajadas, descripcion_actividad, facturable.
**Acciones:** Editar, Eliminar, Filtrar por proyecto/período.
**Empty state:** "Aún no has registrado tiempo trabajado."

---

## Bloque F — Facturación (P-20, P-22)

### VIS-025 — Tabla de Listado de Facturas
**Pantalla:** P-20
**Tipo:** Tabla
**Datos exactos por fila:** numero_factura, cliente, fecha_emision, fecha_vencimiento, total_factura, saldo_pendiente, estado (badge) [Regla cerrada: DRAFT/SENT/PARTIAL/PAID/OVERDUE/VOID].
**Acciones:** Ver detalle, Editar (solo DRAFT), Enviar, Registrar pago, Anular, Descargar PDF.
**Empty state:** "Aún no has emitido facturas."

### VIS-026 — Tabla de Ítems de Factura
**Pantalla:** P-22
**Tipo:** Tabla
**Datos exactos por fila:** descripcion_item, cantidad, precio_unitario, subtotal_item.
**Acciones:** Ninguna en modo lectura.
**Empty state:** No aplica — regla cerrada de integridad aritmética obliga ≥1 ítem.

### VIS-027 — Tarjeta de Total / Saldo Pendiente
**Pantalla:** P-22
**Tipo:** Tarjeta de métrica
**Datos exactos:** total_factura, monto_pagado_acumulado, saldo_pendiente, estado (badge), fecha_vencimiento (alerta visual si OVERDUE).
**Acciones:** Registrar pago, Anular (deshabilitado si PAID) [Regla cerrada], Descargar PDF, Copiar enlace del portal cliente externo.
**Empty state:** No aplica.

### VIS-028 — Tabla de Historial de Pagos
**Pantalla:** P-22
**Tipo:** Tabla
**Datos exactos por fila:** fecha_pago, monto_pagado, metodo_pago, referencia_comprobante.
**Acciones:** Ver comprobante adjunto (si existe).
**Empty state:** "Aún no se han registrado pagos para esta factura."

---

## Bloque G — Portal Cliente Externo (P-23)

### VIS-029 — Tarjeta de Resumen de Factura
**Tipo:** Tarjeta (vista limitada, sin navegación)
**Datos exactos:** numero_factura, fecha_emision, fecha_vencimiento, total_factura, saldo_pendiente, estado (badge). **No debe mostrar información fiscal ni interna del freelancer** [Regla cerrada: el Cliente Externo solo ve la factura vinculada].
**Acciones:** Descargar PDF, Notificar pago (visible solo si el freelancer lo habilitó).
**Empty state:** No aplica — si el token es inválido o expiró, se muestra un mensaje de error de acceso, no un empty state de datos.

---

## Bloque H — Gastos (P-24)

### VIS-030 — Tabla de Listado de Gastos
**Tipo:** Tabla
**Datos exactos por fila:** fecha_gasto, categoria_gasto, monto, proyecto_relacionado, es_deducible.
**Acciones:** Editar, Eliminar, Filtrar por categoría/período.
**Empty state:** "Aún no has registrado gastos."

---

## Bloque I — Presupuesto y Metas (P-26)

### VIS-031 — Tarjeta de Progreso de Meta de Ingresos
**Tipo:** Tarjeta de métrica con barra de progreso
**Datos exactos:** meta_ingresos definida vs ingresos reales del período, % de avance.
**Acciones:** Editar meta (→FRM-020).
**Empty state:** "Aún no has definido una meta de ingresos para este período."

### VIS-032 — Tabla de Progreso por Categoría de Gasto
**Tipo:** Tabla con barra de progreso por fila
**Datos exactos por fila:** categoria_gasto, limite_definido, gasto_real, % consumido.
**Acciones:** Editar límites (→FRM-020).
**Empty state:** "No has definido límites de gasto por categoría."

---

## Bloque J — Reportes (P-27 a P-36)

### VIS-033 — Tarjetas de Acceso a Reportes
**Pantalla:** P-27
**Tipo:** Tarjetas de navegación
**Datos exactos:** nombre del reporte (Ingresos, Gastos, Flujo de caja, Rentabilidad, Pérdidas y ganancias, Cuentas por cobrar, Fiscal).
**Acciones:** Click → navega al reporte correspondiente.
**Empty state:** No aplica (accesos fijos).

### VIS-034 — Tabla de Ingresos por Cliente/Período
**Pantalla:** P-28
**Tipo:** Tabla [Propuesta: agrupación por cliente y por período no confirmada en el documento, pero es la forma estándar de presentar este reporte]
**Datos exactos por fila:** cliente o período, monto_ingreso, % del total.
**Acciones:** Aplicar filtros (FRM-021), Exportar.
**Empty state:** "No hay ingresos registrados en el período seleccionado."

### VIS-035 — Tabla de Gastos por Categoría
**Pantalla:** P-29
**Tipo:** Tabla [Propuesta]
**Datos exactos por fila:** categoria_gasto, monto_total, % deducible.
**Acciones:** Aplicar filtros, Exportar.
**Empty state:** "No hay gastos registrados en el período seleccionado."

### VIS-036 — Flujo de Caja (detalle)
**Pantalla:** P-30
**Tipo:** Gráfico + tabla de detalle [Propuesta: el tipo de gráfico (línea/barras) no está confirmado en el documento]
**Datos exactos:** ingresos vs gastos por período, saldo acumulado [Derivado, atiende el dolor central de "proyección de flujo de caja"].
**Acciones:** Aplicar filtros, Exportar.
**Empty state:** "No hay movimientos registrados para calcular el flujo de caja en este período."

### VIS-037 — Tabla de Rentabilidad por Proyecto
**Pantalla:** P-31
**Tipo:** Tabla
**Datos exactos por fila:** nombre_proyecto, monto_facturado, gastos_asociados, horas_invertidas, rentabilidad_neta, margen_porcentual [Derivado].
**Acciones:** Ver detalle del proyecto, Aplicar filtros, Exportar.
**Empty state:** "No hay proyectos con datos suficientes para calcular rentabilidad."

### VIS-038 — Tabla de Pérdidas y Ganancias
**Pantalla:** P-32
**Tipo:** Tabla tipo estado financiero
**Datos exactos:** ingresos_totales, gastos_totales (desagregado por categoría), resultado_neto, comparativo por período.
**Acciones:** Aplicar filtros, Exportar.
**Empty state:** "No hay suficiente información financiera para generar el estado de pérdidas y ganancias."

### VIS-039 — Tabla de Cuentas por Cobrar
**Pantalla:** P-33
**Tipo:** Tabla
**Datos exactos por fila:** cliente, numero_factura, saldo_pendiente, dias_vencido (si aplica), estado (badge).
**Acciones:** Ver factura, Aplicar filtros, Exportar.
**Empty state:** "No tienes cuentas por cobrar pendientes."

**P-34, P-35, P-36** — Sin contenido definido. El Context Pack v3 solo los etiqueta como "fiscal y otros reportes relacionados" sin especificar su alcance funcional. No se propone contenido para evitar inventar datos no respaldados por el catálogo RF.

---

## Bloque K — Notificaciones (P-37)

### VIS-040 — Lista de Notificaciones
**Tipo:** Lista
**Datos exactos por fila:** tipo_notificacion (ícono), mensaje, fecha, leido (booleano, afecta estilo visual de la fila).
**Acciones:** Marcar como leída, Ir a la entidad relacionada, Marcar todas como leídas.
**Empty state:** "No tienes notificaciones nuevas."

---

## Notas abiertas — requieren tu validación

1. **P-34, P-35, P-36** no tienen contenido funcional confirmado en el documento. Necesito que definas qué reportes son exactamente (¿reporte fiscal estimado, declaración de impuestos, comparativo anual?) antes de poder especificar sus tablas/tarjetas.
2. **Tipo de visualización en reportes (P-28 a P-31)**: propuse tabla como base y gráfico complementario en Flujo de Caja, pero el documento no confirma si se espera visualización gráfica (líneas, barras) en todos los reportes o solo en algunos. Esto también condiciona el esfuerzo de frontend simulado en Fase 1.
3. **Multi-moneda**: igual que en el catálogo de formularios, varias tarjetas de métrica (saldo, ingresos, gastos) asumen una moneda consolidada. Si el sistema soporta múltiples monedas simultáneas, estas tarjetas requieren lógica adicional de conversión o segmentación que aún no está definida.

---

## Actualizaci?n acad?mica obligatoria ? Elementos visuales del M?dulo Clientes (Fase 1)

### VIS-008A ? Gesti?n de Clientes
**Pantalla:** `clientes.html`  
**Tipo:** Formulario + tabla + panel de detalle.

**Datos exactos por cliente:** `id`, `nombre_razon_social`, `tipo_cliente`, `nombres`, `apellidos`, `identificacion`, `telefono`, `celular`, `correo`, `direccion`, `estadoCivil`, `estado`, `fecha_registro`.

**Acciones disponibles:**
- Registrar cliente.
- Listar clientes.
- Buscar por nombres, apellidos o identificaci?n.
- Consultar detalle.
- Editar cliente.
- Cambiar estado civil.
- Cambiar estado activo/inactivo.

**Empty states:**
- Sin clientes: "A?n no has registrado clientes."
- Sin resultados de b?squeda: "No encontramos clientes con ese criterio."
- Sin selecci?n de detalle: "Selecciona un cliente para consultar su detalle."

