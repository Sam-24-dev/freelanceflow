# Línea base de producto y arquitectura de FreelanceFlow

Public-safe normalization: machine-local metadata was generalized without changing product evidence or business conclusions.
Estado: BORRADOR — Fase 2 de 5
Snapshot: origin/main 097d0a2cef3455a6b7956c1fe0bb3c792f19f287

> Esta línea base distingue hechos del snapshot, inferencias, propuestas futuras, conflictos y decisiones pendientes. No constituye auditoría funcional, especificación detallada ni aprobación de arquitectura futura.

## 1. Resumen ejecutivo

| Conclusión | Clasificación | Evidencia principal |
|---|---|---|
| FreelanceFlow busca centralizar la operación financiera y comercial dispersa de freelancers para dar visibilidad sobre cobros, flujo de caja y rentabilidad. | CONFIRMADO | `docs/specs/FreelanceFlow_Context_Pack_v4.md:4-12`; `docs/specs/FreelanceFlow-Specification.md:17-24` |
| El producto actual es un prototipo web estático multipágina con HTML, CSS/Tailwind compilado, JavaScript vanilla, datos simulados y persistencia local del navegador. | CONFIRMADO | `FreelanceFlow_Context_Pack_v4.md:15-21`; `package.json:2-13`; árbol Git en `097d0a2` |
| El perfil operativo accede a los módulos del producto; el perfil administrativo queda restringido a Bitácora. | CONFIRMADO | `assets/js/app-shell.js:34-91`; `pages/acceso.html:29-43` |
| Cuenta/Perfil conserva información básica local del usuario operativo; no es una cuenta financiera. | CONFIRMADO | `FreelanceFlow_Context_Pack_v4.md:137-152`; `docs/prototype/ACCOUNT_PROFILE_IMPLEMENTATION_HANDOFF.md:5-13` |
| Backend, API, PostgreSQL, autenticación real, React/Vite, Expo y portal externo aparecen únicamente como futuro documentado. | PROPUESTO | `FreelanceFlow-Specification.md:70-89,113-125`; `docs/sdd/02-part-2-final-product/design.md:5-29` |
| Las fuentes discrepan sobre Cuenta financiera, autenticación y la taxonomía de fases del producto. | CONFLICTO | `FreelanceFlow_Context_Pack_v4.md:15-21,137-152`; Specification `:46-66,97-125`; SDD y código actual |
| La presencia de 16 páginas y 32 JavaScript demuestra superficie implementada, no cumplimiento funcional. | CONFIRMADO | `docs/specs/FreelanceFlow_Product_Audit_Source_Map.md:156-189,284-297` |

## 2. Jerarquía de fuentes

### 2.1 Orden de autoridad utilizado

1. Código y estructura presentes en `origin/main`, SHA `097d0a2`.
2. `docs/specs/FreelanceFlow_Context_Pack_v4.md`.
3. `docs/specs/FreelanceFlow_Catalogo_Formularios_v1.md` y `FreelanceFlow_Catalogo_Elementos_Visuales_v1.md`.
4. Contexto interno persistido contrastado con evidencia del repositorio.
5. Handoffs de módulos como intención y límites de implementación.
6. SDD y `FreelanceFlow-Specification.md`, sujetos a drift.
7. README, planes y prompts como contexto secundario.

`FreelanceFlow_Product_Audit_Source_Map.md` se utilizó como índice de evidencias, no como verdad absoluta.

### 2.2 Fuentes realmente analizadas

**Documentos principales**

- `docs/specs/FreelanceFlow_Product_Audit_Source_Map.md`
- `docs/specs/FreelanceFlow_Context_Pack_v4.md`
- `docs/specs/FreelanceFlow_Catalogo_Formularios_v1.md`
- `docs/specs/FreelanceFlow_Catalogo_Elementos_Visuales_v1.md`
- `docs/specs/FreelanceFlow-Specification.md`
- `docs/sdd/00-project-context.md`
- `docs/sdd/01-part-1-prototype/requirements.md`
- `docs/sdd/01-part-1-prototype/design.md`
- `docs/sdd/02-part-2-final-product/requirements.md`
- `docs/sdd/02-part-2-final-product/design.md`

**Comprobaciones puntuales**

- `package.json`
- `assets/js/app-shell.js`
- `assets/js/mock-data-loader.js`
- `index.html`
- `pages/acceso.html`
- `docs/prototype/ACCOUNT_PROFILE_IMPLEMENTATION_HANDOFF.md`, solo para Cuenta/Perfil, autenticación, roles y Stitch.

