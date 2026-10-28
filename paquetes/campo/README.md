# campo

PWA de campo: captura sin conexión, cola de envío (outbox), sincronización, croquis y firma del cliente. Campo tutea.

- **Dependencias:** `dominio`, `protocolo` y `ui`. Sin Motion: el movimiento es CSS (regla 10).
- **ADR:** 0002, 0003, 0004, 0009, 0015, 0017, 0019, 0022 a 0027, 0030, 0035, 0037, 0038, 0040, 0041, 0044, 0045.
- **Versión de la app:** `VERSION_APP` 15 en `src/version.ts`. Súbala cuando la app aprenda un tipo de campo nuevo o cambie lo que entiende de la bajada; los formatos que lo usen declaran `appMinima`.
- La historia de cada iteración está en [`docs/proceso/historia/`](../../docs/proceso/historia/).

## Cómo se usa

- `pnpm dev:campo` desde la raíz (puerto 5173). `/api` se reenvía al servidor en `localhost:3000`. Para abrirla desde un celular en la red local, agregue ese origen a `ORIGENES_CONFIABLES` del servidor.
- `pnpm --filter @teins/campo test`: pruebas de Vitest (base local, migraciones, motor de sincronización, dibujo, visitas, chat).
- `pnpm presupuesto` desde la raíz, con campo compilado: JavaScript inicial, presupuesto de 135 KB (ADR-0030; antes 120, ADR-0011). Al 2026-10-15: 134,6 KB.
- Se cargan aparte del primer dibujo (el service worker los guarda igual): `IniciarSesion`, `InstalarApp`, la captura, el código de red, y desde Inicio `SugerirLlave`, `TarjetaAvisos`, `HojaCambiarContrasena`, `Papelera` y `Diagnostico`; desde la captura, `EditorBoceto` y `HojaDeFirma`. `HojaCatalogo` va dentro de la captura y el editor recibe los símbolos de ella: separarlos partía el JavaScript inicial.

## Qué contiene

### Base local (`src/datos/`)

- Dexie versionada detrás de un puerto (`repositorio.ts`, `dexie.ts`, `base.ts`), hoy en la versión 7. Cada versión se prueba migrando datos de la anterior (`repositorio.test.ts`, `cifrado.test.ts`). Nunca se borran datos locales para migrar (regla 5).
- **Cifrado local (ADR-0022):** una clave AES-GCM no extraíble por técnico (`cofre.ts`). Respuestas, fotos, bocetos, comandos, visitas, comentarios y respuestas del chat se guardan sellados y se abren al leer (`registros.ts`, `lecturas.ts`). Las escrituras sellan fuera de la transacción y guardan con comprobación optimista (`rev`), en fila por levantamiento. Lo de antes se sella en segundo plano al abrir la app y al iniciar sesión (`sellarEnSegundoPlano`). A un técnico con un borrado pendiente no se le crea otra clave (`claveDe` lo revisa en la misma transacción).
- Catálogo (`catalogo`, ADR-0025) y símbolos (`simbolos`, ADR-0027) se guardan sin sellar: son datos de la organización.
- **Lo que se ve sale de lo guardado (ADR-0045):** no se escribe nada cuando el dominio no cambia, así un tablero quitado no revive. `enviar` quita respuestas huérfanas y caracteres nulos, mide bocetos y firmas (`archivo_muy_grande`) y copia el `lugar` (cliente y sitio, sellados), que nombra lo enviado cuando la visita ya salió. `volverABorrador` devuelve un envío rechazado que oficina nunca recibió, salvo que su visita tenga otro borrador (`VisitaConOtroBorrador`). `limpiarArchivosSinUso` corre al abrir la app.
- **Fotos:** `quitarFoto` quita la referencia y, en la misma transacción, el archivo si nada más lo usa. "Verificar fotos" (`fotos/verificar.ts`) solo abre las de quien tiene la sesión.
- **Papelera (ADR-0035):** "Descartar levantamiento", solo en un borrador nunca enviado. `descartadoEn` es un campo visible del registro (no va sellado), `listar` lo deja fuera y "Tu cuenta › Descartados" (`pantallas/Papelera.tsx`) lo muestra con la fecha en que se borra y "Recuperar" (`repositorio.recuperar`, que lo devuelve suelto si su visita ya tiene otro borrador). Al iniciar sesión, `vaciarPapelera` borra lo descartado hace más de `DIAS_EN_LA_PAPELERA` (30) con las fotos que nada más usa. Con poco espacio (`pocoEspacio`: libre menos del 10 % de la cuota), el diagnóstico lo dice y, si hay descartados, ofrece "Vaciar Descartados" con confirmación irreversible (`vaciarPapeleraDe`, solo lo del técnico).
- **Terminar una visita (ADR-0037):** `datos/terminacion.ts` guarda al instante, fuera de lo sellado; sale con su llave en la siguiente sincronización. Si el servidor la rechaza sin remedio, la visita vuelve a lo que él dice y queda marcada (`terminacionRechazada`): junto a "Terminar visita" se ve el aviso hasta volver a terminarla.
- **Chat (ADR-0040):** `datos/conversacion.ts` (`responder`, `pendientesDe`, `marcarLeido`) guarda lo que responde el técnico en `respuestasPendientes`, sellado (contexto `respuesta:<llave>`), y lo leído en `lecturasDeChat`.
- `datos/lecturaRecordada.ts` empieza con lo último que leyó, en memoria, y se olvida sin sesión: volver al inicio no muestra esqueleto.

