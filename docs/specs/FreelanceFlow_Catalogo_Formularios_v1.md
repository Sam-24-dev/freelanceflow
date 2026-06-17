# FreelanceFlow — Catálogo de Formularios del Frontend (v1)

## Nota metodológica

Este catálogo deriva de dos fuentes: (1) las pantallas oficiales definidas en la sección 5.1 del Context Pack v3 (las que indican explícitamente "Crear/Editar" generan formulario directo), y (2) las reglas de negocio y máquinas de estado ya cerradas (integridad aritmética de facturas, pagos parciales/en exceso, gastos deducibles, restricciones por período cerrado, etc.), que determinan validaciones obligatorias.

El catálogo RF-001 a RF-098 existe pero su detalle campo por campo no está disponible en este contexto. Por lo tanto, los campos de cada formulario se dividen en dos categorías que se marcan explícitamente:

- **[Regla cerrada]** — el campo o validación se deriva directamente de una regla de negocio o estado ya definido en el Context Pack.
- **[Propuesta]** — el campo o validación es un criterio de diseño razonable para el dominio fintech-freelance, pero no está confirmado en el catálogo RF y debe validarse contra él antes de implementarse.

No se incluyen formularios para pantallas de solo listado/detalle (P-09, P-11, P-16, P-18, P-20, P-24, P-27) porque no capturan datos nuevos; reutilizan los formularios de creación/edición de su misma entidad. P-08 (Dashboard) no tiene formulario propio.

---

## Índice de formularios

| Código | Nombre | Pantalla |
|---|---|---|
| FRM-001 | Registro de Usuario | P-01 |
| FRM-002 | Inicio de Sesión | P-02 |
| FRM-003 | Solicitud de Recuperación de Clave | P-03 |
| FRM-004 | Definición de Nueva Contraseña | P-03 |
| FRM-005 | Edición de Perfil | P-04 |
| FRM-006 | Cambio de Contraseña | P-04 |
| FRM-007 | Configuración Fiscal | P-05 |
| FRM-008 | Ajustes de Facturación | P-06 |
| FRM-009 | Categoría de Gasto (Crear/Editar) | P-07 |
| FRM-010 | Cliente (Crear/Editar) | P-10 |
| FRM-011 | Servicio (Crear/Editar) | P-12 |
| FRM-012 | Propuesta (Crear/Editar) | P-14 |
| FRM-013 | Proyecto (Crear/Editar) | P-17 |
| FRM-014 | Registro de Tiempo | P-19 |
| FRM-015 | Factura (Crear/Editar) | P-21 |
| FRM-016 | Registro de Pago de Factura | P-22 |
| FRM-017 | Anulación de Factura (VOID) | P-22 |
| FRM-018 | Notificación de Pago (Cliente Externo) | P-23 |
| FRM-019 | Gasto (Crear/Editar) | P-25 |
| FRM-020 | Presupuesto y Metas | P-26 |
| FRM-021 | Filtros de Reporte (componente reutilizable) | P-28 a P-36 |
| FRM-022 | Preferencias de Notificaciones | P-37 |

---

## Bloque A — Autenticación y Cuenta

### FRM-001 — Registro de Usuario
**Pantalla:** P-01
**Objetivo:** Crear la cuenta del freelancer y dar acceso inicial al sistema.

| Campo | Tipo | Obligatorio | Origen |
|---|---|---|---|
| nombre_completo | text | Sí | Propuesta |
| correo_electronico | email | Sí | Propuesta |
| contrasena | password | Sí | Propuesta |
| confirmar_contrasena | password | Sí | Propuesta |
| pais_residencia | select | Sí | Propuesta (necesario para configuración fiscal posterior) |
| acepto_terminos | checkbox | Sí | Propuesta |

**Botones:** "Crear cuenta" (primario) · "Iniciar sesión" (link a P-02)

**Validaciones cliente:**
- Nombre no vacío, mínimo 3 caracteres.
- Correo con formato válido.
- Contraseña mínimo 8 caracteres con al menos 1 número [Propuesta — validar contra RNF de seguridad].
- confirmar_contrasena debe ser idéntico a contrasena.
- acepto_terminos debe estar marcado.

