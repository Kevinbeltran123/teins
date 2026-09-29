# Producción: montaje, copias y simulacro

Cómo se monta, se respalda y se recupera un entorno de TEINS en Railway (ADR-0016, ADR-0021). Vale igual para `teins-pruebas` y `teins-produccion`: los dos salen del mismo archivo.

**Mientras producción viva en la cuenta de Kevin, no se cargan datos reales** (ADR-0021): solo la primera persona administradora y datos de verificación, hasta transferir el proyecto al espacio de trabajo de TEINS o tener su autorización escrita.

## Qué es cada pieza

| Pieza | Dónde | Qué hace |
|---|---|---|
| `.railway/railway.ts` | Repositorio | Servicios, base, almacenamiento y variables del entorno, sin secretos. Se revisa con `railway config plan` y se aplica con `railway config apply` sobre el proyecto enlazado |
| `infra/railway/montar.sh` | Repositorio | Lo que el archivo no declara: secretos (generados, nunca mostrados), roles de la base, dominios, despliegue, copias y la primera persona administradora |
| `infra/railway/verificar-exposicion.sh` | Repositorio | Comprueba que solo `campo`, `oficina` y `portal` se alcanzan desde internet (sin proxy TCP en la base ni dominio en el worker o los respaldos). Lo corre `montar.sh`; se corre solo después de tocar la red en el panel |
| `infra/respaldos/` | Servicio `respaldos` de cada entorno | Una vez al día (07:00 UTC, 02:00 en Colombia): volcado de la base y copia de los archivos al proyecto `teins-respaldos`, cifrados con `RESPALDOS_CLAVE` |
| `infra/respaldos/clave.sh` | Repositorio | Genera `RESPALDOS_CLAVE` si el entorno no la tiene, con su copia en `privado/<proyecto>-respaldos.txt`. Lo corre `montar.sh`; en un entorno que ya existe se corre solo y después se despliega `respaldos` |
| `infra/respaldos/simulacro.sh` | Computador de quien lo corre | Restaura el último volcado en un PostgreSQL desechable y verifica cadenas y archivos |
| `pnpm --filter @teins/servidor verificar-integridad` | Servidor | Verifica todas las cadenas de la auditoría de una base |

Direcciones de producción (dominios gratuitos de Railway, con HTTPS):

| Superficie | Dirección |
|---|---|
| Campo | https://campo-production-21f0.up.railway.app |
| Oficina | https://oficina-production-9584.up.railway.app |
| Portal | https://portal-production-2d8f.up.railway.app |

Primera persona administradora: usuario `administracion`, contraseña en `privado/teins-produccion.txt` (computador de Kevin; git lo ignora). Al abrir "Administración" pide activar el segundo factor.

Producción no tiene formatos publicados todavía: se publican los de TEINS con `publicar-formato` cuando respondan P7 y P8. Los de prueba (`prueba-ups`) no se publican allí.

Proyectos en Railway:

| Proyecto | Para qué | Región |
|---|---|---|
| `teins-pruebas` | Pruebas y demostraciones, datos ficticios | US East |
| `teins-produccion` | Producción (provisional, ADR-0021) | US East |
| `teins-respaldos` | Destino de las copias diarias: `respaldos-pruebas` y `respaldos-produccion` | US West: otra región |

## Montar un entorno desde cero

Desde la raíz del repositorio, con la CLI de Railway iniciada (`railway login`), Docker y `pnpm install`:

```sh
infra/railway/montar.sh teins-produccion
```

Hace, en orden y sin repetir lo que ya existe:

