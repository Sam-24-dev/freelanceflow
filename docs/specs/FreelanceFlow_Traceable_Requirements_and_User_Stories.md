# FreelanceFlow — Requisitos trazables e historias de usuario

Public-safe normalization: machine-local metadata was generalized without changing product evidence or business conclusions.
**Estado:** BORRADOR — Fase 4 de 5
**Snapshot:** `origin/main@097d0a2cef3455a6b7956c1fe0bb3c792f19f287`
**Rama:** `docs/product-requirements-baseline`
**Worktree:** `<audit-worktree>`
**Validación:** documental; sin npm, build, servidor ni navegador
**Fecha de corte:** 2026-07-18

> Esta línea base reconcilia intención documental y realidad implementada. Un comportamiento existente no se convierte automáticamente en requisito aprobado. Las propuestas futuras, conflictos y decisiones pendientes permanecen visibles.

## 1. Propósito, snapshot y alcance

### 1.1 Conclusiones útiles

1. El problema y valor centrales están respaldados: FreelanceFlow busca reducir la fragmentación de la operación comercial y financiera del freelancer y mejorar visibilidad de cobros, flujo y rentabilidad. Evidencia: BL §3-4.
2. Esta línea base contiene **9 requisitos de usuario (UR), 31 requisitos del sistema (SR) y 16 historias de usuario (US)**. Las 16 historias cubren, una por una, las 16 superficies visibles inventariadas. Evidencia de superficie: SM §5; IRM §4.
3. Los primeros 8 SR agrupan capacidades funcionales; `SR-009…SR-022` cubren exactamente las **14 integraciones obligatorias** de Fase 3; `SR-023…SR-031` registran candidatos no funcionales sin inventar métricas.
4. Las 14 integraciones conservan su realidad AS-IS: 4 reales, 4 parciales, 2 basadas solo en mock compartido, 2 derivaciones locales, 1 solo navegación y 1 en conflicto. Evidencia: IRM §1.2.
5. Las mayores brechas son overlays locales no compartidos, efectos de pago aislados, identidad fragmentada, el conflicto Ajustes–Facturas y guardas de perfiles que no equivalen a autorización. Evidencia: IRM §5,10,12,14-15.
6. Las **12 decisiones del Product Owner** de BL §16 se conservan sin exigir respuesta. Ninguna capacidad condicionada por ellas se presenta como aprobada.
7. La generación PDF permanece `ENVIRONMENT_UNVERIFIED`: `jspdf` está declarado, `node_modules` no estaba materializado y Fase 3 terminó 140/141 por `MODULE_NOT_FOUND`. Evidencia: IRM §3.
8. React/Vite, Django/DRF/JWT, PostgreSQL, Expo y el portal externo continúan como `PROPUESTO`, no como arquitectura aprobada. Evidencia: BL §8,12,16; SM §5.3.
9. Esta fase no evalúa runtime, calidad visual, seguridad efectiva, rendimiento, cumplimiento legal ni implementación futura. Evidencia: SM §10; IRM §2.4,18.

### 1.2 Conteo por estado de evidencia de los catálogos UR/SR/US

| Estado | UR | SR | US | Total |
|---|---:|---:|---:|---:|
| `CONFIRMADO` | 6 | 7 | 0 | 13 |
| `INFERIDO` | 1 | 6 | 14 | 21 |
| `PROPUESTO` | 1 | 7 | 0 | 8 |
| `BLOQUEADO` | 1 | 10 | 1 | 12 |
| `CONFLICTO` | 0 | 1 | 1 | 2 |
| `OBSOLETO` | 0 | 0 | 0 | 0 |
| `FUERA_DE_ALCANCE` | 0 | 0 | 0 | 0 |
| **Total** | **9** | **31** | **16** | **56** |

`OBSOLETO` y `FUERA_DE_ALCANCE` sí se usan para fuentes o temas en las secciones 12 y 17; no se les asignó un ID de requisito porque no deben entrar al backlog aprobado.

### 1.3 AS-IS y TO-BE

| Plano | Estado |
|---|---|
| AS-IS confirmado | Frontend multipágina estático, HTML/CSS/JavaScript, mocks y storage del navegador; 16 superficies, 32 JavaScript, 19 claves de persistencia. Evidencia: BL §7,11; IRM §1,4-5. |
| AS-IS no demostrado | Funcionamiento en navegador, E2E, seguridad real, accesibilidad efectiva, responsive real, rendimiento, PDF y descargas. Evidencia: IRM §3,18. |
| TO-BE documentado | Backend/API/BD, autenticación, móvil, portal externo y persistencia central. Estado: `PROPUESTO`. Evidencia: BL §12; SM §5.3. |
| TO-BE aprobado | No existe una arquitectura futura aprobada en las fuentes congeladas. Evidencia: BL §12,16 (PO-011). |

## 2. Fuentes y reglas de evidencia

### 2.1 Fuentes primarias congeladas

| Alias | Ruta | SHA-256 previo a Fase 4 | Uso |
|---|---|---|---|
| `SM` | `docs/specs/FreelanceFlow_Product_Audit_Source_Map.md` | `8A9688926605618EDCD1B44437897EC338D0FCAF611908FBA4B6756A39B933C4` | Autoridad, vigencia, conflictos y fuentes obsoletas. |
| `BL` | `docs/specs/FreelanceFlow_Product_Requirements_Baseline.md` | `612AA1C033DDD24585C4C9E2BF66A0D22155DF4B38E6914DAE5E0AD3224A5091` | Problema, valor, actores, capacidades, arquitectura y decisiones PO. |
| `IRM` | `docs/specs/FreelanceFlow_Implementation_Reality_Matrix.md` | `7D1F666C5B25EB52B56A9DB591150E4B7630C22DF22C8E2A4D76F7506163D501` | AS-IS, storage, pruebas, 16 módulos, 14 integraciones y brechas. |

Los hashes se calcularon mediante `Get-FileHash -Algorithm SHA256` antes de redactar. Los tres archivos permanecen inmutables durante esta fase.

### 2.2 Estados de evidencia

| Estado | Regla |
|---|---|
| `CONFIRMADO` | Respaldado directamente por intención vigente o una conclusión ya contrastada. El código solo confirma AS-IS, no aprobación. |
| `INFERIDO` | Síntesis razonable desde fuentes vigentes, identificada como tal. |
| `PROPUESTO` | Candidato de producto o futuro documentado sin aprobación. |
| `BLOQUEADO` | Depende de una decisión explícita del Product Owner o de política no definida. |
| `CONFLICTO` | Fuentes o contratos incompatibles impiden una única interpretación aprobada. |
| `OBSOLETO` | Fuente sustituida o incompatible con el snapshot. |
| `FUERA_DE_ALCANCE` | Tema que no pertenece a esta línea base o a la fase actual. |

`ENVIRONMENT_UNVERIFIED` se usa exclusivamente como estado de verificación de entorno, no como octavo estado de evidencia.

### 2.3 Reglas aplicadas

- Cada UR, SR y US enlaza fuente documental y módulos.
- La columna “implementación actual” describe AS-IS con: `COMPLETA`, `PARCIAL`, `AISLADA`, `AUSENTE`, `CONFLICTIVA` o `NO_VERIFICADA`.
- Un test o controlador existente no eleva por sí solo un requisito a `CONFIRMADO`.
- Los criterios de aceptación son observables, pero no afirman backend, autenticación, envío, pago o sincronización inexistentes.
- Los números de rendimiento, SLA, disponibilidad, concurrencia y volumen permanecen `TBD — requiere medición o decisión`.
- No se afirma cumplimiento fiscal, legal, PCI, GDPR, SOC 2 ni normativa por país.
- El contexto interno persistido se contrastó con SM, BL e IRM y no se usó como autoridad para confirmar UR, SR o US.
- El gate de skills ya estaba completado. Se usaron únicamente PRD, architecture, cognitive-doc-design y Ponytail; no se ejecutó web-quality-audit ni nueva búsqueda/instalación.

## 3. Actores y necesidades confirmadas

