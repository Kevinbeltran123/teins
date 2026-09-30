# ADR-0027 · Símbolos de los bocetos: biblioteca como datos de la organización, copiada en el boceto que la usa

- **Estado:** Aceptada
- **Fecha:** 2026-09-26
- **Impulsores:** QA-11, QA-16, QA-17, R7
- **Depende de:** ADR-0006, ADR-0015, ADR-0025, ADR-0026

## Contexto

Kevin pidió que el técnico no dibuje cada vez lo mismo: tableros, UPS, tomas, luminarias, racks. En un plano eléctrico esas piezas son siempre iguales, y dibujarlas a mano en el teléfono es lento y queda distinto entre técnicos. Las maquetas (lienzo, página "v0.9 · Símbolos en el croquis") se aprobaron: un botón "Símbolos" abajo a la derecha abre la biblioteca (buscar, recientes y por categoría) y el símbolo cae en el centro de lo que se ve, elegido con "Mover".

Hechos:

- La lista de símbolos es de TEINS (R7): no puede estar en el código, igual que los formatos y el catálogo.
- El teléfono trabaja sin conexión: la biblioteca tiene que estar en él antes de dibujar.
- El boceto es un documento inmutable por su huella (ADR-0007) que oficina y el PDF dibujan sin el editor.
- El JavaScript inicial de campo está en 119 de 120 KB.

## Decisión

### Dónde vive la biblioteca

| Opción | Descripción |
|---|---|
| **A. Datos de la organización, publicados desde un archivo y bajados como el catálogo** | Tabla por organización; `publicar-simbolos` la publica completa; cambio `simbolo` en la bajada, desde la app 10 |
| B. En el código de campo | Cada cambio exige publicar la app; la lista de TEINS quedaría en el repositorio |
| C. Pantalla de oficina para crear símbolos | Dibujar trazados SVG en oficina es trabajo de diseño, no de revisión; hoy no hay quién lo use |

**Decisión: A.** Es el camino de los formatos (se publican desde un archivo y llegan sin publicar la app, QA-11) y del catálogo (ADR-0025: baja entero a la app que lo entiende y un cambio lo vuelve a mandar). Publicar reemplaza la biblioteca: lo que ya no está se retira (`activo = false`) y nunca se borra. El orden del archivo es el de la pantalla. Una pantalla de oficina (C) se evalúa si TEINS cambia sus símbolos a menudo.

### Qué es un símbolo

Un dibujo en una caja de 100 × 100: un **trazado** SVG (líneas, sin relleno), un **relleno** opcional y una **sigla** opcional en el centro ("UPS", "kWh", hasta 4 caracteres), con nombre, categoría y un código de catálogo opcional (para contarlo algún día como cantidad). El trazado se valida como geometría y nada más: empieza con `M`, solo comandos de trazado y números de hasta 1.000, y 2.000 caracteres como máximo. Así, lo que llega al SVG del PDF no puede ser otra cosa.

### Cómo entra en el boceto

| Opción | Descripción |
|---|---|
| **A. Se copia el dibujo en el elemento** | `{ tipo: "simbolo", simbolo, nombre, trazado, relleno?, texto?, codigo?, centro, tamano, giro }` |
| B. Solo la referencia al símbolo | Oficina y el PDF tendrían que buscarlo en la biblioteca vigente |

**Decisión: A.** El boceto se ve igual para siempre aunque la biblioteca cambie o retire el símbolo, y se valida y se dibuja sin consultar nada más (como la firma lleva su constancia, ADR-0024). Cuesta unos cientos de bytes por símbolo puesto.

- **El trazo mide lo mismo en la hoja a cualquier tamaño** (5 unidades, como las formas): el ancho de línea se divide por la escala.
- **Mover, girar, cambiar el tamaño y duplicar** funcionan como con las formas (ADR-0026); un símbolo se toma por dentro, no por su borde.
- **El documento sigue en la versión 2:** el validador del servidor acepta el elemento nuevo y se despliega antes que la app 10 (ADR-0015); ninguna app anterior lee bocetos de otro teléfono.

### En el teléfono

La biblioteca se guarda sin sellar (base local versión 6), como el catálogo: no es dato de un cliente. "Recientes" son los últimos que se pusieron en ese teléfono, guardados en el almacenamiento del navegador: si no lo hay (navegación privada), no hay recientes y nada más cambia. La hoja de la biblioteca va con el editor; los símbolos los lee la captura, porque leer la base desde el editor partía el JavaScript inicial de campo.

## Consecuencias

- **A favor:** croquis iguales entre técnicos y más rápidos; TEINS cambia sus símbolos sin publicar la app; un boceto nunca cambia después de hecho.
- **En contra:** la lista real depende de TEINS (mientras, una biblioteca de prueba ficticia de 21 símbolos); quien publica tiene que escribir trazados SVG; el JavaScript inicial de campo queda en 119,9 de 120 KB.

## Cuándo revisarla

TEINS cambia sus símbolos a menudo (pantalla de oficina); los técnicos necesitan símbolos propios; se cuentan los símbolos como cantidades (el código de catálogo ya viaja en el elemento); el presupuesto de campo no alcanza (sacar la validación del boceto del arranque).
