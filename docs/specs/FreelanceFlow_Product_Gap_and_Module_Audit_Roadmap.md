# FreelanceFlow — Brechas de producto y roadmap de auditoría modular

Public-safe normalization: machine-local metadata was generalized without changing product evidence or business conclusions.
> **Resultado de Fase 5:** cierre documental sobre el snapshot congelado. Este documento no implementa cambios, no resuelve decisiones del Product Owner y no declara ningún módulo integrado sin evidencia de ejecución real.

## 1. Metadatos y snapshot

### 1.1 Identificación

| Campo | Valor | Evidencia |
|---|---|---|
| Fecha de cierre documental | 2026-07-18 | Fecha de sesión |
| Worktree | <audit-worktree> | Comando de preflight |
| Rama | docs/product-requirements-baseline | git branch --show-current |
| HEAD congelado | 097d0a2cef3455a6b7956c1fe0bb3c792f19f287 | git rev-parse HEAD |
| origin/main local | 097d0a2cef3455a6b7956c1fe0bb3c792f19f287 | git rev-parse refs/remotes/origin/main |
| refs/heads/main | 99c3f62fe01f4dd2ee6780d94f82b160014d6ec2 | git rev-parse refs/heads/main; no se usa como fuente |
| Estado del snapshot | **CONFIRMADO** | HEAD y origin/main local coinciden; no se hizo fetch, merge, rebase ni checkout |

La referencia local `main` es ancestro de `origin/main` y está 12 commits detrás. Esta auditoría permanece deliberadamente anclada a HEAD y origin/main local en `097d0a2`; no mezcla estados posteriores.

### 1.2 Fuentes autorizadas y hashes

| Alias | Fuente congelada | SHA-256 | Función |
|---|---|---|---|
| SM | docs/specs/FreelanceFlow_Product_Audit_Source_Map.md | 8A9688926605618EDCD1B44437897EC338D0FCAF611908FBA4B6756A39B933C4 | Autoridad y vigencia de fuentes |
| BL | docs/specs/FreelanceFlow_Product_Requirements_Baseline.md | 612AA1C033DDD24585C4C9E2BF66A0D22155DF4B38E6914DAE5E0AD3224A5091 | Visión, actores, arquitectura y decisiones |
| IRM | docs/specs/FreelanceFlow_Implementation_Reality_Matrix.md | 7D1F666C5B25EB52B56A9DB591150E4B7630C22DF22C8E2A4D76F7506163D501 | Realidad AS-IS de módulos, datos e integraciones |
| TRU | docs/specs/FreelanceFlow_Traceable_Requirements_and_User_Stories.md | 2BC109E103CACA06444250AC90DF2F5527E2910E1ED07EB37F23E631187CE02E | UR, SR, US, criterios y decisiones bloqueadas |

### 1.3 Alcance

**Incluye:** 12 decisiones PO/PH, 9 UR, 31 SR, 16 historias US-004…US-019, 16 módulos canónicos, 14 integraciones canónicas, la integración adicional Movimientos→Dashboard, brechas transversales, readiness, orden y protocolo de auditoría. Evidencia: TRU §1,4–13; IRM §1,4–16.

**Excluye:** ejecución de aplicación, navegador, tests, builds, medición de rendimiento, auditoría de accesibilidad, validación de seguridad efectiva, cambios de código o mocks, instalación, implementación, SDD, revisión Gentle-AI, issue, commit, push y PR. Evidencia del límite documental: TRU §1.1,2.3,17; IRM §2.4,18.

## 2. Resumen ejecutivo

| Tema | Conclusión trazable |
|---|---|
| Estado actual | **CONFIRMADO:** prototipo frontend estático multipágina con 16 superficies, JavaScript, mocks y persistencia de navegador. No existe backend, API, base de datos ni autenticación confiable en el snapshot. Evidencia: BL §7–9,11; IRM §1,4–6. |
| Fortalezas | **CONFIRMADO:** las 16 superficies están inventariadas; existen cuatro integraciones cableadas canónicas, una integración adicional Movimientos→Dashboard y un canal ActivityLog compartido. Evidencia: IRM §1.2,7,9; TRU §7,9. |
| Brecha dominante | **BLOQUEADO:** 19 claves de persistencia, overlays locales y consumidores que no comparten una fuente de verdad impiden asumir consistencia transversal. Evidencia: IRM §5,10,12,15; TRU §11,14. |
| Riesgo financiero | **BLOQUEADO:** registrar un pago solo modifica Facturas; sus efectos y reversión sobre Movimientos, Reportes y Notificaciones no están decididos. Evidencia: IRM §10,14; SR-015 y SR-026 en TRU §5,14. |
| Identidad y acceso | **BLOQUEADO:** operativo y administrativo son perfiles de demostración controlados en cliente; no prueban identidad, autenticación ni autorización. Evidencia: IRM §6,14–15; SR-009, SR-010 y SR-024 en TRU §5,14. |
| Evidencia runtime | **ENVIRONMENT_UNVERIFIED:** no se ejecutó navegador en esta fase; responsive, accesibilidad, consola, red, rendimiento y E2E siguen sin verificarse. PDF también conserva este estado. Evidencia: IRM §3,18; TRU §1.1,8,17. |
| Arquitectura futura | **PROPUESTO:** React/Vite, Django/DRF/JWT, PostgreSQL, Expo y portal externo no son arquitectura aprobada. Evidencia: BL §12,16; PO-011 en TRU §13. |
| Condición para avanzar | **INFERIDO:** resolver primero los gates que cambian significado de identidad, dinero, fiscalidad y datos; luego ejecutar auditorías reales por dependencia. Algunos módulos pueden auditarse antes, pero un gate abierto obliga a cerrar como **BLOQUEADO**, no como listo. Evidencia: TRU §13–16. |

## 3. Metodología

### 3.1 Clasificación de evidencia

| Clasificación | Uso en este documento |
|---|---|
| **CONFIRMADO** | Declaración respaldada directamente por una fuente congelada o por AS-IS ya contrastado; no convierte código en intención aprobada. |
| **INFERIDO** | Síntesis razonable derivada de dependencias documentadas y marcada explícitamente. |
| **PROPUESTO** | Opción, protocolo o evolución futura que requiere aprobación o evidencia posterior. |
| **BLOQUEADO** | Conclusión o trabajo que depende de decisión, política o contrato aún abierto. |
| **CONFLICTO** | Dos fuentes o contratos actuales no admiten una interpretación única. |
| **ENVIRONMENT_UNVERIFIED** | Comportamiento que no pudo verificarse en el entorno autorizado. |

Fuente de la taxonomía y sus límites: TRU §2.2–2.3.

### 3.2 AS-IS frente a producto aprobado

- Una página, controlador, mock, test estático o clave de storage confirma presencia AS-IS; no aprueba el requisito. Evidencia: TRU §1.1,2.3.
- Una integración real significa productor y consumidor cableados en el snapshot; no demuestra seguridad, persistencia central ni ejecución correcta en navegador. Evidencia: IRM §9,18.
- Una historia o requisito bloqueado no entra como comportamiento comprometido hasta que el gate correspondiente se resuelva. Evidencia: TRU §13–14.
- **READY_FOR_AUDIT** significa que puede comenzar una auditoría runtime; no significa listo para producción ni integrado.

### 3.3 Criterio de readiness

