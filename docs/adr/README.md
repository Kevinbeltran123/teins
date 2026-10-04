# Registro de decisiones de arquitectura

Sistema de levantamientos técnicos en campo, revisión en oficina y entrega de informes al cliente.

## Cómo leer esta carpeta

| Archivo | Contenido |
|---|---|
| [`01-impulsores.md`](../arquitectura/01-impulsores.md) | Restricciones, funcionalidades con impacto arquitectónico, escenarios de calidad priorizados, tensiones y supuestos. **Todo ADR se justifica contra este documento.** |
| [`02-modelo-dominio.md`](../arquitectura/02-modelo-dominio.md) | Lenguaje común, módulos, agregados, ciclos de vida, reglas de negocio, eventos y permisos. |
| Esta carpeta | Registro de decisiones de arquitectura (ADR), una por archivo. |

## Convenciones de identificadores

| Prefijo | Significado | Dónde se define |
|---|---|---|
| `R-n` | Restricción no negociable | `01-impulsores.md` |
| `F-n` | Funcionalidad con impacto arquitectónico | `01-impulsores.md` |
| `QA-n` | Escenario de atributo de calidad | `01-impulsores.md` |
| `I-n` | Hallazgo de la investigación de huecos | `01-impulsores.md` |
| `P-n` | Pregunta al cliente (numeración de la lista original de 51) | `01-impulsores.md` |