**Mensajes:**
- Error: "Este campo es obligatorio."
- Error: "Ingresa un correo electrónico válido."
- Error: "La contraseña debe tener al menos 8 caracteres e incluir un número."
- Error: "Las contraseñas no coinciden."
- Error (simulado, correo duplicado): "Ya existe una cuenta registrada con este correo."
- Confirmación: "Cuenta creada correctamente."

---

### FRM-002 — Inicio de Sesión
**Pantalla:** P-02
**Objetivo:** Autenticar al freelancer y otorgar acceso al sistema.

| Campo | Tipo | Obligatorio |
|---|---|---|
| correo_electronico | email | Sí |
| contrasena | password | Sí |
| recordarme | checkbox | No |

**Botones:** "Iniciar sesión" (primario) · "¿Olvidaste tu clave?" (link a P-03) · "Crear cuenta" (link a P-01)

**Validaciones cliente:**
- Ambos campos obligatorios.
- Formato de correo válido.

**Mensajes:**
- Error: "Correo o contraseña incorrectos." (mensaje genérico, no especifica cuál campo falló — buena práctica de seguridad)
- Error: "Debes completar todos los campos."

---

### FRM-003 — Solicitud de Recuperación de Clave
**Pantalla:** P-03 (paso 1)
**Objetivo:** Iniciar el proceso de recuperación enviando un enlace al correo registrado.

| Campo | Tipo | Obligatorio |
|---|---|---|
| correo_electronico | email | Sí |

**Botones:** "Enviar enlace de recuperación" · "Volver a inicio de sesión" (link)

**Validaciones cliente:**
- Formato de correo válido, campo no vacío.

**Mensajes:**
- Error: "Ingresa un correo electrónico válido."
- Confirmación: "Si el correo existe en nuestro sistema, recibirás un enlace de recuperación en breve." (mensaje neutro, no confirma existencia de cuenta)

---

### FRM-004 — Definición de Nueva Contraseña
**Pantalla:** P-03 (paso 2, vía enlace tokenizado)
**Objetivo:** Permitir definir una nueva contraseña tras validar el enlace de recuperación.

| Campo | Tipo | Obligatorio |
|---|---|---|
| nueva_contrasena | password | Sí |
| confirmar_nueva_contrasena | password | Sí |

**Botones:** "Guardar nueva contraseña"

**Validaciones cliente:**
- Mínimo 8 caracteres, al menos 1 número.
- Ambos campos deben coincidir.

**Mensajes:**
- Error: "Las contraseñas no coinciden."
- Error (simulado): "El enlace de recuperación ha expirado. Solicita uno nuevo."
- Confirmación: "Tu contraseña fue actualizada correctamente."

---

### FRM-005 — Edición de Perfil
**Pantalla:** P-04
**Objetivo:** Actualizar datos personales y de contacto del freelancer.

| Campo | Tipo | Obligatorio |
|---|---|---|
| nombre_completo | text | Sí |
| correo_electronico | email | Sí |
| telefono | text | No |
| foto_perfil | file (image) | No |
| pais_residencia | select | Sí |

**Botones:** "Guardar cambios" · "Cancelar"

**Validaciones cliente:**
- Nombre no vacío.
- Correo con formato válido.
- foto_perfil: solo JPG/PNG, máximo 5MB [Propuesta].

**Mensajes:**
- Error: "Ingresa un correo electrónico válido."
- Error: "El archivo debe ser JPG o PNG de máximo 5MB."
- Confirmación: "Perfil actualizado correctamente."

---

### FRM-006 — Cambio de Contraseña
**Pantalla:** P-04 (sección dentro del perfil)
**Objetivo:** Cambiar la contraseña estando autenticado, verificando la clave actual.

| Campo | Tipo | Obligatorio |
|---|---|---|
| contrasena_actual | password | Sí |
| nueva_contrasena | password | Sí |
| confirmar_nueva_contrasena | password | Sí |

**Botones:** "Actualizar contraseña"