| Actor o contexto | Estado | Necesidad respaldada | Límite | Evidencia |
|---|---|---|---|---|
| Freelancer | `CONFIRMADO` | Centralizar operación dispersa y entender cobros, flujo, clientes, proyectos y rentabilidad. | No hay país, banco, precio o legislación confirmados. | BL §3-5 |
| Perfil operativo | `CONFIRMADO` como interfaz AS-IS | Acceder a las 13 superficies operativas del prototipo. | Que sea un rol real está `BLOQUEADO` por PO-008. | BL §9; IRM §4,6 |
| Perfil administrativo | `CONFIRMADO` como interfaz AS-IS; `BLOQUEADO` como usuario canónico | Consultar Bitácora sin acceso operativo. | Su condición de rol/segmento depende de PO-008 y PO-009. | BL §5,9; IRM §6 |
| Cliente externo | `CONFIRMADO` como actor documental | Participar en futuros flujos de factura/pago. | No tiene portal operativo; el portal por token es `PROPUESTO`. | BL §5,8,14; SM §5.3 |
| Equipo operativo pequeño | `INFERIDO` | Coordinar operación y supervisión básica. | No se usa como actor confirmado en historias; depende de PO-009. | BL §4-6,10 |
| Gestión web | `CONFIRMADO` como contexto | Administración macro y consulta. | Describe contexto, no un actor adicional. | BL §5 |
| Captura móvil | `PROPUESTO` como contexto | Registrar gastos, tiempo o pagos rápidamente. | No hay app móvil actual ni stack aprobado. | BL §5,12 |

No se introducen contadores, auditores externos, administradores adicionales, clientes finales con portal actual ni equipos empresariales.

## 4. Catálogo de requisitos de usuario

| ID | Actor | Necesidad o problema | Valor esperado | Módulos | Estado | Fuente | Decisión pendiente |
|---|---|---|---|---|---|---|---|
| UR-001 | Freelancer | Centralizar registros comerciales y financieros hoy dispersos. | Evitar reconstrucción manual de la operación. | Landing, Clientes, Proyectos, Movimientos, Facturas | `CONFIRMADO` | BL §3-4 | Ninguna para el problema central. |
| UR-002 | Freelancer | Conocer flujo, cuentas por cobrar y rentabilidad por cliente/proyecto. | Anticipar cobros y tomar decisiones con información relacionada. | Dashboard, Movimientos, Proyectos, Facturas, Reportes | `CONFIRMADO` | BL §3-6,10 | Semántica temporal y fuente única pendientes; IRM §16. |
| UR-003 | Perfil operativo | Mantener clientes B2B, categorías de gasto y servicios. | Reutilizar datos consistentes en la operación. | Clientes, Categorías, Servicios y consumidores | `CONFIRMADO` | BL §10 | Propagación transversal pendiente; IRM §12.2. |
| UR-004 | Perfil operativo | Gestionar propuestas y proyectos relacionados. | Conectar compromiso comercial, entrega y rentabilidad. | Propuestas, Proyectos | `CONFIRMADO` | BL §6,10 | PO-007 y PO-010. |
| UR-005 | Perfil operativo | Gestionar facturas y registros de pago simulados. | Conocer saldo, estado y cobro pendiente sin afirmar procesamiento real. | Facturas, Movimientos, Reportes, Notificaciones | `CONFIRMADO` | BL §8,10; IRM §4.2 | PO-003; efectos de pago por decidir. |
| UR-006 | Perfil operativo | Consultar reportes, presupuestos y estimaciones fiscales locales. | Organizar decisiones y preparación de información sin automatización tributaria. | Reportes, Configuración fiscal | `CONFIRMADO` | BL §3,6,8,10 | PO-004 y PO-005. |
| UR-007 | Perfil operativo | Gestionar preferencias, alertas e identidad local. | Personalizar el prototipo sin confundir perfil con cuenta financiera. | Ajustes, Notificaciones, Cuenta/Perfil | `INFERIDO` | BL §8,10,15; IRM §10 | PO-001, PO-008. |
| UR-008 | Perfil administrativo | Revisar actividad operativa sin ejecutar acciones operativas. | Supervisión básica y separación de superficies. | Acceso, Bitácora | `BLOQUEADO` | BL §4-6,9; IRM §6 | PO-008 y PO-009. |
| UR-009 | Cliente externo | Acceder en el futuro a una factura por token y declarar un pago. | Participar en el flujo documental sin que la declaración confirme pago real. | Portal externo propuesto, Facturas | `PROPUESTO` | BL §5,8,12,14; SM §5.3 | Alcance, identidad, seguridad y validez del flujo. |

## 5. Catálogo de requisitos del sistema

### 5.1 Requisitos funcionales agrupados

| ID | Declaración verificable | Tipo | Módulos | Fuente | Estado | Implementación actual | Dependencia | Criterio de aceptación | Decisión PO |
|---|---|---|---|---|---|---|---|---|---|
| SR-001 | El prototipo debe ofrecer entrada pública, selección explícita de perfil y retorno a Acceso ante perfil ausente o desconocido, sin llamarlo autenticación. | Funcional | Landing, Acceso, app-shell | BL §7-9; IRM §4,6,10 | `CONFIRMADO` | `PARCIAL` | Contrato de sesión actual. | Una acción de Landing abre Acceso; operativo deriva a Dashboard; administrativo a Bitácora; una ruta protegida sin perfil vuelve a Acceso. | PO-006/PO-008 solo para evolución a identidad real. |
| SR-002 | Dashboard debe presentar el resumen disponible y Movimientos debe permitir registrar, editar, buscar y filtrar ingresos/gastos simulados. | Funcional | Dashboard, Movimientos | BL §10; IRM §4.2 | `CONFIRMADO` | `COMPLETA` en código; runtime `NO_VERIFICADA` | Storage local y mocks. | Se distinguen carga, error, vacío y contenido; un movimiento válido persiste localmente y el resumen puede consumirlo una sola vez. | Semántica temporal pendiente. |
| SR-003 | Clientes, Categorías y Servicios deben validar y mantener sus catálogos locales, preservando el modelo B2B del cliente y su contacto principal. | Funcional/datos | Clientes, Categorías, Servicios | BL §10; IRM §4.2 | `CONFIRMADO` | `AISLADA` | Overlays propios; SR-014, SR-017 y SR-018. | Datos inválidos no se guardan; identificaciones/nombres únicos se respetan; una categoría usada se inactiva en lugar de eliminarse. | PO-003 para moneda de Servicios. |
| SR-004 | Propuestas y Proyectos deben conservar estados válidos, permitir gestión local y evitar convertir dos veces la misma propuesta aceptada. | Funcional | Propuestas, Proyectos | BL §6,10; IRM §4,9 | `CONFIRMADO` | `PARCIAL` | SR-011 y datos relacionados. | Una propuesta válida solo usa transiciones permitidas; la conversión crea/prefija un proyecto una vez y reconcilia la propuesta. | PO-007/PO-010. |
| SR-005 | Facturas debe conservar integridad aritmética, estados y pagos simulados; la capacidad PDF no debe aprobarse mientras siga `ENVIRONMENT_UNVERIFIED`. | Funcional/datos | Facturas | BL §8,10; IRM §3,4 | `CONFIRMADO` | `PARCIAL`; PDF `ENVIRONMENT_UNVERIFIED` | `jspdf` no materializado; SR-015/SR-022. | Importes y saldos se calculan, acciones inválidas se bloquean y el PDF no se marca PASS sin dependencia y prueba autorizadas. | PO-003/PO-004. |
| SR-006 | Reportes debe filtrar/exportar datos disponibles y guardar presupuestos; Configuración fiscal debe etiquetar su resultado como estimación local. | Funcional | Reportes, Configuración fiscal | BL §6,8,10; IRM §4,12 | `CONFIRMADO` | `AISLADA` | Mocks/overlays; SR-015/SR-020/SR-021. | Rangos inválidos se rechazan; CSV deriva de filas mostradas; una estimación no se presenta como obligación fiscal real. | PO-004/PO-005. |
| SR-007 | Ajustes, Notificaciones y Cuenta deben guardar preferencias/estado local; Cuenta representa identidad local y no fondos. | Funcional/datos | Ajustes, Notificaciones, Cuenta/Perfil | BL §8,10,15; IRM §4-5,10 | `CONFIRMADO` | `AISLADA` | Storages separados; SR-016/SR-021/SR-022. | Valores inválidos no se guardan; storage corrupto usa recuperación definida cuando exista; Cuenta nunca se etiqueta como cuenta financiera. | PO-001/PO-008. |
| SR-008 | Bitácora debe mostrar actividad operativa al perfil administrativo y omitir actividad administrativa. | Funcional | Acceso, Bitácora, ActivityLog | BL §5,9; IRM §6-7 | `BLOQUEADO` | `PARCIAL` | Definición canónica de rol y política de auditoría. | En el prototipo, solo el perfil administrativo abre Bitácora; vacío/lista/filtro se distinguen; limpiar exige confirmación. | PO-008/PO-009. |

