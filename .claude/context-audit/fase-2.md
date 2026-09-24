# Fase 2: archivos de memoria y restos de GSD

Fecha: 2026-09-23 · Rama: `chore/context-optimization` · Anterior: `fase-1.md`

Copias de los archivos de usuario antes del cambio: `~/.claude/_disabled/2026-09-23-fase2/` (`CLAUDE.md`, `KARPATHY.md`, `settings.json`).

## Cambios

| Archivo | Antes | Después | Qué cambió |
|---|---|---|---|
| `AGENTS.md` | 6 397 car. | 5 106 car. | La tabla de stack pasó a una línea con las librerías y un enlace a `docs/adr/README.md`, que ya tiene el índice. El resto queda igual. |
| `~/.claude/CLAUDE.md` | 1 814 car. | 820 car. | Fuera los 21 imports de SuperClaude a archivos que no existen. Quedan `@KARPATHY.md` y el bloque de CodeGraph. |
| `~/.claude/KARPATHY.md` | 6 948 car. | 1 760 car. | Quedan los 4 principios con sus reglas. Fuera la tabla de antipatrones y los ejemplos, que repetían los principios. |

Hooks en `~/.claude/settings.json`: salen los 8 de flujo de GSD (`check-update`, `session-state`, `context-monitor`, `phase-boundary`, `prompt-guard`, `read-guard`, `workflow-guard`, `validate-commit`). Quedan `gsd-read-injection-scanner` (revisa lecturas en busca de inyección de instrucciones), `block-destructive-bash`, `codegraph prompt-hook` y la `statusLine`.

## Estimado

Memory files: ~15.2k → ~7.7k caracteres. Con la proporción medida en la línea base (6k tokens), ≈ 3k tokens menos.

## Resultado medido

`/context` en sesión nueva (claude-opus-5-5[1m]): 30.9k / 1m (3%)

| Categoría | Línea base | Fase 1 | Fase 2 |
|---|---|---|---|
| System prompt | 3.3k | 2.4k | 2.4k |
| System tools | 11.7k | 13.6k | 13.6k |
| MCP tools | 632 | 620 | 638 |
| Custom agents | 3.1k | 314 | 314 |
| Memory files | 6.0k | 6k | 3.1k |
| Skills | 9.9k | 9.9k | 9.9k |
| Messages | 977 | 977 | 977 |
| **Total** | **35.6k** | **33.8k** | **30.9k** |

Fase 2: −2.9k, como se estimó. Acumulado desde la línea base: −4.7k (−13 %). Lo que queda reducible es Skills (9.9k), casi todo de plugins; se decidió no tocarlo.

## Pendiente (manual)

La API key de context7 sigue en la línea de comandos del servidor MCP. Moverla a una variable de entorno la hace el usuario: modifica su configuración global y toca un secreto.
