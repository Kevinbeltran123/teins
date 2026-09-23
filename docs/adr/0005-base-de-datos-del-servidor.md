# ADR-0005 · PostgreSQL: relacional donde el dominio es relacional, documental donde es documento

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-2, QA-4, QA-8, QA-10, QA-11, QA-13, QA-18, QA-19, QA-25, I-1, I-8, I-10, I-17, R6
- **Depende de:** ADR-0001, ADR-0003

## Contexto

El dominio tiene dos naturalezas a la vez:

- **Relacional:** organización → cliente → sitio → visita → levantamiento → informe → versión publicada, más usuarios, roles, permisos y accesos. Oficina necesita consultas cruzadas (por cliente, sitio, fecha, estado) e integridad referencial.
- **Documental:** el contenido de un levantamiento y la definición de un formato tienen estructura variable según el formato (ADR-0006).

Además, la base debe soportar: transacciones que abarcan varios módulos (publicar, recibir un envío), idempotencia con restricciones únicas, concurrencia optimista, una secuencia de cambios segura para la bajada (ADR-0003) y, idealmente, la cola de trabajos (ADR-0012) sin agregar otra pieza.

## Opciones

| Opción | Descripción |
|---|---|
| **A. PostgreSQL** | Relacional con tipo JSONB indexable, esquemas, seguridad por fila |
| B. MySQL / MariaDB | Relacional con tipo JSON |
| C. MongoDB | Documental con transacciones multi-documento |
| D. SQLite en servidor (con replicación de respaldo o libSQL) | Base embebida en el proceso |
| E. SQL Server | Relacional comercial |
| F. Base de un BaaS (Firestore, etc.) | Documental gestionada |

## Evaluación

| Criterio | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Integridad referencial y consultas cruzadas de oficina | ● | ● | ◐ | ● | ● | ○ |
| Documentos variables indexables (ADR-0006) | ● | ◐ | ● | ◐ | ● | ● |
| Transacciones ACID entre módulos (QA-2, QA-9) | ● | ● | ◐ | ● | ● | ◐ |
| Cambios de esquema dentro de transacciones (migraciones seguras) | ● | ○ | — | ● | ● | — |
| Seguridad por fila como segunda barrera (QA-4, QA-13) | ● | ○ | ◐ | ○ | ● | ◐ |
| Cola de trabajos en la misma base (ADR-0012) | ● | ● | ◐ | ◐ | ● | ○ |
| Esquemas por módulo en una base (ADR-0001) | ● | ◐ | ◐ | ○ | ● | ○ |
| Búsqueda de texto en español para oficina | ● | ◐ | ◐ | ◐ | ● | ○ |
| Varias instancias web sin rediseño (escalado) | ● | ● | ● | ○ | ● | ● |
| Portabilidad y oferta gestionada barata (R6, QA-19) | ● | ● | ◐ | ◐ | ○ | ○ |
| Conocimiento disponible en el mercado (QA-18) | ● | ● | ● | ◐ | ◐ | ◐ |
| Sin costo de licencia | ● | ● | ◐ | ● | ○ | ◐ |

## Decisión

**A. PostgreSQL**, usando cada capacidad solo donde un impulsor la pide:

| Capacidad | Uso en TEINS | Impulsor |
|---|---|---|
| Tablas relacionales con llaves foráneas | Organización, clientes, sitios, visitas, usuarios, informes, versiones, accesos, líneas de cantidad | Consultas de oficina, integridad |
| JSONB | Contenido del levantamiento y definición de formatos (ADR-0006) | QA-11 |
| Un esquema por módulo | `levantamientos`, `formatos`, `visitas`, `informes`, … | ADR-0001 |
| Restricciones únicas | Llaves de idempotencia | QA-2, I-8 |
| Columna de versión | Concurrencia optimista en revisión | QA-25, I-1 |
| Migraciones transaccionales | Un cambio de esquema fallido no deja la base a medias | QA-18 |
| Seguridad por fila | Segunda barrera de aislamiento por organización y cliente (se decide en ADR-0009) | QA-4, QA-13 |
| `FOR UPDATE SKIP LOCKED` | Cola de trabajos y entrega del outbox sin Redis ni broker (ADR-0012) | QA-19, R1 |
| Búsqueda de texto con configuración en español | Buscar levantamientos por cliente, sitio u observaciones | Uso de oficina |

