# oficina

Aplicación de oficina, siempre en línea: bandeja, revisión, informes, cotizaciones, visitas, clientes, catálogo, cuenta y administración. Trata de usted.

- **Dependencias:** `dominio`, `protocolo`, `documentos` y `ui`. TanStack Query para el estado del servidor y TanStack Router para las rutas (ADR-0011). El QR lo genera `qrcode` (MIT) en un fragmento que solo se carga al necesitarlo.
- **ADR:** 0002, 0011, 0014, 0023, 0024, 0025, 0026, 0028, 0029, 0031, 0033 a 0037, 0039, 0040.
- **Estilos:** la escala de oficina de los tokens con `data-superficie="oficina"` y `@teins/ui/oficina.css`. Ninguna pantalla define estilos propios.
- **Service worker:** el único (`public/avisos-sw.js`) muestra avisos push; no guarda nada en caché (ADR-0023).
- La historia de cada iteración está en [`docs/proceso/historia/`](../../docs/proceso/historia/).

## Cómo se usa

- `pnpm --filter @teins/oficina dev` (puerto 5174), con `/api` reenviado al servidor.
- `pnpm --filter @teins/oficina test`: pruebas de Vitest en `src/*.test.ts`.
- Los scripts de Vite usan `--configLoader runner`, que transforma el TypeScript del monorepo al cargar la configuración: el plugin `teins-documentos` de `vite.config.ts` sirve `/documentos/*.css` y la fuente desde `paquetes/documentos` (la CSP solo admite estilos del propio origen) y los deja en `dist/documentos/` al compilar.

## Estructura

| Archivo | Qué tiene |
|---|---|
| `src/rutas.tsx` | Enrutador, `Raiz`, `SesionVencida`, pantallas de error y de ruta inexistente en español, View Transitions |
| `src/api.ts` | Cliente de la API; cualquier 401 relee la sesión; `recordarContrasenaDeIngreso` |
| `src/mensajes.ts` | Textos y errores: `errorComun` dice igual en todos los traductores la versión vieja, la falta de conexión, el error desconocido y la sesión vencida; `textoDelServidor` nombra los datos que rechaza el servidor, `errorDelCampo` marca el campo rechazado |
| `src/revision.ts` | Acciones de la revisión, `useCorregirComentario`, `alMarcarRevisado`, `correccionesDe` (antes y después de cada dato) y `loEscritoAlMarcar` (lo que la confirmación dice que se pierde) |
| `src/sinEnviar.ts` | Lo escrito sin enviar en la revisión, por levantamiento: sobrevive a salir del detalle y, los comentarios, a recargar (`sessionStorage`); `useSinEnviar` |
| `src/informes.ts`, `src/vistaInforme.ts`, `src/documentos.ts` | Informe, subida de planos, capítulo de cada levantamiento para la vista en vivo y carga aparte de las plantillas |
| `src/cotizaciones.ts`, `src/catalogo.ts` | Consultas de cotizaciones y del catálogo |
| `src/programacion.ts`, `src/horario.ts` | Visitas y clientes; horario de una visita (ADR-0037) |
| `src/administracion.ts`, `src/cuenta.ts` | Administración y cuenta propia (`errorDeCuenta`) |
| `src/borrador.ts`, `src/guardado.ts` | Borrador del informe y la cotización contra su versión; guardado automático |
| `src/preferencias.ts` | Lo que se recuerda de cada persona en el equipo |
| `src/busqueda.ts`, `src/atajos.ts`, `src/pedido.ts` | Buscar en todo, atajos de teclado, pedidos de una navegación |
| `src/conversacion.ts`, `src/avisos.ts` | Conversaciones con el técnico y avisos push |
| `src/csv.ts`, `src/formato.ts`, `src/usarRetraso.ts`, `src/version.ts` | CSV para Excel, fechas cortas, pesos (`leerPesos`) y listas de nombres (`enLista`), búsqueda con espera, aviso de versión nueva |

## Qué hace cada sección

### Levantamientos (bandeja)

- Pestañas por estado ("Esperando revisión", "En revisión", "Revisados") con "Tomar para revisar" sobre el más antiguo. La columna "Visita" dice de qué cliente y sitio es cada uno. La bandeja busca en el servidor (`buscar`); las demás listas, en la pantalla.
- El punto de "sin leer" de las conversaciones (`Bandeja.tsx`, con "X respondió · hora").

