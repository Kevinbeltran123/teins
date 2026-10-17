[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 37 · Buscar en todo y revisar con el teclado](37-buscar-en-todo.md) · Siguiente: [Iteración 40 · Lo atendido no es la siguiente visita](40-lo-atendido-no-es-la-siguiente-visita.md)

# Iteraciones 38 y 39 · La revisión al lado y las conversaciones con campo

**Estado en el mapa al 2026-10-16:**

- Iteración 38: Desplegada en el entorno de pruebas (2026-10-06); falta que Kevin la pruebe
- Iteración 39: Desplegada en el entorno de pruebas con la migración `0036` y la app 14 (2026-10-06); falta que Kevin la pruebe en su iPhone

**Estado:** las dos aprobadas por Kevin. La 38 quedó construida, verificada y desplegada en el entorno de pruebas el 2026-10-06 (falta que Kevin la pruebe); la 39, construida, verificada y desplegada en el entorno de pruebas el 2026-10-06 (ADR-0040, migración `0036`, app de campo 14, Dexie 7; `campo` primero, después `worker` y `oficina`). La 39 usa el panel de la 38.

## Iteración 38 · La revisión armada como el informe

Prototipo aprobado ("Me gusta", 2026-10-04): `prototipos/revision-al-lado/prototipo.html` (https://claude.ai/artifact/72t1ukfkYFAvcoT6uBNjaW). Hay que igualarlo. Solo `oficina/src/pantallas/Detalle.tsx` y `pantallas/Lienzo.tsx`; sin servidor ni migración.

- **Distribución:** los datos a la izquierda. A la derecha va un panel a todo el alto con las pestañas «En el informe», «Comentarios» e «Historial».
  - Se arma con `EditorConVista`, `useVistaPrevia` y `BotonMostrarVista` de `Lienzo.tsx`, así que trae divisor, «Ampliar» (solo la hoja, a tamaño real) y «Ocultar».
  - `useVistaPrevia(nombre)` recibe un nombre (`"revision"`). Así el ancho y el «oculto» de la revisión se recuerdan aparte de los del informe.
  - También se recuerda la pestaña. La primera vez abre en «En el informe».
- **El estado va en la barra superior, junto a la acción**, como «Guardado»:
  - «● En revisión · la tomó usted» con «Marcar revisado»;
  - «● Revisado · por usted, 8:41 p. m.» con «Abrir el informe».
  - Salen la frase «Corrija lo que haga falta…» y las tarjetas `grupo-c` con borde.
- **El capítulo** (`CapituloEnVivo`) toma el ancho del panel, no la caja de 520 px. El diálogo «Ver en grande» desaparece porque «Ampliar» lo reemplaza. La nota «Lo azul es lo corregido y no sale en el PDF» va sobre la hoja. Comentarios e historial son listas dentro del panel hundido, sin tarjetas.
- **«Siguiente»** (revisar en serie) va encima de los datos cuando el levantamiento ya está revisado.
- **Por debajo de 1280 px**, un botón en la barra abre el panel en hoja lateral, como la vista previa del informe.
- **Siguen funcionando** los atajos T, R, S y Esc, y `CorreccionEnCurso` (el resaltado en vivo mientras se corrige).
- **Verificación:**
  - `revision.spec.ts` y `usabilidad.spec.ts` en Chromium y WebKit;
  - capturas comparadas con el prototipo;
  - `pnpm typecheck`, `pnpm arquitectura` y `pnpm test`;
  - despliegue de `oficina` en el entorno de pruebas.
- **Al terminarla**, se hace commit junto con `prototipos/revision-al-lado/` y la línea de `prototipos/README.md`, que siguen sin commit.

**Decisiones tomadas al construirla (2026-10-06)**
- El panel es un `Lienzo` con la propiedad `panel` (etiqueta, «Ampliar» solo en «En el informe», otra cabecera al ampliar y «Volver a la revisión»), dentro del mismo `EditorConVista` del informe; no se hizo un componente aparte.
- La pestaña se guarda en una preferencia nueva (`revision-pestana`) para que la primera vez abra en «En el informe»; la del carril anterior abría en «Comentarios».
- «Revisado · por usted, 8:41 p. m.»: la hora sale del último evento `levantamiento_revisado` del historial; el servidor no la entrega aparte. Si no fue hoy, lleva el día.
- La acción de revisado dice «Abrir el informe» (antes «Abrir el informe de la visita»), como el prototipo.
- Salen el aviso «N datos corregidos» y el chulo animado del carril: el prototipo no los tiene y la barra de secciones ya marca lo corregido.
- Con la hoja ampliada, ninguna tecla suelta actúa (Esc solo la reduce): `atajos.ts` cuenta un `role="dialog"` modal como diálogo abierto.
- Comentarios e historial conservan sus listas de hoy dentro del panel, sin tarjetas; la 39 rehace los comentarios como hilos.

**Evidencia:** `revision.spec.ts` y `usabilidad.spec.ts` en Chromium y WebKit (14 pasan); capturas a 1440 px en claro y oscuro (en el informe, comentarios, historial, ampliado, oculto, revisado con «Siguiente») y a 1100 px con la hoja lateral, comparadas con el prototipo; `pnpm typecheck`, `pnpm arquitectura` y `pnpm test`.

## Iteración 39 · Conversaciones entre oficina y campo

Pedido de Kevin el 2026-10-04: «una especie de chat» para que el técnico responda los comentarios de oficina desde el teléfono cuando tenga señal. El prototipo se aprobó en su versión 4, el 2026-10-05 («Si, aprobado»): `prototipos/hilos/prototipo.html` (https://claude.ai/artifact/BnYMDTcuo8gBST3dtSwBoi). Hay que igualarlo; sus casos «Oficina · revisión», «Oficina · bandeja», «Campo» y «Los dos a la vez» son la referencia visual.

**Decisiones aprobadas**

1. Solo oficina abre conversaciones: cada comentario de oficina es el comienzo de una. El técnico responde, y oficina puede seguir respondiendo en la misma.
2. La conversación se cierra al marcar revisado: las dos partes la siguen viendo, pero ya no se responde.
3. Solo texto, por ahora.
4. **El punto de «sin leer».** Se apaga al abrir la conversación.
   - En oficina: en la fila de la bandeja (con «María Gómez respondió · hora» debajo del cliente), en la pestaña «Comentarios» (o en el botón que muestra el panel, si está oculto) y la línea «Nuevo» dentro del hilo.
   - En campo: en la fila de «Enviados» («Oficina te escribió»), el número de sin leer en la fila del chat y la franja «N mensajes sin leer» dentro del chat.
5. **Para quién es el punto en oficina:** para quien revisa el levantamiento; si nadie lo ha tomado, para quien escribió el comentario (la misma regla de `envio_fallido`). Lo leído se guarda en el servidor por persona; en campo, en el teléfono.
6. **Avisos push en los dos sentidos:** al técnico, «Oficina · Hotel Plaza Real» con el texto; a oficina, «María Gómez respondió». Con la conversación abierta no hay aviso: cada lado consulta cada 15 s. No hay SSE por ahora; el ADR-0014 lo permite después.
7. **Lo que envía el técnico:**
   - se manda solo cuando hay señal;
   - no se corrige ni se borra;
   - si llega cuando ya está revisado, el servidor lo rechaza y el teléfono dice «No se envió: oficina ya lo había marcado revisado. Si es importante, llama a oficina.», y el mensaje queda en el teléfono.
8. Hasta 1000 caracteres por mensaje, en los dos lados.
9. **En campo, un solo chat con oficina por levantamiento**, como WhatsApp. En oficina, un hilo por dato.
10. **El técnico ve «Leído»** bajo su último mensaje cuando oficina lo leyó; si no, «Enviado».

**Cómo se ve en campo** (`campo/src/pantallas/Captura.tsx`, la vista de un levantamiento enviado; referencias: iMessage/Luma, WhatsApp, LinkedIn, corner)
- **«Enviados»** (`Inicio.tsx`, `Fila`):
  - con algo sin leer, una tercera línea «Oficina te escribió» en el color de la marca y un punto azul junto a la hora;
  - con mensajes en cola, «N respuestas por enviar», con reloj y en color de alerta.
- **El levantamiento enviado:** «Comentarios de oficina» pasa a ser una fila de chat con un icono de edificio, «Oficina», el último mensaje («Tú: …» si es propio), la hora (en azul si hay sin leer) y una insignia con el número. Al tocarla se abre el chat. Sin señal y con mensajes en cola, un aviso: «Sin señal · Tu mensaje está guardado en el teléfono y se envía solo cuando vuelva».
- **El chat** es una pantalla completa:
  - **Encabezado:** «‹» a la izquierda y, centrados, «Oficina» y «Hotel Plaza Real · Torre A». Sin señal, en lugar del sitio dice «Esperando señal…» en color de alerta.
  - **Primera línea**, centrada y gris: «Oficina revisa lo que enviaste y te pregunta aquí. Toca un mensaje para responderlo.»
  - **La hora va centrada entre grupos** («Hoy 8:26 p. m.»): solo al principio y cuando pasan 10 minutos o más. Nunca va una hora ni un nombre en cada mensaje.
  - **Franja «N mensajes sin leer»** en el color de la marca, con líneas a los lados.
  - **Globos:**
    - oficina a la izquierda (`--t-superficie-pista`); el técnico a la derecha (color de la marca);
    - los seguidos del mismo lado van pegados (2 px y esquinas de 6 px del lado que se unen);
    - en cola, el globo va más claro; rechazado, con borde de peligro.
  - **De qué se habla:** el primer mensaje de oficina sobre un dato lleva adentro un recuadro con borde de la marca a la izquierda: «Tu respuesta · Llegada» / **«¿Quién te recibe?»** / lo que respondió («No la respondiste», en cursiva, si está vacío; «12 kVA»). Al tocar el recuadro se abre ese dato en «Ver lo que enviaste»; al tocar el globo, se elige esa pregunta para responder. Nunca pin ni tarjeta suelta: Kevin vio que se leía como una ubicación.
  - **Cita:** cuando un mensaje del técnico cambia de tema respecto al anterior, lleva una cita de la pregunta de oficina («Oficina» y el texto en una línea), como en WhatsApp.
  - **Estado solo bajo el último mensaje propio:** «Enviado», «Leído», «Enviando…», «Se envía cuando haya señal» (con reloj, en alerta) o el texto del rechazo.
  - **Para escribir:**
    - siempre visible, «Respondiendo a Oficina» con la pregunta en una línea; por omisión, la última pregunta de oficina, y cambia (con un destello) al tocar otro mensaje;
    - debajo, un campo redondeado «Mensaje» con el botón de enviar redondo adentro (gris si está vacío);
    - revisado: la barra cambia por «🔒 La conversación quedó cerrada / Oficina marcó revisado el levantamiento».
- **Aviso push:** «TEINS · Oficina · Hotel Plaza Real» y el texto; al tocarlo abre el chat.

**Cómo se ve en oficina** (referencias: un hilo de Slack, Reddit, Dropbox Dash)
- **Pestaña «Comentarios»** del panel de la 38:
  - arriba, «Lo que escriba aquí le llega a María Gómez en su teléfono.» (revisado: «Cerradas al marcar revisado.»);
  - una conversación por dato, separadas por una línea fina y sin recuadros.
- **Cada conversación:**
  - empieza con el dato tal como quedó: un recuadro con «Llegada» en pequeño, y «¿Quién te recibe?» con «Sin dato» (o «Potencia nominal» con «12 kVA») a la derecha; al tocarlo, se va a esa fila de los datos y la resalta;
  - debajo, como en Slack: avatar de 26 px (OP neutro, MG en el color de la marca), nombre y hora **una vez por grupo** y el texto plano, **sin globos**;
  - entre el comentario y las respuestas, el separador «N respuestas»; antes de lo nuevo, la línea «Nuevo» en el color de la marca;
  - al final, un campo compacto «Responder…» con un botón de flecha adentro (activo solo con texto); ↵ envía y ⇧↵ hace otra línea; revisado: «🔒 Cerrada al marcar revisado. María Gómez la sigue viendo.»
- **Bajo cada dato comentado**, a la izquierda: el comentario, la última respuesta («María Gómez: …», con el punto si no está leída) y «N respuestas · Ver la conversación», que abre la pestaña en ese hilo.
- **El punto:** en la pestaña «Comentarios» o en el botón que muestra el panel.
- **La bandeja:** punto azul antes del cliente y «María Gómez respondió · 8:44 p. m.» en el color de la marca, debajo.
- **«Historial»:** «María Gómez respondió sobre ¿Quién te recibe?» (evento `comentario_respondido`).
- **El diálogo «Marcar revisado»** añade: «Las conversaciones se cierran: María Gómez las sigue viendo en su teléfono, pero ya no responde.»
- **Aviso del navegador:** «María Gómez respondió · Hotel Plaza Real · sobre ¿Quién te recibe?»; al tocarlo abre la pestaña en ese hilo.

**Cómo se construye** (contrato primero, `docs/proceso/forma-de-trabajo.md`)
1. **ADR-0040** (plantilla `docs/adr/0000-plantilla.md`):
   - amplía el ADR-0003 (la subida lleva respuestas), el 0014 (consulta cada 15 s con la conversación abierta) y el 0023 (avisos a oficina);
   - en el modelo de dominio (`02-modelo-dominio.md`), Comentario pasa a «lo abre oficina; el técnico responde»;
   - nunca se editan los ADR anteriores; se agrega la fila al índice `docs/adr/README.md`.
2. **Servidor y protocolo**, con las pruebas escritas antes:
   - **Migración `0036`, solo aditiva:**
     - en `levantamientos.comentarios`, las columnas anulables `en_respuesta_a` (al comentario raíz), `de` (`oficina` o `tecnico`, por omisión `oficina`) y el autor del técnico;
     - una tabla de lo leído por persona: usuario, levantamiento y hasta cuándo;
     - permisos por columna como hoy, porque `plataforma.test.ts` comprueba que no hay UPDATE a nivel de tabla.
   - **Operación del técnico `responderComentario`**, como `terminarVisita`:
     - lleva un uuid del cliente como llave de idempotencia (regla 4) y `politicas.tecnico`;
     - comprueba el `tecnicoId` del levantamiento, que el comentario raíz no esté retirado, que no esté revisado (si lo está, responde un error que el teléfono traduce) y el límite de 1000;
     - registra el evento de auditoría `comentario_respondido`;
     - manda el aviso a quien revisa o, si nadie lo ha tomado, a quien escribió el comentario.
   - **Oficina responde en el hilo** con la operación de comentar de hoy más `en_respuesta_a`. Nueva operación `marcarConversacionLeida`.
   - **La consulta de la bandeja y del detalle** trae, por levantamiento, si hay respuesta sin leer y la hora de la última.
   - **Bajada:** las respuestas van anidadas en `ComentarioParaTecnico.respuestas`, como campo opcional, para que la app 13 las ignore. Cada mensaje del técnico lleva si oficina ya lo leyó, para mostrar «Leído».
3. **Campo**, app 14:
   - Dexie versión 7 con la tabla `respuestasPendientes`, sellada (ADR-0022); nunca se borra nada local (regla 5);
   - reintentos con espera creciente, como `terminacionPendiente`; tiene que sobrevivir a `reiniciarPorEpoca`;
   - lo leído por el técnico se guarda en el teléfono;
   - con el chat abierto, consulta cada 15 s;
   - la pantalla del chat y la fila, como arriba.
4. **Oficina:**
   - la pestaña «Comentarios» con los hilos;
   - el resumen bajo el dato;
   - el punto en la bandeja, la pestaña y el botón del panel;
   - consulta cada 15 s con la pestaña abierta.
5. **Extremo a extremo** en Chromium y WebKit:
   - una respuesta del teléfono llega a oficina con el punto, y la de oficina llega al teléfono;
   - sin señal queda en cola y sale al volver;
   - revisado, se cierra.
6. **Despliegue:** `campo` primero, por la migración; después `servidor` y `oficina`.

**Decisiones tomadas al construirla (2026-10-06)**
- **Avisos con el cliente y el texto:** chocaban con la regla 3 del ADR-0023 (sin datos del cliente). Kevin eligió el 2026-10-06 mantener lo aprobado; el ADR-0040 lo deja como excepción solo para las conversaciones. El aviso dice el cliente («Oficina · Hotel Plaza Real»), no el sitio.
- **Las respuestas son comentarios** con `en_respuesta_a`, `de` y `llave` (única): la idempotencia va en la misma fila (`ON CONFLICT DO NOTHING`) y no en `comandos_procesados`. Un reintento con la misma llave devuelve el mensaje guardado aunque ya esté revisado. Las respuestas no llevan sección ni campo: son del dato de su conversación.
- **Códigos:** revisado → `estado_invalido`; comentario retirado, respuesta a una respuesta o levantamiento de otro técnico → `no_encontrado`. El teléfono guarda el motivo (`revisado`, `no_existe`, `invalida`) y no reintenta.
- **Lo leído en oficina** es por persona y por levantamiento (`levantamientos.lecturas`, solo avanza). «Leído» en el teléfono: alguien de oficina leyó después del mensaje.
- **La cola del teléfono** guarda lo enviado como «enviado» hasta que la bajada lo trae, para que no desaparezca de la pantalla entre las dos cosas; un mensaje que espera detiene los siguientes del mismo chat para no desordenarlo.
- **Con la conversación abierta no hay aviso:** la pantalla le dice al service worker qué conversación ve (mensaje, no la dirección); el aviso se muestra en silencio y se cierra. Limitación: Safari 18.4 o posterior puede mostrar el formato declarativo sin pasar por el service worker, así que en iPhone el aviso puede verse igual.
- **Aviso tocado con la app abierta:** el service worker le pide a la ventana abrir lo suyo (`/?conversacion=` en campo, `/levantamientos/<id>?hilo=` en oficina) sin recargarla.
- **En campo**, la fila de «Enviados» ya no dice «N comentarios de oficina»: dice «Oficina te escribió» o «N respuestas por enviar», como el prototipo. Se arregló de paso la hora de la fila, que salía como «a. m.» sola.
- **En oficina** se conserva el campo de comentario general bajo los hilos y la edición del comentario propio (ADR-0035) con «Editado <hora>».
- `source-map-js` forzado a 1.2.2 o posterior (aviso alto nuevo, por `better-auth`, ajeno a la iteración).
- **Fallos de WebKit en administración y cuenta resueltos** (venían de antes de la 38): eran tiempos agotados, no errores. Buscar por etiqueta o rol en toda la página recorría la tabla de Administración, que en la base local tenía cientos de usuarios de corridas anteriores (33 s por campo en WebKit). Las pruebas ahora buscan dentro de la hoja o la fila; además se limpió la base local, a pedido de Kevin. Administración pasó de agotar los 90 s a 11 s.

**Evidencia:** pruebas nuevas de protocolo (4), servidor (5 de revisión, 1 de avisos, lecturas en plataforma) y campo (6 del motor, 4 del chat, cifrado y migración a Dexie 7); `conversaciones.spec.ts` en Chromium y WebKit; `revision.spec.ts` y `usabilidad.spec.ts` siguen pasando; capturas de campo a 390 × 844 (lista, detalle, chat, sin señal, oscuro) y de oficina a 1440 px (comentarios, punto, cerrada, oscuro) comparadas con `prototipos/hilos`; `pnpm typecheck`, `arquitectura`, `licencias`, `audit` y `presupuesto` (campo 133,3 KB de 135).

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como los prototipos | Capturas de la 38 junto a `revision-al-lado` y de la 39 junto a `hilos` (oficina a 1440 px; campo a 390 × 844, en claro y oscuro) |
| 2. Pruebas de paquetes | Siguen pasando `revision.test.ts`, `repeticiones.test.ts`, `avisos.test.ts`, `plataforma.test.ts`, `protocolo.test.ts`, `motor.test.ts` y `cifrado.test.ts` de campo. Nuevas: idempotencia de `responderComentario`, rechazo después de revisado, permisos (otro técnico, oficina), la app 13 ignora `respuestas`, la cola sin señal y el cifrado de `respuestasPendientes` |
| 3. Extremo a extremo | `revision.spec.ts` y `usabilidad.spec.ts` (38); un spec nuevo de conversaciones (39) en Chromium y WebKit |
| 3b. Reglas | `pnpm typecheck`, `pnpm arquitectura`, `pnpm licencias`, `pnpm audit`, `pnpm presupuesto` (campo ≤ 135 KB) |
| 4. Desplegadas | Entorno de pruebas, `campo` primero en la 39. Falta que Kevin las pruebe, en su iPhone para campo |
