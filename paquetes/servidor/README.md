# servidor

Monolito modular (ADR-0001): un código con dos roles de ejecución, `web` (API) y `worker` (trabajos).

**Dependencias:** `dominio` y `protocolo`. Nunca `campo`, `oficina`, `portal` ni `ui`.

**ADR relevantes:** 0001, 0003, 0005, 0007, 0008, 0009, 0010, 0012, 0014, 0016, 0017

## Estructura

```
src/
  plataforma/   Lo que usan todos los módulos: base de datos, transacción por organización,
                errores, rutas con política, cola, almacenamiento.
  modulos/
    identidad/       Usuarios, sesiones (Better Auth), resolución del actor, desactivación,
                     dispositivos (secreto, informe de salud, orden de borrado).
    formatos/        Versiones de formato inmutables y meta-esquema.
    archivos/        Subida firmada, verificación en el worker, descarga firmada.
    auditoria/       Registro semántico con cadena de hashes.
    cambios/         Registro de cambios para la bajada, serializado por organización (punto de control seguro).
    clientes/        Clientes y sitios, datos mínimos.
    visitas/         Visitas programadas y técnicos asignados.
    levantamientos/  Recepción idempotente del envío (núcleo hexagonal) y bandeja de oficina.
    sincronizacion/  Bajada: compone los cambios del técnico con las interfaces de los demás módulos.
    informes/        Informe por visita, versiones publicadas inmutables y su PDF (plantilla HTML,
                     Chromium y pdf-lib en el worker, ADR-0013).
    portal/          Accesos de cliente (scrypt, límite de intentos, sesiones cortas) y rutas del portal,
                     siempre con la conexión del rol teins_portal (ADR-0009, partes 3 y 4).
  app.ts        Composición del rol web.
  web.ts        Punto de entrada del rol web.
  worker.ts     Punto de entrada del rol worker.
  tareas.ts     Trabajos de la cola: todo trabajo declarado debe tener manejador.
migraciones/    SQL generado por drizzle-kit más migraciones propias (permisos, cola).
infra/          SQL que ejecuta la infraestructura, no las migraciones (rol de la aplicación).
pruebas/        Integración con PostgreSQL y S3Mock reales en contenedores.
```

Reglas de la estructura:

- Un módulo solo importa la interfaz pública de otro (`modulos/<nombre>/index.ts`), nunca sus tablas.
- Todo dato de negocio se lee y escribe dentro de `enOrganizacion`: la seguridad por fila de la base filtra por organización.
- Toda ruta declara su política; una ruta sin política impide arrancar.
- Todo cambio de esquema es de expansión (ADR-0015): columnas nuevas con valor por defecto o anulables.

## Roles de base de datos

| Rol | Uso | Permisos |
|---|---|---|
| Dueño (`DATABASE_URL_PROPIETARIO`) | Migraciones y cola de trabajos | Dueño de los esquemas |
| `teins_portal` (`DATABASE_URL_PORTAL`) | Rutas del portal del cliente | Solo versiones publicadas con PDF listo del cliente de la sesión, sus accesos, sesiones e intentos, y registrar en auditoría |
| `teins_app` (`DATABASE_URL`) | Solicitudes y trabajos de negocio | Mínimos por tabla; sujeto a seguridad por fila; solo inserta y lee en auditoría, formatos y el registro de cambios; no borra en ninguna tabla de negocio |

`teins_app` lo crea la infraestructura con `infra/roles.sql` (en local lo hace Docker Compose).

## Desarrollo local

```sh
docker compose up -d --wait          # desde la raíz: PostgreSQL y S3Mock
cp paquetes/servidor/.env.example paquetes/servidor/.env   # y ponga AUTH_SECRETO
pnpm --filter @teins/servidor migrar
pnpm --filter @teins/servidor sembrar     # organización, formatos de prueba, dos usuarios (muestra sus contraseñas) y un cliente con una visita
pnpm --filter @teins/servidor dev:web     # http://localhost:3000
pnpm --filter @teins/servidor dev:worker
```