**Validaciones cliente:**
- Contraseña actual no vacía.
- Nueva contraseña cumple política (≥8 caracteres, 1 número).
- nueva_contrasena ≠ contrasena_actual.
- Confirmación coincide.

**Mensajes:**
- Error (simulado): "La contraseña actual es incorrecta."
- Error: "La nueva contraseña no puede ser igual a la actual."
- Confirmación: "Contraseña actualizada correctamente."

---

### FRM-007 — Configuración Fiscal
**Pantalla:** P-05
**Objetivo:** Definir los parámetros usados en el cálculo fiscal estimado **[Regla cerrada: existe como regla de negocio]** y en la facturación.

| Campo | Tipo | Obligatorio |
|---|---|---|
| identificacion_fiscal | text | Sí |
| regimen_tributario | select | Sí |
| porcentaje_retencion_estimado | number (%) | Sí |
| aplica_impuesto_valor_agregado | boolean | Sí |
| porcentaje_impuesto | number (%) | Condicional (visible si aplica_impuesto = true) |

**Botones:** "Guardar configuración fiscal"

**Validaciones cliente:**
- identificacion_fiscal no vacía.
- Ambos porcentajes entre 0 y 100.

**Mensajes:**
- Error: "El porcentaje debe estar entre 0 y 100."
- Error: "La identificación fiscal es obligatoria."
- Confirmación: "Configuración fiscal guardada. Estos valores se usarán en el cálculo fiscal estimado."

⚠️ **[Propuesta completa]** — el documento solo confirma que existe la regla "cálculo fiscal estimado"; los campos exactos no están en el catálogo RF compartido. Validar antes de construir.

---

### FRM-008 — Ajustes de Facturación
**Pantalla:** P-06
**Objetivo:** Configurar parámetros por defecto aplicados al crear nuevas facturas.

| Campo | Tipo | Obligatorio |
|---|---|---|
| prefijo_numeracion | text | No |
| siguiente_numero_factura | number | Sí |
| moneda_predeterminada | select | Sí |
| dias_vencimiento_predeterminado | number | Sí |
| texto_condiciones_pago | textarea | No |
| logo_empresa | file (image) | No |

**Botones:** "Guardar ajustes"

**Validaciones cliente:**
- siguiente_numero_factura: entero positivo.
- dias_vencimiento_predeterminado: entero ≥ 1.
- logo_empresa: JPG/PNG, máximo 5MB.

**Mensajes:**
- Error: "El número de factura debe ser un entero positivo."
- Error: "Los días de vencimiento deben ser mayores a 0."
- Confirmación: "Ajustes de facturación guardados correctamente."

---

### FRM-009 — Categoría de Gasto (Crear/Editar)
**Pantalla:** P-07
**Objetivo:** Administrar el catálogo de categorías de gasto, incluyendo si son deducibles por defecto **[Regla cerrada: gastos deducibles]**.

| Campo | Tipo | Obligatorio |
|---|---|---|
| nombre_categoria | text | Sí |
| descripcion | textarea | No |
| es_deducible_por_defecto | boolean | Sí |

**Botones:** "Guardar categoría" · "Eliminar categoría" (con confirmación, solo en edición)

**Validaciones cliente:**
- Nombre no vacío, mínimo 3 caracteres.
- Nombre no duplicado en el catálogo del usuario.

**Mensajes:**
- Error: "Ya existe una categoría con este nombre."
- Error: "El nombre de la categoría es obligatorio."
- Confirmación: "Categoría guardada correctamente."
- Confirmación (eliminación): "Categoría eliminada. Los gastos existentes mantendrán su categoría histórica." [Regla cerrada: consistencia de historial]

---

## Bloque B — Clientes y Servicios

### FRM-010 — Cliente (Crear/Editar)
**Pantalla:** P-10
**Objetivo:** Registrar o actualizar los datos de un cliente al que se le emitirán propuestas y facturas.

| Campo | Tipo | Obligatorio |
|---|---|---|
| nombre_razon_social | text | Sí |
| tipo_cliente | select (Persona natural / Empresa) | Sí |
| identificacion_fiscal | text | Sí |
| correo_electronico | email | Sí |
| telefono | text | No |
| direccion | text | No |
| pais | select | Sí |
| notas_internas | textarea | No |

