# portal

Portal del cliente: acceso con QR y clave, consulta y descarga de informes publicados.

**Dependencias:** Depende de `protocolo` y `ui`. Nunca importa `oficina` ni `campo`. Paquete mínimo.

**ADR relevantes:** 0002, 0009

Corte 5: ingreso con el código de acceso del QR (`?acceso=`) y la clave; lista de informes vigentes del cliente con su descarga en PDF; salir. Estados vacío, cargando, error y sin conexión. Sin enrutador ni service worker: dos pantallas según la sesión (`src/App.tsx`). En desarrollo, `pnpm --filter @teins/portal dev` en el puerto 5175, con `/api` reenviado al servidor.

Los accesos se crean con `pnpm --filter @teins/servidor crear-acceso-cliente` (ver `paquetes/servidor/README.md`).

Si la sesión se cierra sin que la persona haya salido (30 minutos sin uso, o TEINS regeneró el acceso), el ingreso lo explica: el portal recuerda en la pestaña (`sessionStorage`, `src/sesion.ts`) que hubo una sesión abierta.
