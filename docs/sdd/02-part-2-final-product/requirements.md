# Requirements: Parte 2 - Producto Final Funcional

## Propósito

Implementar FreelanceFlow como sistema completo con frontend web, backend API, base de datos relacional y aplicación móvil.

## Requirements

### Requirement: Autenticación de usuarios

El sistema MUST permitir que un freelancer gestione su información de forma aislada y autenticada.

#### Scenario: Login válido

- GIVEN el usuario tiene credenciales registradas
- WHEN inicia sesión correctamente
- THEN recibe tokens válidos para consumir la API

#### Scenario: Acceso no autenticado

- GIVEN una petición no tiene token válido
- WHEN intenta acceder a datos privados
- THEN la API debe responder con error de autorización

### Requirement: Gestión financiera centralizada

El sistema MUST gestionar cuentas, clientes, proyectos, categorías, transacciones y presupuestos.

#### Scenario: Registro de transacción

- GIVEN el usuario tiene una cuenta y categoría existentes
- WHEN registra un ingreso o gasto
- THEN la transacción queda persistida
- AND el saldo afectado se actualiza de forma consistente

#### Scenario: Transacción asociada a proyecto

- GIVEN el usuario tiene un proyecto asociado a un cliente
- WHEN registra un ingreso ligado al proyecto
- THEN el sistema puede calcular avance/rentabilidad del proyecto

### Requirement: Dashboard financiero

La web MUST mostrar métricas financieras útiles para toma de decisiones.

#### Scenario: Resumen mensual

- GIVEN existen transacciones del mes
- WHEN el usuario abre el dashboard
- THEN ve ingresos, gastos, balance y distribución por categoría

#### Scenario: Filtros

- GIVEN existen datos de distintos clientes/proyectos
- WHEN el usuario filtra por cliente o proyecto
- THEN las métricas se recalculan según el filtro

### Requirement: Captura móvil rápida

La app móvil SHOULD priorizar registro rápido de ingresos y gastos.

#### Scenario: Registro on-the-go

- GIVEN el usuario está autenticado en móvil
- WHEN registra una transacción desde la app
- THEN la API actualiza los datos disponibles en web

### Requirement: Consistencia financiera

El backend MUST proteger la consistencia de saldos.

#### Scenario: Peticiones concurrentes

- GIVEN dos transacciones afectan la misma cuenta al mismo tiempo
- WHEN el backend las procesa
- THEN el saldo final debe reflejar ambas operaciones sin pérdida de actualización