No se auditaron los 32 JavaScript ni las 16 páginas completas.

### 2.3 Contexto interno y vigencia

Se revisó el contexto interno persistido del proyecto y se contrastó con evidencia del repositorio. El código y las fuentes del snapshot permanecen como autoridad para las conclusiones.

## 3. Problema que resuelve el producto

### PR-001 — Fragmentación operativa

**CONFIRMADO.** El usuario objetivo gestiona clientes, proyectos, cobros, pagos y registros mediante hojas de cálculo, mensajería y anotaciones dispersas. Esa fragmentación dificulta conocer:

- rentabilidad por cliente y proyecto;
- flujo de caja;
- cuentas por cobrar;
- relación entre trabajo entregado, facturación y pagos;
- preparación organizada de información fiscal.

**Fuentes:** `FreelanceFlow_Context_Pack_v4.md:4-12`; `FreelanceFlow-Specification.md:17-24`.

No existe evidencia para ampliar este problema a países, legislaciones, precios, bancos o mercados específicos.

## 4. Propuesta de valor

### PV-001 — Centralización y visibilidad

**CONFIRMADO.** FreelanceFlow propone centralizar la operación financiera y comercial del freelancer, relacionando movimientos, clientes, proyectos, servicios, propuestas, facturas y resultados para facilitar decisiones sobre cobros, flujo y rentabilidad.

**Fuentes:** `FreelanceFlow_Context_Pack_v4.md:5-11`; `index.html:67-145`.

### PV-002 — Coordinación básica de equipos

**INFERIDO.** La landing, el selector de perfiles y Bitácora sugieren valor adicional para equipos pequeños: separar operación y supervisión administrativa. Esta extensión no aparece todavía como definición canónica del usuario objetivo.

**Fuentes:** `index.html:69,118-125,145`; `pages/acceso.html:33-43`.

## 5. Usuarios y contextos de uso confirmados

| Actor o contexto | Clasificación | Línea base | Evidencia |
|---|---|---|---|
| Freelancer | CONFIRMADO | Actor principal, con ingresos variables, varios clientes/proyectos y registros dispersos. | `docs/sdd/00-project-context.md:7-11`; Specification `:19-23` |
| Equipo operativo pequeño | INFERIDO | Posible usuario secundario derivado de la landing y de los perfiles actuales. | `index.html:69,118,125,145`; `pages/acceso.html:33-43` |
| Perfil administrativo | CONFIRMADO como interfaz actual; PENDIENTE como usuario canónico | Actor de demostración restringido a Bitácora. Falta decidir si será un rol real del producto. | `app-shell.js:78-91` |
| Cliente externo | CONFIRMADO como actor, no como usuario principal | Puede participar en flujos documentales futuros; no tiene portal operativo actual. | Context Pack `:25-27`; Catálogo de formularios `:530-553` |
| Gestión web | CONFIRMADO | Contexto previsto para administración macro y consulta. | Context Pack `:9-11` |
| Prototipo local/navegable | CONFIRMADO | Contexto técnico actual con simulación de datos y persistencia del navegador. | Context Pack `:15-21` |
| Captura móvil | PROPUESTO | Contexto futuro para registrar gastos, tiempo o pagos rápidamente. | Context Pack `:9-11`; SDD Parte 2 requirements `:58-66` |

## 6. Jobs to Be Done

No existe una lista formal de JTBD aprobada en las fuentes principales: **JT-001 — CONFIRMADO**.

| ID | Clasificación | Job/outcome |
|---|---|---|
| JT-002 | INFERIDO | Cuando administro trabajo freelance disperso, quiero centralizarlo para dejar de reconstruir mi operación manualmente. |
| JT-003 | INFERIDO | Cuando tengo facturas y pagos abiertos, quiero conocer cuánto cobraré y cuándo para decidir con anticipación. |
| JT-004 | INFERIDO | Cuando cierro un proyecto, quiero comparar ingresos, gastos y horas para conocer su rentabilidad. |
| JT-005 | INFERIDO | Cuando preparo obligaciones fiscales, quiero ordenar una estimación sin asumir integración tributaria real. |
| JT-006 | INFERIDO | Cuando coordino un equipo pequeño, quiero revisar actividad reciente sin dar al administrador acceso operativo. |

