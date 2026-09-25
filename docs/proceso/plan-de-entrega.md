# Plan de entrega

Cortes verticales ordenados por riesgo (`forma-de-trabajo.md`). Cada corte termina completo: esquema en `protocolo`, endpoint, política, auditoría, pantalla, estados y pruebas. Lo que un corte deja fuera queda escrito en su sección, con el corte que lo resuelve.

## Mapa

| Corte | Entregable demostrable | Riesgo que cierra | Estado |
|---|---|---|---|
| 0 | Captura sin conexión con fotos, instalada en iPhone | Durabilidad de la PWA en Safari (QA-1, ADR-0002) | Terminado |
| 1 | El técnico inicia sesión, envía el levantamiento y oficina lo ve en su bandeja | Entrega completa, sin duplicados y con archivos verificados (QA-2), idempotencia, aislamiento por organización | Terminado y desplegado en el entorno de pruebas; falta la prueba en iPhone (criterio 4) |
| 2 | Bajada: formatos como datos, visitas asignadas, estado de mis levantamientos, permiso de trabajo local, revocación con borrado | Punto de control seguro (ADR-0005), revocación sin conexión (QA-5), formatos sin publicar la app (QA-11) | Construido y desplegado en el entorno de pruebas; falta la prueba en iPhone (criterio 9) |
| 3 | Revisión: tomar, corregir con trazabilidad por campo, comentar al técnico, marcar revisado | Concurrencia en oficina (QA-25), trazabilidad (QA-8) | Terminado y desplegado en el entorno de pruebas; lo que toca de campo espera la prueba en iPhone |
| 4 | Informe: composición mínima, publicación inmutable y PDF | Versiones inmutables (QA-9), PDF reproducible en segundo plano (QA-17) | Terminado y desplegado en el entorno de pruebas, con supuestos de P22, P23 y P26 |
| 5 | Portal: acceso con QR y clave, descarga del informe vigente | Cero accesos cruzados entre clientes (QA-4, QA-7) | Pendiente |

Con el corte 5 queda el **recorrido delgado** completo. Después, iteraciones por riesgo: secciones repetibles, bocetos (ADR-0019), cantidades con catálogo y exportación, passkeys y segundo factor, cifrado local, gestión de visitas y clientes, administración de usuarios y dispositivos, salud de dispositivos (ADR-0017), entorno de producción y simulacro de restauración (ADR-0016).

## Próximo paso

**Empezar el corte 5 (portal del cliente): acceso con QR y clave, descarga del informe vigente.** Antes de programar: leer ADR-0009 (partes 3 y 4: rol de base de datos del portal con seguridad por fila y acceso de cliente), ADR-0016 (host propio del portal) y QA-4 y QA-7, y escribir su sección. Con el corte 5 queda completo el recorrido delgado.

Pendiente de TEINS para ajustar el informe (corte 4, construido con supuestos): P22, P23, P26 y el formato de sus planos.

La prueba en iPhone de los cortes 1 a 4 sigue aplazada por decisión de Kevin (2026-09-25); el entorno de pruebas está desplegado y la guía está en [`entorno-de-pruebas.md`](entorno-de-pruebas.md).

**Entorno local, tal como quedó:** Docker Compose con PostgreSQL y S3Mock (`docker compose up -d --wait`); `paquetes/servidor/.env` creado a partir de `.env.example` (no versionado); base migrada y sembrada con la organización de desarrollo, los formatos de prueba v1, v2 y v3, los usuarios `tecnico.prueba` y `oficina.prueba`, y un cliente de prueba con una visita para `tecnico.prueba`. Las fotos subidas antes del 2026-09-24 se perdieron en local (S3Mock no guardaba en su volumen; ver decisiones del corte 2): la base las da por verificadas, así que esos levantamientos viejos muestran fotos rotas en oficina. Sus contraseñas no están en el repositorio: se fijan con `TEINS_CONTRASENA=... pnpm --filter @teins/servidor restablecer-contrasena --usuario <usuario>`. Docker corre sobre Colima; si las pruebas del servidor dicen "Could not find a working container runtime strategy", ejecutar `colima start`.

**Pendientes que no bloquean el cierre del corte 2:**

- Completar la fila de resultados del corte 0 (modelo de iPhone, versión de iOS, persistente, fotos íntegras) y repetir esa prueba en Android.
- Medir el presupuesto de JavaScript de campo en un celular de gama media (ADR-0011).
- La rama `corte-0` tiene los cortes 0, 1 y 2 sin fusionar ni subir: al subirla corre por primera vez la integración continua de GitHub Actions.

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
| 4. Probado en un iPhone real: captura sin conexión, recuperar señal, enviar con fotos y verlo en oficina | Pendiente, junto con el criterio 9 del corte 2. El entorno de pruebas ya existe (ver corte 2) |

