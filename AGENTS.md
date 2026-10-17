# AGENTS.md

Instrucciones para cualquier agente de programación que trabaje en este repositorio. `CLAUDE.md` importa este archivo; las instrucciones existen una sola vez.

## Qué es

Sistema de levantamientos técnicos para TEINS: los técnicos capturan información en campo (con o sin conexión) desde una PWA, oficina la revisa y corrige con trazabilidad, y el cliente descarga el informe PDF desde un portal. Monolito modular en TypeScript sobre PostgreSQL.

**Estado:** vive en un solo lugar, [`docs/proceso/plan-de-entrega.md`](docs/proceso/plan-de-entrega.md): estado actual, próximo paso y mapa de cortes. No se copia aquí: ni fechas, ni número de iteración, ni estado de los entornos. En resumen: recorrido completo (captura sin conexión, envío, revisión, informe con PDF, portal del cliente) más las iteraciones que siguieron, con un entorno de pruebas y una producción provisional en Railway. Lo que pasó en cada corte o iteración, con sus decisiones, está en [`docs/proceso/historia/`](docs/proceso/historia/README.md).

Mapa de toda la documentación, con qué actualizar cuando cambia algo: [`docs/README.md`](docs/README.md).

## Antes de tocar cualquier cosa, lee en este orden

0. `docs/proceso/plan-de-entrega.md`: dónde va el proyecto y cuál es el próximo paso. Empieza siempre aquí.
1. `docs/producto/contexto.md`: qué problema se resuelve.
2. `docs/arquitectura/01-impulsores.md`: restricciones (R-n) y escenarios de calidad (QA-n). Toda decisión se justifica contra ellos.
3. `docs/arquitectura/02-modelo-dominio.md`: lenguaje común, agregados, estados, reglas del negocio.
4. `docs/arquitectura/03-como-funciona.md`: cómo funciona hoy, en diagramas (ciclo del levantamiento, visitas, envíos, sincronización), cada uno ligado a su código y sus ADR.
5. `docs/adr/README.md` y el ADR del área que vas a tocar.
6. Para interfaz: `DESIGN.md`, `paquetes/ui/tokens.css` y `docs/diseno/pendientes.md`.
7. `docs/proceso/forma-de-trabajo.md`: cómo se construye (cortes verticales, contrato primero).
8. `docs/proceso/herramientas-de-agentes.md`: qué skills, plugins y MCP usar, y cuándo. Solo para la tarea que los necesita.

Si una tarea contradice un ADR aceptado, **no lo ignores ni lo edites**: detente, explica el conflicto y propone un ADR nuevo que lo reemplace (plantilla en `docs/adr/0000-plantilla.md`).

## Retomar el trabajo en una sesión nueva

1. Lee el plan de entrega: "Estado actual" y "Próximo paso". Si retomas una iteración a medias, lee su archivo en `docs/proceso/historia/` (alcance, "Terminado cuando" y "Decisiones tomadas al construirlo").
2. Revisa la rama y los commits: `git log --oneline -15`. Se trabaja en `corte-0` y se lleva a `master` con un pull request; la integración continua corre en cada uno, con la prueba de extremo a extremo en un trabajo por navegador. `master` exige una aprobación y se fusiona con squash; justo después, `git merge -s ours origin/master` en `corte-0` (con los árboles iguales) evita que el siguiente pull request choque con el squash.
3. Levanta el entorno local y corre la verificación completa (sección "Comandos"). Si algo no pasa en verde, eso es lo primero.
4. No repitas decisiones ya tomadas: están en los ADR y en "Decisiones tomadas al construirlo" de cada archivo de `docs/proceso/historia/`. Si una no convence, propón un ADR nuevo.

## Al cerrar un corte (o una fase de trabajo)

Una tarea no está cerrada hasta que la documentación dice lo mismo que el código. La lista es la misma de `docs/README.md` ("Al cerrar una iteración"):

- `docs/proceso/historia/NN-<tema>.md` de la iteración: alcance, tabla "Terminado cuando" con evidencia, decisiones tomadas, lo que quedó fuera y en qué iteración se resuelve; y su fila en `docs/proceso/historia/README.md`.
- `docs/proceso/plan-de-entrega.md`: su fila del mapa, "Estado actual" y "Próximo paso" (se reemplaza; el anterior pasa al archivo de historia, bajo "Al cerrarla").
- `docs/arquitectura/03-como-funciona.md` si cambió un estado, una transición o un flujo.
- `README.md`: solo si cambia lo que el sistema hace en grande (tabla "Qué hace").
- `README.md` de cada paquete tocado: qué contiene y cómo se usa.
- Sección "Comandos" de este archivo si cambió cómo se corre o se verifica.
- Si una decisión cambia un ADR aceptado: ADR nuevo, nunca editar el anterior.

