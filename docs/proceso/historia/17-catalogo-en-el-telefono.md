[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 16 · Firma del cliente](16-firma-del-cliente.md) · Siguiente: [Iteración 18 · Croquis a pantalla completa, con hojas](18-croquis-a-pantalla-completa.md)

# Iteración 17 · Catálogo en el teléfono

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (los cuatro servicios, la migración del catálogo aplicada y los 15 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.6 · Catálogo en el teléfono", "yeah, i aprove").

**Para qué:** que el técnico elija los materiales del catálogo al anotar cantidades, sin conexión, y que esas líneas lleguen a oficina ya vinculadas: menos escritura en campo, descripciones iguales entre técnicos y la base de la cotización (iteración 21).

## Alcance

- **Bajada (ADR-0025):** cambio `item_catalogo` para toda la organización (código, descripción, unidad y si está activo; sin precio), solo a la app 8 o posterior. El catálogo registra cada ítem creado, editado o importado; una migración registra los que ya existían.
- **Línea de cantidad:** puede llevar `item` (el id del ítem) además de su texto. Al recibirla, el servidor la proyecta vinculada a nombre del técnico si el ítem existe; si no, sin vínculo y sin rechazar el envío. La regla 6 del modelo de dominio cambió: el técnico elige, oficina confirma, cambia o completa.
- **Campo (app 8, base local versión 5):** "Del catálogo" abre la búsqueda (sin tildes ni mayúsculas, por comienzo de palabra o por código) con "Los que más usas"; elegir agrega la línea con descripción y unidad fijas y "Del catálogo · código". Lo que no está se agrega como línea libre con lo escrito. Sin ítems que sirvan para el campo, solo "Agregar línea".
- **Oficina:** "Elegido en campo" bajo el vínculo que eligió el técnico; corregir la tabla conserva el ítem de cada línea.

## Fuera de la iteración 17

| Qué | Dónde se resuelve |
|---|---|
| Catálogo real de TEINS y sus columnas de Excel | Cuando TEINS responda P28 y P29; se prueba con ítems ficticios |
| Precios en el teléfono | Nunca en la línea (regla 7); la cotización es de oficina (iteración 21) |
| Contar los símbolos de un boceto como cantidades | Iteración 19, si los símbolos llevan código de catálogo |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26 |
| 2. El catálogo baja solo a la app 8, sin precio; uno desactivado baja inactivo; otra organización no lo ve | Hecho: `servidor/pruebas/catalogo-en-campo.test.ts` |
| 3. La línea elegida llega vinculada a nombre del técnico; un ítem desconocido no rechaza el envío; oficina lo cambia | Hecho: `catalogo-en-campo.test.ts` y `cantidades.test.ts` |
| 4. Búsqueda y "los que más usas" sin conexión, solo con ítems activos y unidades del campo | Hecho: `campo/src/catalogo.test.ts` y `repositorio.test.ts` (catálogo en la bajada) |
| 5. Extremo a extremo: oficina crea el ítem, el técnico lo busca y lo elige, agrega una línea libre desde la búsqueda y oficina ve "Elegido en campo" | Hecho en Chromium y WebKit (`e2e/pruebas/catalogo-campo.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 82, protocolo 18, oficina 4, campo 58, servidor 114; extremo a extremo 31 y 3 omitidas (Chromium y WebKit); campo 117,4 de 120 KB |
| 7. Desplegada en el entorno de pruebas | Hecho el 2026-09-26: los cuatro servicios en `SUCCESS`, salud en 200, `campo` aplicó la migración `0021` antes de arrancar y los 15 archivos del extremo a extremo contra el entorno en Chromium, 17 pruebas en verde |
| 8. Probada en el iPhone | Pendiente: fase 17 de [`verificacion-manual.md`](../verificacion-manual.md) |

## Decisiones tomadas al construirlo

- **La línea conserva su texto aunque venga del catálogo:** se lee igual en el PDF, en oficina y en una app sin catálogo, aunque el ítem cambie después.
- **El vínculo se decide al recibir, contra el catálogo del servidor:** un teléfono con el catálogo de ayer puede elegir un ítem que ya no existe; la línea entra sin vínculo y oficina la vincula como siempre.
- **"Elegido en campo" es `vinculada_por` = el técnico:** cuando oficina lo cambia, deja de decirlo. No hizo falta otra columna.
- **"Los que más usas" se cuenta en el teléfono,** de las líneas de ese técnico, al abrir la búsqueda. No se sube nada nuevo.
- **La hoja de búsqueda va dentro de la captura, no como carga aparte:** cargada aparte desde la captura, el empaquetador partió el JavaScript inicial en cinco archivos y subió de 117,4 a 119,2 KB; la captura ya se carga aparte, así que la hoja no pesa en el arranque (117,4 KB).
- **El catálogo no se sella en el teléfono:** es la lista de materiales de la organización, como los formatos (ADR-0022 sella lo del cliente).
- **La prueba de extremo a extremo de cantidades acepta "Agregar línea" o "Línea libre":** el catálogo es de la organización y las corridas lo comparten, así que el botón depende de si ya hay ítems.
