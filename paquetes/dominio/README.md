# dominio

TypeScript puro: reglas del levantamiento, máquina de estados, meta-esquema de formatos y validadores.

**Dependencias:** No depende de nada. Ni framework, ni red, ni base de datos.

**ADR relevantes:** 0001, 0006, 0018

Contiene el validador de respuestas (con casos de conformidad en `conformidad/`), el meta-esquema de formatos, la transición borrador a enviado, la edición pura del borrador, `describirValor`, `versionesVigentes` las reglas de la revisión (`tomarRevision`, `corregir`, `marcarRevisado`) y del informe (`validarBorrador`, `validarParaPublicar`, `ContenidoVersion`) (con qué versión de cada formato se crean los levantamientos nuevos). En `formatos-de-prueba/` están los formatos ficticios que siembra el servidor.

Secciones repetibles (iteración 9, `repeticiones.ts`): una sección con `repetible: { etiqueta, min, max }` se repite en el levantamiento; cada repetición es la clave `seccion~id` en las respuestas, y `Levantamiento.repeticiones` guarda su orden y su nombre. `bloques` da lo que se captura en orden (secciones y repeticiones), `rutaLegible` la ruta de un dato para personas ("Tableros · Tablero 2 · Corriente nominal"), y `agregarRepeticion`, `renombrarRepeticion` y `quitarRepeticion` editan el borrador. `validarRespuestas`, `corregir` y `marcarRevisado` reciben las repeticiones. Los ids los genera quien llama (en campo, `nuevoIdDeRepeticion`).