**Botones:** "Guardar cliente" · "Cancelar"

**Validaciones cliente:**
- nombre_razon_social no vacío.
- identificacion_fiscal no vacía.
- correo con formato válido.
- correo/identificación no duplicados dentro de la cartera del freelancer [Propuesta].

**Mensajes:**
- Error: "El correo electrónico no tiene un formato válido."
- Error: "Ya tienes un cliente registrado con esta identificación fiscal."
- Confirmación: "Cliente guardado correctamente."

---

### FRM-011 — Servicio (Crear/Editar)
**Pantalla:** P-12
**Objetivo:** Mantener el catálogo de servicios/tarifas reutilizables en propuestas y facturas.

| Campo | Tipo | Obligatorio |
|---|---|---|
| nombre_servicio | text | Sí |
| descripcion | textarea | No |
| unidad_medida | select (Hora / Proyecto / Entregable) | Sí |
| tarifa_unitaria | number (currency) | Sí |
| moneda | select | Sí |

**Botones:** "Guardar servicio" · "Eliminar servicio" (con confirmación)

**Validaciones cliente:**
- nombre no vacío.
- tarifa_unitaria > 0 (no puede ser negativa ni cero).

**Mensajes:**
- Error: "La tarifa debe ser un valor mayor a 0."
- Error: "El nombre del servicio es obligatorio."
- Confirmación: "Servicio guardado correctamente."

---

## Bloque C — Propuestas

### FRM-012 — Propuesta (Crear/Editar)
**Pantalla:** P-14
**Objetivo:** Elaborar una propuesta comercial compuesta por ítems, con validez y condiciones, previa a su conversión en proyecto **[Regla cerrada: máquina de estados de Propuesta]**.

**Cabecera:**

| Campo | Tipo | Obligatorio |
|---|---|---|
| cliente | select (con búsqueda) | Sí |
| titulo_propuesta | text | Sí |
| fecha_emision | date | Sí |
| fecha_validez | date | Sí |
| moneda | select | Sí |
| notas_condiciones | textarea | No |

**Sub-formulario — Ítems (lista dinámica):**

| Campo | Tipo | Obligatorio |
|---|---|---|
| servicio_referencia | select (autocompleta tarifa) | No |
| descripcion_item | text | Sí |
| cantidad | number | Sí |
| precio_unitario | number (currency) | Sí |
| subtotal_item | number (currency), calculado | — (no editable) |

**Totales (calculados, no editables):** subtotal_general, descuento (opcional), total_propuesta.

**Botones:** "Agregar ítem" · "Eliminar ítem" · "Guardar borrador" · "Enviar propuesta" (dispara DRAFT→SENT) · "Cancelar"

**Validaciones cliente:**
- cliente obligatorio; al menos 1 ítem.
- cantidad > 0; precio_unitario ≥ 0.
- fecha_validez > fecha_emision.
- total_propuesta > 0 **[Regla cerrada: bloqueo de totales inválidos, aplicada también aquí por consistencia con Factura]**.

**Mensajes:**
- Error: "Debes agregar al menos un ítem a la propuesta."
- Error: "La fecha de validez debe ser posterior a la fecha de emisión."
- Error: "La cantidad debe ser mayor a 0."
- Confirmación (borrador): "Propuesta guardada como borrador."
- Confirmación (envío): "Propuesta enviada al cliente. Estado actualizado a 'Enviada'."

---

## Bloque D — Proyectos y Tiempo

### FRM-013 — Proyecto (Crear/Editar)
**Pantalla:** P-17
**Objetivo:** Crear o editar un proyecto, opcionalmente originado desde una propuesta ACCEPTED **[Regla cerrada: ACCEPTED → CONVERTED]**.

| Campo | Tipo | Obligatorio |
|---|---|---|
| nombre_proyecto | text | Sí |
| cliente | select | Sí |
| propuesta_origen | select | No |
| descripcion | textarea | No |
| fecha_inicio | date | Sí |
| fecha_fin_estimada | date | No |
| modalidad_cobro | select (Por horas / Tarifa fija / Por hitos) | Sí |
| tarifa_hora | number (currency) | Condicional (si modalidad = Por horas) |
| monto_fijo | number (currency) | Condicional (si modalidad = Tarifa fija) |
| presupuesto_horas_estimado | number | No |

