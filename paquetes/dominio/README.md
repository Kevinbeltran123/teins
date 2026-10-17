# dominio

TypeScript puro: reglas del levantamiento, máquina de estados, meta-esquema de formatos y validadores.

- **Dependencias:** ninguna. Ni framework, ni red, ni base de datos.
- **ADR:** 0001, 0006, 0018, y los de cada área (abajo).
- **Pruebas:** `pnpm --filter @teins/dominio test`. Cada archivo de `src/` tiene su `.test.ts`; los casos de conformidad del validador están en `conformidad/validacion.json`.
- **Formatos de prueba:** `formatos-de-prueba/` tiene los formatos ficticios que siembra el servidor (`prueba-ups` v1 a v9) y la biblioteca de símbolos de prueba (`simbolos-prueba.json`). La v9 es la v8 con la Llegada `soloEmpresa`.

## Qué contiene

### Levantamiento, formatos y revisión

- Validador de respuestas (`validarRespuestas`), meta-esquema de formatos (`meta-esquema.ts`; exige `obligatorio` en una foto con `min`), transición de borrador a enviado (`estados.ts`), edición pura del borrador (`levantamiento.ts`) y `describirValor`.
- `versionesVigentes`: con qué versión de cada formato se crean los levantamientos nuevos.
- Revisión: `tomarRevision`, `corregir` y `marcarRevisado`. Informe: `validarBorrador`, `validarParaPublicar` y `ContenidoVersion`.
- `editar` (y con él `responder` y `agregarFoto`) no escribe en una repetición que ya no está en `repeticiones`: lo que llega tarde a un tablero quitado no lo revive (ADR-0045). `sinRespuestasHuerfanas` quita las respuestas de repeticiones que ya no existen.
- Límites (`limites.ts`): `LIMITES.decimal` (40, el mismo de protocolo) acota medidas y cantidades; `LIMITES_BOCETO.bytes` es 10 MiB. `archivo_muy_grande` es el código que usa campo al medir bocetos y firmas antes de enviar.

### Versión mínima de la app por tipo de campo (ADR-0015)

Un formato que usa un tipo de campo declara `appMinima`. Las constantes: `VERSION_APP_REPETIBLES` 4, `VERSION_APP_BOCETOS` 5, `VERSION_APP_CANTIDADES` 6, `VERSION_APP_FIRMA` 7, `VERSION_APP_CATALOGO` 8 (desde esa app la bajada trae el catálogo), `VERSION_APP_FORMAS` 9 y `VERSION_APP_SIMBOLOS` 10.

### Secciones repetibles (`repeticiones.ts`)

Una sección con `repetible: { etiqueta, min, max }` se repite en el levantamiento. Cada repetición es la clave `seccion~id` en las respuestas, y `Levantamiento.repeticiones` guarda su orden y su nombre. `bloques` da lo que se captura en orden (secciones y repeticiones); `rutaLegible` da la ruta de un dato para personas ("Tableros · Tablero 2 · Corriente nominal") y nombra una sección repetible entera por su título. `agregarRepeticion`, `renombrarRepeticion` y `quitarRepeticion` editan el borrador. `validarRespuestas`, `corregir` y `marcarRevisado` reciben las repeticiones. Los ids los genera quien llama (en campo, `nuevoIdDeRepeticion`).

### Bocetos (`boceto.ts`, ADR-0019 y ADR-0026)

- `DocumentoBoceto` es `BocetoV1 | BocetoV2`. El valor de un campo boceto es `{ boceto: huella }`; `archivosReferenciados` incluye fotos, bocetos y firmas.
- La versión 1 guarda trazos con su contorno, líneas y textos sobre un lienzo de 1000 × 750. `bocetoVacio` sigue siendo de la versión 1: la usan las firmas.
- La versión 2 guarda `hojas` (`HojaBoceto`: nombre, ancho, alto y elementos): verticales de 750 de ancho y de 1.000 a 1.700 de alto (`HOJA`, `altoDeHoja` según la pantalla) o apaisadas de 1.000 × 750 (un boceto viejo vuelto a editar, `aVersion2`), hasta 12 por boceto. Admite `polilinea`, `elipse`, `cota` y `simbolo` además de trazo, línea y texto.
- `validarBoceto`, `serializarBoceto` (canónica: la huella no cambia si el dibujo no cambia), `leerBoceto`, `hojasDe` (las hojas de cualquier versión), `hojaASvg` (dibuja una hoja), `bocetoNuevo`, `hojaNueva` y `geometriaDeCota` (ubica los topes y la medida).

### Símbolos (`simbolos.ts`, ADR-0027)

`DefinicionSimbolo` (id, nombre, categoría, trazado SVG en una caja de 100 × 100, relleno y sigla opcionales, código de catálogo opcional), `esTrazadoValido` (solo geometría: comandos de trazado y números), `validarSimbolo`, `validarBiblioteca` (sin ids ni nombres repetidos) y `GROSOR_SIMBOLO`. En el boceto, el elemento `simbolo` copia el dibujo (`elementoDeSimbolo`) con su centro, tamaño y giro; se valida, se serializa y se dibuja como los demás.

### Cantidades (`cantidades.ts`, ADR-0025)

El campo `cantidades` guarda un arreglo de `LineaCantidad`: id de 8 caracteres, descripción, cantidad como decimal canónico mayor que cero, unidad permitida, observación opcional y, si la eligió el técnico del catálogo, `item` (conserva su descripción y unidad). `lineasValidas` aplica la regla 6 y el código de error es `cantidades_invalidas`. `sumarDecimales` suma exacto (sin coma flotante) y `resumirCantidades` suma por ítem del catálogo y unidad, o por descripción y unidad si la línea no está vinculada.

### Firma del cliente (`firma.ts`, ADR-0024)

El campo `firma` (con `declaracion` opcional, que admite `{tecnico}`, `{sitio}` y `{fecha}`) guarda `{ firma: huella, nombre, cargo?, firmadoEn, declaracion }`. La huella apunta a un documento de boceto con los trazos; `archivosReferenciados` y `bocetosReferenciados` la incluyen (sube al enviar). `llenarDeclaracion` arma la constancia, `firmaASvg` la dibuja sin cuadrícula y recortada, y el código de error es `firma_invalida`. Oficina no la corrige (`no_corregible`).

### Cotización (`cotizacion.ts`, ADR-0029)

Todo en pesos enteros y con `BigInt`, sin coma flotante. `totalDeLinea` (cantidad × precio, redondeado al peso, mitad hacia arriba), `porcentaje`, `calcularTotales` (IVA 19 % sobre el subtotal, o AIU con IVA sobre la utilidad; las líneas sin precio no suman y se cuentan), `validarCotizacion` (líneas, todas con precio, porcentajes de 0 a 100), `lineasDesdeCantidades` (suma las cantidades revisadas con `resumirCantidades` y pone el precio vigente) y `numeroDeCotizacion` (`COT-2026-0007`).

### Qué sale en el informe (`seleccion.ts`, ADR-0039)

`SeleccionInforme` (`ocultos` y `mostrados`) sobre lo de por omisión: no salen las secciones `soloEmpresa` (dato del formato, `DefinicionSeccion.soloEmpresa`) ni los campos `boceto`. `elegir`, `mostrarTodo`, `ocultosDe` (lo de adentro hereda lo de afuera) y `aplicarSeleccion`, que deja la copia de la versión sin lo oculto y con `ocultos`. Lo usan `BorradorInforme.seleccion` y `ContenidoVersion` (`ocultos`, opcional).
