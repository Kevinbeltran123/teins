[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 41 · Nada queda a medias ni crece sin fin](41-nada-queda-a-medias.md) · Siguiente: [Iteración 43 · Lo que dice la documentación es lo que hace el código](43-documentacion-y-codigo-alineados.md)

# Iteración 42 · Lo que se ve sale de lo guardado

**Estado en el mapa al 2026-10-16:** Desplegada en el entorno de pruebas y fusionada a `master` (2026-10-16); producción sigue apagada

**Estado:** pedido de Kevin el 2026-10-15. Encontró en producción que, al agregar un tablero y quitarlo, «Revisa y envía» le pedía completar los campos del tablero quitado («Investiga qué otros bugs de este estilo puede haber»). La investigación lo reprodujo en el navegador y encontró la misma familia en campo, oficina y servidor: copias viejas de los datos que sobreviven a lo que las originó, escrituras que llegan tarde y callejones sin salida. Kevin aprobó arreglarlo todo de corrido y sin pedirle confirmación («Termina todas las tandas de corrido»), con un solo despliegue al entorno de pruebas al final. Aceptó las tres decisiones propuestas: croquis de hasta 10 MiB medido en el teléfono, cliente y sitio guardados en el levantamiento, y quitar al enviar las respuestas de tableros que ya no existen. ADR-0045. Construida, verificada y desplegada en el entorno de pruebas el 2026-10-15 (`campo`, `oficina`, `portal` y `worker`; sin migración ni versión nueva de la app de campo). Allí pasaron las dos pruebas del fallo reportado y el worker arrancó con su tarea periódica. El mismo día Kevin pidió cerrar también lo menor que había quedado de las revisiones y fusionar todo a `master` («si dale, una vez termines todo mergeas TODOS los cambios a master»): es la tanda 5, desplegada otra vez en el entorno de pruebas antes del pull request de `corte-0`. El pull request #2 falló en WebKit: desde que la prueba de extremo a extremo corre un trabajo por navegador, el de WebKit solo instalaba WebKit, y el worker de la prueba imprime los PDF con Chromium, así que fallaron las 9 pruebas que esperan un PDF. El trabajo instala Chromium siempre (`a7e6e62`); con las 6 comprobaciones en verde, se fusionó a `master` el 2026-10-16.

**El fallo reportado:** la pantalla guardaba los errores como una copia. Al tocar «Siguiente» con el tablero nuevo vacío, sus campos entraban a esa copia, y quitar el tablero no los sacaba. «Revisa y envía» mostraba «Faltan 2 datos» con nombres internos (`ubicacion`, `tableros~…`), aunque el envío sí pasaba al confirmar.

**Tanda 1 · Campo: lo que perdía datos o bloqueaba el envío**
- **Volver a un paso mostraba los campos vacíos, y agregar un material borraba los anteriores.** Desde la iteración 22, cada paso monta sus campos al abrirse, pero partían de la copia tomada al abrir el borrador. Ahora parten de lo guardado, también el motivo de «No se pudo obtener» y la unidad de la medida.
- **Lo que llegaba tarde a un tablero quitado lo revivía y bloqueaba el envío para siempre**: el «Deshacer» de una foto o de «No se pudo obtener», o una foto que terminaba de procesarse. Quedaba «Falta 1 dato: `tableros~…`» sin nada que completar, y la única salida era descartar el levantamiento. Ahora el dominio no escribe en una repetición que ya no existe (`editar`), y el repositorio no guarda nada si no hubo cambio. Al enviar, el teléfono quita las respuestas huérfanas que hubiera dejado una versión anterior (`sinRespuestasHuerfanas`), y lo mismo hacen el recorrido y «Mis visitas».
- **Lo que falta sale de la validación vigente**: la pantalla recuerda qué datos ya señaló, no los errores. Un tablero quitado, o una foto devuelta con «Deshacer», dejan de pedirse.
- **La clave de cada campo lleva su sección**: dos pasos seguidos con un campo de la misma clave (el meta-esquema solo exige claves únicas dentro de cada sección) no comparten lo escrito.
- **«Deshacer» de un material** devolvía la lista entera del momento y borraba lo agregado en esos 10 s. Ahora devuelve solo esa línea, en su lugar, sobre la lista vigente, y un segundo toque no la duplica.
- **Un croquis grande se perdía después de enviar.** Con el formato del editor, 100 trazos a mano pesan 0,54 MB: unos 370 pasaban el límite de 2 MB del servidor, el envío quedaba en error y oficina no podía resolverlo. El límite pasa a 10 MiB, el mismo de una foto (`LIMITES_BOCETO.bytes`). El teléfono mide bocetos y firmas antes de enviar y, si alguno se pasa, lo dice en el dato (`archivo_muy_grande`). «Dibujar boceto» espera a que se lea lo guardado, para no abrir una hoja vacía que lo reemplace.
- **Un envío que oficina nunca recibió vuelve a borrador** (ADR-0045): «Volver a borrador para corregir», junto a «Reintentar envío» y «Descartar levantamiento». Antes, un rechazo permanente solo dejaba descartar la visita.
- **El teléfono ya no deja salir lo que el servidor rechazaría para siempre:** los decimales se validan con el largo del protocolo (`LIMITES.decimal`), y los caracteres nulos salen del texto al enviar y al responder en el chat.

