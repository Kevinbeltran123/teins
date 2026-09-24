import { z } from "zod";
import { BYTES_MAXIMOS_ARCHIVO } from "@teins/protocolo";

const booleano = z.enum(["true", "false"]).transform((v) => v === "true");
const listaDeUrls = z
  .string()
  .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean))
  .pipe(z.array(z.url()).min(1));

/** Configuración por entorno (ADR-0016). Un valor inválido impide arrancar: nunca se corre con configuración a medias. */
const Esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PUERTO: z.coerce.number().int().min(1).max(65535).default(3000),
  NIVEL_REGISTRO: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  /** Rol de la aplicación: sujeto a seguridad por fila, sin permiso de modificar auditoría. */
  DATABASE_URL: z.url(),
  /** Rol dueño: migraciones y cola de trabajos. Nunca atiende solicitudes. */
  DATABASE_URL_PROPIETARIO: z.url(),
  POOL_MAXIMO: z.coerce.number().int().min(1).max(100).default(10),

  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORZAR_RUTA: booleano.default(false),
  /** Configura CORS del bucket al sembrar. S3Mock no lo admite (ya permite todo); un proveedor real sí lo exige. */
  S3_CONFIGURAR_CORS: booleano.default(true),
  BYTES_MAXIMOS_ARCHIVO: z.coerce.number().int().positive().max(BYTES_MAXIMOS_ARCHIVO).default(BYTES_MAXIMOS_ARCHIVO),

  AUTH_SECRETO: z.string().min(32, "AUTH_SECRETO debe tener al menos 32 caracteres"),
  /** Orígenes de las superficies (campo, oficina); Better Auth rechaza los demás. */
  ORIGENES_CONFIABLES: listaDeUrls,
  DURACION_SESION_DIAS: z.coerce.number().int().min(1).max(90).default(30),
  /** Intentos de inicio de sesión por minuto y dirección (QA-7). */
  INICIOS_DE_SESION_POR_MINUTO: z.coerce.number().int().min(1).max(10_000).default(5),
});

export type Config = z.infer<typeof Esquema>;

export function leerConfig(entorno: NodeJS.ProcessEnv = process.env): Config {
  const resultado = Esquema.safeParse(entorno);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuración inválida:\n${detalle}`);
  }
  return resultado.data;
}
