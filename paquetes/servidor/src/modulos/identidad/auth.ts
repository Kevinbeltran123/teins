import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor, username } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import type { Config } from "../../config";
import type { BaseDeDatos } from "../../plataforma/base-de-datos";
import { eq } from "drizzle-orm";
import { cuentas, limitesDeTasa, llavesDeAcceso, segundosFactores, sesiones, usuarios, verificaciones } from "./esquema";

export interface SesionCreada {
  id: string;
  userId: string;
}

export interface EventosDeAuth {
  alCrearSesion: (sesion: SesionCreada) => Promise<void>;
  alCambiarSegundoFactor: (usuarioId: string, activo: boolean) => Promise<void>;
  alCambiarLlaveDeAcceso: (usuarioId: string, cambio: "creada" | "quitada") => Promise<void>;
}

/**
 * Autenticación con Better Auth (ADR-0009): sesiones opacas en la base, cookie HttpOnly,
 * sin registro público. Revocar es borrar la fila de la sesión.
 *
 * Una instancia por superficie: una llave de acceso queda ligada al dominio donde se creó (`rpID`), y
 * cada superficie tiene el suyo (ADR-0016). Todas comparten la base y el secreto: la sesión es la misma.
 */
const RUTAS_DE_INGRESO = new Set(["/sign-in/username", "/two-factor/verify-totp", "/two-factor/verify-backup-code", "/passkey/verify-authentication"]);

