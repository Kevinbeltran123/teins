# ADR-0041 · Las visitas atendidas salen del teléfono al día siguiente

- **Estado:** Aceptada
- **Fecha:** 2026-10-06
- **Impulsores:** regla 5 (nunca borrar datos locales sin enviar), regla 18 (minimización), QA-5 (ciclo de vida de los teléfonos), ADR-0003 (el servidor decide el alcance)
- **Depende de:** ADR-0003 (sincronización), ADR-0015 (versiones de la app), ADR-0037 (terminar visita). Amplía 0003 sin reemplazarlo.

## Contexto

Kevin encontró el 2026-10-06 que una visita ya atendida (terminada, con su levantamiento enviado y revisado) seguía en el teléfono como «Siguiente visita», con «Iniciar levantamiento». Había dos causas:

1. **En el teléfono**, el orden de «Mis visitas» nunca sacaba una visita: solo la bajaba al final. Sin otra pendiente, la atendida volvía a ser la primera. Se corrigió en la iteración 40, parte A: lo atendido no es la siguiente visita, lo de hoy va en «Atendidas hoy» y lo de días anteriores no se muestra.
2. **En el servidor**, una visita solo sale del teléfono si la reasignan o la cancelan. Una visita atendida se queda para siempre, con el cliente, el sitio y la dirección sellados, aunque nadie los vuelva a necesitar.

## Opciones

| Opción | Descripción |
|---|---|
| A. El teléfono borra lo atendido por su cuenta | Cada teléfono decide cuándo quitar una visita |
| B. Una tarea programada cierra las visitas | Un trabajo diario recorre todas las organizaciones y avisa a los teléfonos |
| C. Se cierran al bajar | Antes de armar la bajada de un técnico, el servidor cierra sus visitas atendidas de días anteriores y las manda como `fuera_de_alcance` con motivo `atendida` |

## Evaluación

| Criterio | A | B | C |
|---|---|---|---|
| El servidor decide el alcance (ADR-0003) | ○ | ● | ● |
| Sin infraestructura nueva (tarea programada por organización con su RLS) | ● | ○ | ● |
| Llega justo cuando el teléfono pregunta | ● | ◐ | ● |
| Una app vieja no se confunde | ● | ◐ | ● (con versión) |

## Decisión

**C. Las visitas atendidas se cierran al bajar.**

1. **Cuándo se cierra:** una visita asignada, sin cancelar, de un día anterior al de hoy en Colombia, que se terminó (ADR-0037) o que tiene al menos un levantamiento recibido. Lo de hoy no se cierra: el técnico puede necesitar otro levantamiento (otro formato) en la misma visita. Una visita atrasada sin atender no se cierra: oficina la reprograma o la cancela.
2. **Cómo:** `visitas.visitas.cerrada_en` (migración `0037`, solo aditiva). Antes de leer los cambios de un técnico, el servidor marca `cerrada_en` en sus visitas que cumplen y registra `fuera_de_alcance` para sus técnicos, en la misma transacción. Una visita cerrada no vuelve a bajar.
3. **Motivo `atendida`** en el cambio `fuera_de_alcance`, desde la app 15. A una app anterior no se le manda ese cambio: no lo conoce y lo tomaría por una reasignación. Lo atendido ya no se le muestra desde la parte A, y al actualizarse baja todo de nuevo sin las visitas cerradas.
4. **En el teléfono:** con motivo `atendida`, la visita se quita si no tiene un borrador ni un envío por salir. Si los tiene, se queda como está y el técnico termina y envía (regla 5). Nunca se avisa como una cancelación.

## Por qué gana a cada alternativa

- **Frente a A:** el alcance lo decide el servidor (ADR-0003). Un teléfono que borra por su cuenta podría quitar una visita a la que oficina todavía va a agregar algo, y cada teléfono decidiría distinto.
- **Frente a B:** una tarea diaria tiene que recorrer cada organización con su aislamiento por fila y avisar a teléfonos que tal vez no preguntan en días. Cerrar al bajar hace el mismo trabajo solo para quien pregunta, cuando pregunta.

## Consecuencias

- **A favor:**
  - El teléfono guarda solo lo que hace falta: lo atendido sale al día siguiente con sus datos sellados.
  - «Mis visitas» no crece con el tiempo.
- **En contra:**
  - La primera bajada del día hace una escritura más (pocas filas, por índice).
  - Una visita cerrada no vuelve al teléfono aunque oficina la cambie después. Si hace falta volver, oficina programa otra.

## Cuándo revisarla

- Oficina pide reabrir visitas cerradas.
- Aparece una tarea programada por otra razón: el cierre podría ir ahí.
