# ADR-0026 · Bocetos versión 2: hojas con nombre, formas enderezadas, cotas y mover, en un editor a pantalla completa

- **Estado:** Aceptada
- **Fecha:** 2026-09-26
- **Impulsores:** QA-15, QA-16, QA-17, R7
- **Depende de:** ADR-0011, ADR-0015, ADR-0019
- **Reemplaza en parte:** ADR-0019 ("Fuera de alcance: formas geométricas"; el lienzo apaisado único; la lista de herramientas)

## Contexto

ADR-0019 dejó fuera las formas y la medición: el croquis de campo era trazo libre, línea, texto y borrador sobre una hoja apaisada de 4:3. Kevin pidió (plan de las iteraciones 15 a 21) que los trazos se enderecen, que haya formas y que no haya que dibujar lo mismo cada vez; los símbolos llegan en la iteración 19 sobre esta misma base. Al revisar las maquetas pidió además (lienzo, página "v0.8 · Croquis a pantalla completa"):

- que el croquis ocupe toda la pantalla, "como Notas de iOS o GoodNotes": la hoja apaisada, con la app fija en vertical, medía unos 390 × 290 px en un iPhone;
- una sola barra compacta de iconos, sin textos ni explicaciones ("se le explica al operario");
- varias hojas, deslizando para agregar otra: el segundo piso.

Hechos:

- El documento del boceto es JSON canónico: su huella es su contenido (ADR-0007), y el worker rechaza lo que no reconoce.
- El editor es propio (perfect-freehand y Pointer Events) y se carga aparte del arranque de campo.
- Un boceto se crea y se edita en el mismo teléfono; oficina y el PDF lo dibujan con el código del servidor. Ningún teléfono tiene todavía bocetos de la versión 2: su forma se puede decidir ahora sin migrar nada.
- Las firmas (ADR-0024) se guardan como bocetos de la versión 1.

## Parte 1 · Enderezar

| Opción | Descripción |
|---|---|
| **A. Dejar el dedo quieto al terminar (QuickShape de Procreate, Freeform, GoodNotes, Notability)** | Medio segundo quieto: el trazo se vuelve línea, polilínea, rectángulo o elipse, si se parece |
| B. Enderezar siempre | Todo trazo se interpreta al soltarlo |
| C. Un botón "Enderezar" | Se dibuja y después se toca el botón |

**Decisión: A.** El gesto es explícito: un cable que va en curva no se "arregla" solo (frente a B), y no hay un paso más (frente a C). Un anillo que se llena (CSS, regla 10) muestra que va a pasar; si el trazo no se parece a ninguna forma, queda como se dibujó, y "Deshacer" vuelve al trazo a mano.

**Reconocedor propio, sin biblioteca:** se simplifica el trazo (Ramer-Douglas-Peucker), se cuentan las esquinas y se mira si cierra. Abierto con dos puntos: línea; con tres a cinco: polilínea (paredes en L o en U). Cerrado con tres esquinas: triángulo; con cuatro en ángulo casi recto: rectángulo; redondo y parejo: elipse. Las líneas y los lados se ajustan a 0°, 45° o 90° si están cerca, y un extremo se pega a otro cercano para cerrar cuartos.

**La herramienta "Línea" sale:** la línea recta es un trazo enderezado, como en las aplicaciones de referencia, y con cinco herramientas la barra cabe en un teléfono de 390 px con botones de 44 px. Los bocetos viejos con líneas se siguen dibujando igual.

## Parte 2 · Elementos

| Opción | Descripción |
|---|---|
| **A. Elementos propios (`polilinea`, `elipse`, `cota`) y mover cambiando las coordenadas** | El documento sigue siendo solo geometría |
| B. Una transformación por elemento (traslación, giro, escala) | El dibujo sale de aplicar la transformación |

**Decisión: A.** Mover, girar (de a 15°) o cambiar el tamaño recalcula los puntos del elemento: el documento no gana un concepto nuevo y el SVG del PDF sale igual de simple. El texto solo se mueve y cambia de tamaño (girarlo no ayuda a leer el croquis).

- `polilinea`: puntos y si es cerrada (líneas quebradas, rectángulos, triángulos).
- `elipse`: centro, radios y giro.
- `cota`: dos puntos y su medida escrita ("4,50 m"). Es una anotación que escribe el técnico, no una medición automática: el plano con escala sigue siendo de oficina (ADR-0019).

