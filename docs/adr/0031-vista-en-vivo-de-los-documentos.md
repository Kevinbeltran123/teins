# ADR-0031 · Vista en vivo de los documentos desde las mismas plantillas del PDF

- **Estado:** Propuesta
- **Fecha:** 2026-10-01
- **Impulsores:** QA-17, QA-9, QA-12, I-28
- **Depende de:** ADR-0013, ADR-0029, ADR-0028

## Contexto

Oficina escribe el informe y la cotización sin ver el documento que va a recibir el cliente. Solo lo ve después de publicar, cuando la versión ya es inmutable (QA-9): un error de forma obliga a publicar otra versión. Kevin vio en el prototipo de la base Precisión la cotización con su hoja al lado, actualizándose al escribir, y pidió llevarlo a todos los documentos (plan de entrega, "Propuesta · Vista en vivo de los documentos").

Lo que hay hoy:

- Las plantillas del informe y la cotización viven en el servidor (`modulos/informes/pdf/plantilla.ts`, `modulos/cotizaciones/pdf/plantilla.ts`). Son funciones puras que solo dependen de `dominio` y de `escapar`. Chromium las imprime en el worker (ADR-0013).
- La vista previa de la cotización (iteración 24a) es un documento del servidor sobre lo **guardado**: hay que guardar para verla, y cada vistazo es una ida al servidor.
- La CSP de oficina permite estilos y fuentes solo del propio origen (`style-src 'self'`, `font-src 'self'`). Un marco `srcdoc` hereda esa CSP: no admite el `<style>` en línea ni la fuente incrustada en `data:` que usa la plantilla del PDF.
- La vista previa no puede separarse del PDF: si se dibuja con otro código, tarde o temprano muestra algo distinto de lo que se entrega.

## Opciones

| Opción | Descripción |
|---|---|
| A. El servidor dibuja la vista previa | Oficina manda el borrador sin guardar a un endpoint que devuelve el HTML de la plantilla, con espera entre teclas |
| B. Plantillas compartidas en un paquete | Las plantillas pasan a `paquetes/documentos`; el servidor las imprime y oficina las dibuja en el navegador, en un marco, sin ir al servidor |
| C. Componentes de React para la vista previa | Oficina dibuja la vista con sus componentes y el servidor sigue con sus plantillas |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C |
|---|---|---|---|
| La vista y el PDF no se separan (QA-17) | ● | ● | ○ |
| Se actualiza al escribir, sin esperas | ◐ | ● | ● |
| Funciona sin guardar y sin carga en el servidor (QA-14) | ○ | ● | ● |
| Fronteras claras entre paquetes (I-28) | ● | ◐ | ● |
| Cabe en la CSP actual de oficina | ● | ◐ | ● |

## Decisión

**B. Las plantillas de los documentos pasan a un paquete nuevo, `paquetes/documentos`, que usan el servidor para imprimir el PDF y oficina para la vista en vivo.**

1. **El paquete:** TypeScript puro, sin React y sin dependencias fuera de `dominio`. Exporta `plantillaInforme`, `plantillaCotizacion`, las de los mensajes de envío (correo y WhatsApp, hoy en `modulos/envios/mensajes.ts`), `escapar` y la hoja de estilos de los documentos como texto. `.dependency-cruiser.cjs` lo permite desde `servidor` y `oficina`; `campo` lo usará cuando muestre lo que oficina va a recibir.
2. **Una plantilla, dos salidas.** La plantilla recibe cómo llegan los estilos y la fuente:
   - **PDF (worker):** estilos en `<style>` y Geist incrustada en `data:`, como hoy (ADR-0013: el PDF no depende de las fuentes del servidor).
   - **Vista en vivo (oficina):** `<link rel="stylesheet">` a `documentos.css` y la fuente por su archivo, los dos servidos por oficina, así la CSP no cambia.
3. **El marco:** la vista vive en un `<iframe>` del mismo origen, con `sandbox` sin scripts. Se arma una vez; al escribir se reemplaza solo el cuerpo del documento en el siguiente cuadro, sin recargar el marco ni perder el desplazamiento.
4. **Lo que se ve es aproximado y lo dice:** hoja carta continua a su ancho, reducida para caber, sin cortes de página. Arriba, "Vista previa: el PDF puede partir las páginas distinto". El PDF congelado al publicar sigue siendo la fuente de verdad (ADR-0013).
5. **Fotos y planos:** las fotos por las direcciones firmadas que oficina ya usa (`img-src` admite el almacenamiento). Los planos PDF anexos se muestran como una ficha con su nombre y su número de páginas: no se dibujan.
6. **Orden de entrega:** cotización, con su pestaña "Correo"; después el informe; después los envíos; después la revisión (el capítulo del informe con el dato corregido resaltado). La vista previa del servidor de la iteración 24a sale cuando la cotización tenga la suya.

## Por qué gana a cada alternativa

- **Frente a A:** cada tecla sería una ida al servidor, con espera, y la vista no funcionaría con la conexión cortada un momento. Además, el endpoint recibiría borradores sin guardar solo para dibujarlos.
- **Frente a C:** dos implementaciones del mismo documento se separan. El primer cambio a la plantilla del PDF que no se repita en React hace que la vista muestre algo que el cliente no recibe, que es justo el error que se quiere evitar.

## Consecuencias

- **A favor:** la vista y el PDF salen del mismo código. Oficina ve el documento al escribir y corrige antes de publicar, cuando todavía no es inmutable. El servidor deja de tener un endpoint de vista previa.
- **En contra:** las plantillas dejan de vivir junto a su módulo del servidor (mitigación: el paquete solo tiene plantillas puras y sus pruebas, y el servidor las importa como importa `dominio`). La plantilla gana un parámetro de salida (mitigación: una prueba compara el HTML de las dos salidas, que solo deben diferir en cómo llegan estilos y fuente). Oficina carga el código de las plantillas (mitigación: se carga aparte, al abrir un documento).

## Cuándo revisarla

- Si la diferencia entre la vista continua y el PDF paginado confunde a oficina: dibujar hojas carta con los saltos calculados.
- Si TEINS entrega su plantilla (P29) con un formato que el HTML no reproduce bien.
- Si `campo` necesita la vista sin conexión y el paquete le pesa más de lo que permite su presupuesto (ADR-0030).