export function crearAuth(bd: BaseDeDatos, config: Config, rpID: string, { alCrearSesion, alCambiarSegundoFactor, alCambiarLlaveDeAcceso }: EventosDeAuth) {
  return betterAuth({
    appName: "TEINS",
    secret: config.AUTH_SECRETO,
    basePath: "/api/auth",
    // Cada superficie tiene su propio origen con /api (ADR-0016): la URL base sale del host de la solicitud,
    // limitada a los hosts de las superficies conocidas.
    baseURL: {
      allowedHosts: config.ORIGENES_CONFIABLES.map((o) => new URL(o).host),
      protocol: config.NODE_ENV === "production" ? "https" : "http",
      fallback: config.ORIGENES_CONFIABLES[0]!,
    },
    trustedOrigins: config.ORIGENES_CONFIABLES,
    database: drizzleAdapter(bd, {
      provider: "pg",
      schema: { user: usuarios, session: sesiones, account: cuentas, verification: verificaciones, rateLimit: limitesDeTasa, twoFactor: segundosFactores, passkey: llavesDeAcceso },
    }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 128 },
    user: {
      additionalFields: {
        organizacionId: { type: "string", required: true, input: false },
        rol: { type: "string", required: true, input: false },
        desactivadoEn: { type: "date", required: false, input: false },
        administrador: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    session: {
      expiresIn: config.DURACION_SESION_DIAS * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/username": { window: 60, max: config.INICIOS_DE_SESION_POR_MINUTO },
        // El código del segundo factor tiene el mismo límite por origen; además, 10 fallos bloquean la cuenta 15 minutos.
        "/two-factor/*": { window: 60, max: config.INICIOS_DE_SESION_POR_MINUTO },
        "/passkey/verify-authentication": { window: 60, max: config.INICIOS_DE_SESION_POR_MINUTO },
      },
    },
    advanced: {
      cookiePrefix: "teins",
      useSecureCookies: config.NODE_ENV === "production",
      // Detrás del proxy de la plataforma, igual que trustProxy de Fastify.
      trustedProxyHeaders: config.NODE_ENV === "production",
      database: { generateId: () => randomUUID() },
    },
    plugins: [
      // Mismos caracteres que acepta crearUsuario (con guion): el validador por defecto rechaza el guion al ingresar.
      username({ minUsernameLength: 3, maxUsernameLength: 30, usernameValidator: (u) => /^[a-zA-Z0-9._-]+$/.test(u) }),
      // Segundo factor TOTP (ADR-0009), obligatorio para administrar. El inicio de sesión de quien lo tiene
      // activo responde twoFactorRedirect: su sesión provisional se borra y la de verdad nace al verificar el código.
      twoFactor({ issuer: "TEINS", twoFactorTable: "twoFactor" }),
      // Llaves de acceso (iteración 13): Face ID, huella o el PIN del dispositivo. Detectables (sin escribir
      // el usuario) y siempre con verificación de la persona: así valen también como segundo factor.
      passkey({
        rpID,
        rpName: "TEINS",
        origin: config.ORIGENES_CONFIABLES.map((o) => new URL(o).origin),
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        registration: { afterVerification: async ({ user }) => void (await alCambiarLlaveDeAcceso(user.id, "creada")) },
        authentication: {
          afterVerification: async ({ verification }) => {
            if (!verification.authenticationInfo.userVerified) throw new APIError("UNAUTHORIZED", { message: "La llave de acceso no verificó a la persona" });
          },
        },
      }),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Solo oficina activa el segundo factor: campo no sabe pedir el código (el técnico quedaría por fuera).
        if (ctx.path.startsWith("/two-factor/enable")) {
          const sesion = await getSessionFromCtx(ctx);
          if ((sesion?.user as { rol?: string } | undefined)?.rol !== "oficina") throw new APIError("FORBIDDEN", { message: "Solo oficina activa el segundo factor" });
        }
        // La llave se nombra con el usuario con que se inicia sesión, no con el correo interno: es lo que
        // muestra el teléfono al elegirla. Lo pone el servidor, no el navegador.
        if (ctx.path === "/passkey/generate-register-options") {
          const sesion = await getSessionFromCtx(ctx);
          const usuario = (sesion?.user as { username?: string | null } | undefined)?.username;
          if (usuario) return { context: { query: { ...ctx.query, name: usuario } } };
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.context.returned instanceof APIError) return;
        // Un ingreso es una sesión que nace de estas rutas. Con el segundo factor activo, la contraseña
        // crea una sesión provisional que el plugin borra después de este gancho (twoFactorRedirect); y
        // verificar un código sin el desafío del ingreso (al activar el factor) solo rota la sesión.
        const nueva = ctx.context.newSession;
        if (nueva && RUTAS_DE_INGRESO.has(ctx.path)) {
          const provisional = ctx.path === "/sign-in/username" && nueva.user.twoFactorEnabled === true;
          const rotacion = ctx.path.startsWith("/two-factor/") && !(ctx.headers?.get("cookie") ?? "").includes(ctx.context.createAuthCookie("two_factor").name);
          if (!provisional && !rotacion) await alCrearSesion(nueva.session);
        }
        if (ctx.path !== "/passkey/delete-passkey") return;
        const sesion = ctx.context.session ?? (await getSessionFromCtx(ctx));
        if (sesion) await alCambiarLlaveDeAcceso(sesion.user.id, "quitada");
      }),
    },
    databaseHooks: {
      user: {
        update: {
          // El segundo factor solo cambia al confirmarlo con un código o al desactivarlo: evento de seguridad (ADR-0008).
          after: async (usuario, contexto) => {
            if (contexto?.path === "/two-factor/verify-totp" || contexto?.path === "/two-factor/disable") {
              await alCambiarSegundoFactor(usuario.id, (usuario as { twoFactorEnabled?: boolean }).twoFactorEnabled === true);
            }
          },
        },
      },
      session: {
        create: {
          // Regla 13: un usuario desactivado no autentica. Responde igual que una contraseña equivocada.
          before: async (sesion) => {
            const [usuario] = await bd.select({ desactivadoEn: usuarios.desactivadoEn }).from(usuarios).where(eq(usuarios.id, sesion.userId));
            if (!usuario || usuario.desactivadoEn) throw new APIError("UNAUTHORIZED", { message: "Invalid username or password" });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof crearAuth>;