### 5.2 Requisitos de las 14 integraciones obligatorias

| ID | Declaración verificable | Tipo | Módulos | Fuente | Estado | Implementación actual | Dependencia | Criterio de aceptación | Decisión PO |
|---|---|---|---|---|---|---|---|---|---|
| SR-009 | La selección de perfil operativo debe habilitar únicamente las superficies operativas previstas durante la sesión. | Integración | Acceso → módulos operativos | IRM §6,9 | `INFERIDO` | `COMPLETA` en código; runtime `NO_VERIFICADA` | `sessionStorage` y guardas cliente. | Con perfil operativo cada ruta operativa prevista abre y Bitácora redirige; no se presenta como autorización real. | PO-008. |
| SR-010 | La selección de perfil administrativo debe habilitar Bitácora y rechazar rutas operativas durante la sesión. | Integración | Acceso → Bitácora | IRM §6,9 | `BLOQUEADO` | `COMPLETA` en código; runtime `NO_VERIFICADA` | Definición del rol real. | En el prototipo, administrativo abre Bitácora y las rutas operativas redirigen; permisos futuros permanecen TBD. | PO-008/PO-009. |
| SR-011 | Una propuesta aceptada debe poder generar un proyecto una sola vez y reconciliar el estado de origen. | Integración | Propuestas → Proyectos | IRM §9 | `INFERIDO` | `COMPLETA` en código; flujo multipágina `NO_VERIFICADO` | Payload de sesión y overlay de propuestas. | Dos intentos con la misma propuesta no crean dos proyectos; el proyecto conserva referencia suficiente al origen. | PO-007 para reactivación posterior. |
| SR-012 | La actividad operativa registrada debe poder consultarse en Bitácora con actor, módulo, acción y fecha. | Integración | Módulos operativos → Bitácora | IRM §7,9,14 | `INFERIDO` | `COMPLETA` como canal; cobertura `PARCIAL` | Logger y storage de sesión. | Un evento admitido aparece una vez; actividad administrativa se omite; acciones no cubiertas quedan inventariadas. | Política de eventos/retención pendiente. |
| SR-013 | Landing debe conducir a Acceso y Acceso debe conservar el perfil seleccionado durante la sesión. | Integración | Landing → Acceso → perfil | IRM §10 | `INFERIDO` | `PARCIAL` | Navegación y sessionStorage. | La navegación funciona y el perfil se conserva en páginas protegidas; no se exige identidad, alta ni login real. | PO-006/PO-008 para evolución. |
| SR-014 | Los consumidores comerciales deben usar el catálogo vigente de Servicios o preservar explícitamente un snapshot identificable. | Integración/datos | Servicios → Propuestas/Proyectos/Facturas | IRM §10 | `PROPUESTO` | `PARCIAL` | Decidir semántica catálogo vs snapshot. | Al editar un servicio, cada consumidor muestra la versión vigente o una copia histórica identificada; nunca una mezcla implícita. | PO-003 para moneda; política de snapshot TBD. |
| SR-015 | Registrar, editar o revertir un pago debe producir exactamente una vez los efectos financieros transversales que se aprueben. | Integración/datos | Facturas → Pagos/Movimientos/Reportes/Notificaciones | IRM §10,14,16 | `BLOQUEADO` | `PARCIAL` | Definir efectos, reversión y fuente de verdad. | Tras decidir la política, saldo y cada efecto aprobado se actualizan una vez; una reversión aplica la operación inversa sin duplicados. | Decisión PO sobre efectos de pago. |
| SR-016 | Cuenta, actor de sesión, Dashboard y Bitácora deben mostrar una identidad coherente según la política aprobada. | Integración/datos | Cuenta/Perfil → shell/Dashboard/Bitácora | IRM §10,14,16 | `BLOQUEADO` | `PARCIAL` | Fuente de identidad y rol. | Un cambio autorizado se refleja de forma consistente en todos los consumidores definidos; Cuenta sigue sin representar fondos. | PO-001/PO-008. |
| SR-017 | Los cambios del catálogo de Categorías deben estar disponibles al registrar y reportar movimientos según la política de vigencia aprobada. | Integración/datos | Categorías → Movimientos/Reportes | IRM §12.1-12.2 | `PROPUESTO` | `AISLADA` | Fuente de verdad de categorías. | Una categoría creada/editada aparece en consumidores definidos; una inactiva conserva referencias históricas. | Fuente única pendiente. |
| SR-018 | Los cambios de Clientes deben estar disponibles en Propuestas, Proyectos y Facturas sin perder referencias históricas. | Integración/datos | Clientes → Propuestas/Proyectos/Facturas | IRM §12.1-12.2 | `PROPUESTO` | `AISLADA` | Fuente de verdad y snapshot histórico. | Una edición se refleja donde corresponda y los documentos históricos conservan el valor aprobado, según política explícita. | Política de snapshot pendiente. |
| SR-019 | Tiempo, costo y ganancia de Proyecto deben derivarse de datos identificables y exponer la semántica utilizada. | Integración/datos | Proyectos → tiempo/costo/ganancia | IRM §4,12.1,16 | `INFERIDO` | `AISLADA`; derivación local | Definición canónica de tiempo, gastos, cobros y período. | Cada métrica identifica inputs disponibles y distingue facturado, cobrado, gasto y valor trabajado. | PO-010; semántica temporal pendiente. |
| SR-020 | La estimación fiscal debe usar la configuración guardada, declarar su base y no presentarse como cálculo tributario oficial. | Integración/datos | Configuración fiscal → estimaciones | IRM §12.1,14,16 | `BLOQUEADO` | `AISLADA`; base fija local | Alcance fiscal y jurisdicción. | Una tasa inválida no produce total; base/tasas se muestran; no se aplica a Facturas hasta aprobar el contrato. | PO-004. |
| SR-021 | Una notificación o enlace de Reportes debe transportar identidad suficiente para abrir la entidad exacta. | Integración | Notificaciones/Reportes → entidad relacionada | IRM §12.1,14,16 | `PROPUESTO` | `PARCIAL`; navegación únicamente | Contrato de identificadores/deep link. | Un destino válido abre la entidad solicitada; ID ausente/inválido muestra estado seguro sin seleccionar otra entidad. | Identificadores pendientes. |
| SR-022 | Prefijo, secuencia, moneda, vencimiento e impuestos de Factura deben tener un dueño funcional único. | Integración/datos | Ajustes/Configuración fiscal → Facturas | IRM §12.1,14,16 | `CONFLICTO` | `CONFLICTIVA` | Resolver valores configurables frente a fijos. | Tras decisión PO, una factura nueva usa exactamente la política aprobada; hasta entonces no se promete propagación. | PO-003/PO-004. |

### 5.3 Requisitos no funcionales candidatos

