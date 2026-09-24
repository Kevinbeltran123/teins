# Plan de entrega

Cortes verticales ordenados por riesgo (`forma-de-trabajo.md`). Cada corte termina completo: esquema en `protocolo`, endpoint, política, auditoría, pantalla, estados y pruebas. Lo que un corte deja fuera queda escrito en su sección, con el corte que lo resuelve.

## Mapa

| Corte | Entregable demostrable | Riesgo que cierra | Estado |
|---|---|---|---|
| 0 | Captura sin conexión con fotos, instalada en iPhone | Durabilidad de la PWA en Safari (QA-1, ADR-0002) | Terminado |
| 1 | El técnico inicia sesión, envía el levantamiento y oficina lo ve en su bandeja | Entrega completa, sin duplicados y con archivos verificados (QA-2), idempotencia, aislamiento por organización | En curso |
| 2 | Bajada: formatos como datos, visitas asignadas, estado de mis levantamientos, permiso de trabajo local, revocación con borrado | Punto de control seguro (ADR-0005), revocación sin conexión (QA-5), formatos sin publicar la app (QA-11) | Pendiente |
| 3 | Revisión: tomar, corregir con trazabilidad por campo, comentar al técnico, marcar revisado | Concurrencia en oficina (QA-25), trazabilidad (QA-8) | Pendiente |
| 4 | Informe: composición mínima, publicación inmutable y PDF | Versiones inmutables (QA-9), PDF reproducible en segundo plano (QA-17) | Pendiente |
| 5 | Portal: acceso con QR y clave, descarga del informe vigente | Cero accesos cruzados entre clientes (QA-4, QA-7) | Pendiente |

Con el corte 5 queda el **recorrido delgado** completo. Después, iteraciones por riesgo: secciones repetibles, bocetos (ADR-0019), cantidades con catálogo y exportación, passkeys y segundo factor, cifrado local, gestión de visitas y clientes, administración de usuarios y dispositivos, salud de dispositivos (ADR-0017), entorno de producción y simulacro de restauración (ADR-0016).

**Preguntas a TEINS antes del corte 3:** P7 y P8 (formatos y campos obligatorios reales), P9 (errores frecuentes). **Antes del corte 4:** P22, P23 y P26 (informe). **Antes del piloto:** P40 a P43.

---

## Corte 0 · Captura sin conexión y prueba de durabilidad en iPhone

**Para qué:** validar QA-1 con el almacenamiento real de `campo` antes de construir encima (ADR-0002, ADR-0004).

**Alcance:** formato ficticio de una sección con campos `texto`, `medida` y `foto`; levantamiento en borrador con guardado automático; fotos recodificadas sin metadatos con huella SHA-256 en la misma transacción que su referencia; IndexedDB con Dexie detrás de un puerto; PWA instalable con actualización ofrecida; panel de diagnóstico.

**Procedimiento de la prueba (ADR-0002):**

1. Instalar la app en la pantalla de inicio y abrirla desde ahí. Confirmar en el diagnóstico que el almacenamiento es persistente.
2. Activar modo avión.
3. Crear levantamientos y capturar unas 50 fotos repartidas entre ellos durante varias horas, con texto y medidas.
4. Cerrar la app desde el selector de apps. Reiniciar el teléfono.
5. Abrir la app sin conexión. En el diagnóstico, "Verificar fotos" debe informar todas las fotos íntegras y los textos deben estar completos.

**Resultados:**

| Fecha | Dispositivo | Sistema | Persistente | Fotos | Íntegras | Resultado |
|---|---|---|---|---|---|---|
| 2026-09-24 | iPhone [modelo por registrar] | iOS [versión por registrar] | [por registrar] | [N] | [N] | Sin pérdida, según Kevin |

**Decisión:** se mantiene la PWA (ADR-0002); Capacitor no es necesario. Pendiente: completar la fila con los datos exactos y repetir en Android.

---

## Corte 1 · Envío a oficina

**Para qué:** que un levantamiento capturado sin conexión llegue al servidor **completo, una sola vez y con sus fotos verificadas**, aunque la señal se corte a mitad (QA-2), y que oficina lo vea. Es el primer corte con servidor, así que también deja la base de toda la arquitectura del servidor.

### Alcance

**Servidor, base de la arquitectura (ADR-0001, ADR-0010, ADR-0017)**

- Monolito modular con módulos `identidad`, `formatos`, `levantamientos`, `archivos` y `auditoria`. Cada módulo expone solo su interfaz pública; los núcleos (`levantamientos`, `formatos`) son hexagonales.
- Un código y dos roles de ejecución: `web` (API) y `worker` (trabajos).
- Configuración por variables de entorno validada al arrancar; el proceso no arranca con configuración inválida.
- Registros JSON con id de correlación por solicitud; nunca contenido de levantamientos ni secretos.
- Errores en formato Problem Details (RFC 9457) con códigos del dominio.
- Apagado ordenado: termina las solicitudes y trabajos en curso antes de salir.

**Base de datos (ADR-0005, ADR-0009)**

- PostgreSQL con un esquema por módulo y migraciones de Drizzle, siempre de expansión (ADR-0015).
- Organización en todas las tablas de negocio, con seguridad por fila: cada transacción fija la organización con `SET LOCAL` y la base filtra.
- El rol de la aplicación solo inserta y lee en auditoría; nunca actualiza ni borra.

