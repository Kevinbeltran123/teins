# Plan de entrega

Cortes verticales ordenados por riesgo (`forma-de-trabajo.md`). Cada corte termina completo: esquema en `protocolo`, endpoint, política, auditoría, pantalla, estados y pruebas. Lo que un corte deja fuera queda escrito en su sección, con el corte que lo resuelve.

## Mapa

| Corte | Entregable demostrable | Riesgo que cierra | Estado |
|---|---|---|---|
| 0 | Captura sin conexión con fotos, instalada en iPhone | Durabilidad de la PWA en Safari (QA-1, ADR-0002) | Terminado |
| 1 | El técnico inicia sesión, envía el levantamiento y oficina lo ve en su bandeja | Entrega completa, sin duplicados y con archivos verificados (QA-2), idempotencia, aislamiento por organización | En cierre: faltan iPhone y entorno de pruebas |
| 2 | Bajada: formatos como datos, visitas asignadas, estado de mis levantamientos, permiso de trabajo local, revocación con borrado | Punto de control seguro (ADR-0005), revocación sin conexión (QA-5), formatos sin publicar la app (QA-11) | Pendiente |
| 3 | Revisión: tomar, corregir con trazabilidad por campo, comentar al técnico, marcar revisado | Concurrencia en oficina (QA-25), trazabilidad (QA-8) | Pendiente |
| 4 | Informe: composición mínima, publicación inmutable y PDF | Versiones inmutables (QA-9), PDF reproducible en segundo plano (QA-17) | Pendiente |
| 5 | Portal: acceso con QR y clave, descarga del informe vigente | Cero accesos cruzados entre clientes (QA-4, QA-7) | Pendiente |

Con el corte 5 queda el **recorrido delgado** completo. Después, iteraciones por riesgo: secciones repetibles, bocetos (ADR-0019), cantidades con catálogo y exportación, passkeys y segundo factor, cifrado local, gestión de visitas y clientes, administración de usuarios y dispositivos, salud de dispositivos (ADR-0017), entorno de producción y simulacro de restauración (ADR-0016).

## Próximo paso

**Cerrar el corte 1:** desplegar el entorno de pruebas y hacer la prueba en iPhone (criterio 4 del corte 1). La propuesta de proveedores está en "Entorno de pruebas" dentro del corte 1 y espera la aprobación de Kevin, que crea las cuentas. Después: corte 2 (bajada).

Pendientes pequeños que no bloquean: completar la fila de resultados del corte 0 (modelo de iPhone, versión de iOS, persistente, fotos íntegras) y repetir esa prueba en Android.

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

- `POST /api/sync/comandos` con `EnviarLevantamiento`, en una sola transacción: política, versión del protocolo, validación completa con el mismo validador de `dominio`, presencia y verificación de todos los archivos, guardado del agregado (columnas relacionales más documento JSONB) y auditoría de creación y envío con cadena de hashes. `LevantamientoEnviado` todavía no encola trabajos: su única reacción hoy es la bandeja, que es una consulta; el primer consumidor asíncrono (métricas del piloto) lo encolará con el puerto de la cola ya probado.
- Idempotencia completa: llave única derivada del levantamiento y resultado guardado; un reintento, incluso días después, recibe la misma respuesta.
- Si falta un archivo, la respuesta dice cuáles y el dispositivo los sube antes de reintentar.

**Dominio**

- Validador de respuestas contra la versión de formato: obligatorios (regla 3) y unidades (regla 5). El mismo código valida en el dispositivo y en el servidor.
- Marca "no se pudo obtener" con motivo para datos obligatorios (regla 3): sin ella, un técnico que no pudo medir no podría enviar.
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

| Criterio | Estado |
|---|---|
| 1. El recorrido extremo a extremo pasa en Chromium y WebKit | Cumplido en local |
| 2. Pasan las pruebas de los cuatro niveles y las reglas de arquitectura en integración continua | Cumplido en local; el flujo de GitHub Actions corre al subir la rama |
| 3. Pantallas solo con componentes de `ui` y estados vacío, cargando, error y sin conexión | Cumplido |
| 4. Probado en un iPhone real: captura sin conexión, recuperar señal, enviar con fotos y verlo en oficina | Pendiente: requiere el entorno de pruebas desplegado |

