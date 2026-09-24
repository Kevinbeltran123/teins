# AGENTS.md

Instrucciones para cualquier agente de programación que trabaje en este repositorio. `CLAUDE.md` importa este archivo; las instrucciones existen una sola vez.

## Qué es

Sistema de levantamientos técnicos para TEINS: los técnicos capturan información en campo (con o sin conexión) desde una PWA, oficina la revisa y corrige con trazabilidad, y el cliente descarga el informe PDF desde un portal. Monolito modular en TypeScript sobre PostgreSQL.

**Estado:** el avance vive en `docs/proceso/plan-de-entrega.md`, que es la fuente de verdad (mapa de cortes, qué entró, qué quedó fuera, decisiones y próximo paso). Resumen al 2026-09-24: corte 0 terminado; corte 1 construido y verificado, pendiente del entorno de pruebas y de la prueba en iPhone.

## Antes de tocar cualquier cosa, lee en este orden

0. `docs/proceso/plan-de-entrega.md`: dónde va el proyecto y cuál es el próximo paso. Empieza siempre aquí.
1. `docs/producto/contexto.md`: qué problema se resuelve.
2. `docs/arquitectura/01-impulsores.md`: restricciones (R-n) y escenarios de calidad (QA-n). Toda decisión se justifica contra ellos.
3. `docs/arquitectura/02-modelo-dominio.md`: lenguaje común, agregados, estados, reglas del negocio.
4. `docs/adr/README.md` y el ADR del área que vas a tocar.
5. Para interfaz: `DESIGN.md`, `paquetes/ui/tokens.css` y `docs/diseno/pendientes.md`.
6. `docs/proceso/forma-de-trabajo.md`: cómo se construye (cortes verticales, contrato primero).
7. `docs/proceso/herramientas-de-agentes.md`: qué skills, plugins y MCP usar, y cuándo. Solo para la tarea que los necesita.

Si una tarea contradice un ADR aceptado, **no lo ignores ni lo edites**: detente, explica el conflicto y propone un ADR nuevo que lo reemplace (plantilla en `docs/adr/0000-plantilla.md`).

## Retomar el trabajo en una sesión nueva

1. Lee el plan de entrega: el corte en curso, su tabla "Terminado cuando", sus "Decisiones tomadas al construirlo" y la sección "Próximo paso".
2. Revisa la rama y los commits: `git log --oneline -15`. El trabajo del corte 1 vive en la rama `corte-0` (aún sin fusionar ni subir).
3. Levanta el entorno local y corre la verificación completa (sección "Comandos"). Si algo no pasa en verde, eso es lo primero.
4. No repitas decisiones ya tomadas: están en los ADR y en "Decisiones tomadas al construirlo". Si una no convence, propón un ADR nuevo.

## Al cerrar un corte (o una fase de trabajo)

Una tarea no está cerrada hasta que la documentación dice lo mismo que el código:

- `docs/proceso/plan-de-entrega.md`: estado en el mapa, tabla "Terminado cuando" con evidencia, decisiones tomadas, lo que quedó fuera y en qué corte se resuelve, y el próximo paso.
- `README.md`: tabla de estado.
- `README.md` de cada paquete tocado: qué contiene y cómo se usa.
- Sección "Comandos" de este archivo si cambió cómo se corre o se verifica.
- Si una decisión cambia un ADR aceptado: ADR nuevo, nunca editar el anterior.

## Stack

TypeScript 6, Node 24, pnpm · Fastify, Zod, Drizzle, PostgreSQL, Graphile Worker · React, Vite, Tailwind, shadcn/ui · Dexie (IndexedDB) · Better Auth · S3 · Playwright + pdf-lib · perfect-freehand. El detalle y el porqué de cada elección están en el índice de `docs/adr/README.md`.

## Estructura y dependencias

```
paquetes/
  dominio/     TypeScript puro. No depende de nada.
  protocolo/   Esquemas de sincronización. Solo depende de dominio.
  servidor/    API y worker. Módulos con interfaz pública.
  campo/       PWA sin conexión.
  oficina/     Aplicación en línea.
  portal/      Portal del cliente. Nunca importa oficina ni campo.
  ui/          Componentes y tokens compartidos.
e2e/           Pruebas de extremo a extremo (Playwright, Chromium y WebKit).
scripts/       Verificaciones de la integración continua (licencias, presupuesto).
```

