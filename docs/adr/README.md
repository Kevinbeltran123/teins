# Registro de decisiones de arquitectura

Sistema de levantamientos técnicos en campo, revisión en oficina y entrega de informes al cliente.

## Cómo leer esta carpeta

| Archivo | Contenido |
|---|---|
| [`01-impulsores.md`](../arquitectura/01-impulsores.md) | Restricciones, funcionalidades con impacto arquitectónico, escenarios de calidad priorizados, tensiones y supuestos. **Todo ADR se justifica contra este documento.** |
| [`02-modelo-dominio.md`](../arquitectura/02-modelo-dominio.md) | Lenguaje común, módulos, agregados, ciclos de vida, reglas de negocio, eventos y permisos. |
| [`03-como-funciona.md`](../arquitectura/03-como-funciona.md) | Cómo funciona hoy: estados y flujos en diagramas, ligados al código y a estos ADR. |
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

Agrupadas por área para encontrarlas rápido. Cada ADR aparece una sola vez, en el área que más toca; la columna "Estado" dice si otro lo amplía o lo reemplaza en parte.

### Sistema, plataforma y operación

| ADR | Decisión | Estado |
|---|---|---|
| [0001](0001-estilo-del-sistema.md) | Estilo del sistema: monolito modular | Aceptada |
| [0002](0002-plataforma-y-superficies-del-cliente.md) | Plataforma del cliente: PWA con tres superficies | Aceptada |
| [0010](0010-lenguaje-y-framework-del-servidor.md) | TypeScript de extremo a extremo en monorepo | Aceptada |
| [0015](0015-actualizacion-y-versionado.md) | Actualización en momento seguro y compatibilidad N-1 | Aceptada |
| [0016](0016-infraestructura-y-despliegue.md) | Contenedor propio sobre datos gestionados, en cuentas de TEINS | Aceptada; 0021 la complementa mientras TEINS no tenga cuenta; 0049 reemplaza su despliegue automático en Pruebas |
| [0017](0017-observabilidad.md) | Registros, errores con privacidad y salud de dispositivos | Aceptada |
| [0018](0018-pruebas-y-reglas-de-arquitectura.md) | Pruebas guiadas por riesgo y reglas ejecutables | Aceptada |
| [0021](0021-produccion-provisional-transferible.md) | Producción provisional en un proyecto transferible, sin datos reales hasta que pase a TEINS | Aceptada |
| [0049](0049-despliegue-manual-por-lotes-desde-github.md) | Despliegue manual por lotes desde GitHub Actions, en el orden de `montar.sh` (reemplaza en parte 0016) | Aceptada; 0056 reemplaza su regla de qué rama va a cada entorno |
| [0056](0056-ramas-cortas-versiones-y-entornos.md) | Ramas cortas, versiones etiquetadas y producción solo desde una versión (reemplaza en parte 0049) | Aceptada |

### Datos y sincronización