**Identidad y autorización (ADR-0009)**

- Better Auth con usuario y contraseña; sesiones opacas en cookie `HttpOnly`, `Secure`, `SameSite`; revocar es borrar la sesión.
- Roles técnico y oficina; usuarios creados por un comando de administración (la pantalla llega en una iteración posterior).
- Módulo central de políticas. Toda ruta declara su política o no responde; una prueba recorre el registro de rutas y falla si alguna no la declara.

**Protocolo (ADR-0003, ADR-0014, ADR-0015)**

- Esquemas Zod versionados en `protocolo`: `EnviarLevantamiento`, autorización de subida y respuestas. La versión viaja en una cabecera; el servidor acepta la actual y la anterior.
- Especificación OpenAPI generada desde los esquemas.

**Archivos (ADR-0007)**

- Autorización de subida: URL firmada de corta duración, limitada en tamaño y tipo, para la clave `organizacion/sha256`.
- Carga directa desde el dispositivo al almacenamiento.
- Verificación en el `worker`: firma interna del archivo, tamaño y huella. Estados pendiente, subido y verificado.

**Recepción del envío (ADR-0003, ADR-0005, ADR-0008, ADR-0012)**

- `POST /api/sync/comandos` con `EnviarLevantamiento`, en una sola transacción: política, versión del protocolo, validación completa con el mismo validador de `dominio`, presencia y verificación de todos los archivos, guardado del agregado (columnas relacionales más documento JSONB), auditoría de creación y envío con cadena de hashes, y el evento `LevantamientoEnviado` encolado en la misma transacción.
- Idempotencia completa: llave única derivada del levantamiento y resultado guardado; un reintento, incluso días después, recibe la misma respuesta.
- Si falta un archivo, la respuesta dice cuáles y el dispositivo los sube antes de reintentar.

**Dominio**

- Validador de respuestas contra la versión de formato: obligatorios (regla 3) y unidades (regla 5). El mismo código valida en el dispositivo y en el servidor.
- Transición borrador → enviado.

**Campo (ADR-0003, ADR-0004, ADR-0015)**

- Inicio de sesión (requiere conexión, como toda primera instalación).
- Outbox en Dexie con una migración a la versión 2 probada sobre borradores pendientes.
- Fotos que suben por adelantado cuando hay señal.
- "Enviar a oficina" con validación local previa; el levantamiento enviado queda de solo lectura.
- Estado de sincronización siempre visible: pendiente de enviar, enviando, recibido, error.
- Reintentos con espera exponencial y aleatoria al abrir la app y al recuperar señal; un error permanente se muestra al técnico y no se reintenta.

**Oficina**

- Inicio de sesión y bandeja de solo lectura "Esperando revisión", con el detalle del levantamiento y sus fotos. La revisión llega en el corte 3.

**Desarrollo local (ADR-0016)**

- Docker Compose con PostgreSQL y un almacenamiento compatible con S3 de licencia permisiva.
- Datos de prueba ficticios con un comando.

**Pruebas (ADR-0018)**

- Dominio: validador con casos de conformidad y máquina de estados con pruebas basadas en propiedades.
- Integración con PostgreSQL real en contenedores: dos envíos simultáneos del mismo levantamiento se procesan una vez; envío con archivo faltante; aislamiento entre organizaciones; auditoría que no se puede modificar; cadena de hashes que detecta una alteración; trabajo que no existe si la transacción se revierte.
- Arnés de fallas del cliente de sincronización: corte a mitad de una carga, respuesta perdida después de confirmar, entrega duplicada, cierre de la app entre guardar y encolar.
- Extremo a extremo con Playwright: capturar sin conexión, recuperar señal, enviar y verlo en la bandeja de oficina.

**Reglas de arquitectura en integración continua (ADR-0018)**

- Tipos, pruebas, dependencias entre paquetes y módulos (dependency-cruiser), cobertura de políticas en rutas y licencias sin AGPL, en GitHub Actions.

### Fuera del corte 1

| Qué | Dónde se resuelve |
|---|---|
| Bajada: formatos desde el servidor, visitas, estado de mis levantamientos | Corte 2. Mientras tanto, el formato ficticio se siembra en el servidor y `campo` lo trae incluido, con la misma versión |
| Permiso de trabajo local y borrado por revocación | Corte 2 (viajan con la bajada) |
| Passkeys y segundo factor | Iteración posterior; el administrador aún no tiene acciones en el sistema |
| Cifrado local (ADR-0009, parte 5) | Iteración posterior |
| Miniaturas | Corte 4, cuando el PDF las necesite |
| Informe de salud del dispositivo | Corte 2, con la bajada (ADR-0017) |
| Seguimiento de errores con servicio externo | Antes del piloto, con la decisión de TEINS sobre terceros |
| Entorno de pruebas con servidor desplegado | Al cerrar el corte 1: requiere elegir proveedor según la lista de ADR-0016 |

### Terminado cuando

1. El recorrido extremo a extremo pasa en Chromium y WebKit.
2. Pasan todas las pruebas de los cuatro niveles descritos y las reglas de arquitectura en integración continua.
3. Las pantallas nuevas usan solo componentes de `ui` y tienen estados vacío, cargando, error y sin conexión.
4. Se probó en un iPhone real: captura sin conexión, recuperar señal, enviar con fotos y verlo en oficina.