| Estado | Regla |
|---|---|
| READY_FOR_AUDIT | Alcance y flujo principal identificables sin una decisión previa que cambie su significado. |
| DECISION_BLOCKED | Una decisión PO, política o contrato debe resolverse antes de interpretar el resultado como correcto. |
| INTEGRATION_BLOCKED | El módulo aislado puede observarse, pero su flujo central depende de un consumidor o productor sin contrato compartido. |
| PARTIAL | Hay suficiente AS-IS para auditar un flujo acotado, con brechas explícitas que no impiden observarlo. |
| FUTURE_ONLY | No existe superficie actual y solo hay intención futura documentada. |

### 3.4 Criterio de prioridad

| Prioridad | Criterio |
|---|---|
| GATE | Decisión del Product Owner o política necesaria antes de trabajar o interpretar resultados. |
| P0 | Riesgo de consistencia financiera, privacidad, acceso, datos o pérdida de información. |
| P1 | Integración necesaria para completar un flujo operativo central. |
| P2 | UX, accesibilidad, rendimiento, copy, navegación o mantenibilidad verificables después de los contratos centrales. |
| P3 | Evolución futura o arquitectura todavía no aprobada. |

La prioridad es ordinal e **INFERIDA**. No usa puntuaciones, fechas, alcance de mercado, impacto medido, capacidad ni esfuerzo no disponibles. El conteo de prioridad del cierre se calcula sobre las 15 brechas de integración de §7 para evitar duplicar sus manifestaciones transversales.

## 4. Gates del Product Owner

Las 12 filas preservan las decisiones existentes. Las opciones son neutrales y **PROPUESTAS**; ninguna se resuelve aquí. Orden recomendado **INFERIDO** por dependencia.

| Orden | Gate | Pregunta y opciones sin decidir | Módulos y trazabilidad afectados | Riesgo de posponer | Evidencia |
|---:|---|---|---|---|---|
| 1 | PO-008 | ¿Operativo y administrativo serán roles reales, perfiles demo o se reemplazarán por otro modelo? | Acceso, 13 módulos operativos, Bitácora y Cuenta; UR-008; SR-008–010, SR-016, SR-024; US-005, US-018, US-019 | No se puede interpretar acceso, actor ni auditoría como autorización. | BL §9,16; TRU §13–14 |
| 2 | PO-006 | ¿Qué identidad futura se admite: credenciales, SSO u otro modelo, y qué verificación/recuperación requiere? | Acceso y 14 superficies protegidas; SR-001, SR-009, SR-010, SR-024; US-005, US-019 | Cualquier control confiable de permisos queda indefinido. | BL §16; IRM §6; TRU §13–14 |
| 3 | PO-001 | ¿Cuenta financiera se formaliza, se difiere o se descarta frente a Cuenta/Perfil? | Cuenta, shell, Dashboard y Bitácora; UR-007; SR-007, SR-016; US-018 | Puede confundirse identidad de usuario con fondos o cuenta financiera. | BL §15–16; TRU §12–13 |
| 4 | PO-003 | ¿Se aprueba moneda única, multimoneda con reglas o alcance local explícito? | Facturas, Servicios, Propuestas y Ajustes; SR-005, SR-014, SR-022; US-010, US-013, US-014, US-016 | Importes, defaults y documentos pueden divergir. | BL §16; IRM §12,14; TRU §13 |
| 5 | PO-004 | ¿Qué jurisdicción y alcance fiscal se aprueban o se mantiene solo una estimación local? | Configuración fiscal, Ajustes y Facturas; SR-006, SR-020, SR-022; US-010, US-015, US-016 | Se podrían presentar cálculos o campos como obligación fiscal sin base aprobada. | BL §8,16; IRM §12,14; TRU §13–14 |
| 6 | PO-007 | ¿Un proyecto completado puede reactivarse, debe duplicarse o permanece terminal? | Propuestas y Proyectos; UR-004; SR-004, SR-011, SR-019; US-009, US-014 | Estados de venta y entrega pueden quedar incompatibles. | BL §16; TRU §13–14 |
| 7 | PO-010 | ¿Tiempo y gastos tendrán superficies propias o permanecerán integrados? | Movimientos y Proyectos; SR-004, SR-019; US-007, US-009 | Rentabilidad carece de una semántica canónica de origen y período. | BL §16; IRM §12,16; TRU §13 |
| 8 | PO-009 | ¿Equipos pequeños o supervisores son actores canónicos, secundarios o quedan fuera? | Acceso y Bitácora; UR-008; SR-008, SR-010; US-019 | Bitácora no tiene usuario objetivo canónico. | BL §5,16; TRU §3,13 |
| 9 | PO-005 | ¿Qué reportes requieren gráficos además de tablas o ninguno? | Reportes; UR-006; SR-006; US-011 | Se puede inflar alcance visual sin valor confirmado. | BL §16; TRU §13 |
| 10 | PO-002 | ¿Qué significan P-34, P-35 y P-36: se definen, retiran o difieren? | Cobertura pendiente; no hay UR, SR ni US válidos que inventar | El backlog puede quedar incompleto o incorporar historias ficticias. | BL §16; SM §5.3; TRU §13,16 |
| 11 | PH-004 | ¿Qué taxonomía de fases, roadmap y gates medibles será canónica? | Planificación y secuencia futuras; no cambia AS-IS de módulos | Roadmaps contradictorios dificultan ordenar validación e implementación. | BL §13,15–16; TRU §13 |
| 12 | PO-011 | ¿React/Vite, Django/DRF/JWT, PostgreSQL y Expo se aprueban, sustituyen o descartan? | Arquitectura TO-BE; ningún criterio de US actual | Una migración podría iniciarse sin problema ni destino aprobados. | BL §12,16; TRU §1.3,13,16 |

**Bloqueo transversal adicional, sin sustituir una de las 12 decisiones:** SR-015 y SR-026 requieren que el Product Owner defina efectos y reversión de pago antes de integrar Facturas con Movimientos, Reportes y Notificaciones. Evidencia: IRM §10,14; TRU §5,14.

## 5. Matriz maestra de cobertura