### Entorno de pruebas (propuesta original; lo montado está en `entorno-de-pruebas.md`)

Datos ficticios, cuentas de Kevin, región en Estados Unidos (Ley 1581). Verificado contra la lista de ADR-0016 el 2026-09-24:

| Pieza | Propuesta | Costo estimado | Por qué |
|---|---|---|---|
| Rol web, rol worker y PostgreSQL | Railway, plan Hobby, región US East (Virginia) | USD 5 a 8 al mes: el plan cuesta USD 5 e incluye USD 5 de uso; web, worker y base en reposo usan poco | Corre la misma imagen para ambos roles; PostgreSQL en la misma red privada con conexión directa (LISTEN/NOTIFY para la cola) y sin apagarse |
| Archivos | Cloudflare R2 | USD 0: 10 GB, 1 millón de escrituras y 10 millones de lecturas gratis al mes; sin cargo por salida | Compatible con S3, URL firmadas, CORS |
| Superficies | Dos servicios web con la misma imagen (uno por host), o un dominio propio con subdominios `campo.` y `oficina.` | Unos USD 1 a 2 más con dos servicios | ADR-0016 exige un host por superficie; no se confirmó en la documentación de Railway cuántos dominios admite un servicio |

**Descartados al verificar:**

- **Neon, plan gratuito:** apaga la base a los 5 minutos sin actividad y no se puede desactivar en ese plan; al apagarse termina las conexiones LISTEN de la cola, y el sondeo del worker agotaría las 100 horas de cómputo del mes.
- **Cloudflare R2 para exigir la huella en la subida:** R2 no admite `x-amz-checksum-sha256` en PutObject (solo `Content-MD5`, que el navegador no calcula). ADR-0007 lo contempla: exigir la huella en la carga es opcional "si el proveedor lo permite"; la garantía es la verificación del worker (firma interna, tamaño y huella; lo inválido se rechaza y se elimina). Con R2 hace falta una opción de configuración para no firmar esa cabecera. Si se prefiere exigirla también en la carga, la alternativa es Amazon S3 en `us-east-1`, con costo de centavos al mes a este volumen.

**Pasos al aprobar:** la guía completa está en [`entorno-de-pruebas.md`](entorno-de-pruebas.md). Hecho en código (2026-09-24): `S3_EXIGIR_HUELLA` para no firmar la huella con R2, cliente S3 sin sumas de verificación propias en las URL firmadas (el SDK agregaba un CRC32 del cuerpo vacío), y `ENTORNO_DE_PRUEBAS` para sembrar aunque el entorno corra con `NODE_ENV=production`, con sus pruebas. Falta: subir la rama, crear las cuentas (Kevin), seguir la guía y repetir el extremo a extremo contra el entorno (hay que parametrizar sus URL).

### Decisiones tomadas al construirlo

- **Almacenamiento S3 local: S3Mock (Apache-2.0).** MinIO se descartó por AGPL (regla 12). S3Mock rechaza un contenido distinto a la huella firmada, igual que un proveedor real; no admite configurar CORS (ya permite todo), por eso `S3_CONFIGURAR_CORS=false` en local.
- **TypeScript 6.** TypeScript 7 aún no publica la API de compilador que usan las reglas de arquitectura; con él, dependency-cruiser no analizaba ningún archivo. Se revisa cuando la publique.
- **Formatos de prueba v1 y v2.** v2 agrega obligatorios; los borradores del corte 0 terminan con v1 (ADR-0006, regla 3).
- **Responsable local del levantamiento.** Un teléfono compartido solo envía y sube fotos con la sesión de quien creó cada levantamiento (regla 1). Los borradores del corte 0 pasan a quien inicia sesión primero.
- **Conexión real, no solo `navigator.onLine`.** El motor registra si el servidor respondió; la interfaz dice "sin conexión" aunque el navegador diga lo contrario (red sin internet, portal cautivo).
- **Presupuesto de campo: 120 KB de JavaScript inicial comprimido,** medido en 108 KB. El código de red se carga después del primer dibujo; el service worker lo guarda para usarlo sin señal. Falta confirmarlo con una medición en un celular de gama media (ADR-0011).
- **WebKit de Playwright** bloquea las URL `blob:` sin red (Safari real no); en WebKit la prueba corta la red después de la foto. La captura completa sin red la cubren Chromium y el iPhone real.
- **Tokens neutros por superficie.** Oficina redefine tamaños con `data-superficie`, sin duplicar componentes.

---

## Corte 2 · Bajada

**Estado:** Kevin pidió empezar el 2026-09-24 sin responder las tres decisiones abiertas; se tomaron las propuestas por defecto (visitas por comando, secreto de dispositivo, un solo corte), que puede revisar. Construido y verificado en local el mismo día; falta cerrar los puntos de "Próximo paso".