| ADR | Decisión | Estado |
|---|---|---|
| [0003](0003-estrategia-de-sincronizacion.md) | Sincronización asimétrica por documento | Aceptada; ampliada por 0040, 0041 y 0044 |
| [0004](0004-almacenamiento-en-el-dispositivo.md) | Almacenamiento local: IndexedDB con Dexie | Aceptada |
| [0005](0005-base-de-datos-del-servidor.md) | Base de datos: PostgreSQL relacional + documental | Aceptada |
| [0006](0006-formatos-y-respuestas.md) | Formatos como esquema de dominio versionado | Aceptada; ampliada por 0050 |
| [0007](0007-archivos.md) | Archivos: almacenamiento de objetos, direccionado por contenido | Aceptada; ampliada por 0048 |
| [0008](0008-trazabilidad-e-integridad.md) | Trazabilidad semántica con cadena de hashes por agregado | Aceptada |
| [0012](0012-eventos-y-trabajos.md) | Cola transaccional en PostgreSQL como outbox | Aceptada; ampliada por 0043 |
| [0022](0022-cifrado-local-en-campo.md) | Cifrado local en campo: qué se sella, cómo se escribe y cómo se migra | Aceptada |
| [0038](0038-epoca-de-la-bajada.md) | Época de la bajada: el teléfono se entera de que el servidor se dejó limpio | Aceptada |
| [0043](0043-recuperar-trabajos-a-medias.md) | Una tarea periódica recupera los trabajos que quedaron a medias (amplía 0012) | Aceptada |
| [0044](0044-retencion-y-poda.md) | Retención en el teléfono y poda en el servidor (amplía 0003) | Aceptada; ampliada por 0048 |
| [0045](0045-volver-a-borrador-un-envio-rechazado.md) | Un envío que oficina nunca recibió vuelve a borrador para corregirlo (amplía 0035) | Aceptada |
| [0048](0048-limpiar-archivos-sin-uso.md) | Los archivos de campo que nadie usa se borran a los 120 días (amplía 0007 y 0044) | Aceptada |
| [0050](0050-seleccion-horario-tablas-y-sello-en-los-formatos.md) | Selección, horario, tablas de medidas y sello en los formatos (amplía 0006) | Aceptada; ampliada por 0058 |
| [0058](0058-campos-condicionales.md) | Campos condicionales: un campo o una sección aparece según una selección anterior (amplía 0050) | Aceptada |
| [0051](0051-encabezado-y-firmas-del-informe.md) | El encabezado y las firmas del informe salen de la visita y de las cuentas | Aceptada |
| [0052](0052-hora-ubicacion-y-mapa-en-la-foto-de-llegada.md) | Hora, ubicación y mapa en la foto de llegada (reemplaza en parte 0009) | Aceptada |
| [0054](0054-un-levantamiento-por-tecnico-y-visita.md) | Un levantamiento por técnico y visita: el teléfono no ofrece otro y el servidor lo rechaza | Aceptada |

### Identidad y acceso

| ADR | Decisión | Estado |
|---|---|---|
| [0009](0009-identidad-y-acceso.md) | Sesiones revocables, autorización central y seguridad por fila en el portal | Aceptada; la parte 5 la concreta 0022; 0052 reemplaza su fila «sin GPS en fotos»; 0053 reemplaza su parte 4 |
| [0053](0053-acceso-al-portal-por-contacto.md) | Acceso al portal por contacto, con código por correo, e informes y cotizaciones (reemplaza la parte 4 de 0009) | Aceptada; ampliada por 0055 |
| [0055](0055-accesos-al-portal-sin-uso.md) | Los accesos al portal sin uso en 12 meses se quitan solos (amplía 0053) | Aceptada |
| [0033](0033-reactivar-usuarios-y-cuenta-propia.md) | Reactivar usuarios y administrar la cuenta propia | Aceptada |

### Visitas

| ADR | Decisión | Estado |
|---|---|---|
| [0037](0037-visitas-con-horario.md) | Visitas con horario: todo el día, de una hora a otra o hasta que el técnico la termine | Aceptada |
| [0041](0041-visitas-atendidas-salen-del-telefono.md) | Las visitas atendidas salen del teléfono al día siguiente (amplía 0003) | Aceptada; ampliada por 0042 |
| [0042](0042-reprogramar-reabre-una-visita-cerrada.md) | Reprogramar reabre una visita cerrada (amplía 0041) | Aceptada |
| [0057](0057-la-visita-lleva-su-servicio.md) | La visita lleva su servicio: oficina elige el formato al programar (reemplaza el motivo libre) | Aceptada |

### Captura en campo

| ADR | Decisión | Estado |
|---|---|---|
| [0019](0019-bocetos.md) | Bocetos vectoriales con perfect-freehand | Aceptada; reemplazada en parte por 0026 (hojas, formas y editor de la versión 2) |
| [0024](0024-firma-del-cliente.md) | Firma del cliente como constancia de la visita, guardada con el formato de los bocetos | Aceptada |
| [0025](0025-catalogo-en-el-telefono.md) | El catálogo baja al teléfono y la línea de cantidad puede llegar vinculada | Aceptada |
| [0026](0026-bocetos-con-formas.md) | Bocetos versión 2: hojas con nombre, formas enderezadas, cotas y mover, en un editor a pantalla completa | Aceptada |
| [0027](0027-simbolos-de-los-bocetos.md) | Símbolos de los bocetos: biblioteca como datos de la organización, copiada en el boceto que la usa | Aceptada |

