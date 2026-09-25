import { createHash } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { Config } from "../../config";
import { ROLES, type Actor, type Rol } from "../../plataforma/actor";
import { enOrganizacion, type BaseDeDatos } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion, registrarOperacionDeDispositivo, registrarRutaPublica } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import { crearAuth, type Auth } from "./auth";
import { dispositivos, sesiones, usuarios } from "./esquema";

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
  /**
   * Revocación (regla 13, P36): no vuelve a autenticar, pierde sus sesiones de inmediato y sus
   * dispositivos reciben la orden de borrar sus datos en el siguiente contacto. Su autoría se conserva.
   */
  desactivarUsuario(usuario: string, contexto: { autorId: string; correlacion: string }): Promise<"desactivado" | "ya_estaba">;
  /** Identificadores de técnicos activos por nombre de usuario; falla si alguno no lo es. */
  tecnicos(organizacionId: string, nombresDeUsuario: readonly string[]): Promise<string[]>;
  /** Vencimiento del permiso de trabajo sin conexión que se entrega en cada contacto (ADR-0009, parte 2). */
  permisoLocalHasta(ahora?: Date): string;
  registrarRutas(app: FastifyInstance): void;
}

/** El servidor guarda solo la huella del secreto del dispositivo. */
const huellaDeSecreto = (secreto: string) => createHash("sha256").update(secreto).digest("hex");

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
    const { id, organizacionId, rol, desactivadoEn } = sesion.user as typeof sesion.user & { organizacionId: string; rol: string; desactivadoEn?: Date | null };
    // Desactivar borra las sesiones; esto cubre una sesión creada durante la desactivación.
    if (desactivadoEn || !ROLES.includes(rol as Rol)) return null;
    return { usuarioId: id, organizacionId, rol: rol as Rol };
  }

  const permisoLocalHasta = (ahora = new Date()) => new Date(ahora.getTime() + config.DIAS_PERMISO_LOCAL * 86_400_000).toISOString();

  return {
    auth,
    resolverActor,
    permisoLocalHasta,

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

    async desactivarUsuario(usuario, { autorId, correlacion }) {
      const [fila] = await bd
        .select({ id: usuarios.id, organizacionId: usuarios.organizacionId, desactivadoEn: usuarios.desactivadoEn })
        .from(usuarios)
        .where(eq(usuarios.username, usuario.trim().toLowerCase()));
      if (!fila) throw new Error(`No existe el usuario ${usuario}`);
      if (fila.desactivadoEn) return "ya_estaba";
      await enOrganizacion(bd, fila.organizacionId, async (tx) => {
        const ahora = new Date();
        await tx.update(usuarios).set({ desactivadoEn: ahora }).where(eq(usuarios.id, fila.id));
        // Revocar es borrar la sesión: efecto inmediato en la siguiente solicitud (ADR-0009, parte 2).
        await tx.delete(sesiones).where(eq(sesiones.userId, fila.id));
        const marcados = await tx
          .update(dispositivos)
          .set({ ordenDeBorradoEn: ahora })
          .where(and(eq(dispositivos.usuarioId, fila.id), isNull(dispositivos.ordenDeBorradoEn)))
          .returning({ id: dispositivos.id });
        await registrar(tx, [
          {
            organizacionId: fila.organizacionId,
            agregadoTipo: "usuario",
            agregadoId: fila.id,
            tipoEvento: "usuario_desactivado",
            autorId,
            correlacion,
            valorNuevo: { dispositivosConOrdenDeBorrado: marcados.length },
          },
        ]);
      });
      return "desactivado";
    },

    async tecnicos(organizacionId, nombresDeUsuario) {
      const buscados = [...new Set(nombresDeUsuario.map((u) => u.trim().toLowerCase()))];
      const filas = await bd
        .select({ id: usuarios.id, usuario: usuarios.username, rol: usuarios.rol, desactivadoEn: usuarios.desactivadoEn })
        .from(usuarios)
        .where(and(eq(usuarios.organizacionId, organizacionId), inArray(usuarios.username, buscados)));
      const porNombre = new Map(filas.map((f) => [f.usuario, f]));
      const invalidos = buscados.filter((u) => {
        const f = porNombre.get(u);
        return !f || f.rol !== "tecnico" || f.desactivadoEn;
      });
      if (invalidos.length > 0) throw new Error(`No son técnicos activos de la organización: ${invalidos.join(", ")}`);
      return buscados.map((u) => porNombre.get(u)!.id);
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
          return { usuario: { id: actor.usuarioId, nombre, rol: actor.rol }, permisoLocalHasta: permisoLocalHasta() };
        },
      });

      registrarOperacion(app, "informarDispositivo", {
        politica: politicas.tecnico,
        manejar: async ({ cuerpo, actor }) => {
          const huella = huellaDeSecreto(cuerpo.secreto);
          const ahora = new Date();
          const registrado = await bd
            .insert(dispositivos)
            .values({ id: cuerpo.id, usuarioId: actor.usuarioId, organizacionId: actor.organizacionId, secretoHuella: huella, salud: cuerpo.salud, ultimoContacto: ahora })
            .onConflictDoUpdate({
              target: [dispositivos.id, dispositivos.usuarioId],
              set: { salud: cuerpo.salud, ultimoContacto: ahora },
              setWhere: eq(dispositivos.secretoHuella, huella),
            })
            .returning({ id: dispositivos.id });
          if (registrado.length === 0) throw problema("conflicto", "El dispositivo ya está registrado con otro secreto");
          return {};
        },
      });

      registrarOperacionDeDispositivo(app, "consultarOrdenes", async ({ cuerpo, correlacion }) => {
        const filas = await bd
          .select({
            usuarioId: dispositivos.usuarioId,
            organizacionId: dispositivos.organizacionId,
            ordenDeBorradoEn: dispositivos.ordenDeBorradoEn,
            borradoConfirmadoEn: dispositivos.borradoConfirmadoEn,
          })
          .from(dispositivos)
          .where(and(eq(dispositivos.id, cuerpo.id), eq(dispositivos.secretoHuella, huellaDeSecreto(cuerpo.secreto))));
        if (filas.length === 0) throw problema("no_autenticado", "Dispositivo desconocido");

        for (const fila of filas) {
          if (!fila.ordenDeBorradoEn || fila.borradoConfirmadoEn || !cuerpo.confirmados.includes(fila.usuarioId)) continue;
          fila.borradoConfirmadoEn = new Date();
          await enOrganizacion(bd, fila.organizacionId, async (tx) => {
            await tx
              .update(dispositivos)
              .set({ borradoConfirmadoEn: fila.borradoConfirmadoEn })
              .where(and(eq(dispositivos.id, cuerpo.id), eq(dispositivos.usuarioId, fila.usuarioId)));
            await registrar(tx, [
              {
                organizacionId: fila.organizacionId,
                agregadoTipo: "usuario",
                agregadoId: fila.usuarioId,
                tipoEvento: "borrado_local_confirmado",
                autorId: `dispositivo:${cuerpo.id}`,
                correlacion,
              },
            ]);
          });
        }
        return { borrar: filas.filter((f) => f.ordenDeBorradoEn && !f.borradoConfirmadoEn).map((f) => f.usuarioId) };
      });
    },
  };
}