| Cobertura | UR | SR | US | Módulos responsables | Integraciones | Implementación y evidencia | Brecha | Prioridad | Gate relacionado |
|---|---|---|---|---|---|---|---|---|---|
| Entrada y registro financiero | UR-001 | SR-001, SR-002, SR-013 | US-004, US-005, US-007 | Landing, Acceso, Movimientos | Landing→Acceso→perfil; Movimientos→Dashboard | **CONFIRMADO:** superficies y cableado parcial. IRM §4,9–10; TRU §10 | Perfil demo y datos aislados | GATE | PO-006, PO-008 |
| Visibilidad financiera | UR-002 | SR-002, SR-015, SR-019, SR-021, SR-031 | US-006, US-007, US-009, US-011 | Dashboard, Movimientos, Proyectos, Reportes | pago→consumidores; métricas; deep links | **CONFIRMADO:** resumen y derivaciones locales. IRM §4,9,12; TRU §10 | Pago, tiempo e identificadores no canónicos | P0 | Efectos de pago, PO-010 |
| Catálogos | UR-003 | SR-003, SR-014, SR-017, SR-018, SR-026 | US-008, US-012, US-013 | Clientes, Categorías, Servicios | catálogos→consumidores | **CONFIRMADO:** mock compartido y overlays aislados. IRM §5,12; TRU §10 | No hay política vigente frente a snapshot | P1 | Contrato de fuente única; PO-003 |
| Flujo comercial | UR-004 | SR-004, SR-011, SR-014, SR-018, SR-019 | US-009, US-014 | Propuestas, Proyectos | Propuesta aceptada→Proyecto; catálogos; métricas | **CONFIRMADO:** conversión cableada; runtime no probado. IRM §9,12; TRU §10 | Estados, snapshots y tiempo pendientes | P1 | PO-007, PO-010 |
| Facturación y pago | UR-005 | SR-005, SR-015, SR-022, SR-026 | US-010 | Facturas | Facturas→consumidores; Ajustes/Fiscal→Facturas | **CONFIRMADO:** pago local; **CONFLICTO** en defaults; PDF **ENVIRONMENT_UNVERIFIED**. IRM §3,10,12,14 | Efectos, moneda, fiscalidad y reversión | GATE | PO-003, PO-004 y decisión de pago |
| Reporte y fiscal | UR-006 | SR-006, SR-015, SR-020, SR-021, SR-031 | US-011, US-015 | Reportes, Configuración fiscal | pago→Reportes; Fiscal→estimación; deep links | **CONFIRMADO:** CSV/presupuesto y estimación local. IRM §4,12; TRU §10 | Base fija, enlaces y datos de pago aislados | GATE | PO-004, PO-005 |
| Preferencias, alertas e identidad | UR-007 | SR-007, SR-016, SR-021, SR-022, SR-028 | US-016, US-017, US-018 | Ajustes, Notificaciones, Cuenta/Perfil | identidad; navegación; Ajustes→Facturas | **CONFLICTO:** tres identidades y defaults incompatibles. IRM §12,14; TRU §10,12 | Sin dueño único ni ID de entidad | GATE | PO-001, PO-003, PO-004, PO-008 |
| Supervisión | UR-008 | SR-008, SR-010, SR-012, SR-024, SR-027 | US-005, US-019 | Acceso, Bitácora | administrativo→Bitácora; operativos→Bitácora | **CONFIRMADO:** canal de sesión; autorización y retención **BLOQUEADO**. IRM §6–7,9; TRU §10,14 | Rol, eventos, retención e inmutabilidad | GATE | PO-006, PO-008, PO-009 |
| Cliente externo futuro | UR-009 | SR-005, SR-021, SR-024, SR-025 | Sin US actual | Portal externo propuesto, Facturas | Fuera de las 15 integraciones AS-IS | **PROPUESTO:** no existe superficie. BL §12,14; SM §5.3; TRU §10 | Identidad, privacidad y validez de declaración | P3 | PO-011 y alcance de portal |
| Acceso transversal | UR-001, UR-008 | SR-009 | US-005 | Acceso y 13 módulos operativos | operativo→módulos | **CONFIRMADO:** guardas cliente. IRM §6,9; TRU §5,7 | No es autorización confiable | P0 | PO-006, PO-008 |
| Calidad transversal | UR-001…UR-008 | SR-023, SR-029, SR-030 | US-004…US-019 | 16 módulos | Todas las rutas auditables | **ENVIRONMENT_UNVERIFIED:** navegador no ejecutado. IRM §18; TRU §8,17 | Accesibilidad, responsive y rendimiento sin medición | P2 | Matriz futura de validación |

La unión de esta matriz cubre UR-001…UR-009, SR-001…SR-031 y US-004…US-019. US-001…US-003 de BL §17.1 son actores históricos y no se redefinen. Evidencia: TRU §6,10.

## 6. Readiness de los 16 módulos

Regla común: UX, accesibilidad, responsive, rendimiento, consola, red y comportamiento en navegador permanecen **ENVIRONMENT_UNVERIFIED** hasta una auditoría real. La seguridad y privacidad efectivas tampoco se infieren de controles cliente. Evidencia: IRM §6,15,18; TRU §8,17.

### 6.1 Landing — READY_FOR_AUDIT

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Explicar la propuesta y conducir al freelancer a Acceso. UR-001; US-004. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** página estática; sin persistencia propia. IRM §4.1,5. |
| Dependencias e integración | Entrada pública; salida Landing→Acceso→perfil, actualmente parcial. SR-001, SR-013; IRM §10; TRU §7. |
| Brechas, roles y Bitácora | Pública; no requiere perfil; cero acciones ActivityLog. No debe prometer backend, pago ni autenticación. IRM §6–7; TRU §17. |
| Validación pendiente | CTA, enlaces, copy, teclado, foco, responsive, consola y red: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | No persiste datos; validar enlaces y ausencia de recolección no documentada. **ENVIRONMENT_UNVERIFIED**. |
| Siguiente acción | Auditar flujo público y salida a Acceso; cerrar con evidencia observable, no como módulo integrado. |

### 6.2 Acceso — DECISION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Seleccionar perfil operativo o administrativo de demostración. UR-001, UR-008; US-005. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** escribe perfil y actor en sessionStorage; no crea identidad real. IRM §5–6. |
| Dependencias e integración | Recibe Landing; envía operativo a Dashboard y administrativo a Bitácora; guarda rutas en cliente. SR-001, SR-009, SR-010, SR-013; IRM §9–10. |
| Brechas, roles y Bitácora | Un evento ActivityLog; no hay alta, credenciales, recuperación, logout ni límite confiable. IRM §6–7. |
| Validación pendiente | Perfiles válidos, ausentes y manipulados; URL directa; foco, errores y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Autenticación y autorización **BLOQUEADO** por PO-006/008; actor en sesión no prueba usuario. SR-024; TRU §14. |
| Siguiente acción | Resolver PO-006/008/009 antes de interpretar rutas como permisos; la auditoría puede documentar solo el demo AS-IS. |

### 6.3 Dashboard — PARTIAL

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Mostrar resumen operativo a perfil operativo. UR-002; US-006. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** mock base y overlay freelanceflow_transactions_mock. IRM §4–5,9. |
| Dependencias e integración | Consume Movimientos; fechas, vencimientos y referencias siguen locales. SR-002, SR-031; IRM §9,14. |
| Brechas, roles y Bitácora | Operativo; una acción ActivityLog; no recibe efectos de pago ni una semántica temporal común. IRM §7,10,14. |
| Validación pendiente | Carga, error, vacío, contenido y reflejo único de alta/edición: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Resumen financiero en cliente; acceso y exposición requieren validar PO-006/008 y política de datos. SR-024, SR-025. |
| Siguiente acción | Auditar junto a Movimientos; registrar cualquier diferencia sin convertirla en requisito nuevo. |

### 6.4 Movimientos — PARTIAL

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Crear, editar, buscar y filtrar ingresos/gastos simulados. UR-001, UR-002; US-007. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** CRUD en localStorage y mocks. IRM §4–5. |
| Dependencias e integración | Sale a Dashboard; Clientes, Categorías y Proyectos solo comparten baseline o referencias parciales. SR-002, SR-015, SR-017; IRM §9,12. |
| Brechas, roles y Bitácora | Operativo; cuatro acciones ActivityLog; cambios de catálogos no se propagan y pago no crea movimiento. IRM §7,10,12. |
| Validación pendiente | Validación, CRUD, filtros, persistencia, duplicados y resumen: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Datos financieros locales; integridad, borrado y acceso **BLOQUEADO** por SR-024–026. |
| Siguiente acción | Auditar CRUD y Movimientos→Dashboard; mantener fuera efectos de pago no decididos. |

### 6.5 Clientes — INTEGRATION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Mantener clientes B2B y contacto principal. UR-003; US-008. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** mock más overlay local clients_v2. IRM §4–5. |
| Dependencias e integración | Fuente para Propuestas, Proyectos y Facturas; consumidores no leen el overlay. SR-003, SR-018; IRM §12. |
| Brechas, roles y Bitácora | Operativo; cuatro acciones ActivityLog; política vigente frente a snapshot no definida. IRM §7,12,16. |
| Validación pendiente | CRUD B2B, unicidad, contacto, inactivación, errores, accesibilidad y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Contiene PII; finalidad, acceso, retención y borrado **BLOQUEADO** por SR-025. |
| Siguiente acción | Definir contrato de vigencia/snapshot y luego auditar productor→consumidores. |

