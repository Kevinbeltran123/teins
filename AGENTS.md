# AGENTS.md

Instrucciones para cualquier agente de programación que trabaje en este repositorio. `CLAUDE.md` importa este archivo; las instrucciones existen una sola vez.

## Qué es

Sistema de levantamientos técnicos para TEINS: los técnicos capturan información en campo (con o sin conexión) desde una PWA, oficina la revisa y corrige con trazabilidad, y el cliente descarga el informe PDF desde un portal. Monolito modular en TypeScript sobre PostgreSQL.

**Estado:** documentación y estructura listas. El código empieza con el primer recorrido completo del plan de entrega.

## Antes de tocar cualquier cosa, lee en este orden

1. `docs/producto/contexto.md`: qué problema se resuelve.
2. `docs/arquitectura/01-impulsores.md`: restricciones (R-n) y escenarios de calidad (QA-n). Toda decisión se justifica contra ellos.
3. `docs/arquitectura/02-modelo-dominio.md`: lenguaje común, agregados, estados, reglas del negocio.
4. `docs/adr/README.md` y el ADR del área que vas a tocar.
5. Para interfaz: `DESIGN.md`, `paquetes/ui/tokens.css` y `docs/diseno/pendientes.md`.
6. `docs/proceso/forma-de-trabajo.md`: cómo se construye (cortes verticales, contrato primero).

Si una tarea contradice un ADR aceptado, **no lo ignores ni lo edites**: detente, explica el conflicto y propone un ADR nuevo que lo reemplace (plantilla en `docs/adr/0000-plantilla.md`).

## Stack

| Área | Elección | ADR |
|---|---|---|
| Estilo | Monolito modular, roles *web* y *worker* | 0001 |
| Cliente | PWA; superficies `campo`, `oficina`, `portal` compiladas por separado | 0002 |
| Sincronización | Subida por comandos idempotentes; bajada incremental con punto de control | 0003 |
| Datos en dispositivo | IndexedDB con Dexie, detrás de un puerto | 0004 |
| Base de datos | PostgreSQL (relacional + JSONB) | 0005 |
| Formatos | Esquema de dominio versionado; respuestas en modelo híbrido | 0006 |
| Archivos | Almacenamiento compatible con S3, direccionado por SHA-256 | 0007 |
| Trazabilidad | Registro semántico con cadena de hashes por agregado | 0008 |
| Identidad | Better Auth, sesiones en servidor, seguridad por fila en el portal | 0009 |
| Lenguaje | TypeScript; Node LTS; Fastify; Zod; Drizzle; pnpm | 0010 |
| Interfaz | React + Vite + Tailwind + shadcn/ui reestilizado | 0011 |
| Trabajos | Graphile Worker (la cola es el outbox) | 0012 |
| PDF | HTML + Chromium (Playwright) + pdf-lib, guardado al publicar | 0013 |
| API | HTTP orientado a tareas, OpenAPI generado desde Zod | 0014 |
| Actualización | Actualización en momento seguro; protocolo N-1 | 0015 |
| Infraestructura | Contenedor propio + Postgres y S3 gestionados, cuentas de TEINS | 0016 |
| Observabilidad | Registros estructurados, errores con privacidad, salud de dispositivos | 0017 |
| Pruebas | Guiadas por riesgo; reglas de arquitectura ejecutables | 0018 |
| Bocetos | Trazos vectoriales con perfect-freehand | 0019 |
| Marca | Tokens por organización en variables CSS | 0020 |

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

Se definirán con el primer recorrido completo. Hasta entonces no hay código que ejecutar.
