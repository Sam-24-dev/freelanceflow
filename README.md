# FreelanceFlow

FreelanceFlow es un prototipo frontend estático de un SaaS financiero para freelancers. La entrega actual demuestra la experiencia principal del producto con navegación, captura de movimientos, gestión de clientes, proyectos, facturas y reportes, todo con datos simulados y sin backend.

## Descripción general

El objetivo de esta versión es validar la estructura funcional y visual del producto antes de pasar a una implementación con persistencia real. La demo está pensada para abrirse localmente y recorrer el flujo completo desde la landing pública hasta el dashboard y los módulos operativos.

## Módulos incluidos en esta fase

- **Landing pública**: entrada comercial del producto.
- **Dashboard**: resumen financiero con métricas, actividad reciente y accesos rápidos.
- **Movimientos**: registro y consulta de ingresos y gastos con validaciones en el cliente.
- **Clientes**: módulo obligatorio del proyecto, con alta, búsqueda, edición y detalle.
- **Proyectos**: vínculo entre clientes, ingresos, gastos, horas y rentabilidad.
- **Facturas**: listado, detalle, estados y exportación visual a PDF.
- **Reportes**: vistas consolidadas para lectura financiera y control operativo.

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

No hay que instalar un backend ni levantar una base de datos para revisar esta entrega.

### Ejecución local

1. Cloná o copiá el repositorio en tu equipo.
2. Abrí `index.html` en el navegador.
3. Desde la landing podés navegar al dashboard y al resto de la demo.

> Nota técnica: la app funciona con datos simulados locales para que la revisión visual siga disponible incluso en apertura directa.

## Detalles técnicos

### Stack

- HTML5
- CSS3 + Tailwind CSS
- JavaScript Vanilla (ES6+)

### Datos simulados

El prototipo consume datos simulados desde `assets/data/mock-data.json`.

- La carga principal usa **Fetch API / AJAX** cuando la demo se sirve desde un entorno local HTTP.
- Para abrir el proyecto en local sin backend, se incluye una capa auxiliar de carga que mantiene la demo operativa con los mismos datos simulados.

## Estructura principal del proyecto

```text
index.html
dashboard.html
transacciones.html
clientes.html
proyectos.html
facturas.html
reportes.html
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

- HTML principales del prototipo: `index.html`, `dashboard.html`, `transacciones.html`, `clientes.html`, `proyectos.html`, `facturas.html`, `reportes.html`.
- Estilos y configuración visual: `assets/css/` y `tailwind.config.js`.
- Lógica de frontend: `assets/js/`.
- Datos simulados: `assets/data/`.
- Branding usado por la app: `img/brand/`.
- Documentación funcional y de handoff: `docs/`.
- Pruebas de validación: `tests/`.
- Soporte del proyecto: `package.json`, `package-lock.json`, `robots.txt`, `site.webmanifest`.

## Archivos que no deberían subirse

No conviene subir archivos temporales o ajenos al valor del prototipo, por ejemplo:

- capturas o exports temporales,
- carpetas de pruebas visuales locales,
- artefactos de agentes o tooling local,
- archivos descartados,
- recursos no utilizados por la demo actual.

## Validación recomendada

Antes de preparar un commit o una subida, podés correr:

```bash
npm test
npm run validate
```

## Alcance actual

Esta entrega corresponde a un **prototipo frontend**. No incluye backend, base de datos, autenticación real ni APIs externas. Su función es validar estructura, experiencia, navegación y coherencia funcional antes de avanzar a fases posteriores.
