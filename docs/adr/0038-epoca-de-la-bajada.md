# ADR-0038 · Época de la bajada: el teléfono se entera de que el servidor se dejó limpio

- **Estado:** Aceptada
- **Fecha:** 2026-10-03
- **Impulsores:** regla 5 (nunca borrar lo no enviado), ADR-0015 (expansión del protocolo), R5 (sin datos reales fuera de producción)
- **Depende de:** ADR-0003 (bajada), ADR-0005 (registro de cambios), ADR-0009 (borrado por revocación)

## Contexto

La bajada solo trae cambios: el registro (`cambios.registro`) dice qué cambió y el teléfono lo aplica con `put`. Lo único que quita algo del teléfono es un `fuera_de_alcance` de una visita o una orden de borrado (ADR-0009). Al dejar limpio el entorno de pruebas (`infra/limpieza/dejar-limpio.sql`, 2026-10-02) se borraron visitas, levantamientos y catálogo junto con sus filas del registro: ningún teléfono se entera y siguen mostrando visitas y enviados que ya no existen. Bajar desde cero (`desde=0`) tampoco lo arregla: repite el registro y solo agrega. Hasta hoy la única salida era borrar la app y volver a instalarla, que en un iPhone también borra lo no enviado.

Pasará otra vez: el entorno de pruebas se limpia antes de cada demostración y producción se entregará a TEINS sin los datos de prueba (ADR-0021). Kevin pidió (2026-10-03) arreglarlo cambiando lo mínimo y sin romper el trabajo sin conexión.

## Opciones

| Opción | Descripción |
|---|---|
| A. Época por organización | Un valor que cambia solo al limpiar; viaja en cada bajada; el teléfono que ve otro quita lo que vino del servidor y baja todo de nuevo |
| B. Reconciliación periódica | Una operación nueva devuelve lo que el teléfono debe tener; el teléfono quita lo demás cada cierto tiempo |
| C. Anunciar lo borrado | El script de limpieza inserta `fuera_de_alcance` por cada visita antes de borrar |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| Quita visitas, enviados, estados y catálogo viejos | ● | ● | ◐ (solo visitas) |
| No toca lo no enviado (regla 5) | ● | ◐ (una respuesta incompleta borraría de más) | ● |
| Una app anterior sigue funcionando (ADR-0015) | ● | ● | ◐ (otros tipos de entidad la romperían) |
| Costo | ● | ○ | ● |

## Decisión

A, con estas reglas:

- **Servidor:** tabla `cambios.epocas` (organización, época), migración `0034_epoca_de_bajada`. La aplicación solo la lee (`SELECT`); sin fila, la época es `inicial`. `armarBajada` devuelve `epoca` en cada página.
- **Quién la cambia:** solo `dejar-limpio.sql`, en la misma transacción en que borra, con un valor nuevo al azar por organización. Ninguna operación de la API la cambia.
- **Protocolo:** `Bajada.epoca` opcional (expansión, ADR-0015): una app anterior la ignora y sigue como antes (para ella sigue haciendo falta reinstalar).
- **Campo (app 13):** guarda la última época que vio (`bajadas.epoca`); la primera vez solo la guarda, sin borrar nada. Si una página trae otra:
  1. En una transacción quita las visitas sin trabajo pendiente, los estados de oficina y el catálogo, y pone el punto de control en cero con la época nueva y la marca `podar`. Una visita con un borrador, un envío que no ha salido o una terminación pendiente se queda como reasignada; si sigue en el servidor, la bajada la devuelve normal.
  2. Baja todo desde cero.
  3. Al terminar (la última página), en la misma transacción que la aplica, quita lo enviado y recibido que el servidor ya no conoce (sin estado después de bajar todo), con sus fotos y su envío. Lo que el servidor recibió después de limpiar se queda.
- **Nunca se tocan:** borradores (también los descartados), lo que falta por enviar, formatos y símbolos.
- **Sin aviso al técnico:** el inicio queda como debe quedar (decisión aprobada en `prototipos/ajustes-campo`).

## Por qué gana a cada alternativa

- **Frente a B:** necesita una operación nueva, una lista completa y confiable de lo que existe y un reloj; una respuesta cortada a la mitad borraría visitas válidas. A solo actúa cuando alguien limpió a propósito.
- **Frente a C:** cubre solo visitas; anunciar levantamientos o ítems del catálogo exigiría tipos nuevos que una app anterior rechaza, y el script tendría que conservar filas del registro que describen cosas borradas.

## Consecuencias

- **A favor:** limpiar un entorno ya no exige reinstalar la app en cada teléfono (desde la app 13); lo no enviado nunca se pierde; un campo opcional, una tabla, una línea en el script y unas 40 líneas en el teléfono.
- **En contra:** al cambiar la época, el teléfono baja todo de nuevo (formatos y símbolos incluidos): más datos una vez. Si el servidor rechaza un envío pendiente de una visita que ya no existe, queda en "Necesita atención", como cualquier rechazo (lo resuelve oficina).

## Cuándo revisarla

- Si se necesita quitar datos del teléfono por otra razón que una limpieza completa (por ejemplo, borrar un cliente en producción): eso se anuncia por entidad, no con la época.
- Si un teléfono tarda en volver a bajar todo por el tamaño del catálogo o de los formatos.
