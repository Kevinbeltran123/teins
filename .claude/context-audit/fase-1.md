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

## Pendiente de medir

Abrir sesión nueva y correr `/context`; anotar aquí Skills, Custom agents y total.

## Deja abierto para la Fase 2

Los hooks y la `statusLine` de GSD siguen en `~/.claude/settings.json` y apuntan a `~/.claude/get-shit-done/`, que no se tocó. Decidir si se quitan junto con los archivos de memoria.
