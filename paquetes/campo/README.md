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
- Iteración 12: cifrado local (ADR-0022). Una clave AES-GCM no extraíble por técnico (`datos/cofre.ts`); respuestas, fotos, bocetos, comandos, visitas y comentarios se guardan sellados y se abren al leer (`datos/registros.ts`, `datos/lecturas.ts`). Las escrituras sellan fuera de la transacción y guardan con comprobación optimista (`rev`), en fila por levantamiento. Lo de antes se sella en segundo plano al abrir la app y al iniciar sesión (`sellarEnSegundoPlano`). La orden de borrado destruye primero la clave. Base local versión 4.
- Iteración 11 (app 6): tabla de cantidades en la captura (`EditorCantidades`): texto libre, la cantidad se escribe "12,5" y se guarda como "12.5". Lo enviado se lee con `TablaCantidades`. El catálogo no baja al teléfono.
- Iteración 9 (app 4): secciones repetibles en la captura. "Agregar tablero", cada repetición con su nombre editable y "Quitar" con confirmación; el levantamiento nace con las que pide el formato. Solo los formatos con `appMinima` 4 las traen.
- Iteración 10 (app 5): bocetos. El campo muestra la miniatura y abre el editor (`pantallas/EditorBoceto.tsx`, cargado aparte): trazo libre con perfect-freehand, línea, texto, borrador, deshacer y rehacer, zoom con dos dedos y rechazo de la palma. Cada cambio se guarda como archivo por su huella (`guardarBoceto`); sube solo al enviar.
