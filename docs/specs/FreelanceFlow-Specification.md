# Especificación Técnica de Proyecto: FreelanceFlow
## Sistema de Gestión Financiera para Trabajadores Independientes

---

## 1. Metadatos del Proyecto
* **Nombre del Proyecto:** FreelanceFlow
* **Autor:** Samir Leonardo Caizapasto Hernández
* **Institución:** Escuela Superior Politécnica del Litoral (ESPOL)
* **Curso:** Desarrollo de Aplicaciones Web y Móviles (DAWM)
* **Paralelo:** Paralelo 1
* **Periodo Académico:** Año 2026
* **Área Temática:** FinTech / Gestión de Finanzas Personales y Profesionales

---

## 2. Introducción y Objetivos

### 2.1. Problema Identificado
Los trabajadores independientes (freelancers) carecen de herramientas centralizadas y adaptadas a la volatilidad de sus ingresos. La mayoría recurre a hojas de cálculo en Excel o anotaciones físicas que resultan propensas a errores, carecen de automatización y no ofrecen una visión en tiempo real del estado de salud financiera ni del flujo de caja por cliente o proyecto.

### 2.2. Objetivo General
Desarrollar una plataforma integral e interoperable (Web y Móvil) que permita a los freelancers registrar de forma óptima sus flujos de ingresos y gastos, estructurar cuentas financieras diversas, categorizar transacciones y proyectar su flujo de caja en tiempo real, erradicando la dependencia de procesos manuales y facilitando la toma de decisiones estratégicas de negocio.

---

## 3. Arquitectura Funcional y Alcance

El sistema está concebido bajo un enfoque híbrido optimizado para los casos de uso específicos de cada plataforma:

### 3.1. Plataforma Web (Panel Principal de Control)
* **Dashboard Centralizado:** Visualización de analíticas avanzadas, métricas clave de salud financiera y gráficos dinámicos del flujo de caja mensual.
* **Módulo de Gestión Macroeconómica:** Alta, modificación y control de cuentas, definición de presupuestos mensuales detallados por categoría de gasto, e informes detallados segmentados por cliente o proyecto.
* **Administración de Entidades:** Configuración del portafolio de clientes y desglose de proyectos asociados con sus respectivos valores contractuales.

### 3.2. Aplicación Móvil (Captura Rápida y Transaccional)
* **Caso de Uso Principal:** Registro inmediato en el punto de acción (on-the-go). Permite capturar ingresos o gastos en segundos justo cuando ocurren, evitando el olvido de transacciones cotidianas.
* **Sincronización:** Interfaz simplificada conectada directamente a la API unificada para la actualización inmediata de saldos en las cuentas seleccionadas.

### 3.3. Exclusiones del Alcance (Limitantes Conscientes)
* **Sin Integración Bancaria Directa:** Debido a restricciones contractuales y legales, el ecosistema no automatizará la lectura de cuentas bancarias reales.
* **Sin Conexión Fiscal (SRI):** No se realizarán declaraciones automatizadas ni facturación electrónica regulada por el Servicio de Rentas Internas (Ecuador). Toda la data transaccional será de ingreso manual por el usuario.

---

## 4. Arquitectura de Datos y Modelo de Dominio

El sistema se basará en un motor relacional sólido para soportar de manera consistente las complejas relaciones transaccionales. Las entidades principales y su lógica relacional se definen a continuación:

### 4.1. Entidades del Sistema
1. **Usuario:** Registro maestro del freelancer (Credenciales, perfil, configuración base).
2. **Cuentas:** Representación de los fondos del usuario. Puede ser de tipo: *Cuenta Bancaria, Efectivo, o Billetera Digital*.
3. **Clientes:** Entidades comerciales o personas naturales que contratan los servicios del freelancer.
4. **Proyectos:** Trabajos específicos asignados a un Cliente, definidos por un valor total estipulado.
5. **Categorías:** Clasificadores lógicos de movimientos económicos (ej. Software, Viáticos, Honorarios, Impuestos).
6. **Transacciones:** Registros atómicos de entradas o salidas monetarias (Monto, Fecha, Categoría, Cuenta Afectada, Tipo: Ingreso/Gasto).
7. **Presupuestos Mensuales:** Topes de gastos configurados por el usuario asociados a una Categoría específica para un periodo mensual.

### 4.2. Mapa de Relaciones Cardinales (Data Agent Logic)
* Un **Usuario** posee una o muchas (`1:N`) **Cuentas**.
* Un **Usuario** gestiona uno o muchos (`1:N`) **Clientes**.
* Un **Cliente** puede tener asignado uno o muchos (`1:N`) **Proyectos**.
* Cada **Transacción** está vinculada de manera obligatoria a una (`1:1`) **Cuenta** y modifica directamente su saldo de forma aditiva o sustractiva.
* Cada **Transacción** pertenece a una (`1:1`) **Categoría**.
* Las **Transacciones** de tipo Ingreso pueden opcionalmente estar ligadas a un **Proyecto** para calcular la rentabilidad real.
* Un **Presupuesto Mensual** está ligado de forma estricta a una **Categoría** y a un mes calendario específico.

---

## 5. Stack Tecnológico y Justificación de Ingeniería

La selección tecnológica responde a criterios técnicos validados con las demandas del mercado laboral internacional y las directrices metodológicas del curso:

