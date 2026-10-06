# ADR-0040 · Conversaciones entre oficina y campo: el técnico responde los comentarios

- **Estado:** Aceptada
- **Fecha:** 2026-10-06
- **Impulsores:** regla 3 (un editor por estado), regla 4 (idempotencia), regla 5 (nunca borrar datos locales), regla 8 (trazabilidad), regla 9 (permisos en el servidor), QA-5 (ciclo de vida de los teléfonos), R5 (confidencialidad)
- **Depende de:** ADR-0003 (sincronización), ADR-0014 (API y notificaciones), ADR-0022 (cifrado local), ADR-0023 (avisos push), ADR-0035 (corregir el comentario propio). Amplía 0003, 0014 y 0023 sin reemplazarlos.

## Contexto

Hoy un comentario va en un solo sentido: oficina escribe y el técnico lo lee en su teléfono con la siguiente bajada (ADR-0014). Si el técnico quiere aclarar algo («la placa estaba tapada», «nadie me recibió»), tiene que llamar. Kevin pidió el 2026-10-04 «una especie de chat» para que el técnico responda desde el teléfono cuando tenga señal. Aprobó el prototipo `prototipos/hilos` (versión 4) el 2026-10-05 con diez decisiones (`plan-de-entrega.md`, «Iteración 39»).

Lo que hace difícil decidir:
- **El teléfono trabaja sin señal.** Lo que escribe el técnico tiene que guardarse, cifrado como todo lo local (ADR-0022), y salir solo, sin duplicarse al reintentar.
- **La revisión tiene un dueño** (regla 3). Una respuesta no cambia los datos del levantamiento, pero tiene que llegarle a quien revisa, y dejar de aceptarse cuando ya está revisado.
- **Los avisos no llevan datos del cliente** (ADR-0023, regla 3). La decisión 6 aprobada pide el sitio y el texto en el aviso.
- **La bajada es el único canal hacia el teléfono** (ADR-0003). La app 13 ya instalada no puede romperse con lo nuevo.

## Opciones

| Opción | Descripción |
|---|---|
| A. Respuestas como comentarios | El mensaje del técnico es una fila más de `levantamientos.comentarios`, con `en_respuesta_a` al comentario de oficina que abre la conversación y `de` (`oficina` o `tecnico`) |
| B. Tabla de mensajes aparte | Una tabla `conversaciones.mensajes` en un módulo nuevo, con su propio historial y su bajada |
| C. Respuestas dentro de la subida | El técnico responde editando el levantamiento enviado y reenviándolo con `EnviarLevantamiento` |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C |
|---|---|---|---|
| Reusa permisos, auditoría, aislamiento y bajada de los comentarios (regla 9, regla 8) | ● | ◐ | ◐ |
| El técnico no toca los datos después de enviar (regla 3) | ● | ● | ○ |
| Lo de la app 13 sigue igual (QA-21) | ● | ● | ○ |
| Cambia poco el modelo de dominio | ● | ◐ | ◐ |
| Deja espacio para fotos o conversaciones que abra el técnico | ◐ | ● | ○ |

## Decisión

**A. Las respuestas son comentarios con `en_respuesta_a`.** Un comentario de oficina abre una conversación; las respuestas de las dos partes cuelgan de él.

### Modelo

1. **Solo oficina abre conversaciones.** El técnico solo responde: `en_respuesta_a` siempre apunta a un comentario raíz de oficina (nunca a otra respuesta), que no esté retirado (ADR-0035).
2. **Se cierra al marcar revisado.** Después, las dos partes la siguen viendo, pero el servidor rechaza cualquier mensaje nuevo con `estado_invalido`. El teléfono lo traduce: «No se envió: oficina ya lo había marcado revisado. Si es importante, llama a oficina.», y el mensaje queda en el teléfono.
3. **Solo texto, hasta 1000 caracteres** por mensaje, en los dos lados. Los comentarios raíz nuevos y sus ediciones también bajan de 2000 a 1000; lo ya guardado no se toca.
4. **Lo del técnico no se corrige ni se borra.** Corregir y retirar (ADR-0035) siguen siendo solo de oficina y de su autor.

### Servidor (migración `0036`, solo aditiva)

1. En `levantamientos.comentarios`, columnas anulables `en_respuesta_a` (al comentario raíz), `de` (`oficina` o `tecnico`, por omisión `oficina`) y `llave` (única). El autor del técnico va en `autor_id`, como el de oficina. Sin UPDATE nuevo a nivel de tabla: `plataforma.test.ts` lo sigue comprobando.
2. Una tabla `levantamientos.lecturas`: organización, persona, levantamiento y `leido_hasta`, con su política de aislamiento por organización (RLS), sin DELETE, y UPDATE solo de `leido_hasta`.
3. **`responderComentario`** (técnico, `politicas.tecnico`): `POST /api/levantamientos/{id}/comentarios/{comentarioId}/respuestas` con `{ llave, texto }`.
   - **Idempotente (regla 4):** la `llave` es un uuid que crea el teléfono. Si ya existe, responde el mensaje guardado sin hacer nada más.
   - **Comprueba**, en este orden: que el levantamiento sea de ese técnico (si no, `no_encontrado`, como `terminarVisita`); que el comentario sea raíz de oficina y no esté retirado; que no esté revisado; y el límite de 1000.
   - **Registra** el evento de auditoría `comentario_respondido` (regla 8) y el cambio para la bajada del técnico.