### 6.6 Proyectos — PARTIAL

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Gestionar entrega y observar tiempo, costo y ganancia. UR-004; US-009. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** overlay propio; consume payload de Propuestas; métricas locales. IRM §4–5,9,12. |
| Dependencias e integración | Entrada Propuesta aceptada; referencias a Cliente y fuentes de tiempo/costo. SR-004, SR-011, SR-019. |
| Brechas, roles y Bitácora | Operativo; cuatro acciones ActivityLog; reactivación y origen de métricas pendientes. IRM §7,14,16. |
| Validación pendiente | Conversión única, estados, métricas con caso conocido, vacío/error y persistencia: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Datos comerciales/financieros locales; integridad referencial **BLOQUEADO** por SR-026. |
| Siguiente acción | Auditar después de Propuestas; cerrar como bloqueado si PO-007/010 altera estados o métricas. |

### 6.7 Facturas — DECISION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Gestionar facturas, estados y pagos simulados. UR-005; US-010. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** facturas/pagos locales; PDF depende de jspdf y queda **ENVIRONMENT_UNVERIFIED**. IRM §3–5. |
| Dependencias e integración | Recibe Clientes/Servicios y debería recibir Ajustes/Fiscal; debería producir efectos para Movimientos/Reportes/Notificaciones. SR-005, SR-015, SR-022; IRM §10,12. |
| Brechas, roles y Bitácora | Operativo; seis acciones ActivityLog; pago aislado y defaults en **CONFLICTO**. IRM §7,10,14. |
| Validación pendiente | Cálculos, estados, pagos, reversión, duplicados, PDF, accesibilidad y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Datos financieros y personales; atomicidad, autorización y retención **BLOQUEADO** por SR-024–026. |
| Siguiente acción | Resolver PO-003/004 y efectos de pago antes de auditar integración; no declarar PDF PASS o FAIL funcional. |

### 6.8 Reportes — INTEGRATION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Filtrar información financiera, guardar presupuestos y exportar CSV. UR-002, UR-006; US-011. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** mock financiero, presupuestos locales y exportación declarada. IRM §4–5. |
| Dependencias e integración | Debería consumir pagos/movimientos y abrir entidades; hoy usa datos propios y contrato invoice/factura conflictivo. SR-006, SR-015, SR-021. |
| Brechas, roles y Bitácora | Operativo; cuatro acciones ActivityLog; deep link y fuente financiera no canónicos. IRM §7,12,14. |
| Validación pendiente | Filtros, rango, presupuesto, CSV, navegación, volumen, a11y y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Exportación y datos financieros requieren validar acceso, minimización y contenido. SR-024, SR-025. |
| Siguiente acción | Definir fuente de pagos y contrato de identificador antes de auditoría integrada. |

### 6.9 Categorías — INTEGRATION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Mantener categorías de gasto y preservar referencias usadas. UR-003; US-012. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** mock y overlay local; inactivación si está usada. IRM §4–5,12. |
| Dependencias e integración | Provee clasificación a Movimientos y Reportes; consumidores no leen el overlay. SR-003, SR-017. |
| Brechas, roles y Bitácora | Operativo; seis acciones ActivityLog; vigencia/histórico no compartidos. IRM §7,12. |
| Validación pendiente | Nombre único, presupuesto, uso, inactivación, errores, teclado y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Clasificación financiera local; corrupción y consistencia requieren SR-026 y SR-028. |
| Siguiente acción | Definir contrato vigente/histórico y luego auditar Categorías→Movimientos/Reportes. |

### 6.10 Servicios — INTEGRATION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Mantener catálogo de servicios, tarifa, unidad y moneda. UR-003; US-013. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** mock más overlay local. IRM §4–5. |
| Dependencias e integración | Proveedor de Propuestas, Proyectos y Facturas; consumo desigual y snapshots parciales. SR-003, SR-014; IRM §10,12. |
| Brechas, roles y Bitácora | Operativo; cinco acciones ActivityLog; catálogo vigente frente a snapshot y moneda pendientes. IRM §7,12,16. |
| Validación pendiente | CRUD, validaciones, moneda, estado, consumidores, a11y y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Integridad comercial y moneda **BLOQUEADO** por SR-026 y PO-003. |
| Siguiente acción | Resolver semántica de catálogo/snapshot antes de auditoría cruzada. |

### 6.11 Propuestas — PARTIAL

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Preparar propuestas, avanzar estados y convertir una aceptada. UR-004; US-014. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** estados locales y payload de sesión hacia Proyectos. IRM §4–5,9. |
| Dependencias e integración | Consume Cliente/Servicio y produce Proyecto; consistencia de snapshots parcial. SR-004, SR-011, SR-014, SR-018. |
| Brechas, roles y Bitácora | Operativo; ocho acciones ActivityLog; runtime multipágina no probado. IRM §7,9,18. |
| Validación pendiente | Estados válidos, datos, conversión única, reconciliación, errores y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Datos comerciales y PII; integridad referencial **BLOQUEADO** por SR-025–026. |
| Siguiente acción | Auditar antes de Proyectos con snapshots explícitos y doble intento de conversión. |

### 6.12 Configuración fiscal — DECISION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Configurar y previsualizar una estimación fiscal local. UR-006; US-015. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** configuración local y base fija de ejemplo. IRM §4–5,12. |
| Dependencias e integración | Deriva estimación local; Facturas no consume la configuración. SR-006, SR-020. |
| Brechas, roles y Bitácora | Operativo; dos acciones ActivityLog; jurisdicción y alcance no aprobados. IRM §7,12,14. |
| Validación pendiente | Tasas válidas/inválidas, etiqueta, base, persistencia, a11y y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Cumplimiento fiscal no evaluado; no afirmar obligación ni exactitud legal. **BLOQUEADO** por PO-004. |
| Siguiente acción | Resolver PO-004; mantener estimación local hasta decisión y auditar antes de Facturas. |

### 6.13 Ajustes — DECISION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Guardar/restaurar preferencias operativas de facturación. UR-007; US-016. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** preferencias locales de prefijo, moneda y plazo. IRM §4–5,12. |
| Dependencias e integración | Debería configurar Facturas; Facturas fija otros valores. SR-007, SR-022, SR-028. |
| Brechas, roles y Bitácora | Operativo; tres acciones ActivityLog; contrato Ajustes→Facturas en **CONFLICTO**. IRM §7,12,14. |
| Validación pendiente | Guardar, restaurar, validar y comprobar consumidor futuro: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Defaults financieros requieren dueño único y control de cambios; PO-003/004. |
| Siguiente acción | Resolver SR-022 antes de interpretar preferencias como configuración efectiva. |

### 6.14 Notificaciones — INTEGRATION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Consultar alertas, lectura, preferencias y navegación relacionada. UR-007; US-017. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** alertas derivadas y preferencias locales. IRM §4–5,12. |
| Dependencias e integración | Debería recibir eventos de pago y abrir entidad exacta; hoy solo lleva destino de módulo sin ID. SR-007, SR-015, SR-021. |
| Brechas, roles y Bitácora | Operativo; dos acciones ActivityLog; no recibe pago y carece de deep link canónico. IRM §7,10,12,14. |
| Validación pendiente | Lectura, preferencias, datos vacíos, ID válido/inválido, a11y y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Alertas pueden exponer datos; acceso, minimización y persistencia **BLOQUEADO** por SR-024–025. |
| Siguiente acción | Definir contrato de evento e identificador antes de auditoría integrada. |

