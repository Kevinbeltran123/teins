# DESIGN.md · Precisión

Dirección visual de TEINS: **Precisión** desde el 2026-09-29, en campo, oficina y portal. Antes fueron Consola (iteración 14) y Recorrido (iteraciones 22 y 23). Todo trabajo de interfaz parte de este archivo y pasa después por el filtro antislop (ver `AGENTS.md`). Los valores de código viven en [`paquetes/ui/tokens.css`](paquetes/ui/tokens.css) y los componentes en [`paquetes/ui`](paquetes/ui/README.md); este archivo explica qué son y por qué.

Prototipo de referencia: `prototipos/base-visual/prototipo.html` (https://claude.ai/artifact/MkRSHwecL2gXCZQ8zfHCrY). Sus bloques `.app[data-tema=…]` son los valores de los tokens; sus seis pantallas (bandeja, detalle con confirmación, cotización, inicio de sesión y dos de campo) son la referencia visual. Cada pantalla de la app se compara con él en capturas del mismo tamaño.

## Lectura del diseño

Herramienta de trabajo para técnicos de Transporte de Datos y Transporte de Energía y su oficina. Precisa y sobria, como el software profesional que la gente de oficina ya usa: el contenido manda, la interfaz se retira y el color se reserva para la acción y el estado.

**Niveles:** ENERGÍA 1 · RITMO 2 · MOVIMIENTO 2.

**Por qué cambió (2026-09-29):** Kevin dijo que la app "parece de juguete". Recorrido tenía pesos de 800, radios de 20 a 28 px, campos rellenos y amarillo en todo lo actual. Se compararon tres bases en un prototipo y eligió Precisión.

## Identidad Precisión

- **Color.** Grises fríos casi neutros y el azul de TEINS solo en la acción principal, lo seleccionado y el foco. Los estados llevan su propio tono, siempre con texto. Nada de amarillo: el foco es azul.
- **Tipografía.** Una sola familia, Geist (variable), con pesos de 400 a 600. Títulos con interletrado de -0,02 em. Cifras tabulares siempre.
- **Forma.** Radios de 7 a 12 px, bordes y divisiones de 1 px, capas sutiles. Los controles se delimitan con un borde fino (una sombra interior de 1 px), no con relleno.
- **Iconos.** Lucide con trazo de 1,6, de 16 px en oficina.
- **Tema.** Claro, oscuro y del sistema, con un selector en la cuenta que se recuerda en el equipo. Por omisión, el del sistema. Lo que se dibuja o se firma (croquis, firma, hoja del PDF) va siempre en papel claro (`data-tema="claro"`).
- **Confirmaciones sin icono.** El título es la pregunta con el verbo; debajo, una lista con borde de las consecuencias concretas (cada una con su icono y una línea secundaria); el pie, un escalón más oscuro, con "Cancelar" y la acción, y los atajos Esc y ↵ en oficina.
- **Inicio de sesión.** El logo arriba, "Ingresar" y una tarjeta de 400 px con borde fino, campos de 46 px, "¿La olvidó?" junto a la etiqueta y la llave de acceso como alternativa bajo un separador "o". Debajo de la tarjeta, "¿Problemas para entrar? Hable con administración." Al fondo, un degradado vertical quieto con los azules de TEINS en la mitad de abajo. Nada se mueve.

## Estructura que se conserva

Precisión cambia la piel, no el orden de las pantallas. Se conserva lo que se decidió con Recorrido:

- **Campo, la visita como recorrido.** Cada sección del formato es un paso (regla 6): arriba, "Paso N de M" con la barra de avance; abajo, fija, "Siguiente: …". Lo repetido son tarjetas con su estado; se revisa antes de enviar; el enviado muestra la cola de subida real. Componentes en `paquetes/ui/src/Recorrido.tsx`.
- **Oficina, la página es la superficie.** Se agrupa con espacio, títulos y líneas finas; solo flota lo que es una capa (hojas, confirmaciones, menús, notificaciones) o un objeto (una foto, un croquis, una firma). El encabezado resume en una línea de datos cortos. Las listas: pestañas subrayadas con su contador y el buscador en la misma barra. Los documentos: el contenido a la izquierda y un carril a la derecha. Los que recibe el cliente (cotización, informe) cambian el carril por la hoja en vivo (iteración 26, `prototipos/vista-en-vivo`): el editor a la izquierda y el documento a la derecha, a todo el alto y cada uno con su desplazamiento; las acciones van en la barra superior y las versiones publicadas al final del editor. Bajo 1280 px la hoja no cabe al lado: "Vista previa" la abre en una hoja lateral ancha.
- **Movimiento.** En campo todo es CSS (regla 10): pasos con View Transitions, hojas que suben, el chulo que se dibuja. Con movimiento reducido, nada se mueve.

## Color

Valores en `paquetes/ui/tokens.css`. Cada token lleva su valor claro y oscuro con `light-dark()`: el tema lo decide `color-scheme`, así que una isla `data-tema="claro"` dentro del oscuro se ve clara sin repetir la paleta.

| Papel | Claro | Oscuro | Uso |
|---|---|---|---|
| Fondo | `#FAFAFB` | `#0A0B0D` | La página |
| Superficie | `#FFFFFF` | `#111316` | Tablas, tarjetas, diálogos, campos |
| Superficie 2 | `#F3F4F6` | `#17191D` | Fila al pasar, elemento activo del menú, pies de diálogo |
| Superficie 3 | `#E9EBEF` | `#1E2126` | Avatares, pistas de segmentos y barras de avance |
| Línea / línea fuerte | `#E5E7EB` / `#D5D8DE` | `#23262C` / `#2E323A` | Divisiones / bordes de controles |
| Texto / secundario / terciario | `#111317` / `#5E646E` / `#6F7580` | `#EDEEF0` / `#8B9099` / `#7C828C` | |
| Marca (acción) | `#2F5FE8` | `#3B6FF5` | Acción principal, selección, foco. Texto blanco |
| Hecho / pendiente / peligro / revisión | `#188A5B` / `#A15C00` / `#D22F34` / `#6B4FD3` | `#3DBE8B` / `#E8A33D` / `#E5484D` / `#A38BFA` | Estados y avisos |

**Estados del documento** (iguales para toda organización, ADR-0020), como insignias de 22 px: un punto y el texto del color del estado sobre ese color al 12 %. Borrador en gris, Enviado y Publicado en la marca, En revisión en violeta, Revisado en verde, Anulado en rojo. Cada estado lleva siempre su **texto**; el color nunca es la única señal.

## Tipografía

**Una sola familia en toda la interfaz: Geist** (variable, alojada localmente con `@fontsource-variable/geist` para funcionar sin conexión). Nunca dos familias en la misma pantalla; claves y códigos también van en Geist, con `tabular-nums` y espacio entre letras. Pesos: 400 texto, 500 etiquetas, pestañas y botones, 600 títulos.

| Nivel | Oficina | Campo |
|---|---|---|
| Título de pantalla | 22, 600 | 26, 600 |
| Título de sección o panel | 13, 500, secundario | 20, 600 |
| Texto, pestañas, botones | 13 a 14 | 14 a 16 |
| Ayuda, encabezados de tabla, contadores | 12 | 13 |
| Cifra de un total | 18, 600 | 18, 600 |

## Forma y espacio

- Base de 4 px.
- Radios: 7 px en botones y campos de oficina, 10 px en paneles y listas de consecuencias, 12 px en diálogos; en campo, 12 a 16 px en tarjetas y botones grandes.
- **Sombras solo en capas** (diálogos, hojas, menús, notificaciones) y una sombra de 1 px bajo los botones. El único degradado es el del inicio de sesión.
- Alto de controles: en oficina 32 px (40 px el grande); en el inicio de sesión 46 px; en campo 50 px el botón de la barra de abajo y 40 px los demás. Ninguna zona táctil de campo mide menos de 44 px.
- Oficina: menú lateral de 208 px con el logo arriba y la cuenta abajo, barra superior de 48 px con la ruta, filas de tabla de 44 px.

## La regla: todo se justifica

Cada elemento de una pantalla responde a una pregunta: **¿qué decisión o acción de la persona ayuda?** Si no hay respuesta, no va.

- Un dato se muestra si alguien lo usa para decidir o actuar aquí. Lo que solo "podría interesar" va en el detalle, no en la lista.
- Un texto de ayuda se escribe donde evita un error (antes de algo que no se deshace), no como introducción de la pantalla.
- Un filtro, un buscador o un conteo existen cuando la lista crece sin límite o cuando la persona busca algo puntual en ella.
- Una acción se ve solo donde se usa. Si se repite en cada fila, la principal queda a la vista y las demás van en "Más acciones".
- Nada decorativo: sin ilustraciones, sin cifras de relleno, sin íconos que no ayuden a reconocer algo.

## Jerarquía

**Oficina.** El menú lateral son las secciones. El título de la pantalla (el `h1`, lo más grande después de la cifra focal) es **la sección elegida en el menú**; las pestañas son sus subsecciones, más pequeñas. En un detalle, el título es lo que se está viendo y unas migas llevan al nivel superior ("Levantamientos", "Informes"); el estado va junto al título.

Los tamaños y pesos de cada nivel están en "Tipografía".

**Una acción principal por región.** La de la pantalla va a la derecha del encabezado ("Nuevo cliente", "Programar visita"); la de un panel, al final del panel; la de un diálogo, al final del pie, a la derecha, con "Cancelar" a su izquierda. En campo, la acción de la pantalla va abajo, en una barra fija, al alcance del pulgar.

## Componentes y cuándo usarlos

Todos viven en `paquetes/ui`; ninguna pantalla define colores ni estilos propios (regla 11).

| Componente | Cuándo |
|---|---|
| `Boton` principal | La acción que la región existe para hacer. Una por región |
| `Boton` secundaria | Las demás acciones de la región |
| `Boton` fantasma | Acciones repetidas en filas y listas, para que no compitan con el contenido |
| `Boton` peligro | Solo el botón que confirma lo que no se deshace, dentro de una confirmación |
| `BotonIcono` | Acciones conocidas y repetidas (más acciones, subir, bajar, cerrar, quitar). Lleva nombre accesible y ayuda al pasar el cursor |
| `MenuAcciones` | "Más acciones" de una fila: una acción queda a la vista y el resto va aquí; lo que corta un acceso va al final, en rojo |
| `Tabla` | Listas de oficina. Toda la fila abre el detalle cuando lo hay; el primer dato es un enlace real para el teclado |
| `Insignia` | Estados: una o dos palabras con su color |
| `Aviso` | Algo que la persona debe leer y quizá resolver, junto a lo que lo causó. Los errores van siempre aquí, nunca en una notificación |
| Notificación (`useNotificar`) | Confirma algo ya hecho y no exige respuesta: "Cliente creado", "Foto eliminada · Deshacer". 5 s, 10 s con acción. La acción es texto, sin borde (iteración 29) |
| `Dialogo` centrado | Confirmaciones y lo que se entrega una sola vez |
| `Dialogo` de formulario (`forma="formulario"`) | Crear o editar algo corto en oficina (iteración 29): centrado, del alto de su contenido, con su equis. `ancho`: 480 (por omisión), 560 (`ancho`, dos columnas de campos), 880 (`doble`, Programar visita) o 1040 (`previa`, con la vista previa al lado) |
| `Dialogo` lateral | Crear o editar algo largo, o lo que se arma mirando la lista: Nuevo cliente, Nueva cotización, Importar |
| `Dialogo` inferior | Confirmaciones en campo, al alcance del pulgar |
| `Confirmacion` | Lo que tiene consecuencias (ver abajo) |
| `EstadoVacio` | Lista sin nada: qué aparecerá y cómo llega |
| `EsqueletoTabla`, `EsqueletoBloques` | Cargando, con la forma de lo que viene |
| `VisorFotos` | Una foto a pantalla completa; en campo, con "Eliminar foto" |
| `Pastilla` y `BotonHerramienta` | La barra del editor de bocetos, como GoodNotes: iconos sin texto, la herramienta elegida con la superficie de marca |
| `HojasDeBoceto` | Leer un boceto (captura, revisión): las hojas de a dos, cada una con su nombre si hay varias |
| `BotonCopiar` | Claves y códigos que se entregan o se guardan |
| `HojaEnVivo` | El documento que recibe el cliente, mientras se escribe (ADR-0031): siempre en papel claro, con la advertencia "Vista previa: el PDF puede partir las páginas distinto". En la revisión, lo corregido va resaltado con el valor anterior; ese azul no sale en el PDF |

## Qué se confirma y qué se deshace

Confirmar lo que se hace a menudo entrena a aceptar sin leer. Por eso hay tres niveles:

| Nivel | Ejemplos | Cómo |
|---|---|---|
| Se deshace fácil | Quitar una foto, una línea de cantidades o un material, una sección repetida (un tablero); desactivar un ítem del catálogo; marcar "No se pudo obtener" | Se hace al instante y la notificación ofrece "Deshacer". En el croquis, el "Deshacer" de su barra |
| Tiene consecuencias | Restablecer una contraseña, dar o quitar administración, marcar revisado, tomar una revisión ajena, quitar una llave, quitar un contacto, enviar a otro contacto, enviar a oficina, cerrar sesión con envíos pendientes, volver a firmar, salir con cambios sin guardar | `Confirmacion`: el título es una pregunta con el verbo ("¿Desactivar a Juan Pérez?"), las consecuencias concretas en su lista (`consecuencias`), el botón repite el verbo. Si no hay nada que escribir, la acción recibe el foco y en oficina se confirma con ↵ |
| No se deshace | Publicar un informe o una cotización, retirar una versión, cancelar una visita, regenerar un acceso, desactivar un usuario (ordena borrar los datos de su teléfono) | Igual, con el botón de peligro, el motivo escrito cuando queda en el registro y el foco en "Cancelar": nunca es la acción predeterminada, y no lleva ↵ |

En el código, `Confirmacion` exige `nivel`: `consecuencia` o `irreversible` (botón de peligro). Lo que se deshace fácil no usa `Confirmacion`.

Los formularios con cambios sin guardar avisan antes de salir (`useSalidaProtegida` en oficina), con "Guardar y salir" como acción principal y "Salir sin guardar" a la izquierda, en rojo; el pie va en una sola fila de 480 px y el atajo (↵) solo en la acción principal.

Lo que se hace en una hoja lateral (reasignar técnicos, reprogramar, importar) no lleva un segundo diálogo: la hoja ya es el paso deliberado, y dice antes del botón qué va a pasar ("Juan Pérez deja de verla en su teléfono"); el botón lo repite con el nombre ("Reasignar a María Gómez").

Corregir un dato exige el motivo: queda en el historial junto al valor anterior. En los formularios, cada campo dice qué le falta, el foco va al primero con error y los de correo y teléfono abren su teclado.

En campo, el botón atrás del teléfono hace lo que la flecha de la pantalla; en el inicio, sale de la app.

## Crear y editar

- En oficina, un formulario de hasta unos cuatro campos que no necesita ver la lista (nuevo ítem, precio, sitio, contacto, usuario, contraseña) va en un **diálogo centrado del alto de su contenido**; la hoja lateral queda para lo largo o lo que se arma mirando la lista (iteración 29: la hoja a todo el alto para tres campos dejaba media pantalla en blanco). Un formulario se ve entero al abrirse, sin bajar: si no cabe en una columna, va en dos (Programar visita).
- Al guardar, la capa se cierra, lo nuevo aparece **primero** en la lista con un tinte de la marca al 8 % que se va en 1,2 s, sin barra ni negrita, y una notificación lo confirma. Con movimiento reducido, el tinte queda fijo.
- Un campo que se escribe libre (la unidad del catálogo) puede ofrecer debajo, como atajos pequeños, los valores que ya se usan; nunca limita lo que se escribe.
- Ninguna fecha ni hora se elige con el control del navegador en oficina: van en selectores propios (calendario y rejilla de horas), que siguen los tokens.
- Un panel del carril no lleva botones estirados a todo su ancho: la acción de la pantalla va en la barra superior ("Marcar revisado", "Publicar") y el panel dice el estado en una línea.
- Los formularios de creación nunca quedan abiertos encima de las listas.
- Validar al enviar: cada campo con su mensaje, no un mensaje general.

## Lo que se entrega una sola vez

Contraseñas temporales y accesos de clientes (QR y clave) se muestran en un diálogo que no se cierra con Esc ni con un clic fuera. Arriba, que solo se muestra esta vez; la clave en grande con "Copiar"; el QR con su código escrito debajo y "Descargar"; los pasos para entregarlos por medios distintos; y una sola salida, "Ya la entregué". Nunca se ofrece enviar contraseñas por correo.

## Segundo factor

Cuatro pasos numerados en una misma pantalla: confirmar la contraseña; escanear el QR (con "¿No puede escanearlo?", que muestra la clave en bloques de cuatro con "Copiar"); escribir el código en un solo campo que acepta autocompletar y pegar; y guardar los códigos de respaldo ("Descargar" o "Copiar") antes de "Ya los guardé".

## Permisos del teléfono y avisos

- **Un permiso se pide solo al tocar un botón que dice para qué es** ("Activar avisos"), nunca al abrir la app: iPhone lo exige y una pregunta sin contexto se rechaza.
- **La propuesta va una vez, bajo el punto focal y con botón secundario,** con "Ahora no", que se recuerda en ese teléfono. Rechazado el permiso, la app ya no puede volver a preguntar: el diagnóstico dice cómo permitirlo en los ajustes.
- **Los avisos no llevan datos del cliente:** se leen con el teléfono bloqueado. Dicen qué pasó y cuándo ("Visita nueva · Para el jue 3 oct"); el cliente y el sitio se ven al abrirlos. La app se llama "TEINS" bajo el ícono y en los avisos.
- **La instalación va antes de iniciar sesión** en un teléfono que no tiene la app: en iPhone, lo capturado en Safari no pasa a la app instalada.

## Punto focal por pantalla

| Pantalla | Punto focal |
|---|---|
| Campo · Mis visitas | La siguiente visita, en la primera tarjeta, con la fecha grande y la única acción principal |
| Campo · Captura | El dato que se está llenando, con el anillo azul del foco, y la barra de envío abajo |
| Campo · Boceto | La hoja, en toda la pantalla: una barra de iconos arriba y, abajo, la hoja en que se está |
| Oficina · Levantamientos | "Esperando revisión": cuántos hay, el que más lleva esperando y "Tomar para revisar" |
| Oficina · Visitas | Las próximas visitas, empezando por las de hoy y por hora, con "Programar visita"; las que siguen abiertas, "En curso" |
| Oficina · Mi cuenta | Una columna de 680 px centrada: cada fila con su icono, nombre, estado y una acción secundaria; ninguna es principal |
| Oficina · Administración | La tabla de la pestaña elegida; al crear una credencial, el diálogo que la entrega |
| Portal | El informe más reciente y su "Descargar" |

Todo lo demás en la pantalla es visiblemente secundario.

## Movimiento

Cada animación tiene un propósito escrito. Desde la iteración 27 (`prototipos/flujos/`), cuatro reglas:

1. **Lo que cambia se queda en su sitio y se transforma.** Un estado que pasa de "Enviado" a "En revisión" cambia ahí; la tarjeta de la visita se convierte en la cabecera de la captura; el título de la fila, en el del detalle.
2. **Lo que entra o sale se ve entrar o salir.** Un diálogo, una hoja o una notificación también salen (200 ms); una fila nueva entra arriba y las demás se corren; la que se cancela se cierra.
3. **Solo lo nuevo se anima.** Lo que ya estaba no vuelve a entrar al volver a una pantalla o a una pestaña (`useLoNuevo`).
4. **Cada acción termina diciendo qué pasó y qué sigue:** la notificación lleva el siguiente paso ("Agregar contactos", "Ver en Canceladas") y los flujos en serie ofrecen el siguiente ("Siguiente: …", "Ver la siguiente visita").

**Cómo:** View Transitions en las dos superficies (`conTransicion` en `paquetes/ui`; el enrutador de oficina con `defaultViewTransition`). El navegador toma una foto antes y otra después y anima solo lo que tiene `view-transition-name`; la página no se mueve. Sin soporte, el cambio es instantáneo. **Sin Motion:** el movimiento es CSS en `campo` y en `oficina`; el JavaScript solo dice cuándo empieza una transición.

| Momento | Movimiento | Propósito |
|---|---|---|
| Cambiar de sección (oficina) | El contenido se desvanece y el nuevo sube 8 px; el menú y la barra no se mueven | Que la ubicación cambie sin perder el marco |
| Abrir un detalle desde la lista | El título de la fila se convierte en el del detalle | Saber qué se abrió |
| Siguiente levantamiento de la serie | El cuerpo se desliza; el carril de la revisión se queda | Revisar en serie sin volver a la lista |
| Pasar de paso (campo) | Solo se desliza el cuerpo; la cabecera y la barra se quedan y la barra de avance crece | Mostrar hacia dónde se fue sin mover lo que no cambia |
| Abrir una visita (campo) | La tarjeta de la visita se convierte en la cabecera de la captura | Que la captura salga de la visita |
| Estado que cambia en su lugar | La pastilla pasa de un estado al otro; el dato corregido destella | Ver qué cambió sin buscarlo |
| Diálogo o menú | Aparece con un leve desplazamiento; al cerrarse sale igual (200 ms) | Mostrar de dónde viene y a dónde se va la capa |
| Hoja lateral | Entra desde la derecha y sale hacia ella | Mostrar que la lista sigue detrás |
| Croquis y firma | Suben al abrirse y bajan al cerrarse | Que se lean como capas encima de la captura |
| Notificación | Sube al llegar y baja al irse | Que no desaparezca de golpe |
| Lo recién creado | Entra arriba resaltado; el resaltado se desvanece | Encontrarlo sin buscarlo |
| Lo que cambia en la hoja en vivo | Destello azul que se desvanece | Ver dónde cayó lo que se escribió |
| Pestañas | El subrayado se desliza a la elegida | Ver de dónde a dónde se cambió |
| Avance de un proceso (publicar, enviar) | Cada paso se marca con un chulo que se dibuja cuando se cumple a la vista | Decir el estado real, paso a paso |
| Cargando | Esqueleto con la forma real | Evitar saltos |
| Error de validación | Sacudida corta del campo | Señalar dónde está |
| Trabajando | Giro del icono en el botón | Mostrar que la acción corre |
| Pasar de hoja (boceto) | La hoja entra desde su lado | Mostrar hacia dónde se fue |
| Dedo quieto al dibujar | Un anillo que se llena en medio segundo | Avisar que el trazo se va a enderezar |

**Qué se mueve:** con dirección (`adelante`, `atras`, `seccion`, `fundido`) se mueve lo que se ve en la ventana, menos lo que tiene nombre propio; la foto es del tamaño de la ventana, nunca del documento entero, para que una lista larga o un levantamiento con fotos no congelen la transición (en el iPhone sí lo harían). Se quedan quietos por su nombre: `menu` y `barra-oficina` (oficina), `barra-paso` y `progreso` (campo) y `carril` (la revisión). Van de su lugar al nuevo, por elemento: `visita-<id>`, `lev-<id>`, `estado-<id>`, `nombre-<id>`, `fila-<id>` e `indicador-<id>` (`nombreDeTransicion`). Las filas de una lista larga llevan su nombre solo mientras se ven (`useNombreEnPantalla`). Un nombre se repite en una pantalla solo si es el mismo elemento.

**Duraciones:** 120 ms (pulsación), 200 ms (capas y salidas), 280 ms (pantallas y hojas), 1,2 s (resaltado, desde la iteración 29). **Curva:** `cubic-bezier(0.2, 0, 0, 1)`. **Con `prefers-reduced-motion`, nada se mueve:** los cambios son instantáneos, las capas se quitan sin salir y lo resaltado queda fijo.

## Iconos

Una sola familia: **Lucide**, exportada desde `@teins/ui` (ninguna superficie importa la biblioteca). Un icono va solo cuando ayuda a reconocer algo de un vistazo: secciones del menú, acciones repetidas, tono de un aviso. Nunca emojis.

## Textos

- Español de Colombia, con el vocabulario de TEINS: *levantamiento*, *visita*, *Transporte de Datos*, *Transporte de Energía*, *Energía Solar*. Campo tutea; oficina y portal tratan de usted.
- **Sin raya larga (—)** en textos de interfaz.
- Acciones con verbo y objeto: "Tomar para revisar", "Nuevo cliente", "Desactivar usuario". Nunca "Aceptar", "Sí" ni "Ver más".
- Notificaciones en participio: "Cliente creado", "Visita programada".
- Nada inventado: cifras, nombres y logos faltantes se muestran como marcadores explícitos (`[N]`, `[LOGO]`).

## Estados obligatorios

Toda vista con datos diseña **vacío, cargando, error y sin conexión**. En campo, además: **pendiente de enviar** y **enviando**.

## Nombre público y logo

- **El producto se llama "TEINS"**, sin más. Campo, oficina y portal son nombres internos de la arquitectura: nunca se muestran (títulos, `<title>`, etiquetas accesibles, nombres de archivo, correos).
- **Donde va la marca va el logo oficial** (`paquetes/ui/src/logo-teins.png`, PNG transparente de 292 × 90: los anillos azules, "teins" y la razón social): inicio de sesión, menú de oficina y PDF. No se escribe "TEINS" al lado del logo ni se repite en la misma pantalla.
- En el tema oscuro, el logo se pinta en blanco con un filtro (`--t-filtro-logo`).
- **Pendiente:** de TEINS, el logo en vector y su versión en negativo.
