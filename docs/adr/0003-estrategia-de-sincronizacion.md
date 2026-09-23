# ADR-0003 · Sincronización asimétrica por documento

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-1, QA-2, QA-3, QA-5, QA-8, QA-21, I-2, I-3, I-5, I-8, I-9, R1, R2, R6
- **Depende de:** ADR-0001, ADR-0002

## Contexto

Los dispositivos de campo pasan horas sin conexión; el servidor es la fuente oficial. Antes de comparar herramientas hay que caracterizar el problema:

| Dirección | Qué viaja | Características |
|---|---|---|
| **Subida** | Levantamientos enviados y sus archivos | Un solo escritor por levantamiento; se entrega una vez, como unidad, al pulsar "Enviar"; archivos inmutables |
| **Bajada** | Visitas asignadas, clientes y sitios necesarios, versiones de formato, catálogo, unidades, comentarios, estado de mis levantamientos, órdenes de borrado | Solo lectura en el dispositivo; poco volumen; cambia poco |

**Conclusión:** TEINS no necesita replicación bidireccional con resolución de conflictos. Necesita entregar documentos en un sentido y distribuir datos de referencia en el otro.

## Opciones

| Opción | Qué es |
|---|---|
| A. PowerSync | Sincroniza SQLite en el cliente con Postgres, MongoDB o MySQL; reglas de qué va a cada cliente; escritura por el backend propio |
| B. ElectricSQL | Solo bajada desde Postgres; la escritura es responsabilidad de la aplicación |
| C. RxDB con replicación | Base local de JavaScript con backend propio por HTTP |
| D. CouchDB + PouchDB | Replicación de documentos con revisiones y conflictos explícitos |
| E. Firestore con persistencia local | BaaS con caché sin conexión |
| F. CRDTs (Automerge, Yjs, Jazz) | Fusión automática de ediciones simultáneas |
| **G. Protocolo propio por documento** | Subida por comandos idempotentes por agregado; bajada incremental con punto de control |

## Evaluación

| Criterio | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| Llegada completa del levantamiento (QA-2) | ◐ | ◐ | ◐ | ◐ | ○ | ◐ | ● |
| Trazabilidad con valor anterior en servidor (QA-8) | ● | ● | ● | ◐ | ○ | ○ | ● |
| Sin piezas extra que TEINS deba alojar (R6, QA-19) | ○ | ○ | ● | ○ | ● | ◐ | ● |
| Libertad para elegir la base del servidor | ◐ | ○ | ● | ○ | ○ | ◐ | ● |
| Sin dependencia de un proveedor | ◐ | ● | ● | ● | ○ | ● | ● |
| Base local probada | ● | ● | ● | ● | ● | ● | ◐ |
| Casos borde ya resueltos por otros | ● | ◐ | ◐ | ● | ● | ● | ○ |
| Esfuerzo acotado para este problema | ◐ | ◐ | ◐ | ○ | ● | ○ | ◐ |
| Revocación y borrado remoto (QA-5) | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ● |

## Decisión

**G. Protocolo propio por documento**, sobre piezas estándar: almacenamiento local (ADR-0004), outbox en el cliente y endpoints idempotentes en el servidor.

### Subida

1. Todo se guarda localmente al instante. **Los borradores no suben** (riesgo de pérdida de dispositivo aceptado según P15).
2. **Las fotos suben por adelantado** cuando hay señal (los bocetos, editables durante el borrador, suben al enviar; ver ADR-0019). Son inmutables y se identifican por su huella SHA-256 (ADR-0007). Un archivo interrumpido se **reintenta completo**: comprimido pesa unos cientos de KB, así que no se justifica un protocolo de carga por partes. Los archivos nunca referenciados se limpian tras un plazo.
3. "Enviar" crea el comando `EnviarLevantamiento` en el outbox local: agregado completo, lista de archivos con huellas, versión del protocolo y **llave de idempotencia** derivada del identificador del levantamiento.
4. El servidor procesa en **una transacción**: permisos, versión del protocolo, presencia y huella de todos los archivos, guardado del agregado, trazabilidad y evento en el outbox del servidor. Si falta un archivo, responde cuál y el cliente lo sube antes de reintentar.
5. **Idempotencia completa:** restricción única sobre la llave (impide dos procesamientos simultáneos) y resultado guardado para responder igual a los reintentos (ADR-0005).
6. **Reintentos con espera exponencial y aleatoria.** Un error permanente no se reintenta: se muestra al técnico y queda visible para oficina.

### Bajada

1. Consulta `pull` con **punto de control**: número de secuencia del servidor, no fecha. La secuencia debe ser **segura** frente a transacciones que confirman fuera de orden (ADR-0005).
2. El servidor calcula el alcance según permisos y devuelve cambios, **marcas de borrado** y datos que salieron del alcance.
3. La respuesta puede incluir una **orden de borrado local** si el usuario fue revocado.
4. Si el protocolo del cliente ya no se acepta, el servidor lo indica; el cliente **conserva sus datos** y pide actualizar (QA-21, ADR-0015).

## Por qué gana a cada alternativa

Los motores de sincronización resuelven replicación general de datos compartidos, un problema más grande que el de TEINS. Se pagaría su costo completo (otro servicio, requisitos sobre la base de datos, curva de aprendizaje) para usar una fracción de su capacidad.

- **Frente a A:** la escritura igual pasa por el backend propio, así que el comando idempotente habría que escribirlo de todas formas. Agrega un servicio que TEINS debe alojar y su cliente web corre sobre SQLite en WebAssembly.
- **Frente a B:** resuelve solo la bajada, que es la parte fácil. Requiere replicación lógica en Postgres y un proxy de autorización propio.
- **Frente a C:** replica colecciones de documentos, no entrega agregados con archivos verificados; habría que adaptar su protocolo.
- **Frente a D:** exige CouchDB en el servidor y sacrifica consultas relacionales y transacciones.
- **Frente a E:** dependencia total del proveedor (R6) y trazabilidad difícil de garantizar en el servidor.
- **Frente a F:** resuelven ediciones simultáneas del mismo dato, y el modelo de un editor por estado **elimina ese problema de raíz**.

## Consecuencias

- **A favor:** entrega atómica por diseño; sin servicios extra; protocolo pequeño y probable con fallas inducidas; cada garantía es explicable.
- **En contra:** casos borde propios (reintentos, puntos de control, marcas de borrado, migraciones). Mitigación: alcance reducido, prueba en iPhone y pruebas con fallas inducidas (ADR-0018).
- **Compatibilidad hacia adelante:** ElectricSQL o PowerSync pueden reemplazar solo la bajada si algún día se justifica; la subida por comandos sigue siendo válida.

## Cuándo revisarla

Aparece edición colaborativa; el volumen por dispositivo llega a miles de registros; se decide respaldar borradores en el servidor.