**Evidencia de origen:** Context Pack `:5-7,57-65,115-119`; Catálogo visual `:65-104,206-210,341-346`; `index.html:125,145`. Estos JTBD son síntesis inferidas, no requisitos aprobados.

## 7. Alcance actual frontend-only

| ID | Clasificación | Alcance |
|---|---|---|
| SC-001 | CONFIRMADO | HTML, CSS/Tailwind compilado y JavaScript vanilla con datos mock. |
| SC-002 | CONFIRMADO | Landing, selector de perfil y superficies multipágina para los módulos inventariados. |
| SC-003 | CONFIRMADO | Estado de sesión, preferencias y overlays locales simulados mediante almacenamiento del navegador. |

El snapshot contiene 16 páginas y 32 JavaScript de producto inventariados en la Fase 1. Este conteo confirma superficie existente, no calidad ni cumplimiento funcional.

**Fuentes:** Context Pack `:15-21`; `package.json:2-13`; `app-shell.js:56-69,199-213`; Source Map `:156-189`.

## 8. Límites y exclusiones actuales

| ID | Clasificación | Límite |
|---|---|---|
| EX-001 | CONFIRMADO | No existen backend, API, base de datos ni autenticación real. |
| EX-002 | CONFIRMADO | No existe integración bancaria ni automatización con SRI. |
| EX-003 | CONFIRMADO | No se puede afirmar pago real, envío real de facturas ni portal externo operativo. |
| EX-004 | OBSOLETO | Stitch es referencia histórica/visual; no constituye requisito vigente. |

Cuenta/Perfil no representa fondos, conciliación ni una cuenta bancaria. El acceso actual es un selector de perfiles de frontend, no login.

**Fuentes:** Context Pack `:15-21`; Specification `:40-42`; `pages/acceso.html:29-43`; handoff Cuenta `:5-13,108-136`.

## 9. Roles operativo y administrativo

| ID | Clasificación | Responsabilidad actual |
|---|---|---|
| RO-001 | CONFIRMADO | `pages/acceso.html` permite elegir perfil operativo o administrativo. |
| RO-002 | CONFIRMADO | El operativo recibe navegación hacia los módulos del producto. |
| RO-003 | CONFIRMADO | El administrativo queda restringido a Bitácora. |
| RO-004 | CONFIRMADO | El guard usa `sessionStorage` y redirecciones frontend; no equivale a autenticación, autorización backend ni identidad persistente. |

**Evidencia:** `pages/acceso.html:29-43`; `assets/js/app-shell.js:34-91`.

**Decisión relacionada:** PO-008 debe establecer si estos perfiles serán roles reales o seguirán siendo un mecanismo de demostración.

## 10. Capacidades agrupadas

La tabla confirma superficies y dominio documentado; no valida flujos end-to-end.

| Grupo | Capacidades de línea base | Clasificación |
|---|---|---|
| Operación financiera | Dashboard, movimientos, facturación, presupuestos/reportes; dominio de cobros, pagos, gastos y métricas. | CF-001/CF-002 — CONFIRMADO |
| Clientes y entrega | Clientes, proyectos y servicios; tiempo documentado, pero su pantalla independiente no está confirmada. Los campos personales académicos describen contacto principal/representante legal del cliente B2B. | CD-001/CD-002/CD-003 — CONFIRMADO |
| Ventas | Propuestas y facturas; secuencia propuesta→proyecto→factura/pago documentada pero no validada end-to-end. Portal externo futuro. | CS-001/CS-002 — CONFIRMADO; CS-003 — PROPUESTO |
| Control administrativo | Perfil administrativo y Bitácora de actividad. Supervisión ligera de equipos pequeños es una inferencia. | CA-001 — CONFIRMADO; CA-002 — INFERIDO |
| Configuración y preferencias | Categorías, configuración fiscal estimada, Ajustes, Notificaciones y Cuenta/Perfil local. | CC-001/CC-002 — CONFIRMADO |

**Fuentes:** Source Map `:164-177`; Context Pack `:28-30,57-65,77-84,137-152`; Catálogos `:193-216,273-299,330-504,674-710`.

## 11. Arquitectura implementada actualmente

### 11.1 Vista lógica confirmada

```text
index.html (landing)
        |
        v
pages/acceso.html (selector de perfil)
        |
        v
assets/js/app-shell.js
  ├─ navegación y guard frontend
  ├─ perfil en sessionStorage
  └─ acceso operativo / Bitácora administrativa
        |
        v
pages/*.html
  ├─ controladores de página
  ├─ modelos CommonJS/browser
  ├─ activity-log compartido
  └─ persistencia local por módulo
        |
        v
mock-data-loader.js
  ├─ fetch assets/data/mock-data.json
  └─ fallback assets/data/mock-data.js
```