| ID | Declaración verificable | Tipo | Módulos | Fuente | Estado | Implementación actual | Dependencia | Criterio de aceptación | Decisión PO |
|---|---|---|---|---|---|---|---|---|---|
| SR-023 | Las interacciones críticas deben ser operables con teclado, tener nombres/errores asociados y foco gestionado. | No funcional: accesibilidad | 16 módulos | `AGENTS.md`; IRM §4.2,8,18 | `PROPUESTO` | `NO_VERIFICADA` | Matriz de navegador y ayudas técnicas. | Se define y ejecuta una matriz accesible; umbral/cobertura: `TBD — requiere medición o decisión`. | Ninguna norma legal se presume. |
| SR-024 | Las acciones protegidas deben validarse en un límite confiable conforme a permisos aprobados. | No funcional: seguridad | Acceso y módulos protegidos | BL §8-9; IRM §6,15 | `BLOQUEADO` | `AUSENTE` fuera del cliente | Identidad/autorización futura. | Un actor sin permiso no puede ejecutar ni leer la acción aunque manipule el cliente; mecanismo técnico no se diseña aquí. | PO-006/PO-008. |
| SR-025 | Datos personales y financieros deben tener minimización, acceso, retención y borrado definidos. | No funcional: privacidad | Clientes, Facturas, Pagos, Cuenta, Bitácora | IRM §5,15 | `BLOQUEADO` | `AUSENTE` como política | Política de datos y actores. | Se documentan campos, propósito, acceso, retención y eliminación antes de persistencia compartida. | Decisión PO de privacidad; jurisdicción TBD. |
| SR-026 | Entidades relacionadas y efectos financieros deben conservar integridad referencial y evitar duplicación o actualización parcial. | No funcional: integridad | Catálogos y módulos financieros/comerciales | IRM §5,10,12,15 | `BLOQUEADO` | `PARCIAL` | Fuente de verdad, atomicidad y reversión. | Una operación aprobada deja todas sus relaciones consistentes o ninguna; estrategia técnica queda fuera de esta fase. | Preguntas 1, 3 y 4 de IRM §16. |
| SR-027 | La auditoría debe definir eventos, actor, retención, inmutabilidad y permiso de borrado. | No funcional: auditabilidad | ActivityLog, Bitácora y módulos operativos | IRM §7,14-16 | `BLOQUEADO` | `PARCIAL` y efímera | Política de auditoría. | Cada evento obligatorio se registra una vez con campos mínimos; retención y borrado: `TBD — requiere decisión`. | Pregunta 8 de IRM §16. |
| SR-028 | La aplicación debe recuperar un estado seguro ante storage corrupto, versión desconocida o fuente mock no disponible. | No funcional: confiabilidad/recuperación | Módulos con storage y mock loader | IRM §5.3,8,14-16 | `INFERIDO` | `PARCIAL` | Contrato uniforme de fallback/migración. | Dato inválido no bloquea la pantalla ni sobrescribe información válida; comportamiento común: `TBD — requiere decisión`. | Preguntas 10-12 de IRM §16. |
| SR-029 | Las 16 superficies deben mantener jerarquía, lectura y acciones utilizables en la matriz responsive aprobada. | No funcional: coherencia responsive | 16 módulos | `AGENTS.md`; IRM §18 | `PROPUESTO` | `NO_VERIFICADA` | Dispositivos/viewports aprobados. | Matriz y umbrales: `TBD — requiere medición o decisión`; no se afirma cumplimiento actual. | Ninguna. |
| SR-030 | Cada módulo debe ofrecer feedback perceptible de carga, vacío, error y éxito sin bloquear innecesariamente la tarea. | No funcional: rendimiento percibido/confiabilidad | 16 módulos | IRM §4.2,8,18 | `PROPUESTO` | `PARCIAL`; runtime `NO_VERIFICADA` | Medición y pruebas de navegador. | Los estados aplicables son distinguibles y no dejan la UI indefinidamente bloqueada; tiempos: `TBD — requiere medición`. | Ninguna. |
| SR-031 | Fechas, períodos, vencimientos y “hoy” deben usar una semántica temporal y zona horaria aprobadas. | No funcional: consistencia temporal | Dashboard, Movimientos, Proyectos, Facturas, Reportes, Categorías, Propuestas, Notificaciones | IRM §14-16 | `BLOQUEADO` | `CONFLICTIVA` | Política temporal. | El mismo instante/período produce la misma clasificación en consumidores definidos; zona y calendario: `TBD — requiere decisión`. | Pregunta 9 de IRM §16. |

## 6. Historias de usuario y criterios de aceptación

Las historias son síntesis de esta fase. Por eso se marcan `INFERIDO` salvo la historia bloqueada del actor administrativo y el conflicto Ajustes–Facturas.

La numeración continúa en `US-004` porque BL §17.1 ya usa `US-001`…`US-003` para actores; así se preservan los IDs existentes sin crear otra taxonomía.

