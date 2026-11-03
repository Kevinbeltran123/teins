# TEINS · Levantamientos técnicos

Sistema para capturar levantamientos técnicos en campo (con o sin conexión), revisarlos en oficina con trazabilidad y entregar informes PDF al cliente.

> **Repositorio privado y confidencial.** Contiene información del proceso de TEINS protegida por un acuerdo de confidencialidad. No se publica, no se comparte y no se usan datos reales fuera de producción.

## Estado

El recorrido completo funciona en el entorno de pruebas (Railway). Producción es provisional y no tiene datos reales hasta transferirla a TEINS (ADR-0021). Qué está desplegado dónde, lo que falta probar y el próximo paso están en un solo lugar: `docs/proceso/plan-de-entrega.md` (local).

## Qué hace

| Superficie | Qué hace hoy | Cómo funciona |
|---|---|---|
| Campo (PWA en el teléfono del técnico) | Sus visitas del día con horario; captura paso a paso sin conexión, con fotos, secciones repetibles (pisos, tableros), croquis a pantalla completa con hojas, formas, cotas y símbolos, materiales con el catálogo, selecciones, horarios y tablas de medidas, foto de llegada con hora de red, ubicación y mapa, y firma del cliente; una visita de otro día no se inicia y la tarjeta dice a quién preguntar; envío que se reintenta solo y, si oficina nunca lo recibió, vuelve a borrador; papelera de 30 días; chat con oficina sobre los comentarios; avisos push; datos cifrados en el teléfono y borrado al revocar; llaves de acceso | [Sincronización](docs/arquitectura/03-como-funciona.md#4-sincronización-entre-campo-y-el-servidor), ADR-0002 a 0004, 0022, 0040, 0050, 0052 |
| Oficina (aplicación web) | Bandeja; revisión con trazabilidad por campo y el capítulo del informe al lado; hilos con el técnico; informe y cotización con vista en vivo, versiones inmutables y PDF (el informe con la estructura del formato: encabezado, selecciones, tablas de medidas y firmas electrónicas); qué sale en el informe; envío por correo y WhatsApp con el estado de cada contacto, cancelable mientras está en cola; visitas, clientes, sitios y contactos; catálogo y lista de precios; usuarios, accesos de clientes y segundo factor; búsqueda con ⌘K / Ctrl + K y atajos | [Ciclo del levantamiento](docs/arquitectura/03-como-funciona.md#1-ciclo-de-vida-del-levantamiento), ADR-0006, 0008, 0028, 0029, 0031, 0039, 0051 |
| Portal del cliente | Entra con QR y clave y descarga sus informes vigentes; nunca ve lo de otro cliente | ADR-0009, QA-4 |
| Servidor y worker | API con permisos por ruta, auditoría encadenada, PDF en segundo plano, envíos, avisos, recuperación de trabajos a medias y poda | ADR-0010, 0012, 0013, 0043, 0044 |

Lo que hace falta para el piloto con TEINS (precios, plantilla del informe, datos tributarios, numeración, símbolos y la cuenta de WhatsApp) está en el plan de entrega.

## Mapa del repositorio

| Ruta | Contenido |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Instrucciones para agentes de programación (`CLAUDE.md` lo importa) |
| [`DESIGN.md`](DESIGN.md) | Dirección visual, paleta, tipografía, movimiento |
| [`docs/producto/`](docs/producto/) | Contexto del cliente, análisis inicial de la reunión y preguntas pendientes |
| [`docs/README.md`](docs/README.md) | Mapa de la documentación: qué hay en cada documento y qué actualizar cuando algo cambia |
| [`docs/arquitectura/`](docs/arquitectura/) | Impulsores, modelo de dominio y cómo funciona hoy (diagramas) |
| [`docs/adr/`](docs/adr/) | Registro de decisiones de arquitectura |
| `docs/diseno/` (local) | Referencias visuales y pantallas pendientes |
| [`docs/proceso/`](docs/proceso/) | Plan de entrega (estado y próximo paso), historia de cada iteración, forma de trabajo, entornos y verificación manual |
| [`paquetes/`](paquetes/) | Monorepo: dominio, protocolo, servidor, campo, oficina, portal, documentos, ui (cada uno con su README) |
| [`e2e/`](e2e/) | Pruebas de extremo a extremo (Chromium y WebKit) |
| `prototipos/` (local) | Prototipos navegables aprobados antes de construir cada cambio de interfaz |
| [`infra/`](infra/) | Railway, respaldos y limpieza de entornos |

## Stack

TypeScript de extremo a extremo · PWA con React y Vite · Fastify · PostgreSQL · IndexedDB con Dexie · Graphile Worker · almacenamiento compatible con S3. Cómo correrlo y verificarlo: sección "Comandos" de [`AGENTS.md`](AGENTS.md). Detalle y justificación en [`docs/adr/`](docs/adr/README.md).

## Propiedad

Software de Kevin Beltran. Todos los derechos reservados. El uso por parte de TEINS se rige por el acuerdo entre las partes.