### Revisión (`pantallas/Detalle.tsx`, con sus partes en `pantallas/detalle/`)

- Se arma como el informe, con `EditorConVista`: los datos a la izquierda y, a la derecha, el panel "En el informe", "Comentarios" e "Historial" (`PanelDeRevision`, un `Lienzo` con `panel`). `useVistaPrevia("revision")` recuerda su ancho y si va oculto; la pestaña se recuerda en `revision-pestana`. Bajo 1280 px, "Mostrar el panel" lo abre en hoja lateral.
- El estado y su acción van en la barra (`EstadoDeRevision`). Toma y reasignación explícita, corrección por campo con motivo, aviso cuando otra persona guardó antes (QA-25), marcar revisado con "Siguiente" (el que más lleva esperando y cuántos quedan) e historial con la verificación de su cadena.
- Lo escrito se guarda por destino; "Marcar revisado" dice qué se pierde. Un error al releer no reemplaza la revisión.
- Cada repetición de una sección repetible se ve con su nombre ("Tableros · Tablero 2"); se corrige y se comenta por separado.
- Cada tipo de dato se ve con su componente, en su archivo de `pantallas/detalle/`: `Fotos`, `BocetoDeCampo`, `FirmaDeCampo`, `LineasDeCantidad` (y `CorregirCantidades` al corregir); el historial, en `HistorialDeCambios`. "Abrir el informe" (`AbrirInforme.tsx`) es el mismo en la revisión y en la lista de visitas.
- Bocetos con `HojasDeBoceto`, hoja por hoja, desde el documento ya verificado (`bocetoDeArchivo`); no se corrigen. La firma (`FirmaDeCampo`) muestra quién firmó, cuándo, en qué teléfono y la constancia; se comenta, no se corrige.
- Cantidades en tabla con la columna "Catálogo": quien revisa elige el ítem de cada línea; "Elegido en campo" bajo el vínculo del técnico (deja de decirlo si oficina lo cambia). Corregir la tabla conserva el ítem de cada línea.
- "En el informe" muestra el capítulo con lo corregido resaltado y, mientras se escribe la corrección, el valor nuevo.
- **Comentarios (ADR-0035 y ADR-0040):** conversaciones como hilos (`Comentarios` y `ResponderEnHilo`): el dato del que habla, avatar, nombre y hora por grupo, "N respuestas", "Nuevo" y "Responder…" (↵ envía, ⇧↵ otra línea). Bajo cada dato, el resumen con "Ver la conversación". Con la conversación a la vista se consulta cada 15 s y se marca leída (`useLeerConversacion`); `?hilo=<id>` abre un hilo. Se cierran al marcar revisado. "⋯" en el comentario propio: "Editar" y "Borrar" con "Deshacer", hasta Revisado. Un comentario enviado vacía su campo solo si sigue diciendo lo enviado (`vaciarSiSigue`).

### Datos de la visita y cédulas (iteración 47, ADR-0051)

- **Clientes y sitios:** «NIT» al crear y editar un cliente y «Ciudad» al agregar y editar un sitio (opcionales; el informe dice `[NIT]` y `[Ciudad]` si faltan). **Visitas:** `pantallas/DatosDelPedido.tsx` agrega el «Solicitante» (un contacto del cliente) y la «Referencia del cliente» al programar y al reprogramar; la fila muestra «Orden 0042» y la búsqueda la encuentra. **Administración:** «Cédula» al crear un usuario y «Poner/Cambiar cédula» en su menú (solo quien administra; el registro dice que cambió, nunca el valor).
- **Correcciones de la revisión:** `EditorCorreccion` suma los editores de `opcion`, `opciones` y `horario`; las celdas de una tabla de medidas usan el de `medida`.

### Informes y cotizaciones

