# TEINS · Levantamientos técnicos

Sistema para capturar levantamientos técnicos en campo (con o sin conexión), revisarlos en oficina con trazabilidad y entregar informes PDF al cliente.

> **Repositorio privado y confidencial.** Contiene información del proceso de TEINS protegida por un acuerdo de confidencialidad. No se publica, no se comparte y no se usan datos reales fuera de producción.

## Estado

| Etapa | Estado |
|---|---|
| Impulsores de arquitectura | Listo |
| Modelo de dominio | Listo |
| Decisiones de arquitectura (ADR 0001 a 0020) | Aceptadas |
| Dirección visual (Marquilla) | Definida; faltan pantallas y estados |
| Plan de entrega | Borrador: solo el corte 0 |
| Código | Corte 0: captura sin conexión |

## Mapa del repositorio

| Ruta | Contenido |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Instrucciones para agentes de programación (`CLAUDE.md` lo importa) |
| [`DESIGN.md`](DESIGN.md) | Dirección visual, paleta, tipografía, movimiento |
| [`docs/producto/`](docs/producto/) | Contexto del cliente, análisis inicial de la reunión y preguntas pendientes |
| [`docs/arquitectura/`](docs/arquitectura/) | Impulsores y modelo de dominio |
| [`docs/adr/`](docs/adr/) | Registro de decisiones de arquitectura |
| [`docs/diseno/`](docs/diseno/) | Referencias, pantallas pendientes, supuestos, insumos por pedir y herramientas |
| [`docs/proceso/`](docs/proceso/) | Forma de trabajo y, próximamente, el plan de entrega |
| [`paquetes/`](paquetes/) | Monorepo: dominio, protocolo, servidor, campo, oficina, portal, ui |

## Stack

TypeScript de extremo a extremo · PWA con React y Vite · Fastify · PostgreSQL · IndexedDB con Dexie · Graphile Worker · almacenamiento compatible con S3. Detalle y justificación en [`docs/adr/`](docs/adr/README.md).

## Propiedad

Software de Kevin Beltran. Todos los derechos reservados. El uso por parte de TEINS se rige por el acuerdo entre las partes.