### Sincronización (`src/sincronizacion/`)

- Motor del outbox, la bajada y las órdenes de borrado (`motor.ts`), con su arnés de fallas (`pruebas/servidor-falso.ts`). El código de red se carga aparte del primer dibujo.
- **Cuándo baja:** al abrir, al recuperar señal, al volver a la app y después de un envío recibido; si no, cada 5 minutos. Cada bajada lleva el informe de salud del teléfono y renueva el permiso de trabajo sin conexión.
- **Qué trae:** formatos, visitas con su horario y terminación, estado de revisión, comentarios de oficina (los editados dicen "· Editado") y sus respuestas, catálogo y símbolos.
- **Envíos:** levantamientos, terminaciones (`enviarTerminaciones`) y respuestas del chat (`enviarRespuestas`, con la espera de los envíos; no reintenta un rechazo y la bajada las saca de la cola al traerlas). Ante el 403 de cambio de contraseña, el motor espera.
- **Época de la bajada (ADR-0038):** la bajada trae `epoca` y el teléfono la guarda en `bajadas`. Si cambia, `reiniciarPorEpoca` (`almacen.ts`) quita visitas sin trabajo, estados y catálogo; el motor baja todo de nuevo y, en la última página, `aplicarBajada` quita lo enviado y recibido que el servidor ya no conoce (marca `podar`). Borradores, cola, formatos, símbolos y el chat se quedan.
- **Visitas atendidas (ADR-0041):** la bajada con `fuera_de_alcance` motivo `atendida` quita la visita sin aviso, salvo que tenga un borrador o un envío por salir.
- **Retención (ADR-0044):** después de cada bajada, `podarRevisadosAntiguos` quita lo revisado que oficina recibió hace más de `DIAS_DE_RETENCION` (30) días, con sus fotos, envío, estado y chat. Lo no enviado nunca se toca.
- **Revocación:** si el servidor rechaza la sesión, el teléfono pregunta con su secreto si hay orden de borrado. Si la hay, destruye primero la clave, borra solo los datos de ese usuario (también lo que descartó, `teins-…:<id>` en `localStorage`) y lo confirma; si no, pide iniciar sesión. Un archivo que el revocado compartía con un borrador sin responsable vuelve a quedar a la vista.
- **Cerrar sesión sin señal** deja `cierre_pendiente`; la sesión se cierra en el servidor al volver la señal o antes del siguiente ingreso (`completarCierrePendiente`).

### Sesión y cuenta (`src/sesion/`)

- Inicio de sesión con contraseña o con llave de acceso (Face ID, huella o PIN). Después de entrar con contraseña, Inicio propone crear la llave (`pantallas/SugerirLlave.tsx`; "Ahora no" se recuerda en ese teléfono).
- **Contraseña temporal (ADR-0033):** "Crea tu contraseña" dentro del ingreso (`pantallas/IniciarSesion.tsx`). `prepararSesion` lanza `ContrasenaTemporal` y el teléfono no guarda el usuario ni baja nada hasta cambiarla (`sesion.ts`). Errores del servidor en `cuenta.ts`.
- Un borrador bloqueado con la sesión vencida ofrece "Iniciar sesión" ahí mismo (`pedirSesion` de `Captura`).

