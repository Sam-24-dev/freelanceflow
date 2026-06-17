# Design: Parte 1 - Prototipo HTML/CSS/JS

## Technical Approach

La Parte 1 se implementa como una página web simple e incremental. Primero se valida el esqueleto HTML. Luego se agregan estilos en `css/styles.css`. Finalmente se agregan interacciones en `js/app.js` sin backend real.

## Architecture Decisions

| Decisión | Elección | Alternativas rechazadas | Razón |
|---|---|---|---|
| Base inicial | HTML puro | React/Vite desde el inicio | El objetivo es validar estructura antes del stack final. |
| Estilos | CSS separado | CSS embebido o frameworks | Mantiene claridad para aprendizaje y fases incrementales. |
| Interacción | JavaScript separado | jQuery o librerías | Evita dependencias y mantiene control del prototipo. |
| Datos | Simulación local | PostgreSQL/API | La persistencia real pertenece a Parte 2. |

## Data Flow

```text
Usuario
  -> index.html
  -> formulario de transacción
  -> js/app.js valida/captura datos simulados
  -> estado local o localStorage
  -> actualización visual del dashboard
```

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `index.html` | Modificar | Estructura semántica y secciones base. |
| `css/styles.css` | Crear en fase CSS | Estilos visuales del prototipo. |
| `js/app.js` | Crear en fase JS | Validación, datos simulados e interacción. |
| `docs/sdd/01-part-1-prototype/*` | Mantener | Requisitos, diseño y tareas de esta parte. |

## Interfaces / Contracts

No hay API real en Parte 1. El contrato interno de una transacción simulada será:

```js
{
  id: string,
  tipo: "ingreso" | "gasto",
  monto: number,
  categoria: string,
  fecha: string,
  descripcion?: string
}
```

## Testing Strategy

| Capa | Qué probar | Enfoque |
|---|---|---|
| HTML | Estructura semántica y enlaces internos | Revisión manual o validador HTML. |
| CSS | Responsividad básica y legibilidad | Browser manual. |
| JS | Validación y cálculo de totales | Pruebas manuales inicialmente; tests si se configura tooling. |
| Accesibilidad | Labels, headings, navegación por teclado | Checklist manual y Lighthouse cuando haya servidor. |

## Migration / Rollout

No hay migración. El prototipo evolucionará por fases y luego servirá como referencia para Parte 2.

## Open Questions

- [ ] Definir si el prototipo será una sola página o varias páginas HTML.
- [ ] Definir si se usará `localStorage` o solo estado en memoria para la fase JS.
- [ ] Definir estética visual antes de empezar CSS.
