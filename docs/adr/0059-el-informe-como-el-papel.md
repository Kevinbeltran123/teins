# ADR-0059 · El informe como el papel: el formato describe su distribución

- **Estado:** Aceptada
- **Fecha:** 2026-11-07
- **Impulsores:** QA-9, regla 6, regla 7, regla 11, P22, P23
- **Depende de:** ADR-0013, ADR-0031, ADR-0039, ADR-0050, ADR-0051

## Contexto

El informe dibuja cada formato de la misma forma: una portada azul, y después cada sección apilada como una tabla de «pregunta y respuesta». Los formatos de TEINS en papel tienen otra forma:

- **Servicio de UPS:** cabe en una hoja oficio. Cargador, Inversor, Generales y Causas del correctivo van en cuatro columnas, una al lado de la otra, y las firmas al pie.
- **Visita técnica:** tiene cajas grandes para estado inicial, diagnóstico y corrección, y tres columnas de firma.

El cliente de TEINS conoce esos papeles. Además, TEINS no ha mandado un informe de ejemplo (P22, P23), y lo acordado si no llega es que el informe «sigue la estructura del formato en papel» (`docs/entrega/pendientes-de-teins.md`, punto 8). Kevin aprobó en el lienzo la maqueta de los dos («v1.3 · Informe como el papel»), con estas decisiones:

- la estructura del papel con el estilo TEINS, en una sola fuente;
- sin portada;
- la introducción y las conclusiones, solo si oficina las escribe.

Lo que lo hace difícil:

- Los formatos son datos (regla 6): una plantilla escrita a mano por formato los ata al código.
- Las versiones publicadas no cambian (regla 7).
- Oficina oculta partes (ADR-0039) y ve la vista en vivo (ADR-0031).
- Las fotos y los croquis no caben en la hoja.

## Opciones

| Opción | Descripción |
|---|---|
| A. Plantilla por formato | Un HTML escrito a mano para cada formato de TEINS |
| B. Distribución en el formato | Un bloque `informe` opcional en el formato: título, hoja y filas de secciones lado a lado; el resto, en anexos |
| C. Distribución aparte | La misma distribución, publicada aparte del formato y copiada en la versión al publicar el informe |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| Un formato nuevo no exige código (regla 6) | ○ | ● | ● |
| Una versión publicada no cambia (regla 7) | ◐ | ● | ● |
| Una sola cosa que publicar y versionar | ● | ● | ○ |
| Oficina puede ocultar partes igual que hoy | ◐ | ● | ● |

## Decisión

**B.**

- **Forma:** `informe?: { titulo?: string, hoja?: "carta" | "oficio", filas: { secciones: string[] }[] }` en el formato.
  - Cada fila pone de 1 a 4 secciones lado a lado. Cada sección va en su caja con barra de título, con sus datos en renglones, sus casillas en línea y sus tablas de medidas y de cantidades.
  - Al publicar se exige que cada sección exista, que aparezca una sola vez y que no sea repetible.
- **Anexos:** las fotos, los croquis y la constancia de la firma, y las secciones que no están en `filas`, salen después de la hoja, en «Anexos», con la forma de siempre.
- **Firmas:** al pie, en la fila de siempre (ADR-0051), con borde, como el papel.
- **Sin portada** cuando algún capítulo usa la distribución. La introducción y las conclusiones salen solo si oficina las escribió, y sin el marcador `[FIRMA]/[DATOS LEGALES]`.
- **Un dato vacío** sale como renglón en blanco, como el papel.
- **Un texto largo** hace crecer su caja: las firmas pasan a la hoja siguiente, nunca se corta el texto.
- **Hoja:** `oficio` usa una página con nombre (`@page oficio`); `carta`, la de siempre.
- Un formato sin el bloque, y toda versión ya publicada sin él, sale como hoy.
- **Lo oculto** (ADR-0039) se oculta igual: en la vista, como franja con «Mostrar» dentro de su caja; en el PDF, no sale.
- **Marca:** el eslogan y los datos de contacto del pie del papel son datos reales de TEINS. No van en el repositorio (regla 1); se agregarán con la marca por organización (ADR-0020).

## Por qué gana a cada alternativa

- **Frente a A:** cada formato nuevo, o cada versión nueva de uno, exigiría escribir y desplegar HTML.
- **Frente a C:** dos cosas que versionar y publicar en vez de una, sin un caso que lo pida. Ajustar la distribución sin tocar la captura es raro, y publicar una versión nueva del formato es barato.

## Consecuencias

- **A favor:** el cliente recibe lo que conoce del papel, y un formato nuevo trae su distribución sin código.
- **En contra:** cambiar la distribución exige publicar una versión nueva del formato, y los levantamientos hechos con la anterior salen con la distribución que tenía esa versión. Mitigación: es la regla 7, y el formato v2 de TEINS sale antes del piloto.
- **En contra:** la vista de oficina es aproximada (ADR-0031): con hoja oficio, la vista no marca los cortes de página exactos.

## Cuándo revisarla

- Una sección repetible necesita ir en la hoja (los tableros de otro formato): definir cómo se reparte cada repetición.
- TEINS manda su informe de ejemplo (P22, P23) y difiere del papel.
