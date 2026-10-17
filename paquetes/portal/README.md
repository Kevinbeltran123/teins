# portal

Portal del cliente: acceso con QR y clave, consulta y descarga de los informes publicados. Trata de usted.

- **Dependencias:** `protocolo` y `ui`. Nunca importa `oficina` ni `campo`. Paquete mínimo: sin enrutador ni service worker.
- **ADR:** 0002, 0009.

## Cómo se usa

- `pnpm --filter @teins/portal dev` (puerto 5175), con `/api` reenviado al servidor.
- Los accesos se crean en oficina ("Administración › Accesos de clientes") o con `pnpm --filter @teins/servidor crear-acceso-cliente` (ver [`paquetes/servidor/README.md`](../servidor/README.md)).
- No tiene pruebas unitarias; lo cubre `e2e/pruebas/portal.spec.ts`.

## Qué contiene

- Dos pantallas según la sesión (`src/App.tsx`): el ingreso, con el código de acceso del QR (`?acceso=`) y la clave, y la lista de informes vigentes del cliente con su descarga en PDF. Estados vacío, cargando, error y sin conexión.
- La lista muestra el sitio, la visita y la versión; "Descargar" principal solo en el más reciente. El PDF baja como archivo (`Content-Disposition: attachment`): el cliente sigue en su lista.
- Si la sesión se cierra sin que la persona haya salido (30 minutos sin uso, o TEINS regeneró el acceso), el ingreso lo explica: el portal recuerda en la pestaña (`sessionStorage`, `src/sesion.ts`) que hubo una sesión abierta.
- "Salir" solo vuelve al ingreso si el servidor cerró la sesión; si no responde, lo dice y los informes quedan a la vista, porque la cookie solo la cierra el servidor.
- Una falla al dibujar muestra "Algo falló al mostrar el portal." con "Volver a cargar" (`CapturaDeErrores` en `src/main.tsx`), en vez de la pantalla en blanco.