| ID | Historia | Módulo | UR / SR vinculados | Precondiciones | Flujo principal | Criterios de aceptación observables | Alternativas o errores | Evidencia | Estado actual / dependencia |
|---|---|---|---|---|---|---|---|---|---|
| US-004 | Como freelancer, quiero reconocer qué resuelve FreelanceFlow y avanzar al acceso, para decidir si continúo con el prototipo. | Landing | UR-001; SR-001, SR-013, SR-023, SR-029 | Landing disponible. | Leer propuesta y activar CTA de acceso. | Se comunica centralización/visibilidad; existe una acción visible hacia Acceso; no promete backend o pago real. | Enlace inválido no debe presentarse como acceso exitoso. | BL §3-4; IRM §4,10 | `INFERIDO`; implementación estática, runtime `NO_VERIFICADA`. |
| US-005 | Como freelancer que usa el prototipo, quiero seleccionar el perfil disponible, para entrar a la superficie correspondiente. | Acceso | UR-001, UR-008; SR-001, SR-009, SR-010, SR-013, SR-024 | Sin identidad real; selector disponible. | Elegir operativo o administrativo y redirigir. | Operativo abre Dashboard; administrativo Bitácora; perfil ausente/desconocido vuelve a Acceso. | Manipular storage no se considera autorización válida. | BL §9; IRM §4,6,9-10 | `INFERIDO`; rol futuro depende de PO-006/008/009. |
| US-006 | Como perfil operativo, quiero consultar un resumen de la operación disponible, para identificar cobros y movimientos relevantes. | Dashboard | UR-002; SR-002, SR-009, SR-030, SR-031 | Perfil operativo y datos disponibles. | Cargar resumen, movimientos y vencimientos. | Se distinguen carga/error/vacío/contenido; movimientos locales compartidos pueden reflejarse una vez. | Fallo de datos muestra estado seguro. | BL §10; IRM §4,9 | `INFERIDO`; código presente, runtime `NO_VERIFICADA`. |
| US-007 | Como perfil operativo, quiero registrar, editar, buscar y filtrar movimientos, para mantener ingresos y gastos simulados. | Movimientos | UR-001, UR-002; SR-002, SR-015, SR-017, SR-026 | Perfil operativo; catálogos cargados. | Abrir formulario, validar, guardar y consultar. | Campos inválidos no persisten; fecha válida; filtros combinables; un registro válido queda visible. | Categoría/cliente/proyecto ausente usa error seguro; propagación queda pendiente. | BL §10; IRM §4,9,12 | `INFERIDO`; integración con Dashboard real, resto parcial/aislado. |
| US-008 | Como perfil operativo, quiero mantener clientes B2B y su contacto principal, para relacionarlos con mi trabajo comercial. | Clientes | UR-003; SR-003, SR-018, SR-025, SR-026 | Perfil operativo. | Crear/editar/ver/inactivar cliente. | Se validan campos B2B, contacto, email/celular/estado e identificación única; edición local queda visible en Clientes. | Cliente inválido no guarda; propagación a consumidores no se afirma actual. | BL §5,10; IRM §4,12 | `INFERIDO`; overlay `AISLADO`. |
| US-009 | Como perfil operativo, quiero gestionar proyectos y observar tiempo, costo y ganancia derivados, para evaluar su avance y rentabilidad. | Proyectos | UR-004; SR-004, SR-011, SR-019, SR-031 | Cliente activo o conversión válida. | Crear/editar proyecto, abrir detalle y consultar métricas. | Fechas/modalidad se validan; conversión no duplica; métricas distinguen trabajado, facturado, cobrado y gasto cuando existan. | Reactivación de completado y pantallas separadas quedan TBD. | BL §6,10,16; IRM §4,9,12 | `INFERIDO`; métricas locales y flujo multipágina `NO_VERIFICADO`. |
| US-010 | Como perfil operativo, quiero gestionar facturas y pagos simulados, para conocer estado, saldo y cobro pendiente. | Facturas | UR-005; SR-005, SR-015, SR-022, SR-026, SR-031 | Cliente/proyecto y datos válidos. | Crear/guardar/enviar/anular factura y registrar pago permitido. | Integridad aritmética; transiciones permitidas; pago actualiza saldo local; efectos transversales no se marcan completos; PDF queda `ENVIRONMENT_UNVERIFIED`. | Excedente se advierte; acción no permitida se bloquea; dependencia ausente no se clasifica como fallo funcional. | BL §8,10; IRM §3-4,10,14 | `INFERIDO`; implementación `PARCIAL`. |
| US-011 | Como perfil operativo, quiero filtrar reportes, guardar presupuestos y exportar resultados, para analizar la operación disponible. | Reportes | UR-002, UR-006; SR-006, SR-015, SR-021, SR-030, SR-031 | Datos y rango disponibles. | Seleccionar reporte/filtros, consultar, exportar o guardar presupuesto. | Rango inválido se rechaza; vacío se distingue; CSV usa filas mostradas; enlace a entidad requiere el ID acordado. | Deep link actual `invoice/factura` permanece brecha; título de log pendiente de verificación. | BL §10; IRM §4,8,14 | `INFERIDO`; overlay `AISLADO` y navegación parcial. |
| US-012 | Como perfil operativo, quiero mantener categorías de gasto, para clasificar movimientos sin perder referencias históricas. | Categorías | UR-003; SR-003, SR-017, SR-026 | Perfil operativo. | Crear/editar/buscar/inactivar o eliminar según uso. | Nombre único; presupuesto no negativo; categoría usada se inactiva y no se elimina; cambios locales visibles en Categorías. | Propagación a Movimientos/Reportes sigue `PROPUESTO`. | BL §10; IRM §4,12 | `INFERIDO`; datos mock compartidos, overlay `AISLADO`. |
| US-013 | Como perfil operativo, quiero mantener un catálogo de servicios, para reutilizar ofertas comerciales consistentes. | Servicios | UR-003; SR-003, SR-014, SR-026 | Perfil operativo. | Crear/editar/buscar/filtrar/eliminar servicio. | Nombre único, unidad permitida, tarifa positiva y moneda válida; el consumidor declara catálogo vigente o snapshot. | No se promedian monedas como una sola; propagación permanece parcial. | BL §10; IRM §4,10 | `INFERIDO`; overlay `AISLADO`. |
| US-014 | Como perfil operativo, quiero preparar y avanzar propuestas hasta convertir una aceptada, para iniciar un proyecto sin duplicar información. | Propuestas | UR-004; SR-004, SR-011, SR-014, SR-018 | Cliente activo, ítems y fechas válidos. | Crear/editar/enviar/aceptar/rechazar/convertir. | Solo transiciones canónicas; edición se conserva al enviar; conversión crea/prefija una vez y reconcilia propuesta. | Servicio/cliente desactualizado se rige por política todavía pendiente. | BL §10; IRM §4,9-10,12 | `INFERIDO`; conversión real en código, runtime `NO_VERIFICADA`. |
| US-015 | Como perfil operativo, quiero configurar y previsualizar una estimación fiscal local, para organizar información sin asumir automatización tributaria. | Configuración fiscal | UR-006; SR-006, SR-020, SR-025, SR-031 | Perfil operativo. | Editar tasas/campos, previsualizar y guardar. | Tasas fuera de 0–100 o requeridas vacías no generan total; base/tasas visibles; etiqueta de estimación local. | No se aplica a Facturas ni se afirma obligación legal hasta PO-004. | BL §6,8,16; IRM §4,12,14 | `INFERIDO`; derivación `AISLADA` y alcance `BLOQUEADO`. |
| US-016 | Como perfil operativo, quiero guardar o restaurar preferencias de facturación, para preparar valores por defecto coherentes. | Ajustes | UR-007; SR-007, SR-022, SR-028 | Perfil operativo. | Editar, validar, guardar o restaurar. | Valores inválidos no guardan; restore confirma; no se promete aplicación en Facturas mientras SR-022 siga en conflicto. | Fallo de storage muestra feedback sin afirmar persistencia. | BL §10,15; IRM §4,12,14 | `CONFLICTO` por Ajustes–Facturas; decisión PO-003/004. |
| US-017 | Como perfil operativo, quiero consultar alertas, marcar lectura y guardar preferencias, para atender pendientes relevantes. | Notificaciones | UR-007; SR-007, SR-015, SR-021, SR-028 | Perfil operativo y datos derivados. | Cargar alertas, marcar lectura, editar preferencias. | Estado leído/preferencias persisten localmente; al menos un canal; destino exacto solo se exige tras definir ID. | Fallback/fetch y deep link permanecen pendientes; no se afirman push/emails reales. | BL §8,10; IRM §4,5.3,12,14 | `INFERIDO`; navegación únicamente y storage local. |
| US-018 | Como perfil operativo, quiero actualizar mi información básica local, para personalizar mi identidad visible. | Cuenta/Perfil | UR-007; SR-007, SR-016, SR-025, SR-028 | Perfil operativo. | Editar, validar, guardar o descartar. | Requeridos/email válidos; error de storage no destruye dato válido; Cuenta se presenta como perfil, no fondos. | Sincronización con actor/Dashboard/Bitácora queda `BLOQUEADA`. | BL §8,15-16; IRM §4,10,14 | `INFERIDO`; identidad fragmentada. |
| US-019 | Como perfil administrativo, quiero consultar, buscar y limpiar actividad operativa, para supervisar lo registrado sin acceso operativo. | Bitácora | UR-008; SR-008, SR-010, SR-012, SR-024, SR-027 | Perfil administrativo de demostración. | Abrir Bitácora, revisar resumen/lista, buscar y confirmar limpieza. | Solo administrativo accede; vacío/lista/filtro se distinguen; búsqueda desde dos caracteres; limpiar confirma. | Retención/inmutabilidad/compliance no se afirman; actor canónico pendiente. | BL §5,9,16; IRM §6-7,15 | `BLOQUEADO` por PO-008/009; AS-IS local parcial. |

## 7. Requisitos de integración entre módulos

La prioridad es cualitativa y `PROPUESTA`: `ALTA` cuando la brecha compromete identidad, integridad financiera/referencial o un flujo central; `MEDIA` cuando afecta continuidad, interpretación o navegación sin demostrar pérdida central.