**Tanda 2 · Campo: lo que engañaba**
- **Lo enviado de días anteriores guarda dónde fue.** La visita atendida sale del teléfono al día siguiente (ADR-0041), y «Enviados» mostraba «Formato de prueba · N fotos» en todas las filas. Ahora el levantamiento guarda sellados el cliente y el sitio al crearse (`lugar`), o al enviarse si es de antes. Los usan «Enviados», la papelera, el chat y la captura. La cuenta de fotos ya no suma las líneas de materiales.
- **«Ver en Descartados» abre la papelera una vez**: antes se abría sola cada vez que se volvía al inicio.
- **Al abrir la app se borran los archivos que nada usa** (`limpiarArchivosSinUso`): las fotos de un tablero quitado o las que reemplazó «No se pudo obtener». Se hace solo al abrir, para que ningún «Deshacer» pierda su foto.
- **El chat fija su destino** al empezar a escribir: una pregunta que llega mientras tanto no lo cambia, y si oficina retira la elegida vuelve a la última que sigue. Dice qué pasa si no hay pregunta, si el teléfono no pudo guardar la respuesta o si la sesión venció.
- **Mientras el técnico cambia la contraseña temporal**, el 403 del servidor ya no hace perder terminaciones de visita ni marca las respuestas del chat como rechazadas: esperan como un error pasajero.
- **La espera de verificación de archivos crece**: con el worker caído, el teléfono ya no consulta cada 5 s sin fin.
- **Un borrador descartado no retiene en el teléfono una visita que el servidor ya cerró.**
- **Menores:** una foto que falla en un lote no detiene las demás, y el aviso dice cuántas faltan. Si la captura no se puede cargar, se dice y el siguiente toque la intenta de nuevo. Un borrador bloqueado dice «Ver lo capturado», no «Ver lo que enviaste».
- **Dominio:** un mínimo de fotos exige que el campo sea obligatorio. Sin eso, el envío quedaba bloqueado y no se podía marcar «No se pudo obtener».

**Tanda 3 · Oficina**
- **Un documento ya no se escribe encima de otro.** Las rutas del informe, la cotización y el cliente no se volvían a montar al cambiar de id (⌘K, Recientes, Atrás). La pantalla del segundo mostraba el borrador del primero, y el guardado automático podía escribirlo encima. Ahora llevan `key={id}`, como el levantamiento.
- **Una visita con su técnico desactivado se puede reasignar.** Antes el desactivado no tenía casilla para quitarlo y el servidor rechazaba la lista. Ahora sale al guardar («Se desactivó a X: sale de la visita»), y la lista de Visitas lo dice en la fila, con la insignia «Sin técnico» si no queda nadie activo. Reprogramar tampoco lo cuenta como ocupado (servidor).
- **Lo que se está escribiendo no se pierde:**
  - si falla una relectura, la revisión y el cliente ya no se reemplazan por «No se pudo cargar»: el error solo se ve si nunca hubo datos;
  - el comentario o la respuesta a medias sobrevive al cambiar de pestaña, ocultar el panel o abrir otro globo;
  - «Marcar revisado» dice qué se pierde, como una corrección sin guardar o comentarios sin enviar;
  - con un conflicto de guardado, lo escrito después también se copia en el equipo.
