# Línea base de contexto — Teins

Fecha: 2026-09-23 · Rama: `chore/context-optimization` · Claude Code **2.1.280** · Modelo: claude-opus-5-5

## Diagnóstico (medido por el usuario)

Al iniciar sesión se cargan ~35.6k tokens antes de cualquier mensaje. ~15k (system prompt + herramientas del sistema) es fijo. Lo reducible es ~19.6k:

- Skills: 9.9k (prioridad 1)
- Memory files: 6.0k — AGENTS.md 2.8k; ~/.claude/KARPATHY.md 2.5k; ~/.claude/CLAUDE.md 698; CLAUDE.md del proyecto 16 (prioridad 2)
- Custom agents: 3.1k (prioridad 1)
- MCP tools: 632
- Auto memory: vacía

## Resultados manuales

`/context` (sesión nueva, claude-opus-5-5): 35.6k / 1.0M (4%)

| Categoría | Tokens |
|---|---|
| System prompt | 3.3k |
| System tools | 11.7k |
| MCP tools | 632 |
| Custom agents | 3.1k |
| Memory files | 6.0k |
| Skills | 9.9k |
| Messages | 977 |
| Autocompact buffer | 33.0k |
| Free space | 931.4k |

Memory files: AGENTS.md 2.8k · ~/.claude/KARPATHY.md 2.5k · ~/.claude/CLAUDE.md 698 · CLAUDE.md 16.
Custom agents (primeros): gsd-eval-auditor 148 · gsd-doc-synthesizer 147 · gsd-eval-planner 145 · gsd-ai-researcher 134 · gsd-domain-researcher 132.

`/memory`: sin memorias automáticas para este proyecto.

## Inventario estático de lo que se carga al iniciar

Tokens estimados = caracteres / 4.

### Archivos de memoria

| Ruta | Líneas | Caracteres | ~Tokens | Nota |
|---|---|---|---|---|
| `CLAUDE.md` (proyecto) | 1 | 11 | 3 | solo `@AGENTS.md` |
| `AGENTS.md` (proyecto, vía import) | 103 | 6 397 | 1 600 | /context lo mide en 2.8k (tokenizador real, español cuenta más) |
| `~/.claude/CLAUDE.md` | 52 | 1 814 | 450 | importa 21 archivos `@...` del framework SuperClaude que **no existen** en `~/.claude/` (imports rotos, no suman) |
| `~/.claude/KARPATHY.md` (vía import) | 121 | 6 948 | 1 740 | |
| `CLAUDE.local.md` | — | — | — | no existe |
| `.claude/rules/` | — | — | — | no existe |

AGENTS.md se carga una sola vez (a través del import de CLAUDE.md); no hay duplicación.

### Subagentes (Custom agents)

- 33 archivos en `~/.claude/agents/`, todos `gsd-*` (Get Shit Done 1.42.3, instalación de usuario).
- Descripciones: 6 623 caracteres ≈ 1.7k tokens estimados; /context mide 3.1k.
- Además aparecen subagentes de plugins: `feature-dev:*` (3), `code-simplifier:code-simplifier`.

### Skills

- `~/.claude/skills/`: **368 skills** con SKILL.md (4 enlaces simbólicos). Descripciones completas suman ~94k caracteres (~23k tokens); Claude Code las recorta a un presupuesto, por eso /context mide 9.9k y la mayoría aparece sin descripción.
  - gsd-*: 68 skills (5.1k caracteres de descripción)
  - hyperframes-*: 8 (4.7k)
  - antislop-*: 6 (0.8k)
  - resto: 286 (83k), sobre todo ciencia/bioinformática/ML (K-Dense scientific skills), automatizaciones Composio, etc.
- Skills de plugins habilitados: frontend-design, supabase (2), ui-ux-pro-max, feature-dev, small-business (~45), anthropic-skills (~10).
- Comandos en `~/.claude/commands/`: `explain-and-note.md`, `vault-synthesis.md`, carpeta `gsd/`.

### Plugins habilitados (usuario)

frontend-mobile-development@claude-code-workflows · frontend-design · security-guidance 2.0.8 · supabase 0.1.15 · learning-output-style · code-simplifier · feature-dev (claude-plugins-official) · ui-ux-pro-max 2.5.0. Además aparece `small-business` (MCP y skills) activo en esta sesión.

### Hooks globales (`~/.claude/settings.json`)

SessionStart: gsd-check-update, gsd-session-state · PostToolUse: gsd-context-monitor, gsd-phase-boundary, gsd-read-injection-scanner · PreToolUse: gsd-prompt-guard (ruta relativa `.claude/hooks/`, no existe en Teins), gsd-read-guard, gsd-workflow-guard, gsd-validate-commit, block-destructive-bash · UserPromptSubmit: `codegraph prompt-hook` · statusLine GSD.

## Tamaño del repo

Sin código todavía. 51 archivos versionados: 44 `.md` (~3 000 líneas, ~188k caracteres ≈ 47k tokens), 1 `.css` (`paquetes/ui/tokens.css`, 75 líneas), 4 JSON/YAML de configuración. `package.json`, `pnpm-workspace.yaml` y `tsconfig.base.json` son esqueletos.

## Servidores MCP

No hay `.mcp.json` en el proyecto. Todos son de usuario/claude.ai/plugins (herramientas diferidas, por eso MCP = 632 tokens):

| Servidor | Estado | Herramientas |
|---|---|---|
| claude.ai Claude Docs | conectado | 8 (3 no diferidas) |
| claude.ai Vercel | conectado | ~230 |
| claude.ai Notion | conectado | ~40 |
| claude.ai Figma | conectado | ~40 |
| claude.ai Gmail / Google Drive | conectado | ~30 / 11 |
| claude.ai Supabase | conectado | ~30 |
| claude.ai Google Calendar | requiere autenticación | — |
| plugin supabase | requiere autenticación | — |
| plugin small-business (~33 servidores) | shopify conectado (35 herramientas); resto requiere autenticación o falla | — |
| context7 (stdio, npx) | conectado | 2 |
| codegraph (stdio) | conectado, v1.5.0 (hay 1.6.0) | 1 |
| optimal | falla (HTTP 429) | — |

⚠️ La configuración de context7 pasa la API key en la línea de comandos (`--api-key ctx7sk-…`), visible en `claude mcp list`. No está en el repo, pero conviene moverla a una variable de entorno.

## ccusage

`npx ccusage@latest daily --since 20260901` funciona. Mezcla Codex y Claude Code. Claude Code solo tiene registro el 2026-09-23: 20.9M tokens (19.85M de lectura de caché), $11.51 (opus-5-5). Total del periodo (ambas herramientas): 2.16B tokens, $1 859.54.