| # | Integración | AS-IS / clasificación Fase 3 | Comportamiento esperado | Brecha | SR | Módulos | Decisión pendiente | Prioridad justificada |
|---:|---|---|---|---|---|---|---|---|
| 1 | Perfil operativo → módulos operativos | `INTEGRACIÓN REAL` | Acceso solo a superficies operativas previstas. | Guarda manipulable; no autorización real. | SR-009 | Acceso + 13 operativos | PO-008 | ALTA — límite de acceso e identidad. |
| 2 | Perfil administrativo → Bitácora | `INTEGRACIÓN REAL` | Bitácora disponible y rutas operativas rechazadas. | Rol canónico y permisos futuros no definidos. | SR-010 | Acceso, Bitácora | PO-008/009 | ALTA — separación de responsabilidades. |
| 3 | Propuesta aceptada → Proyecto | `INTEGRACIÓN REAL` | Conversión única con reconciliación y referencia al origen. | Flujo multipágina no validado; estados futuros pendientes. | SR-011 | Propuestas, Proyectos | PO-007 | ALTA — continuidad venta/entrega. |
| 4 | Actividad operativa → Bitácora | `INTEGRACIÓN REAL` | Eventos obligatorios consultables una vez. | Cobertura, retención e inmutabilidad incompletas. | SR-012 | Operativos, Bitácora | Política de auditoría | ALTA — trazabilidad. |
| 5 | Landing → Acceso → perfil | `IMPLEMENTACIÓN PARCIAL` | Navegación y sesión de demostración explícitas. | Sin identidad, alta, logout o auth; no deben inventarse. | SR-013 | Landing, Acceso | PO-006/008 | MEDIA — continuidad de entrada. |
| 6 | Servicios → Propuestas/Proyectos/Facturas | `IMPLEMENTACIÓN PARCIAL` | Catálogo vigente o snapshot histórico explícito. | Overlay local no se propaga uniformemente. | SR-014 | Servicios y consumidores | Política de snapshot; PO-003 | ALTA — consistencia comercial. |
| 7 | Facturas → pagos/movimientos/reportes/notificaciones | `IMPLEMENTACIÓN PARCIAL` | Efectos aprobados, únicos y reversibles. | Pago queda aislado en Facturas. | SR-015 | Facturas y consumidores | Efectos de pago | ALTA — integridad financiera. |
| 8 | Cuenta/Perfil → identidad visual | `IMPLEMENTACIÓN PARCIAL` | Identidad coherente entre consumidores definidos. | Tres fuentes desconectadas. | SR-016 | Cuenta, shell, Dashboard, Bitácora | PO-001/008 | ALTA — coherencia y auditoría. |
| 9 | Categorías → Movimientos | `DATOS MOCK COMPARTIDOS` | Categorías vigentes e históricas coherentes. | Solo comparten baseline mock. | SR-017 | Categorías, Movimientos, Reportes | Fuente de verdad | ALTA — clasificación financiera. |
| 10 | Clientes → Propuestas/Proyectos/Facturas | `DATOS MOCK COMPARTIDOS` | Ediciones vigentes y snapshots históricos según política. | Consumidores no leen overlay de Clientes. | SR-018 | Clientes y consumidores | Política de snapshot | ALTA — integridad referencial. |
| 11 | Proyectos → tiempo/costo/ganancia | `DERIVACIÓN LOCAL` | Métricas con inputs y semántica visibles. | Arrays mock/locales; contrato transversal ausente. | SR-019 | Proyectos y fuentes financieras | PO-010; tiempo/período | MEDIA — interpretación de rentabilidad. |
| 12 | Configuración fiscal → estimaciones | `DERIVACIÓN LOCAL` | Estimación basada en configuración y base declaradas. | Base fija; Facturas no consume config. | SR-020 | Fiscal, Facturas | PO-004 | ALTA — evita afirmaciones fiscales incorrectas. |
| 13 | Notificaciones → módulo relacionado | `NAVEGACIÓN ÚNICAMENTE` | Abrir entidad exacta con ID válido. | Solo destino de módulo. | SR-021 | Notificaciones, Reportes, destinos | Contrato de ID | MEDIA — resolución de tareas. |
| 14 | Ajustes → Facturas | `EN CONFLICTO` | Un dueño para prefijo, secuencia, moneda, vencimiento e impuestos. | Ajustes promete configuración; Facturas fija valores. | SR-022 | Ajustes, Fiscal, Facturas | PO-003/004 | ALTA — contrato de facturación incompatible. |
| Extra | Movimientos → Dashboard | `INTEGRACIÓN REAL` adicional | Movimientos locales reflejados una vez en resumen. | Runtime no validado; Reportes/Notificaciones no comparten overlay. | SR-002 | Movimientos, Dashboard | Semántica temporal | MEDIA — visibilidad operativa. |

Cobertura obligatoria: **14/14**. La fila extra no altera el conteo.

## 8. Requisitos no funcionales confirmados y propuestos

| SR | Área | Estado | Evidencia | Situación AS-IS | Criterio/medición pendiente |
|---|---|---|---|---|---|
| SR-023 | Accesibilidad | `PROPUESTO` | `AGENTS.md`; IRM §8,18 | Contratos estáticos parciales; navegador no evaluado. | Matriz, tecnología asistiva y umbral: `TBD — requiere medición o decisión`. |
| SR-024 | Seguridad/autorización | `BLOQUEADO` | BL §8-9; IRM §6,15 | Guardas manipulables en cliente. | Identidad, permisos y límite confiable dependen de PO-006/008. |
| SR-025 | Privacidad | `BLOQUEADO` | IRM §5,15 | Datos personales/financieros en storage local; sin política. | Finalidad, acceso, retención y borrado: `TBD — requiere decisión`. |
| SR-026 | Integridad de datos | `BLOQUEADO` | IRM §10,12,15 | Overlays y efectos parciales. | Fuente única, atomicidad y reversión por decidir. |
| SR-027 | Auditabilidad | `BLOQUEADO` | IRM §7,14-16 | Bitácora efímera, borrable e incompleta. | Eventos, retención, inmutabilidad y borrado por decidir. |
| SR-028 | Confiabilidad/storage corrupto | `INFERIDO` | IRM §5.3,8,14 | Recuperación desigual y fallback incompleto. | Contrato común y pruebas: `TBD`. |
| SR-029 | Coherencia responsive | `PROPUESTO` | `AGENTS.md`; IRM §18 | No validada en navegador. | Viewports/dispositivos y umbral: `TBD`. |
| SR-030 | Rendimiento percibido | `PROPUESTO` | IRM §4.2,18 | Estados existen en código de forma desigual; no medidos. | Objetivos y medición: `TBD — requiere medición`. |
| SR-031 | Consistencia temporal | `BLOQUEADO` | IRM §14-16 | Referencias fijas/locales divergentes. | Zona, calendario, períodos y “hoy” por decidir. |

No se afirma SLA, disponibilidad, concurrencia, volumen, certificación ni cumplimiento normativo.

## 9. Matriz de cobertura de los 16 módulos

| # | Módulo | UR | SR funcional | US | Implementación AS-IS | Evidencia |
|---:|---|---|---|---|---|---|
| 1 | Landing | UR-001 | SR-001 | US-004 | Estática; navegación parcial | IRM §4 |
| 2 | Acceso | UR-001, UR-008 | SR-001 | US-005 | Selector de perfiles; no autenticación | BL §9; IRM §4,6 |
| 3 | Dashboard | UR-002 | SR-002 | US-006 | Código presente; consume Movimientos local | IRM §4,9 |
| 4 | Movimientos | UR-001, UR-002 | SR-002 | US-007 | CRUD local; una integración real | IRM §4,9,12 |
| 5 | Clientes | UR-003 | SR-003 | US-008 | Overlay aislado | IRM §4,12 |
| 6 | Proyectos | UR-004 | SR-004 | US-009 | CRUD/métricas locales; conversión estática | IRM §4,9,12 |
| 7 | Facturas | UR-005 | SR-005 | US-010 | Factura/pago local; PDF `ENVIRONMENT_UNVERIFIED` | IRM §3-4,10 |
| 8 | Reportes | UR-002, UR-006 | SR-006 | US-011 | Reportes/CSV/budgets locales; deep link conflictivo | IRM §4,8,14 |
| 9 | Categorías | UR-003 | SR-003 | US-012 | Overlay aislado; mock compartido | IRM §4,12 |
| 10 | Servicios | UR-003 | SR-003 | US-013 | Overlay aislado; consumo parcial | IRM §4,10 |
| 11 | Propuestas | UR-004 | SR-004 | US-014 | Estados locales; conversión real en código | IRM §4,9 |
| 12 | Configuración fiscal | UR-006 | SR-006 | US-015 | Derivación local; no aplicada a Facturas | IRM §4,12,14 |
| 13 | Ajustes | UR-007 | SR-007 | US-016 | Local; contrato conflictivo con Facturas | IRM §4,12,14 |
| 14 | Notificaciones | UR-007 | SR-007 | US-017 | Alertas/local; navegación sin ID | IRM §4,12 |
| 15 | Cuenta/Perfil | UR-007 | SR-007 | US-018 | Identidad local fragmentada | IRM §4,10,14 |
| 16 | Bitácora | UR-008 | SR-008 | US-019 | Admin demo; sesión efímera | IRM §4,6-7 |

Cobertura: **16/16 módulos**. “Cubierto” significa enlazado a UR/SR/US y evidencia, no funcionalmente aprobado.

## 10. Relación entre requisito, historia, módulo e integración