**Para qué:** que el dispositivo reciba del servidor lo que necesita para trabajar (formatos como datos, visitas asignadas, estado de mis levantamientos) con un punto de control que nunca se salta un cambio (ADR-0005, patrón 3), que pueda trabajar sin conexión solo mientras su permiso local esté vigente, y que un usuario revocado pierda sus datos en el dispositivo al siguiente contacto (QA-5). Cierra también QA-11: un formato nuevo llega a campo sin publicar la app.

**Punto de partida:** hoy no existen visitas, clientes, sitios ni dispositivos en ningún paquete; el levantamiento no tiene visita y `campo` trae los formatos v1 y v2 incluidos en el código.

### Alcance

**Protocolo (contrato primero; ADR-0003, ADR-0014, ADR-0015)**

- `GET /api/sync/cambios?desde=<punto>`: cambios del alcance del usuario, marcas de borrado, salidas del alcance, nuevo punto de control, `hayMas` para paginar, vencimiento del permiso de trabajo local y versión mínima del protocolo.
- `POST /api/sync/salud`: informe de salud del dispositivo, enviado en el mismo ciclo que la bajada. ADR-0014 fija la bajada como `GET` y ADR-0017 pide que la salud viaje con ella; un `GET` no lleva cuerpo, así que van en dos llamadas del mismo ciclo, sin tocar ninguno de los dos ADR.
- `EnviarLevantamiento` agrega `visitaId` **opcional** (expansión, ADR-0015): los borradores de los cortes 0 y 1 no tienen visita y se siguen enviando. La versión del protocolo no cambia.
- Identificación del dispositivo y consulta de su orden de borrado (ver "Revocación").

**Dominio**

- Visita: cliente, sitio, motivo, fecha programada, técnicos asignados. Su avance se deduce; solo "cancelada" es explícito (modelo de dominio, sección 5).
- Levantamiento con `visitaId`. Regla 17: reasignar una visita no invalida levantamientos ya iniciados.
- Versión de formato con `appMinima` opcional en el meta-esquema (ADR-0015, punto 4).
- Permiso de trabajo local: vigente, vencido. Vencer bloquea la captura, nunca borra (ADR-0009, parte 2).

**Servidor**

- Módulos nuevos `clientes` (clientes y sitios, datos mínimos) y `visitas`, de capas simples. Módulo `sincronizacion` con el registro de cambios: inserción serializada con `pg_advisory_xact_lock` para que el orden de la secuencia coincida con el de confirmación (ADR-0005, patrón 3). Los demás módulos registran cambios por su interfaz pública, en su misma transacción.
- Alcance por técnico: sus visitas asignadas con su cliente y sitio, versiones de formato compatibles con su app y estado de sus levantamientos. Al reasignar una visita, el técnico anterior recibe su salida del alcance.
- Entidad Dispositivo en `identidad`: usuario, última sincronización, informe de salud y orden de borrado.
- Desactivar usuario (regla 13): no autentica, se borran sus sesiones, sus dispositivos quedan marcados para borrado y sus envíos pendientes se rechazan (P36). Su autoría se conserva.
- Comandos de administración, como en el corte 1 con los usuarios: `crear-cliente`, `crear-visita`, `reasignar-visita`, `publicar-formato <archivo>`, `desactivar-usuario`. Las pantallas de oficina para esto llegan con "gestión de visitas y clientes".

**Campo**

- Dexie versión 3: formatos, visitas, estado de mis levantamientos, punto de control, permiso y dispositivo. La migración copia los formatos incluidos a la tabla nueva, para que ningún borrador pierda su formato. Se prueba sobre borradores y envíos pendientes.
- Bajada al abrir la app, al recuperar señal y después de enviar, con la misma espera exponencial del outbox.
- Inicio con "Mis visitas": cada visita muestra cliente, sitio, fecha y sus levantamientos; desde ella se inicia un levantamiento con un formato bajado.
- Estado de mis levantamientos según el servidor (hoy "recibido por oficina"; el corte 3 agrega "en revisión" y "revisado").
- Permiso vencido: aviso que bloquea crear y editar, conserva todo y pide iniciar sesión.
- Revocación: pantalla de acceso cerrado; se borran solo los datos del usuario revocado (fotos, borradores, envíos, visitas), no los de otro usuario del mismo teléfono.

### Revocación: cómo se entera el dispositivo

Revocar borra las sesiones, así que el siguiente contacto responde "no autenticado", igual que una sesión que simplemente venció. Para distinguirlos, el dispositivo se registra al iniciar sesión y recibe un **secreto de dispositivo** propio (guardado en IndexedDB, solo su huella en el servidor). Ante "no autenticado", el dispositivo consulta con ese secreto si tiene orden de borrado: si la tiene, borra; si no, pide iniciar sesión. Sin esto, un exempleado nunca volvería a iniciar sesión y la orden nunca llegaría.

