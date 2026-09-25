import { bucket, defineRailway, postgres, preserve, project, service } from "railway/iac";

/**
 * Infraestructura de TEINS en Railway (ADR-0016, ADR-0021). El mismo archivo describe los dos proyectos:
 * `teins-pruebas` (datos ficticios) y `teins-produccion`. Se aplica con `railway config plan` y
 * `railway config apply` sobre el proyecto enlazado (docs/proceso/produccion.md).
 *
 * Ningún secreto vive aquí: las conexiones se arman con referencias a las variables de Postgres y del
 * almacenamiento, y `AUTH_SECRETO` y las contraseñas de los roles las genera `infra/railway/montar.sh`
 * sin mostrarlas (`preserve()` las conserva).
 */
const REGION = "us-east4-eqdc4a";
const ref = (servicio: string, variable: string) => `\${{${servicio}.${variable}}}`;
const https = (servicio: string) => `https://${ref(servicio, "RAILWAY_PUBLIC_DOMAIN")}`;

export default defineRailway((ctx) => {
  const produccion = ctx.projectName === "teins-produccion";
  const nombreDelAlmacen = produccion ? "teins-produccion" : "teins-pruebas";

  const Postgres = postgres("Postgres", { region: REGION });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  // El volumen de Postgres es de la base: no se declara (declararlo en un proyecto nuevo crearía otro).
  const almacen = bucket(nombreDelAlmacen, { region: "iad" });
  // Archivo continuo de la recuperación a un punto en el tiempo (ADR-0016, nivel 1). Lo crea
  // `railway postgres pitr enable`; se declara para que ningún `apply` lo borre. Solo el primer `apply`
  // de un proyecto nuevo, antes de activarla, lo omite con TEINS_SIN_PITR=1 (montar.sh).
  const conPitr = process.env.TEINS_SIN_PITR !== "1";
  // Railway eligió su región al activarla (no se puede cambiar): iad en pruebas, sjc en producción.
  const archivoPitr = bucket("Postgres-PITR", { region: produccion ? "sjc" : "iad" });

  /** Conexión con un rol de la aplicación: su contraseña vive en el servicio Postgres (infra/roles.sql). */
  const conexion = (rol: string, contrasena: string) =>
    `postgresql://${rol}:${ref("Postgres", contrasena)}@${ref("Postgres", "PGHOST")}:${ref("Postgres", "PGPORT")}/${ref("Postgres", "PGDATABASE")}`;

  // Lo mismo en los cuatro servicios: la imagen es una sola y el rol lo decide el arranque (ADR-0001).
  const comun = {
    NODE_ENV: "production",
    NIVEL_REGISTRO: "info",
    AUTH_SECRETO: preserve(),
    DATABASE_URL: conexion("teins_app", "TEINS_APP_CONTRASENA"),
    DATABASE_URL_PROPIETARIO: ref("Postgres", "DATABASE_URL"),
    S3_ENDPOINT: ref(nombreDelAlmacen, "ENDPOINT"),
    S3_BUCKET: ref(nombreDelAlmacen, "BUCKET"),
    S3_ACCESS_KEY_ID: ref(nombreDelAlmacen, "ACCESS_KEY_ID"),
    S3_SECRET_ACCESS_KEY: ref(nombreDelAlmacen, "SECRET_ACCESS_KEY"),
    S3_REGION: "auto",
    S3_FORZAR_RUTA: "false",
    S3_CONFIGURAR_CORS: "true",
    S3_EXIGIR_HUELLA: "true",
    ORIGENES_CONFIABLES: [https("campo"), https("oficina"), https("portal")].join(","),
    PORTAL_URL: https("portal"),
    // Producción nunca corre en modo de pruebas: `sembrar` se niega (ADR-0021).
    ...(produccion ? {} : { ENTORNO_DE_PRUEBAS: "true" }),
  };
  // Railway prueba la salud en PORT.
  const web = { healthcheck: "/salud", healthcheckTimeout: 120, replicas: { [REGION]: 1 }, deploy: { restartPolicyMaxRetries: 5 } };

  const campo = service("campo", {
    ...web,
    // Una sola migración por versión, antes de arrancar (ADR-0015).
    preDeploy: "node dist/cli/migrar.js",
    // El SDK aplica este campo (railway config pull lo genera) pero todavía no lo tipa.
    // @ts-expect-error preDeployTimeoutSeconds falta en DeployConfig
    deploy: { preDeployTimeoutSeconds: 300, restartPolicyMaxRetries: 5 },
    env: { ...comun, PORT: "3000", SUPERFICIE_CAMPO_HOST: ref("campo", "RAILWAY_PUBLIC_DOMAIN") },
  });
  const oficina = service("oficina", {
    ...web,
    env: { ...comun, PORT: "3000", SUPERFICIE_OFICINA_HOST: ref("oficina", "RAILWAY_PUBLIC_DOMAIN") },
  });
  // Solo el portal tiene la conexión con el rol `teins_portal` (ADR-0009, parte 3).
  const portal = service("portal", {
    ...web,
    env: { ...comun, PORT: "3000", SUPERFICIE_PORTAL_HOST: ref("portal", "RAILWAY_PUBLIC_DOMAIN"), DATABASE_URL_PORTAL: conexion("teins_portal", "TEINS_PORTAL_CONTRASENA") },
  });
  const worker = service("worker", {
    start: "node --enable-source-maps dist/worker.js",
    replicas: { [REGION]: 1 },
    deploy: { restartPolicyMaxRetries: 5 },
    env: comun,
  });

  // Copia diaria fuera del proyecto (ADR-0016, nivel 2): volcado de la base y archivos, a las 02:00 de Colombia.
  // El destino es un almacenamiento de otro proyecto; sus credenciales las fija montar.sh (ADR-0021).
  type Valor = string | ReturnType<typeof preserve>;
  const s3 = (lado: "ORIGEN" | "DESTINO", valores: { endpoint: Valor; llave: Valor; secreto: Valor }) => ({
    [`RCLONE_CONFIG_${lado}_TYPE`]: "s3",
    [`RCLONE_CONFIG_${lado}_PROVIDER`]: "Other",
    [`RCLONE_CONFIG_${lado}_REGION`]: "auto",
    [`RCLONE_CONFIG_${lado}_FORCE_PATH_STYLE`]: "false",
    [`RCLONE_CONFIG_${lado}_ENDPOINT`]: valores.endpoint,
    [`RCLONE_CONFIG_${lado}_ACCESS_KEY_ID`]: valores.llave,
    [`RCLONE_CONFIG_${lado}_SECRET_ACCESS_KEY`]: valores.secreto,
  });
  const respaldos = service("respaldos", {
    // Junto a la base: el volcado viaja por la red privada de la región.
    replicas: { [REGION]: 1 },
    deploy: { cronSchedule: "0 7 * * *", restartPolicyType: "NEVER" },
    env: {
      DATABASE_URL: ref("Postgres", "DATABASE_URL"),
      ORIGEN_BUCKET: ref(nombreDelAlmacen, "BUCKET"),
      ...s3("ORIGEN", { endpoint: ref(nombreDelAlmacen, "ENDPOINT"), llave: ref(nombreDelAlmacen, "ACCESS_KEY_ID"), secreto: ref(nombreDelAlmacen, "SECRET_ACCESS_KEY") }),
      DESTINO_BUCKET: preserve(),
      ...s3("DESTINO", { endpoint: preserve(), llave: preserve(), secreto: preserve() }),
    },
  });

  return project(produccion ? "teins-produccion" : "teins-pruebas", {
    resources: [campo, oficina, portal, worker, respaldos, Postgres, almacen, ...(conPitr ? [archivoPitr] : [])],
  });
});
