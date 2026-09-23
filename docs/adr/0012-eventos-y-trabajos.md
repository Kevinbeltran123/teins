# ADR-0012 · Cola de trabajos transaccional en PostgreSQL como outbox (Graphile Worker)

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-9, QA-12, QA-17, QA-19, QA-24, I-10, I-11, R1, R6
- **Depende de:** ADR-0001, ADR-0005, ADR-0010

## Contexto

Varias reacciones deben ocurrir **después** de un cambio de negocio y **sin perderse** si el proceso cae:

| Evento | Reacción asíncrona |
|---|---|
| InformePublicado | Generar el PDF (ADR-0013) y habilitarlo en el portal |
| Archivo subido | Verificar firma y huella; generar miniaturas (ADR-0007) |
| LevantamientoEnviado | Actualizar métricas del piloto (QA-24) |
| Tareas periódicas | Limpiar archivos huérfanos, verificar cadenas de auditoría (ADR-0008), comprobar copias de seguridad |

El error clásico es la **escritura dual**: guardar en la base y luego encolar en otro sistema. Si el proceso cae entre ambas, hay un informe publicado sin PDF y nadie se entera.

## Opciones

| Opción | Descripción |
|---|---|
| A. Tareas en memoria | Ejecutar en segundo plano dentro del proceso web |
| B. Tabla outbox propia + reenviador + cola aparte | Patrón clásico: evento en la misma transacción, luego un proceso lo publica en la cola |
| C. Redis + BullMQ | Cola rápida en memoria persistida |
| D. Cola gestionada de la nube (SQS, Pub/Sub…) | Servicio del proveedor |
| E. Kafka o RabbitMQ | Broker de mensajes dedicado |
| **F. Cola en PostgreSQL con encolado transaccional (Graphile Worker)** | Los trabajos son filas en la misma base; se encolan **dentro de la transacción del negocio** |
| G. pg-boss | Otra cola sobre PostgreSQL |

## Evaluación

| Criterio | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| Sin escritura dual (I-10) | ○ | ● | ○ | ○ | ○ | ● | ● |
| Sobrevive caídas del proceso | ○ | ● | ● | ● | ● | ● | ● |
| Sin infraestructura adicional (R1, QA-19) | ● | ◐ | ○ | ◐ | ○ | ● | ● |
| Portabilidad (R6) | ● | ● | ● | ○ | ● | ● | ● |
| Reintentos, programación periódica y deduplicación listos | ○ | ○ | ● | ◐ | ◐ | ● | ● |
| Baja latencia sin sondeo constante | ● | ◐ | ● | ◐ | ● | ● | ◐ |

## Decisión

**F. Graphile Worker**, con licencia MIT, sobre la misma base PostgreSQL.

**La idea central: la cola es el outbox.** Como los trabajos son filas en la misma base, encolar dentro de la transacción del negocio ya es un outbox transaccional. Si la transacción confirma, el trabajo existe; si se revierte, el trabajo tampoco existe. No hace falta una tabla outbox más un reenviador más una cola: es una sola pieza.

Graphile Worker usa `SKIP LOCKED` para tomar trabajos sin bloquearse entre *workers* y `LISTEN/NOTIFY` para enterarse de trabajos nuevos sin sondear. Trae reintentos con espera exponencial, programación tipo crontab y deduplicación con `job_key`.

### Reglas

1. **Eventos de dominio en dos niveles:**
   - **Síncronos, dentro de la transacción:** reacciones que deben ser atómicas con el cambio (registro de auditoría).
   - **Asíncronos:** el manejador del evento **solo encola** un trabajo en la misma transacción. El trabajo real ocurre en el rol *worker* (ADR-0001).
2. **Entrega al menos una vez, así que todo trabajo es idempotente.** Ejemplo: "generar PDF de la versión 3" verifica primero si ya existe. Además, `job_key` evita duplicados en cola.
3. **Colas con nombre para acotar recursos.** La cola `pdf` procesa de a un trabajo (la cola nombrada ejecuta en serie), lo que limita la memoria que usa el navegador sin interfaz. Verificación de archivos y miniaturas van en una cola paralela.
4. **Fallos permanentes visibles.** Un trabajo que agota sus reintentos queda registrado y dispara una alerta (ADR-0017). Nunca falla en silencio.
5. **Tareas periódicas** en la misma herramienta: limpieza de huérfanos, verificación de cadenas y comprobación de copias.
6. **Aislamiento del proveedor:** los módulos encolan a través de un puerto propio (`encolar(trabajo, datos, opciones)`), no llaman a la biblioteca directamente.

## Por qué gana a cada alternativa

- **Frente a A:** un reinicio pierde el trabajo; es exactamente el fallo que se quiere evitar.
- **Frente a B:** correcto, pero son tres piezas (tabla, reenviador y cola) donde F usa una.
- **Frente a C:** Redis es otro servicio que TEINS debe operar, y encolar allí después de confirmar en Postgres reintroduce la escritura dual.
- **Frente a D:** dependencia del proveedor (R6) y escritura dual.
- **Frente a E:** diseñados para volúmenes y equipos que TEINS no tiene. La estimación de ADR-0001 son decenas de trabajos al día.
- **Frente a G (pg-boss):** cumple lo mismo; Graphile Worker se prefiere por su latencia con `LISTEN/NOTIFY`, su diseño pensado para encolar desde SQL y transacciones, y por estar escrito en TypeScript. Queda como alternativa inmediata detrás del puerto.

## Consecuencias

- **A favor:** atomicidad entre cambio y reacción sin piezas extra; mismos respaldos y monitoreo que la base; escalar es agregar *workers*; es el mismo principio que el registro de publicación de eventos de Spring Modulith, aplicado en TypeScript (ADR-0010).
- **En contra:** la cola comparte recursos con la base (irrelevante al volumen estimado). La biblioteca aún usa numeración 0.x y sus versiones menores pueden requerir ajustes; se mitiga fijando versiones y aislándola detrás del puerto.

## Cuándo revisarla

El volumen de trabajos llega a miles por minuto de forma sostenida, o se necesita integrar sistemas externos que consumen eventos (publicarlos desde un trabajo hacia un broker o webhooks).