### Fuera del corte 2

| Qué | Dónde se resuelve |
|---|---|
| Comentarios de oficina al técnico | Corte 3, viajan por esta misma bajada |
| Catálogo de ítems y unidades en la bajada | Iteración de cantidades con catálogo |
| Visita no programada creada en campo | Solo si TEINS responde P2 distinto al supuesto |
| Pantallas de oficina para clientes, sitios y visitas | Iteración de gestión de visitas y clientes |
| Panel de salud de dispositivos | Iteración de administración de usuarios y dispositivos; en este corte se guarda y se prueba |
| Cifrado local: el borrado por revocación elimina los registros, no destruye una clave | Iteración de cifrado local (ADR-0009, parte 5) |
| Aviso push de visitas nuevas | Después del piloto (ADR-0014) |
| Cancelar una visita | Iteración de gestión de visitas y clientes |
| Oficina ve la visita (cliente y sitio) de cada levantamiento | Corte 3 (revisión) o corte 4 (el informe es por visita) |
| Crear un levantamiento sin visita | Solo si P2 lo pide; los que ya existían sin visita se siguen enviando |
| Un teléfono que se revoca antes de registrarse (nunca bajó después de actualizar) no recibe la orden: sus datos quedan bloqueados al vencer el permiso | Riesgo residual declarado en ADR-0009; se reduce con el cifrado local |

### Preguntas a TEINS

- **P2** (quién asigna las visitas y si se programan con fecha). Supuesto mientras tanto: oficina programa y asigna; el técnico no crea visitas.
- **P5** (visitas repetidas al mismo sitio). Supuesto: el sitio es entidad; con otra respuesta se vuelve opcional sin cambiar la bajada.

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo en Chromium y WebKit: se asigna una visita por comando, el técnico la ve, captura con un formato bajado, envía y ve "recibido por oficina" | Cumplido en local (`e2e/pruebas/envio.spec.ts`) |
| 2. Un formato publicado por comando llega a campo sin publicar la app; uno con `appMinima` mayor no llega a una app vieja | Cumplido en integración (`servidor/pruebas/bajada.test.ts`) y en el motor (`campo`, app actualizada baja desde cero). Sin extremo a extremo: cada corrida dejaría un formato de más en la base de desarrollo |
| 3. Punto de control seguro: con dos transacciones que confirman fuera de orden, ningún cambio se pierde (integración con PostgreSQL real) | Cumplido (`servidor/pruebas/plataforma.test.ts`) |
| 4. Revocación: el siguiente contacto borra los datos del usuario revocado y conserva los de otro usuario del mismo teléfono; sus envíos pendientes se rechazan | Cumplido: integración del servidor, motor con teléfono compartido y extremo a extremo en Chromium y WebKit (`e2e/pruebas/bajada.spec.ts`) |
| 5. Permiso vencido: bloquea la captura, conserva los datos y se reanuda al iniciar sesión | Cumplido en extremo a extremo en Chromium, en local y contra el entorno de pruebas. WebKit de Playwright no recarga sin red, y en el iPhone exigiría 7 días sin señal: no se prueba ahí |
| 6. La migración de Dexie a la versión 3 conserva borradores, envíos pendientes y formatos | Cumplido (`campo/src/datos/repositorio.test.ts`) |
| 7. El informe de salud se guarda en el dispositivo del servidor | Cumplido (integración del servidor y motor de campo) |
| 8. Pantallas solo con componentes de `ui` y estados vacío, cargando, error y sin conexión; reglas de arquitectura en verde | Cumplido |
| 9. Entorno de pruebas desplegado y prueba en iPhone de los cortes 1 y 2 (decisión del 2026-09-24) | Entorno desplegado en Railway el 2026-09-25 y extremo a extremo en verde contra él (Chromium 3 de 3, WebKit 2 de 2 más el salto conocido). Falta la prueba en iPhone |

### Orden de construcción

1. Protocolo y dominio (contrato, visita, `appMinima`, permiso).
2. Servidor: registro de cambios con su prueba de orden de confirmación, clientes y visitas, bajada, dispositivos y salud.
3. Servidor: desactivación y orden de borrado.
4. Campo: migración a Dexie 3, bajada, formatos como datos, "Mis visitas", estado de mis levantamientos.
5. Campo: permiso vencido y revocación con borrado.
6. Extremo a extremo, cierre de documentación, entorno de pruebas e iPhone.

### Decisiones tomadas al construirlo