### Entorno de pruebas (propuesta, pendiente de aprobación)

Datos ficticios, cuentas de Kevin, región en Estados Unidos (Ley 1581). Verificado contra la lista de ADR-0016 el 2026-09-24:

| Pieza | Propuesta | Costo estimado | Por qué |
|---|---|---|---|
| Rol web, rol worker y PostgreSQL | Railway, plan Hobby, región US East (Virginia) | USD 5 a 8 al mes: el plan cuesta USD 5 e incluye USD 5 de uso; web, worker y base en reposo usan poco | Corre la misma imagen para ambos roles; PostgreSQL en la misma red privada con conexión directa (LISTEN/NOTIFY para la cola) y sin apagarse |
| Archivos | Cloudflare R2 | USD 0: 10 GB, 1 millón de escrituras y 10 millones de lecturas gratis al mes; sin cargo por salida | Compatible con S3, URL firmadas, CORS |
| Superficies | Dos servicios web con la misma imagen (uno por host), o un dominio propio con subdominios `campo.` y `oficina.` | Unos USD 1 a 2 más con dos servicios | ADR-0016 exige un host por superficie; no se confirmó en la documentación de Railway cuántos dominios admite un servicio |

**Descartados al verificar:**

- **Neon, plan gratuito:** apaga la base a los 5 minutos sin actividad y no se puede desactivar en ese plan; al apagarse termina las conexiones LISTEN de la cola, y el sondeo del worker agotaría las 100 horas de cómputo del mes.
- **Cloudflare R2 para exigir la huella en la subida:** R2 no admite `x-amz-checksum-sha256` en PutObject (solo `Content-MD5`, que el navegador no calcula). ADR-0007 lo contempla: exigir la huella en la carga es opcional "si el proveedor lo permite"; la garantía es la verificación del worker (firma interna, tamaño y huella; lo inválido se rechaza y se elimina). Con R2 hace falta una opción de configuración para no firmar esa cabecera. Si se prefiere exigirla también en la carga, la alternativa es Amazon S3 en `us-east-1`, con costo de centavos al mes a este volumen.

**Pasos al aprobar:** crear las cuentas (Kevin); opción de configuración para la huella en la subida, con su prueba; crear el rol `teins_app`; configurar variables y secretos en la plataforma; migrar, sembrar y desplegar; repetir la prueba de extremo a extremo contra el entorno; prueba en iPhone.

### Decisiones tomadas al construirlo

- **Almacenamiento S3 local: S3Mock (Apache-2.0).** MinIO se descartó por AGPL (regla 12). S3Mock rechaza un contenido distinto a la huella firmada, igual que un proveedor real; no admite configurar CORS (ya permite todo), por eso `S3_CONFIGURAR_CORS=false` en local.
- **TypeScript 6.** TypeScript 7 aún no publica la API de compilador que usan las reglas de arquitectura; con él, dependency-cruiser no analizaba ningún archivo. Se revisa cuando la publique.
- **Formatos de prueba v1 y v2.** v2 agrega obligatorios; los borradores del corte 0 terminan con v1 (ADR-0006, regla 3).
- **Responsable local del levantamiento.** Un teléfono compartido solo envía y sube fotos con la sesión de quien creó cada levantamiento (regla 1). Los borradores del corte 0 pasan a quien inicia sesión primero.
- **Conexión real, no solo `navigator.onLine`.** El motor registra si el servidor respondió; la interfaz dice "sin conexión" aunque el navegador diga lo contrario (red sin internet, portal cautivo).
- **Presupuesto de campo: 120 KB de JavaScript inicial comprimido,** medido en 108 KB. El código de red se carga después del primer dibujo; el service worker lo guarda para usarlo sin señal. Falta confirmarlo con una medición en un celular de gama media (ADR-0011).
- **WebKit de Playwright** bloquea las URL `blob:` sin red (Safari real no); en WebKit la prueba corta la red después de la foto. La captura completa sin red la cubren Chromium y el iPhone real.
- **Tokens neutros por superficie.** Oficina redefine tamaños con `data-superficie`, sin duplicar componentes.
