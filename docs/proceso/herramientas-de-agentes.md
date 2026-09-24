# Herramientas de agentes

Skills, plugins y servidores MCP que ayudan a construir Teins con agentes de programación. La regla es una sola: **cada herramienta se usa para la tarea que la necesita, no siempre.** Lo que corre en cada edición o en cada turno cuesta tiempo y contexto aunque no aporte.

Un agente nunca instala ni activa una herramienta por su cuenta: la instala o activa el desarrollador (ver `AGENTS.md`).

## Cómo se cargan

- **Skills:** al iniciar sesión solo se carga su descripción; el contenido entra cuando se invocan. Por eso pueden quedar activas.
- **Servidores MCP:** sus herramientas se cargan bajo demanda. Casi no cuestan al iniciar.
- **Hooks:** corren solos en cada edición o turno. Ninguna herramienta de esta lista debe dejar hooks activos por defecto.

## Configuración del proyecto

- `.claude/settings.json` declara los marketplaces y qué plugins quedan activos. Claude Code ofrece instalarlos al abrir el proyecto.
- `.mcp.json` declara los servidores MCP del proyecto. Claude Code pide aprobarlos la primera vez.

## Activas por defecto

| Herramienta | Tipo | Para qué | Cuándo |
|---|---|---|---|
| `antislop` y variantes | Skills | Filtro contra interfaz y texto genéricos | Todo trabajo de interfaz y textos |
| Context7 | MCP | Documentación vigente de Dexie, Drizzle, Fastify, Zod, Better Auth, Graphile Worker | Antes de usar la API de una librería |
| `shadcn` | MCP (`.mcp.json`) | Buscar e instalar componentes del registro de shadcn/ui | Al crear componentes en `paquetes/ui` (necesita `components.json`) |
| `differential-review` | Plugin, Trail of Bits | Revisión de seguridad de un cambio con su radio de impacto | Antes de fusionar cambios en `servidor`, permisos o sincronización |
| `insecure-defaults` | Plugin, Trail of Bits | Secretos por defecto, credenciales en código, configuración débil | Al tocar configuración, variables de entorno o autenticación |
| `sharp-edges` | Plugin, Trail of Bits | APIs y configuraciones propensas a errores de seguridad | Al diseñar interfaces públicas de módulos |
| `supply-chain-risk-auditor` | Plugin, Trail of Bits | Riesgo de las dependencias npm | Al agregar o actualizar dependencias (junto con la regla de licencias: sin AGPL) |
| `property-based-testing` | Plugin, Trail of Bits | Pruebas por propiedades con fast-check | Idempotencia de comandos, sincronización, cadena de hashes, migraciones de formatos |
| `/security-review` | Integrado en Claude Code | Revisión de seguridad de los cambios pendientes | Antes de abrir un pull request que toque `servidor` |

## Desactivadas: activar solo para la tarea

| Herramienta | Tipo | Para qué | Cuándo activarla | Por qué no queda activa |
|---|---|---|---|---|
| `impeccable` | Plugin | Revisión de diseño: `audit`, `critique`, `polish`, `animate` | Al construir o pulir pantallas de `oficina` y `portal` | Trae hooks que revisan cada edición y hacen una pasada de hasta 30 s al final de cada turno. En `campo` sus sugerencias de movimiento deben ser solo CSS (regla 10) |
| `auth-skills` | Plugin, Better Auth | Buenas prácticas y creación de la capa de autenticación | En el corte que implemente ADR 0009 | Solo sirve para ese trabajo |

Activar o desactivar: `/plugin` en Claude Code, o cambiar `true`/`false` en `enabledPlugins` de `.claude/settings.json`. Al terminar la tarea, se vuelve a desactivar.

## Para más adelante

- **Postgres MCP Pro** (`crystaldba/postgres-mcp`, MIT): planes `EXPLAIN`, índices y salud de la base. Cuando exista la base local de desarrollo. Siempre en modo restringido y nunca contra datos reales (R5).
- **`static-analysis`** (Trail of Bits): Semgrep y CodeQL. Requiere instalar esas herramientas de línea de comandos.

## Descartadas

- **Motion AI Kit:** genera curvas `linear()` para CSS, pero esa función requiere Motion+ (pago).
- **Vercel `web-design-guidelines`:** se cruza con `antislop-human` y la auditoría de `impeccable`.
- **Semgrep Guardian:** escanea en cada edición por hooks. El MCP independiente está archivado.
