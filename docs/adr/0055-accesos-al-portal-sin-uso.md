# ADR-0055 · Los accesos al portal sin uso en 12 meses se quitan solos

- **Estado:** Aceptada
- **Fecha:** 2026-11-06
- **Impulsores:** F8, QA-4, R5, I-18 a I-22 (Ley 1581)
- **Depende de:** ADR-0008, ADR-0043, ADR-0053

## Contexto

Con ADR-0053, cada contacto con acceso entra al portal con un código que llega a su correo. El acceso no vence: queda abierto mientras oficina no lo quite. Por eso, quien controla ese buzón puede entrar aunque la persona ya no trabaje con el cliente, y nadie en TEINS se va a enterar. ADR-0053 dejó escrito cuándo revisarlo: «Aparecen accesos sin uso por mucho tiempo: desactivarlos solos».

Lo que lo hace difícil:

- **Los clientes entran poco:** muchos solo descargan el informe de cada visita, y hay mantenimientos semestrales o anuales. Un plazo corto le quita el acceso a quien sí lo usa.
- **Quitar un acceso ya tiene una forma:** se borra su fila, con sus sesiones y su pedido de código. Oficina lo devuelve con un interruptor que, al activarlo, manda una invitación.
- **Ley 1581 y ADR-0053 exigen dejar registro** de cada vez que se da o se quita un acceso.
- **No se puede avisar al cliente que su código no llegará:** pedir un código responde siempre igual, exista o no el acceso, para no revelar qué correos tienen acceso.

## Opciones

| Opción | Descripción |
|---|---|
| A. Quitarlo, como lo hace oficina | La tarea periódica borra el acceso sin ingresos en 12 meses (sin estrenar: desde que se dio) y lo registra con autor `sistema` |
| B. Marcarlo como desactivado | Una columna nueva; el acceso existe pero no entra; oficina lo reactiva |
| C. Avisar antes de quitarlo | Correo al contacto un mes antes, y quitarlo si no entra |
| D. Revisión anual en oficina | Una lista de accesos por confirmar cada año, sin quitar nada solo |

## Evaluación

| Criterio (ligado a un impulsor) | A | B | C | D |
|---|---|---|---|---|
| Cierra el acceso olvidado (F8, I-18 a I-22) | ● | ● | ● | ◐ (depende de que oficina revise) |
| Sin estados ni código nuevos que mantener | ● | ○ (migración, permisos, cada consulta distingue) | ◐ (plantilla y tarea nuevas) | ○ (pantalla y columna nuevas) |
| Registro de cada cambio (ADR-0008) | ● | ● | ● | ● |
| El cliente que sí lo usa no lo pierde | ● (12 meses) | ● | ● | ● |

## Decisión

1. **Plazo: 12 meses sin entrar.** Se cuenta desde `ultimo_ingreso` o, si nunca entró, desde que se le dio el acceso (`creado_en`). La constante es `ACCESO_SIN_USO_DESPUES_DE_MS`, en `modulos/mantenimiento`.
2. **Quitarlo es lo mismo que cuando lo quita oficina:** se borra la fila, con sus sesiones y su pedido (`quitarAccesosSinUsoDelPortal`, en el módulo del portal). Sin migración ni estado nuevo.
3. **Corre en la tarea periódica de cada hora** (ADR-0043), en cada organización, con su transacción.
4. **Registro:** `acceso_portal_quitado` en la historia del cliente, con autor `sistema`, motivo `sin_uso` y correlación `mantenimiento:<uuid>` por pasada.
5. **Volver a dar el acceso** es el interruptor de oficina de siempre, que manda la invitación.

## Por qué gana a cada alternativa

- **Frente a B:** devolver el acceso ya existe y es volver a darlo. Una columna «desactivado» obligaría a cada consulta del portal y de los envíos a distinguir entre acceso activo y desactivado, para ganar lo mismo.
- **Frente a C:** escribirle a alguien que lleva un año sin entrar casi nunca cambia nada, y suma una plantilla de correo, una tarea y un estado intermedio.
- **Frente a D:** depende de que alguien revise. Si se necesita, se puede sumar después; no reemplaza quitar lo olvidado.

## Consecuencias

- **A favor:** un buzón que cambió de dueño deja de abrir el portal sin que nadie lo vigile. No cambia el esquema ni la forma de dar acceso.
- **En contra:** a un contacto al que se le quitó el acceso no le llega el código y el portal no le dice por qué. Se mitiga con el plazo largo y con que oficina se lo devuelve con un clic. Los correos de documentos dejan de llevar el botón del portal para ese contacto, como cuando oficina se lo quita.
- **En contra:** la pantalla del cliente muestra «Sin acceso», sin decir que se quitó solo. El motivo queda en el registro.

## Cuándo revisarla

- Oficina recibe llamadas de clientes que perdieron el acceso y sí lo usaban: alargar el plazo.
- Hace falta confirmar cada año a los contactos que sí entran (por ejemplo, una auditoría de Ley 1581): sumar la revisión anual (opción D).
