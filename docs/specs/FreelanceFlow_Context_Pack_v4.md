# FreelanceFlow — Context Pack v4
## Estado oficial consolidado del proyecto

### 1) Resumen ejecutivo
FreelanceFlow es un SaaS fintech orientado a freelancers que centraliza la gestión financiera operativa: clientes, servicios, propuestas, proyectos, tiempo trabajado, facturación, pagos, gastos, presupuesto/metas, flujo de caja, impuestos, reportes y notificaciones.

El problema canónico ya quedó formalizado: la gestión financiera freelance está fragmentada entre hojas de cálculo, mensajería, pagos desconectados y registros informales, lo que impide ver rentabilidad real, proyectar flujo de caja, controlar cuentas por cobrar y preparar impuestos sin fricción.

La solución propuesta es una plataforma con dos superficies:
- **Web**: gestión macro y administración completa.
- **Móvil**: captura rápida de gastos, tiempo y pagos, usando las mismas reglas y APIs.

---

### 2) Alcance y fases ya cerradas
**Fase 1:** Frontend web con datos simulados.  
**Fase 2:** Backend con Django + PostgreSQL.  
**Fase 3:** APIs REST.  
**Fase 4:** App móvil con React Native.

No se debe saltar a código, base de datos ni APIs antes de cerrar flujos y pantallas de la Fase 1.

---

### 3) Decisiones de arquitectura ya consolidadas
- El **Cliente Externo** no es usuario del sistema principal; accede mediante **token opaco, único, expirable y revocable** asociado a una factura específica.
- El portal del cliente externo es de **propósito único**: ver la factura, descargar PDF y opcionalmente notificar pago; no navega por el sistema.
- Las reglas de negocio ya están desambiguadas en formato **Condición → Acción**.
- Existen máquinas de estado definidas para **Factura, Propuesta y Proyecto**.
- Existe un catálogo numerado de **RF-001 a RF-098** y **RNF-001 a RNF-030**.
- El frontend debe respetar la arquitectura de navegación definida (pantallas P-01 a P-37).

---

### 4) Arquitectura de navegación validada
La navegación oficial quedó organizada así:

**Zona pública**
- P-01 Registro
- P-02 Login
- P-03 Recuperar clave
- P-23 Portal cliente externo (token)

**Zona autenticada**
- P-04 Perfil usuario
- P-05 Configuración fiscal
- P-06 Ajustes de facturación
- P-07 Catálogo de categorías de gasto
- P-08 Dashboard principal
- P-09 Listado clientes
- P-10 Crear/Editar cliente
- P-11 Detalle cliente
- P-12 Catálogo servicios
- P-13 Listado propuestas
- P-14 Crear/Editar propuesta
- P-15 Detalle propuesta
- P-16 Listado proyectos
- P-17 Crear/Editar proyecto
- P-18 Detalle proyecto
- P-19 Registro tiempo
- P-20 Listado facturas
- P-21 Crear/Editar factura
- P-22 Detalle factura
- P-24 Listado gastos
- P-25 Crear/Editar gasto
- P-26 Presupuesto y metas
- P-27 Hub de reportes
- P-28 Ingresos
- P-29 Gastos
- P-30 Flujo de caja
- P-31 Rentabilidad
- P-32 Pérdidas y ganancias
- P-33 Cuentas por cobrar
- P-34, P-35, P-36 fiscal / otros reportes relacionados
- P-37 Centro de notificaciones

Núcleos funcionales:
- Clientes / Servicios
- Propuestas / Reportes
- Proyectos / Tiempo
- Facturación
- Gastos
- Presupuesto y metas
- Notificaciones

---

### 5) Estado del análisis y validaciones
La documentación ya pasó por una evaluación estricta y quedó validada para continuar con el diseño del frontend.

Se cerraron estas brechas:
- Problem statement formal y canónico.
- Definición técnica del Cliente Externo.
- Reglas de negocio en formato Condición → Acción.
- Máquinas de estado de Factura, Propuesta y Proyecto.
- Catálogo verificable de requerimientos RF/RNF.
- Mapa de navegación del sistema.