### Pantallas (`src/pantallas/`)

- **Inicio (`Inicio.tsx`):** la siguiente visita es el punto focal. `agendaDeVisitas` (`src/visitas.ts`, ADR-0041) separa las pendientes de las atendidas hoy: lo atendido (enviado o terminado, sin borrador) no es la siguiente visita, sin pendientes no hay siguiente y lo de otros días no se muestra; "Atendidas hoy" va aparte. `horarioDeVisita` y `enCurso` (ADR-0037): una visita sin fin ya empezada dice "En curso" y ofrece "Terminar visita". "Enviados" en dos líneas con `estadoCorto` (`src/mensajes.ts`), "Necesita atención", y "Oficina te escribió" o "N respuestas por enviar".
- **Visita que sale del teléfono con algo empezado:** guarda por qué (`motivoSalida`): "Oficina canceló esta visita" o "se asignó a otra persona". Lo empezado se puede terminar y enviar; no se inician levantamientos nuevos en ella.
- **Tu cuenta:** una lista con Contraseña (`HojaCambiarContrasena.tsx`, no se abre sin señal), Descartados (`Papelera.tsx`) y Diagnóstico (`Diagnostico.tsx`), como páginas de la misma hoja; arriba, `AvisoDeAlmacenamiento` si los datos no son persistentes. El diagnóstico dice el almacenamiento (y si queda poco espacio), si los datos están cifrados y el estado de los avisos (si están bloqueados, cómo permitirlos).
- **Captura (`Captura.tsx`):** cada sección del formato es un paso. Cada paso y cada tablero montan sus campos desde lo guardado (`actual`), con la sección en la clave; lo que falta se calcula de la validación vigente (`senalados` y `delEnvio`), también en la hoja de "Siguiente". Tableros en filas con su primera foto y su avance (`FilaDeTablero`); nombre y quitar en el menú ⋯. "Revisa y envía" con cifras y el contenido de cada paso; la confirmación en una hoja inferior. Si el teléfono no puede guardar, la captura lo dice arriba (`VigilarGuardado`). Un rechazo permanente del envío dice qué pasó y qué hacer (`porQueNoEntro` en `src/mensajes.ts`). Un doble toque en "Iniciar levantamiento", "Agregar …" o "Reintentar envío" lo hace una vez (`useSinRepetir`). "No se pudo obtener" sobre un dato capturado se deshace y el control se monta de nuevo con lo guardado.
- **Cantidades:** texto libre; la cantidad se escribe "12,5" y se guarda "12.5". "Del catálogo" abre `HojaCatalogo.tsx`: búsqueda sin tildes por comienzo de palabra o código, "Los que más usas" (contados de las líneas de ese técnico en el teléfono; lógica en `src/catalogo.ts`) y lo agregado abajo. La línea elegida lleva `item` y muestra "Del catálogo · código" con descripción y unidad fijas; lo que no está se agrega como línea libre.
- **Croquis (`EditorBoceto.tsx`, ADR-0019, 0026 y 0027):** a pantalla completa, como GoodNotes, con una barra de iconos fija (`Pastilla` y `BotonHerramienta` de `ui`): volver, deshacer y rehacer, Trazo, Cota, Texto, Mover y Borrador. La hoja es vertical y tan alta como el espacio libre (`altoDeHoja`).
  - Trazo libre con perfect-freehand y rechazo de la palma; el contorno vive en `dibujo/trazo.ts`, que comparte con la firma.
  - Un trazo con el dedo quieto medio segundo al final se endereza (`dibujo/enderezar.ts`, con un anillo CSS que se llena). La cota pide su medida.
  - Mover elige con un toque, arrastra, gira de a 15° y cambia el tamaño, con "Duplicar" y "Quitar" (`dibujo/transformar.ts`).
  - Varias hojas con nombre: la pastilla de abajo abre el menú (ir, agregar, cambiar el nombre, quitar); dos dedos a lo ancho pasan de hoja o, después de la última, agregan una. Dos dedos también acercan y mueven (`dibujo/vista.ts`).
  - "Símbolos" abre `HojaSimbolos.tsx`: búsqueda sin tildes por comienzo de palabra, "Recientes" (en el almacenamiento del navegador) y todos por categoría (lógica en `src/simbolos.ts`). El símbolo cae en el centro de lo que se ve, elegido con Mover. La captura lee los símbolos y se los pasa al editor.
  - Cada cambio se guarda como archivo por su huella (`guardarBoceto`) y sube solo al enviar. Un boceto de la versión 1 se abre como una hoja apaisada y se guarda como versión 2 al cambiarlo. En la captura, las hojas se ven de a dos (`HojasDeBoceto`).