### 6.15 Cuenta/Perfil — DECISION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Mantener identidad básica local sin presentarla como cuenta financiera. UR-007; US-018. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** perfil local separado de actor de sesión y usuario mock. IRM §4–6,14. |
| Dependencias e integración | Debería alimentar shell, Dashboard y Bitácora; hoy existen tres fuentes. SR-007, SR-016. |
| Brechas, roles y Bitácora | Operativo; dos acciones ActivityLog; identidad fragmentada y rol no aprobado. IRM §7,10,14. |
| Validación pendiente | Validaciones, persistencia, consumidores, teclado y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | PII local; acceso, retención y borrado **BLOQUEADO** por PO-001/008 y SR-025. |
| Siguiente acción | Resolver significado de Cuenta y fuente de identidad antes de auditoría transversal. |

### 6.16 Bitácora — DECISION_BLOCKED

| Campo | Estado y evidencia |
|---|---|
| Propósito y actor | Permitir al perfil administrativo consultar actividad operativa. UR-008; US-019. TRU §4,6,9. |
| AS-IS, datos y persistencia | **CONFIRMADO:** log de sesión con id, fecha, actor, perfil, módulo, acción y descripción; máximo 80, borrable y con deduplicación consecutiva. IRM §7. |
| Dependencias e integración | Consume ActivityLog de módulos operativos; no registra actividad administrativa ni se autoaudita. SR-008, SR-010, SR-012, SR-027. |
| Brechas, roles y Bitácora | Acceso administrativo cliente; cobertura, retención, inmutabilidad y permiso de borrado **BLOQUEADO**. IRM §6–7,14–15. |
| Validación pendiente | Acceso, listado, filtro, vacío, limpieza, productor→consumidor, teclado y responsive: **ENVIRONMENT_UNVERIFIED**. |
| Seguridad y privacidad | Contiene actividad y actor; política de acceso/retención/borrado no definida. PO-008/009; SR-024, SR-027. |
| Siguiente acción | Resolver roles y política de auditoría antes de usarla como evidencia confiable. |

### 6.17 Conteo de readiness

| Readiness | Módulos | Conteo |
|---|---|---:|
| READY_FOR_AUDIT | Landing | 1 |
| PARTIAL | Dashboard, Movimientos, Proyectos, Propuestas | 4 |
| INTEGRATION_BLOCKED | Clientes, Reportes, Categorías, Servicios, Notificaciones | 5 |
| DECISION_BLOCKED | Acceso, Facturas, Configuración fiscal, Ajustes, Cuenta/Perfil, Bitácora | 6 |
| FUTURE_ONLY | Ninguno de los 16 módulos actuales | 0 |
| **Total** | 16 módulos canónicos | **16** |

## 7. Matriz de 15 integraciones consideradas

| # | Origen → destino | Contrato esperado | AS-IS y evidencia | Brecha, razón y riesgo | Dependencia / decisión | Prioridad | Resultado esperado y límite | Prueba real futura | Trazabilidad |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | Perfil operativo → 13 módulos operativos | Abrir solo superficies operativas previstas | **CONFIRMADO:** sessionStorage y guardas cliente. IRM §6,9 | Manipulable; riesgo de acceso e interpretación de rol | PO-006, PO-008 | P0 | Rutas permitidas/denegadas coherentes; no concluir autorización real | Perfil válido, ausente, desconocido y URL directa | UR-001, UR-008; SR-009; US-005 |
| 2 | Perfil administrativo → Bitácora | Abrir Bitácora y rechazar rutas operativas | **CONFIRMADO:** cableado cliente. IRM §6,9 | Rol canónico no decidido; auditoría sin actor confiable | PO-008, PO-009 | GATE | Matriz de rutas definida; no concluir permiso seguro | Perfil admin, rutas directas y acciones operativas | UR-008; SR-010; US-005, US-019 |
| 3 | Propuesta aceptada → Proyecto | Conversión única, reconciliada y referenciada | **CONFIRMADO:** payload de sesión consumido. IRM §9 | Flujo multipágina no probado; duplicación/estado comercial | PO-007; snapshots de Cliente/Servicio | P1 | Un proyecto por propuesta; no concluir runtime actual | Aceptar, convertir dos veces y volver a Propuestas | UR-004; SR-011; US-009, US-014 |
| 4 | Módulos operativos → Bitácora | Evento consultable una vez con actor/módulo/acción/fecha | **CONFIRMADO:** ActivityLog compartido de sesión. IRM §7,9 | Cobertura, retención e inmutabilidad incompletas | PO-008/009; política de auditoría | P1 | Eventos mínimos trazables; no concluir compliance | Producir, consultar, filtrar y limpiar evento | UR-008; SR-012, SR-027; US-019 |
| 5 | Landing → Acceso → perfil | Navegación demo y sesión explícita | **CONFIRMADO:** implementación parcial. IRM §10 | Sin identidad, alta ni logout; continuidad de entrada | PO-006/008 para evolución | P2 | CTA y redirección observables; no llamar login | CTA, perfil, retorno y sesión nueva | UR-001; SR-013; US-004, US-005 |
| 6 | Servicios → Propuestas/Proyectos/Facturas | Catálogo vigente o snapshot histórico explícito | **CONFIRMADO:** consumo parcial; overlay aislado. IRM §10,12 | Tarifa/moneda pueden divergir entre documentos | Política vigente/snapshot; PO-003 | P1 | Versión identificable; no asumir propagación actual | Editar Servicio y abrir tres consumidores | UR-003, UR-004, UR-005; SR-014; US-009, US-010, US-013, US-014 |
| 7 | Facturas → Movimientos/Reportes/Notificaciones | Efectos de pago únicos y reversibles | **CONFIRMADO:** pago aislado en Facturas. IRM §10,14 | Riesgo financiero por duplicación, ausencia o reversión parcial | Decisión de efectos; PO-003/004 | GATE | Contrato de efectos aprobado; no afirmar automatización actual | Registrar, editar y revertir pago en consumidores | UR-002, UR-005; SR-015, SR-026; US-007, US-010, US-011, US-017 |
| 8 | Cuenta/Perfil → shell/Dashboard/Bitácora | Una identidad coherente para consumidores definidos | **CONFIRMADO:** tres fuentes desconectadas. IRM §10,14 | Actor y perfil pueden divergir; riesgo de acceso y auditoría | PO-001, PO-006, PO-008 | P0 | Fuente y precedencia únicas; no concluir identidad real | Editar perfil y comparar cuatro superficies | UR-007, UR-008; SR-016; US-006, US-018, US-019 |
| 9 | Categorías → Movimientos/Reportes | Vigencia e histórico coherentes | **CONFIRMADO:** solo mock compartido; overlay no consumido. IRM §12 | Clasificación financiera inconsistente | Contrato de fuente única/histórico | P1 | Categoría identificable; no asumir sync actual | Crear/inactivar y usar en movimiento/reporte | UR-003; SR-017; US-007, US-011, US-012 |
| 10 | Clientes → Propuestas/Proyectos/Facturas | Datos vigentes o snapshot identificado | **CONFIRMADO:** solo baseline mock compartido. IRM §12 | PII y referencia comercial pueden divergir | Política vigente/snapshot; SR-025/026 | P1 | Referencia consistente; no asumir overlay compartido | Editar Cliente y abrir tres consumidores | UR-003, UR-004, UR-005; SR-018; US-008, US-009, US-010, US-014 |
| 11 | Proyectos → tiempo/costo/ganancia | Métricas con inputs y período visibles | **CONFIRMADO:** derivación local. IRM §12 | Inputs, zona y período no canónicos; interpretación de rentabilidad | PO-010; política temporal SR-031 | P2 | Cálculo reproducible; no afirmar fuente transversal | Caso conocido, bordes y cambio de período | UR-002, UR-004; SR-019, SR-031; US-009 |
| 12 | Configuración fiscal → estimaciones | La estimación usa configuración y base visibles | **CONFIRMADO:** estimación con base fija; Facturas no consume la configuración. IRM §12,14 | Base y alcance fiscal no aprobados; la ausencia de consumo por Facturas es una brecha contextual, no otro destino | PO-004 | GATE | Estimación local trazable; no afirmar obligación fiscal ni propagación a Facturas | Tasas válidas/inválidas, previsualización y persistencia | UR-006; SR-020; US-015 |
| 13 | Notificaciones → entidad relacionada | Navegar a entidad exacta mediante ID canónico | **CONFIRMADO:** solo destino de módulo. IRM §12,14 | Puede abrir pantalla equivocada o sin contexto | Contrato de identificadores; eventos de pago | P2 | Entidad exacta o error seguro; no asumir deep link actual | ID válido, inválido y ausente | UR-006, UR-007; SR-021; US-011, US-017 |
| 14 | Ajustes → Facturas | Un dueño de prefijo, moneda, vencimiento e impuestos | **CONFLICTO:** Ajustes promete config; Facturas fija valores. IRM §12,14 | Documentos inconsistentes y defaults invisibles | PO-003, PO-004 | GATE | Contrato único aprobado; no elegir fuente aquí | Cambiar ajuste y crear factura tras decisión | UR-005, UR-007; SR-022; US-010, US-016 |
| 15 | Movimientos → Dashboard | Reflejar alta/edición una vez en el resumen | **CONFIRMADO:** clave local compartida adicional. IRM §9 | Runtime no probado; Reportes/Notificaciones siguen aislados | Semántica temporal SR-031 | P2 | Resumen sin duplicado; no extender efecto a otros módulos | Alta, edición, recarga y resumen | UR-001, UR-002; SR-002; US-006, US-007 |

