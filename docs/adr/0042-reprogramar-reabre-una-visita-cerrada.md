# ADR-0042 · Reprogramar reabre una visita cerrada

- **Estado:** Aceptada
- **Fecha:** 2026-10-06
- **Impulsores:** ADR-0003 (el servidor decide el alcance)
- **Depende de:** ADR-0041 (las visitas atendidas salen del teléfono). Lo amplía.

## Contexto

El ADR-0041 dejó como consecuencia que «una visita cerrada no vuelve al teléfono aunque oficina la cambie después». Al revisarlo apareció el efecto real: si oficina reprogramaba a mañana una visita atendida ayer, la visita seguía cerrada, y los teléfonos la recibían como atendida. Para el técnico, desaparecía justo cuando oficina le pedía volver.

## Opciones

| Opción | Descripción |
|---|---|
| A. Nunca reabrir | Para volver, oficina programa otra visita (lo que decía el ADR-0041) |
| B. Reprogramar reabre | Otro día u otra hora quitan el cierre; reasignar sin cambiar la fecha no |
| C. Cualquier cambio reabre | Reprogramar, cambiar el motivo o reasignar quitan el cierre |

## Decisión

**B.**
- **Reprogramar** a otro día u otra hora quita el cierre, igual que ya quitaba la terminación (ADR-0037): la visita vuelve a ser trabajo por hacer y baja otra vez a sus técnicos.
- **Cambiar solo el motivo** no la reabre.
- **Reasignar sin cambiar la fecha** tampoco la reabre: en una visita pasada y atendida, reasignar corrige quién la hizo, no manda a nadie a volver. Si sigue en el pasado y atendida, se vuelve a cerrar en la siguiente bajada.

## Por qué gana a cada alternativa

- **Frente a A:** oficina ya tiene la acción para «vuelve otro día», y que la visita desaparezca al usarla es un error, no una regla.
- **Frente a C:** corregir el motivo o quién la hizo en una visita pasada no es trabajo nuevo, y reabrirla la volvería a poner en el teléfono sin razón.

## Consecuencias

- **A favor:** reprogramar hace lo que oficina espera, también con visitas ya cerradas.
- **En contra:** para mandar a otro técnico a una visita pasada hay que reprogramarla, no basta con reasignarla.

## Cuándo revisarla

Oficina pide reabrir sin cambiar la fecha.
