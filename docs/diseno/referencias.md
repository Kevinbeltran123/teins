# Referencias de diseño

## Qué se tomó de cada una

| Referencia | Qué aporta | Cómo se usa |
|---|---|---|
| antislop (miqdadbadjuber/anti-slop) | Filtro de patrones genéricos de IA; exige propósito escrito, niveles de energía/ritmo/movimiento, punto focal, acento único y motivo de identidad | Filtro obligatorio en todo trabajo de interfaz (`AGENTS.md`) |
| transitions.dev | Transiciones de interfaz en CSS y React | Versiones CSS en `campo` (cero JavaScript) |
| beUI | Componentes animados con Motion y Tailwind, registro compatible con shadcn, MIT | Solo `oficina`: paleta de comandos, conteos, notificaciones |
| Rare UI | Componentes animados poco comunes | Descartado en general: orientado a portafolios |
| Beautiful UI | Bloques para interfaces de agentes de IA | No aplica por ahora |
| shadcn/ui (Base UI) | Base de componentes, código propio | Base de `paquetes/ui`, **reestilizada por completo** con los tokens |
| SafetyCulture, Fulcrum, Survey123 | Apps de inspección en campo | Tarjeta por pregunta, estado de sincronización por registro, secciones repetibles |
| IBM Carbon | Tableros densos, indicadores de estado | Densidad de tablas en oficina |
| GOV.UK Design System | Formularios y errores claros | Mensajes de error y validación |

## Lecciones de la primera propuesta descartada

La propuesta "Cuaderno de campo" se descartó por caer en patrones que antislop identifica: fondo de cuadrícula, estilo por defecto estéril (blanco plano, bordes finos, radio pequeño), tarjetas idénticas y ausencia de punto focal. Queda como recordatorio de lo que no se repite.