Comandos de administración (uso en el encabezado de cada archivo de `src/cli/`). Todo esto también se hace en oficina: usuarios, accesos de clientes y retiro de versiones en "Administración" (iteración 6); clientes, sitios y visitas en "Clientes" y "Visitas" (iteración 7). Los comandos quedan para la primera persona administradora, la publicación de formatos y la operación por consola:

| Comando | Qué hace |
|---|---|
| `crear-usuario`, `restablecer-contrasena` | Usuarios internos y recuperación de acceso |
| `desactivar-usuario` | Revoca: cierra sus sesiones, no vuelve a entrar y sus teléfonos borran sus datos al conectarse |
| `marcar-administrador` | Marca (o con `--quitar`, desmarca) a una persona de oficina como administradora; para administrar debe activar además el segundo factor en oficina |
| `crear-cliente` | Cliente con su primer sitio |
| `crear-visita`, `reasignar-visita` | Programa una visita para uno o varios técnicos; al reasignar, sale del teléfono de quien deja de tenerla |
| `publicar-formato` | Publica una versión de formato desde un JSON; llega a los teléfonos en la siguiente bajada |
| `crear-acceso-cliente`, `regenerar-acceso-cliente` | Acceso de un cliente al portal: muestra una sola vez identificador, clave y QR (`--qr archivo.svg` lo guarda); regenerar invalida el anterior y sus sesiones |

El permiso de trabajo sin conexión dura `DIAS_PERMISO_LOCAL` días (7 por defecto) desde el último contacto.

PDF del informe: el worker usa Chromium. En la imagen es el de Alpine (`CHROMIUM_RUTA=/usr/bin/chromium`); en desarrollo, sin esa variable, el que instala Playwright (`pnpm --filter @teins/e2e exec playwright install chromium` si falta).

Nueva migración: cambie el esquema del módulo y ejecute `pnpm --filter @teins/servidor generar-migracion --name <nombre>`. Los permisos de una tabla nueva van en una migración propia (`--custom`).

## Pruebas

`pnpm --filter @teins/servidor test` levanta PostgreSQL 18 y S3Mock con Testcontainers. Requiere Docker; con Colima se detecta solo.

## Despliegue (ADR-0016)

Una imagen para todo: `docker build -t teins .` desde la raíz. Incluye el servidor compilado (`pnpm --filter @teins/servidor compilar`), sus migraciones y las superficies `campo` y `oficina`.

| Proceso | Comando | Réplicas |
|---|---|---|
| Migración, antes de cada versión | `node dist/cli/migrar.js` | Una vez, como paso de lanzamiento |
| Rol web (por defecto) | `node --enable-source-maps dist/web.js` | Una o más; sin estado |
| Rol worker | `node --enable-source-maps dist/worker.js` | Una o más |

Variables de entorno: las de `.env.example` más `NODE_ENV=production`, `SUPERFICIE_CAMPO_HOST` y `SUPERFICIE_OFICINA_HOST` (por ejemplo `campo.<dominio>` y `oficina.<dominio>`), con `ORIGENES_CONFIABLES` en `https://` para esos mismos hosts. Las contraseñas y el secreto van en el gestor de secretos de la plataforma, nunca en el repositorio.

Antes del primer despliegue en un entorno: crear el rol `teins_app` con `infra/roles.sql` y darle contraseña desde la consola del proveedor. CORS del almacenamiento: `S3_CONFIGURAR_CORS=true` si el token puede administrar el bucket; si no (R2 con token de objetos), en el panel del proveedor. Con Cloudflare R2, `S3_EXIGIR_HUELLA=false` (no admite la huella en la carga; la verifica el worker). `node dist/cli/sembrar.js` solo en pruebas, con `ENTORNO_DE_PRUEBAS=true`; nunca corre en producción. Entorno de pruebas en Railway (servicios, variables, operación): [`docs/proceso/entorno-de-pruebas.md`](../../docs/proceso/entorno-de-pruebas.md). La imagen incluye todo comando de `src/cli/` (`scripts/compilar.mjs`).

Salud: `GET /salud` verifica la base de datos. El rol web detrás de un proxy confía en sus encabezados solo con `NODE_ENV=production`.
