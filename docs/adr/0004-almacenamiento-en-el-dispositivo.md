# ADR-0004 · IndexedDB con Dexie detrás de un puerto de repositorio

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-1, QA-16, QA-22, I-6, I-15, R2
- **Depende de:** ADR-0002, ADR-0003

## Contexto

El dispositivo guarda borradores estructurados, datos de referencia, el outbox y archivos binarios (fotos comprimidas, bocetos). Las consultas son simples: por visita, por estado, pendientes de envío. La plataforma más delicada es Safari en iPhone.

## Opciones

| Opción | Qué es |
|---|---|
| A. localStorage | Almacén de texto del navegador |
| B. IndexedDB directo | Base nativa del navegador con API de bajo nivel |
| **C. IndexedDB con Dexie** | La misma base con una capa que simplifica transacciones, consultas y versiones |
| D. SQLite oficial sobre OPFS | SQLite en WebAssembly sobre el sistema de archivos privado |
| E. wa-sqlite sobre IndexedDB | SQLite en WebAssembly que guarda bloques en IndexedDB |
| F. PGlite | Postgres compilado para el navegador |
| G. RxDB | Base reactiva con almacenamiento intercambiable |

## Evaluación

| Criterio | A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|---|
| Capacidad para fotos | ○ | ● | ● | ● | ● | ● | ● |
| Transacciones atómicas (agregado + archivos + outbox) | ○ | ● | ● | ● | ● | ● | ● |
| Madurez en Safari de iPhone | ● | ● | ● | ◐ | ◐ | ◐ | ● |
| Sin requisitos especiales de servidor | ● | ● | ● | ○ | ● | ● | ● |
| Tamaño del paquete y arranque | ● | ● | ● | ◐ | ◐ | ○ | ◐ |
| Migraciones con versiones | ○ | ◐ | ● | ◐ | ◐ | ● | ● |
| Consultas complejas | ○ | ○ | ◐ | ● | ● | ● | ◐ |
| Simplicidad para una persona | ● | ○ | ● | ◐ | ◐ | ◐ | ◐ |

## Decisión

**C. IndexedDB con Dexie**, para datos estructurados y binarios en la misma base, detrás de un puerto de repositorio.

1. **Todo en una base:** metadatos, archivos y comando del outbox se guardan en una misma transacción. Nunca queda una foto sin referencia ni un envío sin datos.
2. **Almacenamiento persistente** solicitado al instalar.
3. **Migraciones versionadas** con funciones de actualización. **Regla absoluta:** ninguna migración borra la base para volver a descargarla; los borradores no enviados solo existen aquí. Cada migración se prueba con datos pendientes.
4. **Puerto de repositorio:** el dominio de campo no conoce Dexie; el adaptador se reemplaza sin tocar la lógica.
5. **Liberación de espacio:** lo confirmado por el servidor se elimina tras un plazo.
6. **Cifrado local:** se decide en ADR-0009. Posición registrada: protege contra copia casual de archivos, no contra alguien con el teléfono desbloqueado.

## Por qué gana a cada alternativa

- **Frente a A:** unos 5 MB de texto; una foto lo llena.
- **Frente a B:** misma base con más código repetitivo y más riesgo en transacciones y migraciones.
- **Frente a D:** su ventaja (SQL complejo) no se usa en campo. A cambio, el acceso rápido a OPFS exige un *web worker*, la implementación oficial necesita cabeceras de aislamiento (COOP/COEP) y Safari anterior a la 17 es incompatible.
- **Frente a E y F:** peso de un motor SQL completo en WebAssembly sin necesidad.
- **Frente a G:** su replicación ya la resuelve ADR-0003; la reactividad la dan las consultas en vivo de Dexie.

## Consecuencias

- **A favor:** tecnología más madura en Safari; sin requisitos de servidor; atomicidad entre datos y archivos; reemplazable gracias al puerto.
- **En contra:** consultas limitadas (aceptable en campo). Las fotos en IndexedDB en iPhone se validan con la prueba técnica de ADR-0002.

## Cuándo revisarla

La prueba en iPhone muestra lentitud o pérdidas con muchas fotos (mover binarios a OPFS y dejar metadatos en IndexedDB), o campo necesita consultas complejas.
