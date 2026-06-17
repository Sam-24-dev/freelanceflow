# SDD de FreelanceFlow

Este directorio contiene las especificaciones operativas del proyecto. Su objetivo es que cualquier agente pueda continuar el trabajo sin depender de contexto conversacional.

## Estructura

```text
docs/sdd/
  README.md
  00-project-context.md
  01-part-1-prototype/
    requirements.md
    design.md
    tasks.md
  02-part-2-final-product/
    requirements.md
    design.md
    tasks.md
```

## Cómo usar estos documentos

1. Antes de implementar, identificar la parte del proyecto.
2. Leer `00-project-context.md`.
3. Leer el `requirements.md` de la parte correspondiente.
4. Revisar `design.md` para respetar la arquitectura prevista.
5. Ejecutar tareas desde `tasks.md` en orden.
6. Actualizar `tasks.md` marcando tareas completadas solo cuando estén validadas.

## Reglas de mantenimiento

- Si cambia el alcance, actualizar primero `requirements.md`.
- Si cambia la solución técnica, actualizar `design.md`.
- Si cambia el plan de ejecución, actualizar `tasks.md`.
- No convertir estos documentos en teoría genérica. Deben seguir siendo accionables.
- Si el código contradice la spec, resolver la contradicción explícitamente: actualizar spec o corregir código.

## Relación con `FreelanceFlow-Specification.md`

`FreelanceFlow-Specification.md` es la especificación académica principal. Los documentos SDD son la traducción operativa para ejecución incremental.