## Parte 3 · Hojas

| Opción | Descripción |
|---|---|
| **A. Las hojas dentro del mismo documento** | `{ version: 2, cuadricula, hojas: [{ nombre, ancho, alto, elementos }] }`; el campo sigue guardando una huella |
| B. Un documento por hoja | El valor del campo pasa a ser una lista de huellas |

**Decisión: A.** El valor del campo, su validación, la revisión en oficina y los archivos referenciados no cambian; solo cambia el documento, que aún no existe en ningún teléfono. Con B cambiaría el contrato del valor para un beneficio (subir menos al editar una hoja) que en un croquis de pocos kilobytes no se nota.

- **Cada hoja tiene nombre** ("Segundo piso", "Cuarto de baterías"): se pide al crearla, porque sale en el informe, y se puede dejar el de siempre ("Hoja 2"). Hasta 12 hojas por boceto y 2.000 elementos por hoja.
- **La hoja es vertical y tan alta como la pantalla donde se crea:** 750 unidades de ancho y de 1.000 a 1.700 de alto (`altoDeHoja`), para que llene el espacio que deja la barra en cualquier teléfono. En otra pantalla se encaja y queda un margen.
- **Un boceto de la versión 1 que se vuelve a editar pasa a la 2**: su hoja apaisada (1.000 × 750) queda como "Hoja 1", que la validación también admite. Nunca se borra ni se redibuja lo que ya había (regla 5).
- **Las firmas siguen en la versión 1**: son una sola hoja apaisada, y su validación y su SVG no cambian.

## Parte 4 · El editor

Una sola barra de iconos arriba (volver, deshacer y rehacer, y Trazo, Cota, Texto, Mover y Borrador) y la hoja en todo lo demás; la hoja en que se está va abajo, en una pastilla que abre el menú de hojas (ir, agregar, cambiar el nombre, quitar). Sin textos de ayuda: los gestos se enseñan al operario.

- **Un dedo dibuja; dos dedos acercan, mueven y pasan de hoja**, como en GoodNotes, Notas y Notability. Con la hoja completa, deslizar dos dedos a lo ancho pasa a la hoja vecina, y después de la última ofrece "Suelta para agregar la hoja N"; el umbral es corto (25 % del ancho, máximo 100 px), porque en GoodNotes el gesto largo es una queja frecuente. El menú también agrega hojas: ninguna aplicación de planos depende solo del gesto.
- **Sin toques con varios dedos para deshacer:** se disparan por accidente, e iOS ya usa los de tres dedos. Deshacer y rehacer están siempre a la vista.
- **El borde de la pantalla es de la hoja:** en el iPhone, la app instalada vuelve atrás al deslizar desde el borde; sobre la hoja ese gesto se bloquea.
- **Todo el movimiento es CSS** (regla 10): la hoja que entra al pasar y el anillo de enderezar. Seguir los dedos no es animación.

**Versión 2 del documento:** hojas y los elementos nuevos; la versión 1 se sigue leyendo y validando igual. El servidor se despliega antes que la app (ADR-0015): el worker acepta la versión 2 antes de que un teléfono la envíe. La app pasa a la versión 9. En el PDF, las hojas verticales van de a dos por fila y una apaisada ocupa la fila; con varias, cada una lleva su nombre. Oficina las muestra igual.

## Consecuencias

- **A favor:** la hoja pasa de unos 390 × 290 px a llenar la pantalla; croquis limpios sin dibujar a mano cada línea recta; cotas legibles; un piso por hoja; lo mismo en oficina y en el PDF; ninguna dependencia nueva.
- **En contra:** el reconocedor puede equivocarse (se mitiga: gesto explícito, "Deshacer" y el trazo a mano si no hay forma clara); los gestos no se ven en pantalla (se enseñan; el menú de hojas es el camino visible); la validación de las hojas viaja con el arranque de campo (1,6 KB comprimidos, 119 de 120 KB del presupuesto); el editor crece (se carga aparte).

## Cuándo revisarla

Los técnicos necesitan capas o escalas (evaluar Excalidraw o Konva, como decía ADR-0019); aparece la medición sobre el croquis; el presupuesto de arranque de campo no alcanza para la iteración 19.
