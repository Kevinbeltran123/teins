# Entorno de pruebas en Railway

Entorno montado el 2026-09-25 desde la CLI de Railway (ADR-0016). Solo datos ficticios (R5), cuenta de Kevin, todo en US East (Virginia).

| Pieza | Nombre en Railway | Dirección o detalle |
|---|---|---|
| Superficie de campo (rol web, migra antes de cada versión) | `campo` | https://campo-production-2642.up.railway.app |
| Superficie de oficina (rol web) | `oficina` | https://oficina-production-d24f.up.railway.app |
| Portal del cliente (rol web, con la conexión `teins_portal`) | `portal` | https://portal-production-d5d9.up.railway.app |
| Rol worker | `worker` | Sin dominio |
| PostgreSQL 18 | `Postgres` | Red privada, sin acceso público |
| Almacenamiento compatible con S3 | bucket `teins-pruebas` | Privado, región `iad` |
| Respaldo diario (07:00 UTC) | `respaldos` | Volcado y archivos a `teins-respaldos` / `respaldos-pruebas` (ver `produccion.md`) |
| Recuperación a un punto en el tiempo | bucket `Postgres-PITR` | Activa desde el 2026-09-25 |

La configuración vive en `.railway/railway.ts` (iteración 8): cambiarla es editar ese archivo y aplicarlo (`railway config plan` / `apply`), no tocar el panel de Railway.

Proyecto `teins-pruebas`, entorno `production`, plan Hobby. Alerta de gasto: USD 10 al mes (límite suave del espacio de trabajo).

**Por qué el almacenamiento de Railway y no Cloudflare R2** (la propuesta del corte 1): se verificó que exige la huella SHA-256 y el tamaño firmados (rechaza con 400 y 403 un contenido distinto), acepta `PutBucketCors` y no cobra transferencia de salida. Cumple ADR-0007 completo, sin una segunda cuenta. R2 no admite la huella en la carga; para él quedó la opción `S3_EXIGIR_HUELLA=false`.

**Por qué dos servicios web:** cada superficie necesita su host (ADR-0016) y en el plan Hobby un servicio tiene un solo dominio de Railway. Con un dominio propio, un solo servicio web con `campo.<dominio>` y `oficina.<dominio>` ahorraría uno.

## Cómo quedó configurado

Variables, iguales en los tres servicios (las credenciales son referencias, nunca copias):

| Variable | Valor |
|---|---|
| `NODE_ENV` · `ENTORNO_DE_PRUEBAS` · `NIVEL_REGISTRO` | `production` · `true` · `info` |
| `PROXIES_DE_CONFIANZA` | `2`: la conexión llega de un proxy interno y `X-Forwarded-For` trae el cliente y un salto interno |
| `DATABASE_URL` | `postgresql://teins_app:${{Postgres.TEINS_APP_CONTRASENA}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `DATABASE_URL_PROPIETARIO` (solo `campo` y `worker`) | `${{Postgres.DATABASE_URL}}` |
| `S3_ENDPOINT` · `S3_BUCKET` · `S3_ACCESS_KEY_ID` · `S3_SECRET_ACCESS_KEY` | `${{teins-pruebas.ENDPOINT}}` y sus pares |
| `S3_REGION` · `S3_FORZAR_RUTA` · `S3_CONFIGURAR_CORS` · `S3_EXIGIR_HUELLA` | `auto` · `false` · `true` · `true` |
| `ORIGENES_CONFIABLES` · `SUPERFICIE_CAMPO_HOST` · `SUPERFICIE_OFICINA_HOST` | Los dos dominios |
| `AUTH_SECRETO` | Generado con `openssl rand -base64 32`; no se guardó en ningún otro lado |
| `PORT` (solo servicios web) | `3000`: Railway prueba la salud en ese puerto |
| `DATABASE_URL_PORTAL` · `SUPERFICIE_PORTAL_HOST` (solo `portal`) | `postgresql://teins_portal:${{Postgres.TEINS_PORTAL_CONTRASENA}}@…` y su dominio |
| `PORTAL_URL` | Dominio del portal: la URL que lleva el QR de cada acceso |
| `AVISOS_VAPID_PUBLICA` · `AVISOS_VAPID_PRIVADA` (solo `worker`) | Par VAPID de los avisos push (ADR-0023), generado con `generar-claves-avisos` sin mostrarlo; `campo` y `oficina` leen la pública por referencia (`${{worker.AVISOS_VAPID_PUBLICA}}`) |
| `AVISOS_CONTACTO` (solo `worker`) | La dirección de oficina: va en cada envío para que el servicio de avisos pueda escribir |
| `ENVIOS_SIMULADOS` · `RESEND_CLAVE_API` · `CORREO_REMITENTE` (solo `worker`) | `whatsapp`: el correo sale de verdad por Resend (clave de solo envío limitada a `deportur.tech`, remitente `TEINS pruebas <teins-pruebas@deportur.tech>`) y WhatsApp sigue simulado hasta tener el número de prueba de Meta (ADR-0028). Con Meta: `WHATSAPP_TOKEN` y `WHATSAPP_NUMERO_ID` en el worker, y `ENVIOS_SIMULADOS` en `false` |
| `RESEND_SECRETO_EVENTOS` (solo `oficina`) | Secreto de la dirección de eventos registrada en Resend (`/api/envios/eventos/correo`). Con Meta, también `WHATSAPP_SECRETO_APP` y `WHATSAPP_TOKEN_VERIFICACION`, y la dirección `/api/envios/eventos/whatsapp` registrada en Meta |

