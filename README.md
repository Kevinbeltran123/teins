# TEINS · Levantamientos técnicos

Sistema para capturar levantamientos técnicos en campo (con o sin conexión), revisarlos en oficina con trazabilidad y entregar informes PDF al cliente.

> **Repositorio privado y confidencial.** Contiene información del proceso de TEINS protegida por un acuerdo de confidencialidad. No se publica, no se comparte y no se usan datos reales fuera de producción.

## Estado

| Etapa | Estado |
|---|---|
| Impulsores de arquitectura | Listo |
| Modelo de dominio | Listo |
| Decisiones de arquitectura (ADR 0001 a 0020) | Aceptadas |
| Dirección visual (Consola, una sola familia de letra) | Definida en `DESIGN.md` (iteración 14) y aplicada en campo, oficina y portal, con el juego de componentes de `paquetes/ui` |
| Plan de entrega | Cortes 0 a 5 definidos; estado y próximo paso en [`docs/proceso/plan-de-entrega.md`](docs/proceso/plan-de-entrega.md) |
| Código | Recorrido delgado completo (cortes 0 a 5): captura sin conexión, envío, bajada, revisión con trazabilidad, informe con versiones inmutables y PDF, y portal del cliente con QR y clave. Iteración 6: administración con segundo factor obligatorio (usuarios, teléfonos, accesos de clientes con QR, retiro de versiones). Desplegado en el entorno de pruebas (Railway); la prueba en iPhone está aplazada. Iteración 7: visitas y clientes desde oficina (programar, reasignar, reprogramar, cancelar). Iteración 8: producción provisional en Railway (dominios gratuitos, respaldo diario y simulacro verificado), sin datos reales hasta transferirla a TEINS. Iteración 9: secciones repetibles (pisos, áreas, tableros) con su nombre, de campo al PDF. Iteración 10: bocetos sobre cuadrícula en campo, vistos en oficina y en el PDF. Iteración 11: cantidades con catálogo (el técnico anota materiales, oficina los vincula al catálogo y los exporta a Excel). Iteración 12: cifrado local en campo, con borrado por destrucción de la clave. Iteración 13: llaves de acceso (passkeys) en campo y oficina. Iteración 14: interfaz rehecha con la dirección Consola (diálogos, confirmaciones, notificaciones, tablas con acciones, hojas laterales para crear, fotos que se quitan con deshacer). Desplegada en pruebas. Iteración 15: avisos push (visita asignada, cambiada o cancelada, comentario y revisión para el técnico; levantamiento nuevo para oficina) e instalación guiada antes de iniciar sesión. Iteración 16: firma del cliente en sitio como constancia de la visita, vista en oficina y en el PDF. Iteración 17: catálogo en el teléfono, con búsqueda sin conexión y líneas que llegan vinculadas a oficina. Iteración 18: croquis a pantalla completa como GoodNotes, con hojas con nombre (un piso por hoja), trazos que se enderezan, cotas y mover, vistos igual en oficina y en el PDF. Iteración 19: símbolos en el croquis (tableros, UPS, tomas…) desde una biblioteca que publica la organización y baja al teléfono. Siguiente: prueba en iPhone, producción actualizada y las iteraciones 20 y 21 del plan (correo y WhatsApp, cotizaciones) |

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

TypeScript de extremo a extremo · PWA con React y Vite · Fastify · PostgreSQL · IndexedDB con Dexie · Graphile Worker · almacenamiento compatible con S3. Cómo correrlo y verificarlo: sección "Comandos" de [`AGENTS.md`](AGENTS.md). Detalle y justificación en [`docs/adr/`](docs/adr/README.md).

## Propiedad

Software de Kevin Beltran. Todos los derechos reservados. El uso por parte de TEINS se rige por el acuerdo entre las partes.
