[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 20 · Contactos del cliente e informe por correo y WhatsApp](20-informe-por-correo-y-whatsapp.md) · Siguiente: [Iteración 22 · Campo rehecho con la dirección Recorrido](22-campo-recorrido.md)

# Iteración 21 · Cotizaciones desde las cantidades

**Estado en el mapa al 2026-10-16:** Terminada y desplegada en el entorno de pruebas (precios de prueba; faltan los de TEINS)

**Estado:** terminada el 2026-09-27, verificada en local y desplegada en el entorno de pruebas (ver "Terminado cuando"). Maquetas aprobadas por Kevin en el lienzo (página "v1.1 · Cotizaciones", "Sí, aprobadas"); decidió que los precios los cambia solo administración.

**Para qué:** de la visita revisada a una cotización con PDF y envío, sin volver a digitar las cantidades (P27, QA-12).

## Alcance

- **Lista de precios con historia (ADR-0029, parte 1):** en "Catálogo", la columna "Precio sin IVA" y el filtro "Solo los que no tienen precio"; "Cambiar precio" (solo administración con segundo factor) abre la hoja lateral con la historia. Importar el CSV con una columna de precio también es de administración; para el resto de oficina, el archivo entra sin precios y lo dice. Los precios nunca bajan al teléfono (regla 7).
- **Módulo `cotizaciones` (ADR-0029, parte 2):** "Cotizaciones" en la navegación. "Nueva cotización" elige una visita con levantamientos revisados; las líneas salen de sus cantidades, sumadas por ítem y unidad, con el precio vigente. Oficina cambia cantidad y precio por línea (se ve el del catálogo si lo cambió), agrega líneas (mano de obra), quita con "Deshacer", elige IVA sobre el subtotal o AIU con IVA sobre la utilidad, y fija validez, forma de pago y notas.
- **Pesos enteros:** el cálculo vive en el dominio, con `BigInt`; la pantalla y el servidor usan el mismo. Una línea sin precio impide publicar, y el aviso está junto a la línea.
- **Numeración `COT-{año}-{consecutivo}`,** por organización y año, sin repetirse.
- **Versiones inmutables con PDF** (cola `pdf`, carta, con la marca), y envío por correo como el informe (ADR-0028): cada contacto marca si recibe informes, cotizaciones o los dos, y al publicar se marcan quienes reciben cotizaciones.
- **La impresión a PDF pasó a `plataforma/pdf.ts`:** un módulo no importa las partes internas de otro.

## Fuera de la iteración 21

| Qué | Dónde se resuelve |
|---|---|
| Lista de precios, plantilla (P29), tratamiento tributario, forma de pago y numeración de TEINS | Cuando TEINS los entregue: la lista se importa por CSV (administración); la numeración cambia en `numeroDeCotizacion` |
| Estado comercial de la cotización (aceptada, rechazada) y su retiro | Si TEINS lo pide |
| Cotizaciones en el portal del cliente | Si TEINS lo pide: hoy el portal solo muestra informes |
| WhatsApp de la cotización (plantilla `cotizacion_publicada`) | Con la cuenta de Meta, como el del informe |
| Contar los símbolos del croquis como cantidades | Si TEINS lo pide: el código de catálogo ya viaja en cada símbolo puesto |
| Precios de prueba en `sembrar` | No hacen falta: el entorno de pruebas los pone administración desde "Catálogo" |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Kevin aprueba las maquetas | Hecho el 2026-09-27 |
| 2. El cálculo es exacto en pesos enteros: línea, porcentajes, IVA, AIU con IVA sobre la utilidad, líneas sin precio, validación y numeración | Hecho: `dominio/src/cotizacion.test.ts` |
| 3. Solo administración cambia o importa precios; la historia se conserva y reimportar el mismo precio no la ensucia | Hecho: `servidor/pruebas/cotizaciones.test.ts` |
| 4. La cotización toma las cantidades revisadas con el precio vigente, se numera, no se publica sin precios, se publica congelada (cambiar la lista después no la toca; la base no deja modificarla) con su PDF, y su envío sale como cotización | Hecho: `servidor/pruebas/cotizaciones.test.ts` y `envios.test.ts` |
| 5. Extremo a extremo: administración pone el precio, el técnico anota el material, oficina revisa, crea la cotización, agrega mano de obra, elige AIU, publica y descarga el PDF, y el contacto de compras la recibe | Hecho en Chromium y WebKit (`e2e/pruebas/cotizaciones.spec.ts`) |
| 6. Lo anterior sigue igual | Hecho el 2026-09-27: tipos, arquitectura, licencias y auditoría en verde; dominio 103, protocolo 18, oficina 6, campo 80, servidor 134; extremo a extremo 40 y 3 omitidas en Chromium y WebKit (la de cotizaciones falló una vez en WebKit porque el nombre del PDF llega en forma NFD, como en macOS; la prueba ahora lo normaliza); campo sigue en 119,9 de 120 KB |
| 7. Desplegada en el entorno de pruebas | Hecho el 2026-09-27: el worker en `SUCCESS` (con `cotizaciones.generarPdf`) antes que la app; campo (que aplicó `0026` y `0027`), oficina y portal en `SUCCESS` y salud en 200. Contra el entorno, `cotizaciones.spec` e `informe-al-cliente.spec` en verde en Chromium, con el correo de la cotización saliendo por Resend |

## Decisiones tomadas al construirlo

- **Puede haber más de una cotización por visita** (alternativas); la hoja de "Nueva cotización" dice cuáles ya tiene.
- **El borrador guarda la cantidad y el precio de cada línea;** la versión publicada guarda además sus totales calculados, así el PDF y la lista no recalculan.
- **En pantallas de menos de 1600 px, los totales y la publicación van debajo de las líneas,** en dos columnas: la tabla de líneas no cabe al lado del panel a 1366 px.
- **Las pruebas del servidor de cotizaciones no procesan envíos:** la cola es compartida y el correo de la cotización se prueba en `envios.test.ts`.
- **Quitar una línea no pide confirmación:** se deshace con la notificación (DESIGN.md).
