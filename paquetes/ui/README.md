# ui

Componentes compartidos y tokens de diseño de la dirección Consola (`DESIGN.md`, iteración 14).

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
| `BotonCopiar` | Copiar claves y códigos, con la confirmación en el mismo botón |
| `VisorFotos` | Foto a pantalla completa con anterior y siguiente; en campo, "Eliminar foto" |
| `CampoTexto`, `CampoTextoLargo`, `CampoSeleccion`, `CampoMedida`, `Casilla`, `GrupoDeOpciones`, `SelectorDeArchivo`, `MarcaNoObtenido` | Campos de formulario, con su mensaje de error por campo |
| `CampoFotos`, `EditorCantidades`, `TablaCantidades`, `Boceto` | Tipos de campo de los formatos |

Historia: iteración 6 (`GrupoDeOpciones`, `modoEntrada="numeric"`), 7 (`CampoSeleccion`, `tipo="date"`), 10 (`Boceto`), 11 (`EditorCantidades`, `TablaCantidades`), 14 (el juego completo de la dirección Consola; `Marquilla` se retiró).
