# Fase 1: skills y subagentes de usuario

Fecha: 2026-09-23 · Rama: `chore/context-optimization` · Línea base: `baseline.md`

## Decisión

- Recortar `~/.claude/skills` y `~/.claude/agents` a lo que se usa o encaja con Teins.
- GSD sale completo (skills, subagentes y `commands/gsd`): sus piezas dependen entre sí.
- Nada se borra: todo se movió a `~/.claude/_disabled/2026-09-23-fase1/` con `MANIFEST.txt` y `RESTAURAR.md`.

Evidencia de uso (11 transcripciones en `~/.claude/projects`): solo `docx` (2 llamadas) y el subagente `general-purpose` (5). Casi todo el trabajo previo fue en Codex, así que el criterio principal fue relevancia para el proyecto.

## Qué queda

Skills (27 entradas, 25 con `SKILL.md`): `antislop` y sus 5 variantes, `docx`, `pdf`, `pptx`, `xlsx`, `document-skills`, `markitdown`, `progressive-web-app`, `postgres`, `playwright-skill`, `webapp-testing`, `test-driven-development`, `systematic-debugging`, `software-architecture`, `commit`, `create-pr`, `review-local-changes`, `write-concisely`, `skill-creator`, `find-skills`, `sports-betting-analysis`, `synced` (gestionada por claude.ai).

Subagentes de usuario: ninguno. Siguen los de plugins (`feature-dev:*`, `code-simplifier`).

## Qué salió (379 entradas)

- 345 skills: 68 `gsd-*`, 8 `hyperframes-*`, científicas y de ML (K-Dense), automatizaciones Composio, `auth0-*` (enlaces simbólicos: se rompen fuera de su carpeta y vuelven a funcionar al restaurarlos), `references/` y `templates/` (apoyo de escritura científica).
- 33 subagentes `gsd-*`.
- `commands/gsd`.

## Estimado

Descripciones de skills restantes: ~7.9k caracteres ≈ 2k tokens (antes ~94k caracteres, recortados por Claude Code a 9.9k tokens). Subagentes de usuario: 3.1k → 0. Ahorro esperado ≈ 11k tokens al iniciar, sin contar skills de plugins.

## Resultado medido

`/context` en sesión nueva (claude-opus-5-5): 33.8k / 1m (3%)

| Categoría | Antes | Después | Diferencia |
|---|---|---|---|
| System prompt | 3.3k | 2.4k | −0.9k |
| System tools | 11.7k | 13.6k | +1.9k |
| MCP tools | 632 | 620 | −12 |
| Custom agents | 3.1k | 314 (4 agentes) | −2.8k |
| Memory files | 6.0k | 6k | 0 |
| Skills | 9.9k | 9.9k (101 skills) | 0 |
| Messages | 977 | 977 | 0 |
| **Total** | **35.6k** | **33.8k** | **−1.8k** |

El estimado de ≈11k no se cumplió:

- **Skills no bajó.** Claude Code lista las skills hasta un presupuesto fijo de tokens. Antes lo desbordaban 368 skills de usuario; ahora lo llenan 101, casi todas de plugins (`small-business` ≈45, `anthropic-skills` ≈10, `supabase`, `ui-ux-pro-max`, `feature-dev`, `frontend-design`) y de Claude Code. Las 25 de usuario son una parte menor.
- **Custom agents bajó 2.8k.** Los 4 que quedan vienen de plugins.
- **System prompt y System tools** cambian por Claude Code, no por esta fase.

Para bajar Skills hay que desactivar plugins, empezando por `small-business`, que no figura entre los plugins habilitados por el usuario en la línea base.

## Deja abierto para la Fase 2

Los hooks y la `statusLine` de GSD siguen en `~/.claude/settings.json` y apuntan a `~/.claude/get-shit-done/`, que no se tocó. Decidir si se quitan junto con los archivos de memoria.