- **Vista en vivo (ADR-0031):** el editor a la izquierda y, a la derecha, la hoja que recibe el cliente ("Informe" o "Cotización", y "Correo"), dibujada con las plantillas de `paquetes/documentos`. Al pasar a una sección del editor, la hoja va hasta esa parte. `EditorConVista`, `useVistaPrevia` y `BotonMostrarVista` en `pantallas/Lienzo.tsx`: ampliar, ocultar y el divisor. Bajo 1280 px, "Vista previa" la abre en hoja lateral (`useHojaAlLado`).
- **Guardado automático:** `useGuardadoAutomatico` (`src/guardado.ts`) guarda 1,5 s después de escribir y al salir, en cola sobre la versión vigente de `useBorrador`; copia en el equipo, reintentos sin conexión y con la sesión vencida, y ante un conflicto "Guardar la mía encima" o "Cargar la guardada" (`pantallas/Guardado.tsx`). No hay "Guardar borrador" ni aviso al salir.
- Las rutas del informe, la cotización y el cliente llevan `key={id}`: un documento no se guarda sobre otro.
- **Informe:** desde un levantamiento revisado, "Abrir el informe de esta visita". Levantamientos y planos ordenados con `ListaOrdenable`; introducción y conclusiones. Cada plano dice cuántas páginas anexa, o en rojo que no se puede anexar (`consultas.plano`, que se repite mientras el servidor lo verifica). Bajo cada levantamiento, "Qué sale en el informe" (`pantallas/QueSaleEnElInforme.tsx`, ADR-0039): un interruptor por bloque, "Elegir fotos", "Mostrar todo"; sobre la hoja, "Ocultar" y "Mostrar". La selección va en el borrador. Al publicar, el avance en su lugar (publicada, PDF, portal y cada envío). Quien administra puede retirar una versión del portal con motivo; retirar dice a quién ya le llegó una copia.
- **Cotizaciones (ADR-0029, `pantallas/Cotizaciones.tsx` y `Cotizacion.tsx`):** lista con número, total y estado; "Nueva cotización" elige la visita con cantidades revisadas. Se edita cantidad y precio por línea (con el precio del catálogo a la vista si se cambió), se agrega mano de obra, se quitan líneas con "Deshacer" (`devolverLinea`), se elige IVA o AIU con los totales del dominio, y se publican versiones con su PDF. "Retirar versión", para quien administra, con motivo (ADR-0034).
- **Envíos (ADR-0028, `pantallas/Envios.tsx`):** al publicar se marca quién recibe. Cada envío dice En cola, Enviado, Entregado, Cancelado o No llegó con el motivo. "Cancelar" el envío en cola, con "Deshacer" (`useCancelarEnvio`). "Volver a enviar" y "Enviar a otro contacto" (hoja lateral, solo a quien falta, con "Ver cómo llega"); si el PDF no se pudo generar, no se ofrecen. Cada envío lleva su llave. El correo se puede escribir sobre la vista previa (`EdicionDeCorreo`, ADR-0036). La bandeja de Informes marca "Envío sin entregar".

### Visitas

- Pestañas de próximas, anteriores y canceladas, con técnicos y avance según sus levantamientos. Programar, reasignar, reprogramar y cancelar con motivo; abrir el informe cuando hay levantamientos revisados.
- Horario (ADR-0037, `HorarioDeVisita.tsx`: `CuandoVisita` y `TecnicosDisponibles`): todo el día, de una hora a otra o hasta que el técnico la termine.
- Una visita con su técnico desactivado dice "Sin técnico" y se reasigna sin trabarse (`cambiosAlReasignar`). Tras un conflicto, los diálogos toman la versión vigente (`releer`).
- "Exportar las cantidades" descarga el detalle y el resumen en CSV para Excel en español (punto y coma, coma decimal, BOM y celdas que no se ejecutan como fórmula), generados en el navegador (`src/csv.ts`).

### Clientes (`pantallas/Clientes.tsx` y `Cliente.tsx`)

- Pestañas "Activos" y "Archivados". La lista dice cuántos contactos reciben el informe ("Nadie" en alerta). "Nuevo cliente" con su primer sitio y su contacto (`CamposDeContacto.tsx`).
- El cliente: contactos con correo, celular, canal y si reciben informes, cotizaciones o los dos (WhatsApp pide la autorización, atada al número con `autorizacionDelCelular`); sus sitios. "Editar", "Editar sitio", "Archivar cliente" y "Archivar sitio" (ADR-0035); con visitas por hacer, el diálogo dice cuáles. Un archivado muestra el aviso y "Recuperar cliente".

### Catálogo

Buscar, crear, editar, desactivar e importar un CSV de Excel (punto y coma o coma, con o sin encabezado, con columna de precio opcional). La unidad es libre, con sugerencias. Columna "Precio sin IVA", filtro "Solo los que no tienen precio" y, para administración, "Cambiar precio" con la historia.

### Mi cuenta y administración

