# AGENTS.md

Instrucciones para cualquier agente de programación que trabaje en este repositorio. `CLAUDE.md` importa este archivo; las instrucciones existen una sola vez.

## Qué es

Sistema de levantamientos técnicos para TEINS: los técnicos capturan información en campo (con o sin conexión) desde una PWA, oficina la revisa y corrige con trazabilidad, y el cliente descarga el informe PDF desde un portal. Monolito modular en TypeScript sobre PostgreSQL.

**Estado:** el avance vive en `docs/proceso/plan-de-entrega.md`, que es la fuente de verdad (mapa de cortes, qué entró, qué quedó fuera, decisiones y próximo paso). Resumen al 2026-09-25: recorrido delgado completo (cortes 0 a 5: captura, envío, bajada, revisión, informe con PDF y portal del cliente), más las iteraciones 6 (administración con segundo factor) y 7 (visitas y clientes desde oficina), y producción provisional montada y respaldada (iteración 8, `docs/proceso/produccion.md`; sin datos reales hasta transferirla a TEINS, ADR-0021), desplegado en el entorno de pruebas de Railway (`docs/proceso/entorno-de-pruebas.md`). Pendientes: prueba en iPhone (aplazada por Kevin) y respuestas de TEINS para ajustar el informe. Iteraciones 9 (secciones repetibles), 10 (bocetos), 11 (cantidades con catálogo), 12 (cifrado local, ADR-0022) y 13 (llaves de acceso) terminadas en el entorno de pruebas, con la prueba en iPhone en espera. Iteración 14 (interfaz rehecha con la dirección Consola, `DESIGN.md`, y columna "Visita" en la bandeja) terminada y desplegada en el entorno de pruebas. El 2026-09-26 Kevin aprobó el plan de las iteraciones 15 a 21 (avisos push e instalación guiada, firma del cliente, catálogo en campo, bocetos con enderezado y símbolos, informe por correo y WhatsApp, cotizaciones; sección "Iteraciones 15 a 21" del plan de entrega). Iteraciones 15 (avisos push, ADR-0023, e instalación guiada), 16 (firma del cliente, ADR-0024), 17 (catálogo en el teléfono, ADR-0025), 18 (croquis a pantalla completa con hojas, formas enderezadas, cotas y mover, ADR-0026) y 19 (símbolos en el croquis, ADR-0027) terminadas y desplegadas en el entorno de pruebas. Iteración 20 (contactos del cliente e informe por correo y WhatsApp, ADR-0028) terminada y desplegada en el entorno de pruebas el 2026-09-27: el correo sale por Resend y WhatsApp sigue simulado hasta tener el número de prueba de Meta. WhatsApp en espera por un problema con la cuenta de Meta de Kevin. Iteración 21 (cotizaciones desde las cantidades, ADR-0029) construida el 2026-09-27: con ella se cierra el plan de las iteraciones 15 a 21. Iteración 22 (2026-09-27): campo rehecho con la dirección Recorrido (`DESIGN.md`, ADR-0030), a partir de una línea base, una crítica con impeccable, referencias de Mobbin y un prototipo navegable en `prototipos/campo/`; desplegada en el entorno de pruebas. Siguiente: la prueba en iPhone de las fases 9 a 19 y lo que entregue TEINS (precios, plantilla P29, tributario, numeración, símbolos).

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
2. Revisa la rama y los commits: `git log --oneline -15`. El trabajo de los cortes 0 a 5 y las iteraciones 6 a 15 vive en la rama `corte-0`, con commits por área; está en GitHub con el pull request #1 en borrador y la integración continua en verde.
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

- La dirección está en `DESIGN.md` (Consola desde la iteración 14). Respeta el punto focal definido para cada pantalla y la jerarquía: el título es la sección del menú, las subsecciones son pestañas.
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
- Railway (detalle en `docs/proceso/produccion.md`): `railway config plan` / `apply` sobre `.railway/railway.ts`; `infra/railway/montar.sh <proyecto>` monta un entorno desde cero; `railway run --service respaldos infra/respaldos/simulacro.sh` hace el simulacro de restauración; `pnpm --filter @teins/servidor verificar-integridad` verifica las cadenas de una base.
- `pnpm dev:campo` (5173), `pnpm --filter @teins/oficina dev` (5174) y `pnpm --filter @teins/portal dev` (5175); reenvían `/api` al servidor.

Verificación, en el orden de la integración continua (ADR-0018):

- `pnpm typecheck`
- `pnpm arquitectura`: fronteras entre paquetes y módulos (`.dependency-cruiser.cjs`).
- `pnpm licencias`: sin AGPL ni licencias sin revisar (`scripts/verificar-licencias.mjs`).
- `pnpm audit --prod --audit-level high`
- `pnpm test`: dominio, contrato, campo, oficina (CSV) y servidor (este último levanta PostgreSQL y S3 con Testcontainers).
- `pnpm presupuesto`: JavaScript inicial de campo (compile campo antes).
- `pnpm --filter @teins/e2e test`: extremo a extremo en Chromium y WebKit (requiere `docker compose up`). Contra el entorno de pruebas: `E2E_CAMPO_URL`, `E2E_OFICINA_URL` y `E2E_PORTAL_URL` (ver `docs/proceso/entorno-de-pruebas.md`).
