# campo

PWA de campo: captura sin conexión, outbox, sincronización, editor de bocetos.

**Dependencias:** Depende de `dominio`, `protocolo` y `ui`. Sin Motion; movimiento solo en CSS.

**ADR relevantes:** 0002, 0003, 0004, 0009, 0015, 0017, 0019

- `datos/`: base local versionada (Dexie) detrás de un puerto; cada versión se prueba migrando datos de la anterior. La versión 3 (corte 2) agrega formatos, visitas, estado según el servidor y el avance de la bajada, y conserva los formatos que la app traía para los borradores viejos.
- `sincronizacion/`: motor del outbox, la bajada y las órdenes de borrado, con su arnés de fallas (`pruebas/servidor-falso.ts`). El código de red se carga aparte del primer dibujo.
  - Bajada al abrir, al recuperar señal, al volver a la app y después de un envío recibido; si no, cada 5 minutos. Cada bajada lleva el informe de salud del teléfono y renueva el permiso de trabajo sin conexión.
  - Si el servidor rechaza la sesión, el teléfono pregunta con su secreto si hay orden de borrado: si la hay, borra solo los datos de ese usuario y lo confirma; si no, pide iniciar sesión.
- Desde la versión 3 (corte 3), la bajada trae el estado de revisión y los comentarios de oficina: se ven en la lista y en el levantamiento enviado.
- `version.ts`: versión de la app. Súbala cuando la app aprenda un tipo de campo nuevo; los formatos que lo usen declaran `appMinima`.
- Pantallas: "Mis visitas" (la siguiente visita es el punto focal; el orden está en `visitas.ts`), captura y, con el permiso vencido, borradores de solo lectura.
- Iteración 7: una visita que sale del teléfono con algo empezado guarda por qué (`motivoSalida`): "Oficina canceló esta visita" o "se asignó a otra persona", también en el bloque azul de la siguiente visita. Lo empezado se puede terminar y enviar; no se pueden iniciar levantamientos nuevos en ella.
- Presupuesto de JavaScript inicial: `pnpm presupuesto` desde la raíz (ADR-0011).
- En desarrollo, `/api` se reenvía al servidor en `localhost:3000`; para abrirla desde un celular en la red local, agregue ese origen a `ORIGENES_CONFIABLES` del servidor.