Dentro de `servidor`, un módulo **nunca** lee tablas de otro ni importa sus partes internas: usa su interfaz pública o eventos.

## Reglas que no se negocian

1. **Nunca datos reales** de TEINS o sus clientes fuera de producción, ni en el repositorio, ni en pruebas, ni en capturas. Acuerdo de confidencialidad (R5).
2. **Nunca secretos en el repositorio.** Configuración en variables de entorno; solo se versiona `.env.example`.
3. **Un editor por estado:** el técnico edita en borrador; después, solo el revisor que tomó el levantamiento. Nada de edición simultánea.
4. **Idempotencia:** todo comando de sincronización lleva llave de idempotencia y se puede reintentar sin duplicar.
5. **Nunca borrar datos locales para resolver una migración.** Los borradores no enviados solo existen en el dispositivo.
6. **Los formatos son datos, no código.** Un campo nuevo de un tipo existente no requiere código.
7. **Las versiones publicadas son inmutables.** Corregir es publicar una versión nueva.
8. **Todo cambio posterior al envío se registra** con autor, campo, valor anterior y valor nuevo.
9. **Permisos solo en el servidor**, denegando por defecto. Toda ruta declara su política.
10. **En `campo`, cero JavaScript de animación**: el movimiento es CSS. Motion solo en `oficina`.
11. **Ninguna pantalla define colores ni estilos propios**: solo componentes de `paquetes/ui` y tokens.
12. **Sin dependencias con licencia AGPL** ni restricciones comerciales.

## Trabajo de interfaz

- La dirección está en `DESIGN.md`. Respeta el punto focal definido para cada pantalla.
- Aplica el filtro **antislop** durante el trabajo. Lo instala el desarrollador con `npx antislop-ai` en la raíz; **un agente nunca descarga ni instala skills por su cuenta**.
- Toda vista con datos diseña los estados vacío, cargando, error y sin conexión.
- Textos en español de Colombia, con el vocabulario de TEINS, sin raya larga (—).
- Datos faltantes como marcadores explícitos (`[N]`, `[LOGO]`), nunca inventados.

## Convenciones de código

- **Términos del dominio en español**, exactamente como en el lenguaje común: `Levantamiento`, `Visita`, `VersionPublicada`, `enviarLevantamiento`. Los términos técnicos genéricos pueden ir en inglés (`repository`, `handler`).
- TypeScript estricto. Validación en los bordes con los esquemas de `protocolo`.
- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat(campo): captura de fotos sin conexión`.
- Cada pull request indica qué ADR o escenario de calidad toca.

## Cuándo una tarea está terminada

Un corte vertical está terminado cuando:
- funciona de punta a punta y está desplegado en el entorno de pruebas;
- pasa sus pruebas y las reglas de arquitectura;
- usa solo componentes de `paquetes/ui`;
- tiene sus estados vacío, cargando, error y sin conexión;
- se probó en un celular real si toca `campo`.

## Comandos

Node 24 (`.nvmrc`), pnpm por corepack (`corepack enable`) y Docker con Compose.

Entorno local (detalle en `paquetes/servidor/README.md`):

- `docker compose up -d --wait`: PostgreSQL y S3 locales.
- `pnpm --filter @teins/servidor migrar` · `sembrar` · `dev:web` · `dev:worker`.
- `pnpm dev:campo` (5173) y `pnpm --filter @teins/oficina dev` (5174); ambas reenvían `/api` al servidor.

Verificación, en el orden de la integración continua (ADR-0018):

- `pnpm typecheck`
- `pnpm arquitectura`: fronteras entre paquetes y módulos (`.dependency-cruiser.cjs`).
- `pnpm licencias`: sin AGPL ni licencias sin revisar (`scripts/verificar-licencias.mjs`).
- `pnpm audit --prod --audit-level high`
- `pnpm test`: dominio, contrato, campo y servidor (este último levanta PostgreSQL y S3 con Testcontainers).
- `pnpm presupuesto`: JavaScript inicial de campo (compile campo antes).
- `pnpm --filter @teins/e2e test`: extremo a extremo en Chromium y WebKit (requiere `docker compose up`).
