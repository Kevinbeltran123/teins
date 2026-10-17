[Plan de entrega](../plan-de-entrega.md) · Anterior: [Iteración 7 · Gestión de visitas y clientes](07-visitas-y-clientes.md) · Siguiente: [Iteración 9 · Secciones repetibles](09-secciones-repetibles.md)

# Iteración 8 · Producción provisional, copias y simulacro

**Estado en el mapa al 2026-10-16:** Terminada; producción sin datos reales hasta transferirla a TEINS (ADR-0021)

**Estado:** terminada el 2026-09-25; producción provisional montada y respaldada, sin datos reales (ADR-0021). Kevin pidió subir la rama y montar producción con un dominio gratuito mientras TEINS no tiene dominio ni cuenta; eligió un proyecto aparte y transferible, sin datos reales hasta la transferencia (ADR-0021), y abrir un pull request en borrador para que corra la integración continua.

**Para qué:** que producción exista, se pueda recrear desde el repositorio y tenga copias probadas antes del piloto, de modo que el día que TEINS tenga cuenta solo haya que transferirla (ADR-0016, QA-10, QA-18). Procedimiento completo en [`produccion.md`](../produccion.md).

## Alcance

- Rama `corte-0` en GitHub con la integración continua en verde (pull request #1, en borrador).
- `.railway/railway.ts`: infraestructura como código de Railway, la misma para pruebas y producción, sin secretos.
- `infra/railway/montar.sh`: monta un entorno desde cero (secretos generados sin mostrarse, roles, dominios gratuitos, despliegue, copias y primera persona administradora).
- Copias en los cuatro niveles de ADR-0016: recuperación a un punto en el tiempo y copias del volumen (Railway); servicio `respaldos` con volcado diario y copia de archivos a otro proyecto y otra región; simulacro con verificación de cadenas y archivos (`infra/respaldos/simulacro.sh`, `verificar-integridad`).

## Fuera de la iteración 8

| Qué | Dónde se resuelve |
|---|---|
| Destino de los respaldos en otro proveedor (nivel 2 completo), con una llave sin permiso de borrar y retención obligatoria del bucket | Cuando Kevin o TEINS abran una cuenta compatible con S3; cambian variables y la retención pasa a ser regla del bucket (`produccion.md`, "Pendiente para cumplir del todo el nivel 2") |
| Dominio propio | Cuando TEINS lo tenga; se agrega junto al de Railway |
| Datos reales | Después de transferir a TEINS o con su autorización escrita (ADR-0021) |
| Despliegue automático desde GitHub | Al fusionar a `master` (ADR-0016: pruebas automático, producción con aprobación) |

## Terminado cuando

| Criterio | Estado |
|---|---|
| 1. La rama está en GitHub y la integración continua pasa completa | Cumplido el 2026-09-25: pull request #1, los cinco trabajos en verde (tipos y reglas, secretos, servidor con PostgreSQL y S3, imagen, extremo a extremo) |
| 2. `railway config plan` no muestra diferencias después de aplicar | Cumplido el 2026-09-25 en pruebas y en producción ("already up to date") |
| 3. Producción montada con `montar.sh`, con dominios gratuitos, y verificada | Cumplido el 2026-09-25: las tres superficies responden, la primera persona administradora entra y administrar le exige el segundo factor. Se verificó con una prueba de humo, no con el extremo a extremo: este crea usuarios, clientes y visitas ficticios, y producción debe quedar limpia |
| 4. El servicio `respaldos` corre en pruebas y en producción y deja el volcado y los archivos en `teins-respaldos` | Cumplido el 2026-09-25 en los dos entornos (volcado con su SHA-256 y archivos copiados) |
| 5. Simulacro correcto contra la copia real de cada entorno, anotado en `produccion.md` | Cumplido el 2026-09-25: pruebas (75 cadenas y 23 archivos) y producción (2 cadenas); en local detectó 4 fotos que ya faltaban en el origen |

## Decisiones tomadas al construirlo

- **Infraestructura como código de Railway** (`.railway/railway.ts`, paquete `railway`, MIT) y no `railway.json`: el formato anterior deja de leerse el 2026-12-01. Las conexiones se arman con referencias (`${{Postgres.PGHOST}}`, `${{teins-pruebas.ENDPOINT}}`, `${{portal.RAILWAY_PUBLIC_DOMAIN}}`); los secretos quedan como `preserve()`. El plan contra pruebas mostró que el archivo reproduce el proyecto: solo cambian los dominios escritos a mano por referencias equivalentes y salen cuatro variables de host que cada servicio no usaba.
- **Un solo archivo para los dos proyectos:** `ctx.projectName` elige el almacenamiento y quita `ENTORNO_DE_PRUEBAS` en producción, así que `sembrar` nunca corre allí.
- **Secretos por la entrada estándar:** `montar.sh` los genera con `openssl` y los fija con `railway variable set --stdin`; las contraseñas de los roles se aplican dentro del contenedor de Postgres. Nada queda en la terminal ni en el repositorio.
- **Respaldo con `pg_dump` y `rclone`** (MIT) en una imagen propia sobre `postgres:18-alpine`: el volcado se lee con `pg_restore --list` antes de subirlo y viaja con su SHA-256; los archivos se copian con `--immutable` (nunca se reemplaza ni se borra nada en el destino). Retención de volcados: 35 días. Desde el 2026-09-29 también con `--checksum`: compara tamaño y huella, no la fecha. El respaldo de pruebas de ese día falló porque, tras vaciar el almacenamiento, cinco archivos ya copiados se subieron otra vez con el mismo contenido y otra fecha, y `--immutable` sin `--checksum` lo toma como una modificación. Otro contenido bajo la misma llave sigue siendo un error.
- **Destino en otro proyecto y otra región** (`teins-respaldos`, US West) mientras no haya cuenta de otro proveedor: sobrevive a que se borre producción, no a perder la cuenta (lo dice ADR-0021).
- **Simulacro verificable:** restaura en un PostgreSQL desechable con los roles de `infra/roles.sql`, verifica todas las cadenas de la auditoría con el código del servidor y compara los archivos referenciados con los copiados. Corre en el computador de quien lo lanza con `railway run`, que le pasa las credenciales sin mostrarlas. Usa una carpeta temporal bajo `~/.cache`, porque Colima y Docker Desktop no siempre comparten `/tmp` con los contenedores.
- **Contraseñas de los roles:** la primera corrida de `montar.sh` en pruebas dejó vacías las contraseñas de `teins_app` y `teins_portal`: el contenedor de Postgres no veía las variables, porque se agregaron después de que arrancó (un contenedor solo ve las que tenía al desplegarse). Las conexiones abiertas siguieron funcionando y el único despliegue que falló (campo) no reemplazó al anterior; se corrigió desde el contenedor del portal, tomando cada contraseña de su conexión ya resuelta. Desde entonces `montar.sh` redespliega Postgres si no ve las contraseñas y nunca aplica una vacía.
- **Región de la base:** el `apply` inicial creó el Postgres de producción en `us-west2` (la región por defecto del espacio de trabajo), lejos de los servicios en `us-east4`. El plan lo detectó y se movió con la base casi vacía y respaldada; los datos se verificaron después (ingreso y cadenas íntegras). `respaldos` sigue en `us-west2`: Railway no aplica la región declarada a un servicio programado; el volcado cruza de región una vez al día.
- **Archivo de la recuperación a un punto en el tiempo:** Railway elige su región al activarla (`iad` en pruebas, `sjc` en producción) y no se puede cambiar; el archivo la declara por proyecto.
- **Organización de producción:** producción nunca se siembra, así que la crea el comando nuevo `crear-organizacion` (mismo identificador que en pruebas, nombre "TEINS").
- **Copias programadas del volumen:** con el plan Hobby, Railway no deja programarlas; queda la recuperación a un punto en el tiempo, y `montar.sh` lo avisa sin detenerse.
- **Correr un respaldo ya:** `infra/respaldos/ahora.sh` (la API de Railway ejecuta el servicio programado sin esperar a su hora).
- **Pruebas del PDF bajo carga:** esperar los PDF por tiempo (hasta 90 s, procesando la cola) y no por 20 vueltas: un PDF que falla una vez bajo carga vuelve a la cola segundos después (`esperarPdf` en las pruebas del servidor).
- **Integración continua:** el trabajo del servidor instala el Chromium de `playwright-core` (sin él no se generaban los PDF), y gitleaks recibió permiso para leer el pull request.

**Revisión de seguridad 4d (2026-09-29): configuración, Railway e `infra`.**

- **El rol dueño solo donde se usa:** `DATABASE_URL_PROPIETARIO` es opcional en la configuración y la exigen el worker, `migrar`, `sembrar` y `crear-organizacion` (`urlDelPropietario`). En Railway la tienen `campo` (migra y corre los comandos) y `worker`; `oficina` y `portal`, no. Un fallo en el portal ya no entrega una conexión que se salta la seguridad por fila y puede reescribir la auditoría. Que el servicio del portal atienda solo el portal, sin `teins_app` ni `AUTH_SECRETO`, sería un tercer rol de arranque: cambia ADR-0001 y queda para un ADR si se quiere.
- **Proxies contados, no "confiar en todo":** `PROXIES_DE_CONFIANZA` (en Railway, 2) reemplaza `trustProxy: true`. La IP del cliente es la que está justo antes de los proxies en `X-Forwarded-For`; lo que el cliente escriba antes se ignora aunque el borde deje de descartarlo. Fastify 5.12 no acepta el número (lo trata como "no confiar", porque no puede validar quién conecta), así que va como función; en Railway solo se llega al servicio por el borde o por la red privada. En producción la configuración exige el dato: sin él, todas las solicitudes compartirían un límite de intentos.
- **Sin `NODE_ENV`, no arranca un despliegue:** con orígenes `https` y modo de desarrollo, la configuración falla (saldrían cookies sin `Secure`, sin HSTS y con `sembrar` permitido). Se eligió esa regla y no hacer obligatorio `NODE_ENV`, que obligaba a tocar los `.env` de todos; la imagen ya fija `NODE_ENV=production`.
- **La correlación la genera el servidor:** la cabecera `x-correlacion` que manda quien pide ya no llega a la auditoría encadenada.
- **Respaldos cifrados** con `rclone crypt` y `RESPALDOS_CLAVE` en `cifrado/` del destino, con copia de la clave en `privado/<proyecto>-respaldos.txt` (sin ella no se restaura nada si se pierde el proyecto). Sin clave, el respaldo no corre, y con otra tampoco: antes de escribir, la clave tiene que abrir la huella del último volcado del destino. La primera corrida mueve la copia vieja sin cifrar a la cifrada. `clave.sh` nunca genera una clave nueva si ya hay copia en `privado/` (montar de nuevo un proyecto perdido habría dejado ilegibles los respaldos; lo encontró una revisión independiente de las correcciones). Se verificó en local de punta a punta (cero apariciones del contenido en claro, simulacro correcto con la clave y fallido con otra, otra clave detenida sin escribir) y en el entorno de pruebas el 2026-09-29: la raíz del destino quedó solo con `cifrado/`, los 7 volcados cifrados y el simulacro correcto (177 cadenas, 27 archivos). Los almacenamientos de Railway no ofrecen versiones, bloqueo ni credenciales limitadas: que quien tome producción no pueda borrar las copias queda para el destino en otro proveedor.
- **`montar.sh`:** si la CLI falla al leer un secreto, se detiene (antes lo tomaba por inexistente y lo reemplazaba: habría cerrado todas las sesiones y dejado ilegibles los segundos factores); la contraseña de la primera persona administradora y las de los roles viajan por la entrada estándar, y las de los roles no quedan en el registro de PostgreSQL (verificado con `log_statement = 'all'`). Al final corre `verificar-exposicion.sh`: la base, el worker y los respaldos no se alcanzan desde internet (verificado en pruebas).
- **`dejar-limpio.sql` no borra nada fuera del entorno de pruebas:** exige `oficina.prueba` y `tecnico.prueba`, que solo crea `sembrar`. Verificado en una base desechable con forma de producción (no borra) y con la de pruebas (limpia).

## Al cerrarla

**Iteración 8 terminada el 2026-09-25:** producción provisional montada en `teins-produccion` con dominios gratuitos, recreable desde el repositorio, con respaldo diario y simulacro verificado; sin datos reales hasta transferirla a TEINS (ADR-0021, [`produccion.md`](../produccion.md)). La rama está en GitHub (pull request #1, en borrador) con la integración continua en verde.
