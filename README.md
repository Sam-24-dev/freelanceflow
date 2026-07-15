# FreelanceFlow

FreelanceFlow es la experiencia frontend de un SaaS financiero para freelancers y equipos pequeños. La versión actual integra acceso por perfil, gestión operativa y trazabilidad de actividad, además de movimientos, clientes, proyectos, facturas y reportes.

## Descripción general

Esta versión consolida la estructura funcional y visual del producto antes de incorporar persistencia y autenticación de servidor. Permite recorrer el flujo completo desde la landing pública, elegir un perfil de trabajo y acceder a la operación financiera o a la Bitácora administrativa.

## Módulos incluidos

- **Landing pública**: entrada comercial del producto.
- **Acceso por perfil**: separa el trabajo operativo de la revisión administrativa.
- **Dashboard**: resumen financiero con métricas, actividad reciente y accesos rápidos.
- **Movimientos**: registro y consulta de ingresos y gastos con validaciones en el cliente.
- **Clientes**: módulo obligatorio del proyecto, con alta, búsqueda, edición y detalle.
- **Proyectos**: vínculo entre clientes, ingresos, gastos, horas y rentabilidad.
- **Facturas**: listado, detalle, estados y exportación visual a PDF.
- **Reportes**: vistas consolidadas para lectura financiera y control operativo.
- **Bitácora**: revisión administrativa de la actividad operativa reciente de la sesión.

### Módulo obligatorio de Clientes

El módulo **Clientes** incorpora los campos y reglas exigidos por el contexto académico, manteniendo el modelo B2B del sistema:

- `nombres` y `apellidos` obligatorios.
- `identificacion` obligatoria y única.
- `celular` obligatorio.
- `correo` obligatorio y con formato válido.
- `estadoCivil` obligatorio con valores controlados.
- `estado` obligatorio con valores activos o inactivos.

En la interfaz, estos datos representan el **Contacto Principal / Representante Legal** del cliente empresarial.

## Instrucciones de ejecución

No hace falta instalar un backend ni levantar una base de datos para ejecutar esta versión.

### Ejecución local

1. Cloná el repositorio e ingresá a su directorio.
2. Ejecutá `python -m http.server 4177`.
3. Abrí `http://127.0.0.1:4177/` y elegí el perfil de trabajo desde la landing.

> La información operativa y la Bitácora se mantienen en el navegador durante esta etapa frontend.

## Detalles técnicos

### Stack

- HTML5
- CSS3 + Tailwind CSS
- JavaScript Vanilla (ES6+)

### Datos locales

La aplicación consume datos locales desde `assets/data/mock-data.json`.

- La carga principal usa **Fetch API / AJAX** desde el servidor local.
- Una capa auxiliar mantiene disponibles los mismos datos cuando no existe un backend.

## Estructura principal del proyecto

```text
index.html
pages/
  acceso.html
  dashboard.html
  transacciones.html
  clientes.html
  proyectos.html
  facturas.html
  reportes.html
  bitacora.html
assets/
  css/
  js/
  data/
img/brand/
docs/
tests/
README.md
```

## Archivos importantes del repositorio

Para que la app funcione y el repositorio tenga valor real, conviene mantener estos grupos de archivos:

- HTML principales: `index.html` y las pantallas de `pages/`.
- Estilos y configuración visual: `assets/css/` y `tailwind.config.js`.
- Lógica de frontend: `assets/js/`.
- Datos simulados: `assets/data/`.
- Branding usado por la app: `img/brand/`.
- Documentación funcional y de handoff: `docs/`.
- Pruebas de validación: `tests/`.
- Soporte del proyecto: `package.json`, `package-lock.json`, `robots.txt`, `site.webmanifest`.

## Archivos que no deberían subirse

No conviene subir archivos temporales o ajenos al producto, por ejemplo:

- capturas o exports temporales,
- carpetas de pruebas visuales locales,
- artefactos de agentes o tooling local,
- archivos descartados,
- recursos no utilizados por la versión actual.

## Validación recomendada

Antes de preparar un commit o una subida, podés correr:

```bash
npm test
npm run validate
```

## Alcance actual

Esta entrega corresponde a una **versión frontend estática**. No incluye backend, base de datos, autenticación real ni APIs externas. El acceso por perfil y la Bitácora funcionan en el navegador y preparan la evolución posterior del producto.