### 11.2 Conclusiones arquitectónicas actuales

| ID | Clasificación | Conclusión | Evidencia |
|---|---|---|---|
| AR-001 | CONFIRMADO | Frontend estático multipágina. | Árbol Git; `package.json:2-13` |
| AR-002 | CONFIRMADO | Flujo landing → selector de perfil → shell compartido. | `index.html:54-73`; `pages/acceso.html:29-38`; `app-shell.js:34-91` |
| AR-003 | CONFIRMADO | `sessionStorage` simula perfil y `localStorage` conserva preferencias/estado local. | `app-shell.js:56-69,199-213` |
| AR-004 | CONFIRMADO | El loader intenta JSON vía `fetch` y recurre al fallback JavaScript bajo `file:` o error. | `mock-data-loader.js:4-24` |
| AR-005 | CONFLICTO | JSON y fallback JS no tienen paridad semántica. | Source Map `:191-197,261` |
| AR-006 | CONFIRMADO | Tailwind es dependencia de desarrollo, jsPDF dependencia runtime y existen scripts Node declarados. | `package.json:9-13,26-31` |
| AR-007 | CONFIRMADO | No existen directorios `backend/`, `frontend/` ni `mobile/`. | Árbol Git; SDD futuro `:65-72` |

La arquitectura actual prioriza simulación local y navegación estática. No se evalúan aquí mantenibilidad, rendimiento, seguridad o idoneidad futura.

## 12. Arquitectura futura documentada

**Toda esta sección está clasificada como PROPUESTO. Nada de lo siguiente se presenta como arquitectura aprobada o implementada.**

| ID | Componente propuesto | Evidencia |
|---|---|---|
| AF-001 | Web con React, Vite y Tailwind. | Specification `:70-77,113-125`; SDD Parte 2 design `:9-15` |
| AF-002 | Backend Django REST Framework y autenticación JWT. | Specification `:79-82,113-123`; SDD Parte 2 design `:5,12,15` |
| AF-003 | Persistencia PostgreSQL. | Specification `:84-85,113-123`; SDD Parte 2 design `:13,24-28` |
| AF-004 | Aplicación React Native + Expo consumiendo la misma API. | Specification `:87-89,113-123`; SDD Parte 2 design `:14,19-29` |
| AF-005 | Portal de factura mediante token opaco, único, expirable y revocable. | Context Pack `:25-27`; Source Map `:202-204` |

**Decisión pendiente PO-011:** aprobar, sustituir o descartar este stack después de cerrar requisitos, restricciones y criterios de transición.

## 13. Fases del producto y criterios conocidos de transición

Esta “Fase 2 de 5” pertenece al proceso de auditoría documental. No debe confundirse con las fases del roadmap del producto.

### 13.1 Roadmap del Context Pack v4

| Fase de producto | Estado documental |
|---|---|
| F1 | Frontend/prototipo con mocks. CONFIRMADO como arquitectura actual. |
| F2 | Backend y persistencia real. PROPUESTO. |
| F3 | API REST e integración entre clientes. PROPUESTO. |
| F4 | Aplicación móvil. PROPUESTO. |

**Fuente:** Context Pack `:15-21`.

### 13.2 Conflicto de taxonomía

- **PH-002 — CONFLICTO:** Specification usa “Parte 1” con cuatro fases internas y “Parte 2” para el producto final completo (`:97-125`).
- **PH-003 — CONFIRMADO:** el criterio transversal conocido es cerrar flujos y pantallas del prototipo antes de backend, API, autenticación y persistencia real.
- **PH-004 — DECISIÓN DEL PRODUCT OWNER PENDIENTE:** adoptar un roadmap canónico y definir gates verificables de entrada/salida.
- **PO-011 — DECISIÓN DEL PRODUCT OWNER PENDIENTE:** decidir el stack futuro; la fase documental no lo aprueba.

## 14. Glosario del dominio

