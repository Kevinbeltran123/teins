[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 17 · Catálogo en el teléfono](17-catalogo-en-el-telefono.md) · Siguiente: [Iteración 19 · Símbolos en el croquis](19-simbolos-en-el-croquis.md)

# Iteración 18 · Croquis a pantalla completa, con hojas

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada el 2026-09-26, verificada en local y desplegada en el entorno de pruebas (el worker primero, después campo, oficina y portal; los 16 archivos del extremo a extremo en verde contra el entorno). Falta la prueba en iPhone. Maquetas aprobadas por Kevin en el lienzo (página "v0.8 · Croquis a pantalla completa", "Esoo, muchísimo mejor") después de dos rondas: la primera propuesta (página "v0.7", editor con la hoja apaisada y las herramientas en cuadrícula) le pareció pequeña, y la segunda (herramientas en un desplegable con su explicación) todavía gastaba espacio. Pidió el estilo de Notas de iOS y GoodNotes, con capturas de GoodNotes.

**Para qué:** croquis limpios y grandes: la hoja llena el teléfono, los trazos se enderezan, las paredes se miden y cada piso va en su hoja con nombre.

## Alcance

- **Editor a pantalla completa (ADR-0026, parte 4):** una sola barra de iconos arriba (volver, deshacer y rehacer; Trazo, Cota, Texto, Mover y Borrador) y la hoja en todo lo demás; abajo, la pastilla con la hoja en que se está. Sin textos de ayuda: se enseñan al operario.
- **Enderezar:** medio segundo con el dedo quieto al terminar; un anillo lo anuncia. Línea, pared en L o en U, triángulo, rectángulo, círculo o elipse; se ajusta a 0°, 45° y 90° y pega los extremos a los de otras paredes.
- **Cota** con su medida escrita; **Mover** con giro de a 15°, tamaño, "Duplicar" y "Quitar"; **Texto** y **Borrador** como antes. La herramienta "Línea" salió: la recta es un trazo enderezado.
- **Hojas:** verticales y del alto de la pantalla donde se crean; hasta 12 por boceto, cada una con nombre (se pide al crearla). Dos dedos a lo ancho pasan de hoja y, después de la última, agregan una; el menú de la pastilla va a una hoja, agrega, cambia el nombre y quita.
- **Documento versión 2** (`{ hojas: [{ nombre, ancho, alto, elementos }] }`) con `polilinea`, `elipse` y `cota`; la versión 1 sigue igual (las firmas la usan) y un boceto viejo se abre como hoja apaisada. App 9.
- **Captura, oficina y PDF:** las hojas de a dos, con su nombre si hay varias; en la captura, tocar una abre esa hoja.

## Fuera de la iteración 18

| Qué | Dónde se resuelve |
|---|---|
| Símbolos (tablero, UPS, tomas) | Iteración 19, sobre esta misma barra y documento |
| Flecha, colores y grosores | Si TEINS los pide: el croquis es en blanco y negro para el PDF |
| Ver la hoja de otro piso atenuada debajo | Si los técnicos la piden; ningún plano de TEINS lo requiere hoy |
| Deshacer con toques de varios dedos | No: se disparan por accidente e iOS ya los usa |
| `repeticiones.spec` falla a veces en WebKit en la corrida completa (esperando "Piso 3" tras corregir en oficina); pasa sola y repetida | Investigar antes de la iteración 19: ya falló en las iteraciones 17 y 18 |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-26, en la tercera ronda |
| 2. Documento versión 2 con hojas y formas; la versión 1 y las firmas siguen igual | Hecho: `dominio/src/boceto.test.ts` (versión 2: hojas, tamaños, límites, canónica, SVG) y `firma.test.ts` |
| 3. El worker verifica la versión 2 y oficina la recibe igual; el PDF pone cada hoja con su nombre | Hecho: `servidor/pruebas/bocetos.test.ts` |
| 4. Enderezar, transformar y encajar la hoja, sin interfaz | Hecho: `campo/src/dibujo/enderezar.test.ts`, `transformar.test.ts` y `vista.test.ts` |
| 5. Extremo a extremo: enderezar, cota, mover y duplicar, dos hojas con nombre (en Chromium, pasando de hoja con dos dedos), la captura abre una hoja, oficina y el PDF | Hecho en Chromium y WebKit (`e2e/pruebas/croquis.spec.ts` y `bocetos.spec.ts`) |
| 6. Lo anterior sigue igual y el presupuesto de campo se respeta | Hecho: tipos, arquitectura, licencias y auditoría en verde; dominio 90, protocolo 18, oficina 4, campo 74, servidor 115; extremo a extremo 32 y 3 omitidas en Chromium y WebKit, con una falla intermitente de `repeticiones.spec` en WebKit que pasa sola (ver "Fuera"); campo 119,0 de 120 KB |
| 7. Desplegada en el entorno de pruebas, el servidor antes que la app | Hecho el 2026-09-26: el worker en `SUCCESS` antes de subir la app; campo, oficina y portal en `SUCCESS`, salud en 200 y el mismo JavaScript que en local; los 16 archivos del extremo a extremo contra el entorno en Chromium, 18 pruebas en verde |
| 8. Probada en el iPhone | Pendiente: fase 18 de [`verificacion-manual.md`](../verificacion-manual.md) |

## Decisiones tomadas al construirlo

- **Las hojas van dentro del documento, no un archivo por hoja:** el valor del campo, su validación y la revisión no cambiaron, y ningún teléfono tenía todavía bocetos de la versión 2 (ADR-0026, parte 3).
- **La hoja toma la forma de la pantalla donde se crea** (`altoDeHoja`): una forma fija dejaba bandas vacías arriba y abajo. En otra pantalla se encaja con un margen.
- **Las maquetas ahora dibujan la barra de estado y la raya de inicio del iPhone:** sin ellas, el espacio vacío parecía mayor de lo real.
- **Deshacer guarda la hoja en que se estaba:** deshacer un cambio de otra hoja vuelve a ella.
- **El gesto de volver del iPhone se bloquea sobre la hoja** (a 24 px del borde): la hoja llega al borde y un trazo desde ahí no debe sacar al técnico de la captura.
- **La validación de las hojas viaja con el arranque de campo:** la base local lee los bocetos al abrir la captura. 117,4 → 119,0 de 120 KB; la iteración 19 debe cargar sus símbolos con el editor, aparte.
- **El guardado ya no se anuncia en pantalla:** "Guardado en este teléfono" queda para el lector de pantalla; un error sí se muestra, arriba de la hoja.
