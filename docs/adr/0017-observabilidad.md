# ADR-0017 · Registros estructurados, seguimiento de errores con privacidad y salud de dispositivos vía sincronización

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-10, QA-19, QA-24, I-25, I-26, R1, R6, Ley 1581
- **Depende de:** ADR-0003, ADR-0012, ADR-0016

## Contexto

Hay tres cosas que observar, y la tercera es la más difícil:

1. **El servidor:** errores, lentitud, trabajos fallidos.
2. **El piloto:** si el sistema mejora el proceso (tiempo de la visita al informe, devoluciones por información incompleta).
3. **Los dispositivos en campo:** fallan sin conexión, en equipos que nadie de soporte ve.

Sin esto, los primeros reportes de problemas llegan como "a un técnico se le perdió algo", sin forma de saber qué pasó.

## Opciones

| Opción | Descripción |
|---|---|
| A. Solo los registros de la plataforma | Salida estándar del proceso |
| B. Pila autoalojada (Grafana, Loki, Prometheus…) | Métricas, registros y paneles propios |
| **C. Registros estructurados + servicio de seguimiento de errores + métricas de negocio en la propia base** | Combinación mínima, cada pieza con un propósito |
| D. OpenTelemetry completo con un proveedor de trazas | Trazas distribuidas, métricas y registros unificados |
| E. Analítica de producto de terceros | Eventos de uso enviados a una plataforma externa |

## Evaluación

| Criterio | A | B | C | D | E |
|---|---|---|---|---|---|
| Ver errores de dispositivos en campo | ○ | ◐ | ● | ◐ | ◐ |
| Métricas del piloto (QA-24) | ○ | ◐ | ● | ◐ | ● |
| Sin infraestructura que operar (R1, R6) | ● | ○ | ● | ◐ | ● |
| Privacidad: datos personales fuera de terceros | ● | ● | ◐ | ◐ | ○ |
| Costo (QA-19) | ● | ◐ | ● | ◐ | ◐ |
| Proporcional a un monolito con un servidor | ● | ○ | ● | ○ | ◐ |

## Decisión

**C**, en cuatro piezas:

### 1. Registros estructurados del servidor

- JSON con nivel, módulo, **id de correlación** (el mismo que usa la auditoría, ADR-0008), usuario y duración.
- Se envían a los registros de la plataforma (ADR-0016).
- **Nunca se registran:** contenido de levantamientos, claves, tokens ni datos personales más allá del id de usuario.

### 2. Seguimiento de errores (servidor, oficina, portal y campo)

- Servicio de seguimiento de errores (Sentry o compatible), con **eliminación de datos personales antes de enviar**.
- En `campo`, los errores se guardan localmente y se envían cuando hay conexión, igual que todo lo demás.
- Si TEINS prefiere no enviar nada a terceros, se puede usar una alternativa autoalojada compatible con el mismo SDK sin cambiar código.

### 3. Salud de los dispositivos, vía la sincronización

Cada `pull` de ADR-0003 incluye un pequeño **informe de salud** del dispositivo:

| Dato | Para qué |
|---|---|
| Versión de la app y del esquema local | Detectar dispositivos atrasados (ADR-0015) |
| Pendientes por enviar y antigüedad del más viejo | Detectar envíos atascados |
| Espacio usado y disponible | Anticipar problemas de almacenamiento |
| ¿Almacenamiento persistente concedido? | El riesgo principal en iPhone (ADR-0002) |
| Último error de sincronización | Diagnóstico sin pedir el teléfono |

Se guarda en la entidad *Dispositivo* y se muestra en un panel de administración. **Ventaja:** no requiere ninguna herramienta nueva, reutiliza un canal que ya existe y los datos se quedan en la infraestructura de TEINS.

### 4. Métricas del piloto, desde los datos que ya existen

Los eventos de dominio y el registro de auditoría ya tienen marcas de tiempo del servidor. Las métricas son **consultas SQL** sobre esos datos:

| Métrica | Cálculo |
|---|---|
| Tiempo de visita a informe | Fecha de la visita → publicación de la primera versión |
| Tiempo en revisión | Envío → marcado como revisado |
| Correcciones por levantamiento | Cambios de oficina posteriores al envío |
| Campos más corregidos | Agrupación de cambios por clave de campo (P9) |
| Datos marcados "no se pudo obtener" | Conteo por formato y campo |

Se calculan desde el primer día del piloto y se comparan con la línea base que TEINS reporte del proceso en papel (P41).

### Alertas

| Condición | Canal |
|---|---|
| Error nuevo o que se dispara | Servicio de seguimiento de errores |
| Trabajo que agotó sus reintentos (ADR-0012) | Correo al administrador |
| Servicio caído (verificación externa de disponibilidad) | Correo o mensaje |
| Dispositivo con pendientes de más de N días | Panel de administración |
| Presupuesto de infraestructura superado | Alertas del proveedor (ADR-0016) |

## Por qué gana a cada alternativa

- **Frente a A:** no ve nada de lo que ocurre en los dispositivos, y buscar en registros sin estructura no escala.
- **Frente a B:** es una pila de infraestructura que alguien debe operar; desproporcionado para un monolito.
- **Frente a D:** las trazas distribuidas resuelven el seguimiento entre servicios, y aquí hay uno. El id de correlación cubre la necesidad real. Se adopta si aparecen más servicios.
- **Frente a E:** enviaría comportamiento de usuarios a un tercero sin necesidad: las métricas del piloto ya están en la base.

## Consecuencias

- **A favor:** visibilidad de campo sin herramientas nuevas; métricas del piloto sin instrumentación aparte; datos personales fuera de terceros; costo mínimo.
- **En contra:** la salud del dispositivo solo se conoce cuando sincroniza (limitación inherente a trabajar sin conexión); la eliminación de datos personales en errores debe probarse.

## Cuándo revisarla

Se agregan servicios (adoptar OpenTelemetry); TEINS prohíbe cualquier envío a terceros (seguimiento de errores autoalojado); se necesitan paneles de negocio más allá del piloto (réplica de lectura con herramienta de reportes).
