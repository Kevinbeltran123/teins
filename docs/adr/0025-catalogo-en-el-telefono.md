# ADR-0025 · El catálogo baja al teléfono y la línea de cantidad puede llegar vinculada

- **Estado:** Aceptada
- **Fecha:** 2026-09-26
- **Impulsores:** QA-11, QA-12, QA-15, QA-16, QA-21, R5
- **Depende de:** ADR-0003, ADR-0006, ADR-0015, ADR-0022

## Contexto

En la iteración 11 el catálogo se quedó en oficina: el técnico escribe cada material a mano y oficina vincula cada línea a un ítem (regla 6 del modelo de dominio). Kevin pidió que el técnico elija los materiales frecuentes del catálogo (plan de las iteraciones 15 a 21): menos escritura en campo, descripciones iguales entre técnicos y, sobre todo, líneas que llegan vinculadas, que es lo que vuelve casi automática la cotización (iteración 21).

Hechos:

- La bajada (ADR-0003) lleva formatos, visitas y estados por un registro de cambios; una app vieja valida la respuesta completa y falla ante un tipo de cambio que no conoce.
- Cuando cambia la versión de la app, el teléfono vuelve a bajar todo desde el principio.
- Un catálogo real tiene cientos o pocos miles de ítems (la importación admite 5.000).
- El técnico trabaja sin señal horas (QA-1): la búsqueda tiene que funcionar sin conexión.

## Parte 1 · Qué baja y cómo

**Decisión:** un tipo de cambio nuevo, `item_catalogo`, para toda la organización, con `id`, `codigo`, `descripcion`, `unidad` y `activo`. Solo a la app 8 o posterior (ADR-0015); a las anteriores no se les entrega, y al actualizarse bajan todo de nuevo, catálogo incluido. Una migración registra un cambio por cada ítem que ya existía.

- **Sin precios, nunca** (regla 7; los precios serán del módulo de cotizaciones, QA-12).
- **Sin sellar en el teléfono,** como los formatos: es la lista de materiales de la organización, no datos de sus clientes (ADR-0022 sella lo que es del cliente o del levantamiento).
- **Un ítem desactivado baja con `activo: false`:** deja de sugerirse; las líneas que ya lo usaban conservan su texto.

## Parte 2 · Qué lleva la línea

| Opción | Descripción |
|---|---|
| **A. La línea lleva `item` (el id del ítem) además de su texto** | La descripción y la unidad siguen en la línea: se lee igual sin catálogo |
| B. La línea lleva solo el `item` | El texto sale del catálogo al mostrarla |

**Decisión: A.** La línea sigue siendo legible por sí sola (en el PDF, en una app sin catálogo, si el ítem cambia de descripción después). Al recibirla, el servidor proyecta el vínculo a `lineas_cantidad` con `vinculada_por` = el técnico, si el ítem existe en la organización (activo o no: el teléfono pudo tener el catálogo de ayer); si no existe, la línea entra sin vínculo y oficina la vincula como siempre. Un envío nunca se rechaza por el vínculo.

**La regla 6 cambia:** el técnico puede elegir el ítem al capturar; oficina confirma o cambia el vínculo. La tabla de vínculos sigue siendo la fuente de verdad, y oficina ve cuáles eligió el técnico.

## Parte 3 · En el teléfono

- **Búsqueda local, sin biblioteca:** sin tildes ni mayúsculas, por comienzo de palabra o por código. Unos miles de ítems se recorren en milisegundos.
- **"Los que más usas":** se cuentan en el teléfono, de las líneas de los levantamientos de ese técnico. No se sube nada nuevo al servidor.
- **Solo ítems cuya unidad admite el campo:** una línea con una unidad que el formato no permite no se podría enviar.
- **Lo que no está en el catálogo sigue siendo una línea libre.**

## Consecuencias

- **A favor:** menos escritura y errores en campo; oficina vincula solo lo que el técnico escribió a mano; la cotización parte de líneas vinculadas.
- **En contra:** la bajada crece con el catálogo (se mitiga: baja una vez y después solo lo que cambia); una importación completa registra un cambio por ítem.

## Cuándo revisarla

El catálogo pasa de unas decenas de miles de ítems (búsqueda con índice); TEINS quiere que el técnico vea precios (no: sería otra decisión, con su propia seguridad).
