# ADR-0016 · Contenedor propio sobre servicios de datos gestionados, en cuentas de TEINS

- **Estado:** Aceptada
- **Fecha:** 2026-09-23
- **Impulsores:** QA-10, QA-14, QA-18, QA-19, I-16, I-29, I-30, R3, R5, R6, R10, Ley 1581 (art. 26)
- **Depende de:** ADR-0001, ADR-0005, ADR-0007, ADR-0012, ADR-0013

## Contexto

TEINS aloja y paga producción (R10), quiere el menor costo posible (P38) y no tiene, hasta donde se sabe, personal de operaciones. El sistema tiene tres piezas con estado distinto:

| Pieza | Estado | Qué exige |
|---|---|---|
| Aplicación (roles *web* y *worker*) | Sin estado | Desplegar y reemplazar fácilmente |
| PostgreSQL | Estado crítico | Copias automáticas, restauración a un punto en el tiempo, parches |
| Almacenamiento de objetos | Estado voluminoso | Durabilidad, costo por GB bajo |

Restricción legal: la Ley 1581 prohíbe transferir datos personales a países sin nivel adecuado de protección. La SIC publicó una lista de países adecuados que incluye a Estados Unidos y a los de la Unión Europea, entre otros. **Brasil no figura en esa lista**, así que una región en São Paulo, aunque tenga menor latencia, exigiría verificar su situación antes de usarla.

## Opciones

| Opción | Descripción |
|---|---|
| A. Un servidor virtual con todo | Aplicación, Postgres y almacenamiento de objetos en una máquina con Docker Compose |
| **B. Contenedor en una plataforma gestionada + Postgres gestionado + almacenamiento compatible con S3** | La plataforma ejecuta la imagen; los datos viven en servicios gestionados |
| C. Nube grande con servicios nativos (AWS ECS + RDS + S3, o equivalentes) | Máximo control y robustez |
| D. BaaS como infraestructura (base y almacenamiento gestionados de un solo proveedor) + contenedor aparte | Aprovecha piezas gestionadas del BaaS |
| E. Plataforma *serverless* + Postgres *serverless* | Funciones y base que escalan a cero |
| F. Servidor propio en la oficina de TEINS | Infraestructura local |

## Evaluación

| Criterio | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Copias y restauración sin personal de operaciones (QA-10) | ○ | ● | ● | ● | ● | ○ |
| Costo mensual bajo y predecible (QA-19) | ● | ◐ | ○ | ◐ | ◐ | ◐ |
| Operable por un tercero sin experiencia en infraestructura (QA-18) | ○ | ● | ○ | ● | ◐ | ○ |
| Soporta el *worker* con Chromium y procesos largos (ADR-0013) | ● | ● | ● | ● | ○ | ● |
| Portabilidad: interfaces estándar (R6) | ● | ● | ◐ | ◐ | ◐ | ● |
| Disponibilidad (energía, conectividad) | ◐ | ● | ● | ● | ● | ○ |

## Decisión

**B. Una imagen de contenedor propia sobre una plataforma gestionada, con PostgreSQL gestionado y almacenamiento compatible con S3, todo en cuentas a nombre de TEINS y en regiones de países con nivel adecuado de protección.**

### Principio: portable por interfaces, gestionado en los datos

| Pieza | Interfaz estándar | Por qué |
|---|---|---|
| Aplicación | Imagen de contenedor (OCI) | Corre igual en cualquier plataforma, en el equipo del desarrollador y en integración continua |
| Base de datos | Protocolo PostgreSQL | Cualquier proveedor gestionado, o autoalojada |
| Archivos | API de S3 | Cualquier proveedor compatible, incluido uno autoalojado |

**Cambiar de proveedor es configuración, no código.** Eso protege a TEINS del aumento de precios o del cierre de un servicio.

### Una imagen, un servicio, tres superficies

La misma imagen corre con dos roles (ADR-0001). El rol *web* sirve los tres paquetes estáticos y la API **en el mismo origen de cada superficie** (`campo.<dominio>`, `oficina.<dominio>`, `portal.<dominio>`, cada uno con `/api`). Consecuencias:

- Sin configuración de CORS.
- Cookies aisladas por superficie (ADR-0009): la sesión del portal no convive con la de oficina.
- Un solo servicio que desplegar y vigilar.