- **La autorización de WhatsApp queda atada al número**: con otro celular se desmarca y hay que confirmarla de nuevo.
- **Cada «Deshacer» se hace una sola vez** (`Notificaciones`): un doble clic duplicaba una línea de la cotización. El de las cantidades en la revisión devuelve solo su línea sobre las de ahora.
- **Los diálogos de visita adoptan la versión vigente después de un conflicto**: el reintento ya no choca otra vez. Mientras no hay conflicto siguen con su copia, para no pisar en silencio lo que cambió otra persona.
- **Mensajes que dicen lo que pasó.** Un `estado_invalido` muestra la explicación del servidor, por ejemplo una visita cancelada sin informe o un cliente archivado mientras se programaba. En la lista de visitas, «Abrir el informe» dice por qué no abrió. Un cliente archivado no tiene contactos marcados por omisión al publicar, y la confirmación dice cómo enviarlo después.
- **Errores que sobreviven a su causa:** los errores por campo se van al corregir el campo (Visitas, Cliente, Clientes, Catálogo, Administración, Mi cuenta y la contraseña obligatoria). El error de publicar ya no queda en la cotización después de cancelar. «Con correcciones» compara la sección exacta. Si quien revisaba se desactivó, se dice y se ofrece tomar la revisión.
- **Menores:** marcar «No se pudo obtener» vuelve a dejar guardar la corrección, y desmarcarlo conserva lo que muestra el campo. El avance de una versión retirada dice «Retirada del portal». La lista de técnicos se vuelve a leer tras cada acción de Administración. Al abrir «Reasignar», ya no se quita en silencio a quien tenía la visita.

**Tanda 4 · Servidor**
- **Corregir un sitio o un cliente llega a los teléfonos**: sus visitas por hacer vuelven a bajar con la dirección o el nombre nuevo. Antes el técnico seguía viendo la dirección vieja. El portal también toma el nombre corregido.
- **Desactivar otra vez a quien se reactivó vuelve a ordenar el borrado de sus teléfonos.** Antes, la orden ya cumplida impedía una nueva y sus datos de clientes se quedaban en el teléfono (QA-5).
- **Una foto o un boceto que ya está guardado y perdió su fila** (después de restaurar la base o de dejar limpio un entorno) se adopta si pasa el mismo examen del worker: huella, tamaño y tipo por contenido. Antes se rechazaba para siempre y el envío quedaba atascado. Un PDF nunca se adopta: no se distingue de un documento generado (regla 7).
- **Lo que no llegó a un contacto que ya no recibe por ese canal** no queda como «envío sin entregar» para siempre.
- **El rechazo por técnico inactivo dice quién es**, sin nombrar a nadie de otra organización.
- **Carreras con oficina:**
  - cerrar visitas vuelve a mirar la fecha y la cancelación en la fila, así que una visita reprogramada no queda cerrada;
  - programar en un cliente que se archiva espera al archivo (`FOR SHARE` sobre el cliente);
  - programar y reprogramar el mismo día a la vez ya no se traban: los dos toman el día primero.

**Tanda 5 · Lo que quedaba de las revisiones**
- **Lo reciente de la búsqueda (⌘K / Ctrl + K) se ve como está ahora**: con el nombre que corrigió otra persona y el estado de hoy de cada levantamiento. Antes mostraba lo de cuando se abrió, y una visita reciente se buscaba en Visitas con el nombre viejo del cliente, sin encontrarla.
- **«Ver en Canceladas», «Ver en Activos» y «Programar otra» funcionan también después de salir de la pantalla.** Antes no hacían nada, aunque el aviso siguiera a la vista. Si ya se está en la lista, no agregan otra entrada al historial (`useIrConPedido`).
- **Lo que pide la búsqueda o un aviso se atiende una vez** (`usePedido`): «Programar visita», «Nuevo cliente» y «Nueva cotización» ya no se vuelven a abrir al regresar con Atrás ni al recargar la página.
- **Lo escrito mientras se envía un comentario o una respuesta ya no se borra al llegar.** El campo se vaciaba cuando terminaba de releerse la bandeja, después de que el comentario ya se veía; con ↵ para enviar, el siguiente mensaje desaparecía. Ahora se vacía solo si sigue diciendo lo enviado (`vaciarSiSigue`). Lo encontró una falla de WebKit en la prueba de la revisión.
- **Un borrador bloqueado con la sesión vencida ofrece «Iniciar sesión»** ahí mismo y, al entrar, vuelve a editarse. Antes decía «conéctate para seguir», y conectarse no bastaba.
- **Servidor:**
  - un archivo guardado sin fila que no coincide con lo declarado ya no se describe como «documento generado»: se dice que no coincide y que no se reemplaza;
  - la auditoría de una segunda desactivación cuenta todos los teléfonos que van a borrar, también el que seguía con su orden sin cumplir.
