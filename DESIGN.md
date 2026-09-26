# DESIGN.md · Consola

Dirección visual de TEINS desde la iteración 14. Todo trabajo de interfaz parte de este archivo y pasa después por el filtro antislop (ver `AGENTS.md`). Los valores de código viven en [`paquetes/ui/tokens.css`](paquetes/ui/tokens.css) y los componentes en [`paquetes/ui`](paquetes/ui/README.md); este archivo explica qué son y por qué.

Lienzo de referencia: https://claude.ai/artifact/A77tYXi713xNbTMacNzM8v (privado), página "v0.3 · Direcciones", dirección A. La página "v0.2 · Marquilla" guarda la dirección anterior.

## Lectura del diseño

Herramienta de trabajo para técnicos de Transporte de Datos y Transporte de Energía y su oficina. Calmada y clara: el contenido manda y la interfaz se retira. Se parece a las consolas que la gente de oficina ya conoce (menú lateral, tablas, diálogos), y en campo prioriza la lectura bajo el sol y el pulgar.

**Niveles:** ENERGÍA 1 · RITMO 2 · MOVIMIENTO 2.

**Por qué cambió (iteración 14):** la dirección Marquilla dejaba botones de tamaños distintos, confirmaciones metidas en filas, resultados lejos de la acción que los producía y ninguna capa (diálogo, menú, notificación). Se compararon tres direcciones en el lienzo y se eligió Consola.

## La regla: todo se justifica

Cada elemento de una pantalla responde a una pregunta: **¿qué decisión o acción de la persona ayuda?** Si no hay respuesta, no va.

- Un dato se muestra si alguien lo usa para decidir o actuar aquí. Lo que solo "podría interesar" va en el detalle, no en la lista.
- Un texto de ayuda se escribe donde evita un error (antes de algo que no se deshace), no como introducción de la pantalla.
- Un filtro, un buscador o un conteo existen cuando la lista crece sin límite o cuando la persona busca algo puntual en ella.
- Una acción se ve solo donde se usa. Si se repite en cada fila, la principal queda a la vista y las demás van en "Más acciones".
- Nada decorativo: sin ilustraciones, sin cifras de relleno, sin íconos que no ayuden a reconocer algo.

## Jerarquía

**Oficina.** El menú lateral son las secciones. El título de la pantalla (el `h1`, lo más grande después de la cifra focal) es **la sección elegida en el menú**; las pestañas son sus subsecciones, más pequeñas. En un detalle, el título es lo que se está viendo y unas migas llevan al nivel superior ("Levantamientos", "Informes"); el estado va junto al título.

| Nivel | Oficina | Campo |
|---|---|---|
| Título de pantalla | 28, 800 | 26, 800 |
| Subtítulo de sección o panel | 18, 800 | 21, 800 |
| Texto, etiquetas, pestañas | 15 (etiquetas 700) | 17 (etiquetas 700) |
| Ayuda, migas, encabezados de tabla | 13 | 15 |
| Cifra focal | 56 | 44 |

**Una acción principal por región.** La de la pantalla va a la derecha del encabezado ("Nuevo cliente", "Programar visita"); la de un panel, al final del panel; la de un diálogo, al final del pie, a la derecha, con "Cancelar" a su izquierda. En campo, la acción de la pantalla va abajo, en una barra fija, al alcance del pulgar.

## Color

Paleta del logo de TEINS con un acento de señal.

| Token | Valor | Uso |
|---|---|---|
| Superficie de marca | `#002B81` | Acción principal, selección, sección activa del menú, bordes de campos activos |
| Superficie suave | marca al 10 % | Fondo del elemento activo (menú, paso actual, icono de diálogo) |
| Acento señal | `#FFC21A` | **Solo** foco, resaltado de lo recién creado e insignia "Nuevo". Ya no pinta botones |
| Fondo | `#F5F6F8` | Fondo de oficina, campo y portal |
| Panel | `#FFFFFF` | Tablas, paneles, diálogos |
| Panel hundido | `#F8F9FB` | Encabezados de tabla y pies de diálogo |
| Texto | `#15171A` | Texto principal |
| Texto secundario | `#525152` | Gris del logo: 7,9:1 sobre blanco, sirve en campo |
| División | `#E1E4EA` | Líneas y bordes de paneles |
| Borde suave | `#C9CED8` | Botones secundarios (su texto ya los identifica) |
| Borde de control | `#8C93A3` | Campos de texto: 3:1 sobre blanco, porque el borde es lo único que los delimita |
| Peligro | `#B42318` | Solo el botón que confirma algo que no se deshace |

Éxito, alerta y peligro tienen un fondo teñido para avisos e insignias. En un aviso el texto va siempre en el color de texto (7:1 sobre el fondo teñido) y el tono lo lleva el icono; el texto de color solo va en insignias (palabras cortas en negrita, 6:1 o más).

**Estados del documento** (iguales para toda organización, ADR-0020), como insignias:

| Estado | Fondo | Texto |
|---|---|---|
| Borrador | superficie pista | blanco |
| Enviado | `#E3ECFA` | `#1C4E9E` |
| En revisión | `#EEE6F7` | `#5B2E91` |
| Revisado | `#DDF1EB` | `#0B5E50` |
| Publicado | superficie de marca | blanco |
| Anulado | `#F8E0E4` | `#8E1D33` |

Cada estado lleva siempre su **texto**; el color nunca es la única señal. Mínimo en campo: **7:1** para texto corrido. En oficina: 4,5:1 (WCAG AA).