### 5.1. Frontend Web: React + Tailwind CSS + Vite
* **React:** Elección orientada a la arquitectura basada en componentes reactivos. Facilita la renderización eficiente de dashboards interactivos y gráficos financieros que cambian dinámicamente según los filtros temporales.
* **Tailwind CSS:** Framework utilitario de estilos que acelera el desarrollo de interfaces adaptables, responsivas y limpias, eliminando la sobrecarga de hojas de estilo tradicionales.
* **Vite:** Herramienta de empaquetado de última generación que optimiza drásticamente el entorno de desarrollo (HMR instantáneo) y la compilación para producción en comparación con Webpack/CRA.

### 5.2. Backend: Django REST Framework (DRF) & Python
* **Robustez Transaccional:** Se selecciona DRF por la capacidad de Python de implementar lógicas de negocio seguras y por el ORM maduro de Django, el cual ofrece un control riguroso sobre las escrituras en la base de datos.
* **Seguridad de API:** Implementación de autenticación stateless mediante **JSON Web Tokens (JWT)** empleando la biblioteca `djangorestframework-simplejwt`.
* *Nota Técnica de Evaluación:* Se reconoce a *FastAPI* como una alternativa competitiva del mercado moderno por su rendimiento asíncrono superior y autogeneración de esquemas OpenAPI. No obstante, se prioriza *DRF* para asegurar estricto alineamiento con el ecosistema base de la materia, manteniéndose abierta la discusión a retroalimentación docente.

### 5.3. Base de Datos: PostgreSQL
* **Garantía ACID:** Indispensable para sistemas financieros. PostgreSQL ofrece el nivel de aislamiento y robustez necesarios para procesar complejas consultas analíticas agregadas (reportes mensuales, sumatorias de flujos de caja) de manera óptima bajo entornos de concurrencia.

### 5.4. Ecosistema Móvil: React Native + Expo
* **Reutilización de Lógica:** Compartir paradigmas de desarrollo (hooks, estados, componentes) con el desarrollo web en React mitiga los tiempos de desarrollo y reduce la curva de aprendizaje.
* **Expo:** Herramienta clave para agilizar el ciclo de despliegue en desarrollo, permitiendo pruebas nativas eficientes en dispositivos reales (iOS/Android) omitiendo la compilación pesada inicial mediante Android Studio o Xcode.

### 5.5. Control de Versiones y Gitflow
* **Plataforma:** GitHub.
* **Estrategia de Ramas:** Bifurcación estructurada e independiente por entorno de desarrollo: `frontend`, `backend` y `mobile`. Toda incorporación a la rama principal requerirá obligatoriamente revisiones de código controladas mediante Pull Requests (PRs).

---

## 6. Plan de Ejecución por Partes

El proyecto se desarrollará en dos partes para reducir riesgo técnico, validar la idea de forma incremental y evitar construir directamente una arquitectura completa sin una base funcional previa.

### 6.1. Parte 1: Prototipo Web Base con HTML, CSS y JavaScript
La primera parte consistirá en construir una versión inicial del sistema usando tecnologías web fundamentales: **HTML, CSS y JavaScript**. Esta etapa no representa el producto final, sino una base progresiva para validar estructura, pantallas, flujos de navegación y reglas principales del dominio.

Esta parte se trabajará por fases incrementales:

1. **Fase 1 - Estructura HTML:** creación de las pantallas base y jerarquía semántica del sistema.
2. **Fase 2 - Estilos CSS:** definición visual inicial, distribución responsive y componentes básicos reutilizables.
3. **Fase 3 - JavaScript:** incorporación de interacciones simples, captura de formularios, validaciones básicas y simulación de datos locales.
4. **Fase 4 - Prototipo navegable:** conexión entre vistas principales para demostrar el flujo general de uso sin backend real.

El objetivo de esta parte es tener una maqueta funcional mínima que sirva como referencia para el diseño final, permita detectar errores de flujo temprano y facilite explicar el proyecto antes de implementar frameworks, API, autenticación y persistencia real.

### 6.2. Parte 2: Producto Final Funcional
La segunda parte corresponderá a la implementación completa del sistema con el stack definido para producción académica: **React + Tailwind CSS + Vite** en frontend web, **Django REST Framework + Python** en backend, **PostgreSQL** como base de datos relacional y **React Native + Expo** para la aplicación móvil.

En esta etapa se implementarán los módulos definitivos:

1. **Autenticación y gestión de usuarios** con JWT.
2. **API REST centralizada** para cuentas, clientes, proyectos, categorías, transacciones y presupuestos.
3. **Persistencia transaccional real** en PostgreSQL.
4. **Dashboard financiero** con métricas, filtros y reportes.
5. **Aplicación móvil** orientada al registro rápido de ingresos y gastos.
6. **Validaciones, pruebas y despliegue** del ecosistema completo.

La Parte 2 tomará como referencia los aprendizajes de la Parte 1, pero no estará limitada por ella. El prototipo inicial será una herramienta de validación; el producto final será la aplicación completa, funcional, mantenible y conectada a una arquitectura real.

---

## 7. Gestión de Riesgos Técnicos y Mitigaciones

### 7.1. Riesgo de Inconsistencia de Saldos por Concurrencia
* **Escenario:** El usuario efectúa el registro síncrono de múltiples transacciones concurrentes afectando a la misma cuenta (por ejemplo, peticiones simultáneas desde distintas pestañas o dispositivos).
* **Mitigación:** Centralizar las escrituras de saldo en el backend, aplicar transacciones atómicas en PostgreSQL y recalcular saldos desde el historial de transacciones cuando sea necesario para auditoría.