- **`TEINS_APP_CONTRASENA`** y **`TEINS_PORTAL_CONTRASENA`** viven en el servicio `Postgres`. El rol `teins_app` se creó con `infra/roles.sql` a través de `railway connect Postgres --tunnel-only` (túnel por SSH).
- **`campo`:** pre-deploy `node dist/cli/migrar.js` (una sola migración por versión) y salud en `/salud`.
- **`oficina`:** salud en `/salud`.
- **`worker`:** arranque con `node --enable-source-maps dist/worker.js`.
- **Los tres:** reinicio si fallan (hasta 5 veces) y sin suspensión.

Credenciales de `tecnico.prueba` y `oficina.prueba`: en `privado/entorno-de-pruebas.txt` en el computador de Kevin (la carpeta la ignora git y no se sube). `oficina.prueba` tiene la marca de administrador: la primera vez que abre "Administración" activa su segundo factor con una app autenticadora, y desde entonces el ingreso a oficina le pide el código.

## Operación

Desde la raíz del repositorio, con la CLI enlazada (`railway link` → `teins-pruebas`) y la llave SSH registrada (`railway ssh keys`):

```sh
# Desplegar la versión local (sube la carpeta respetando .gitignore; campo migra antes de arrancar)
railway up --service campo --detach
railway up --service oficina --detach
railway up --service portal --detach
railway up --service worker --detach

# Comandos de administración dentro del entorno
railway ssh -s campo -- node dist/cli/crear-visita.js --organizacion 00000000-0000-4000-8000-000000000001 ...
railway ssh -s campo -- node dist/cli/desactivar-usuario.js --usuario ana.prueba
railway ssh -s campo -- node dist/cli/restablecer-contrasena.js --usuario tecnico.prueba
railway ssh -s campo -- node dist/cli/crear-acceso-cliente.js --organizacion 00000000-0000-4000-8000-000000000001 --cliente <uuid>
railway ssh -s campo -- node dist/cli/marcar-administrador.js --usuario oficina.prueba
# Biblioteca de símbolos de prueba (iteración 19, ADR-0027); con la de TEINS, su archivo
railway ssh -s campo -- node dist/cli/publicar-simbolos.js --organizacion 00000000-0000-4000-8000-000000000001 --archivo node_modules/@teins/dominio/formatos-de-prueba/simbolos-prueba.json

# Registros
railway logs --service campo --deployment
```

Extremo a extremo contra el entorno (crea usuarios y clientes ficticios en cada corrida):

```sh
cd e2e
E2E_CAMPO_URL=https://campo-production-2642.up.railway.app \
E2E_OFICINA_URL=https://oficina-production-d24f.up.railway.app \
E2E_PORTAL_URL=https://portal-production-d5d9.up.railway.app \
npx playwright test --project chromium
```

El entorno conserva el límite de 5 inicios de sesión por minuto (QA-7): corra un navegador a la vez, con un minuto entre corridas.

Si más adelante se conecta el repositorio de GitHub (`railway service source connect --repo Kevinbeltran123/teins --branch <rama> --service <servicio>`), cada subida a esa rama despliega sola.

## Prueba en iPhone y verificación manual

El paso a paso completo, de la instalación en iPhone al portal y producción, está en [`verificacion-manual.md`](verificacion-manual.md). Las contraseñas de `tecnico.prueba`, `oficina.prueba` y `tecnico.revocable` están en `privado/entorno-de-pruebas.txt` (computador de Kevin).

El permiso vencido no se prueba en el iPhone: exige 7 días sin señal (`DIAS_PERMISO_LOCAL`, mínimo 1 día). Lo cubre el extremo a extremo en Chromium.