### 7.1 Conteo de prioridad de las 15 brechas de integración

| Prioridad | Conteo |
|---|---:|
| GATE | 4 |
| P0 | 2 |
| P1 | 5 |
| P2 | 4 |
| P3 | 0 |
| **Total** | **15** |

## 8. Brechas transversales

Estas filas reutilizan las prioridades de §3.4. No se suman al conteo de §7.1 para evitar doble contabilización.

| Tema | Clasificación | Evidencia y brecha | Prioridad | Dependencia / decisión | Resultado esperado | Qué no puede concluirse |
|---|---|---|---|---|---|---|
| Fuente única de datos | **BLOQUEADO** | 19 claves sin repositorio ni transacción común. IRM §5,15; TRU §11 | GATE | Contrato de fuente y precedencia | Dueño por entidad y reglas de lectura/escritura | No se aprueba backend ni base de datos |
| Mocks desincronizados | **CONFLICTO** | JSON y fallback JS no son equivalentes. IRM §5.3,14 | P0 | Contrato de fallback y versión | Baseline reproducible o error seguro | No se afirma modo offline |
| Overlays locales | **BLOQUEADO** | Clientes, Categorías y Servicios no propagan cambios. IRM §12 | P0 | Vigencia frente a snapshot | Consumidores coherentes o snapshot explícito | No se asume sincronización actual |
| Identidad y roles | **BLOQUEADO** | Perfiles cliente e identidad triple. IRM §6,14–15; SR-016/024 | GATE | PO-006, PO-008, PO-009 | Actor y permisos aprobados | No existe autenticación/autorización real |
| Privacidad | **BLOQUEADO** | PII y finanzas en storage sin política. IRM §5,15; SR-025 | GATE | Finalidad, acceso, retención y borrado | Política trazable antes de persistencia compartida | No se afirma cumplimiento legal |
| Pagos | **BLOQUEADO** | Pago aislado en Facturas. IRM §10,14; SR-015/026 | GATE | Efectos, atomicidad y reversión | Operación única o ninguna | No se crean Movimientos/Reportes/alertas hoy |
| Movimientos | **CONFIRMADO** parcial AS-IS | Solo Dashboard consume overlay. IRM §9–10 | P1 | Contratos de Categorías, Clientes y pago | Flujo financiero coherente | No se amplía integración sin prueba |
| Reportes | **BLOQUEADO** | Datos propios, deep link conflictivo y sin pago. IRM §10,12,14 | P1 | Fuente financiera e ID canónico | Reporte y exportación desde datos trazables | No se inventan gráficos ni métricas |
| Notificaciones | **BLOQUEADO** | Destino sin ID y sin eventos de pago. IRM §10,12 | P1 | Contrato de eventos/deep links | Alerta abre entidad exacta | No se afirma entrega externa |
| Ajustes–Facturas | **CONFLICTO** | Prefijo, moneda y plazo divergen. IRM §12,14; SR-022 | GATE | PO-003, PO-004 | Un dueño funcional | No se elige Ajustes o Facturas |
| Fiscal–Facturas | **CONFLICTO** | Estimación usa base fija y Facturas ignora config. IRM §12,14; SR-020/022 | GATE | PO-004 | Alcance y consumidor definidos | No se afirma cálculo fiscal real |
| Multi-moneda | **BLOQUEADO** | Moneda documentada y defaults no conforman contrato. BL §16; IRM §14 | GATE | PO-003 | Regla única o alcance explícito | No se promete multimoneda |
| Semántica temporal | **BLOQUEADO** | Reloj local y fechas fijas divergen. IRM §14,16; SR-031 | GATE | Zona, calendario y períodos | Clasificación temporal reproducible | No se fijan valores sin decisión |
| Frontend-only frente a futura | **PROPUESTO** | Stack futuro no aprobado. BL §12,16; PO-011 | P3 | PH-004, PO-011 | Decisión arquitectónica posterior | No se promueve React/Django/PostgreSQL/Expo |
| PDF | **ENVIRONMENT_UNVERIFIED** | jspdf declarado pero no materializado; sin navegador. IRM §3,18; SR-005 | P2 | Dependencia y ejecución futura autorizada | Evidencia reproducible de descarga/contenido | No se declara correcto ni roto |
| Bitácora y trazabilidad | **BLOQUEADO** | Log efímero, borrable, incompleto y sin autoauditoría. IRM §7,14–15; SR-027 | GATE | PO-008/009 y política de eventos | Cobertura, retención e inmutabilidad definidas | No se afirma compliance |

## 9. Roadmap recomendado por dependencias

No contiene fechas ni esfuerzo. Cada etapa solo inicia cuando su criterio de entrada esté satisfecho.

