# Lo que necesitamos de TEINS

Información y decisiones que solo TEINS puede dar. Cada punto dice para qué sirve y qué pasa si no llega antes de cerrar el piloto: en ese caso la función se entrega como está hoy (ver [`alcance-v1.md`](alcance-v1.md)).

## Antes del piloto

| # | Qué necesitamos | Para qué | Si no llega |
|---|---|---|---|
| 1 | Quiénes participan: 2 o 3 técnicos, una o dos personas de oficina y algunas visitas reales de esas semanas (P40) | Probar con trabajo real, no con ejemplos | No hay piloto |
| 2 | Cuánto tarda hoy, en promedio, desde la visita hasta que el cliente recibe el informe (P41) | Comparar el antes y el después | El piloto mide solo el después |
| 3 | Qué haría exitosa la primera versión para ustedes (P42). Abajo hay una propuesta | Acordar cuándo se da por aceptada | Se usa la propuesta |
| 4 | Qué esperan ver en la demostración inicial (P43) | Preparar la presentación | Se muestra el recorrido completo |
| 5 | Autorización escrita para registrar la información real de sus clientes durante el piloto en el sistema que hoy está a nombre del desarrollador, o pasar primero el sistema a la cuenta de TEINS | La información de sus clientes solo se carga con su autorización (acuerdo de confidencialidad) | El piloto espera a que el sistema esté a nombre de TEINS |

## Para el informe y las cotizaciones

| # | Qué necesitamos | Para qué | Si no llega |
|---|---|---|---|
| 6 | Lista de precios de materiales y servicios | Que las cotizaciones salgan con precios reales | Se cargan a mano en el catálogo |
| 7 | Plantilla de la cotización que usan hoy, cómo se numeran y qué impuestos aplican (P29) | Que la cotización se vea como la de TEINS | Se usa la plantilla actual del sistema |
| 8 | Un informe de ejemplo que ya hayan entregado, sin datos del cliente (P22), y qué secciones, orden, firmas y datos legales debe llevar (P23) | Ajustar el informe a lo que el cliente espera | Sigue la estructura del formato en papel |
| 9 | ¿Un informe es de una sola visita o puede reunir varias? (P26) | Saber si hay que agrupar visitas | Un informe por visita |
| 10 | El logo de TEINS en vector (SVG o PDF), también en blanco para fondo oscuro | Que se vea nítido en el informe y en la app | Se usa el logo actual |
| 11 | Las columnas que necesitan en la exportación a Excel (P29) | Que la exportación sirva sin rehacerla | Se exporta con las columnas actuales |

## Para los formatos

| # | Qué necesitamos | Para qué | Si no llega |
|---|---|---|---|
| 12 | En el formato de UPS, ¿«Tipo de servicio» puede tener varias opciones a la vez (por ejemplo, preventivo y cambio de baterías)? | Que la app no deje marcar algo que no corresponde | Se pueden marcar varias |
| 13 | En «Causas del correctivo», ¿«Cargador (potencial)» e «Inversor (potencial)» deben decir «potencia»? | Que el informe use el término correcto | Queda como en el papel |
| 14 | ¿Cómo se escribe el número de orden de servicio a largo plazo y qué es el «Ticket No.»? | Que el número coincida con su sistema actual | Sigue desde 0001, con cuatro dígitos |
| 15 | Su catálogo de materiales con sus unidades y la lista de símbolos que usan en los planos (P28) | Que el técnico elija en vez de escribir | Se usa el catálogo y los símbolos actuales |
| 16 | ¿Qué otros tipos de servicio quieren en la app y qué campos son obligatorios en cada uno? (P7, P8) | Preparar los formatos siguientes | Quedan los dos formatos actuales |
| 17 | ¿Cuáles son los errores más comunes hoy al llenar los formatos? (P9) | Agregar validaciones donde más se equivocan | Quedan las validaciones actuales |

## Para la operación

| # | Qué necesitamos | Para qué | Si no llega |
|---|---|---|---|
| 18 | ¿Qué hace el supervisor que no haga el administrador? | Definir sus permisos | Solo existen técnico, oficina y administrador |
| 19 | ¿Quién crea o cambia los formatos en el futuro? (P10) | Saber si hace falta un editor visual | Los carga el desarrollador como archivo |
| 20 | ¿Deben quedar vinculadas las visitas repetidas al mismo sitio? (P5) y ¿quién decide qué técnico va y cuándo? (P2) | Ajustar cómo se programan las visitas | Oficina programa cada visita con fecha |
| 21 | Número de WhatsApp Business aprobado por Meta | Enviar el informe por WhatsApp | Solo correo |
| 22 | ¿Qué tan concreta es la idea de ofrecer el sistema a otras empresas? (P44) | Decidir si se prepara el alta de empresas | No se prepara |
