import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import type { Config } from "../../config";
import type { BaseDeDatos } from "../../plataforma/base-de-datos";
import { cuentas, limitesDeTasa, sesiones, usuarios, verificaciones } from "./esquema";

export interface SesionCreada {
  id: string;
  userId: string;
}

/**
 * Autenticación con Better Auth (ADR-0009): sesiones opacas en la base, cookie HttpOnly,
 * sin registro público. Revocar es borrar la fila de la sesión.
 */
export function crearAuth(bd: BaseDeDatos, config: Config, alCrearSesion: (sesion: SesionCreada) => Promise<void>) {
  return betterAuth({
    appName: "TEINS",
    secret: config.AUTH_SECRETO,
    basePath: "/api/auth",
    trustedOrigins: config.ORIGENES_CONFIABLES,
    database: drizzleAdapter(bd, {
      provider: "pg",
      schema: { user: usuarios, session: sesiones, account: cuentas, verification: verificaciones, rateLimit: limitesDeTasa },
    }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10, maxPasswordLength: 128 },
    user: {
      additionalFields: {
        organizacionId: { type: "string", required: true, input: false },
        rol: { type: "string", required: true, input: false },
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
      customRules: { "/sign-in/username": { window: 60, max: config.INICIOS_DE_SESION_POR_MINUTO } },
    },
    advanced: {
      cookiePrefix: "teins",
      useSecureCookies: config.NODE_ENV === "production",
      database: { generateId: () => randomUUID() },
    },
    plugins: [username({ minUsernameLength: 3, maxUsernameLength: 30 })],
    databaseHooks: {
      session: { create: { after: (sesion) => alCrearSesion(sesion) } },
    },
  });
}

export type Auth = ReturnType<typeof crearAuth>;
