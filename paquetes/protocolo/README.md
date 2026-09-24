# protocolo

Esquemas Zod de comandos y respuestas de sincronización, con su versión. Genera la especificación OpenAPI.

**Dependencias:** Solo depende de `dominio`.

**ADR relevantes:** 0003, 0014, 0015

- `operaciones.ts`: catálogo tipado de operaciones HTTP. El servidor registra un manejador por operación y los clientes llaman por operación.
- `problemas.ts`: códigos de error (Problem Details) y si cada uno se puede reintentar.
- `cliente.ts`: cliente para las superficies; valida también las respuestas.
- Entradas livianas: `@teins/protocolo/llaves` (sin Zod, para campo) y `@teins/protocolo/openapi` (solo el servidor).
