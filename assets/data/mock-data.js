window.FreelanceFlowMockData = {
  "usuario": {
    "id": "usr_001",
    "nombre_completo": "Andrés Vélez Moreno",
    "correo_electronico": "andres.velez@freelanceflow.dev",
    "pais_residencia": "Ecuador"
  },
  "clientes": [
    {
      "id": "cli_001",
      "nombre_razon_social": "Bodega Andina S.A.",
      "tipo_cliente": "Empresa",
      "nombres": "Marcela",
      "apellidos": "Ríos Paredes",
      "identificacion": "1791234567001",
      "identificacion_fiscal": "1791234567001",
      "telefono": "+593 2 245 6789",
      "celular": "+593 99 845 6712",
      "correo": "marcela.rios@bodegaandina.com.ec",
      "correo_electronico": "marcela.rios@bodegaandina.com.ec",
      "direccion": "Av. 6 de Diciembre N34-120, Quito",
      "estadoCivil": "casado",
      "estado": "activo",
      "fecha_registro": "2026-04-02"
    },
    {
      "id": "cli_002",
      "nombre_razon_social": "BrightWave Marketing LLC",
      "tipo_cliente": "Empresa",
      "nombres": "Daniel",
      "apellidos": "Morrison Clark",
      "identificacion": "EIN-87-1234567",
      "identificacion_fiscal": "EIN-87-1234567",
      "telefono": "+1 305 555 0142",
      "celular": "+1 786 555 0188",
      "correo": "daniel.morrison@brightwavemkt.com",
      "correo_electronico": "daniel.morrison@brightwavemkt.com",
      "direccion": "1200 Brickell Ave, Miami, FL",
      "estadoCivil": "soltero",
      "estado": "activo",
      "fecha_registro": "2026-01-12"
    }
  ],
  "categorias_gasto": [
    {
      "id": "cat_001",
      "nombre_categoria": "Software y suscripciones",
      "es_deducible_por_defecto": true,
      "descripcion": "Herramientas digitales recurrentes para diseño, gestión y productividad.",
      "presupuesto_mensual": 120,
      "estado": "activo"
    },
    {
      "id": "cat_002",
      "nombre_categoria": "Transporte y movilidad",
      "es_deducible_por_defecto": true,
      "descripcion": "Traslados operativos vinculados a reuniones, entregas y trabajo de campo.",
      "presupuesto_mensual": 40,
      "estado": "activo"
    },
    {
      "id": "cat_003",
      "nombre_categoria": "Hosting y dominios",
      "es_deducible_por_defecto": true,
      "descripcion": "Infraestructura web necesaria para publicar y mantener proyectos activos.",
      "presupuesto_mensual": 80,
      "estado": "activo"
    },
    {
      "id": "cat_004",
      "nombre_categoria": "Equipos y oficina",
      "es_deducible_por_defecto": true,
      "descripcion": "Equipos, papelería y mejoras menores del espacio de trabajo.",
      "presupuesto_mensual": 150,
      "estado": "activo"
    }
  ],
  "proyectos": [
    {
      "id": "proy_001",
      "nombre_proyecto": "Rediseño de sitio web corporativo",
      "cliente_id": "cli_001",
      "propuesta_origen": "prop_001",
      "descripcion": "Rediseño integral del sitio institucional, catálogo de productos y optimización de la experiencia móvil.",
      "fecha_inicio": "2026-04-01",
      "fecha_fin_estimada": "2026-07-15",
      "estado": "ACTIVE",
      "modalidad_cobro": "Tarifa fija",
      "monto_fijo": 1800,
      "tarifa_hora": 0,
      "presupuesto_horas_estimado": 90
    },
    {
      "id": "proy_002",
      "nombre_proyecto": "Mantenimiento mensual plataforma e-commerce",
      "cliente_id": "cli_001",
      "propuesta_origen": "",
      "descripcion": "Soporte técnico, correcciones y actualizaciones mensuales de la tienda en línea.",
      "fecha_inicio": "2026-02-01",
      "fecha_fin_estimada": "",
      "estado": "ACTIVE",
      "modalidad_cobro": "Por horas",
      "monto_fijo": 0,
      "tarifa_hora": 25,
      "presupuesto_horas_estimado": 20
    },
    {
      "id": "proy_003",
      "nombre_proyecto": "Consultoría frontend para campaña digital",
      "cliente_id": "cli_002",
      "propuesta_origen": "prop_002",
      "descripcion": "Consultoría y construcción de componentes frontend para una campaña de lanzamiento digital.",
      "fecha_inicio": "2026-01-10",
      "fecha_fin_estimada": "2026-03-31",
      "estado": "COMPLETED",
      "modalidad_cobro": "Por horas",
      "monto_fijo": 0,
      "tarifa_hora": 35,
      "presupuesto_horas_estimado": 60
    }
  ],
  "registros_tiempo": [
    {
      "id": "time_001",
      "proyecto_id": "proy_001",
      "fecha_trabajo": "2026-06-03",
      "horas_trabajadas": 6.5,
      "descripcion_actividad": "Arquitectura de información y sistema visual",
      "facturable": true
    },
    {
      "id": "time_002",
      "proyecto_id": "proy_001",
      "fecha_trabajo": "2026-06-11",
      "horas_trabajadas": 8,
      "descripcion_actividad": "Implementación responsive del catálogo",
      "facturable": true
    },
    {
      "id": "time_003",
      "proyecto_id": "proy_002",
      "fecha_trabajo": "2026-06-06",
      "horas_trabajadas": 4,
      "descripcion_actividad": "Actualización de dependencias y revisión de checkout",
      "facturable": true
    },
    {
      "id": "time_004",
      "proyecto_id": "proy_002",
      "fecha_trabajo": "2026-06-14",
      "horas_trabajadas": 3.5,
      "descripcion_actividad": "Corrección de errores reportados por el cliente",
      "facturable": true
    },
    {
      "id": "time_005",
      "proyecto_id": "proy_003",
      "fecha_trabajo": "2026-03-28",
      "horas_trabajadas": 57,
      "descripcion_actividad": "Cierre técnico y documentación de entrega",
      "facturable": true
    }
  ],
  "facturas": [
    {
      "id": "fac_024",
      "cliente_id": "cli_002",
      "proyecto_relacionado_id": "",
      "numero_factura": "FAC-0024",
      "fecha_emision": "2026-06-20",
      "fecha_vencimiento": "2026-07-10",
      "moneda": "USD",
      "estado": "DRAFT",
      "items": [
        {
          "id": "item_024_1",
          "origen_item": "Manual",
          "descripcion_item": "Auditoría de experiencia para campaña",
          "cantidad": 1,
          "precio_unitario": 700
        }
      ],
      "descuento": 0,
      "impuestos": 0,
      "total_factura": 700,
      "monto_pagado_acumulado": 0,
      "saldo_pendiente": 700
    },
    {
      "id": "fac_023",
      "cliente_id": "cli_002",
      "proyecto_relacionado_id": "proy_003",
      "numero_factura": "FAC-0023",
      "fecha_emision": "2026-06-18",
      "fecha_vencimiento": "2026-07-05",
      "moneda": "USD",
      "estado": "SENT",
      "items": [
        {
          "id": "item_023_1",
          "origen_item": "Desde tiempo",
          "descripcion_item": "Consultoría frontend especializada",
          "cantidad": 30,
          "precio_unitario": 35
        },
        {
          "id": "item_023_2",
          "origen_item": "Manual",
          "descripcion_item": "Documentación y entrega técnica",
          "cantidad": 1,
          "precio_unitario": 200
        }
      ],
      "descuento": 0,
      "impuestos": 0,
      "total_factura": 1250,
      "monto_pagado_acumulado": 0,
      "saldo_pendiente": 1250
    },
    {
      "id": "fac_022",
      "cliente_id": "cli_001",
      "proyecto_relacionado_id": "proy_002",
      "numero_factura": "FAC-0022",
      "fecha_emision": "2026-06-02",
      "fecha_vencimiento": "2026-06-17",
      "moneda": "USD",
      "estado": "PAID",
      "items": [
        {
          "id": "item_022_1",
          "origen_item": "Desde tiempo",
          "descripcion_item": "Mantenimiento plataforma e-commerce — mayo",
          "cantidad": 20,
          "precio_unitario": 25
        }
      ],
      "descuento": 0,
      "impuestos": 0,
      "total_factura": 500,
      "monto_pagado_acumulado": 525,
      "saldo_pendiente": 0,
      "saldo_a_favor": 25
    },
    {
      "id": "fac_021",
      "cliente_id": "cli_001",
      "proyecto_relacionado_id": "proy_001",
      "numero_factura": "FAC-0021",
      "fecha_emision": "2026-06-01",
      "fecha_vencimiento": "2026-06-16",
      "moneda": "USD",
      "estado": "PARTIAL",
      "items": [
        {
          "id": "item_021_1",
          "origen_item": "Desde catálogo",
          "descripcion_item": "Rediseño integral de sitio web corporativo",
          "cantidad": 1,
          "precio_unitario": 1800
        }
      ],
      "descuento": 0,
      "impuestos": 0,
      "total_factura": 1800,
      "monto_pagado_acumulado": 850,
      "saldo_pendiente": 950
    },
    {
      "id": "fac_020",
      "cliente_id": "cli_001",
      "proyecto_relacionado_id": "proy_002",
      "numero_factura": "FAC-0020",
      "fecha_emision": "2026-05-15",
      "fecha_vencimiento": "2026-05-30",
      "moneda": "USD",
      "estado": "OVERDUE",
      "items": [
        {
          "id": "item_020_1",
          "origen_item": "Desde tiempo",
          "descripcion_item": "Soporte técnico extraordinario — abril",
          "cantidad": 12,
          "precio_unitario": 25
        }
      ],
      "descuento": 0,
      "impuestos": 0,
      "total_factura": 300,
      "monto_pagado_acumulado": 0,
      "saldo_pendiente": 300
    },
    {
      "id": "fac_019",
      "cliente_id": "cli_002",
      "proyecto_relacionado_id": "proy_003",
      "numero_factura": "FAC-0019",
      "fecha_emision": "2026-04-02",
      "fecha_vencimiento": "2026-04-17",
      "moneda": "USD",
      "estado": "VOID",
      "items": [
        {
          "id": "item_019_1",
          "origen_item": "Manual",
          "descripcion_item": "Entrega adicional de campaña",
          "cantidad": 1,
          "precio_unitario": 400
        }
      ],
      "descuento": 0,
      "impuestos": 0,
      "total_factura": 400,
      "monto_pagado_acumulado": 0,
      "saldo_pendiente": 0,
      "motivo_anulacion": "Se emitió con una descripción incorrecta y fue reemplazada.",
      "fecha_anulacion": "2026-04-03"
    }
  ],
  "pagos_factura": [
    {
      "id": "pay_001",
      "factura_id": "fac_021",
      "monto_pagado": 850,
      "fecha_pago": "2026-06-10",
      "metodo_pago": "Transferencia bancaria",
      "referencia_comprobante": "TRX-984231",
      "notas": "Primer abono acordado con el cliente."
    },
    {
      "id": "pay_002",
      "factura_id": "fac_022",
      "monto_pagado": 500,
      "fecha_pago": "2026-06-05",
      "metodo_pago": "Transferencia bancaria",
      "referencia_comprobante": "TRX-978104",
      "notas": "Pago total de la factura."
    },
    {
      "id": "pay_003",
      "factura_id": "fac_022",
      "monto_pagado": 25,
      "fecha_pago": "2026-06-06",
      "metodo_pago": "Transferencia bancaria",
      "referencia_comprobante": "TRX-978352",
      "notas": "Excedente registrado como saldo a favor."
    }
  ],
  "gastos": [
    {
      "id": "gasto_001",
      "fecha_gasto": "2026-06-08",
      "categoria_gasto_id": "cat_001",
      "monto": 54.99,
      "moneda": "USD",
      "proyecto_relacionado_id": "proy_001",
      "es_deducible": true,
      "descripcion": "Suscripción mensual a herramienta de diseño"
    },
    {
      "id": "gasto_002",
      "fecha_gasto": "2026-06-12",
      "categoria_gasto_id": "cat_002",
      "monto": 12.5,
      "moneda": "USD",
      "proyecto_relacionado_id": "proy_002",
      "es_deducible": true,
      "descripcion": "Transporte a reunión con cliente"
    }
  ],
  "movimientos_financieros_mock_auxiliar": [
    {
      "id": "mov_001",
      "mock_auxiliar": true,
      "origen_oficial": "pago_factura",
      "origen_id": "pay_001",
      "tipo": "ingreso",
      "fecha": "2026-06-10",
      "monto": 850,
      "moneda": "USD",
      "cliente_id": "cli_001",
      "proyecto_id": "proy_001",
      "descripcion": "Pago parcial de factura FAC-0021",
      "cuenta_id": "aux_cta_001"
    },
    {
      "id": "mov_002",
      "mock_auxiliar": true,
      "origen_oficial": "pago_factura",
      "origen_id": "pay_002",
      "tipo": "ingreso",
      "fecha": "2026-06-05",
      "monto": 500,
      "moneda": "USD",
      "cliente_id": "cli_001",
      "proyecto_id": "proy_002",
      "descripcion": "Pago completo de factura FAC-0022",
      "cuenta_id": "aux_cta_001"
    },
    {
      "id": "mov_003",
      "mock_auxiliar": true,
      "origen_oficial": "gasto",
      "origen_id": "gasto_001",
      "tipo": "gasto",
      "fecha": "2026-06-08",
      "monto": 54.99,
      "moneda": "USD",
      "cliente_id": null,
      "proyecto_id": "proy_001",
      "categoria_gasto_id": "cat_001",
      "descripcion": "Suscripción mensual a herramienta de diseño",
      "cuenta_id": "aux_cta_001"
    },
    {
      "id": "mov_004",
      "mock_auxiliar": true,
      "origen_oficial": "gasto",
      "origen_id": "gasto_002",
      "tipo": "gasto",
      "fecha": "2026-06-12",
      "monto": 12.5,
      "moneda": "USD",
      "cliente_id": "cli_001",
      "proyecto_id": "proy_002",
      "categoria_gasto_id": "cat_002",
      "descripcion": "Transporte a reunión con cliente",
      "cuenta_id": "aux_cta_002"
    }
  ],
  "presupuestos": [
    {
      "id": "budget_2026_06",
      "periodo": "Mensual",
      "periodo_clave": "2026-06",
      "meta_ingresos": 1800,
      "meta_horas_facturables": 80,
      "limites_gasto_por_categoria": [
        {
          "categoria_id": "cat_001",
          "limite": 60
        },
        {
          "categoria_id": "cat_002",
          "limite": 10
        },
        {
          "categoria_id": "cat_003",
          "limite": 30
        },
        {
          "categoria_id": "cat_004",
          "limite": 200
        }
      ],
      "fecha_actualizacion": "2026-06-20"
    }
  ],
  "cuentas_mock_auxiliar": [
    {
      "id": "aux_cta_001",
      "mock_auxiliar": true,
      "nombre_cuenta": "Banco principal",
      "tipo_cuenta": "banco"
    },
    {
      "id": "aux_cta_002",
      "mock_auxiliar": true,
      "nombre_cuenta": "Efectivo",
      "tipo_cuenta": "efectivo"
    },
    {
      "id": "aux_cta_003",
      "mock_auxiliar": true,
      "nombre_cuenta": "Billetera digital",
      "tipo_cuenta": "billetera_digital"
    }
  ]
};