| Término | Clasificación | Definición de línea base |
|---|---|---|
| Freelancer | CONFIRMADO | Actor principal y dueño de la operación financiera/comercial. |
| Cliente | CONFIRMADO | Cliente B2B o persona contratante; campos personales académicos representan contacto principal/representante legal. |
| Cliente externo | CONFIRMADO | Actor documental que no es usuario autenticado del sistema principal; su portal es futuro. |
| Perfil operativo | CONFIRMADO | Selector frontend con acceso a módulos operativos. |
| Perfil administrativo | CONFIRMADO | Selector frontend restringido a Bitácora. |
| Cuenta/Perfil | CONFIRMADO | Información básica local del perfil; no es cuenta financiera. |
| Cuenta financiera | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Fondo bancario, efectivo o billetera propuesto/formalizado por fuentes antiguas y dejado pendiente por Context Pack v4. |
| Movimiento/Transacción | CONFIRMADO | Unión práctica de ingresos y gastos en el prototipo/mock; no demuestra ledger bancario. |
| Propuesta | CONFIRMADO | Documento comercial que puede anteceder a un proyecto. |
| Proyecto | CONFIRMADO | Unidad de entrega relacionada con cliente, trabajo y rentabilidad documentada. |
| Notificación de pago | CONFIRMADO | Declaración del cliente externo; no registra ni confirma un pago real. |
| Bitácora | CONFIRMADO | Vista administrativa de actividad operativa reciente. |

## 15. Conflictos documentales

| ID | Clasificación | Conflicto | Evidencia |
|---|---|---|---|
| CO-001 | CONFLICTO | Specification/SDD formalizan Cuenta financiera; Context Pack v4 la deja pendiente y Cuenta actual es perfil. | Specification `:46-66`; SDD context `:13-23`; Context Pack `:137-152` |
| PH-002 | CONFLICTO | Context Pack y Specification usan roadmaps incompatibles. | Context Pack `:15-21` vs Specification `:97-125` |
| CO-004 | CONFLICTO | Documentos describen registro/login/recuperación, pero el acceso actual es selector de perfiles y la autenticación está diferida. | Context Pack `:38-42`; Catálogo `:45-190`; `pages/acceso.html:29-43`; handoff Cuenta `:108-127` |
| AR-005 | CONFLICTO | JSON mock y fallback JavaScript no son equivalentes aunque ambos son rutas activas del loader. | Source Map `:191-197`; loader `:9-20` |
| CO-005 | CONFLICTO | `package.json` declara `index.js` como `main`, pero el archivo no existe. | `package.json:5`; árbol Git |
| CO-002 | OBSOLETO | SDD Parte 1 refiere `css/styles.css` y `js/app.js`, rutas inexistentes. | SDD design `:3-34` |
| CO-003 | OBSOLETO | SDD Parte 1 describe dashboard monolítico en `index.html`; actualmente es landing multipágina. | SDD requirements `:13-24`; `index.html:54-73,116-148` |
| CO-006 | OBSOLETO | Catálogos derivados de Context Pack v3 incluyen campos y validaciones propuestos; no son requisitos cerrados actuales. | Catálogos `:3-12` y preguntas abiertas |
| CO-007 | OBSOLETO | Planes/prompts Stitch presentan como futuros módulos ya presentes; Stitch no es autoridad vigente. | Source Map `:139-141`; handoff Cuenta `:36-49,108-127` |
| EX-004 | OBSOLETO | Usar una pantalla Stitch literalmente como requisito actual. | Handoff Cuenta y jerarquía de fuentes vigente |

Los conflictos permanecen visibles; esta fase no los resuelve silenciosamente.

## 16. Decisiones pendientes del Product Owner

| ID | Decisión necesaria | Evidencia / motivo |
|---|---|---|
| PO-001 | Formalizar o descartar Cuenta financiera. | Context Pack `:137-152` |
| PO-002 | Definir P-34, P-35 y P-36. | Context Pack `:130-133,156-163`; Catálogo visual `:362-380` |
| PO-003 | Resolver soporte real de multi-moneda. | Context Pack y catálogos mantienen preguntas abiertas. |
| PO-004 | Cerrar campos y alcance fiscal sin inventar jurisdicción. | Context Pack `:115-116,163`; Formularios `:193-216,667` |
| PO-005 | Definir qué reportes requieren gráficos además de tablas. | Context Pack `:132,160`; Visuales `:376-380` |
| PO-006 | Definir autenticación futura, política de contraseñas y verificación de correo. | Context Pack `:118`; Formularios `:45-190,666,669` |
| PO-007 | Decidir si se permite reactivar proyectos completados y con qué transición. | Context Pack `:119`; Formularios `:670` |
| PO-008 | Decidir si operativo/administrativo serán roles reales o perfiles de demostración. | `pages/acceso.html:33-43`; SDD Parte 2 requirements `:9-23` |
| PO-009 | Confirmar si equipos pequeños y supervisores administrativos son usuarios objetivo canónicos. | Landing frente a SDD context `:7-11` |
| PO-010 | Decidir si tiempo y gastos requieren pantallas independientes o permanecen integrados. | Source Map `:207-208`; Context Pack `:57-65` |
| PH-004 | Adoptar una taxonomía única de fases y gates medibles. | Conflicto PH-002 |
| PO-011 | Aprobar, sustituir o descartar React, Django/DRF, PostgreSQL y Expo como stack futuro. | Specification y SDD futuro; ausencia en árbol actual |