1. Crea el proyecto `teins-respaldos` y su almacenamiento para este entorno, en otra región.
2. Crea el proyecto y aplica `.railway/railway.ts`: Postgres, almacenamiento, `campo`, `oficina`, `portal`, `worker` y `respaldos`.
3. Genera los secretos: `AUTH_SECRETO` (el mismo en los cuatro servicios), las contraseñas de `teins_app` y `teins_portal` (en el servicio Postgres), las credenciales del destino de los respaldos y la clave que los cifra, `RESPALDOS_CLAVE`, con una copia en `privado/<proyecto>-respaldos.txt`. Si la CLI de Railway falla al leer un secreto, el script se detiene: nunca reemplaza uno que ya está en uso.
4. Crea los roles de la base con `infra/roles.sql` y les pone sus contraseñas, dentro del contenedor de Postgres. Las contraseñas le llegan a `psql` por su entrada y no quedan en su registro.
5. Genera un dominio gratuito de Railway por superficie (`*.up.railway.app`).
6. Despliega: `campo` primero (migra la base antes de arrancar), después `oficina`, `portal`, `worker` y `respaldos`.
7. Activa la recuperación a un punto en el tiempo y las copias diarias, semanales y mensuales del volumen de Postgres.
8. Crea la primera persona administradora (`administracion`); su contraseña queda en `privado/<proyecto>.txt`. Al entrar a "Administración" en oficina, activa su segundo factor.
9. Verifica la exposición a internet (`verificar-exposicion.sh`): termina con error si la base, el worker o los respaldos se alcanzan desde afuera.

La conexión del rol dueño de la base (`DATABASE_URL_PROPIETARIO`, que migra y puede saltarse la seguridad por fila) solo la tienen `campo` (migra y corre los comandos) y `worker`; `oficina` y `portal` atienden solicitudes sin ella.

## Cambiar la infraestructura

```sh
railway link --project teins-produccion
railway config plan          # siempre primero: muestra qué cambia; los secretos salen como «hidden»
railway config apply         # pide confirmación; lo destructivo va marcado
infra/railway/verificar-exposicion.sh
```

El mismo archivo sirve a los dos proyectos: `ctx.projectName` decide el nombre del almacenamiento y quita `ENTORNO_DE_PRUEBAS` en producción. Un recurso que se borra del archivo se borra de Railway al aplicar: revise el plan.

## Copias (ADR-0016)

| Nivel | Qué | Retención | Protege contra |
|---|---|---|---|
| 1 | Recuperación a un punto en el tiempo (WAL continuo) y, con el plan de TEINS, copias programadas del volumen de Postgres | Unas 4 semanas; copias diaria (6 días), semanal (1 mes) y mensual (3 meses) | Errores humanos, una migración mala |
| 2 | Volcado lógico diario y copia de los archivos en `teins-respaldos`, cifrados | Volcados: 35 días. Archivos: siempre | Borrar el proyecto de producción |
| 3 | Archivos direccionados por contenido, nunca se sobrescriben (ADR-0007) | Siempre | Restaurar una base que referencia archivos |
| 4 | Simulacro de restauración | Mensual y antes de cada transferencia | Descubrir tarde que las copias no sirven |

Con el plan Hobby de Kevin, Railway rechaza programar las copias del volumen ("You do not have access to this resource"); la recuperación a un punto en el tiempo sí queda activa. `montar.sh` lo avisa y sigue; con el plan de TEINS se programan con `railway postgres pitr schedule set --service Postgres --daily --weekly --monthly`.

El archivo de la recuperación a un punto en el tiempo es un almacenamiento, `Postgres-PITR`, que crea Railway al activarla. Está declarado en `.railway/railway.ts` para que ningún `apply` lo borre; solo el primer `apply` de un proyecto nuevo lo omite (`TEINS_SIN_PITR=1`), porque todavía no existe.

**Cifrado del nivel 2.** Todo lo que sale a `teins-respaldos` va cifrado con `rclone crypt` en `cifrado/` (volcados y archivos; los nombres quedan legibles, son fechas y huellas). Quien lea ese almacenamiento sin `RESPALDOS_CLAVE` no ve datos de nadie. La clave vive en el servicio `respaldos` y en `privado/<proyecto>-respaldos.txt`; si se pierde el proyecto, esa copia es la única que abre los respaldos, así que se guarda también fuera del computador (un gestor de contraseñas). Sin la clave, el respaldo no corre: nunca sale nada sin cifrar. La clave no se cambia: los archivos copiados quedaron cifrados con ella.

Pendiente para cumplir del todo el nivel 2:

