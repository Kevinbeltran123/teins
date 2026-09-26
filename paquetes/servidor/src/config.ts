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
  /** Entorno con datos ficticios que corre como producción (cookies seguras, proxy): permite sembrar. Nunca en producción real. */
  ENTORNO_DE_PRUEBAS: booleano.default(false),
  HOST: z.string().default("0.0.0.0"),
  PUERTO: z.coerce.number().int().min(1).max(65535).default(3000),
  NIVEL_REGISTRO: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  /** Rol de la aplicación: sujeto a seguridad por fila, sin permiso de modificar auditoría. */
  DATABASE_URL: z.url(),
  /** Rol dueño: migraciones y cola de trabajos. Nunca atiende solicitudes. */
  DATABASE_URL_PROPIETARIO: z.url(),
  POOL_MAXIMO: z.coerce.number().int().min(1).max(100).default(10),
  /**
   * Rol exclusivo del portal (ADR-0009, parte 3): solo ve versiones publicadas del cliente de la sesión.
   * Sin valor, el rol web no atiende el portal.
   */
  DATABASE_URL_PORTAL: z.url().optional(),

  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORZAR_RUTA: booleano.default(false),
  /** Configura CORS del bucket al sembrar. S3Mock no lo admite (ya permite todo); un proveedor real sí lo exige. */
  S3_CONFIGURAR_CORS: booleano.default(true),
  BYTES_MAXIMOS_ARCHIVO: z.coerce.number().int().positive().max(BYTES_MAXIMOS_ARCHIVO).default(BYTES_MAXIMOS_ARCHIVO),
  /**
   * Firma la huella SHA-256 en la subida: el almacenamiento rechaza un contenido distinto (ADR-0007).
   * Cloudflare R2 no admite esa cabecera en PutObject; ahí se apaga y la garantía es la verificación
   * del worker (firma interna, tamaño y huella), que ADR-0007 exige siempre.
   */
  S3_EXIGIR_HUELLA: booleano.default(true),

  /**
   * Chromium para el PDF (ADR-0013). En la imagen es el de Alpine, con su versión fijada por la imagen;
   * en desarrollo y pruebas, sin valor, se usa el que instala Playwright.
   */
  CHROMIUM_RUTA: z.string().min(1).optional(),

  /**
   * Superficies servidas por el rol web, cada una en su host con /api en el mismo origen (ADR-0016).
   * En desarrollo no se usan: Vite sirve las superficies y reenvía /api.
   */
  SUPERFICIE_CAMPO_HOST: z.string().min(1).optional(),
  SUPERFICIE_OFICINA_HOST: z.string().min(1).optional(),
  SUPERFICIE_PORTAL_HOST: z.string().min(1).optional(),
  /** Dirección pública del portal: la lleva el QR de cada acceso de cliente, con el identificador y nunca la clave. */
  PORTAL_URL: z.url().optional(),
  SUPERFICIES_DIR: z.string().min(1).default("superficies"),

  AUTH_SECRETO: z.string().min(32, "AUTH_SECRETO debe tener al menos 32 caracteres"),
  /** Orígenes de las superficies (campo, oficina); Better Auth rechaza los demás. */
  ORIGENES_CONFIABLES: listaDeUrls,
  DURACION_SESION_DIAS: z.coerce.number().int().min(1).max(90).default(30),
  /** Días que un dispositivo trabaja sin contacto antes de bloquear la captura (ADR-0009, parte 2). Vencer nunca borra. */
  DIAS_PERMISO_LOCAL: z.coerce.number().int().min(1).max(30).default(7),
  /** Intentos de inicio de sesión por minuto y dirección (QA-7). */
  INICIOS_DE_SESION_POR_MINUTO: z.coerce.number().int().min(1).max(10_000).default(5),

  /**
   * Avisos push (ADR-0023). Claves VAPID generadas con `generar-claves-avisos`; sin ellas, los avisos están
   * apagados. El rol web solo necesita la pública; el worker, las tres. El contacto va en cada envío para que
   * el servicio de avisos pueda escribir si hay un problema.
   */
  AVISOS_VAPID_PUBLICA: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/, "Clave pública VAPID en base64url").optional(),
  AVISOS_VAPID_PRIVADA: z.string().regex(/^[A-Za-z0-9_-]{40,50}$/, "Clave privada VAPID en base64url").optional(),
  AVISOS_CONTACTO: z.string().regex(/^(mailto:|https:\/\/)\S+$/, "Use mailto:correo o una URL https").optional(),
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