**Botones:** "Guardar proyecto" · "Cancelar"

**Validaciones cliente:**
- nombre y cliente obligatorios.
- fecha_fin_estimada > fecha_inicio (si se define).
- tarifa_hora o monto_fijo > 0 según modalidad.

**Mensajes:**
- Error: "La fecha de fin estimada debe ser posterior a la fecha de inicio."
- Error: "Debes definir una tarifa válida para la modalidad seleccionada."
- Confirmación: "Proyecto creado correctamente. Estado inicial: Activo." [Regla cerrada: estado inicial ACTIVE]

---

### FRM-014 — Registro de Tiempo
**Pantalla:** P-19
**Objetivo:** Registrar horas trabajadas en un proyecto, base para facturación por horas y rentabilidad.

| Campo | Tipo | Obligatorio |
|---|---|---|
| proyecto | select | Sí |
| fecha_trabajo | date | Sí |
| horas_trabajadas | number (decimal) | Sí |
| descripcion_actividad | textarea | Sí |
| facturable | boolean | Sí |

**Botones:** "Guardar registro" · "Cancelar"

**Validaciones cliente:**
- horas_trabajadas > 0 y ≤ 24 [Propuesta, límite por entrada diaria].
- fecha_trabajo no puede ser futura.
- descripcion no vacía.
- proyecto solo seleccionable si está ACTIVE/ON_HOLD [Propuesta, consistente con máquina de estados de Proyecto].

**Mensajes:**
- Error: "Las horas deben ser un valor entre 0 y 24."
- Error: "No puedes registrar tiempo en una fecha futura."
- Confirmación: "Registro de tiempo guardado correctamente."

---

## Bloque E — Facturación

### FRM-015 — Factura (Crear/Editar)
**Pantalla:** P-21
**Objetivo:** Generar una factura respetando la integridad aritmética **[Regla cerrada]**.

**Cabecera:**

| Campo | Tipo | Obligatorio |
|---|---|---|
| cliente | select | Sí |
| proyecto_relacionado | select | No |
| numero_factura | text, autogenerado | — (solo lectura) |
| fecha_emision | date | Sí |
| fecha_vencimiento | date | Sí |
| moneda | select | Sí |

**Sub-formulario — Ítems (lista dinámica):**

| Campo | Tipo | Obligatorio |
|---|---|---|
| origen_item | select (Manual / Desde tiempo / Desde catálogo) | Sí |
| descripcion_item | text | Sí |
| cantidad | number | Sí |
| precio_unitario | number (currency) | Sí |
| subtotal_item | number, calculado | — (no editable) |

**Totales (calculados, no editables):** subtotal_general, descuento, impuestos (según configuración fiscal), **total_factura** = subtotal − descuento + impuestos.

**Botones:** "Agregar ítem" · "Guardar borrador" · "Enviar factura" (DRAFT→SENT) · "Cancelar"

**Validaciones cliente:**
- cliente obligatorio; al menos 1 ítem.
- cantidad > 0; precio_unitario ≥ 0.
- fecha_vencimiento ≥ fecha_emision.
- total_factura > 0 **[Regla cerrada: bloqueo de totales inválidos]**.
- El campo total nunca es editable manualmente: se recalcula siempre desde los ítems **[Regla cerrada: integridad aritmética]**.

**Mensajes:**
- Error: "El total de la factura no puede ser cero o negativo."
- Error: "Debes agregar al menos un ítem a la factura."
- Error: "La fecha de vencimiento no puede ser anterior a la de emisión."
- Confirmación: "Factura enviada. Estado actualizado a 'Enviada'."

---

### FRM-016 — Registro de Pago de Factura
**Pantalla:** P-22 (modal/sección en Detalle de factura)
**Objetivo:** Registrar un pago aplicando las reglas de pagos parciales, en exceso y saldo a favor **[Regla cerrada]**.