- **Pruebas que faltaban:** pasar de un informe a otro sin recargar (`key={id}`), además de una por cada arreglo de esta tanda. La del informe abre primero el segundo: si no estaba leído, el esqueleto de carga volvía a montar la pantalla y ocultaba el fallo. La del informe, la del comentario y la del formulario que parte de Clientes se corrieron también sin su arreglo, y fallaron. El doble toque en «Deshacer» ya lo cubría `copias-viejas.spec.ts`.
- **Un verificador de solo lectura revisó la tanda** y encontró una regresión: el enrutador cambia la ubicación al empezar a cargar, con la pantalla anterior todavía montada. Así, desde Clientes o Cotizaciones, «Programar visita» llegaba a Visitas sin abrir el formulario, porque la pantalla que se dejaba borraba el pedido. Se corrigió antes del despliegue, con una prueba que parte de Clientes.

**Decisiones tomadas al construirla**
- **Lo que se muestra se deriva de los datos; no se copia.** La pantalla recuerda qué datos ya señaló, no los errores, y cada paso parte de lo guardado. Se descartó limpiar la copia en cada lugar que cambia algo, porque siempre aparece un lugar nuevo.
- **El guardia va en el dominio (`editar`)**, el único punto por donde pasa toda escritura de respuestas. Un «Deshacer» o una foto que llegue tarde en el futuro tampoco revive un tablero.
- **El servidor sigue estricto.** El teléfono limpia antes de enviar y, si aun así el servidor rechaza para siempre, el levantamiento vuelve a borrador (ADR-0045).
- **10 MiB para el croquis**, el mismo límite de una foto, sin cambiar su formato. Se descartó no guardar el contorno de cada trazo: pesaría la tercera parte, pero cambia el formato del boceto y el PDF, y necesitaría un ADR.
- **El cliente y el sitio van en el levantamiento, sellados**, en vez de conservar la visita atendida en el teléfono: no cambia el ADR-0041 ni la agenda.
- **Los archivos sin uso se borran solo al abrir la app**: durante la sesión, un «Deshacer» puede devolverlos.
- **«Deshacer» después de enviar no hace nada**, porque el levantamiento ya no se edita. Se deja así: no se pierde nada de lo enviado.
- **Al reprogramar, solo cuentan los técnicos activos.** Un desactivado ya no hará ninguna de sus visitas.
- **Lo que pide una navegación se borra de su entrada del historial al atenderlo** (`usePedido`, con `navigate` en `replace`), y se lee de la ubicación ya resuelta (`resolvedLocation`), no de la que se está cargando. Se descartó recordar en memoria qué entradas ya se atendieron: al recargar la página se perdería y el formulario volvería a abrirse. También se descartó guardar el pedido fuera del historial: una navegación bloqueada (salida protegida) lo dejaría pendiente para la próxima vez.
- **Los avisos con un siguiente paso navegan** («Ver en Canceladas», «Ver en Activos»), como ya hacía «Ver en Archivados». Así funcionan desde cualquier pantalla, y si la lista está abierta, se cambia de pestaña en ella.
- **La integración continua corre la prueba de extremo a extremo en un trabajo por navegador**, en paralelo y con hasta 60 minutos cada uno. La suite pasó de 39 a 78 pruebas desde el pull request #1, que ya tardaba 26 de los 30 minutos permitidos con los dos navegadores juntos. Cada pull request sigue corriendo Chromium y WebKit.
- **`paquetes/ui` sigue sin pruebas de componentes.** Su lógica la cubren las pruebas de extremo a extremo. Montarlas requiere jsdom y Testing Library, y eso es otra decisión.
- **Repartida en tres frentes:** campo, dominio y protocolo los construyó la sesión principal. Oficina y servidor los construyeron dos agentes, cada uno en su worktree, con commits propios. Después se integraron y se verificó todo junto.
- **Tres verificadores independientes** (campo, oficina, servidor), de solo lectura, revisaron lo construido. No encontraron regresiones graves. Sí encontraron fallos de la misma familia, y se corrigieron:
  - **campo:**
    - en un campo de materiales obligatorio, «Deshacer» de «No se pudo obtener» montaba el editor vacío y el siguiente cambio borraba lo devuelto;
    - volver a borrador podía dejar dos borradores en una visita (ahora lo dice: `VisitaConOtroBorrador`);
    - la hoja de «Siguiente» se quedaba con su lista (ahora sale de la validación y se cierra sola);
    - un error de croquis de un tablero quitado se quedaba atascado;
    - una sección repetible entera se nombraba por su clave;
    - el «Deshacer» de materiales podía escribir sobre un editor que ya se había cerrado (ahora se retira al salir del paso, `useRetirarNotificacion`);
    - reemplazar un boceto borraba el documento que otro campo del mismo levantamiento usaba.
  - **oficina:**
    - los «Deshacer» de líneas se ofrecían con su editor ya cerrado;
    - Esc, el menú, Atrás o recargar perdían lo escrito en la revisión (ahora se conserva en la pestaña, Esc no sale con una corrección abierta y recargar pregunta);
    - con algo que se pierde, «Marcar revisado» se confirmaba con ↵;
    - apagar WhatsApp borraba la autorización registrada;
    - si fallaba la ocupación, no se veían técnicos;
    - el candado de «Deshacer» de un comentario podía quedar pegado;
    - el comentario sobre un dato admitía 2.000 caracteres y el servidor recibe 1.000.
  - **servidor:**
    - reprogramar pedía una segunda conexión del pool dentro de su transacción, y quince a la vez respondían 500;
    - lo archivado se podía reprogramar;
    - una visita atendida que se reprogramaba para volver no contaba como por hacer;
    - quitar un contacto avisaba como un envío fallido;
    - corregir el nombre de un cliente no lo tomaba.

