# ADR-0047 · Retirar una versión cancela sus envíos

- **Estado:** Aceptada (Kevin, 2026-10-16)
- **Fecha:** 2026-10-16
- **Impulsores:** regla 7 (las versiones publicadas son inmutables), regla 9 (permisos solo en el servidor), "La regla" de `DESIGN.md` (cada dato en pantalla ayuda a decidir)
- **Depende de:** ADR-0028 (envío al cliente), ADR-0034 (cancelar un envío en cola). Amplía 0034.

## Contexto

Al retirar una versión de informe o de cotización, sus envíos que esperaban en cola quedaban `fallido` con el motivo "La versión se retiró antes de enviarla". En oficina eso se ve como «No llegó», en rojo, igual que un rebote: parece un fallo de entrega cuando fue una decisión de oficina. ADR-0034 ya tiene un estado para "oficina lo detuvo antes de salir": `cancelado`.

## Opciones

| Opción | Descripción |
|---|---|
| A. Cancelado con motivo | Lo que espera queda `cancelado`, por quien retiró, con el motivo "Versión retirada" en la columna `error`; no se reanuda |
| B. Estado nuevo `retirado` | Un sexto estado solo para esto |
| C. Seguir como hoy | `fallido` con el motivo |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C |
|---|---|---|---|
| Oficina distingue una decisión de un fallo de entrega | ● | ● | ○ |
| Sin migración ni cambio del protocolo | ● | ○ | ● |
| Un solo significado de "no sale porque oficina lo detuvo" | ● | ○ | ○ |

## Decisión

**A.**

1. **Al retirar:** los envíos `en_cola` de esa versión pasan a `cancelado`, con `cancelado_por` = quien retiró, `cancelado_en` = ahora y `error` = "Versión retirada". Sin aviso: lo decidió oficina. Lo `enviado`, `entregado`, `fallido` o ya `cancelado` no cambia.
2. **No se reanudan:** el servidor rechaza reanudar un envío de una versión retirada (ya lo hacía, ADR-0034), y oficina no lo ofrece.
3. **El que ya estaba saliendo** (el worker marcó `enviado_en` antes de llamar al proveedor) sigue su curso: si el proveedor lo acepta o lo entrega, pasa de `cancelado` a `enviado` o `entregado`; si lo rechaza, queda `cancelado`. Es la única salida de un `cancelado` que no es reanudar, y exige el motivo "Versión retirada" y `enviado_en`: un cancelado a mano nunca empezó a salir.
4. **"No llegó" no toca un cancelado.** Ni un rechazo del proveedor ni un evento de fallo lo pasan a `fallido`.
5. **En oficina:** la insignia es «Cancelado» y el detalle dice «Correo · Versión retirada por [persona] [fecha]: no sale». No cuenta en «envíos no llegaron» ni en la bandeja.

## Por qué gana a cada alternativa

- **Frente a B:** un estado nuevo pide cambiar el protocolo, las pantallas y la versión anterior del protocolo (N-1, ADR-0015) para decir lo mismo que `cancelado` con un motivo.
- **Frente a C:** muestra como fallo de entrega algo que oficina hizo a propósito, y pide «Volver a enviar» donde no aplica.

## Consecuencias

- **A favor:** sin migración. Los envíos que ya quedaron `fallido` por un retiro antes de este cambio se quedan así: es historia, y su versión está retirada.
- **En contra:** la columna `error` también guarda el motivo de un cancelado. El protocolo lo documenta en `EnvioDeVersion.error`.

## Cuándo revisarla

- Si aparece otro motivo para cancelar envíos en bloque: entonces conviene una columna `motivo` propia.