- **Bajada `GET` e informe de salud en `POST` aparte.** ADR-0014 fija `GET /sync/cambios` y ADR-0017 pide que la salud viaje con la bajada; van en dos llamadas del mismo ciclo. `POST /api/sync/dispositivo` también registra el dispositivo, así un teléfono que venía del corte 1 queda registrado en su primera bajada.
- **Dos módulos para la bajada.** `cambios` guarda qué cambió y para quién (como `auditoria`, lo usan los demás); `sincronizacion` arma la bajada leyendo el contenido actual de cada módulo por su interfaz. En un solo módulo habría un ciclo con `visitas`.
- **Bloqueo consultivo por organización** hasta el final de la transacción: el orden de la secuencia es el de confirmación y otra organización no espera. Por eso el cambio se registra al final de cada transacción.
- **El último cambio de cada entidad manda:** varios cambios de la misma visita bajan una sola vez con su estado actual. Una visita que ya no está asignada al técnico baja como "fuera de alcance".
- **La migración rellena el registro** con los formatos ya publicados y los levantamientos ya recibidos; sin eso, nunca bajarían.
- **Técnicos asignados como lista en la visita**, que se reemplaza al reasignar; la auditoría guarda el antes y el después. Una tabla de asignaciones obligaría a borrar filas (regla 14).
- **`appMinima` y app actualizada:** la bajada no entrega lo que la app no sabe mostrar, y el punto de control avanza igual. Por eso campo guarda con qué versión bajó y, si cambia, baja desde cero. `VERSION_APP` es un entero en `campo/src/version.ts`.
- **Visita reasignada con algo empezado** se conserva en el teléfono, marcada, para terminar y enviar (regla 17); sin nada empezado, se retira.
- **Revocación:** el secreto del dispositivo (32 bytes, el servidor guarda su huella) autentica `POST /api/sync/dispositivo/ordenes` con la política `secreto_de_dispositivo`. Campo consulta cuando el servidor rechaza la sesión; borra en una transacción solo lo del usuario revocado (un archivo que usa otra persona se conserva) y confirma el borrado, que queda en auditoría. Desactivar marca al usuario, borra sus sesiones y ordena el borrado en una sola transacción.
- **Un usuario desactivado que intenta entrar** recibe la misma respuesta que una contraseña equivocada.
- **Cadencia de la bajada:** al abrir, al recuperar señal, al volver a la app, al iniciar sesión y después de un envío recibido; si no, cada 5 minutos. Con la sesión vencida no insiste en cada ciclo.
- **Permiso local:** lo renueva cada bajada y el inicio de sesión (`Sesion.permisoLocalHasta`). La migración a Dexie 3 da 7 días a quien ya tenía sesión, para no bloquearlo si actualiza sin señal. Vencido, los borradores se ven en solo lectura.
- **Formatos con nombre:** `nombre` es opcional porque v1 y v2 no se pueden modificar; se publicó la v3 de prueba con nombre y campo toma el nombre de cualquier versión del mismo formato.
- **Orden de "Mis visitas"** (`campo/src/visitas.ts`; Kevin pidió la recomendación y que se implementara, 2026-09-24; puede ajustarse cuando TEINS responda P2): primero la visita con un borrador a medias, aunque sea de otro día; después las de hoy, las atrasadas y las futuras sin atender, cada grupo por fecha; al final las atendidas (algo enviado y nada a medias), para que el foco pase a la siguiente visita. La primera es el punto focal.
- **Solo se crean levantamientos desde una visita** (supuesto de P2). Los que no tienen visita aparecen en "Otros levantamientos en este teléfono".
- **El estado según el servidor manda** sobre el de envío del teléfono en la lista; en el corte 3 agrega "en revisión" y "revisado".
- **Salud sin contenido:** el último error viaja solo como código.
- **Entorno local, corregido:** S3Mock guardaba en `/tmp` del contenedor y no en su volumen; al recrearlo se perdían las fotos que la base daba por verificadas. `docker-compose.yml` ahora fija `COM_ADOBE_TESTING_S3MOCK_STORE_ROOT`. La foto del extremo a extremo es única por corrida: una repetida no se vuelve a subir y la prueba no ejercitaba la carga.
- **Presupuesto de campo:** 110 KB de JavaScript inicial comprimido (antes 108).
- **Entorno de pruebas en Railway, sin Cloudflare** (2026-09-25, a pedido de Kevin, todo desde la CLI): el almacenamiento de Railway exige la huella y el tamaño firmados y acepta CORS por API, así que reemplaza a R2 y conserva la garantía completa de ADR-0007. Se despliega con `railway up` desde la carpeta local, sin conectar GitHub todavía.
- **Cliente S3 sin sumas propias:** con la configuración por defecto, el SDK de AWS agregaba a la URL firmada un CRC32 del cuerpo vacío; ahora solo calcula sumas cuando la operación las exige. `S3_EXIGIR_HUELLA=false` queda para proveedores sin la huella (R2).
- **`ENTORNO_DE_PRUEBAS`:** permite sembrar con `NODE_ENV=production` en un entorno ficticio; producción real nunca la tiene.
- **La imagen incluye todo `src/cli/`:** los comandos del corte 2 no estaban en la lista fija de `compilar.mjs` y faltaban en la imagen.
- **Railway prueba la salud en `PORT`:** los servicios web fijan `PORT=3000`.
- **Extremo a extremo contra un entorno:** con `E2E_CAMPO_URL` y `E2E_OFICINA_URL`, usa esas direcciones y corre los comandos de administración con `railway ssh`.