---

### 6) Catálogo de formularios frontend ya derivado
Se generó un catálogo de formularios del frontend con 22 formularios, incluyendo:
- registro / login / recuperación de clave,
- perfil / configuración fiscal / ajustes de facturación,
- clientes / servicios,
- propuestas,
- proyectos / tiempo,
- facturas / pagos / anulación,
- notificación de pago del cliente externo,
- gastos,
- presupuesto y metas,
- filtros de reportes,
- preferencias de notificaciones.

Notas abiertas ya identificadas:
- La **Configuración Fiscal** sigue siendo el punto más sensible por posibles ambigüedades de campos.
- El soporte **multi-moneda** sigue sin decisión final para todos los formularios.
- La verificación por correo en registro sigue sin confirmación explícita.
- La reactivación de proyectos completados quedó como posible flujo futuro, no como formulario independiente.

---

### 7) Catálogo de elementos visuales frontend ya derivado
Se generó un catálogo de 40 elementos visuales:
- tarjetas de métricas,
- tablas,
- listas,
- gráficos / tablas mixtas para reportes.

Puntos abiertos:
- **P-34, P-35 y P-36** no tienen definición funcional cerrada.
- En reportes aún falta confirmar si la visualización será solo tabular o también gráfica en más de un módulo.
- El comportamiento multi-moneda de algunas métricas todavía no está resuelto de forma definitiva.

---

### 8) Mock data para el frontend
Se generaron datos simulados para probar el frontend sin backend:
- 1 perfil de usuario,
- 3 cuentas simuladas,
- 2 clientes,
- 3 proyectos,
- 4 categorías,
- 5 transacciones de ejemplo.

Importante:
- La entidad **Cuenta** no está confirmada como entidad oficial del sistema.
- Por ahora debe tratarse como **dato auxiliar de mock** para la fase de frontend, no como parte cerrada del modelo funcional.
- Las “transacciones” se usaron como unión práctica de ingresos y gastos para alimentar el dashboard simulado.

Decisión pendiente:
- ¿Se formaliza “Cuenta” como entidad real con pantalla propia y reglas de conciliación, o se elimina del alcance oficial y se mantiene solo como mock auxiliar?

---

### 9) Qué le falta al modelo visual / documental
Las dudas que aún deben resolverse antes de pasar a implementación visual fuerte son:

1. Definir qué son exactamente **P-34, P-35 y P-36**.
2. Cerrar si habrá visualización gráfica adicional en los reportes P-28 a P-31.
3. Confirmar si el sistema manejará **multi-moneda** de forma real o solo moneda principal con simulación.
4. Decidir si **Cuenta** entra al alcance oficial o no.
5. Aterrizar la configuración fiscal final con el nivel exacto de detalle que se mostrará en frontend.

---

### 10) Instrucción base para continuar con Claude
Cuando empieces un chat nuevo con Claude, adjunta este contexto y pídele que lo use como estado oficial del proyecto.

Prompt recomendado para continuar:
> Lee este contexto completo como estado oficial del proyecto FreelanceFlow. No replantees decisiones ya cerradas. Prioriza respuestas técnicas, aterrizadas y coherentes con el alcance actual. A partir de aquí, necesito que me ayudes con el siguiente paso del roadmap y que todo lo nuevo quede alineado con este contexto.

Si el objetivo es rehacer mock data o mejorarlo, la instrucción debe ser aún más estricta:
> Rehaz los datos simulados ajustándolos únicamente a las entidades y pantallas oficiales del proyecto. No formalices como entidad real nada que esté marcado como auxiliar o pendiente. Si propones extensiones, sepáralas claramente como propuesta y no como alcance aprobado.

---

### 11) Próximo paso recomendado
El siguiente paso más sólido es consolidar:
- el mapa final de formularios,
- los elementos visuales por pantalla,
- y luego los flujos de usuario por módulo.

Eso deja el frontend listo para construirse sin deuda documental.