## Stack

TypeScript 6, Node 24, pnpm · Fastify, Zod, Drizzle, PostgreSQL, Graphile Worker · React, Vite, Tailwind, componentes propios en `paquetes/ui` con iconos Lucide · Dexie (IndexedDB) · Better Auth · S3 · Playwright + pdf-lib · perfect-freehand. El detalle y el porqué de cada elección están en el índice de `docs/adr/README.md`.

## Estructura y dependencias

```
paquetes/
  dominio/     TypeScript puro. No depende de nada.
  protocolo/   Esquemas de sincronización. Solo depende de dominio.
  servidor/    API y worker. Módulos con interfaz pública.
  campo/       PWA sin conexión.
  oficina/     Aplicación en línea.
  portal/      Portal del cliente. Nunca importa oficina ni campo.
  documentos/  Plantillas del informe, la cotización y los mensajes. Solo depende de dominio; las usan servidor y oficina.
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
10. **Cero JavaScript de animación**: el movimiento es CSS (View Transitions y keyframes) en `campo` y en `oficina`; el JavaScript solo dice cuándo empieza una transición (`conTransicion`). Sin Motion desde la iteración 27 (`DESIGN.md`, movimiento).
11. **Ninguna pantalla define colores ni estilos propios**: solo componentes de `paquetes/ui` y tokens.
12. **Sin dependencias con licencia AGPL** ni restricciones comerciales.

## Trabajo de interfaz

- La dirección está en `DESIGN.md` (Precisión desde el 2026-09-29). Respeta el punto focal definido para cada pantalla y la jerarquía: el título es la sección del menú, las subsecciones son pestañas.
- **Todo se justifica:** cada dato, texto, filtro o acción en pantalla responde a qué decisión o acción de la persona ayuda (`DESIGN.md`, "La regla"). Lo que no tiene respuesta no va.
- Confirmar o deshacer según las consecuencias (tabla de `DESIGN.md`); crear en hoja lateral y lo nuevo primero y resaltado.
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
- Administración por comando: `crear-usuario`, `desactivar-usuario`, `marcar-administrador`, `crear-cliente`, `crear-visita`, `reasignar-visita`, `publicar-formato`, `crear-acceso-cliente`, `generar-claves-avisos` (tabla en `paquetes/servidor/README.md`). Usuarios, accesos de clientes y retiro de versiones también tienen pantalla en oficina (iteración 6), para quien tiene la marca de administrador y el segundo factor activo; clientes, sitios y visitas, para toda persona de oficina (iteración 7).
- Railway (detalle en `docs/proceso/produccion.md`): `railway config plan` / `apply` sobre `.railway/railway.ts`; `infra/railway/montar.sh <proyecto>` monta un entorno desde cero; `infra/railway/verificar-exposicion.sh` comprueba que solo las tres superficies se alcanzan desde internet; `railway run --service respaldos infra/respaldos/simulacro.sh` hace el simulacro de restauración (los respaldos van cifrados con `RESPALDOS_CLAVE`); `pnpm --filter @teins/servidor verificar-integridad` verifica las cadenas de una base.
- `pnpm dev:campo` (5173), `pnpm --filter @teins/oficina dev` (5174) y `pnpm --filter @teins/portal dev` (5175); reenvían `/api` al servidor.

Verificación, en el orden de la integración continua (ADR-0018):

- `pnpm typecheck`
- `pnpm arquitectura`: fronteras entre paquetes y módulos (`.dependency-cruiser.cjs`).
- `pnpm licencias`: sin AGPL ni licencias sin revisar (`scripts/verificar-licencias.mjs`).
- `pnpm audit --prod --audit-level high`
- `pnpm test`: las pruebas de cada paquete (dominio, protocolo, documentos, campo, oficina y servidor; este último levanta PostgreSQL y S3 con Testcontainers).
- `pnpm presupuesto`: JavaScript inicial de campo (compile campo antes).
- `pnpm --filter @teins/e2e test`: extremo a extremo en Chromium y WebKit (requiere `docker compose up`). Contra el entorno de pruebas: `E2E_CAMPO_URL`, `E2E_OFICINA_URL` y `E2E_PORTAL_URL` (ver `docs/proceso/entorno-de-pruebas.md`).
