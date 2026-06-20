# FreelanceFlow

FreelanceFlow es un prototipo web estático de un SaaS financiero para freelancers. Esta fase presenta una landing pública, un dashboard demo con datos simulados y pantallas secundarias conectadas para validar navegación, estructura visual y coherencia del producto antes de construir backend y base de datos.

## Estado actual

**Fase:** Prototipo frontend estático  
**Stack:** HTML + CSS + JavaScript puro  
**Backend:** No incluido  
**Base de datos:** No incluida  
**Datos:** Mock local en JSON

## Qué incluye esta versión

- Landing pública en `index.html`.
- Dashboard funcional de demostración en `dashboard.html`.
- Carga de datos simulados desde `assets/data/mock-data.json`.
- Tarjetas de métricas financieras.
- Tabla de transacciones recientes.
- Resumen de clientes, proyectos y presupuesto.
- Formulario de movimiento con validación básica en JavaScript puro.
- Pantallas secundarias placeholder para módulos futuros.
- Branding final en `img/brand/`.
- Metadatos SEO básicos, Open Graph, manifest, sitemap y robots.

## Estructura del proyecto

```text
.
├── index.html                    # Landing pública
├── dashboard.html                # Dashboard demo de Fase 1
├── registro.html                 # Placeholder Fase 2
├── login.html                    # Placeholder Fase 2
├── perfil.html                   # Placeholder Fase 2
├── configuracion_fiscal.html     # Placeholder Fase 2
├── ajustes.html                  # Placeholder Fase 2
├── categorias.html               # Placeholder Fase 2
├── servicios.html                # Placeholder Fase 2
├── propuestas.html               # Placeholder Fase 2
├── facturas.html                 # Placeholder Fase 2
├── reportes.html                 # Placeholder Fase 2
├── notificaciones.html           # Placeholder Fase 2
├── assets/
│   ├── css/styles.css            # Estilos propios del prototipo
│   ├── js/dashboard.js           # Lógica del dashboard demo
│   └── data/mock-data.json       # Datos simulados
├── img/brand/                    # Logos, favicon, app icons y Open Graph
├── docs/
│   ├── prototype/                # Diseño, pantalla y branding de Fase 1
│   ├── sdd/                      # Especificación por fases
│   └── specs/                    # Requerimientos y catálogos funcionales
├── robots.txt
├── sitemap.xml
├── site.webmanifest
└── README.md
```

## Cómo ejecutarlo localmente

Abrí el proyecto con un servidor local para que `fetch()` pueda cargar el JSON correctamente.

Con Python:

```bash
python -m http.server 4177
```

Luego abrí:

```text
http://127.0.0.1:4177/index.html
```

## Flujo principal

```text
Landing → Ver demo → Dashboard → Registrar movimiento
```

- `index.html` explica el producto y muestra la propuesta de valor.
- `dashboard.html` muestra el prototipo operativo con mock data.
- Las demás páginas existen físicamente para navegación, pero muestran “Módulo en construcción - Fase 2”.

## Branding

Los assets finales de marca viven en `img/brand/`.

| Uso | Archivo |
| --- | --- |
| Logo principal | `freelanceflow-logo-color.svg` |
| Logo monocromo | `freelanceflow-logo-mono.svg` |
| Marca aislada | `freelanceflow-mark-color.svg` |
| Favicon | `favicon-32.png` |
| Apple touch icon | `apple-touch-icon.png` |
| Manifest icon | `maskable-icon-512.png` |
| Open Graph | `og-freelanceflow.png` |

## SEO y publicación

Esta versión incluye SEO técnico básico:

- `<title>` y meta description.
- Open Graph y Twitter card.
- JSON-LD `SoftwareApplication`.
- `robots.txt`.
- `sitemap.xml`.
- `site.webmanifest`.

Antes de publicar, reemplazar el dominio placeholder:

```text
https://freelanceflow.example/
```

por el dominio real del despliegue.

## Alcance fuera de esta fase

Esta versión no incluye:

- Backend.
- Base de datos.
- Autenticación real.
- APIs.
- React, Django o app móvil.
- Persistencia real de transacciones.

Eso pertenece a la siguiente etapa del proyecto.

## Validación rápida

```bash
node --check assets/js/dashboard.js
node --check assets/js/clientes.js
```

También verificar manualmente:

- `index.html` carga primero la landing.
- “Ver demo” navega a `dashboard.html`.
- El dashboard carga datos desde `assets/data/mock-data.json`.
- El formulario de movimiento valida sin recargar la página.
- No hay imágenes, videos, audios ni herramientas locales no usadas en el repo público.