| Etapa | Prioridad | Entrada necesaria | Trabajo recomendado | Evidencia / criterio de salida | Qué no concluye |
|---:|---|---|---|---|---|
| 1 | GATE | Cuatro fuentes congeladas y 12 preguntas PO | Resolver PO-008/006/001/003/004/007/010/009/005/002/PH-004/PO-011; definir efectos de pago | Registro firmado de decisiones y elementos diferidos | No implementa ninguna opción |
| 2 | P0 | Decisiones de identidad, dinero y datos aplicables | Definir fuente por entidad, snapshots, IDs, temporalidad, pago/reversión, privacidad y auditoría | Contratos verificables ligados a UR/SR/US | No selecciona stack futuro |
| 3 | P0/P1 | Contratos centrales aprobados | Priorizar Facturas↔Movimientos/Reportes/Notificaciones, catálogos→consumidores e identidad→consumidores | Casos productor→consumidor y fallos seguros definidos | No afirma runtime hasta auditar |
| 4 | P0 | Roles y política de datos aprobados | Validar acceso, actor, eventos, retención, borrado e integridad | Matrices de permiso/datos/eventos | No equivale a certificación |
| 5 | P1/P2 | Definition of Ready de §12 | Ejecutar auditorías reales en el orden de §10 | Evidencia por módulo y estado trazable | No autoriza correcciones automáticas |
| 6 | P2 | Flujos centrales auditados y brechas críticas registradas | Corregir y validar UX, accesibilidad, responsive, rendimiento, copy, consola y red | Mediciones y regresiones reproducibles | No usa umbrales no aprobados |
| 7 | P3 | Problema, límites y roadmap aprobados | Evaluar arquitectura futura y migración mediante decisión separada | ADR o rechazo explícito de opciones | No asume React, Django, PostgreSQL, Expo o portal |

## 10. Orden de auditoría módulo por módulo

El orden es **INFERIDO** por dependencias. Si un gate sigue abierto, la auditoría termina **BLOQUEADO** con evidencia; no se fuerza un PASS.

| Posición | Módulo | Por qué aquí | Dependencias previas | Flujos a recorrer | Evidencia futura | Criterio de salida |
|---:|---|---|---|---|---|---|
| 1 | Landing | Establece entrada pública sin depender de datos | Snapshot y rutas | Carga, CTA, enlaces y propuesta | DOM, teclado, responsive, consola/red | CTA observable o brecha registrada |
| 2 | Acceso | Define perfil y rutas para todo lo protegido | Landing; PO-006/008 como gate interpretativo | Operativo, administrativo, ausente, inválido, URL directa | Matriz ruta/perfil y sesión | Demo descrito o bloqueado; nunca auth asumida |
| 3 | Bitácora | Permite observar eventos de módulos posteriores | Acceso; PO-008/009; política de eventos | Listado, filtro, vacío, limpieza, acceso denegado | Eventos y campos consumidos | Canal observable o cobertura bloqueada |
| 4 | Cuenta/Perfil | Aclara fuente de identidad antes de comparar consumidores | Acceso/Bitácora; PO-001/008 | Ver, editar, validar, recargar | Antes/después en Cuenta, shell, Dashboard y Bitácora | Divergencia localizada o fuente aprobada |
| 5 | Dashboard | Fija resumen que consumirá Movimientos | Acceso; semántica temporal documentada | Carga/error/vacío/contenido | Estados y datos base | Resumen reproducible o bloqueo temporal |
| 6 | Movimientos | Es productor real del Dashboard | Dashboard; catálogos base | Crear, editar, buscar, filtrar, recargar | Storage y resumen sin duplicado | CRUD y salida observables |
| 7 | Clientes | Primer catálogo con PII y múltiples consumidores | Política privacidad/snapshot | CRUD B2B, contacto, unicidad, inactivación | Registro local y consumidor comparado | Aislado documentado o contrato validado |
| 8 | Categorías | Clasificación usada por Movimientos/Reportes | Movimientos; histórico acordado | Crear, editar, usar, inactivar | Referencia antes/después | Histórico consistente o bloqueo |
| 9 | Servicios | Base comercial de Propuestas/Proyectos/Facturas | PO-003; política snapshot | CRUD, tarifa, unidad, moneda | Consumidores comparados | Versión identificable o bloqueo |
| 10 | Propuestas | Inicia flujo comercial cableado | Clientes, Servicios | Crear, editar, transiciones, aceptar, convertir | Estado y payload | Conversión única demostrada o brecha |
| 11 | Proyectos | Consume Propuesta y deriva métricas | Propuestas; PO-007/010 | Conversión, CRUD, estados, métricas | Origen, inputs y cálculo | Reconciliación y métricas trazables |
| 12 | Ajustes | Define defaults antes de Facturas | PO-003/004 | Guardar, restaurar, validar | Preferencia local y contrato esperado | Conflicto resuelto o gate explícito |
| 13 | Configuración fiscal | Define alcance antes de Facturas | PO-004 | Tasas válidas/inválidas, previsualizar, guardar | Base, tasas y etiqueta | Estimación claramente limitada |
| 14 | Facturas | Centro financiero depende de catálogos/defaults | Clientes, Servicios, Ajustes, Fiscal y decisión de pago | CRUD, estados, pago, reversión, PDF | Aritmética, storage, consumidores y descarga | Integridad demostrada o gate; PDF puede quedar ENVIRONMENT_UNVERIFIED |
| 15 | Reportes | Consume resultados financieros | Facturas, Movimientos, proyectos e IDs | Filtros, presupuesto, CSV, deep link | Filas, archivo y navegación | Datos trazables o integración bloqueada |
| 16 | Notificaciones | Último consumidor de eventos y navegación | Facturas, Reportes e IDs | Lectura, preferencias, derivación, abrir entidad | Evento→alerta→entidad | Entidad exacta o error seguro |

Evidencia del orden y flujos: IRM §4,9–12,14–16; TRU §6–11.

## 11. Protocolo reutilizable de auditoría modular

Estado del protocolo: **PROPUESTO** para ejecuciones futuras; no se ejecutó en esta fase.

1. **Congelar alcance y Git.** Registrar rama, HEAD, origin/main, status y hashes autorizados; no limpiar cambios.
2. **Cargar contexto mínimo.** Leer la ficha de §6, UR/SR/US, gates y solo el código/rutas del módulo y dependencias inmediatas.
3. **Trazar arquitectura AS-IS.** Identificar entrada, controlador, datos, storage, productor, consumidor y fallbacks sin diseñar TO-BE.
4. **Preparar datos controlados.** Definir baseline, reset seguro y casos válido, vacío, inválido y corrupto sin modificar mocks permanentes.
5. **Recorrer como usuario real.** Ejecutar flujo principal, alternativas, errores, recarga, navegación directa y recuperación.
6. **Validar integraciones.** Probar productor→consumidor, exactamente una vez, identificadores, snapshots y reversión cuando aplique.
7. **Validar roles.** Probar actor permitido, denegado, ausente y manipulado; separar navegación cliente de autorización.
8. **Validar Bitácora.** Confirmar acción, actor, módulo, descripción, fecha, duplicados, limpieza y cobertura esperada.
9. **Validar persistencia.** Inspeccionar claves, formato, actualización, borrado, corrupción, precedencia y aislamiento entre pruebas.
10. **Validar seguridad y privacidad.** Revisar exposición, manipulación, PII, datos financieros, minimización, retención y límites de confianza; no afirmar cumplimiento.
11. **Medir rendimiento.** Registrar carga e interacción con herramientas aprobadas; no inventar umbrales ni conclusiones sin medición.
12. **Validar accesibilidad y responsive.** Teclado, foco, etiquetas, contraste, estados, zoom y viewports aprobados.
13. **Inspeccionar consola y red.** Cero errores no explicados; solicitudes, fallos, descargas y navegación coherentes con el prototipo.
14. **Ejecutar regresión mínima.** Checks del módulo, integración y rutas vecinas autorizados; registrar comando y resultado.
15. **Verificar higiene Git.** Revisar status/diff; ninguna captura, log, cache o cambio no autorizado.
16. **Cerrar con evidencia.** Clasificar cada hallazgo, enlazar UR/SR/US/integración y devolver CONFIRMADO, BLOQUEADO, CONFLICTO o ENVIRONMENT_UNVERIFIED. Las correcciones requieren autorización separada.

