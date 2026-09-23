# ADR-0019 · Bocetos como trazos vectoriales propios, dibujados con perfect-freehand

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-1, QA-15, QA-16, QA-17, F3, R2, R7
- **Depende de:** ADR-0004, ADR-0007, ADR-0011, ADR-0013

## Contexto

Hoy los técnicos dibujan a mano sobre papel cuadriculado para dar contexto espacial a medidas y equipos. El cliente pidió dibujar con dedo y con lápiz (P14) sobre cuadrícula desde el dispositivo. El modelo de dominio separa **boceto** (captura rápida en campo) de **plano** (ingeniería de oficina, fuera del sistema).

Un boceto debe: funcionar sin conexión, responder sin retraso al trazo en un celular de gama media, verse nítido en el PDF y poder editarse mientras el levantamiento es borrador.

## Parte 1 · Representación

| Opción | Descripción |
|---|---|
| A. Imagen rasterizada (PNG) | Se guarda el resultado del lienzo |
| **B. Trazos vectoriales + imagen derivada** | Se guardan los puntos de cada trazo; la imagen se genera a partir de ellos |
| C. SVG editado directamente | El boceto es un documento SVG |

| Criterio | A | B | C |
|---|---|---|---|
| Editable en borrador (deshacer, borrar un trazo) | ○ | ● | ◐ |
| Nítido en el PDF a cualquier tamaño (QA-17) | ○ | ● | ● |
| Tamaño en almacenamiento y transferencia | ◐ | ● | ◐ |
| Simplicidad | ● | ◐ | ○ |

**Decisión: B.** El boceto se guarda como JSON: cuadrícula de fondo, trazos (puntos con presión, herramienta, grosor), líneas rectas y etiquetas de texto. En el PDF se convierte a SVG, así que se ve nítido y pesa poco. Las miniaturas para oficina se generan a partir del mismo JSON.

## Parte 2 · Motor de dibujo

| Opción | Descripción |
|---|---|
| **A. Lienzo propio + perfect-freehand** | Pointer Events y canvas propios; perfect-freehand (MIT, muy pequeña) convierte puntos con presión en trazos naturales |
| B. Excalidraw | Pizarra completa de código abierto |
| C. tldraw | SDK de lienzo infinito muy completo |
| D. Konva o Fabric.js | Bibliotecas generales de lienzo |

| Criterio | A | B | C | D |
|---|---|---|---|---|
| Peso en el paquete de `campo` (QA-16, ADR-0011) | ● | ○ | ○ | ◐ |
| Licencia compatible con vender el producto (R7) | ● | ● | ○ | ● |
| Ajustado a lo que el técnico necesita (QA-15) | ● | ◐ | ◐ | ◐ |
| Presión del lápiz y rechazo de la palma | ● | ● | ● | ◐ |
| Esfuerzo | ◐ | ● | ● | ◐ |

**Decisión: A.**

- **Frente a B:** es excelente, pero trae una pizarra completa (formas, colaboración, bibliotecas) que pesa mucho frente al presupuesto de `campo`. Su interfaz está pensada para diagramas, no para un croquis rápido en campo.
- **Frente a C:** desde su versión 4.0 el SDK requiere una clave de licencia en producción: comercial para uso comercial, o una licencia *hobby* solo para proyectos no comerciales. Incompatible con R7 sin pagar.
- **Frente a D:** viables, pero son marcos generales de lienzo; para trazos a mano alzada, perfect-freehand resuelve lo difícil (trazos naturales con presión) con una fracción del código.

### Herramientas de la primera versión

| Herramienta | Por qué |
|---|---|
| Trazo libre | El uso principal |
| Línea recta | Paredes y recorridos de cable: los croquis de campo son mayormente líneas rectas |
| Texto | Anotar medidas y nombres de equipos sobre el croquis |
| Borrador por trazo | Quitar un trazo completo, no píxeles |
| Deshacer y rehacer | Básico en pantallas táctiles |
| Cuadrícula | Reproduce el papel cuadriculado actual |

**Fuera de alcance:** capas, formas geométricas, escalas y medición automática. Eso es terreno del plano de oficina.

### Entrada

- **Pointer Events** para dedo y lápiz, con presión cuando el dispositivo la reporta.
- **Rechazo de la palma:** si se detecta un lápiz, se ignoran los toques de dedo mientras dibuja.
- Zoom y desplazamiento con dos dedos, sin interferir con el trazo.

## Parte 3 · Almacenamiento y sincronización

- Mientras es borrador, el boceto vive en IndexedDB y cada cambio se guarda al instante (ADR-0004).
- **A diferencia de las fotos, los bocetos no suben por adelantado.** Son editables durante el borrador: cada versión intermedia generaría un archivo distinto y huérfanos innecesarios. Como pesan poco, suben al enviar, como un archivo inmutable direccionado por contenido (ADR-0007).

## Consecuencias

- **A favor:** croquis nítidos en el PDF, editables en borrador y livianos; sin dependencias pesadas ni licencias comerciales; herramientas ajustadas al trabajo real de campo.
- **En contra:** hay que construir el editor (acotado por las seis herramientas); la experiencia con lápiz se valida en tabletas reales.

## Cuándo revisarla

Los técnicos necesitan formas, capas o escalas (evaluar Excalidraw o Konva); aparece la necesidad de medir sobre el croquis (terreno del plano de oficina).
