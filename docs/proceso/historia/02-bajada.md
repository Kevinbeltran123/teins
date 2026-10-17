[Plan de entrega](../plan-de-entrega.md) · Anterior: [Corte 1 · Envío a oficina](01-envio-a-oficina.md) · Siguiente: [Corte 3 · Revisión](03-revision.md)

# Corte 2 · Bajada

**Estado en el mapa al 2026-10-16:** Terminado y desplegado en el entorno de pruebas; probado en iPhone el 2026-09-25

**Estado:** Kevin pidió empezar el 2026-09-24 sin responder las tres decisiones abiertas; se tomaron las propuestas por defecto (visitas por comando, secreto de dispositivo, un solo corte), que puede revisar. Construido y verificado en local el mismo día; falta cerrar los puntos de "Próximo paso".

**Para qué:** que el dispositivo reciba del servidor lo que necesita para trabajar (formatos como datos, visitas asignadas, estado de mis levantamientos) con un punto de control que nunca se salta un cambio (ADR-0005, patrón 3), que pueda trabajar sin conexión solo mientras su permiso local esté vigente, y que un usuario revocado pierda sus datos en el dispositivo al siguiente contacto (QA-5). Cierra también QA-11: un formato nuevo llega a campo sin publicar la app.

**Punto de partida:** hoy no existen visitas, clientes, sitios ni dispositivos en ningún paquete; el levantamiento no tiene visita y `campo` trae los formatos v1 y v2 incluidos en el código.

## Alcance

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

## Revocación: cómo se entera el dispositivo

Revocar borra las sesiones, así que el siguiente contacto responde "no autenticado", igual que una sesión que simplemente venció. Para distinguirlos, el dispositivo se registra al iniciar sesión y recibe un **secreto de dispositivo** propio (guardado en IndexedDB, solo su huella en el servidor). Ante "no autenticado", el dispositivo consulta con ese secreto si tiene orden de borrado: si la tiene, borra; si no, pide iniciar sesión. Sin esto, un exempleado nunca volvería a iniciar sesión y la orden nunca llegaría.

## Fuera del corte 2

| Qué | Dónde se resuelve |
|---|---|
| Comentarios de oficina al técnico | Corte 3, viajan por esta misma bajada |
| Catálogo de ítems y unidades en la bajada | Iteración de cantidades con catálogo |
| Visita no programada creada en campo | Solo si TEINS responde P2 distinto al supuesto |
| Pantallas de oficina para clientes, sitios y visitas | Iteración de gestión de visitas y clientes |
| Panel de salud de dispositivos | Iteración de administración de usuarios y dispositivos; en este corte se guarda y se prueba |
| Cifrado local: el borrado por revocación elimina los registros, no destruye una clave | Resuelto en la iteración 12: primero se destruye la clave (ADR-0022) |
| Aviso push de visitas nuevas | Después del piloto (ADR-0014) |
| Cancelar una visita | Iteración de gestión de visitas y clientes |
| Oficina ve la visita (cliente y sitio) de cada levantamiento | Corte 3 (revisión) o corte 4 (el informe es por visita) |
| Crear un levantamiento sin visita | Solo si P2 lo pide; los que ya existían sin visita se siguen enviando |
| Un teléfono que se revoca antes de registrarse (nunca bajó después de actualizar) no recibe la orden: sus datos quedan bloqueados al vencer el permiso | Riesgo residual declarado en ADR-0009. Desde la iteración 12 están cifrados, pero la clave sigue en ese teléfono: protege contra la copia de los archivos del navegador, no contra quien lo tenga desbloqueado |

## Preguntas a TEINS

- **P2** (quién asigna las visitas y si se programan con fecha). Supuesto mientras tanto: oficina programa y asigna; el técnico no crea visitas.
- **P5** (visitas repetidas al mismo sitio). Supuesto: el sitio es entidad; con otra respuesta se vuelve opcional sin cambiar la bajada.

## Terminado cuando

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
| 9. Entorno de pruebas desplegado y prueba en iPhone de los cortes 1 y 2 (decisión del 2026-09-24) | Entorno desplegado en Railway el 2026-09-25 y extremo a extremo en verde contra él (Chromium 3 de 3, WebKit 2 de 2 más el salto conocido). Prueba en iPhone cumplida el 2026-09-25: bajada, estado según el servidor y revocación con borrado confirmado por el teléfono (verificación manual, fases 1 y 2) |

## Orden de construcción

1. Protocolo y dominio (contrato, visita, `appMinima`, permiso).
2. Servidor: registro de cambios con su prueba de orden de confirmación, clientes y visitas, bajada, dispositivos y salud.
3. Servidor: desactivación y orden de borrado.
4. Campo: migración a Dexie 3, bajada, formatos como datos, "Mis visitas", estado de mis levantamientos.
5. Campo: permiso vencido y revocación con borrado.
6. Extremo a extremo, cierre de documentación, entorno de pruebas e iPhone.

## Decisiones tomadas al construirlo

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

## Al cerrarlo

**Pendientes que no bloquean el cierre del corte 2:**

- Completar la fila de resultados del corte 0 (modelo de iPhone, versión de iOS, persistente, fotos íntegras) y repetir esa prueba en Android.
- Medir el presupuesto de JavaScript de campo en un celular de gama media (ADR-0011).
- La rama `corte-0` tiene los cortes 0, 1 y 2 sin fusionar ni subir: al subirla corre por primera vez la integración continua de GitHub Actions.

**Preguntas a TEINS antes del corte 3:** P7 y P8 (formatos y campos obligatorios reales), P9 (errores frecuentes). **Antes del corte 4:** P22, P23 y P26 (informe). **Antes del piloto:** P40 a P43.

**Entorno local, tal como quedó:** Docker Compose con PostgreSQL y S3Mock (`docker compose up -d --wait`); `paquetes/servidor/.env` creado a partir de `.env.example` (no versionado); base migrada y sembrada con la organización de desarrollo, los formatos de prueba v1, v2 y v3, los usuarios `tecnico.prueba` y `oficina.prueba`, y un cliente de prueba con una visita para `tecnico.prueba`. Las fotos subidas antes del 2026-09-24 se perdieron en local (S3Mock no guardaba en su volumen; ver decisiones del corte 2): la base las da por verificadas, así que esos levantamientos viejos muestran fotos rotas en oficina. Sus contraseñas no están en el repositorio: se fijan con `TEINS_CONTRASENA=... pnpm --filter @teins/servidor restablecer-contrasena --usuario <usuario>`. Docker corre sobre Colima; si las pruebas del servidor dicen "Could not find a working container runtime strategy", ejecutar `colima start`.
