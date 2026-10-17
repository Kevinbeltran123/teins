[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 8 · Producción provisional, copias y simulacro](08-produccion-provisional.md) · Siguiente: [Iteración 10 · Bocetos](10-bocetos.md)

# Iteración 9 · Secciones repetibles

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas; falta la prueba en iPhone

**Estado:** terminada y desplegada en el entorno de pruebas el 2026-09-25 (Kevin: "Yes. start.", después de validar el iPhone); falta la prueba en el iPhone. Producción sigue con la versión anterior hasta que Kevin decida actualizarla.

**Para qué:** que un formato tenga secciones que el técnico repite cuantas veces haga falta (pisos, áreas, tableros), cada una con su nombre y los mismos campos (F2 en `01-impulsores.md`; ADR-0006 ya reserva `repetible` en el formato). Los formatos reales de TEINS casi seguro lo necesitan: con esto, llegan como datos y no como código (QA-11).

## Alcance

- **Formato:** una sección puede declarar `repetible: { etiqueta, min, max }`, por ejemplo `{ "etiqueta": "Tablero", "min": 0, "max": 20 }`. El meta-esquema lo valida y exige `appMinima` 4: una app anterior no lo recibe (ADR-0015, punto 4).
- **Campo (app 4):** en una sección repetible, "Agregar tablero", cada repetición con su nombre (por defecto "Tablero 1", "Tablero 2"; se puede cambiar) y "Quitar" con confirmación. El levantamiento nace con las `min` repeticiones.
- **Validación, en el teléfono y en el servidor:** cada repetición con sus campos obligatorios, y el número de repeticiones entre `min` y `max`.
- **Oficina:** revisa y corrige cada repetición por separado; el historial dice en cuál ("Tableros · Tablero 2 · Corriente nominal"). Oficina no agrega ni quita repeticiones: eso es captura.
- **Informe y PDF:** cada repetición con su nombre, en orden.

## Fuera de la iteración 9

| Qué | Dónde se resuelve |
|---|---|
| Secciones repetibles dentro de otra repetible (pisos con áreas) | Cuando un formato real de TEINS lo pida |
| Reordenar repeticiones | Cuando TEINS lo pida; hoy quedan en el orden en que se agregan |
| Bocetos | Iteración siguiente (ADR-0019) |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: el técnico agrega dos tableros, los llena y envía; oficina ve los dos con su nombre, corrige uno y el historial dice cuál; el PDF los muestra en orden | Cumplido el 2026-09-25 en Chromium y WebKit en local y en Chromium contra el entorno (`e2e/pruebas/repeticiones.spec.ts`); el orden en el PDF, en integración (`pruebas/repeticiones.test.ts`) |
| 2. Un formato con sección repetible no llega a una app anterior, y una definición inválida no se publica | Cumplido en integración (la bajada con app 3 no lo trae; sin `appMinima` 4 no se publica) |
| 3. El servidor rechaza repeticiones de menos o de más, campos obligatorios vacíos en una repetición y claves de repetición que no existen | Cumplido en integración y en `dominio` |
| 4. Los formatos y levantamientos sin secciones repetibles funcionan igual que antes | Cumplido: toda la suite anterior en verde (17 de 17 en el extremo a extremo, más el salto conocido) |
| 5. Probado en el iPhone | Pendiente: fase 9 de [`verificacion-manual.md`](../verificacion-manual.md) |

## Decisiones tomadas al construirlo

- **Cómo se guardan las respuestas:** cada repetición es una clave más del mismo mapa de respuestas, `seccion~id` (por ejemplo `tableros~k3f9x2ab`), y el levantamiento lleva aparte la lista ordenada `repeticiones` con el id y el nombre de cada una. Se descartó guardar un arreglo por sección: cambiaba la forma de las respuestas en todo el sistema y la ruta de una corrección dependería de la posición, que cambia al quitar una repetición. Con un id estable, la auditoría y las correcciones siguen diciendo `seccion.campo`, y las fotos, la validación y el almacenamiento casi no cambian. `~` no es válido en una clave de sección, así que nunca choca.
- **App 4:** `campo` sube a `VERSION_APP = 4`. El meta-esquema exige `appMinima` 4 a todo formato con secciones repetibles, así que la bajada nunca se lo entrega a una app anterior (probado). Un levantamiento sin secciones repetibles viaja igual que antes: el comando solo lleva `repeticiones` si las tiene (ADR-0015, expansión).
- **Ids de repetición:** 8 caracteres en base 36 al azar, generados en `campo`; `dominio` sigue siendo TypeScript puro y los recibe como parámetro. El levantamiento nace con las `min` repeticiones.
- **Nombres:** por defecto "Tablero 1", "Tablero 2"; al agregar se usa el primer número libre, así que quitar "Tablero 2" y agregar otro no repite un nombre. Un nombre vacío no se guarda: se conserva el anterior.
- **Quitar** pide confirmación y borra las respuestas de esa repetición; las fotos quedan en el teléfono hasta que nada las use, como siempre.
- **Oficina** ve cada repetición como una sección con su nombre y, si la sección quedó vacía, "El técnico no agregó ninguno". Corrige y comenta solo en repeticiones que existen; el servidor rechaza una clave de repetición que no está en la lista. La auditoría guarda la ruta con el id (`tableros~id.ubicacion`) y oficina y campo la muestran con el nombre ("Tableros · Tablero 2 · Ubicación del tablero").
- **Límites:** hasta 50 repeticiones por sección si el formato no pide menos; nombre de hasta 120 caracteres. `LIMITES` pasó a su propio archivo en `dominio` para no crear un ciclo entre `levantamiento` y `validacion`.
- **Formato de prueba v4:** `prueba-ups` v3 más la sección repetible "Tableros" (0 a 10, con ubicación y corriente obligatorias y una foto opcional). Con mínimo 0, los recorridos existentes no cambian.

## Al cerrarla

**Iteración 9 terminada el 2026-09-25:** secciones repetibles de campo al PDF, desplegadas en el entorno de pruebas con el formato de prueba v4 ("Tableros"). Falta probarlas en el iPhone (fase 9 de la guía). Producción sigue con la versión anterior.