| Necesidad UR | Requisitos SR principales | Historias | Módulos | Integraciones asociadas |
|---|---|---|---|---|
| UR-001 | SR-001, SR-002, SR-013 | US-004, US-005, US-007 | Landing, Acceso, Movimientos | Landing→Acceso→perfil; Movimientos→Dashboard extra |
| UR-002 | SR-002, SR-015, SR-019, SR-021, SR-031 | US-006, US-007, US-009, US-011 | Dashboard, Movimientos, Proyectos, Reportes | pago→consumidores; proyecto→métricas; enlaces a entidad |
| UR-003 | SR-003, SR-014, SR-017, SR-018, SR-026 | US-008, US-012, US-013 | Clientes, Categorías, Servicios | servicios→comerciales; categorías→movimientos; clientes→consumidores |
| UR-004 | SR-004, SR-011, SR-014, SR-018, SR-019 | US-009, US-014 | Propuestas, Proyectos | propuesta→proyecto; catálogos/snapshots; métricas |
| UR-005 | SR-005, SR-015, SR-022, SR-026 | US-010 | Facturas | pago→consumidores; Ajustes/Fiscal→Facturas |
| UR-006 | SR-006, SR-015, SR-020, SR-021, SR-031 | US-011, US-015 | Reportes, Configuración fiscal | fiscal→estimación; pago→reportes; deep links |
| UR-007 | SR-007, SR-016, SR-021, SR-022, SR-028 | US-016, US-017, US-018 | Ajustes, Notificaciones, Cuenta | identidad; navegación a entidad; Ajustes→Facturas |
| UR-008 | SR-008, SR-010, SR-012, SR-024, SR-027 | US-005, US-019 | Acceso, Bitácora | admin→Bitácora; actividad→Bitácora |
| UR-009 | SR-005, SR-021, SR-024, SR-025 | Sin historia de módulo actual | Portal externo propuesto, Facturas | Portal no implementado; fuera de las 14 integraciones AS-IS |

Cada `US-004…US-019` enlaza al menos un UR y un SR. UR-009 no recibe una US actual porque el portal no existe; crearla como historia implementable en esta fase fingiría una superficie aprobada.

## 11. Brechas entre producto esperado y realidad implementada

| Brecha | Producto esperado/candidato | AS-IS confirmado | Requisitos | Evidencia |
|---|---|---|---|---|
| Fuente de verdad fragmentada | Entidades coherentes entre consumidores. | 19 claves y overlays propios. | SR-014–SR-018, SR-026 | IRM §5,12,15 |
| Pago aislado | Efectos aprobados, únicos y reversibles. | Pago solo actualiza Facturas. | SR-015, SR-026 | IRM §10,14 |
| Identidad fragmentada | Una identidad coherente y auditada. | Cuenta, actor de sesión y usuario mock separados. | SR-016, SR-024/025 | IRM §10,14-15 |
| Ajustes vs Facturas | Un dueño de defaults de factura. | Ajustes configura; Facturas fija `FAC-`, USD y +15. | SR-022 | IRM §12,14 |
| Fiscal vs Facturas | Configuración/estimación con alcance explícito. | Fiscal usa base local fija; Facturas no consume config. | SR-020, SR-022 | IRM §12,14 |
| Categorías aisladas | Catálogo vigente/histórico coherente. | Movimientos solo comparte mock inicial. | SR-017 | IRM §12 |
| Clientes aislados | Consumidores reciben edición o snapshot explícito. | Overlay de Clientes no se consume. | SR-018 | IRM §12 |
| Servicios parciales | Catálogo o snapshot declarado. | Consumo desigual y overlay aislado. | SR-014 | IRM §10 |
| Notificaciones/deep links | Abrir entidad exacta. | Solo módulo; parámetro de Facturas conflictivo. | SR-021 | IRM §12,14 |
| Auditoría incompleta | Eventos/retención/borrado definidos. | Bitácora de sesión, borrable, acciones omitidas. | SR-012, SR-027 | IRM §7,14-15 |
| Guardas cliente | Permisos en límite confiable cuando se aprueben. | sessionStorage y redirects. | SR-024 | BL §8-9; IRM §6 |
| Tiempo/fecha | Semántica consistente. | Dashboard fijo y módulos con reloj local. | SR-019, SR-031 | IRM §14 |
| Fallback divergente | Contrato de recuperación uniforme. | JSON y JS no equivalentes; Notificaciones diverge. | SR-028 | SM §4,8; IRM §5.3,14 |
| PDF sin entorno | Evidencia reproducible antes de aprobar. | `jspdf` declarado, no instalado; 140/141. | SR-005 | IRM §3 |

## 12. Conflictos y elementos obsoletos

### 12.1 Conflictos vigentes

| Elemento | Estado | Tratamiento en requisitos | Evidencia |
|---|---|---|---|
| Cuenta financiera vs Cuenta/Perfil | `CONFLICTO` | Cuenta actual sigue identidad local; cuenta financiera queda fuera hasta PO-001. | BL §8,15-16 |
| Registro/login/recuperación vs selector | `CONFLICTO` | SR-001 describe selector; SR-024 queda bloqueado para auth real. | BL §8,15; SM §5.3 |
| Ajustes/Fiscal vs Facturas | `CONFLICTO` | SR-022 permanece conflicto; no se elige dueño. | IRM §12,14 |
| JSON mock vs fallback JS | `CONFLICTO` | SR-028 exige contrato futuro; no se corrige aquí. | SM §4.4,8; IRM §5.3 |
| `invoice` vs `factura` | `CONFLICTO` | SR-021 exige contrato de ID; no se decide parámetro. | IRM §14 |
| Roadmaps incompatibles | `CONFLICTO` | PH-004 permanece decisión PO. | BL §13,15-16 |
| `package.json main=index.js` inexistente | `CONFLICTO` | No genera requisito de producto; se difiere a higiene técnica. | SM §4.4,8 |

### 12.2 Fuentes obsoletas

| Fuente/afirmación | Estado | Regla aplicada | Evidencia |
|---|---|---|---|
| SDD Parte 1 con `css/styles.css` y `js/app.js` | `OBSOLETO` | No se usa para UR/SR/US. | SM §4.2; BL §15 |
| Dashboard monolítico en `index.html` | `OBSOLETO` | La superficie actual landing + pages prevalece. | BL §15 |
| Catálogos derivados de Context Pack v3 como requisitos cerrados | `OBSOLETO` | Solo insumo secundario; preguntas abiertas siguen abiertas. | SM §4.1; BL §15 |
| Stitch/planes que llaman futuros a módulos presentes | `OBSOLETO` | Referencia visual histórica, no requisito. | SM §4.3,8; BL §8,15 |
| README como inventario completo/paridad de mocks | `CONFLICTO`, no autoridad actual | No se usa como prueba de integración. | SM §4.4,8 |

## 13. Las 12 decisiones pendientes del Product Owner

| # | ID existente | Decisión pendiente preservada | Requisitos/historias afectados | Estado | Evidencia |
|---:|---|---|---|---|---|
| 1 | PO-001 | Formalizar o descartar Cuenta financiera. | UR-007, SR-007, SR-016, US-018 | `BLOQUEADO` | BL §16 |
| 2 | PO-002 | Definir P-34, P-35 y P-36. | Ningún requisito inventado; cobertura queda TBD. | `BLOQUEADO` | BL §16; SM §5.3 |
| 3 | PO-003 | Resolver soporte real de multi-moneda. | UR-005; SR-005, SR-014, SR-022; US-010/013/014/016 | `BLOQUEADO` | BL §16 |
| 4 | PO-004 | Cerrar campos y alcance fiscal sin inventar jurisdicción. | UR-006; SR-006, SR-020, SR-022; US-015 | `BLOQUEADO` | BL §16 |
| 5 | PO-005 | Definir qué reportes requieren gráficos además de tablas. | UR-006, SR-006, US-011 | `BLOQUEADO` | BL §16 |
| 6 | PO-006 | Definir autenticación futura, contraseñas y verificación de correo. | SR-001, SR-009/010, SR-024; US-005/019 | `BLOQUEADO` | BL §16 |
| 7 | PO-007 | Decidir reactivación de proyectos completados y transición. | UR-004, SR-004, SR-011, SR-019, US-009 | `BLOQUEADO` | BL §16 |
| 8 | PO-008 | Decidir si operativo/administrativo serán roles reales o perfiles demo. | UR-008; SR-008–010, SR-016, SR-024; US-005/018/019 | `BLOQUEADO` | BL §9,16 |
| 9 | PO-009 | Confirmar equipos pequeños/supervisores como usuarios canónicos. | UR-008, SR-008/010, US-019 | `BLOQUEADO` | BL §5,16 |
| 10 | PO-010 | Decidir si tiempo y gastos tienen pantallas propias o siguen integrados. | UR-004, SR-004, SR-019, US-007/009 | `BLOQUEADO` | BL §16; SM §5.3 |
| 11 | PH-004 | Adoptar taxonomía única de fases y gates medibles. | Planificación futura; no altera AS-IS. | `BLOQUEADO` | BL §13,16 |
| 12 | PO-011 | Aprobar, sustituir o descartar React/Vite, Django/DRF/JWT, PostgreSQL y Expo. | Arquitectura TO-BE; ningún criterio de US actual. | `BLOQUEADO` | BL §12,16 |