| Campo | Tipo | Obligatorio |
|---|---|---|
| monto_pagado | number (currency) | Sí |
| fecha_pago | date | Sí |
| metodo_pago | select | Sí |
| referencia_comprobante | text | No |
| notas | textarea | No |

**Botones:** "Registrar pago" · "Cancelar"

**Validaciones cliente:**
- monto_pagado > 0.
- fecha_pago ≤ fecha actual.
- Si monto_pagado < saldo_pendiente → la factura pasará a PARTIAL (informativo).
- Si monto_pagado > saldo_pendiente → no se bloquea, pero se advierte que el excedente genera saldo a favor **[Regla cerrada]**.
- Si monto_pagado == saldo_pendiente → la factura pasará a PAID.

**Mensajes:**
- Error: "El monto del pago debe ser mayor a 0."
- Advertencia (no bloqueante): "El monto ingresado excede el saldo pendiente. El excedente se registrará como saldo a favor del cliente."
- Confirmación: "Pago registrado correctamente. Saldo actualizado."

---

### FRM-017 — Anulación de Factura (VOID)
**Pantalla:** P-22 (acción dentro del Detalle de factura)
**Objetivo:** Anular una factura no pagada, dejando trazabilidad **[Regla cerrada: PAID no puede anularse]**.

| Campo | Tipo | Obligatorio |
|---|---|---|
| motivo_anulacion | textarea | Sí |
| confirmacion_anulacion | checkbox | Sí |

**Botones:** "Confirmar anulación" · "Cancelar" — el botón "Confirmar anulación" no debe estar disponible si la factura está en estado PAID.

**Validaciones cliente:**
- motivo_anulacion no vacío, mínimo 10 caracteres [Propuesta, para asegurar trazabilidad].
- checkbox de confirmación marcado.

**Mensajes:**
- Error: "Debes indicar un motivo para anular la factura."
- Bloqueo (informativo): "Esta factura ya fue pagada y no puede anularse."
- Confirmación: "Factura anulada. Este cambio queda registrado en el historial."

---

## Bloque F — Portal Cliente Externo

### FRM-018 — Notificación de Pago (Cliente Externo)
**Pantalla:** P-23
**Objetivo:** Permitir que el cliente externo notifique un pago sin registrarlo directamente **[Regla cerrada: el cliente externo no puede registrar pagos]**.

| Campo | Tipo | Obligatorio |
|---|---|---|
| fecha_pago_realizado | date | Sí |
| monto_declarado | number (currency) | Sí |
| metodo_pago_utilizado | select | Sí |
| comprobante_adjunto | file (image/pdf) | No |
| comentario | textarea | No |

**Botones:** "Notificar pago" — visible solo si el freelancer habilitó esta opción para la factura **[Regla cerrada]**.

**Validaciones cliente:**
- monto_declarado > 0.
- fecha_pago_realizado ≤ fecha actual.

**Mensajes:**
- Error: "El monto declarado debe ser mayor a 0."
- Confirmación: "Hemos notificado tu pago al freelancer. El estado de la factura se actualizará una vez confirmado."

---

## Bloque G — Gastos

### FRM-019 — Gasto (Crear/Editar)
**Pantalla:** P-25
**Objetivo:** Registrar un gasto, clasificado por categoría y marcado como deducible **[Regla cerrada: gastos deducibles]**.

| Campo | Tipo | Obligatorio |
|---|---|---|
| fecha_gasto | date | Sí |
| categoria_gasto | select | Sí |
| monto | number (currency) | Sí |
| proyecto_relacionado | select | No |
| es_deducible | boolean (precargado según categoría) | Sí |
| comprobante_adjunto | file (image/pdf) | No |
| descripcion | textarea | No |

**Botones:** "Guardar gasto" · "Cancelar"

**Validaciones cliente:**
- monto > 0.
- categoria obligatoria.
- fecha_gasto ≤ fecha actual.
- fecha_gasto no puede pertenecer a un período contable cerrado **[Regla cerrada: restricciones de edición en períodos cerrados]**.