## 17. Matriz de trazabilidad entre conclusión y evidencia

### 17.1 Ledger de conclusiones

| ID | Clasificación | Conclusión | Evidencia |
|---|---|---|---|
| EV-001 | CONFIRMADO | Snapshot, rama y upstream coinciden; antes de este artefacto solo Source Map estaba no rastreado. | Git read-only; Source Map `:45-55` |
| EV-002 | CONFIRMADO | Presencia de página/script no prueba cumplimiento. | Source Map `:156-158,210-225,284-297` |
| PR-001 | CONFIRMADO | La operación freelance fragmentada dificulta claridad financiera. | Context Pack `:4-12`; Specification `:17-24` |
| PV-001 | CONFIRMADO | Centralización y visibilidad financiera son la propuesta central. | Context Pack `:5-11`; `index.html:67-145` |
| PV-002 | INFERIDO | Bitácora amplía valor hacia coordinación de equipos pequeños. | `index.html:69,118-125,145` |
| US-001 | CONFIRMADO | Freelancer con ingresos variables, varios clientes/proyectos y registros dispersos. | SDD context `:7-11`; Specification `:19-23` |
| US-002 | INFERIDO | Equipo operativo pequeño es actor secundario emergente. | `index.html:69,118,125,145`; `pages/acceso.html:33-43` |
| US-003 | CONFIRMADO | Cliente externo es actor, no usuario principal. | Context Pack `:25-27`; Formularios `:530-553` |
| CTX-001 | CONFIRMADO | Web se concibe para gestión macro. | Context Pack `:9-11` |
| CTX-002 | PROPUESTO | Móvil capturaría gastos, tiempo y pagos rápidamente. | Context Pack `:9-11`; SDD Parte 2 requirements `:58-66` |
| CTX-003 | CONFIRMADO | Contexto actual es prototipo frontend simulado. | Context Pack `:15-21`; Specification `:101-111` |
| JT-001 | CONFIRMADO | No hay JTBD formalmente aprobados. | Fuentes principales expresan problema/objetivo, no JTBD |
| JT-002 | INFERIDO | Job de centralizar operación dispersa. | Context Pack `:5-7` |
| JT-003 | INFERIDO | Job de anticipar flujo y cuentas por cobrar. | Context Pack `:7`; Visuales `:65-104` |
| JT-004 | INFERIDO | Job de conocer rentabilidad por proyecto. | Visuales `:206-210,341-346` |
| JT-005 | INFERIDO | Job de preparar estimación fiscal organizada. | Context Pack `:115-119,156-163`; Formularios `:193-216` |
| JT-006 | INFERIDO | Job administrativo de revisar actividad reciente. | `index.html:125,145`; `pages/acceso.html:33-38` |
| SC-001 | CONFIRMADO | Alcance actual: frontend web con mocks. | Context Pack `:15-21` |
| SC-002 | CONFIRMADO | Hay landing, 15 páginas bajo `pages/` y 32 JS inventariados. | Árbol Git; Source Map `:156-189` |
| SC-003 | CONFIRMADO | La simulación usa almacenamiento del navegador. | `app-shell.js:56-69,199-213`; evidencia contrastada con el repositorio |
| EX-001 | CONFIRMADO | No hay backend, API, DB ni autenticación real. | Context Pack `:15-21`; handoff Cuenta `:5-13` |
| EX-002 | CONFIRMADO | No hay integración bancaria ni automatización SRI. | Specification `:40-42` |
| EX-003 | CONFIRMADO | No debe afirmarse pago, envío o portal real. | Source Map `:198-208`; Formularios `:530-553` |
| EX-004 | OBSOLETO | Stitch no es requisito vigente. | Handoff Cuenta `:10,34,49,108-127` |
| RO-001 | CONFIRMADO | Acceso actual selecciona perfil. | `pages/acceso.html:29-43` |
| RO-002 | CONFIRMADO | Operativo recibe navegación de módulos. | `app-shell.js:34-53,78-91` |
| RO-003 | CONFIRMADO | Administrativo ve Bitácora únicamente. | `app-shell.js:78-91`; `pages/acceso.html:34-38` |
| RO-004 | CONFIRMADO | Perfiles no equivalen a autenticación. | Handoff Cuenta `:5-13,129-136`; `app-shell.js:56-91` |
| CF-001 | CONFIRMADO | Existen superficies de dashboard, movimientos, facturas y reportes. | Source Map `:164-169` |
| CF-002 | CONFIRMADO | El dominio documenta cobros, pagos, gastos, presupuestos y métricas. | Context Pack `:5,77-84`; Visuales `:20-59` |
| CD-001 | CONFIRMADO | Existen superficies de clientes, proyectos y servicios. | Source Map `:166-167,171` |
| CD-002 | CONFIRMADO | Tiempo está documentado; su pantalla independiente no está confirmada. | Context Pack `:57-60`; Source Map `:207` |
| CD-003 | CONFIRMADO | Campos personales académicos describen representante/contacto B2B. | Formularios `:273-299,674-710` |
| CS-001 | CONFIRMADO | Existen superficies de propuestas y facturas. | Source Map `:168,172` |
| CS-002 | CONFIRMADO | Flujo propuesta→proyecto→factura/pago está documentado, no validado end-to-end. | Context Pack `:28-30`; Formularios `:330-504` |
| CS-003 | PROPUESTO | Portal externo de factura/pago es futuro. | Context Pack `:25-27`; Source Map `:202-204` |
| CA-001 | CONFIRMADO | Bitácora administrativa existe como superficie actual. | Source Map `:177`; `app-shell.js:78-91` |
| CA-002 | INFERIDO | Su job es supervisión ligera de equipo. | `index.html:125,145`; `pages/acceso.html:34` |
| CC-001 | CONFIRMADO | Existen categorías, fiscal, ajustes, notificaciones y perfil. | Source Map `:170,173-176` |
| CC-002 | CONFIRMADO | Cuenta actual es perfil local, no fondo financiero. | Context Pack `:137-152`; handoff Cuenta |
| AR-001 | CONFIRMADO | Arquitectura actual multipágina estática. | `package.json:2-13`; árbol Git |
| AR-002 | CONFIRMADO | Landing→selector de perfil→shell compartido. | `index.html:54-73`; `pages/acceso.html:29-38`; `app-shell.js:34-91` |
| AR-003 | CONFIRMADO | Perfil y preferencias se gestionan en browser storage. | `app-shell.js:56-69,199-213` |
| AR-004 | CONFIRMADO | Loader usa JSON y fallback JavaScript. | `mock-data-loader.js:4-24` |
| AR-005 | CONFLICTO | JSON y fallback JS no son equivalentes. | Source Map `:191-197,261` |
| AR-006 | CONFIRMADO | Tailwind/jsPDF y scripts Node están declarados. | `package.json:9-13,26-31` |
| AR-007 | CONFIRMADO | Capas futuras no existen. | Árbol Git; SDD futuro `:65-72` |
| AF-001 | PROPUESTO | React/Vite/Tailwind futuro. | Specification `:70-77,113-125`; SDD Parte 2 design `:9-15` |
| AF-002 | PROPUESTO | DRF/JWT futuro. | Specification `:79-82,113-123`; SDD design `:5,12,15` |
| AF-003 | PROPUESTO | PostgreSQL futuro. | Specification `:84-85,113-123`; SDD design `:13,24-28` |
| AF-004 | PROPUESTO | Expo/React Native futuro. | Specification `:87-89,113-123`; SDD design `:14,19-29` |
| AF-005 | PROPUESTO | Portal por token futuro. | Context Pack `:25-27`; Source Map `:202-204` |
| PH-001 | CONFIRMADO | Roadmap de cuatro fases está documentado. | Context Pack `:15-21` |
| PH-002 | CONFLICTO | Roadmaps usan fases incompatibles. | Context Pack `:15-21` vs Specification `:97-125` |
| PH-003 | CONFIRMADO | Deben cerrarse flujos/pantallas antes de capas reales. | Context Pack `:21`; Specification `:101-125` |
| PH-004 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Falta roadmap canónico y gates medibles. | Conflicto PH-002; SDD Parte 2 `:88-92` |
| GL-001 | CONFIRMADO | Movimiento/transacción une ingreso y gasto en el mock. | Context Pack `:137-152` |
| GL-002 | CONFIRMADO | Notificación de pago no registra pago real. | Formularios `:530-553` |
| GL-003 | CONFIRMADO | Propuesta puede originar proyecto tras aceptación. | Formularios `:330-403` |
| CO-001 | CONFLICTO | Cuenta financiera formalizada en fuentes antiguas, pendiente en v4 y distinta de Cuenta actual. | Specification `:46-66`; SDD context `:13-23`; Context Pack `:137-152` |
| CO-002 | OBSOLETO | Diseño Parte 1 refiere rutas inexistentes. | SDD Parte 1 design `:3-34` |
| CO-003 | OBSOLETO | Requirements Parte 1 describe `index.html` monolítico. | SDD requirements `:13-24`; `index.html:54-73,116-148` |
| CO-004 | CONFLICTO | Auth pública documentada vs selector actual y auth diferida. | Context Pack `:38-42`; Formularios `:45-190`; `pages/acceso.html:29-43` |
| CO-005 | CONFLICTO | `package.json` apunta a archivo ausente. | `package.json:5`; árbol Git |
| CO-006 | OBSOLETO | Catálogos no operan como requisitos cerrados actuales. | Catálogos `:3-12` y preguntas abiertas |
| CO-007 | OBSOLETO | Stitch/prompts no representan alcance vigente. | Source Map `:139-141`; handoff Cuenta |
| PO-001 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Formalizar o eliminar Cuenta financiera. | Context Pack `:137-152` |
| PO-002 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Definir P-34/P-35/P-36. | Context Pack `:130-133,156-163`; Visuales `:362-380` |
| PO-003 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Resolver multi-moneda. | Context Pack/catálogos abiertos |
| PO-004 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Cerrar configuración fiscal exacta. | Context Pack `:115-116,163`; Formularios `:193-216,667` |
| PO-005 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Definir visualizaciones de reportes. | Context Pack `:132,160`; Visuales `:376-380` |
| PO-006 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Definir autenticación futura, contraseña y verificación. | Context Pack `:118`; Formularios `:45-190,666,669` |
| PO-007 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Resolver reactivación de proyectos completados. | Context Pack `:119`; Formularios `:670` |
| PO-008 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Determinar si perfiles actuales serán roles reales. | `pages/acceso.html:33-43`; SDD Parte 2 `:9-23` |
| PO-009 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Confirmar equipos pequeños como segmento objetivo. | Landing vs SDD context `:7-11` |
| PO-010 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Resolver pantallas independientes/integradas de tiempo y gastos. | Source Map `:207-208`; Context Pack `:57-65` |
| PO-011 | DECISIÓN DEL PRODUCT OWNER PENDIENTE | Aprobar o sustituir stack futuro. | Specification `:70-89`; SDD Parte 2 `:7-29,88-92` |
| DF-001 | CONFIRMADO | Requisitos detallados y criterios de aceptación quedan para Fase 3 de la auditoría. | Contrato explícito de Fase 2 |
| DF-002 | CONFIRMADO | Historias de usuario y story mapping quedan para Fase 4. | Contrato explícito de Fase 2 |

### 17.2 Conteo por clasificación

| Clasificación | Cantidad |
|---|---:|
| CONFIRMADO | 42 |
| INFERIDO | 8 |
| PROPUESTO | 7 |
| CONFLICTO | 5 |
| OBSOLETO | 5 |
| DECISIÓN DEL PRODUCT OWNER PENDIENTE | 12 |
| **Total** | **79** |

## 18. Elementos explícitamente diferidos para las fases 3 y 4

### Fase 3 de la auditoría

**DF-001 — CONFIRMADO como diferido**

- requisitos funcionales detallados;
- reglas campo por campo;
- requisitos no funcionales;
- criterios de aceptación trazables;
- reconciliación formal de catálogos con el snapshot.

Los catálogos serán insumo; no se asumirán como requisitos aprobados.

### Fase 4 de la auditoría

**DF-002 — CONFIRMADO como diferido**

- historias de usuario;
- story mapping;
- journeys por actor;
- priorización por usuario y resultado.

Las decisiones PO-001 a PO-011 y PH-004 permanecen abiertas. No deben resolverse silenciosamente al derivar requisitos o historias.
