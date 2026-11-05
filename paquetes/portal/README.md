# portal

Portal del cliente (ADR-0053): cada contacto con acceso entra con su correo y un código que le llega, y ve y descarga lo que recibe, informes y cotizaciones vigentes. Trata de usted.

- **Dependencias:** `protocolo` y `ui`. Nunca importa `oficina` ni `campo`. Paquete mínimo: sin enrutador ni service worker.
- **ADR:** 0002, 0009 (partes 1 a 3), 0053.

## Cómo se usa

- `pnpm --filter @teins/portal dev` (puerto 5175), con `/api` reenviado al servidor.
- El acceso lo da oficina en cada contacto del cliente (columna «Portal»), a quien tenga correo. En local, el correo sale simulado: el código se lee con `pnpm --filter @teins/servidor ultimo-correo --para <correo>`.
- No tiene pruebas unitarias; lo cubre `e2e/pruebas/portal.spec.ts`.

## Qué contiene

- Dos pantallas según la sesión (`src/App.tsx`): el ingreso y los documentos.
- **Ingreso** (`src/pantallas/Ingreso.tsx`), en dos pasos en la misma tarjeta: el correo y «Enviar código»; después «Revise su correo», el código de 6 dígitos (teclado numérico, `one-time-code`), «Entrar», «Reenviar código» a los 60 s y «Usar otro correo». El pedido se recuerda en la pestaña (`src/sesion.ts`): si el teléfono recarga el portal al volver del correo, sigue en el segundo paso mientras el código no venza.
- **Documentos** (`src/pantallas/Documentos.tsx`): el cliente como título; las pestañas Informes y Cotizaciones, solo las que el contacto ve (sin pestañas si ve una); por documento, el sitio, la visita y la versión, y «Descargar», principal en el más reciente. El PDF baja como archivo: el contacto sigue en su lista. Estados vacío, cargando, error y sin conexión.
- **Enlaces de los correos** (`src/destino.ts`): `/informes/<id>` y `/cotizaciones/<id>` no llevan secretos; sin sesión piden entrar y después muestran ese documento resaltado, con su «Descargar» como acción principal.
- **Tema** claro, oscuro o del sistema, con el selector del encabezado (`SelectorDeTema` de `ui`), que se recuerda en el equipo, como en campo y oficina.
- Si la sesión se cierra sin que la persona haya salido (30 minutos sin uso, o le quitaron el acceso), el ingreso lo explica.
- "Salir" solo vuelve al ingreso si el servidor cerró la sesión; si no responde, lo dice y los documentos quedan a la vista, porque la cookie solo la cierra el servidor.
- Una falla al dibujar muestra "Algo falló al mostrar el portal." con "Volver a cargar" (`CapturaDeErrores` en `src/main.tsx`), en vez de la pantalla en blanco.