### Patrones de corrección

**1. Idempotencia en una transacción.** Al recibir `EnviarLevantamiento`, la misma transacción inserta la llave en una tabla con restricción única, guarda el agregado y guarda el resultado. Si llega un duplicado mientras el primero sigue en curso, el índice único lo bloquea hasta que el primero confirme; entonces falla por duplicado y el servidor devuelve el resultado guardado. **El propio índice resuelve la colisión en vuelo** sin un estado intermedio "procesando".

Las llaves **no expiran**, a diferencia del plazo de 24 a 48 horas habitual. Aquí la llave es el identificador natural del levantamiento, no un valor aleatorio por solicitud, y un dispositivo desactualizado puede reenviar días después (QA-21). El costo de conservarlas es mínimo.

**2. Concurrencia optimista.** Toda actualización de oficina es `UPDATE … WHERE id = ? AND version = ?`. Si no afecta filas, otro guardó antes: se rechaza y se avisa (QA-25).

**3. Punto de control seguro para la bajada.** Una secuencia de Postgres **no garantiza orden de confirmación**. Si la transacción que obtuvo el número 10 confirma después de la que obtuvo el 11, un cliente que ya leyó hasta el 11 **se salta el 10 para siempre**. Es un error silencioso clásico en sincronización.

Mitigación elegida: los cambios sincronizables se registran en un **registro de cambios** cuya inserción se serializa con un bloqueo transaccional (*advisory lock*). Así el orden de la secuencia coincide con el orden de confirmación. Con menos de unas pocas escrituras por segundo (ver estimación en ADR-0001), serializar ese paso no tiene costo apreciable.

Alternativa registrada para cuando el volumen crezca: exponer solo cambios de transacciones anteriores al horizonte visible (`pg_current_snapshot()` / `xmin`), que no serializa escrituras pero es más complejo.

**4. Identificadores.** UUID generados en el dispositivo (ADR-0003), preferentemente v7: al estar ordenados por tiempo, las inserciones caen cerca en el índice (localidad de datos), a diferencia de los v4 aleatorios. Si el reloj del dispositivo está mal, solo se pierde localidad; la unicidad no se afecta.

## Por qué gana a cada alternativa

- **Frente a B (MySQL):** cubre lo relacional, pero los cambios de esquema confirman implícitamente (una migración fallida puede quedar a medias), no tiene seguridad por fila nativa y su indexación de JSON es más limitada. Es una buena base, pero pierde en tres criterios que importan aquí.
- **Frente a C (MongoDB):** el levantamiento encaja como documento, pero **el resto del dominio es relacional**: permisos por cliente, informes que referencian levantamientos, consultas cruzadas de oficina. Se ganaría flexibilidad que ADR-0006 ya da con JSONB, y se perdería integridad referencial.
- **Frente a D (SQLite en servidor):** es atractivo por costo y simplicidad, y su único escritor alcanzaría para la carga actual. Pero ata el sistema a una sola instancia (rompe la palanca de escalado de ADR-0001), no tiene seguridad por fila ni esquemas, y las ofertas gestionadas son de proveedores específicos.
- **Frente a E (SQL Server):** capacidades equivalentes con costo de licencia y menos oferta gestionada barata.
- **Frente a F:** descartado por ADR-0001 (lógica fuera de nuestro control, dependencia del proveedor).

## Consecuencias

- **A favor:** una sola base cubre datos relacionales, documentos, idempotencia, cola de trabajos y búsqueda; menos piezas que operar (R1, QA-19); disponible gestionada en cualquier nube o instalable por TEINS (R6).
- **En contra:** el contenido en JSONB exige validación en la aplicación (la estructura la garantiza ADR-0006, no la base); el registro de cambios serializado limita la tasa de escrituras sincronizables (con margen amplio para el volumen estimado).

## Cuándo revisarla

Las escrituras sincronizables superan decenas por segundo de forma sostenida (cambiar al horizonte de *snapshot*), o aparecen consultas analíticas pesadas (réplica de lectura o almacén analítico aparte).
