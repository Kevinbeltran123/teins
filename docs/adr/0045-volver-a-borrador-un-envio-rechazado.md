# ADR-0045 · Un envío que oficina nunca recibió vuelve a borrador para corregirlo

- **Estado:** Aceptada (Kevin, 2026-10-15, dentro de la iteración 42)
- **Fecha:** 2026-10-15
- **Impulsores:** QA-1 (cero pérdida de lo ingresado), QA-3 (sin conflictos de edición), regla 3 (un editor por estado), regla 5 (nunca borrar lo que no se ha enviado)
- **Depende de:** ADR-0003 (sincronización), ADR-0035 (descartar un envío rechazado). Amplía 0035.

## Contexto

Un envío que el servidor rechaza con un error permanente queda en el teléfono como «No se pudo enviar». El técnico puede reintentarlo, que falla igual si nada cambió, o descartarlo (ADR-0035), con lo que pierde la visita. Una auditoría del 2026-10-15 encontró rechazos que oficina no puede resolver y que el técnico sí podría corregir si el levantamiento volviera a ser borrador:

- un croquis que pesa más de lo que recibe el servidor;
- un valor que el protocolo rechaza aunque el teléfono lo aceptó (un decimal muy largo, un carácter nulo);
- una foto que ya no se puede volver a registrar después de restaurar la base.

En todos estos casos oficina nunca recibió el levantamiento: el servidor revierte la transacción del envío y no queda nada suyo. Hoy, el levantamiento enviado no se edita en el teléfono (regla 4), y esa regla existe para que haya un solo editor por estado: después del envío, edita oficina.

## Opciones

| Opción | Descripción |
|---|---|
| A. Volver a borrador | Un envío en error permanente, sin estado del servidor, vuelve a borrador; sale de la cola y el técnico lo corrige y lo envía otra vez |
| B. Servidor tolerante | El servidor limpia o acepta lo que hoy rechaza (por ejemplo, ignorar respuestas huérfanas) |
| C. Seguir como hoy | Reintentar o descartar |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C |
|---|---|---|---|
| Cero pérdida de lo ingresado (QA-1) | ● | ◐ | ○ |
| Un solo editor por estado (regla 3, QA-3) | ● | ● | ● |
| Sirve para rechazos que todavía no conocemos | ● | ○ | ○ |
| El servidor sigue validando lo que recibe (regla 9) | ● | ○ | ● |

## Decisión

**A.**

1. **Cuándo:** el levantamiento está enviado en el teléfono, su envío está en `error` y no tiene estado del servidor (oficina no lo recibió). En cualquier otro caso no se ofrece y el repositorio lo rechaza.
2. **Qué hace:** en una transacción, el levantamiento vuelve a `borrador` sin `enviadoEn` y su envío sale de la cola. Lo capturado no cambia.
3. **Dónde:** en la pantalla del envío rechazado, «Volver a borrador para corregir», junto a «Reintentar envío» y «Descartar levantamiento». Es una confirmación con consecuencias (DESIGN.md).
4. **Al enviarlo otra vez:** sale con la misma llave de envío. El servidor no guardó nada con esa llave porque rechazó el primero, así que no hay duplicado.
5. Además, el teléfono evita llegar ahí: antes de enviar quita las respuestas de tableros que ya no existen y los caracteres nulos, mide bocetos y firmas contra el límite del servidor, y valida los decimales con el mismo largo que el protocolo.

## Por qué gana a cada alternativa

- **Frente a B:** el servidor seguiría aceptando datos que no corresponden al formato. Además, solo cubre los rechazos que ya conocemos.
- **Frente a C:** descartar pierde la visita completa por un error que el técnico puede corregir en un minuto.

## Consecuencias

- **A favor:** ningún rechazo permanente obliga a perder una visita. El técnico corrige lo que haga falta, con las mismas pantallas de siempre.
- **En contra:** un rechazo que no depende de los datos (otra persona ya envió ese levantamiento, `conflicto`) vuelve a fallar al enviarlo otra vez. Para ese caso sigue «Descartar levantamiento», y el texto del rechazo dice qué hacer.

## Cuándo revisarla

- Si oficina necesita ver los envíos rechazados para corregirlos ella misma, en vez del técnico.
- Si aparece un rechazo permanente después de que oficina ya recibió el levantamiento: ahí ya no aplica, porque edita oficina.
