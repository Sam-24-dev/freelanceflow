# Notas del Proyecto FreelanceFlow

## Pendientes de MCP

- Instalar/configurar un MCP de PostgreSQL cuando empiece la Parte 2 con backend y base de datos real.
- Validar GitHub MCP antes de depender de él: aparece configurado globalmente en Codex, pero en esta sesión no está expuesto como herramienta callable.

## Pendientes de herramientas

- Inicializar Git antes de activar GGA en este proyecto (`git init`, luego `gga init` y `gga install`).
- Evaluar `Gentleman-Skills` solo si faltan skills concretas no cubiertas por AutoSkills o Gentle-AI. Para este proyecto podrían servir más adelante: `react-19`, `tailwind-4`, `django-drf`, `react-native`, `pytest` y `typescript`.
- Volver a ejecutar `npx autoskills --dry-run` cuando existan las carpetas finales de React/Vite, Django/DRF o Expo, porque ahora solo detecta el prototipo HTML.
- Ejecutar `gentle-ai skill-registry refresh` después de instalar/remover skills o cuando cambie significativamente el stack del proyecto.

## Herramientas instaladas

- `gentle-ai` instalado con Scoop y configurado para Codex con preset `ecosystem-only`.
- `engram` instalado desde Go (`go install github.com/Gentleman-Programming/engram/cmd/engram@latest`).
- `gga` instalado desde el repositorio `Gentleman-Programming/gentleman-guardian-angel` con wrapper PowerShell `C:\Users\USER\bin\gga.cmd`.
- Skill registry de Gentle-AI generado en `.atl/skill-registry.md`.

## Documentación operativa creada

- `AGENTS.md`: contrato de trabajo para agentes y reglas que GGA puede usar al revisar commits.
- `docs/sdd/README.md`: índice y reglas de mantenimiento SDD.
- `docs/sdd/00-project-context.md`: contexto estable del producto.
- `docs/sdd/01-part-1-prototype/`: requirements, design y tasks del prototipo HTML/CSS/JS.
- `docs/sdd/02-part-2-final-product/`: requirements, design y tasks del producto final.
- `docs/guides/agent-skills-and-skillopt.md`: explicación de chat vs CLI, skills, AutoSkills, Gentle-AI y SkillOpt.

## Assets del proyecto

- Assets organizados por tipo en `img/photos`, `img/icons/png`, `img/icons/svg`, `video` y `audio/sfx`.
- Guía de uso: `docs/assets/ASSET_USAGE.md`.
- Fuentes/licencias/atribuciones: `docs/assets/ATTRIBUTIONS.md`.
- Resumen de auditoría: `docs/assets/AUDIT_SUMMARY.md`.
- Mapa de renombrado: `docs/assets/asset-rename-map.json`.
- Inventario final: `docs/assets/assets-inventory-final.json`.
- Asset no recomendado hasta verificar licencia: `img/archive/review/source-unknown-financial-reports-desk-500w.avif`.

## Prototipo UI/UX

- Dirección visual y diseño base: `docs/prototype/DESIGN.md`.
- Plan de pantallas y flujos: `docs/prototype/SCREEN_PLAN.md`.
- Prompt listo para Stitch/Figma AI: `docs/prototype/STITCH_FIGMA_PROMPT.md`.
- Recomendación de workflow Figma/Stitch: `docs/prototype/TOOL_WORKFLOW.md`.
- Stitch MCP disponible, pero requiere `projectId` de Stitch y, para aplicar sistema a pantallas existentes, IDs de screen instances.
- Figma MCP no está disponible en esta sesión; si se necesita, el usuario debe habilitar/proveer integración Figma.

## Skills detectadas por AutoSkills

AutoSkills detectó el proyecto como frontend web e instaló skills de proyecto en `.agents/skills`:

- `frontend-design`
- `accessibility`
- `seo`

## Stitch landing iterations

- Iteration 1 reviewed in `docs/prototype/STITCH_LANDING_FEEDBACK.md`.
- Iteration 2 reviewed in `docs/prototype/STITCH_LANDING_ITERATION_2_REVIEW.md`.
- Current status: direction is correct for web-first SaaS, but hero contrast, trust chip contrast, secondary CTA, and responsive variants still need refinement before HTML/CSS/JS implementation.
