import { and, eq, inArray } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { Config } from "../../config";
import { ROLES, type Actor, type Rol } from "../../plataforma/actor";
import { enOrganizacion, type BaseDeDatos } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion, registrarRutaPublica } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import { crearAuth, type Auth } from "./auth";
import { usuarios } from "./esquema";

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;

export interface NuevoUsuario {
  organizacionId: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  contrasena: string;
}

export interface Identidad {
  auth: Auth;
  resolverActor(solicitud: FastifyRequest): Promise<Actor | null>;
  nombres(organizacionId: string, ids: readonly string[]): Promise<Map<string, string>>;
  crearUsuario(datos: NuevoUsuario): Promise<{ id: string }>;
  /** Recuperación de acceso por el administrador (ADR-0009): cambia la contraseña y cierra todas sus sesiones. */
  restablecerContrasena(usuario: string, contrasena: string): Promise<void>;
  registrarRutas(app: FastifyInstance): void;
}

/** Interfaz pública del módulo de identidad (ADR-0009). */
export function crearIdentidad(bd: BaseDeDatos, config: Config): Identidad {
  const auth = crearAuth(bd, config, async (sesion) => {
    const [usuario] = await bd.select({ organizacionId: usuarios.organizacionId }).from(usuarios).where(eq(usuarios.id, sesion.userId));
    if (!usuario) return;
    // Evento de seguridad en la cadena de la organización (ADR-0008).
    await enOrganizacion(bd, usuario.organizacionId, (tx) =>
      registrar(tx, [
        {
          organizacionId: usuario.organizacionId,
          agregadoTipo: "organizacion",
          agregadoId: usuario.organizacionId,
          tipoEvento: "inicio_de_sesion",
          autorId: sesion.userId,
          correlacion: sesion.id,
        },
      ]),
    );
  });

  async function resolverActor(solicitud: FastifyRequest): Promise<Actor | null> {
    const sesion = await auth.api.getSession({ headers: fromNodeHeaders(solicitud.headers) });
    if (!sesion) return null;
    const { id, organizacionId, rol } = sesion.user as typeof sesion.user & { organizacionId: string; rol: string };
    if (!ROLES.includes(rol as Rol)) return null;
    return { usuarioId: id, organizacionId, rol: rol as Rol };
  }

  return {
    auth,
    resolverActor,

    async nombres(organizacionId, ids) {
      if (ids.length === 0) return new Map();
      const filas = await bd
        .select({ id: usuarios.id, nombre: usuarios.name })
        .from(usuarios)
        .where(and(eq(usuarios.organizacionId, organizacionId), inArray(usuarios.id, [...ids])));
      return new Map(filas.map((f) => [f.id, f.nombre]));
    },

    async crearUsuario({ organizacionId, usuario, nombre, rol, contrasena }) {
      const nombreDeUsuario = usuario.trim().toLowerCase();
      if (!USUARIO_VALIDO.test(nombreDeUsuario)) throw new Error("Usuario: 3 a 30 caracteres entre a-z, 0-9, punto, guion y guion bajo");
      if (contrasena.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres");
      const contexto = await auth.$context;
      const creado = await contexto.internalAdapter.createUser({
        name: nombre.trim(),
        // Correo interno no entregable (RFC 2606): Better Auth lo exige y los técnicos no tienen (P35).
        email: `${nombreDeUsuario}@${organizacionId}.invalid`,
        emailVerified: false,
        username: nombreDeUsuario,
        displayUsername: usuario.trim(),
        organizacionId,
        rol,
      }, { method: "admin" });
      try {
        await contexto.internalAdapter.linkAccount({
          providerId: "credential",
          accountId: creado.id,
          userId: creado.id,
          password: await contexto.password.hash(contrasena),
        });
      } catch (error) {
        await contexto.internalAdapter.deleteUser(creado.id);
        throw error;
      }
      return { id: creado.id };
    },

    async restablecerContrasena(usuario, contrasena) {
      if (contrasena.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres");
      const [fila] = await bd.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.username, usuario.trim().toLowerCase()));
      if (!fila) throw new Error(`No existe el usuario ${usuario}`);
      const contexto = await auth.$context;
      await contexto.internalAdapter.updatePassword(fila.id, await contexto.password.hash(contrasena));
      await contexto.internalAdapter.deleteUserSessions(fila.id);
    },

    registrarRutas(app) {
      registrarRutaPublica(app, {
        method: ["GET", "POST"],
        url: "/api/auth/*",
        motivo: "Autenticación: Better Auth aplica sus propias reglas, orígenes confiables y límite de intentos",
        handler: async (solicitud, respuesta) => {
          const url = new URL(solicitud.url, `http://${solicitud.headers.host ?? "localhost"}`);
          const peticion = new Request(url, {
            method: solicitud.method,
            headers: fromNodeHeaders(solicitud.headers),
            ...(solicitud.body !== undefined && solicitud.method !== "GET" ? { body: JSON.stringify(solicitud.body) } : {}),
          });
          const resultado = await auth.handler(peticion);
          respuesta.status(resultado.status);
          resultado.headers.forEach((valor, clave) => {
            if (clave !== "set-cookie") respuesta.header(clave, valor);
          });
          const cookies = resultado.headers.getSetCookie();
          if (cookies.length > 0) respuesta.header("set-cookie", cookies);
          return respuesta.send(resultado.body ? await resultado.text() : null);
        },
      });

      registrarOperacion(app, "obtenerSesion", {
        politica: politicas.autenticado,
        manejar: async ({ actor }) => {
          const nombre = (await this.nombres(actor.organizacionId, [actor.usuarioId])).get(actor.usuarioId);
          if (!nombre) throw problema("no_autenticado");
          return { usuario: { id: actor.usuarioId, nombre, rol: actor.rol } };
        },
      });
    },
  };
}
