# Requirements: Parte 1 - Prototipo HTML/CSS/JS

## Propósito

Construir una maqueta web incremental de FreelanceFlow usando HTML, CSS y JavaScript puro. Esta parte valida estructura, navegación, formularios y comportamiento básico antes de implementar el stack final.

## Requirements

### Requirement: Estructura semántica base

El prototipo MUST usar HTML semántico para representar las secciones principales del sistema.

#### Scenario: Página inicial visible

- GIVEN el usuario abre `index.html`
- WHEN la página carga
- THEN debe ver el nombre FreelanceFlow
- AND debe ver secciones para dashboard, transacciones, clientes/proyectos y presupuestos

#### Scenario: Navegación interna

- GIVEN el usuario está en la página principal
- WHEN usa la navegación superior
- THEN los enlaces deben apuntar a secciones existentes de la misma página

### Requirement: Separación progresiva de responsabilidades

La Parte 1 SHOULD evolucionar de HTML puro a CSS separado y JavaScript separado por fases.

#### Scenario: Fase HTML

- GIVEN la fase actual es estructura HTML
- WHEN se modifica el prototipo
- THEN no debe incluir CSS embebido ni JavaScript embebido

#### Scenario: Fase CSS

- GIVEN se inicia la fase visual
- WHEN se añadan estilos
- THEN deben vivir en un archivo CSS separado

#### Scenario: Fase JavaScript

- GIVEN se inicia la fase de interacción
- WHEN se añada comportamiento
- THEN debe vivir en un archivo JavaScript separado

### Requirement: Captura de transacciones simulada

El prototipo MAY simular ingresos y gastos localmente cuando llegue la fase JavaScript.

#### Scenario: Formulario básico

- GIVEN el usuario quiere registrar un movimiento
- WHEN vea la sección de transacciones
- THEN debe encontrar campos para tipo, monto, categoría y fecha

#### Scenario: Sin backend

- GIVEN el prototipo está en Parte 1
- WHEN se registren datos simulados
- THEN no debe requerir API, base de datos ni autenticación real

### Requirement: Accesibilidad mínima

El prototipo MUST mantener una base accesible desde el inicio.

#### Scenario: Formularios etiquetados

- GIVEN existe un campo de formulario
- WHEN un lector de pantalla inspecciona el campo
- THEN debe tener un `label` asociado

#### Scenario: Jerarquía de encabezados

- GIVEN la página tiene secciones
- WHEN se revisa la estructura
- THEN debe existir un solo `h1` y subsecciones con `h2` o inferiores
