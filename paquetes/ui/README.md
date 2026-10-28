# ui

Componentes compartidos y tokens de diseño de la base visual Precisión (2026-09-29, `prototipos/base-visual`), en campo, oficina y portal. La dirección y cuándo usar cada componente están en [`DESIGN.md`](../../DESIGN.md).

- **Dependencias:** ningún otro paquete del monorepo. Iconos de Lucide (`lucide-react`, ISC), reexportados desde `src/iconos.ts`: ninguna superficie importa la biblioteca. Geist con `@fontsource-variable/geist`.
- **ADR:** 0011, 0020, 0026, 0031.
- **Pruebas:** `pnpm --filter @teins/ui test` prueba la lógica pura (`src/orden.test.ts`); los componentes se prueban desde campo, oficina y el extremo a extremo. `pnpm --filter @teins/ui typecheck`.

## Qué contiene

| Archivo | Qué es |
|---|---|
| `tokens.css` | Los tokens de color, tamaño, forma y movimiento |
| `src/tema.css` (`@teins/ui/tema.css`) | Base de todas las superficies: pesos a 600 como máximo, animaciones y View Transitions |
| `oficina.css` (`@teins/ui/oficina.css`) | Solo oficina: toma sus papeles de los tokens y tiene la escala de escritorio del prototipo |
| `src/index.ts` | Los componentes y funciones exportados (tabla de abajo) |
| `src/logo-teins.png` | El logo oficial |

`package.json` declara `sideEffects` (solo los `.css`) para que cada superficie empaquete solo lo que usa.

## Tema y tamaños

- Cada color de `tokens.css` lleva su valor claro y oscuro con `light-dark()`; lo elige `color-scheme`. Sin atributo sigue al sistema; `<html data-tema="claro|oscuro">` lo fija (`aplicarTema`, `useTema`, `temaGuardado` y `OPCIONES_DE_TEMA` en `src/tema.ts`, recordado en `localStorage` con la llave `teins-tema`). Un elemento con `data-tema="claro"` (croquis, firma, hoja del documento) se ve claro dentro del oscuro.
- Geist es la única familia de letra, también en `<code>`.
- Los tokens de tamaño son neutros (`texto-cuerpo`, `control`, `fondo`): cada superficie los redefine con `data-superficie` y los componentes no cambian.
- Los componentes compartidos llevan clases gancho (`btn`, `ins`, `aviso`, `vacio`, `capa-*`, `icono-btn`) que solo `oficina.css` pinta: en campo y en el portal no cambian.

## Componentes

