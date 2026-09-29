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
  /**
   * Proxies de la plataforma delante del servidor: la IP del cliente es la que está justo antes de ellos en
   * X-Forwarded-For, y todo lo anterior lo pudo escribir el cliente. En Railway son dos (.railway/railway.ts).
   * Sin valor no se confía en ninguno: en desarrollo y pruebas no hay proxy.
   */
  PROXIES_DE_CONFIANZA: z.coerce.number().int().min(0).max(5).optional(),
  NIVEL_REGISTRO: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  /** Rol de la aplicación: sujeto a seguridad por fila, sin permiso de modificar auditoría. */
  DATABASE_URL: z.url(),
  /**
   * Rol dueño: migraciones y cola de trabajos. Nunca atiende solicitudes: el rol web no la recibe, y quien la usa
   * (worker, migrar, sembrar, crear-organizacion) la exige con `urlDelPropietario`.
   */
  DATABASE_URL_PROPIETARIO: z.url().optional(),
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

  /**
   * Envío del informe al cliente (ADR-0028). Sin la configuración de un canal, sus envíos quedan "No llegó"
   * con ese motivo. `ENVIOS_SIMULADOS` los acepta sin salir del servidor (desarrollo, pruebas, entorno de pruebas):
   * `true` simula los dos canales; `correo` o `whatsapp`, solo ese (el otro sale de verdad si está configurado).
   */
  ENVIOS_SIMULADOS: z
    .enum(["true", "false", "correo", "whatsapp"])
    .default("false")
    .transform((v) => ({ correo: v === "true" || v === "correo", whatsapp: v === "true" || v === "whatsapp" })),
  RESEND_CLAVE_API: z.string().regex(/^re_\w+$/, "Clave de API de Resend (re_…)").optional(),
  /** Secreto de firma de los eventos de Resend (Svix, whsec_…). */
  RESEND_SECRETO_EVENTOS: z.string().regex(/^whsec_[A-Za-z0-9+/=]+$/, "Secreto de eventos de Resend (whsec_…)").optional(),
  /** Remitente con su nombre, de un dominio verificado en Resend: "TEINS <informes@dominio>". */
  CORREO_REMITENTE: z.string().min(3).default("TEINS <informes@example.com>"),
  /** Adonde llegan las respuestas del cliente: el correo de oficina de TEINS. */
  CORREO_RESPONDER_A: z.email().optional(),
  WHATSAPP_TOKEN: z.string().min(20).optional(),
  WHATSAPP_NUMERO_ID: z.string().regex(/^\d+$/, "Id del número de WhatsApp Business (solo dígitos)").optional(),
  /** Secreto de la app de Meta: firma los eventos (X-Hub-Signature-256). */
  WHATSAPP_SECRETO_APP: z.string().min(16).optional(),
  /** Lo que Meta repite al registrar la dirección de los eventos. */
  WHATSAPP_TOKEN_VERIFICACION: z.string().min(16).optional(),
  WHATSAPP_PLANTILLA: z.string().regex(/^[a-z0-9_]+$/).default("informe_publicado"),
  /** Plantilla de las cotizaciones (ADR-0029): nombre, número de la cotización, sitio y versión. */
  WHATSAPP_PLANTILLA_COTIZACION: z.string().regex(/^[a-z0-9_]+$/).default("cotizacion_publicada"),
  WHATSAPP_IDIOMA: z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/).default("es"),
  WHATSAPP_VERSION_API: z.string().regex(/^v\d+\.\d+$/).default("v25.0"),
})
  // Los envíos simulados nunca corren en producción real: el cliente no recibiría nada y oficina vería "Enviado".
  .refine((c) => !(c.ENVIOS_SIMULADOS.correo || c.ENVIOS_SIMULADOS.whatsapp) || c.NODE_ENV !== "production" || c.ENTORNO_DE_PRUEBAS, {
    path: ["ENVIOS_SIMULADOS"],
    message: "Los envíos simulados solo se permiten fuera de producción o en el entorno de pruebas",
  })
  // Un origen https es un despliegue: en modo de desarrollo saldrían cookies sin Secure, sin HSTS y `sembrar`
  // quedaría permitido. Si falta NODE_ENV, no se arranca con el valor por defecto.
  .refine((c) => c.NODE_ENV !== "development" || c.ORIGENES_CONFIABLES.every((o) => new URL(o).protocol === "http:"), {
    path: ["NODE_ENV"],
    message: "Con orígenes https, NODE_ENV debe ser production",
  })
  // Sin el número de proxies, la IP de cada solicitud sería la del proxy: un solo límite de intentos para todos.
  .refine((c) => c.NODE_ENV !== "production" || c.PROXIES_DE_CONFIANZA !== undefined, {
    path: ["PROXIES_DE_CONFIANZA"],
    message: "En producción, diga cuántos proxies de la plataforma hay delante del servidor",
  });

export type Config = z.infer<typeof Esquema>;

/** La conexión del rol dueño, para quien la usa (worker, migrar, sembrar, crear-organizacion). */
export function urlDelPropietario(config: Config): string {
  if (!config.DATABASE_URL_PROPIETARIO) throw new Error("Configuración inválida:\n  DATABASE_URL_PROPIETARIO: este proceso usa el rol dueño y no la recibió");
  return config.DATABASE_URL_PROPIETARIO;
}

export function leerConfig(entorno: NodeJS.ProcessEnv = process.env): Config {
  const resultado = Esquema.safeParse(entorno);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuración inválida:\n${detalle}`);
  }
  return resultado.data;
}