---

## Corte 3 · Revisión

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25. Kevin pidió continuar sin revisar el alcance antes; puede ajustarlo sobre esta sección.

**Para qué:** que oficina revise un levantamiento enviado sin pisarse entre personas (QA-25, I-1) y que cada corrección quede con quién, cuándo, qué campo, valor anterior y nuevo, verificable (QA-8, ADR-0008). El técnico ve el estado y los comentarios en su teléfono.

### Alcance

**Dominio:** estados enviado → en revisión → revisado. Corrección de un campo con el mismo validador de campo y de envío (reglas 3 y 5), que devuelve el cambio (ruta, anterior, nuevo). Marcar revisado exige respuestas válidas.

**Protocolo (tareas explícitas, ADR-0014):** tomar para revisar (con reasignación explícita si otra persona la tiene), corregir campos, marcar revisado, comentar, historial del levantamiento. Cada guardado lleva la versión que la persona tenía abierta; si otra guardó antes, se rechaza con `conflicto_de_version` (ADR-0005, patrón 2). La bandeja filtra por estado y muestra quién tiene la toma.

**Servidor:** estados y responsable de la revisión en `levantamientos`; comentarios como tabla propia (solo insertar y leer); auditoría por campo en la misma transacción (toma, reasignación, corrección, marca de revisado, comentario); historial legible con verificación de la cadena. Cambios de estado y comentarios bajan al técnico; una app anterior (versión 2) recibe "enviado" para no romper su contrato (ADR-0015, N-1).

**Oficina:** bandeja con "Esperando revisión", "En revisión" y "Revisados"; el punto focal es el más antiguo con "Tomar para revisar" (DESIGN.md). Pantalla de revisión: toma, corrección por campo con motivo opcional, aviso cuando otra persona guardó antes, marcar revisado, comentarios al técnico e historial de cambios.

**Campo:** estado según el servidor ("En revisión en oficina", "Revisado por oficina") y comentarios de oficina en el levantamiento enviado. `VERSION_APP` pasa a 3.

### Fuera del corte 3

| Qué | Dónde se resuelve |
|---|---|
| Reabrir un levantamiento revisado | Corte 4: depende de si ya está en un informe publicado |
| Corregir fotos desde oficina (quitar o agregar) | Iteración posterior; hoy solo texto, medida y "no se pudo obtener" |
| Devolución formal al técnico | Fuera de alcance del modelo de dominio; el comentario no reabre el borrador |
| Rol supervisor | Cuando TEINS defina qué hace |
| Verificación periódica de las cadenas en el worker | Iteración de operación; hoy la verificación es por levantamiento, bajo demanda |

### Preguntas a TEINS