- **Firma del cliente (`HojaDeFirma.tsx`, ADR-0024):** el campo `firma` muestra "Entregar el teléfono" y la entrega le habla a quien recibe (prop `recibe`). La constancia, en una sola pantalla y tratando de usted a quien firma, se llena con el técnico, el cliente, el sitio y el día; pide "Su nombre" (obligatorio) y "Cargo" en una fila y la firma con el dedo o el lápiz. El diálogo se llama siempre "Constancia de visita". Firmada, se ve grande con quién y cuándo (`FirmaTomada`), y "Volver a firmar" pide confirmar. Los trazos se guardan como un boceto (`guardarFirma`) y suben al enviar.
- **Chat (`Chat.tsx`, ADR-0040):** `src/conversacion.ts` lo arma (`armarChat`, `filasDelChat`, `sinLeer`) y la pantalla lo dibuja a pantalla completa, consultando cada 15 s. La fila del chat y el aviso sin señal van en el levantamiento enviado. El chat fija su destino al escribir.
- **Instalación guiada (`InstalarApp.tsx`):** en un teléfono sin la app, antes de iniciar sesión. En iPhone, los pasos de Safari y el aviso de que lo capturado en Safari no pasa a la app instalada; en Android, "Instalar la app" (`beforeinstallprompt`, guardado al cargar en `dispositivo/instalacion.ts`) o los pasos del menú. "Seguir en Safari" se recuerda.
- **Avisos push (ADR-0023):** "Avisos en este teléfono" (`TarjetaAvisos.tsx`) pide el permiso al tocar "Activar avisos" y suscribe el navegador (`dispositivo/avisos.ts`). Con el permiso dado, la suscripción se renueva al abrir la app y se quita al cerrar sesión. El service worker generado importa `public/avisos-sw.js`, que muestra el aviso y abre la app al tocarlo (solo direcciones de la propia app). Un aviso del chat abre `/?conversacion=<id>` y no se muestra si ese chat está a la vista (`dispositivo/conversacion.ts`). La app se llama "TEINS" bajo el ícono y en los avisos.
- **Fallas al dibujar:** "Algo falló al mostrar esta pantalla." con "Volver a cargar" (`CapturaDeErrores` en `src/main.tsx`); lo capturado sigue en el teléfono.

### Movimiento (`DESIGN.md`, movimiento)

La captura se carga apenas abre el inicio, y abrir una visita espera a que la captura lea lo suyo (`alMostrar`): la tarjeta de la visita se convierte en la cabecera sin pantalla de carga. Entre pasos solo se desliza lo de en medio (la raíz, con `data-direccion`); la cabecera, la barra de avance (`progreso`) y la barra inferior (`barra-paso`) se quedan por su nombre. Al enviar, el borrador se queda a la vista (`retenido`) mientras baja la hoja de confirmar, y la pantalla avanza a "Enviado". El croquis y la firma suben al abrirse y bajan al cerrarse (`useCapaQueSale`). Solo las fotos, materiales y tarjetas nuevas entran animados; "Todo subido" en verde al vaciarse la cola.

## Pruebas

- Unitarias: `repositorio.test.ts` (migraciones de Dexie, escrituras tardías, `volverABorrador`), `cifrado.test.ts`, `motor.test.ts`, `conversacion.test.ts`, `visitas.test.ts`, `catalogo.test.ts`, `simbolos.test.ts`, `mensajes.test.ts`, `fotos/verificar.test.ts` y las de `dibujo/`.
- Extremo a extremo en `e2e/pruebas/` (por ejemplo `copias-viejas.spec.ts`, `borradores.spec.ts`, `croquis.spec.ts`, `firma.spec.ts`).
- El permiso vencido se prueba en el extremo a extremo de Chromium: en un teléfono exige 7 días sin señal (`DIAS_PERMISO_LOCAL`).
