# ADR-0034 · Cancelar un envío en cola y retirar una versión de cotización

- **Estado:** Aceptada (Kevin, 2026-10-01)
- **Fecha:** 2026-10-01
- **Impulsores:** QA-9, QA-12, I-8, I-10
- **Depende de:** ADR-0028 (envío al cliente), ADR-0029 (cotizaciones); reemplaza a ADR-0029 en un punto (abajo)

## Contexto

1. **Cancelar un envío en cola.** Un envío al cliente (correo o WhatsApp) nace `en_cola` y el worker lo manda cuando el PDF está listo (ADR-0028). Entre publicar y que salga pueden pasar segundos o minutos (PDF con muchas fotos, QA-17). Si oficina nota un error en ese lapso (el contacto equivocado), no puede detenerlo. Estados de hoy: `en_cola`, `enviado`, `entregado`, `fallido`.
2. **Retirar una versión de cotización.** ADR-0029 decidió que "una cotización no se retira ni aparece en el portal". Un informe sí se retira (regla 11). Una cotización con un precio equivocado, ya enviada, queda como vigente hasta que se publique otra versión.

Restricciones: las versiones publicadas son inmutables (regla 7 de AGENTS.md) y nada se borra (regla 14). Los envíos llevan llave de idempotencia (iteración 24a) y el worker los procesa desde la cola (ADR-0012).

## Opciones

| Opción | Descripción |
|---|---|
| A. Cancelar con estado propio y bloqueo | Estado `cancelado`, solo desde `en_cola`; el worker relee el estado dentro del mismo bloqueo antes de mandar |
| B. Cancelar borrando el trabajo de la cola | Se quita el trabajo de Graphile Worker |
| C. Retirar la cotización como el informe | Una versión publicada se marca retirada, con motivo y registro; deja de ser la vigente |
| D. Sin retirar: siempre otra versión | Lo de hoy (ADR-0029) |

## Evaluación

| Criterio (ligado a un impulsor) | A | B |
|---|---|---|
| Nunca sale un envío cancelado, aunque el worker ya lo haya tomado (I-8) | ● | ○ |
| Queda registro de quién lo canceló (regla 14) | ● | ○ |

| Criterio (ligado a un impulsor) | C | D |
|---|---|---|
| La versión publicada no cambia (QA-9) | ● | ● |
| Oficina puede decir "esta ya no vale" sin inventar otra | ● | ○ |

## Decisión

**A para los envíos y C para las cotizaciones.**

1. **Cancelar un envío:**
   - En la versión, junto al envío `en_cola`: "Cancelar envío", al instante con "Deshacer" mientras siga en cola.
   - El estado nuevo es `cancelado`, con autor y hora.
   - El worker, dentro del bloqueo de la fila que ya usa la llave de idempotencia, relee el estado y no manda un `cancelado`.
   - Si ya salió (`enviado`), la acción no se ofrece: un correo enviado no se recupera, y la app lo dice.
2. **Retirar una versión de cotización:**
   - Como en el informe: quien administra la marca retirada, con motivo obligatorio, y queda registrada. Es una confirmación irreversible.
   - La versión y su PDF se conservan (regla 7); deja de mostrarse como vigente y no se puede volver a enviar.
   - Si hay otra versión anterior no retirada, esa pasa a vigente; si no, la cotización queda sin vigente.
3. **Reemplaza a ADR-0029 en un punto:** "una cotización no se retira" pasa a "una versión de cotización se retira como una de informe". Lo demás de ADR-0029 sigue: no aparece en el portal y no tiene estado comercial.

## Por qué gana a cada alternativa

- **Frente a B:** si el worker ya tomó el trabajo, quitarlo de la cola llega tarde y el correo sale igual. Además no queda quién lo canceló.
- **Frente a D:** obliga a publicar una versión nueva solo para decir que la anterior ya no vale, y entre tanto la equivocada sigue como vigente.

## Consecuencias

- **A favor:** oficina corrige un envío equivocado en el lapso en que todavía se puede. Una cotización mal publicada deja de valer sin inventar otra.
- **En contra:** un estado más en los envíos y su leyenda en pantalla (mitigación: solo se ve en el envío que se canceló). Hay una carrera entre cancelar y mandar (mitigación: el bloqueo de la fila; una prueba del servidor cancela mientras el worker procesa).

## Cuándo revisarla

- Si los PDF salen tan rápido que nunca hay tiempo para cancelar: la función sobra.
- Si TEINS necesita estado comercial en las cotizaciones (aceptada, rechazada): es otro ADR.
