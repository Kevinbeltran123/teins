# ui

Componentes compartidos y tokens de diseño: dirección Consola en el portal (iteración 14) e identidad Recorrido en campo (iteración 22, `[data-superficie="campo"]` en `tokens.css`) y en oficina (iteración 23, `[data-superficie="oficina"]` y `oficina.css`). Ver `DESIGN.md`.

**Oficina (iteración 23):** `oficina.css` es el CSS del prototipo aprobado (`prototipos/oficina`), importado solo por oficina (`@teins/ui/oficina.css`). Los componentes compartidos llevan clases gancho (`btn`, `ins`, `aviso`, `vacio`, `capa-*`, `icono-btn`) que solo esa hoja pinta: en campo y en el portal no cambian.

**Dependencias:** No depende de ningún otro paquete del monorepo. Iconos de Lucide (`lucide-react`, ISC), reexportados desde `src/iconos.ts`: ninguna superficie importa la biblioteca. `sideEffects` declarado para que cada superficie empaquete solo lo que usa.

**ADR relevantes:** 0011, 0020

Los tokens de tamaño son neutros (`texto-cuerpo`, `control`, `fondo`): cada superficie los redefine con `data-superficie` y los componentes no cambian. Una sola familia de letra en toda la interfaz (DESIGN.md), también en `<code>`.

| Componente | Para qué |
|---|---|
| `Boton`, `BotonIcono`, `claseBoton` | Variantes principal, secundaria, fantasma y peligro; tamaños normal y pequeño; `icono` opcional; `cargando` conserva el texto y el foco |
| `Dialogo` | Modal sobre `<dialog>`: centrado, lateral (hoja de 480 px para crear y editar en oficina) o inferior (campo). `cerrable={false}` para lo que se entrega una sola vez. `useModal` es su mecánica, reutilizada por el visor |
| `Confirmacion` | Título en pregunta, consecuencia, botón con el verbo; la acción corre dentro y el error queda en el diálogo. `nivel` obligatorio: `consecuencia` o `irreversible` (botón de peligro), según la tabla de `DESIGN.md` |
| `ProveedorNotificaciones`, `useNotificar` | Notificaciones de lo ya hecho, con una acción opcional ("Deshacer", "Ver"); abajo a la derecha en oficina, abajo en campo y sobre `[data-barra-inferior]`. Con un diálogo modal abierto van dentro de él: fuera, todo es inerte |
| `useSinRepetir` | Una acción asíncrona que un doble toque hace una sola vez (bloqueo síncrono); devuelve también `ocupado` |
| `CapturaDeErrores`, `FallaAlDibujar` | Si algo falla al dibujar, un aviso en español con "Volver a cargar" en vez de la pantalla en blanco (portal; oficina usa `FallaAlDibujar` en su enrutador) |
| `Tabla`, `CuerpoTabla`, `FilaTabla`, `CeldaTabla` | Tablas de oficina sobre el fondo; `abrir` hace clicable toda la fila; `resaltada` marca y lleva a la vista lo recién creado; `agrupada` con varios `CuerpoTabla` agrupa filas (las visitas por día) |
| `MenuAcciones` | "Más acciones" de una fila, sobre el popover del navegador |
| `EncabezadoPagina` | Título (la sección o lo que se ve), migas, estado junto al título (fuera del `h1`), una línea de datos cortos y acciones |
| `Insignia` | Estados del documento (colores de ADR-0020) y de uso (activo, sin acceso, nuevo) |
| `Aviso` | Mensajes en el flujo: info, éxito, alerta, error |
| `EstadoVacio`, `EsqueletoTabla`, `EsqueletoBloques` | Vacío y cargando con la forma real |
| `BarraLista`, `Buscador`, `PieLista`, `SinResultados`, `Marcado`, `coincide`, `EsqueletoLista` | Listas de oficina (iteración 23): pestañas y buscador en una barra, el texto que coincide resaltado, lo que se muestra si la búsqueda no encuentra nada, y cargando con filas |
| `PlanoEnLuz` | El panel del inicio de sesión de oficina: el plano de un cuarto eléctrico dibujado en luz |
| `CampoBusqueda` | Buscar en listas que crecen sin límite |
| `CampoEnTabla` | Un campo compacto dentro de una fila (cantidad y precio de una cotización), con su nombre accesible y su error debajo |
| `BotonCopiar` | Copiar claves y códigos, con la confirmación en el mismo botón |
| `VisorFotos` | Foto a pantalla completa con anterior y siguiente; en campo, "Eliminar foto" |
| `CampoTexto`, `CampoTextoLargo`, `CampoSeleccion`, `CampoMedida`, `Casilla`, `GrupoDeOpciones`, `SelectorDeArchivo`, `MarcaNoObtenido` | Campos de formulario, con su mensaje de error por campo. `MarcaNoObtenido` separa `onMarcar` (la casilla) de `onMotivo` (escribir el motivo) |
| `Pestanas` | Pestañas subrayadas de oficina, con conteo |
| `Pastilla`, `BotonHerramienta` | La barra compacta del editor de bocetos (ADR-0026): grupos flotantes de iconos de 44 px; la herramienta elegida lleva `aria-pressed` y la superficie de marca |
| `HojasDeBoceto` | Leer un boceto: sus hojas de a dos (una apaisada a lo ancho), con su nombre si hay varias y, con `alAbrir`, cada una como botón |
| `CampoFotos`, `EditorCantidades`, `TablaCantidades`, `Boceto`, `Firma` | Tipos de campo de los formatos. `Firma` dibuja los trazos sin cuadrícula: recortada a la firma o, con `recortar={false}`, como el recuadro donde se firma |

Historia: iteración 6 (`GrupoDeOpciones`, `modoEntrada="numeric"`), 7 (`CampoSeleccion`, `tipo="date"`), 10 (`Boceto`), 11 (`EditorCantidades`, `TablaCantidades`), 14 (el juego completo de la dirección Consola; `Marquilla` se retiró), 16 (`Firma`), 17 (`EditorCantidades` con líneas del catálogo y "Del catálogo"), 18 (`Pastilla`, `BotonHerramienta`, `HojasDeBoceto`, `CampoTexto` con `seleccionarAlEnfocar`, y las animaciones CSS de pasar de hoja y del anillo de enderezar), 19 (`Boceto` dibuja símbolos; `Dialogo` con `focoEnElDialogo`, para listas que se eligen con un toque sin abrir el teclado), 20 (iconos `Mail` y `MessageCircle`), 21 (`CampoEnTabla`, icono `Receipt`), 22 (`Recorrido.tsx`: `EncabezadoDePaso`, `BarraDePaso`, `BotonSiguiente`, `ListaRecorrido`, `PasoDelRecorrido`, `TarjetaResumen`, `BotonAgregar`, `Repaso`, `FilaDeRepaso`, `ChuloDeExito`; paleta oscura de campo con `data-tema="claro"` para lo que se dibuja o se firma, y transiciones entre pasos con View Transitions en `tema.css`), 23 (`oficina.css`, `Lista.tsx`, `PlanoEnLuz`, `CuerpoTabla`; `EncabezadoPagina`, `Pestanas` y `Tabla` con la forma del prototipo de oficina; `Dialogo` ignora un `close` en cola de un montaje anterior), 24 (`useSinRepetir`, `CapturaDeErrores`, `FallaAlDibujar`, `useModal` exportado, notificaciones dentro del diálogo de encima, `MarcaNoObtenido` con `onMarcar` y `onMotivo`, y en `oficina.css` la sesión vencida y la vista previa de la cotización; en 24b, `Confirmacion` con `nivel` obligatorio en lugar de `peligro`).