### Selección concreta del proveedor

Los precios cambian y TEINS paga, así que el proveedor se elige **en el momento de desplegar** con esta lista de verificación, no queda fijado aquí:

1. Región en un país con nivel adecuado de protección (preferentemente Estados Unidos, por latencia con Colombia).
2. Postgres gestionado con restauración a un punto en el tiempo y extensiones necesarias (`pgcrypto` para Graphile Worker).
3. Conexión directa a Postgres disponible (no solo mediante un *pooler* en modo transacción), porque `LISTEN/NOTIFY` la requiere (ADR-0012).
4. Almacenamiento con URLs firmadas, límite de tamaño en la carga y, de ser posible, sin cargos por transferencia de salida.
5. Soporte para ejecutar la imagen con Chromium en el *worker* (memoria suficiente).
6. Alertas de presupuesto.
7. Sin pausa automática de proyectos inactivos en el plan contratado (común en capas gratuitas).

### Entornos

| Entorno | Datos | Propósito | Cuenta |
|---|---|---|---|
| Local | Ficticios | Desarrollo con Docker Compose: Postgres y un almacenamiento compatible con S3 local | Del desarrollador |
| Pruebas | Ficticios | Validación, demostraciones y concurso | Del desarrollador o de TEINS |
| Producción | Reales | Operación | **De TEINS** (R10) |

**Nunca hay datos reales fuera de producción** (R5). Los secretos viven en el gestor de secretos de cada plataforma, uno por entorno, nunca en el repositorio (I-16).

### Integración y despliegue continuos

1. Cada cambio ejecuta: pruebas, reglas de arquitectura, presupuesto de rendimiento, auditoría de dependencias y verificación de licencias (ADR-0018).
2. Si todo pasa, se construye la imagen y se despliega automáticamente en **Pruebas**.
3. **Producción requiere aprobación manual.** Antes de la nueva versión se ejecutan las migraciones de base, siempre en fase de expansión (ADR-0015).

La configuración de la plataforma se guarda como código en el repositorio (archivo declarativo de la plataforma o infraestructura como código), para que otra persona pueda recrear el entorno completo (QA-18).

### Copias de seguridad (QA-10, I-29)

| Nivel | Mecanismo | Protege contra |
|---|---|---|
| 1 | Restauración a un punto en el tiempo del Postgres gestionado | Errores humanos, fallas de disco |
| 2 | Volcado lógico periódico hacia **otro proveedor o cuenta** | Pérdida de la cuenta o del proveedor principal |
| 3 | Objetos inmutables con retención mayor que la de las copias (ADR-0007) | Restauraciones que referencian archivos |
| 4 | **Simulacro de restauración** programado y documentado | Descubrir que las copias no sirven cuando ya es tarde |

## Por qué gana a cada alternativa

- **Frente a A:** es el más barato, pero deja en TEINS la responsabilidad de parches, copias, seguridad del sistema operativo y recuperación. Sin personal de operaciones, eso es la receta para perder datos.
- **Frente a C:** robustez que TEINS no necesita, con complejidad y costo que sí pagaría.
- **Frente a D:** viable y a veces más barato. Pero la autenticación y la lógica ya viven en la aplicación (ADR-0001, ADR-0009), así que del BaaS solo se usarían base y archivos, a cambio de sus límites (conexiones, pausas en planes gratuitos). Es compatible con esta decisión: un Postgres y un almacenamiento de un BaaS cumplen la lista de verificación si pasan sus criterios.
- **Frente a E:** incompatible con el *worker* de Chromium y los procesos largos (ADR-0001, ADR-0013).
- **Frente a F:** depende de la energía y conectividad de la oficina, y del personal para mantenerlo.

## Consecuencias

- **A favor:** TEINS no opera servidores; copias y restauración gestionadas con simulacro; cambiar de proveedor es configuración; entornos separados que cumplen el acuerdo de confidencialidad.
- **En contra:** costo mayor que un servidor virtual solitario; dependencia de dos o tres proveedores, mitigada por las interfaces estándar.

## Cuándo revisarla

El costo supera el presupuesto de TEINS (servidor virtual con copias gestionadas externas); TEINS exige que los datos queden en Colombia (proveedor con región local o infraestructura propia); el volumen justifica una nube grande.
