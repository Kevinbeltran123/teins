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
    identidad/       Usuarios, sesiones (Better Auth), resolución del actor.
    formatos/        Versiones de formato inmutables y meta-esquema.
    archivos/        Subida firmada, verificación en el worker, descarga firmada.
    auditoria/       Registro semántico con cadena de hashes.
    levantamientos/  Recepción idempotente del envío (núcleo hexagonal) y bandeja de oficina.
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
| `teins_app` (`DATABASE_URL`) | Solicitudes y trabajos de negocio | Mínimos por tabla; sujeto a seguridad por fila; solo inserta y lee en auditoría y formatos |

`teins_app` lo crea la infraestructura con `infra/roles.sql` (en local lo hace Docker Compose).

## Desarrollo local

```sh
docker compose up -d --wait          # desde la raíz: PostgreSQL y S3Mock
cp paquetes/servidor/.env.example paquetes/servidor/.env   # y ponga AUTH_SECRETO
pnpm --filter @teins/servidor migrar
pnpm --filter @teins/servidor sembrar     # organización, formatos de prueba y dos usuarios (muestra sus contraseñas)
pnpm --filter @teins/servidor dev:web     # http://localhost:3000
pnpm --filter @teins/servidor dev:worker
```

Administración: `crear-usuario` y `restablecer-contrasena` (ver el encabezado de cada archivo en `src/cli/`).

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

Antes del primer despliegue en un entorno: crear el rol `teins_app` con `infra/roles.sql` y darle contraseña desde la consola del proveedor; en el almacenamiento, `S3_CONFIGURAR_CORS=true` y `node dist/cli/sembrar.js` solo en pruebas (nunca corre en producción).

Salud: `GET /salud` verifica la base de datos. El rol web detrás de un proxy confía en sus encabezados solo con `NODE_ENV=production`.
