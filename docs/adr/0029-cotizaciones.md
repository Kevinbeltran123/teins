# ADR-0029 · Cotizaciones desde las cantidades revisadas, con lista de precios con historia y versiones inmutables

- **Estado:** Aceptada
- **Fecha:** 2026-09-27
- **Impulsores:** F9, P27, P29, QA-9, QA-12, R5
- **Depende de:** ADR-0009, ADR-0012, ADR-0013, ADR-0025, ADR-0028

## Contexto

Hasta la iteración 20, los materiales que el técnico anota (iteración 11) y vincula al catálogo desde el teléfono (iteración 17) llegaban a oficina como cantidades exportables a Excel, sin precios: la regla 7 prohíbe precio en la línea de cantidad y QA-12 pide que precios y presupuestos lleguen como un módulo nuevo que no toque la captura ni la sincronización. Kevin eligió las cotizaciones en el plan de las iteraciones 15 a 21 (2026-09-26) y aprobó sus maquetas el 2026-09-27 (lienzo, página "v1.1 · Cotizaciones"), con los precios editables solo por administración.

Hechos que condicionan la decisión:

- **Las cantidades corregidas viven en `levantamientos.lineas_cantidad`** con su vínculo al catálogo; solo las de levantamientos revisados son definitivas.
- **El AIU no aplica a la instalación ni al mantenimiento de redes eléctricas** según la DIAN: la cotización admite IVA sobre el subtotal o AIU con IVA sobre la utilidad, y decide el contador de TEINS.
- **TEINS no ha entregado** su lista de precios, su plantilla (P29), su tratamiento tributario ni su numeración: se construye con datos ficticios y marcadores.
- **El PDF y el envío ya existen** para el informe (ADR-0013, ADR-0028).

## Parte 1 · Dónde viven los precios

| Opción | Descripción |
|---|---|
| A. Columna de precio en el ítem | Un valor por ítem; cambiarlo pisa el anterior |
| **B. Tabla de precios del catálogo con historia** | `catalogo.precios`: cada cambio agrega un precio vigente desde su fecha, con quién lo puso |
| C. Solo precio dentro de cada cotización | Sin lista: oficina escribe todos los precios cada vez |

**Decisión: B.** El precio vigente es el más reciente. Cambiarlo exige administración con segundo factor (Kevin, 2026-09-27): un precio mal puesto sale en todas las cotizaciones nuevas. Importar el catálogo con una columna de precio también lo exige. Los precios nunca bajan al teléfono: el esquema del catálogo en la bajada no los lleva (regla 7).

- **Frente a A:** una cotización vieja no explicaría de dónde salió su precio, y un error no se podría rastrear.
- **Frente a C:** es volver a digitar, justo lo que la iteración quiere evitar (P27).

## Parte 2 · Módulo `cotizaciones`, borrador y versiones

1. **Módulo propio** (`cotizaciones`), con su esquema: la cotización (borrador editable, concurrencia optimista), sus versiones publicadas (copia congelada, como el informe) y el consecutivo por organización y año.
2. **Se crea desde una visita con levantamientos revisados.** Las líneas salen de sus cantidades revisadas, sumadas por ítem y unidad (lo no vinculado, por descripción y unidad), con el precio vigente; lo que no tiene precio queda vacío. Oficina puede cambiar el precio de una línea solo para esa cotización (se ve cuál era el del catálogo), agregar líneas (mano de obra, transporte) y quitar líneas. Puede haber más de una cotización por visita.
3. **Impuestos por cotización:** IVA 19 % sobre el subtotal, o AIU con sus tres porcentajes e IVA 19 % sobre la utilidad.
4. **Todo en pesos enteros** (`dominio/src/cotizacion.ts`): total de línea = cantidad × precio, redondeado al peso (mitad hacia arriba); cada impuesto se redondea al peso. Las cantidades son decimales exactos y el cálculo va en `BigInt`: nada pasa por coma flotante.
5. **Publicar** exige líneas, todas con precio, y porcentajes entre 0 y 100. La versión congela líneas, precios, impuestos, totales y condiciones: cambiar la lista de precios después no la toca (regla 7 de las versiones inmutables). Corregir es publicar una versión nueva.
6. **Numeración `COT-{año}-{consecutivo de 4 cifras}`**, por organización, asignada al crear el borrador desde una tabla de consecutivos que se incrementa en la misma transacción: nunca se repite ni se reutiliza. Cuando TEINS entregue su formato, cambia la función `numeroDeCotizacion`.

## Parte 3 · PDF y envío

- **El PDF lo genera el worker** en la cola `pdf`, igual que el informe (ADR-0013). La impresión HTML a PDF con Chromium pasa de `informes` a `plataforma/pdf.ts`, porque un módulo no importa las partes internas de otro; `informes` la usa desde ahí sin cambios.
- **El envío es el de ADR-0028:** el mensaje lleva el tipo de documento (informe o cotización) y el correo cambia su asunto y su texto; sin el botón del portal, que solo muestra informes. WhatsApp usa su propia plantilla (`cotizacion_publicada`), que espera la cuenta de Meta.
- **Cada contacto elige qué recibe:** informes, cotizaciones o los dos (por ejemplo, compras recibe cotizaciones y mantenimiento, informes). Al publicar se marcan por omisión quienes reciben ese documento; se puede enviar a cualquier contacto con un canal.

## Consecuencias

- **Positivas:** de la visita revisada a una cotización con PDF y envío, sin volver a digitar; el precio de cada línea se explica (lista vigente o cambio de oficina) y lo publicado no cambia.
- **Negativas:** una cotización no se retira ni aparece en el portal; si hace falta, es otra iteración. Las cotizaciones no tienen estado comercial (aceptada, rechazada).
- **Pendiente de TEINS:** lista de precios, plantilla (P29), tratamiento tributario por tipo de trabajo, forma de pago y numeración.
