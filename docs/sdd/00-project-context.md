# Contexto SDD del Proyecto

## Producto

FreelanceFlow es una plataforma para freelancers que permite registrar ingresos, gastos, cuentas, clientes, proyectos, categorías y presupuestos. El objetivo final es dar visibilidad del flujo de caja y salud financiera.

## Usuarios objetivo

- Freelancers con ingresos variables.
- Personas que manejan varios clientes o proyectos.
- Usuarios que actualmente dependen de Excel, notas o registros manuales dispersos.

## Entidades del dominio

| Entidad | Descripción |
|---|---|
| Usuario | Freelancer dueño de la información financiera. |
| Cuenta | Fondo o contenedor de dinero: banco, efectivo o billetera digital. |
| Cliente | Persona o empresa que contrata servicios. |
| Proyecto | Trabajo asociado a un cliente y a un valor contractual. |
| Categoría | Clasificador de ingresos o gastos. |
| Transacción | Movimiento financiero atómico. |
| Presupuesto mensual | Límite de gasto por categoría y mes. |

## Partes de ejecución

### Parte 1 - Prototipo HTML/CSS/JS

Validar pantallas, navegación, formularios e interacciones básicas sin backend ni framework.

### Parte 2 - Producto final

Implementar el sistema completo con React, Django REST Framework, PostgreSQL y Expo.

## Decisiones vigentes

- No habrá integración bancaria directa.
- No habrá conexión fiscal automática con SRI.
- PostgreSQL será la base de datos final por consistencia transaccional.
- El prototipo inicial no debe bloquear ni condicionar incorrectamente la arquitectura final.

## Riesgos principales

- Inconsistencia de saldos por operaciones concurrentes.
- Scope creep por intentar construir la Parte 2 durante la Parte 1.
- Especificaciones desactualizadas si se cambia código sin actualizar SDD.
- Mezcla accidental de datos simulados con lógica final.