## 12. Definition of Ready para auditar un módulo

Un módulo está listo para iniciar auditoría cuando:

- [ ] Snapshot, rama, status y fuentes están registrados.
- [ ] Módulo, actor, rutas, UR, SR y US están identificados.
- [ ] Readiness actual y gates abiertos están visibles.
- [ ] Entradas y salidas de integración están delimitadas.
- [ ] Fuente de datos, claves de persistencia y política de reset están documentadas.
- [ ] Flujos principal, alternativos, errores y estados aplicables están definidos.
- [ ] Roles permitidos/denegados y expectativas de Bitácora están declarados.
- [ ] Viewports, validaciones y evidencia a producir están acordados.
- [ ] Comandos permitidos y restricciones de edición/publicación están explícitos.
- [ ] El worktree está limpio o sus cambios preexistentes están inventariados y protegidos.

Si falta una decisión que cambia el significado del flujo, el estado es **DECISION_BLOCKED**; no se rellena el vacío con una suposición.

## 13. Definition of Done para declarar un módulo integrado

Un módulo solo puede declararse integrado cuando:

- [ ] Cada UR/SR/US aplicable tiene evidencia runtime o un bloqueo explícito.
- [ ] Flujos principal, alternativos, errores, vacío y recuperación aplicables fueron recorridos.
- [ ] Cada productor y consumidor relevante comparte el contrato aprobado y maneja IDs/snapshots.
- [ ] Persistencia, recarga, corrupción, borrado y reversión aplicables son consistentes.
- [ ] Acceso permitido/denegado fue probado en el límite disponible y sus límites están declarados.
- [ ] Eventos de Bitácora acordados aparecen una vez y con campos correctos.
- [ ] Privacidad, datos financieros y exposición tienen decisión/evidencia suficiente.
- [ ] Accesibilidad, responsive, rendimiento, consola y red tienen evidencia y no afirmaciones.
- [ ] Regresiones autorizadas pasan o están documentadas como bloqueo.
- [ ] No quedan GATE, P0 o P1 aplicables sin resolución o aceptación explícita.
- [ ] Git contiene únicamente cambios autorizados; publicación sigue siendo una acción separada.

Ningún módulo satisface esta Definition of Done en la Fase 5 porque no hubo ejecución real. Readiness de §6 solo determina si puede comenzar a auditarse.

## 14. Plantilla de prompt para auditoría modular posterior

~~~text
AUDITORÍA MODULAR — {{NOMBRE_MODULO}}

Proyecto/worktree: {{WORKTREE}}
Rama y snapshot esperado: {{RAMA_Y_SHA}}

Fuentes autorizadas:
- {{FUENTES_Y_HASHES}}

Alcance:
- Módulo: {{NOMBRE_MODULO}}
- Requisitos: {{UR_Y_SR}}
- Historias: {{US}}
- Integraciones entrantes/salientes: {{INTEGRACIONES}}
- Rutas y archivos permitidos: {{RUTAS}}
- Datos, mocks y persistencia: {{DATOS}}
- Actores y roles: {{ROLES}}
- Eventos esperados de Bitácora: {{EVENTOS_BITACORA}}
- Flujos principal, alternativos y errores: {{FLUJOS}}
- Viewports/dispositivos: {{VIEWPORTS}}
- Validaciones y comandos autorizados: {{VALIDACIONES}}
- Correcciones permitidas: {{CORRECCIONES}}
- Publicación opcional: {{PUBLICACION_AUTORIZADA = NO}}

Objetivo:
Auditar el módulo como usuario real contra los requisitos y contratos indicados. No conviertas el AS-IS en intención aprobada y no resuelvas gates abiertos.

Procedimiento:
1. Verifica Git, hashes y cambios preexistentes.
2. Lee requisitos, módulo y dependencias inmediatas.
3. Traza rutas, datos, storage, productores y consumidores.
4. Recorre todos los flujos y roles autorizados.
5. Valida Bitácora, persistencia, seguridad, privacidad, accesibilidad, responsive, rendimiento, consola, red y regresiones.
6. Vincula cada hallazgo con UR/SR/US/integración y clasifícalo.
7. Si se autorizan correcciones, aplica la mínima corrección de causa raíz y repite solo las validaciones afectadas.
8. Entrega evidencia, bloqueos y estado final según Definition of Done.

Restricciones:
- No instales herramientas o dependencias sin autorización.
- No cambies mocks o contratos fuera del alcance.
- No declares autenticación, pago, fiscalidad, PDF o integración sin evidencia.
- No hagas commit, push, PR, issue o despliegue salvo autorización explícita posterior.
- Si Publicación opcional sigue en NO, detente después del informe y git status.
~~~

## 15. Riesgos y limitaciones residuales

| Riesgo | Estado | Evidencia | Tratamiento |
|---|---|---|---|
| Snapshot separado de refs/heads/main | **CONFIRMADO** | Preflight Git de Fase 5 | Mantener auditoría en 097d0a2; no mezclar cambios posteriores |
| Navegador no ejecutado | **ENVIRONMENT_UNVERIFIED** | IRM §18; TRU §17 | Ejecutar auditorías futuras con evidencia |
| PDF sin dependencia materializada | **ENVIRONMENT_UNVERIFIED** | IRM §3; SR-005 | Verificar solo cuando entorno lo permita |
| Identidad y permisos cliente | **BLOQUEADO** | IRM §6,15; SR-024 | Resolver PO-006/008 y probar límite confiable |
| PII y finanzas en storage | **BLOQUEADO** | IRM §5,15; SR-025/026 | Aprobar política antes de persistencia compartida |
| Datos y overlays aislados | **BLOQUEADO** | IRM §5,12; SR-014/017/018 | Definir fuente y snapshots |
| Pago sin efectos transversales | **BLOQUEADO** | IRM §10,14; SR-015/026 | Definir atomicidad/reversión |
| Defaults de Facturas | **CONFLICTO** | IRM §12,14; SR-020/022 | Resolver PO-003/004 |
| Fechas y períodos | **BLOQUEADO** | IRM §14,16; SR-031 | Aprobar semántica temporal |
| Arquitectura futura | **PROPUESTO** | BL §12,16; PO-011 | Evaluar después de producto y contratos |
| Portal externo | **PROPUESTO** | BL §12,14; UR-009 | No crear US ni superficie hasta aprobación |
| Cumplimiento fiscal/legal | **ENVIRONMENT_UNVERIFIED** | TRU §2.3,8,17 | No afirmar cumplimiento sin jurisdicción/evidencia |

## 16. Próximo paso recomendado

1. **Decisiones PO:** presentar §4 al Product Owner y registrar respuesta, diferimiento o rechazo sin iniciar implementación.
2. **Contratos de producto:** con esas respuestas, cerrar fuente de datos, identidad, pago/reversión, privacidad, auditoría, identificadores y tiempo.
3. **Auditoría real:** aplicar §11 al orden de §10; empezar por Landing y Acceso, cerrando como **BLOQUEADO** cuando corresponda.
4. **Implementación:** corregir únicamente hallazgos autorizados después de cada auditoría y repetir evidencia afectada.
5. **Arquitectura futura:** evaluar opciones solo después de PO-011 y PH-004; hasta entonces permanece **PROPUESTO**.

**Cierre:** la auditoría documental queda trazada; la validación funcional de los módulos todavía no se ejecutó.
