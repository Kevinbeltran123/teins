# campo

PWA de campo: captura sin conexión, outbox, sincronización, editor de bocetos.

**Dependencias:** Depende de `dominio`, `protocolo` y `ui`. Sin Motion; movimiento solo en CSS.

**ADR relevantes:** 0002, 0003, 0004, 0015, 0019

- `datos/`: base local versionada (Dexie) detrás de un puerto; cada versión se prueba migrando datos de la anterior.
- `sincronizacion/`: motor del outbox y arnés de fallas (`pruebas/servidor-falso.ts`). El código de red se carga aparte del primer dibujo.
- Presupuesto de JavaScript inicial: `pnpm presupuesto` desde la raíz (ADR-0011).
- En desarrollo, `/api` se reenvía al servidor en `localhost:3000`; para abrirla desde un celular en la red local, agregue ese origen a `ORIGENES_CONFIABLES` del servidor.