- **Perder la cuenta.** El destino está en otro proyecto de Railway, así que no sobrevive a perder la cuenta. Con una cuenta de otro proveedor compatible con S3 (por ejemplo Cloudflare R2 o Backblaze B2), basta cambiar en el servicio `respaldos` las variables `DESTINO_BUCKET` y `RCLONE_CONFIG_DESTINO_*`.
- **Que quien tome producción borre las copias.** El servicio `respaldos` tiene credenciales del destino que también borran, y los almacenamientos de Railway no ofrecen versiones, bloqueo de objetos ni credenciales limitadas (documentación de Railway, revisada el 2026-09-29). Al mover el destino a otro proveedor: una llave sin permiso de borrar y retención obligatoria (bloqueo del bucket en R2, Object Lock en B2), y la retención de 35 días como regla del bucket en vez del `rclone delete` de `respaldar.sh`.

### Correr un respaldo ahora

El servicio `respaldos` corre solo a las 07:00 UTC; desplegarlo no lo ejecuta. Para lanzarlo ya (antes de un simulacro o de una migración delicada), con el proyecto enlazado:

```sh
infra/respaldos/ahora.sh
railway logs --service respaldos   # "respaldo …: listo" al terminar
```

### Recuperar

- **Una migración o un error borró datos hace poco:** en el servicio Postgres, pestaña Backups, "Restore to this moment" (o `railway postgres pitr restore --service Postgres --at <fecha ISO>`). Crea un Postgres nuevo al lado; se verifica con `verificar-integridad` y se cambian las conexiones.
- **Se necesita el estado de ayer entero:** copia del volumen, desde la misma pestaña.
- **Se perdió el proyecto:** se monta uno nuevo con `montar.sh`, se restaura el último volcado de `teins-respaldos` con `pg_restore` y se copian los archivos de vuelta (`rclone copy` desde el destino cifrado), con el mismo procedimiento que el simulacro. La clave sale de `privado/<proyecto>-respaldos.txt`.

## Simulacro

```sh
railway link --project teins-produccion
railway run --service respaldos infra/respaldos/simulacro.sh
```

`railway run` le pasa al script las credenciales del destino y `RESPALDOS_CLAVE` sin mostrarlas. Si el proyecto ya no existe, se le dan a mano (`RESPALDOS_CLAVE=... DESTINO_BUCKET=... RCLONE_CONFIG_DESTINO_...=... infra/respaldos/simulacro.sh`). El script trae el último volcado, comprueba su huella, lo restaura en un PostgreSQL desechable y verifica:

1. que restaura sin errores, y cuánto tarda (el tiempo de recuperación);
2. la antigüedad del volcado (el punto de recuperación);
3. las filas por tabla;
4. todas las cadenas de la auditoría (`verificar-integridad`);
5. que cada archivo que la base referencia (fotos y planos verificados, PDF generados) está en la copia.

Si algo falla, termina con error. Cada simulacro se anota en la tabla de abajo.

| Fecha | Entorno | Volcado | Restauración | Cadenas | Archivos | Resultado |
|---|---|---|---|---|---|---|
| 2026-09-25 | Producción (Railway) | 0,0 h | 1 s | 2 íntegras, 0 rotas | 0 referenciados, 0 faltantes | Correcto; base recién montada (organización y primera persona administradora) |
| 2026-09-25 | Pruebas (Railway) | 0,0 h | 0 s | 75 íntegras (184 eslabones), 0 rotas | 23 referenciados, 0 faltantes | Correcto, contra la copia real en `teins-respaldos` |
| 2026-09-25 | Local (Docker) | 0,0 h | 0 s | 435 íntegras, 0 rotas | 144 referenciados, 4 faltantes | Correcto: los 4 faltantes son las fotos que S3Mock perdió el 2026-09-24, antes de guardar en su volumen; tampoco están en el origen. El simulacro los detectó |

## Transferir a TEINS

Cuando TEINS tenga su espacio de trabajo en Railway (plan Hobby o Pro):

1. Simulacro completo en producción, anotado arriba.
2. Transferir `teins-produccion` y `teins-respaldos` (Settings → Transfer Project).
3. En la cuenta de TEINS: alerta de gasto, personas con acceso, y cambiar las credenciales del almacenamiento y los secretos (`AUTH_SECRETO` cierra todas las sesiones). `RESPALDOS_CLAVE` no se cambia: se entrega a TEINS la copia de `privado/teins-produccion-respaldos.txt` y se borra del computador de Kevin.
4. Registrar la transferencia en ADR-0021 ("Cuándo revisarla") y en el plan de entrega. Desde ese momento se pueden cargar datos reales.