- **Ingreso:** contraseña, segundo factor (código de la app autenticadora o de respaldo) o llave de acceso. Con una contraseña temporal solo se ve "Cree su contraseña" (`pantallas/ContrasenaObligatoria.tsx`, ADR-0033); si la página se recargó, la temporal se pide de nuevo.
- **Mi cuenta (`pantallas/MiCuenta.tsx`):** "Acceso" (cambiar contraseña; "Quitar segundo factor" para quien no administra), llaves de acceso, tema y "Avisos en este navegador" (no aparece si el entorno no tiene claves o el navegador no los admite; la suscripción se renueva al abrir y se quita al cerrar sesión, `src/avisos.ts`).
- **Administración**, para quien tiene la marca: sin segundo factor, la pantalla guía su activación (QR, clave, códigos de respaldo hasta "Ya los guardé"). Con él, pestañas de usuarios (crear con contraseña temporal, restablecer, desactivar, reactivar, dar o quitar administración; "Debe cambiar su contraseña"), teléfonos de campo (salud y alerta de pendientes de más de un día). Los accesos al portal ya no están aquí: van en cada contacto del cliente (ADR-0053). Restablecer el acceso quita las llaves de la persona. Lo que se entrega una vez va en un diálogo que no se cierra por accidente.

## Lo que comparte toda la aplicación

- **Marco (`Marco.tsx`):** menú lateral con iconos y la cuenta de lo que espera revisión; "Plegar el menú" y ⌘B / Ctrl + B. El título de cada pantalla es la sección del menú y las subsecciones son pestañas.
- **Sesión vencida:** se ingresa de nuevo encima de la pantalla (`SesionVencida`), con "Sesión recuperada".
- **Buscar en todo (`pantallas/Paleta.tsx`, `src/busqueda.ts`):** ⌘K / Ctrl + K o "Buscar" en el menú, con las consultas de las listas; `useRecientes` y `useAnotarReciente`; lo reciente se ve con los datos de ahora (`recienteDeLevantamiento`).
- **Atajos (`src/atajos.ts`, `useTeclaSuelta`):** J, K, Enter y "/" en la bandeja; T, R, S y Esc en la revisión; "?" abre `pantallas/Atajos.tsx`. No actúan con un diálogo modal abierto.
- **Pedidos de una navegación (`src/pedido.ts`):** abrir un formulario desde ⌘K o la pestaña de un aviso se atiende una vez y se borra del historial (`usePedido`, leído de `resolvedLocation`); "Ver en Canceladas", "Ver en Activos", "Ver en Archivados", "Programar otra" y las acciones de la búsqueda navegan con `useIrConPedido` (`abrir`, `vista`, `mostrarVisita`).
- **Lo que se recuerda (`src/preferencias.ts`):** `usePreferencia` por persona en el equipo o mientras dure la pestaña, `useBusquedaRecordada`, `PersonaDeOficina`: pestañas, búsquedas, la fila abierta, el menú y la vista previa. Nada va al servidor.
- **Movimiento (`DESIGN.md`):** navegar es una View Transition (`router.startViewTransition` pasa por `conTransicion` en `src/rutas.tsx`, solo cuando cambia la ruta). Abrir un levantamiento o un cliente convierte el título de la fila en el del detalle, con lo necesario leído antes (`loader` con 400 ms de espera y `defaultPreload: "intent"`). Las acciones releen dentro de una transición: la fila nueva entra arriba y el estado cambia en su lugar. Notificaciones con su siguiente paso ("Agregar contactos", "Ver en Canceladas").
- **Errores por campo:** junto a su campo y se van al cambiarlo (`sinError`). Un `estado_invalido` muestra el detalle del servidor. Cada "Deshacer" se hace una vez.
- **Avisos:** `src/conversacion.ts` y `public/avisos-sw.js` silencian el aviso de la conversación a la vista y abren el del aviso tocado sin recargar.

## Pruebas

- `src/*.test.ts`: CSV, cotizaciones, envíos, contactos, horario, informes, revisión, lo escrito sin enviar, programación, administración, mensajes (todos los traductores dicen igual los errores comunes), búsqueda y usabilidad.
- Extremo a extremo en `e2e/pruebas/` (por ejemplo `revision.spec.ts`, `informe.spec.ts`, `cotizaciones.spec.ts`, `usabilidad.spec.ts`, `robustez-oficina.spec.ts`).
