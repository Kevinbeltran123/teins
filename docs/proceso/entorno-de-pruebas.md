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

Proyecto `teins-pruebas`, entorno `production`, plan Hobby. Alerta de gasto: USD 10 al mes (límite suave del espacio de trabajo).

**Por qué el almacenamiento de Railway y no Cloudflare R2** (la propuesta del corte 1): se verificó que exige la huella SHA-256 y el tamaño firmados (rechaza con 400 y 403 un contenido distinto), acepta `PutBucketCors` y no cobra transferencia de salida. Cumple ADR-0007 completo, sin una segunda cuenta. R2 no admite la huella en la carga; para él quedó la opción `S3_EXIGIR_HUELLA=false`.

**Por qué dos servicios web:** cada superficie necesita su host (ADR-0016) y en el plan Hobby un servicio tiene un solo dominio de Railway. Con un dominio propio, un solo servicio web con `campo.<dominio>` y `oficina.<dominio>` ahorraría uno.

## Cómo quedó configurado

Variables, iguales en los tres servicios (las credenciales son referencias, nunca copias):

| Variable | Valor |
|---|---|
| `NODE_ENV` · `ENTORNO_DE_PRUEBAS` · `NIVEL_REGISTRO` | `production` · `true` · `info` |
| `DATABASE_URL` | `postgresql://teins_app:${{Postgres.TEINS_APP_CONTRASENA}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `DATABASE_URL_PROPIETARIO` | `${{Postgres.DATABASE_URL}}` |
| `S3_ENDPOINT` · `S3_BUCKET` · `S3_ACCESS_KEY_ID` · `S3_SECRET_ACCESS_KEY` | `${{teins-pruebas.ENDPOINT}}` y sus pares |
| `S3_REGION` · `S3_FORZAR_RUTA` · `S3_CONFIGURAR_CORS` · `S3_EXIGIR_HUELLA` | `auto` · `false` · `true` · `true` |
| `ORIGENES_CONFIABLES` · `SUPERFICIE_CAMPO_HOST` · `SUPERFICIE_OFICINA_HOST` | Los dos dominios |
| `AUTH_SECRETO` | Generado con `openssl rand -base64 32`; no se guardó en ningún otro lado |
| `PORT` (solo servicios web) | `3000`: Railway prueba la salud en ese puerto |
| `DATABASE_URL_PORTAL` · `SUPERFICIE_PORTAL_HOST` (solo `portal`) | `postgresql://teins_portal:${{Postgres.TEINS_PORTAL_CONTRASENA}}@…` y su dominio |
| `PORTAL_URL` | Dominio del portal: la URL que lleva el QR de cada acceso |

- **`TEINS_APP_CONTRASENA`** y **`TEINS_PORTAL_CONTRASENA`** viven en el servicio `Postgres`. El rol `teins_app` se creó con `infra/roles.sql` a través de `railway connect Postgres --tunnel-only` (túnel por SSH).
- **`campo`:** pre-deploy `node dist/cli/migrar.js` (una sola migración por versión) y salud en `/salud`.
- **`oficina`:** salud en `/salud`.
- **`worker`:** arranque con `node --enable-source-maps dist/worker.js`.
- **Los tres:** reinicio si fallan (hasta 5 veces) y sin suspensión.

Credenciales de `tecnico.prueba` y `oficina.prueba`: en `privado/entorno-de-pruebas.txt` en el computador de Kevin (la carpeta la ignora git y no se sube).

## Operación

Desde la raíz del repositorio, con la CLI enlazada (`railway link` → `teins-pruebas`) y la llave SSH registrada (`railway ssh keys`):

```sh
# Desplegar la versión local (sube la carpeta respetando .gitignore; campo migra antes de arrancar)
railway up --service campo --detach
railway up --service oficina --detach
railway up --service worker --detach

# Comandos de administración dentro del entorno
railway ssh -s campo -- node dist/cli/crear-visita.js --organizacion 00000000-0000-4000-8000-000000000001 ...
railway ssh -s campo -- node dist/cli/desactivar-usuario.js --usuario ana.prueba
railway ssh -s campo -- node dist/cli/restablecer-contrasena.js --usuario tecnico.prueba
railway ssh -s campo -- node dist/cli/crear-acceso-cliente.js --organizacion 00000000-0000-4000-8000-000000000001 --cliente <uuid>

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

## Prueba en iPhone (criterio 4 del corte 1 y criterio 9 del corte 2)

Contraseñas en `privado/entorno-de-pruebas.txt` (computador de Kevin): `tecnico.prueba`, `oficina.prueba` y `tecnico.revocable`, un técnico desechable con su propia visita para la revocación.

1. **Instalar.** Safari → dominio de campo → Compartir → Agregar a inicio. Cerrar Safari y abrir **desde el ícono**.
2. **Iniciar sesión** con `tecnico.prueba`. Aparece "Mis visitas" con "Cliente de prueba" en el bloque azul.
3. **Diagnóstico** (al final de la pantalla): anotar si el almacenamiento es persistente.
4. **Sin señal:** modo avión. Tocar "Iniciar levantamiento", llenar potencia y descripción, tomar 3 o 4 fotos con la cámara. Volver a "Mis visitas": debe decir "Continuar levantamiento".
5. **Cerrar la app** desde el selector de apps, **reiniciar el teléfono** y abrirla sin señal: el borrador y sus fotos siguen ahí. En el diagnóstico, "Verificar fotos": todas íntegras, cero perdidas.
6. **Enviar sin señal:** "Enviar a oficina" → "Confirmar envío". Debe decir "Sin conexión: se enviará al recuperar señal".
7. **Recuperar señal:** quitar el modo avión y volver a la app. En menos de un minuto: "Recibido en oficina".
8. **Oficina,** en el computador: dominio de oficina con `oficina.prueba`; el levantamiento está en "Esperando revisión" con sus fotos.
9. **Revocación con teléfono compartido:** en el iPhone, "Cerrar sesión"; entrar con `tecnico.revocable` y esperar a que aparezca su visita "Cliente revocación" (así el teléfono ya quedó registrado); iniciar un levantamiento y escribir algo. En el computador:

   ```sh
   railway ssh -s campo -- node dist/cli/desactivar-usuario.js --usuario tecnico.revocable
   ```

   En el iPhone, salir de la app y volver a abrirla (con señal): debe aparecer "Se cerró el acceso de Técnico revocable en este teléfono y se borraron sus datos". Entrar otra vez con `tecnico.prueba`: su levantamiento enviado sigue ahí.
10. **Anotar** en el plan de entrega (fila del corte 0): modelo de iPhone, versión de iOS, persistente sí o no, fotos tomadas, íntegras.

El permiso vencido no se prueba en el iPhone: exige 7 días sin señal (`DIAS_PERMISO_LOCAL`, mínimo 1 día). Lo cubre el extremo a extremo en Chromium.
