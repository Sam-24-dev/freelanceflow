# FreelanceFlow

FreelanceFlow centraliza la operación financiera y comercial de profesionales independientes y equipos pequeños: clientes, proyectos, movimientos, propuestas, facturas y seguimiento operativo.

## Módulos actuales

- **Control financiero:** dashboard, movimientos, facturas, pagos, reportes y alertas.
- **Operación comercial:** clientes, servicios, propuestas y proyectos.
- **Configuración personal:** categorías de gasto, configuración fiscal estimada, ajustes de facturación y cuenta.
- **Administración:** Bitácora de actividad.

## Roles

- **Operativo:** accede a los módulos de gestión y configuración.
- **Administrativo:** accede únicamente a la Bitácora para consultar la actividad registrada.

## Alcance técnico actual

La aplicación es un frontend web estático de múltiples páginas. Usa datos de ejemplo y persistencia local del navegador para las interacciones disponibles. No incluye backend, autenticación o autorización reales, entrega de correo o notificaciones externas, ni procesamiento de pagos.

## Tecnología y estructura

- HTML, CSS y JavaScript.
- Tailwind CSS para compilación de estilos y jsPDF para generación local de documentos.
- `pages/`: pantallas de la aplicación.
- `assets/`: estilos, scripts y datos de ejemplo.
- `tests/`: pruebas automatizadas de lógica y controladores.

## Ejecutar localmente

```bash
python -m http.server 4177
```

Abre `http://127.0.0.1:4177/` en el navegador.

## Validar cambios

```bash
npm ci
npm run validate
npm test
python -m json.tool assets/data/mock-data.json
```

## Documentación

- [Visión del producto](docs/product-overview.md)
- [Historias de usuario](docs/user-stories.md)
- [Decisiones vigentes](docs/decisions.md)
