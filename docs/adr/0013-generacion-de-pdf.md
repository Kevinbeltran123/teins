# ADR-0013 · PDF desde plantillas HTML con navegador sin interfaz, unido a los planos y almacenado al publicar

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-9, QA-17, QA-18, QA-19, F7, I-30, R6, R7
- **Depende de:** ADR-0006, ADR-0007, ADR-0012

## Contexto

El informe PDF es el entregable que ve el cliente. Debe incluir datos del levantamiento, tablas de cantidades, fotos, bocetos y **los planos que oficina adjunta en PDF**, que deben quedar como páginas del mismo documento. QA-17 exige que un informe publicado produzca siempre el mismo PDF, y la generación ocurre en segundo plano (ADR-0012).

## Opciones

| Opción | Descripción |
|---|---|
| **A. HTML y CSS con navegador sin interfaz (Playwright + Chromium)** | Plantillas web renderizadas a PDF por Chromium |
| B. React-PDF | Componentes React con motor de maquetación propio |
| C. pdfmake | Documento descrito en JSON |
| D. pdf-lib (bajo nivel) | Construcción página por página |
| E. Typst | Lenguaje de composición moderno, compilador rápido |
| F. LaTeX | Composición tipográfica clásica |
| G. Servicio comercial de PDF | API externa |
| H. Generación en el navegador del usuario | PDF creado en el dispositivo de oficina |
| iText | **Descartada de entrada:** licencia AGPL, incompatible con vender el producto (R7) |

## Evaluación

| Criterio | A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|---|
| Diseño rico: tablas, cuadrículas de fotos, saltos de página | ● | ◐ | ◐ | ○ | ● | ● | ● | ◐ |
| Mantenible con conocimientos web comunes (QA-18) | ● | ● | ◐ | ○ | ○ | ○ | ● | ● |
| Consumo de recursos en el *worker* (QA-19) | ○ | ● | ● | ● | ● | ◐ | ● | ● |
| Velocidad de generación | ◐ | ● | ● | ● | ● | ◐ | ◐ | ◐ |
| Reutiliza componentes y estilos del sistema | ● | ◐ | ○ | ○ | ○ | ○ | ○ | ● |
| Datos dentro de la infraestructura de TEINS (Ley 1581) | ● | ● | ● | ● | ● | ● | ○ | ● |
| Resultado igual sin importar el equipo que genera | ● | ● | ● | ● | ● | ● | ● | ○ |
| Licencia sin restricciones comerciales (R7) | ● | ● | ● | ● | ● | ● | ◐ | ● |

## Decisión

**A. Plantillas HTML y CSS renderizadas con Chromium sin interfaz (Playwright) en el rol *worker*, y pdf-lib para anexar los planos.**

Flujo:

1. `InformePublicado` encola `generarPdf(versionId)` en la cola `pdf`, que procesa de a uno para acotar la memoria (ADR-0012).
2. El trabajo arma el HTML desde la **copia congelada** de la versión, nunca desde datos vivos. Usa las miniaturas en resolución de impresión, no los originales, para controlar el tamaño del archivo.
3. Chromium genera el PDF con encabezado, pie y numeración de páginas.
4. pdf-lib **anexa las páginas de los planos PDF** en el orden definido por oficina y fija los metadatos del documento.
5. El PDF se guarda en el almacenamiento de objetos con su huella (ADR-0007), y la huella queda registrada en la versión.
6. **La versión solo aparece en el portal cuando su PDF existe.** "Publicada" y "visible para el cliente" son estados distintos; un fallo de generación nunca muestra un informe incompleto.

### Reproducibilidad por almacenamiento, no por renderizado

QA-17 se cumple **guardando el PDF generado al publicar**, no confiando en que el renderizador produzca exactamente los mismos bytes años después. Una versión publicada nunca se vuelve a generar. Por eso importa menos que Chromium cambie entre versiones: lo entregado ya quedó fijo.

Para que la generación sea estable de todas formas: fuentes abiertas **incrustadas** en la plantilla (sin depender de las fuentes del servidor), versión de Chromium fijada en la imagen de despliegue y plantillas versionadas junto con el código.

## Por qué gana a cada alternativa

- **Frente a B:** más liviana y rápida, y reutiliza React. Pero su motor de maquetación es propio y limitado frente a CSS (cuadrículas de fotos, control de saltos de tabla), y los estilos del sistema no se reutilizan. **Es el plan B** si Chromium resulta demasiado pesado para la infraestructura elegida.
- **Frente a C y D:** describir un informe complejo en JSON o página por página es más código y más difícil de mantener. pdf-lib sí se usa, solo para anexar planos.
- **Frente a E:** es rápida, liviana y produce excelente tipografía, pero es un lenguaje de nicho: quien mantenga el sistema tendría que aprenderlo solo para cambiar un informe (QA-18).
- **Frente a F:** misma objeción, con más peso de instalación.
- **Frente a G:** los datos del cliente saldrían de la infraestructura de TEINS, con costo por documento y dependencia del proveedor.
- **Frente a H:** el resultado dependería del navegador y del equipo de quien publica, y la generación ocurriría en un equipo que no controlamos.

## Consecuencias

- **A favor:** cualquier desarrollador web puede modificar la plantilla; diseño rico con CSS; planos integrados en el mismo documento; el PDF entregado es inmutable y verificable por su huella.
- **En contra:** Chromium consume varios cientos de MB de memoria por instancia. Se mitiga con la cola en serie y ejecutándolo solo en el *worker*. La imagen de despliegue crece por incluir el navegador.

## Cuándo revisarla

La memoria del *worker* encarece la infraestructura (pasar a React-PDF); el volumen de informes crece mucho (varios *workers* o un servicio de renderizado aparte); TEINS necesita editar la plantilla sin un desarrollador.