P7, P8 y P9 (formatos prioritarios, obligatorios reales y errores frecuentes). No bloquean: el corte se construye con el formato de prueba.

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina toma, corrige una medida, comenta y marca revisado; el técnico ve "Revisado por oficina" y el comentario | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/revision.spec.ts`) |
| 2. Dos personas de oficina: el segundo guardado sobre la misma versión se rechaza y se avisa, sin perder nada (QA-25), en integración y en extremo a extremo | Cumplido: guardados simultáneos en `servidor/pruebas/revision.test.ts` y reasignación con guardado en curso en el extremo a extremo |
| 3. Cada corrección queda en auditoría con ruta, valor anterior y nuevo, autor y correlación; la cadena del levantamiento verifica íntegra (QA-8) | Cumplido en integración y visible en el historial de oficina |
| 4. Solo quien tomó la revisión corrige y marca revisado; el técnico no; la reasignación queda registrada | Cumplido en integración y extremo a extremo |
| 5. Una app de campo versión 2 sigue leyendo la bajada | Cumplido en integración (recibe "enviado", sin comentarios) |
| 6. Pantallas solo con componentes de `ui`, con estados vacío, cargando, error y sin conexión; reglas de arquitectura en verde | Cumplido |
| 7. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25; la regresión de los cortes 1 y 2 también pasa contra el entorno |

### Decisiones tomadas al construirlo

- **Tareas explícitas con la versión vista en el cuerpo** (`tomar`, `correcciones`, `marcar-revisado`, `comentarios`, ADR-0014). El servidor compara la versión y actualiza con `WHERE version = ?`: el primer chequeo da un aviso claro y el `UPDATE` resuelve la carrera entre dos guardados simultáneos. El rechazo lleva `versionActual`.
- **Toma de revisión:** tomar lo propio otra vez responde el estado sin cambiar nada; quitársela a otra persona exige `reasignar` y queda como `revision_reasignada` con el responsable anterior y el nuevo. El rechazo `tomado_por_otro` dice quién la tiene.
- **Corrección:** mismas reglas del envío por campo (`validarCampo` de `dominio`); reescribir el mismo valor no es un cambio ni deja registro; las fotos no se corrigen desde oficina (`no_corregible`); un registro de auditoría por campo, todos con la correlación del guardado y el motivo opcional.
- **Marcar revisado** exige respuestas válidas contra su formato.
- **Comentarios:** cualquier persona de oficina comenta, aunque no tenga la revisión; no cambian la versión ni el estado; pueden apuntar a un campo, que se valida contra el formato. Tabla propia de solo insertar y leer, y evento `comentario_agregado` en la cadena.
- **N-1 en la bajada:** `APP_CON_REVISION = 3`. A una app de campo versión 2 se le manda "enviado" y sin comentarios, porque su contrato no conoce los estados nuevos y rechazaría la bajada entera. Probado en integración.
- **Campo sin versión nueva de Dexie:** estado y comentarios viven en `estadosServidor`, sin índices nuevos.
- **Historial legible:** oficina ve nombres, no identificadores, y la verificación de la cadena del levantamiento en cada consulta ("Historial íntegro").
- **`ui` crece:** `Pestanas` (patrón WAI-ARIA), `CampoTextoLargo` (acepta `ref`) y los tonos de marquilla "revision" y "revisado", que ya existían en los tokens.
- **Extremo a extremo remoto con reintentos:** `railway ssh` falla de vez en cuando; los comandos de administración de la prueba se repiten hasta tres veces (uno ya aplicado falla al repetirse, no duplica).
- **Una sola acción amarilla:** en la revisión es "Tomar para revisar" o "Marcar revisado"; "Guardar corrección" es secundaria. Los botones nombran el dato ("Corregir potencia nominal", "Comentar potencia nominal").

---

## Corte 4 · Informe

**Estado:** construido y desplegado en el entorno de pruebas el 2026-09-25, con supuestos (Kevin pidió avanzar sin esperar a TEINS). Confirmado por Kevin: lo que recibe el cliente es un PDF.

**Para qué:** que oficina componga el informe de una visita con sus levantamientos revisados, lo publique como una versión que nunca cambia (QA-9) y que el PDF se genere en segundo plano y quede guardado tal como se entregó (QA-17, ADR-0013).

### Supuestos mientras TEINS responde

| Pregunta | Supuesto | Si la respuesta es distinta |
|---|---|---|
| P26: ¿informe por visita o varias? | Uno por visita, con sus levantamientos revisados (regla 9) | La regla pasa a "mismo cliente"; el modelo no cambia |
| P23: secciones, logo, firmas, datos legales | Portada (organización, cliente, sitio, visita, versión), introducción, un capítulo por levantamiento con sus datos y fotos, conclusiones y planos anexos. Logo, firma y datos legales como marcadores `[LOGO]`, `[FIRMA]`, `[DATOS LEGALES]` | Cambia la plantilla HTML, no el modelo |
| P22: informes de ejemplo | Plantilla propia con la dirección de `DESIGN.md` | Se ajusta la plantilla |
| Formato de los planos | PDF, anexado como páginas del mismo documento (ADR-0013) | Imágenes: se incrustan como una página cada una; DWG: TEINS exporta a PDF |

### Alcance

**Dominio:** informe (visita, levantamientos incluidos en orden, introducción, conclusiones, planos en orden, versión optimista); solo incluye levantamientos revisados de la misma visita (regla 9); publicar crea la versión n+1 con una copia congelada (regla 10).

**Protocolo:** listar informes, abrir el informe de una visita (lo crea si no existe), guardar el borrador, publicar y descargar el PDF de una versión. Los planos suben como PDF por el mismo camino que las fotos (ADR-0007), solo desde oficina.

**Servidor:** módulo `informes`. La versión publicada guarda la copia congelada; la aplicación no puede modificarla (solo puede escribir las columnas del PDF). Publicar encola `informes.generarPdf` en la misma transacción (ADR-0012), en la cola `pdf` de a uno. El trabajo arma el HTML desde la copia congelada (fotos incrustadas, fuente incrustada), lo imprime con Chromium, anexa los planos con pdf-lib, guarda el PDF por su huella y lo registra en la versión. Nunca se regenera un PDF listo. Publicación en la cadena de auditoría del informe.

**Oficina:** lista de informes; desde un levantamiento revisado con visita, "Abrir el informe de esta visita"; composición (textos, levantamientos incluidos y su orden, planos); publicar con confirmación; versiones con su estado ("Generando PDF", "Descargar PDF", "No se pudo generar").

**Imagen:** Chromium dentro de la imagen de despliegue, con su versión fijada por la de Alpine.

### Fuera del corte 4

| Qué | Dónde se resuelve |
|---|---|
| El cliente descarga el PDF | Corte 5 (portal) |
| Retirar una versión publicada | Cuando exista el rol administrador |
| Marca por organización en la plantilla (ADR-0020) | Iteración de administración; hoy usa los valores de TEINS |
| Miniaturas en resolución de impresión | Cuando el tamaño del PDF lo pida; hoy van las fotos recodificadas |
| Tablas de cantidades y bocetos en el PDF | Con sus iteraciones |
| Planos como imagen | Si TEINS no los tiene en PDF |

### Terminado cuando

| Criterio | Estado |
|---|---|
| 1. Extremo a extremo: oficina compone el informe de una visita con un levantamiento revisado y un plano, lo publica y descarga el PDF | Cumplido en Chromium y WebKit, en local y contra el entorno (`e2e/pruebas/informe.spec.ts`) |
| 2. Publicar otra versión deja la anterior intacta y descargable (QA-9); la base no deja modificar una versión publicada | Cumplido en integración (permiso por columna) y en el extremo a extremo |
| 3. El PDF se genera en segundo plano, tiene los datos, las fotos y las páginas del plano, y no se vuelve a generar (QA-17) | Cumplido en integración con Chromium real (título, páginas del plano, huella estable) y en el worker de Railway |
| 4. Solo entran levantamientos revisados de la misma visita (regla 9) | Cumplido en dominio e integración |
| 5. Pantallas solo con componentes de `ui` y sus estados; reglas de arquitectura en verde | Cumplido |
| 6. Desplegado en el entorno de pruebas con el extremo a extremo en verde contra él | Cumplido el 2026-09-25, con la regresión de envío y revisión |

### Decisiones tomadas al construirlo

- **Falla del corte 2 encontrada aquí y corregida:** campo nunca mandaba `visitaId` en el envío, así que ningún levantamiento llegaba con su visita. Las pruebas del servidor armaban el comando a mano y las de campo no miraban su contenido. Ahora hay una prueba del comando en campo y el extremo a extremo del envío comprueba que oficina ve la visita. Los levantamientos ya recibidos sin visita siguen así: no se puede saber a qué visita pertenecían.
- **Uno por visita, abierto desde oficina:** "Abrir el informe de esta visita" crea el borrador si no existe (restricción única por organización y visita) y devuelve el mismo si ya existe.
- **Publicar reserva la versión del borrador:** el mismo `UPDATE … WHERE version = ?` del corte 3 evita que dos personas publiquen dos veces desde el mismo borrador. Lo que se publica es lo guardado; la pantalla guarda antes si hay cambios.
- **Copia congelada completa:** la versión guarda la definición del formato, las respuestas, los nombres de quien capturó y revisó, la visita, los textos y los planos. El PDF se arma solo desde ella.
- **Inmutabilidad en la base:** `informes.versiones` solo admite `INSERT` y `UPDATE` de las columnas del PDF (permiso por columna). Probado: modificar el contenido da "permission denied".
- **PDF en la cola `pdf`, de a uno, con 5 intentos:** al agotarlos queda "No se pudo generar el PDF" a la vista; un PDF listo nunca se vuelve a generar. La cola ahora le dice al manejador si es su último intento.
- **Plantilla:** HTML sin JavaScript ni red (Chromium con JavaScript apagado, sin conexión y con toda solicitud bloqueada), fuente Atkinson Hyperlegible Next y fotos incrustadas, tamaño carta, fechas en hora de Colombia fija. Marcadores `[LOGO]`, `[FIRMA]`, `[DATOS LEGALES]` y `[FOTO]` para lo que falta. Valores de marca de TEINS fijos hasta la configuración por organización (ADR-0020).
- **Planos:** solo PDF y solo desde oficina (campo solo sube JPEG), por el mismo camino de las fotos; el worker verifica que sea PDF. Se anexan con pdf-lib; la numeración "Página X de Y" del pie cuenta las páginas del informe, no las de los planos.
- **PDF guardado por su huella** junto a las fotos (`organizacion/sha256`), sin fila en `archivos.archivos`: la versión registra la huella.
- **Chromium en la imagen:** `apk add chromium` en Alpine, `CHROMIUM_RUTA=/usr/bin/chromium`. Probado dentro del contenedor (Chromium 152). La imagen pasa a 1,6 GB. En desarrollo y pruebas se usa el Chromium de Playwright 1.62.1, la misma versión del extremo a extremo.
- **`ui` crece:** `Casilla` y `SelectorDeArchivo`.
