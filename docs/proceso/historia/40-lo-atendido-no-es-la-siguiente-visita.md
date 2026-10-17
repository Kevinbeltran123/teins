[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteraciones 38 y 39 · La revisión al lado y las conversaciones con campo](38-revision-al-lado-y-conversaciones.md) · Siguiente: [Iteración 41 · Nada queda a medias ni crece sin fin](41-nada-queda-a-medias.md)

# Iteración 40 · Lo atendido no es la siguiente visita

**Estado en el mapa al 2026-10-16:** Desplegada en el entorno de pruebas con la migración `0037` y la app 15 (2026-10-06)

**Estado:** pedido de Kevin el 2026-10-06 («soluciona todo el flujo completo, empieza»). Construida, verificada y desplegada en el entorno de pruebas el 2026-10-06 (ADR-0041, migración `0037`, app de campo 15).

**El fallo:** una visita terminada, con su levantamiento enviado y revisado, seguía en el teléfono como «Siguiente visita» con «Iniciar levantamiento». Tenía dos causas:
- en el teléfono, el orden de «Mis visitas» nunca sacaba una visita, solo la bajaba al final, y sin otra pendiente la atendida volvía a ser la primera;
- en el servidor, una visita solo salía del teléfono si la reasignaban o la cancelaban.

Además, una visita terminada sin nada enviado quedaba como «atrasada» por encima de las futuras, y lo atendido se acumulaba en el teléfono sin límite.

**Parte A, en el teléfono** (`campo/src/visitas.ts`, `agendaDeVisitas`):
- una visita atendida (algo enviado o terminada, sin borrador a medias) no es pendiente;
- «Siguiente visita» es la primera pendiente, y sin pendientes se ve «No tienes visitas pendientes»;
- lo atendido hoy va en «Atendidas hoy», al final, con «Iniciar levantamiento» para otro formato;
- lo atendido de días anteriores no se muestra, y su levantamiento sigue en «Enviados»;
- «Ver la siguiente visita» después de enviar usa la misma agenda.

**Parte B, en el servidor** (ADR-0041):
- antes de armar la bajada de un técnico, el servidor cierra sus visitas de días anteriores que están terminadas o tienen algún levantamiento recibido (`visitas.cerrada_en`);
- les manda `fuera_de_alcance` con motivo `atendida`, solo a la app 15 o posterior, y una visita cerrada no vuelve a bajar;
- el teléfono la quita sin aviso, salvo que tenga un borrador o un envío por salir (regla 5).

**Decisiones tomadas al construirla**
- **Se cierra al bajar, sin tarea programada:** el worker no tiene ninguna, y una por organización con su aislamiento por fila sería más pesada.
- **Lo de hoy no se cierra**, por si hace falta otro levantamiento. Lo atrasado sin atender tampoco: oficina lo reprograma o lo cancela.
- **A la app 14 no se le manda el motivo `atendida`:** su contrato lo rechazaría junto con toda la bajada. Ya no muestra lo atendido gracias a la parte A, y al actualizarse baja todo de nuevo sin las visitas cerradas.

**Evidencia:** `visitas.test.ts` (7 casos de la agenda: el de Kevin, sin pendientes, atendida de otro día, terminada sin enviar, borrador, orden); `bajada.test.ts` (cierra lo atendido de días anteriores, no lo de hoy ni lo atrasado, la app 14 no recibe el motivo, una cerrada no vuelve a bajar y se cierra una sola vez); `motor.test.ts` (sale sin aviso, se queda con borrador o envío por salir); `envio.spec.ts` (tras enviar la única visita no hay «Siguiente visita» y sí «Atendidas hoy»); envío, bajada, programación, conversaciones y revisión de extremo a extremo en Chromium y WebKit; `pnpm typecheck`, `arquitectura` y `presupuesto` (133,4 KB).

## Al cerrarla

**Antes (iteración 40):** que Kevin pruebe las iteraciones 38, 39 y 40 en el entorno de pruebas, la 39 y la 40 también en su iPhone (campo, app 15). La 40 arregla que lo atendido siguiera como «Siguiente visita» (sección "Iteración 40"). Las dos están construidas, verificadas y desplegadas en el entorno de pruebas (2026-10-06); el detalle, las decisiones y la evidencia están en la sección "Iteraciones 38 y 39". Después: producción de la 29 a la 39 (`campo` primero) y lo que entregue TEINS.
