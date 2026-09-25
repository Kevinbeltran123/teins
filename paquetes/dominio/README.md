# dominio

TypeScript puro: reglas del levantamiento, máquina de estados, meta-esquema de formatos y validadores.

**Dependencias:** No depende de nada. Ni framework, ni red, ni base de datos.

**ADR relevantes:** 0001, 0006, 0018

Contiene el validador de respuestas (con casos de conformidad en `conformidad/`), el meta-esquema de formatos, la transición borrador a enviado, la edición pura del borrador, `describirValor`, `versionesVigentes` las reglas de la revisión (`tomarRevision`, `corregir`, `marcarRevisado`) y del informe (`validarBorrador`, `validarParaPublicar`, `ContenidoVersion`) (con qué versión de cada formato se crean los levantamientos nuevos). En `formatos-de-prueba/` están los formatos ficticios que siembra el servidor.