Conteo preservado: **12/12**. No se solicita respuesta inmediata ni se infiere resolución.

## 14. Requisitos bloqueados o condicionales

| Elemento | Motivo de bloqueo/condición | Se puede usar ahora | No se puede afirmar |
|---|---|---|---|
| UR-008, SR-008, SR-010, US-019 | PO-008/009 | Interfaz demo administrativa AS-IS. | Rol/usuario canónico o permisos reales. |
| SR-015 | Efectos y reversión de pago no definidos. | Pago local en Facturas. | Creación automática de Movimiento/Reporte/Notificación. |
| SR-016 | Fuente de identidad y roles no decididos. | Perfil local y actor de sesión por separado. | Sincronización aprobada. |
| SR-020 | PO-004 y jurisdicción ausente. | Estimación local etiquetada. | Cálculo fiscal oficial o aplicación a Facturas. |
| SR-022, US-016 | PO-003/004 y contratos incompatibles. | Guardar Ajustes localmente. | Que nuevas Facturas usen esos valores. |
| SR-024 | PO-006/008 y sin límite confiable. | Redirecciones del prototipo. | Autenticación/autorización segura. |
| SR-025 | Política de privacidad/retención ausente. | Storage local AS-IS documentado. | Cumplimiento o tratamiento aprobado. |
| SR-026 | Fuente única/atomicidad no decididas. | Overlays actuales por módulo. | Consistencia transversal. |
| SR-027 | Eventos/retención/inmutabilidad sin decisión. | Bitácora de sesión. | Auditoría completa o inmutable. |
| SR-031 | Zona/calendario/períodos no decididos. | Fechas locales/fijas actuales. | Coherencia temporal global. |
| SR-005 PDF | Entorno sin `jspdf` materializado. | Contrato/código y test identificado. | PDF aprobado o funcionalmente roto. |
| UR-009 | Portal externo ausente y arquitectura futura no aprobada. | Actor documental confirmado. | Portal, token o declaración de pago operativos. |

## 15. Cobertura pendiente y preguntas no resueltas

Las siguientes 12 preguntas proceden de IRM §16. Son entradas de decisión/verificación; no se resuelven ni se convierten automáticamente en requisitos aprobados.

| # | Pregunta abierta | Requisitos relacionados | Tratamiento |
|---:|---|---|---|
| 1 | ¿Cuál será la fuente de verdad única para clientes, categorías, servicios, proyectos, propuestas, facturas, pagos y movimientos? | SR-014–SR-018, SR-026 | `BLOQUEADO/TBD` |
| 2 | ¿Qué permisos existen por acción además de los perfiles de navegación y cómo se validarán fuera del cliente? | SR-009/010, SR-024 | `BLOQUEADO/TBD` |
| 3 | ¿Qué efectos obligatorios y atómicos produce registrar, editar o revertir un pago? | SR-015, SR-026 | `BLOQUEADO/TBD` |
| 4 | ¿Cuáles son las máquinas de estado canónicas de Propuesta, Proyecto, Factura y Pago? | SR-004/005, SR-011/015 | `BLOQUEADO/TBD` |
| 5 | ¿Quién es dueño de prefijo, secuencia, moneda, vencimiento, impuestos y retenciones? | SR-005, SR-020, SR-022 | `CONFLICTO/TBD` |
| 6 | ¿Cómo se unifican actor de Acceso, Cuenta, Dashboard y Bitácora? | SR-016 | `BLOQUEADO/TBD` |
| 7 | ¿Qué identificador transportan Notificación o Reporte para abrir la entidad exacta? | SR-021 | `PROPUESTO/TBD` |
| 8 | ¿Qué eventos exige auditoría, cuánto se retienen y quién puede borrarlos? | SR-012, SR-027 | `BLOQUEADO/TBD` |
| 9 | ¿Qué zona horaria/semántica gobierna vencimientos, períodos, “hoy” y reportes? | SR-019, SR-031 | `BLOQUEADO/TBD` |
| 10 | ¿Qué sigue local/offline y qué requiere backend? | SR-024–SR-030 | `BLOQUEADO/TBD` |
| 11 | ¿Cómo se migran claves locales sin perder datos ni mezclar versiones? | SR-026, SR-028 | `BLOQUEADO/TBD` |
| 12 | ¿Qué fallback aplica ante fallo de `fetch` o apertura con `file:`? | SR-028 | `BLOQUEADO/TBD` |

Cobertura pendiente adicional:

- P-34, P-35 y P-36: `BLOQUEADO` por PO-002; no se inventan historias.
- Runtime de los 16 módulos y 14 integraciones: `FUERA_DE_ALCANCE` de Fase 4.
- PDF: `ENVIRONMENT_UNVERIFIED`.
- Criterios cuantitativos NFR: `TBD — requiere medición o decisión`.
- Arquitectura futura: `PROPUESTO` y bloqueada por PO-011.

## 16. Entradas necesarias para la Fase 5

| Entrada | Estado al cierre de Fase 4 | Uso permitido en Fase 5 |
|---|---|---|
| Snapshot `097d0a2` y hashes de SM/BL/IRM | Congelados | Evitar mezclar versiones durante evaluación runtime. |
| Este catálogo 9 UR / 31 SR / 16 US | Borrador trazable | Seleccionar criterios observables sin asumir aprobación de bloqueados. |
| Matriz 16 módulos | 16/16 cubiertos | Planificar evaluación módulo por módulo. |
| Matriz 14 integraciones | 14/14 cubiertas + 1 adicional | Diseñar pruebas runtime de productor/consumidor. |
| 12 decisiones PO | Abiertas | Marcar escenarios como bloqueados/condicionales; no resolverlos técnicamente. |
| 12 preguntas de IRM §16 | Abiertas | Guiar evidencia adicional y decisiones. |
| Estado PDF | `ENVIRONMENT_UNVERIFIED` | Solicitar autorización para materializar dependencias antes de repetir tests o navegador. |
| NFR SR-023…SR-031 | Candidatos sin métricas | Definir medición antes de afirmar cumplimiento. |
| Conflictos/obsoletos | Registrados | No usar fuentes obsoletas como oráculo runtime. |
| Restricciones de herramientas | Sin navegador/build/tests en Fase 4 | Deben redefinirse explícitamente al iniciar Fase 5. |

Fase 5 deberá conservar la separación entre: requisito aprobado, candidato, comportamiento AS-IS y resultado runtime. Esta sección no diseña el plan técnico definitivo.

## 17. Alcance explícitamente no evaluado todavía

Esta fase no:

- ejecuta npm, tests, build, servidor, navegador, Playwright, Lighthouse, TestSprite, Stitch ni web-quality-audit;
- valida navegación, formularios, storage, foco, responsive, consola, PDF, CSV o deep links en runtime;
- determina seguridad efectiva, privacidad, rendimiento, accesibilidad, confiabilidad o cumplimiento;
- instala `jspdf` ni otra dependencia;
- define backend, API, BD, autenticación, sincronización, emails, push, procesamiento de pagos, fiscalidad automática, bancos o facturación electrónica legal;
- aprueba React/Vite, Django/DRF/JWT, PostgreSQL, Expo, portal externo o app móvil;
- modifica código, mocks, tests, `package.json`, README, AGENTS o los tres documentos de entrada;
- corrige integraciones, conflictos o fuentes obsoletas;
- inicia presupuesto/revisión Gentle-AI, commit, push, PR o publicación;
- inicia la Fase 5.

El único resultado permitido es `docs/specs/FreelanceFlow_Traceable_Requirements_and_User_Stories.md`. Su validación final debe comprobar hashes, UTF-8 estricto sin BOM/mojibake/trailing whitespace, IDs únicos, enlaces US→UR/SR y cobertura 16/14/12.