**Mensajes:**
- Error: "El monto debe ser mayor a 0."
- Error: "No es posible registrar gastos en un período contable cerrado."
- Confirmación: "Gasto registrado correctamente."

---

## Bloque H — Presupuesto y Metas

### FRM-020 — Presupuesto y Metas
**Pantalla:** P-26
**Objetivo:** Definir metas financieras periódicas para comparar contra el desempeño real.

| Campo | Tipo | Obligatorio |
|---|---|---|
| periodo | select (Mensual / Trimestral / Anual) | Sí |
| meta_ingresos | number (currency) | Sí |
| limite_gasto_por_categoria | lista dinámica (categoria: select, limite: number) | No |
| meta_horas_facturables | number | No |

**Botones:** "Agregar límite por categoría" · "Guardar presupuesto" · "Cancelar"

**Validaciones cliente:**
- meta_ingresos > 0.
- cada límite_gasto > 0.
- no repetir la misma categoría dos veces en la lista.

**Mensajes:**
- Error: "La meta de ingresos debe ser mayor a 0."
- Error: "Ya definiste un límite para esta categoría."
- Confirmación: "Presupuesto guardado correctamente."

---

## Bloque I — Reportes

### FRM-021 — Filtros de Reporte (componente reutilizable)
**Pantallas:** P-28 a P-36
**Objetivo:** Filtrar cualquier reporte financiero por rango de fechas, cliente y/o proyecto.

| Campo | Tipo | Obligatorio |
|---|---|---|
| fecha_desde | date | Sí |
| fecha_hasta | date | Sí |
| cliente | select | No (todos por defecto) |
| proyecto | select | No (todos por defecto) |
| moneda | select | No |

**Botones:** "Aplicar filtros" · "Limpiar filtros" · "Exportar" (PDF/Excel)

**Validaciones cliente:**
- fecha_hasta ≥ fecha_desde.
- ambas fechas obligatorias.

**Mensajes:**
- Error: "La fecha final no puede ser anterior a la fecha inicial."
- Informativo: "No hay datos para el período seleccionado." (si la consulta retorna vacío)

---

## Bloque J — Notificaciones

### FRM-022 — Preferencias de Notificaciones
**Pantalla:** P-37
**Objetivo:** Configurar qué alertas desea recibir el freelancer.

| Campo | Tipo | Obligatorio |
|---|---|---|
| notificar_facturas_vencidas | boolean | Sí |
| notificar_propuestas_por_expirar | boolean | Sí |
| notificar_pagos_recibidos | boolean | Sí |
| canal_notificacion | multi-select (Email / In-app) | Sí |

**Botones:** "Guardar preferencias"

**Validaciones cliente:**
- al menos un canal de notificación seleccionado.

**Mensajes:**
- Error: "Debes seleccionar al menos un canal de notificación."
- Confirmación: "Preferencias de notificación actualizadas."

---

## Notas abiertas — requieren tu validación antes de construir el frontend

1. **Política de contraseñas** (mín. 8 caracteres + 1 número) es una propuesta estándar; no está en el catálogo RF compartido en este contexto.
2. **Configuración Fiscal (FRM-007)** es la sección con más incertidumbre: el documento solo confirma que existe la regla "cálculo fiscal estimado", sin especificar campos. Debe revisarse contra el RF correspondiente y contra el modelo tributario real al que apunta FreelanceFlow (¿multi-país o un solo régimen?).
3. **Multi-moneda**: incluí el campo `moneda` en Cliente, Servicio, Propuesta y Factura asumiendo que el sistema podría soportarlo. Si FreelanceFlow opera en una sola moneda, estos campos se eliminan y simplifican varios formularios.
4. **Verificación de correo al registrarse**: no confirmé si existe un paso de verificación por email; lo dejé fuera del flujo de FRM-001 hasta que confirmes si aplica.
5. **Reactivación de Proyecto COMPLETED**: el Context Pack indica que es posible "si el negocio lo requiere y se documenta en historial", pero no especifica el formulario ni el estado destino. No lo incluí como formulario independiente; si decides modelarlo, sería un mini-formulario similar a FRM-017 (motivo + confirmación).
