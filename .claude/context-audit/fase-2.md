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

## Pendiente de medir

Sesión nueva, `/context` como primer mensaje; anotar Memory files y total. Comprobar que la barra de estado sigue funcionando.

## Pendiente (manual)

La API key de context7 sigue en la línea de comandos del servidor MCP. Moverla a una variable de entorno la hace el usuario: modifica su configuración global y toca un secreto.