### Revisión y conversaciones

| ADR | Decisión | Estado |
|---|---|---|
| [0032](0032-soltar-reabrir-y-devolver-una-revision.md) | Soltar, reabrir y devolver una revisión (estado "Devuelto") | Propuesta, aplazada |
| [0035](0035-archivar-clientes-comentarios-y-borradores.md) | Editar y archivar clientes, sitios y comentarios, y descartar borradores en campo | Aceptada; ampliada por 0045 y 0046 |
| [0046](0046-descartar-un-envio-en-error.md) | Descartar un envío en error: a la misma papelera de 30 días, oficina nunca lo recibió (amplía 0035) | Aceptada |
| [0040](0040-conversaciones-entre-oficina-y-campo.md) | Conversaciones entre oficina y campo: el técnico responde los comentarios (amplía 0003, 0014 y 0023) | Aceptada |

### Informe, cotización y envío al cliente

| ADR | Decisión | Estado |
|---|---|---|
| [0013](0013-generacion-de-pdf.md) | PDF desde HTML con Chromium, almacenado al publicar | Aceptada |
| [0028](0028-envio-del-informe-al-cliente.md) | Envío del informe al cliente por correo (Resend) y WhatsApp (Cloud API de Meta), con contactos del cliente y estado por envío | Aceptada; ampliada por 0036 |
| [0029](0029-cotizaciones.md) | Cotizaciones desde las cantidades revisadas, con lista de precios con historia, IVA o AIU y versiones inmutables | Aceptada; retirar versiones: reemplazada en ese punto por 0034 |
| [0031](0031-vista-en-vivo-de-los-documentos.md) | Vista en vivo de los documentos desde las mismas plantillas del PDF, en un paquete compartido | Aceptada |
| [0034](0034-cancelar-envios-y-retirar-cotizaciones.md) | Cancelar un envío en cola y retirar una versión de cotización (reemplaza a 0029 en un punto) | Aceptada; ampliada por 0047 |
| [0036](0036-correo-que-escribe-oficina.md) | El correo de un envío lo puede escribir oficina, sobre la vista previa (amplía 0028) | Aceptada |
| [0047](0047-retirar-una-version-cancela-sus-envios.md) | Retirar una versión cancela sus envíos que no han salido, con el motivo, y no se reanudan (amplía 0034) | Aceptada |
| [0039](0039-que-sale-en-el-informe.md) | Qué sale en el informe: oficina oculta partes de cada levantamiento | Aceptada |

### API y avisos

| ADR | Decisión | Estado |
|---|---|---|
| [0014](0014-api-y-notificaciones.md) | API orientada a tareas con OpenAPI; notificaciones por consulta | Aceptada; los avisos push de la parte 2 los decide 0023; ampliada por 0040 |
| [0023](0023-avisos-push.md) | Avisos push con Web Push estándar, un trabajo por suscripción y texto sin datos del cliente | Aceptada; ampliada por 0040 |

### Interfaz y marca

| ADR | Decisión | Estado |
|---|---|---|
| [0011](0011-framework-de-interfaz.md) | React con Vite y presupuesto de rendimiento | Aceptada; el presupuesto de campo lo sube 0030 |
| [0020](0020-marca-por-organizacion.md) | Marca por organización con tokens de diseño | Aceptada |
| [0030](0030-presupuesto-de-campo-para-el-rediseno.md) | El presupuesto de JavaScript inicial de campo sube a 135 KB para el rediseño Recorrido | Aceptada |

## Estados y convenciones

### Estados

- **Propuesta:** redactada, pendiente de revisión.
- **Aceptada:** vigente.
- **Reemplazada por NNNN:** ya no vigente; se conserva por historia. Un ADR aceptado nunca se edita para cambiar la decisión: se escribe uno nuevo que lo reemplaza.

### Leyenda de las matrices de evaluación

**●** cumple bien · **◐** cumple con costo o condiciones · **○** no cumple

### Principio que rige todas las decisiones

> ¿Qué escenario de calidad se rompe si quito esta pieza? Si la respuesta es "ninguno", la pieza sale.