| Componente | Para qué |
|---|---|
| `Logo` | El logo oficial; en oscuro, blanco por filtro. Donde está el logo no se escribe "TEINS" |
| `MarcoDeIngreso`, `CampoDeIngreso`, `claseBotonIngreso`, `SeparadorIngreso` | Inicio de sesión de las tres superficies: logo, tarjeta de borde fino, campos de 46 px y el degradado quieto. `CampoDeIngreso` acepta `mensajeError` |
| `RequisitosDeContrasena`, `validarContrasenaNueva`, `LARGO_CONTRASENA` | Contraseña nueva: los requisitos se marcan mientras se escribe y la validación usa los mismos límites que el contrato |
| `Boton`, `BotonIcono`, `claseBoton` | Variantes principal, secundaria, fantasma y peligro; tamaños normal y pequeño; `icono` opcional; `cargando` conserva el texto y el foco |
| `Dialogo`, `useModal` | Modal sobre `<dialog>`. `forma`: `centrado`, `formulario` (del alto de su contenido, con `ancho` `medio`, `ancho`, `doble` o `previa`), `lateral` (hoja de 480 px; `amplio`, 680 px), `inferior` y `hoja` (campo). `cerrable={false}` para lo que se entrega una sola vez; `focoEnElDialogo` para listas que se eligen sin abrir el teclado; `cabeceraExtra`; `volver` abre una página dentro de la misma hoja. Al quitarse deja una copia inerte que sale en 200 ms (`capa-saliendo`). `useModal` es su mecánica, reutilizada por el visor |
| `Confirmacion`, `Consecuencias` | Título en pregunta, las consecuencias en su lista (`consecuencias`), botón con el verbo. `nivel` obligatorio: `consecuencia` o `irreversible` (botón de peligro), según la tabla de `DESIGN.md`. Con consecuencias y nada que escribir, el foco empieza en la acción (↵ en oficina, «Enter» en Windows). La acción corre dentro y el error queda en el diálogo. `Consecuencias` sirve para un diálogo propio con campos |
| `HojaEnVivo` | El documento que recibe el cliente, en vivo (ADR-0031): un marco del mismo origen y sin scripts que se arma una vez; cada cambio reemplaza solo el cuerpo, destella lo que cambió y reduce la hoja para caber. `ancla` lleva a una parte; `alPintar` marca encima (lo corregido, las fichas de los planos); `estilosEnLinea` pasa los `style` del correo a CSSOM, que es lo que admite la CSP de oficina; `botones` (`encima` y `alTocar`) pregunta qué hay bajo el puntero (`elementFromPoint`), marca `vista-encima` y entrega el botón tocado |
| `ProveedorNotificaciones`, `useNotificar`, `useRetirarNotificacion` | Notificaciones de lo ya hecho, con una acción opcional que se hace una sola vez (deshacer o el siguiente paso). `useNotificar` devuelve el id para retirarla antes de tiempo. Abajo a la derecha en oficina, abajo en campo y sobre `[data-barra-inferior]`; con un diálogo modal abierto van dentro de él |
| `EncabezadoPagina`, `DestinoBarraSuperior`, `DestinoAccionesBarra` | Título, migas, estado junto al título (fuera del `h1`), una línea de datos cortos y acciones. En oficina pone la ubicación y, con `accionesEnBarra`, las acciones en la barra superior por un portal. `transicion` le da al título el nombre de la fila de la lista |
| `Tabla`, `CuerpoTabla`, `FilaTabla`, `CeldaTabla` | Tablas de oficina. `abrir` hace clicable toda la fila; `resaltada` marca lo recién creado o cambiado y lo lleva a la vista; `marcada`, la fila que se abrió por última vez; `clave` le da su nombre de transición; varios `CuerpoTabla` agrupan filas (las visitas por día) |
| `BarraLista`, `Buscador`, `PieLista`, `SinResultados`, `Marcado`, `coincide`, `normalizarTexto`, `EsqueletoLista` | Listas de oficina: pestañas y buscador en una barra, el texto que coincide resaltado (sin mayúsculas ni tildes), lo que se muestra si la búsqueda no encuentra nada, y cargando con filas |
| `Pestanas` | Pestañas subrayadas de oficina, con conteo; el subrayado se desliza a la elegida |
| `MenuAcciones` | "Más acciones" de una fila, sobre el popover del navegador |
| `Insignia` | Estados del documento (colores de ADR-0020) y de uso (activo, sin acceso, nuevo) |
| `Aviso` | Mensajes en el flujo: info, éxito, alerta, error |
| `EstadoVacio`, `EsqueletoTabla`, `EsqueletoBloques` | Vacío y cargando con la forma real |
| `ErrorDeCarga` | Lo que no se pudo cargar, con "Reintentar"; sin `reintentar` (lo que no existe), solo el texto |
| `CapturaDeErrores`, `FallaAlDibujar` | Si algo falla al dibujar, un aviso con "Volver a cargar" en vez de la pantalla en blanco (campo y portal; oficina usa `FallaAlDibujar` en su enrutador) |
| `CampoTexto`, `CampoTextoLargo`, `CampoSeleccion`, `CampoMedida`, `Casilla`, `GrupoDeOpciones`, `SelectorDeArchivo`, `MarcaNoObtenido`, `EtiquetaCampo`, `MensajeError`, `enfocarPrimerError` | Campos de formulario, con su mensaje de error por campo. `CampoTexto` acepta `sugerencias` (atajos bajo un campo libre), `ejemplo` y `seleccionarAlEnfocar`; el de contraseña tiene el ojo. `MarcaNoObtenido` separa `onMarcar` (la casilla) de `onMotivo`. `enfocarPrimerError` lleva el foco al primer campo con `aria-invalid` |
| `CampoBusqueda` | Buscar en listas que crecen sin límite |
| `BotonCopiar` | Copiar claves y códigos, con la confirmación en el mismo botón |
| `VisorFotos` | Foto a pantalla completa con anterior y siguiente; en campo, "Eliminar foto" |
| `CampoFotos`, `EditorCantidades`, `TablaCantidades`, `EditorMateriales`, `ValorLeido` | Tipos de campo de los formatos. `EditorCantidades` con `disposicion="tabla"` para oficina; `EditorMateriales` es la fila por material con − cantidad + y el catálogo como entrada principal. "Deshacer" en los dos devuelve solo la línea quitada, en su lugar. `ValorLeido` muestra un dato en modo lectura |
| `Boceto`, `ElementoDeBoceto`, `HojasDeBoceto`, `Firma` | Dibujar un boceto (con símbolos) y leerlo: sus hojas de a dos (una apaisada a lo ancho), con su nombre si hay varias y, con `alAbrir`, cada una como botón. `Firma` dibuja los trazos sin cuadrícula: recortada o, con `recortar={false}`, como el recuadro donde se firma |
| `Pastilla`, `BotonHerramienta` | La barra compacta del editor de bocetos (ADR-0026): grupos flotantes de iconos de 44 px; la herramienta elegida lleva `aria-pressed` y la superficie de marca |
| `EncabezadoDePaso`, `BarraDePaso`, `BotonSiguiente`, `BotonRedondo`, `BotonAgregar`, `ListaRecorrido`, `PasoDelRecorrido`, `FilaDeRepeticion`, `ListaDeRepeticiones`, `Repaso`, `FilaDeRepaso`, `CifrasDeRepaso`, `ListaFaltantes`, `ProcesoDeEnvio`, `FranjaSincronizacion` | La visita como recorrido en campo (`src/Recorrido.tsx`): cabecera con la barra de avance, la acción abajo al alcance del pulgar, tableros en filas, el repaso antes de enviar, lo que falta, el envío como proceso real y la franja de sincronización ("Todo subido" al vaciarse la cola) |
| `GrupoDeAjustes`, `FilaDeAjuste`, `FilaDeTema` | "Tu cuenta" de campo como lista de ajustes (`src/Ajustes.tsx`) |
| `ListaOrdenable`, `moverEnLista`, `destinoAlArrastrar` | Ordenar arrastrando, sin bibliotecas: un asa por fila; con el puntero, la fila se levanta y las demás se corren; con el teclado, Espacio, flechas y Esc |
| `etiquetaAtajo`, `etiquetaEnter`, `esAtajo`, `escribiendoEn`, `plataforma` | Atajos de teclado en Mac (⌘, ↵) y Windows («Ctrl + …», «Enter»); en Mac no toma Ctrl |
| `conTransicion`, `useLoNuevo`, `useCapaQueSale`, `nombreDeTransicion`, `useNombreEnPantalla`, `sinMovimiento` | Movimiento (`DESIGN.md`): un cambio de estado como View Transition con dirección (`adelante`, `atras`, `seccion`, `fundido`) y, si hace falta, esperando a que llegue lo nuevo; solo lo nuevo de una lista entra animado; una capa a pantalla completa que baja antes de cerrarse; nombres válidos a partir de un id, solo mientras el elemento se ve; y si la persona pidió menos movimiento |
| `useMinuto` | Vuelve a dibujar cada minuto y al volver a la pestaña: lo que depende de la hora ("En curso", "Hoy") cambia con la app abierta |
| `useSinRepetir` | Una acción asíncrona que un doble toque hace una sola vez (bloqueo síncrono); devuelve también `ocupado` |
| `useConexion` | Si el navegador tiene conexión, y vuelve a pintar al perderla o recuperarla (oficina y portal; campo tiene la suya, en `campo/src/dispositivo`) |

## Estilos propios de oficina

`oficina.css` tiene, además de la escala de escritorio: la vista en vivo y su divisor (`.vivo.con-divisor`, `.vivo.ampliada`), "Qué sale en el informe" (`.que-sale`, `.mini-f`), el menú plegado (`.app.plegado`), las filas ordenables y `tr.marcada`, la búsqueda (`dialog.paleta`, `.item-p`, `.buscar-m`) la lista de atajos (`.atajos-a`, `.tecla-a`) y una advertencia dentro del texto (`.alerta-fuerte`).

## Movimiento en `tema.css`

Hojas de campo que entran desde el borde (`animate-hoja-entra`, `--t-duracion-hoja`, `--t-curva-hoja`, velo que se funde), páginas dentro de una hoja (`animate-pagina-adelante` y `-atras`), pasos de 24 px con fundido, pasar de hoja y el anillo de enderezar del croquis, las salidas de capas y las View Transitions con nombre. El resaltado de lo nuevo dura 1,2 s. Las duraciones y curvas están en `DESIGN.md`.
