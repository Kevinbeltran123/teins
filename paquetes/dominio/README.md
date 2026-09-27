# dominio

TypeScript puro: reglas del levantamiento, máquina de estados, meta-esquema de formatos y validadores.

**Dependencias:** No depende de nada. Ni framework, ni red, ni base de datos.

**ADR relevantes:** 0001, 0006, 0018

Contiene el validador de respuestas (con casos de conformidad en `conformidad/`), el meta-esquema de formatos, la transición borrador a enviado, la edición pura del borrador, `describirValor`, `versionesVigentes` las reglas de la revisión (`tomarRevision`, `corregir`, `marcarRevisado`) y del informe (`validarBorrador`, `validarParaPublicar`, `ContenidoVersion`) (con qué versión de cada formato se crean los levantamientos nuevos). En `formatos-de-prueba/` están los formatos ficticios que siembra el servidor.

Secciones repetibles (iteración 9, `repeticiones.ts`): una sección con `repetible: { etiqueta, min, max }` se repite en el levantamiento; cada repetición es la clave `seccion~id` en las respuestas, y `Levantamiento.repeticiones` guarda su orden y su nombre. `bloques` da lo que se captura en orden (secciones y repeticiones), `rutaLegible` la ruta de un dato para personas ("Tableros · Tablero 2 · Corriente nominal"), y `agregarRepeticion`, `renombrarRepeticion` y `quitarRepeticion` editan el borrador. `validarRespuestas`, `corregir` y `marcarRevisado` reciben las repeticiones. Los ids los genera quien llama (en campo, `nuevoIdDeRepeticion`).

Bocetos (iteración 10, `boceto.ts`): `DocumentoBoceto` (trazos con su contorno, líneas y textos sobre un lienzo de 1000 × 750), `validarBoceto`, `serializarBoceto` (canónica: la huella no cambia si el dibujo no cambia), `leerBoceto` y `bocetoASvg`. El valor de un campo boceto es `{ boceto: huella }`; `archivosReferenciados` incluye fotos y bocetos.

Bocetos versión 2 (iteración 18, ADR-0026): `DocumentoBoceto` es `BocetoV1 | BocetoV2`. La versión 2 guarda `hojas` (`HojaBoceto`: nombre, ancho, alto y elementos), verticales de 750 de ancho y de 1.000 a 1.700 de alto (`HOJA`, `altoDeHoja` según la pantalla) o apaisadas de 1.000 × 750 (un boceto viejo vuelto a editar, `aVersion2`), hasta 12 por boceto, y admite `polilinea`, `elipse` y `cota` además de trazo, línea y texto. `hojasDe` da las hojas de cualquier versión; `hojaASvg` dibuja una (reemplaza a `bocetoASvg`); `bocetoNuevo` y `hojaNueva` las crean; `geometriaDeCota` ubica los topes y la medida. `bocetoVacio` sigue siendo de la versión 1: la usan las firmas. `VERSION_APP_FORMAS` es 9.

Cantidades (iteración 11, `cantidades.ts`): el campo `cantidades` guarda un arreglo de `LineaCantidad` (id de 8 caracteres, descripción, cantidad como decimal canónico mayor que cero, unidad permitida y observación opcional); `lineasValidas` aplica la regla 6 y el código de error es `cantidades_invalidas`. `sumarDecimales` suma exacto (sin coma flotante) y `resumirCantidades` suma por ítem del catálogo y unidad, o por descripción y unidad si la línea no está vinculada. Exige `appMinima` 6.

Firma del cliente (iteración 16, ADR-0024, `firma.ts`): el campo `firma` (con `declaracion` opcional, que admite `{tecnico}`, `{sitio}` y `{fecha}`) guarda `{ firma: huella, nombre, cargo?, firmadoEn, declaracion }`. La huella apunta a un documento de boceto con los trazos; `archivosReferenciados` y `bocetosReferenciados` la incluyen (sube al enviar). `llenarDeclaracion` arma la constancia, `firmaASvg` la dibuja sin cuadrícula y recortada, y el código de error es `firma_invalida`. Oficina no la corrige (`no_corregible`). Exige `appMinima` 7.

Catálogo en campo (iteración 17, ADR-0025): una `LineaCantidad` puede llevar `item` (el id del ítem del catálogo que eligió el técnico); conserva su descripción y unidad. `VERSION_APP_CATALOGO` = 8: desde esa app la bajada trae el catálogo.
