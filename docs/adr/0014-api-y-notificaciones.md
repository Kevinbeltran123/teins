# ADR-0014 · HTTP con JSON orientado a tareas, contrato OpenAPI generado y notificaciones por consulta

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-8, QA-18, QA-19, QA-21, I-7, R6, R7
- **Depende de:** ADR-0003, ADR-0009, ADR-0010

## Contexto

Hay tres consumidores de la API: `campo` (sincronización con clientes posiblemente desactualizados), `oficina` (operación diaria) y `portal` (consulta mínima). A futuro podrían existir integraciones externas (facturación, otros sistemas de TEINS o de otras empresas si el producto se vende).

---

## Parte 1 · Estilo de la API

### Opciones

| Opción | Descripción |
|---|---|
| **A. HTTP + JSON orientado a tareas, con contrato OpenAPI** | Recursos para lectura; operaciones de negocio explícitas para cambios de estado |
| B. REST CRUD puro | `PUT` y `PATCH` genéricos sobre recursos |
| C. tRPC | Procedimientos TypeScript con tipos compartidos, sin contrato neutral |
| D. GraphQL | Un endpoint; el cliente define la forma de la respuesta |
| E. gRPC / gRPC-web | Contrato binario con Protobuf |

### Evaluación

| Criterio | A | B | C | D | E |
|---|---|---|---|---|---|
| Expresa la intención del negocio, que alimenta la auditoría (QA-8) | ● | ○ | ● | ◐ | ● |
| Contrato versionable y estable para clientes desactualizados (QA-21) | ● | ● | ◐ | ◐ | ● |
| Contrato neutral para integraciones futuras (R7) | ● | ● | ○ | ● | ◐ |
| Tipos compartidos de extremo a extremo | ● | ● | ● | ◐ | ◐ |
| Simplicidad: caché HTTP, depuración, herramientas | ● | ● | ● | ○ | ○ |

### Decisión

**A.** Tres reglas:

1. **Lecturas como recursos:** `GET /visitas`, `GET /levantamientos/{id}`.
2. **Cambios de estado como tareas explícitas, nunca como `PATCH` genérico:** `POST /levantamientos/{id}/tomar`, `POST /levantamientos/{id}/marcar-revisado`, `POST /informes/{id}/publicar`, `POST /accesos-cliente/{id}/regenerar`. Cada tarea corresponde a una acción del modelo, a una política de autorización (ADR-0009) y a un evento de auditoría con intención (ADR-0008).
3. **Sincronización como protocolo aparte y versionado:** `POST /sync/comandos` y `GET /sync/cambios?desde=`, con la versión del protocolo en una cabecera (ADR-0003, ADR-0015).

**Contrato:** los esquemas Zod del paquete `protocolo` generan la especificación OpenAPI. El código es la fuente y la documentación no se desactualiza (I-7).

**Errores:** formato estándar *Problem Details* (RFC 9457), con códigos propios del dominio (`archivo_faltante`, `version_protocolo_no_soportada`, `conflicto_de_version`).

**Paginación:** por cursor, no por número de página, para listados estables mientras llegan datos nuevos.

### Por qué gana a cada alternativa

- **Frente a B:** un `PATCH` genérico no dice si alguien "corrigió una medida" o "marcó como revisado": la auditoría perdería intención y la autorización tendría que adivinar qué campos cambian.
- **Frente a C:** su experiencia de desarrollo es excelente, pero acopla cliente y servidor a TypeScript y no produce un contrato neutral para integraciones (R7). El protocolo de sincronización debe mantenerse estable entre versiones de la app, y un contrato explícito versionado lo expresa mejor.
- **Frente a D:** su flexibilidad de consultas no es un impulsor; complica la autorización por campo, la caché y el límite de tasas.
- **Frente a E:** su ventaja está en la comunicación entre servidores, y aquí hay uno solo.

---

## Parte 2 · Notificaciones

| Necesidad | Frescura requerida | Opciones consideradas | Decisión |
|---|---|---|---|
| Oficina ve levantamientos recién enviados | Minutos | Consulta periódica, SSE, WebSockets | **Consulta periódica ligera** a `GET /novedades` y al volver a enfocar la pestaña |
| Técnico recibe comentarios y visitas nuevas | Al sincronizar | Push web, consulta | **Llegan con la bajada** de ADR-0003 |
| Cliente sabe que hay informe nuevo | Horas | Correo, push | **Fuera de la primera versión**; el portal muestra lo vigente |

**Por qué no WebSockets ni SSE ahora:** con 3 a 5 personas en oficina y frescura de minutos, una consulta periódica a un endpoint mínimo cuesta casi nada y no requiere conexiones persistentes. Las conexiones persistentes complican el escalado horizontal (ADR-0001) y el despliegue. **SSE es la mejora natural** si oficina necesita inmediatez: es HTTP estándar y funciona detrás de los mismos balanceadores.

**Push web a técnicos:** el permiso de notificaciones ya se pide para el almacenamiento persistente en Safari (ADR-0002). Es una mejora posterior al piloto, útil para avisar asignaciones nuevas.

## Consecuencias

- **A favor:** la API habla el lenguaje del negocio; cada tarea tiene política y auditoría; el contrato se genera desde el código; notificaciones sin infraestructura adicional.
- **En contra:** más endpoints que un CRUD genérico (cada tarea es explícita); la consulta periódica tiene retraso de segundos a minutos, aceptable para el uso actual.

## Cuándo revisarla

Oficina necesita ver envíos al instante (SSE); aparece una integración externa que requiere eventos (webhooks firmados desde un trabajo de ADR-0012); los clientes piden aviso de informes nuevos (correo transaccional).
