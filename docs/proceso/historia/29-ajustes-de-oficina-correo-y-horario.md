[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 28 · Datos que se corrigen](28-datos-que-se-corrigen.md) · Siguiente: [Iteraciones 32 y 33 · Ajustes de campo y la época de la bajada](32-ajustes-de-campo-y-epoca-de-la-bajada.md)

# Iteraciones 29 a 31 · Ajustes de oficina, el correo que escribe oficina y visitas con horario

**Estado en el mapa al 2026-10-16:**

- Iteración 29: Desplegada en el entorno de pruebas (2026-10-02) y aprobada por Kevin ("la aplicación de oficina ya quedó bien", 2026-10-03)
- Iteración 30: Desplegada en el entorno de pruebas (2026-10-02) y aprobada por Kevin ("la aplicación de oficina ya quedó bien", 2026-10-03)
- Iteración 31: Desplegada en el entorno de pruebas con la migración `0033` y la app 12 (2026-10-02); oficina aprobada por Kevin el 2026-10-03, falta la prueba en el iPhone

**Estado:** prototipo `prototipos/ajustes-oficina/prototipo.html` (https://claude.ai/artifact/Ms1PjHDXDjL1YhsDCdbSqu) aprobado por Kevin el 2026-10-02 en tres versiones: la primera con sus ocho decisiones ("Sí. Me gustan"); la segunda con la unidad libre del catálogo, la vista previa opcional al enviar, Programar visita sin desplazamiento y con selectores propios, y «Marcar revisado» fuera del panel; la tercera escribiendo sobre el correo mismo. "Si, empieza. Deja todo tal cual me lo mostraste en el artifact en la aplicacion." Construidas y verificadas en local el mismo día; sin confirmar ni desplegar.

**Para qué:** Kevin revisó formularios y cuadros de oficina y encontró capas a todo el alto para tres campos, una página que se cortaba al bajar, botones estirados, un correo que nadie podía cambiar, visitas que ocupaban el día entero y un fallo: "Regenerar acceso" decía "No se pudo completar la acción" aunque el acceso ya había cambiado.

## Alcance

**Iteración 29 · ajustes de oficina (sin migración):**
- **El fallo de «Regenerar acceso»** (confirmado por Kevin: la pestaña estaba abierta desde antes del despliegue). El servidor regeneraba y el navegador fallaba al cargar el QR, una pieza aparte cuyo nombre cambió con el despliegue: la clave nueva no se mostraba y la anterior ya no servía. Ahora, una vez el servidor responde, la clave se muestra siempre (`credencialConQr`); sin QR, lo dice. Si una pestaña vieja no encuentra una pieza (`vite:preloadError`), el marco ofrece "Hay una versión nueva de TEINS · Recargar" (`version.ts`), y los errores de ese tipo dicen eso en vez de un mensaje genérico (`esVersionVieja`). La relectura de la lista ya no convierte en error una acción que el servidor hizo. Lo mismo para el QR del segundo factor.
- **Capas a la medida:** `Dialogo` con `forma="formulario"` (centrado, del alto de su contenido, con su equis) y `ancho` (`medio`, `ancho`, `doble`, `previa`). Pasan a él: cambiar la contraseña, nuevo ítem, editar ítem, cambiar precio, agregar sitio, nuevo y editar contacto, editar cliente y sitio, nuevo usuario, reprogramar y reasignar. Siguen en hoja lateral: Nuevo cliente (ahora más largo), Nueva cotización, Importar y la vista previa en pantallas angostas.
- **Notificación:** la acción ("Deshacer") es texto sin borde (`--t-enlace-notificacion`). **Lo nuevo:** tinte al 8 % que se va en 1,2 s, sin barra (`--t-duracion-resaltado`). **Salir sin guardar:** 480 px, en una fila, el atajo solo en "Guardar y salir".
- **Mi cuenta:** columna de 680 px centrada; filas con icono, nombre, estado y una acción secundaria del mismo tamaño ("Activar avisos" deja de ser principal: un permiso se propone con botón secundario); las llaves como una fila de "Acceso"; el tema como segmentos en "Preferencias". Cambiar la contraseña en diálogo, con las reglas bajo la contraseña nueva.
- **Catálogo:** descripción arriba, código y unidad en una fila; **la unidad se sigue escribiendo libre**, con las del catálogo debajo como atajos (`CampoTexto` con `sugerencias`). "Cambiar precio de …" con su historia.
- **La cotización que se cortaba al bajar:** los textos solo para lectores de pantalla se ubicaban contra toda la app y no contra su columna, y estiraban la página (1.328 px en una ventana de 900). Cada columna del documento en vivo es ahora su referencia (`position: relative`) y el contenedor recorta (`overflow: clip`). El informe compartía la causa.
- **Enviar a otro contacto:** diálogo centrado; solo los contactos que todavía no la recibieron (en cola, enviado o entregado); "Todos los contactos ya la recibieron" con el enlace a Clientes; "Ver cómo llega" opcional (se recuerda en el equipo) abre al lado lo que recibe; "Lo enviado no se puede recuperar." junto a los botones.
- **Nuevo cliente con su contacto principal:** bloques Cliente, Primer sitio y Contacto principal (nombre, cargo, correo, celular, qué recibe y por dónde, autorización de WhatsApp), con correo o celular obligatorio. `crearCliente` acepta `contacto` (opcional en la API, por el comando y las pruebas) y lo crea en la misma transacción, con `contacto_creado` en la auditoría. Los campos del contacto son `CamposDeContacto.tsx`, compartidos con "Nuevo contacto".
- **Revisión:** materiales como filas de una tabla en oficina (`EditorCantidades` con `disposicion="tabla"`; campo sigue con tarjetas); la plantilla del informe fija el ancho de las columnas de cantidades (también en el PDF); "En el informe" ensancha el carril (44 %, mínimo 520 px) y la hoja usa el alto disponible, con "Ver en grande" a tamaño real; «Tomar para revisar», «Marcar revisado» y «Abrir el informe de la visita» van en la barra superior; el carril dice el estado en una línea ("En revisión · la tomó usted", "Revisado · por …") y "Siguiente: …" es una fila, no un botón relleno.

**Iteración 30 · el correo que escribe oficina (ADR-0036, sin migración):** asunto y texto editables en la pestaña "Correo" de la cotización y del informe (escribiendo sobre la vista previa: el asunto en su lugar y el texto punteado dentro del correo) y en "Enviar a otro contacto" (en el formulario o sobre "Ver cómo llega"; es el mismo texto). El saludo, el adjunto, el botón del portal y el pie los pone la plantilla; "Volver al texto de TEINS" lo restablece. El contrato acepta `mensaje` en publicar y enviar; el servidor lo copia a `envios.mensaje.personal` de cada envío por correo y el worker lo usa. El envío dice "con su texto". WhatsApp no se edita (plantillas de Meta).

**Iteración 31 · visitas con horario (ADR-0037, migración `0033_horario_visitas`):** fecha, hora y duración en selectores propios (calendario, rejilla de media en media hora con "Todo el día", duraciones de 30 min a 8 h con "No sé cuánto dura"); Programar visita en un diálogo de dos columnas que se ve entero, con los técnicos libres a esa hora (buscador, "Libres a esa hora" y "Ocupados" con el motivo, seis a la vista); la lista de visitas con la columna "Hora", ordenada por hora y con "En curso"; reprogramar con horario y reasignar con disponibilidad. El servidor rechaza los cruces (`tecnico_ocupado`), da la ocupación del día (`ocupacionDeTecnicos`) y recibe `terminarVisita`. En campo (app 12), la visita muestra su horario; una sin fin, ya empezada, muestra "En curso" y "Terminar visita", que se guarda al instante sin señal y sale con su llave en la siguiente sincronización. Los avisos dicen la hora.

## Fuera de las iteraciones 29 a 31

| Qué | Cuándo |
|---|---|
| «Deshacer revisado» (el prototipo lo mostraba): reabrir una revisión es ADR-0032, aplazado | Cuando Kevin decida el ADR-0032 |
| Guardar en el borrador el texto del correo escrito antes de publicar (hoy vive en la pantalla hasta publicar) | Si oficina lo pide (ADR-0036) |
| Un texto propio por omisión para todos los envíos | Si oficina lo pide (ADR-0036) |
| Avisar al técnico cuando el servidor rechaza para siempre su "Terminar visita" (hoy la visita vuelve a "En curso" sin mensaje) | Con la prueba en el iPhone |
| La prueba en el iPhone de "Terminar visita" y del horario en "Mis visitas" | Con la prueba en iPhone de las fases 9 a 19 |

## Terminado cuando

| Criterio | Evidencia |
|---|---|
| 1. Como el prototipo | Kevin aprobó oficina en el entorno de pruebas el 2026-10-03. Capturas de cada pantalla en local comparadas con el prototipo (Mi cuenta, contraseña, nuevo ítem, enviar a otro contacto con y sin vista, nuevo cliente con errores, programar visita con sus listas, revisión); falta que Kevin lo compare en el entorno de pruebas |
| 2. El fallo, reproducido antes de arreglarlo | `oficina/src/administracion.test.ts`: fallaba (la clave se perdía y el mensaje era genérico) y pasa con `credencialConQr` y `esVersionVieja` |
| 3. El corte, medido | En el navegador: alto de la página 1.328 px en una ventana de 900 antes, 900 después; `cotizaciones.spec.ts` lo verifica con las versiones y sus envíos a la vista |
| 4. Pruebas de paquetes | dominio 111, protocolo 25, documentos 9 (3 nuevas: texto propio, escapado, PDF que no cabe), oficina 18 (horario y fallo), campo 100 (11 nuevas: horario, en curso, terminar sin señal con su llave), servidor 213 (nuevas: cliente con contacto, correo propio, horario, cruces, ocupación y terminar) |
| 5. Reglas | `pnpm typecheck`, `pnpm arquitectura` (sin violaciones), `pnpm licencias`, `pnpm audit` sin vulnerabilidades; presupuesto de campo 130,6 de 135 KB |
| 6. Extremo a extremo | Local, Chromium y WebKit: la corrida completa dio 90 bien y 11 fallas, todas de pruebas con los textos y controles anteriores; corregidas, los 6 archivos afectados pasan (más `proteccion-oficina` y `programacion` otra vez tras un arreglo). Ese arreglo vino de la prueba de reasignar: al desmarcar a un técnico elegido, la lista lo reordenaba fuera de la vista; ahora quien se eligió en el diálogo conserva su lugar |
| 7. Desplegada | Entorno de pruebas el 2026-10-02 desde el commit cab5f54: `campo` primero ("Migraciones aplicadas", la `0033`), después `oficina`, `portal` y `worker`, los cuatro en `SUCCESS`. Verificado: las tres superficies 200, salud 200, la misma compilación de oficina que la local (`index-BMDu84Yz.js`), `ocupacionDeTecnicos` y `terminarVisita` 401 sin sesión, y `verificar-exposicion.sh`. Falta que Kevin la pruebe y producción |

## Decisiones tomadas al construirlo

- **Los cruces se validan en la API, no en el comando `crear-visita`**, que sigue siendo una herramienta de administración. Se mira después de validar el pedido (fecha, sitio), sin contar la propia visita, con un bloqueo por organización y día.
- **El mediodía es "12:00 p. m."** en oficina, en campo y en los avisos, para un solo formato.
- **Un técnico elegido que queda ocupado al cambiar la hora deja de estar elegido**; Programar visita propone de 9:00 a 11:00 de hoy.
- **Reprogramar a otro día u otra hora deja la visita otra vez por hacer** (borra la terminación).
- **En campo, la terminación pendiente vive en el registro de la visita, fuera de lo sellado** (solo una hora y una llave, nada del cliente), para que la bajada la conserve sin abrir el sello; la del servidor gana.
- **La app de campo pasa a la versión 12**: ADR-0015 hace que un teléfono con versión nueva vuelva a bajar todo, y así recibe el horario de lo ya asignado.
- **La vista del correo se escribe dentro del marco**: el bloque del texto es editable (`contenteditable="plaintext-only"`) y el marco no se vuelve a dibujar mientras se escribe, para no perder el cursor; sí cuando el texto cambia desde afuera ("Volver al texto de TEINS", el formulario).

## Al cerrarlas

**Iteraciones 29 a 31 construidas, verificadas y desplegadas en el entorno de pruebas el 2026-10-02** (sección "Iteraciones 29 a 31"). Kevin aprobó el prototipo `prototipos/ajustes-oficina/prototipo.html` (https://claude.ai/artifact/Ms1PjHDXDjL1YhsDCdbSqu) con sus cambios ("Si, empieza. Deja todo tal cual me lo mostraste en el artifact"). Sigue: que Kevin compare cada pantalla con el prototipo; la prueba en el iPhone de «Terminar visita» (toca campo); y producción cuando Kevin lo apruebe (respaldo antes y `campo` primero por la `0033`).