## Registro de decisiones

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-estilo-del-sistema.md) | Estilo del sistema: monolito modular | Aceptada |
| [0002](0002-plataforma-y-superficies-del-cliente.md) | Plataforma del cliente: PWA con tres superficies | Aceptada |
| [0003](0003-estrategia-de-sincronizacion.md) | Sincronización asimétrica por documento | Aceptada |
| [0004](0004-almacenamiento-en-el-dispositivo.md) | Almacenamiento local: IndexedDB con Dexie | Aceptada |
| [0005](0005-base-de-datos-del-servidor.md) | Base de datos: PostgreSQL relacional + documental | Aceptada |
| [0006](0006-formatos-y-respuestas.md) | Formatos como esquema de dominio versionado | Aceptada |
| [0007](0007-archivos.md) | Archivos: almacenamiento de objetos, direccionado por contenido | Aceptada |
| [0008](0008-trazabilidad-e-integridad.md) | Trazabilidad semántica con cadena de hashes por agregado | Aceptada |
| [0009](0009-identidad-y-acceso.md) | Sesiones revocables, autorización central y seguridad por fila en el portal | Aceptada |
| [0010](0010-lenguaje-y-framework-del-servidor.md) | TypeScript de extremo a extremo en monorepo | Aceptada |
| [0011](0011-framework-de-interfaz.md) | React con Vite y presupuesto de rendimiento | Aceptada |
| [0012](0012-eventos-y-trabajos.md) | Cola transaccional en PostgreSQL como outbox | Aceptada |
| [0013](0013-generacion-de-pdf.md) | PDF desde HTML con Chromium, almacenado al publicar | Aceptada |
| [0014](0014-api-y-notificaciones.md) | API orientada a tareas con OpenAPI; notificaciones por consulta | Aceptada; los avisos push de la parte 2 los decide 0023 |
| [0015](0015-actualizacion-y-versionado.md) | Actualización en momento seguro y compatibilidad N-1 | Aceptada |
| [0016](0016-infraestructura-y-despliegue.md) | Contenedor propio sobre datos gestionados, en cuentas de TEINS | Aceptada |
| [0017](0017-observabilidad.md) | Registros, errores con privacidad y salud de dispositivos | Aceptada |
| [0018](0018-pruebas-y-reglas-de-arquitectura.md) | Pruebas guiadas por riesgo y reglas ejecutables | Aceptada |
| [0019](0019-bocetos.md) | Bocetos vectoriales con perfect-freehand | Aceptada; hojas, formas y editor de la versión 2 en 0026 |
| [0020](0020-marca-por-organizacion.md) | Marca por organización con tokens de diseño | Aceptada |
| [0021](0021-produccion-provisional-transferible.md) | Producción provisional en un proyecto transferible, sin datos reales hasta que pase a TEINS | Aceptada |
| [0022](0022-cifrado-local-en-campo.md) | Cifrado local en campo: qué se sella, cómo se escribe y cómo se migra | Aceptada |
| [0023](0023-avisos-push.md) | Avisos push con Web Push estándar, un trabajo por suscripción y texto sin datos del cliente | Aceptada |
| [0024](0024-firma-del-cliente.md) | Firma del cliente como constancia de la visita, guardada con el formato de los bocetos | Aceptada |
| [0025](0025-catalogo-en-el-telefono.md) | El catálogo baja al teléfono y la línea de cantidad puede llegar vinculada | Aceptada |
| [0026](0026-bocetos-con-formas.md) | Bocetos versión 2: hojas con nombre, formas enderezadas, cotas y mover, en un editor a pantalla completa | Aceptada |
| [0027](0027-simbolos-de-los-bocetos.md) | Símbolos de los bocetos: biblioteca como datos de la organización, copiada en el boceto que la usa | Aceptada |
| [0028](0028-envio-del-informe-al-cliente.md) | Envío del informe al cliente por correo (Resend) y WhatsApp (Cloud API de Meta), con contactos del cliente y estado por envío | Aceptada |
| [0029](0029-cotizaciones.md) | Cotizaciones desde las cantidades revisadas, con lista de precios con historia, IVA o AIU y versiones inmutables | Aceptada (retirar versiones: reemplazado por 0034) |
| [0030](0030-presupuesto-de-campo-para-el-rediseno.md) | El presupuesto de JavaScript inicial de campo sube a 135 KB para el rediseño Recorrido | Aceptada |
| [0031](0031-vista-en-vivo-de-los-documentos.md) | Vista en vivo de los documentos desde las mismas plantillas del PDF, en un paquete compartido | Aceptada |
| [0032](0032-soltar-reabrir-y-devolver-una-revision.md) | Soltar, reabrir y devolver una revisión (estado "Devuelto") | Propuesta, aplazada |
| [0033](0033-reactivar-usuarios-y-cuenta-propia.md) | Reactivar usuarios y administrar la cuenta propia | Aceptada |
| [0034](0034-cancelar-envios-y-retirar-cotizaciones.md) | Cancelar un envío en cola y retirar una versión de cotización (reemplaza a 0029 en un punto) | Aceptada |
| [0035](0035-archivar-clientes-comentarios-y-borradores.md) | Editar y archivar clientes, sitios y comentarios, y descartar borradores en campo | Aceptada |
| [0036](0036-correo-que-escribe-oficina.md) | El correo de un envío lo puede escribir oficina, sobre la vista previa (amplía 0028) | Aceptada |
| [0037](0037-visitas-con-horario.md) | Visitas con horario: todo el día, de una hora a otra o hasta que el técnico la termine | Aceptada |
| [0038](0038-epoca-de-la-bajada.md) | Época de la bajada: el teléfono se entera de que el servidor se dejó limpio | Aceptada |
| [0039](0039-que-sale-en-el-informe.md) | Qué sale en el informe: oficina oculta partes de cada levantamiento | Aceptada |

### Estados

- **Propuesta:** redactada, pendiente de revisión.
- **Aceptada:** vigente.
- **Reemplazada por NNNN:** ya no vigente; se conserva por historia. Un ADR aceptado nunca se edita para cambiar la decisión: se escribe uno nuevo que lo reemplaza.

### Leyenda de las matrices de evaluación

**●** cumple bien · **◐** cumple con costo o condiciones · **○** no cumple

### Principio que rige todas las decisiones

> ¿Qué escenario de calidad se rompe si quito esta pieza? Si la respuesta es "ninguno", la pieza sale.