4. **Oficina responde** con `comentarLevantamiento` más `enRespuestaA`, con las mismas reglas de cierre.
5. **`marcarConversacionLeida`** (oficina): `POST /api/levantamientos/{id}/lectura`. Pone `leido_hasta` en la hora del servidor y registra el cambio para la bajada del técnico, que así ve «Leído».
6. **Para quién es el punto de «sin leer»:** para quien revisa el levantamiento; si nadie lo ha tomado, para quien escribió el comentario raíz. Es la misma persona a la que va el aviso.
   - La bandeja y el detalle traen, por levantamiento, si hay una respuesta del técnico sin leer y la hora y el autor de la última.
   - El detalle trae además `leidoHasta` de la persona, para la línea «Nuevo».
7. **Bajada (amplía ADR-0003):** `ComentarioParaTecnico.respuestas` es un campo opcional. Cada mensaje lleva `id`, `texto`, `de`, `autor`, `creadoEn` y, si es del técnico, `leido` (si alguien de oficina lo leyó) y su `llave`. La app 13 descarta el campo al validar, así que no cambia.

### Avisos (amplía ADR-0023)

1. **Al técnico**, cuando oficina responde: «Oficina · Hotel Plaza Real» y el texto. Al tocarlo, abre el chat de ese levantamiento.
2. **A oficina**, cuando el técnico responde: «María Gómez respondió · Hotel Plaza Real · sobre ¿Quién te recibe?», solo a la persona del punto 6. Al tocarlo, abre la pestaña «Comentarios» en ese hilo.
3. **Excepción a la regla 3 del ADR-0023:** estos dos avisos llevan el sitio y el texto. Kevin lo eligió el 2026-10-06, sabiendo que se ven en la pantalla bloqueada. El contenido viaja cifrado de punta a punta (Web Push, RFC 8291): el servicio de avisos no lo lee. Los demás avisos siguen sin datos del cliente.
4. **Con la conversación abierta no hay aviso a la vista.** El service worker tiene que mostrar algo en cada push (`userVisibleOnly`). Si una ventana enfocada tiene abierta esa conversación, lo muestra en silencio, lo cierra al instante y le avisa a esa ventana para que consulte.

### Consulta (amplía ADR-0014)

Con la conversación abierta, cada lado consulta cada 15 s: oficina pide el levantamiento y el teléfono pide la bajada. No hay SSE por ahora; el ADR-0014 lo deja como la mejora natural.

### Campo (app 14)

1. **Dexie versión 7, solo aditiva** (regla 5):
   - `respuestasPendientes`, sellada con el cofre (ADR-0022, contexto `respuesta:<llave>`), con la llave, el levantamiento, el comentario raíz, el texto, la hora y los intentos.
   - `lecturasDeChat` (levantamiento y hasta cuándo leyó el técnico). No lleva contenido, así que no se sella.
2. **La cola sale sola** con la espera creciente de `terminacionPendiente` (`motor.ts`). Un rechazo por revisado no se reintenta: queda en el teléfono con su motivo, nunca se borra.
3. **`reiniciarPorEpoca` (ADR-0038) no toca** `respuestasPendientes` ni `lecturasDeChat`.
4. **Al borrar los datos de una persona** (ADR-0022, QA-5) se borran también sus pendientes y la clave que los abre.

## Por qué gana a cada alternativa

- **Frente a B:** una tabla aparte duplicaría lo que el comentario ya tiene resuelto: el aislamiento por organización, los permisos por columna, la auditoría, el retiro, la bajada y la pestaña de oficina. Ganaría espacio para conversaciones que abra el técnico o para fotos, pero las dos quedaron fuera por decisión (1 y 3); si llegan, se revisa esta decisión.
- **Frente a C:** reenviar el levantamiento haría al técnico editor después del envío (regla 3) y cambiaría el contrato de la subida que usa la app 13.

## Consecuencias

- **A favor:**
  - El técnico aclara desde el teléfono, sin llamar, y lo que dice queda en el historial con autor y hora.
  - Funciona sin señal y no se duplica.
  - La app 13 sigue funcionando sin cambios.
- **En contra:**
  - Los avisos de conversación muestran el sitio y el texto en la pantalla bloqueada. Se acepta por decisión de Kevin; se mitiga con no poner más que el sitio y el texto.
  - La consulta cada 15 s suma pedidos mientras alguien tiene la conversación abierta. Con 3 a 5 personas en oficina es poco; si crece, SSE (ADR-0014).
  - El punto de «sin leer» depende de quién revisa: si la revisión cambia de manos, el punto pasa a la persona nueva.

## Cuándo revisarla

- Oficina pide ver las respuestas al instante sin tener la conversación abierta (SSE).
- El técnico necesita abrir conversaciones o mandar fotos.
- TEINS pide que los avisos no muestren datos del cliente en la pantalla bloqueada.