## Tipografía

**Una sola familia en toda la interfaz: Atkinson Hyperlegible Next** (variable, 400 a 800). Nunca dos familias en la misma pantalla. Distingue 0/O y 1/I/l, así que sirve también para códigos y claves. La jerarquía sale del tamaño y el grosor (tabla de Jerarquía). Se aloja localmente para funcionar sin conexión. Cifras siempre con `font-variant-numeric: tabular-nums`. Claves y códigos que se dictan se muestran en bloques de cuatro con espacio entre letras.

## Forma y espacio

- Base de 4 px.
- Radio 8 px en controles, 12 px en paneles, 16 px en diálogos.
- **Sombras solo en capas** (diálogos, hojas, menús, notificaciones). **Sin degradados. Sin fondos de cuadrícula.**
- Alto de controles: en oficina 40 px normal y 32 px pequeño (filas, barras de herramientas); en campo 58 px normal y 44 px pequeño. Zonas táctiles de campo: mínimo 58 px.
- Oficina: menú lateral de 248 px (se reduce a iconos bajo 1024 px) y contenido de hasta 1200 px; los detalles usan dos columnas, contenido y panel lateral fijo con el estado y la acción.

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
| Notificación (`useNotificar`) | Confirma algo ya hecho y no exige respuesta: "Cliente creado", "Foto eliminada · Deshacer". 5 s, 10 s con acción |
| `Dialogo` centrado | Confirmaciones y lo que se entrega una sola vez |
| `Dialogo` lateral | Crear o editar en oficina: la lista sigue visible detrás |
| `Dialogo` inferior | Confirmaciones en campo, al alcance del pulgar |
| `Confirmacion` | Lo que tiene consecuencias (ver abajo) |
| `EstadoVacio` | Lista sin nada: qué aparecerá y cómo llega |
| `EsqueletoTabla`, `EsqueletoBloques` | Cargando, con la forma de lo que viene |
| `VisorFotos` | Una foto a pantalla completa; en campo, con "Eliminar foto" |
| `BotonCopiar` | Claves y códigos que se entregan o se guardan |

## Qué se confirma y qué se deshace

Confirmar lo que se hace a menudo entrena a aceptar sin leer. Por eso hay tres niveles:

| Nivel | Ejemplos | Cómo |
|---|---|---|
| Se deshace fácil | Quitar una foto, una línea de cantidades | Se hace al instante y la notificación ofrece "Deshacer" |
| Tiene consecuencias | Desactivar un usuario, restablecer una contraseña, dar o quitar administración, desactivar un ítem, marcar revisado, tomar una revisión ajena, quitar una llave, quitar una sección repetida, enviar a oficina, cerrar sesión con envíos pendientes, volver a firmar | `Confirmacion`: el título es una pregunta con el verbo ("¿Desactivar a Juan Pérez?"), el cuerpo dice la consecuencia, el botón repite el verbo. "Cancelar" recibe el foco |
| No se deshace | Publicar un informe, retirar una versión, cancelar una visita, regenerar un acceso | Igual, con el botón de peligro, y el motivo escrito cuando queda en el registro |

Los formularios con cambios sin guardar avisan antes de salir.

## Crear y editar

- En oficina, "Nuevo…" abre una **hoja lateral**. Al guardar, la hoja se cierra, lo nuevo aparece **primero** en la lista, resaltado en amarillo que se desvanece en unos 2 s, y una notificación lo confirma. Con movimiento reducido, el resaltado queda fijo.
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
| Campo · Captura | El dato que se está llenando, con el halo amarillo del foco, y la barra de envío abajo |
| Oficina · Levantamientos | "Esperando revisión": cuántos hay, el que más lleva esperando y "Tomar para revisar" |
| Oficina · Visitas | Las próximas visitas, empezando por las de hoy, con "Programar visita" |
| Oficina · Administración | La tabla de la pestaña elegida; al crear una credencial, el diálogo que la entrega |
| Portal | El informe más reciente y su "Descargar" |

Todo lo demás en la pantalla es visiblemente secundario.

## Movimiento

Cada animación tiene un propósito escrito. En `campo` **todo el movimiento es CSS** (cero JavaScript de animación); Motion solo se usa en `oficina`.

| Momento | Movimiento | Propósito |
|---|---|---|
| Diálogo o menú que se abre | Aparece con un leve desplazamiento | Mostrar de dónde viene la capa |
| Hoja lateral | Entra desde la derecha | Mostrar que la lista sigue detrás |
| Lo recién creado | Resaltado amarillo que se desvanece | Encontrarlo sin buscarlo |
| Cargando | Esqueleto con la forma real | Evitar saltos |
| Error de validación | Sacudida corta del campo | Señalar dónde está |
| Trabajando | Giro del icono en el botón | Mostrar que la acción corre |

**Duraciones:** 120 ms (pulsación), 200 ms (capas), 280 ms (hojas), 2,4 s (resaltado). **Curva:** `cubic-bezier(0.2, 0, 0, 1)`. Con `prefers-reduced-motion`, todo se desactiva.

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

## Logo

- A color (`#002B81`, `#1773B0`, `#76AADB`, gris `#525152`) sobre fondos claros: con la dirección Consola, todas las superficies son claras.
- **Pendiente:** obtener de TEINS el logo en vector. Mientras tanto, la palabra "TEINS" en la superficie de marca.
