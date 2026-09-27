# ui

Componentes compartidos y tokens de diseño: dirección Consola en oficina y portal (iteración 14) y dirección Recorrido en campo (iteración 22, `[data-superficie="campo"]` en `tokens.css`). Ver `DESIGN.md`.

**Dependencias:** No depende de ningún otro paquete del monorepo. Iconos de Lucide (`lucide-react`, ISC), reexportados desde `src/iconos.ts`: ninguna superficie importa la biblioteca. `sideEffects` declarado para que cada superficie empaquete solo lo que usa.

**ADR relevantes:** 0011, 0020

Los tokens de tamaño son neutros (`texto-cuerpo`, `control`, `fondo`): cada superficie los redefine con `data-superficie` y los componentes no cambian. Una sola familia de letra en toda la interfaz (DESIGN.md), también en `<code>`.

| Componente | Para qué |
|---|---|
| `Boton`, `BotonIcono`, `claseBoton` | Variantes principal, secundaria, fantasma y peligro; tamaños normal y pequeño; `icono` opcional; `cargando` conserva el texto y el foco |
| `Dialogo` | Modal sobre `<dialog>`: centrado, lateral (hoja de 480 px para crear y editar en oficina) o inferior (campo). `cerrable={false}` para lo que se entrega una sola vez. `useModal` es su mecánica, reutilizada por el visor |
| `Confirmacion` | Título en pregunta, consecuencia, botón con el verbo; la acción corre dentro y el error queda en el diálogo |
| `ProveedorNotificaciones`, `useNotificar` | Notificaciones de lo ya hecho, con una acción opcional ("Deshacer", "Ver"); abajo a la derecha en oficina, abajo en campo y sobre `[data-barra-inferior]` |
| `Tabla`, `FilaTabla`, `CeldaTabla` | Tablas de oficina; `abrir` hace clicable toda la fila; `resaltada` marca y lleva a la vista lo recién creado |
| `MenuAcciones` | "Más acciones" de una fila, sobre el popover del navegador |
| `EncabezadoPagina` | Título (la sección o lo que se ve), migas, estado, descripción y acciones |
| `Insignia` | Estados del documento (colores de ADR-0020) y de uso (activo, sin acceso, nuevo) |
| `Aviso` | Mensajes en el flujo: info, éxito, alerta, error |
| `EstadoVacio`, `EsqueletoTabla`, `EsqueletoBloques` | Vacío y cargando con la forma real |
| `CampoBusqueda` | Buscar en listas que crecen sin límite |
| `CampoEnTabla` | Un campo compacto dentro de una fila (cantidad y precio de una cotización), con su nombre accesible y su error debajo |
| `BotonCopiar` | Copiar claves y códigos, con la confirmación en el mismo botón |
| `VisorFotos` | Foto a pantalla completa con anterior y siguiente; en campo, "Eliminar foto" |
| `CampoTexto`, `CampoTextoLargo`, `CampoSeleccion`, `CampoMedida`, `Casilla`, `GrupoDeOpciones`, `SelectorDeArchivo`, `MarcaNoObtenido` | Campos de formulario, con su mensaje de error por campo |
| `Pastilla`, `BotonHerramienta` | La barra compacta del editor de bocetos (ADR-0026): grupos flotantes de iconos de 44 px; la herramienta elegida lleva `aria-pressed` y la superficie de marca |
| `HojasDeBoceto` | Leer un boceto: sus hojas de a dos (una apaisada a lo ancho), con su nombre si hay varias y, con `alAbrir`, cada una como botón |
| `CampoFotos`, `EditorCantidades`, `TablaCantidades`, `Boceto`, `Firma` | Tipos de campo de los formatos. `Firma` dibuja los trazos sin cuadrícula: recortada a la firma o, con `recortar={false}`, como el recuadro donde se firma |

Historia: iteración 6 (`GrupoDeOpciones`, `modoEntrada="numeric"`), 7 (`CampoSeleccion`, `tipo="date"`), 10 (`Boceto`), 11 (`EditorCantidades`, `TablaCantidades`), 14 (el juego completo de la dirección Consola; `Marquilla` se retiró), 16 (`Firma`), 17 (`EditorCantidades` con líneas del catálogo y "Del catálogo"), 18 (`Pastilla`, `BotonHerramienta`, `HojasDeBoceto`, `CampoTexto` con `seleccionarAlEnfocar`, y las animaciones CSS de pasar de hoja y del anillo de enderezar), 19 (`Boceto` dibuja símbolos; `Dialogo` con `focoEnElDialogo`, para listas que se eligen con un toque sin abrir el teclado), 20 (iconos `Mail` y `MessageCircle`), 21 (`CampoEnTabla`, icono `Receipt`), 22 (`Recorrido.tsx`: `EncabezadoDePaso`, `BarraDePaso`, `BotonSiguiente`, `ListaRecorrido`, `PasoDelRecorrido`, `TarjetaResumen`, `BotonAgregar`, `Repaso`, `FilaDeRepaso`, `ChuloDeExito`; paleta oscura de campo con `data-tema="claro"` para lo que se dibuja o se firma, y transiciones entre pasos con View Transitions en `tema.css`).