**Evidencia:**
- **Antes del arreglo**, cada fallo de campo se reprodujo con una prueba de navegador sobre la compilación de producción local, cada uno con su captura de pantalla: el tablero quitado que se pedía, los tres caminos que bloqueaban el envío para siempre, la foto devuelta con su aviso y el paso que volvía vacío y borraba materiales. Esas pruebas pasaron a `e2e/pruebas/copias-viejas.spec.ts`. Las tres fallas del servidor que encontró su verificador también se reprodujeron antes del arreglo; la del pool lo hizo con quince reprogramaciones a la vez.
- **Verificaciones:** `pnpm typecheck` (8 paquetes), `arquitectura` (372 módulos), `licencias` (325 paquetes), `audit` sin vulnerabilidades y `presupuesto` (134,6 KB de 135).
- **Pruebas:** dominio 121, documentos 11, protocolo 29, oficina 62, campo 143 y servidor 245.
- **Extremo a extremo** en Chromium y WebKit: 143 pasan, 3 omitidas y ninguna falla (27,6 min). Incluye `copias-viejas.spec.ts` (8 pruebas) y `robustez-oficina.spec.ts` (4).
- **Tanda 5:**
  - `arquitectura` con 373 módulos y las mismas pruebas unitarias; las del servidor suman aserciones en `cuenta.test.ts` y `api.test.ts`;
  - extremo a extremo en Chromium y WebKit: 153 pasan, 3 omitidas y ninguna falla (37,1 min), con `robustez-oficina.spec.ts` en 8 pruebas;
  - en el entorno de pruebas, después del despliegue, pasaron la del formulario que parte de Clientes, «Ver en Canceladas» y el borrador bloqueado con la sesión vencida;
  - `avisos.test.ts` («410 borra la suscripción…») falló una vez con los 22 archivos en paralelo, y pasó sola y en la corrida siguiente: es intermitente desde antes y no depende de esta tanda.

## Al cerrarla

**Iteración 42 desplegada en el entorno de pruebas (2026-10-15).** Kevin encontró en producción que un tablero quitado se seguía pidiendo al enviar. La investigación lo reprodujo y encontró la misma familia de fallos en campo, oficina y servidor, todos arreglados (ADR-0045). Una quinta tanda cerró lo menor que dejaron las revisiones, y todo `corte-0` pasó a `master` con el pull request #2 el 2026-10-16, cuando la integración quedó en verde (el trabajo de WebKit no instalaba el Chromium con el que el worker imprime los PDF). Siguiente: que Kevin pruebe la 42 en su iPhone (agregar y quitar tableros, volver a pasos ya capturados, materiales, croquis) y en oficina. Después, producción cuando la vuelva a encender: respaldo antes, y `campo`, `oficina`, `portal` y `worker`, sin migración. Pendiente de antes: probar de la 38 a la 41 y lo que entregue TEINS.
