import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { Config } from "../../config";
import { contieneTexto } from "../../plataforma/busqueda";
import { ROLES, type Actor, type Rol } from "../../plataforma/actor";
import { enOrganizacion, esViolacionUnica, type BaseDeDatos } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion, registrarOperacionDeDispositivo, registrarRutaPublica } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import { olvidarSuscripciones } from "../avisos";
import { crearAuth, type Auth, type EventosDeAuth } from "./auth";
import { dispositivos, llavesDeAcceso, organizaciones, sesiones, usuarios } from "./esquema";

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
  /** Personas cuyo nombre contiene el texto: para buscar por técnico (iteración 23). */
  buscarPorNombre(organizacionId: string, texto: string): Promise<string[]>;
  crearUsuario(datos: NuevoUsuario): Promise<{ id: string }>;
  /** Recuperación de acceso por el administrador (ADR-0009): cambia la contraseña y cierra todas sus sesiones. */
  restablecerContrasena(usuario: string, contrasena: string): Promise<void>;
  /** Marca o desmarca a una persona de oficina como administradora (primer administrador: por comando). */
  marcarAdministrador(usuario: string, administrador: boolean, contexto: { autorId: string; correlacion: string }): Promise<void>;
  /**
   * Revocación (regla 13, P36): no vuelve a autenticar, pierde sus sesiones de inmediato y sus
   * dispositivos reciben la orden de borrar sus datos en el siguiente contacto. Su autoría se conserva.
   */
  desactivarUsuario(usuario: string, contexto: { autorId: string; correlacion: string }): Promise<"desactivado" | "ya_estaba">;
  /** Técnicos activos de la organización, por nombre: a quienes se les puede asignar una visita. */
  tecnicosActivos(organizacionId: string): Promise<{ id: string; nombre: string; usuario: string }[]>;
  /** Identificadores de técnicos activos por nombre de usuario; falla si alguno no lo es. */
  tecnicos(organizacionId: string, nombresDeUsuario: readonly string[]): Promise<string[]>;
  nombreDeOrganizacion(organizacionId: string): Promise<string>;
  /** Vencimiento del permiso de trabajo sin conexión que se entrega en cada contacto (ADR-0009, parte 2). */
  permisoLocalHasta(ahora?: Date): string;
  registrarRutas(app: FastifyInstance): void;
}

/** El servidor guarda solo la huella del secreto del dispositivo. */
const huellaDeSecreto = (secreto: string) => createHash("sha256").update(secreto).digest("hex");

/** Contraseña temporal de 16 caracteres (96 bits): se muestra una sola vez a quien administra. */
const contrasenaTemporal = () => randomBytes(12).toString("base64url");

const columnasAdministradas = {
  id: usuarios.id,
  usuario: usuarios.username,
  nombre: usuarios.name,
  rol: usuarios.rol,
  administrador: usuarios.administrador,
  segundoFactor: usuarios.twoFactorEnabled,
  desactivadoEn: usuarios.desactivadoEn,
  creadoEn: usuarios.createdAt,
  organizacionId: usuarios.organizacionId,
};
interface FilaAdministrada {
  id: string;
  usuario: string | null;
  nombre: string;
  rol: string;
  administrador: boolean;
  segundoFactor: boolean;
  desactivadoEn: Date | null;
  creadoEn: Date;
  organizacionId: string;
}

const comoAdministrado = (f: FilaAdministrada) => ({
  id: f.id,
  usuario: f.usuario ?? "",
  nombre: f.nombre,
  rol: f.rol as Rol,
  administrador: f.administrador,
  segundoFactor: f.segundoFactor,
  desactivadoEn: f.desactivadoEn?.toISOString() ?? null,
  creadoEn: f.creadoEn.toISOString(),
});

/** Interfaz pública del módulo de identidad (ADR-0009). */
export function crearIdentidad(bd: BaseDeDatos, config: Config): Identidad {
  /** Evento de seguridad del usuario en la cadena de su organización (ADR-0008). */
  async function eventoDeUsuario(usuarioId: string, tipoEvento: "segundo_factor_activado" | "segundo_factor_desactivado" | "llave_de_acceso_creada" | "llave_de_acceso_quitada") {
    const [usuario] = await bd.select({ organizacionId: usuarios.organizacionId }).from(usuarios).where(eq(usuarios.id, usuarioId));
    if (!usuario) return;
    await enOrganizacion(bd, usuario.organizacionId, (tx) =>
      registrar(tx, [
        {
          organizacionId: usuario.organizacionId,
          agregadoTipo: "usuario",
          agregadoId: usuarioId,
          tipoEvento,
          autorId: usuarioId,
          correlacion: `${tipoEvento}:${randomUUID()}`,
        },
      ]),
    );
  }

  const eventos: EventosDeAuth = {
    async alCrearSesion(sesion) {
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
    },
    alCambiarSegundoFactor: (usuarioId, activo) => eventoDeUsuario(usuarioId, activo ? "segundo_factor_activado" : "segundo_factor_desactivado"),
    alCambiarLlaveDeAcceso: (usuarioId, cambio) => eventoDeUsuario(usuarioId, cambio === "creada" ? "llave_de_acceso_creada" : "llave_de_acceso_quitada"),
  };

  // Una instancia por dominio de superficie: cada llave de acceso queda ligada al suyo (rpID).
  const dominios = [...new Set(config.ORIGENES_CONFIABLES.map((o) => new URL(o).hostname))];
  const porDominio = new Map(dominios.map((d) => [d, crearAuth(bd, config, d, eventos)]));
  const auth = porDominio.get(dominios[0]!)!;

  async function resolverActor(solicitud: FastifyRequest): Promise<Actor | null> {
    const sesion = await auth.api.getSession({ headers: fromNodeHeaders(solicitud.headers) });
    if (!sesion) return null;
    const { id, organizacionId, rol, desactivadoEn, administrador, twoFactorEnabled } = sesion.user as typeof sesion.user & {
      organizacionId: string;
      rol: string;
      desactivadoEn?: Date | null;
      administrador?: boolean | null;
      twoFactorEnabled?: boolean | null;
    };
    // Desactivar borra las sesiones; esto cubre una sesión creada durante la desactivación.
    if (desactivadoEn || !ROLES.includes(rol as Rol)) return null;
    // La marca solo vale para oficina: un técnico marcado por error no administra.
    return { usuarioId: id, organizacionId, rol: rol as Rol, administrador: rol === "oficina" && !!administrador, segundoFactor: !!twoFactorEnabled };
  }

  /** Usuario de la organización de quien administra; de otra organización es como si no existiera. */
  async function administrado(organizacionId: string, id: string): Promise<FilaAdministrada> {
    const [fila] = await bd.select(columnasAdministradas).from(usuarios).where(and(eq(usuarios.id, id), eq(usuarios.organizacionId, organizacionId)));
    if (!fila) throw problema("no_encontrado", "El usuario no existe");
    return fila;
  }

  async function porNombreDeUsuario(usuario: string): Promise<FilaAdministrada> {
    const [fila] = await bd.select(columnasAdministradas).from(usuarios).where(eq(usuarios.username, usuario.trim().toLowerCase()));
    if (!fila) throw new Error(`No existe el usuario ${usuario}`);
    return fila;
  }

  /**
   * Restablecer el acceso cambia la contraseña, cierra todas las sesiones y quita las llaves de acceso:
   * si se restablece porque se perdió el teléfono, la llave de ese teléfono deja de servir.
   */
  async function restablecer({ id, organizacionId }: { id: string; organizacionId: string }, contrasena: string): Promise<{ llavesQuitadas: number }> {
    const contexto = await auth.$context;
    await contexto.internalAdapter.updatePassword(id, await contexto.password.hash(contrasena));
    await contexto.internalAdapter.deleteUserSessions(id);
    const quitadas = await bd.delete(llavesDeAcceso).where(eq(llavesDeAcceso.userId, id)).returning({ id: llavesDeAcceso.id });
    // El teléfono perdido tampoco sigue recibiendo sus avisos (ADR-0023).
    await enOrganizacion(bd, organizacionId, (tx) => olvidarSuscripciones(tx, id));
    return { llavesQuitadas: quitadas.length };
  }

  async function desactivar(fila: FilaAdministrada, { autorId, correlacion }: { autorId: string; correlacion: string }) {
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
      await olvidarSuscripciones(tx, fila.id);
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
  }

  async function marcar(fila: FilaAdministrada, administrador: boolean, { autorId, correlacion }: { autorId: string; correlacion: string }) {
    if (fila.rol !== "oficina") throw problema("estado_invalido", "Solo una persona de oficina puede administrar");
    if (fila.desactivadoEn) throw problema("estado_invalido", "El usuario está desactivado");
    if (fila.administrador === administrador) return;
    await enOrganizacion(bd, fila.organizacionId, async (tx) => {
      await tx.update(usuarios).set({ administrador }).where(eq(usuarios.id, fila.id));
      await registrar(tx, [
        {
          organizacionId: fila.organizacionId,
          agregadoTipo: "usuario",
          agregadoId: fila.id,
          tipoEvento: "administrador_cambiado",
          autorId,
          correlacion,
          valorAnterior: fila.administrador,
          valorNuevo: administrador,
        },
      ]);
    });
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

    async buscarPorNombre(organizacionId, texto) {
      const filas = await bd
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(and(eq(usuarios.organizacionId, organizacionId), contieneTexto(usuarios.name, texto)));
      return filas.map((f) => f.id);
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
      await restablecer(await porNombreDeUsuario(usuario), contrasena);
    },

    async desactivarUsuario(usuario, contexto) {
      const fila = await porNombreDeUsuario(usuario);
      if (fila.desactivadoEn) return "ya_estaba";
      await desactivar(fila, contexto);
      return "desactivado";
    },

    async marcarAdministrador(usuario, administrador, contexto) {
      await marcar(await porNombreDeUsuario(usuario), administrador, contexto);
    },

    async nombreDeOrganizacion(organizacionId) {
      const [fila] = await bd.select({ nombre: organizaciones.nombre }).from(organizaciones).where(eq(organizaciones.id, organizacionId));
      return fila?.nombre ?? "[ORGANIZACIÓN]";
    },

    async tecnicosActivos(organizacionId) {
      const filas = await bd
        .select({ id: usuarios.id, nombre: usuarios.name, usuario: usuarios.username })
        .from(usuarios)
        .where(and(eq(usuarios.organizacionId, organizacionId), eq(usuarios.rol, "tecnico"), isNull(usuarios.desactivadoEn)))
        .orderBy(asc(usuarios.name));
      return filas.map((f) => ({ ...f, usuario: f.usuario ?? "" }));
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
          const resultado = await (porDominio.get(url.hostname) ?? auth).handler(peticion);
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
          return {
            usuario: { id: actor.usuarioId, nombre, rol: actor.rol, administrador: actor.administrador, segundoFactor: actor.segundoFactor },
            permisoLocalHasta: permisoLocalHasta(),
          };
        },
      });

      registrarOperacion(app, "listarTecnicos", {
        politica: politicas.oficina,
        manejar: async ({ actor }) => ({ tecnicos: await this.tecnicosActivos(actor.organizacionId) }),
      });

      // Administración (iteración 6). La organización sale siempre de la sesión de quien administra.
      registrarOperacion(app, "listarUsuarios", {
        politica: politicas.administrador,
        manejar: async ({ actor }) => {
          const filas = await bd
            .select(columnasAdministradas)
            .from(usuarios)
            .where(eq(usuarios.organizacionId, actor.organizacionId))
            // Primero los activos (sin fecha de desactivación): son los que se administran.
            .orderBy(sql`${usuarios.desactivadoEn} asc nulls first`, asc(usuarios.name));
          return { usuarios: filas.map(comoAdministrado) };
        },
      });

      registrarOperacion(app, "crearUsuarioAdministrado", {
        politica: politicas.administrador,
        manejar: async ({ cuerpo, actor, correlacion }) => {
          const [existente] = await bd.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.username, cuerpo.usuario));
          if (existente) throw problema("conflicto", "Ese nombre de usuario ya existe");
          const contrasena = contrasenaTemporal();
          let id: string;
          try {
            ({ id } = await this.crearUsuario({ organizacionId: actor.organizacionId, usuario: cuerpo.usuario, nombre: cuerpo.nombre, rol: cuerpo.rol, contrasena }));
          } catch (error) {
            // El nombre de usuario es único en todo el sistema: es con lo que se inicia sesión.
            if (esViolacionUnica(error)) throw problema("conflicto", "Ese nombre de usuario ya existe");
            throw error;
          }
          await enOrganizacion(bd, actor.organizacionId, (tx) =>
            registrar(tx, [
              { organizacionId: actor.organizacionId, agregadoTipo: "usuario", agregadoId: id, tipoEvento: "usuario_creado", autorId: actor.usuarioId, correlacion, valorNuevo: { usuario: cuerpo.usuario, rol: cuerpo.rol } },
            ]),
          );
          return { usuario: comoAdministrado(await administrado(actor.organizacionId, id)), contrasena };
        },
      });

      registrarOperacion(app, "restablecerContrasenaAdministrada", {
        politica: politicas.administrador,
        manejar: async ({ parametros: { id }, actor, correlacion }) => {
          const fila = await administrado(actor.organizacionId, id);
          if (fila.desactivadoEn) throw problema("estado_invalido", "El usuario está desactivado");
          const contrasena = contrasenaTemporal();
          const { llavesQuitadas } = await restablecer(fila, contrasena);
          await enOrganizacion(bd, actor.organizacionId, (tx) =>
            registrar(tx, [
              { organizacionId: actor.organizacionId, agregadoTipo: "usuario", agregadoId: fila.id, tipoEvento: "contrasena_restablecida", autorId: actor.usuarioId, correlacion, valorNuevo: { llavesQuitadas } },
            ]),
          );
          return { contrasena };
        },
      });

      registrarOperacion(app, "desactivarUsuarioAdministrado", {
        politica: politicas.administrador,
        manejar: async ({ parametros: { id }, actor, correlacion }) => {
          const fila = await administrado(actor.organizacionId, id);
          if (fila.id === actor.usuarioId) throw problema("estado_invalido", "No puede desactivarse a sí mismo");
          if (!fila.desactivadoEn) await desactivar(fila, { autorId: actor.usuarioId, correlacion });
          return comoAdministrado(await administrado(actor.organizacionId, id));
        },
      });

      registrarOperacion(app, "marcarAdministrador", {
        politica: politicas.administrador,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) => {
          const fila = await administrado(actor.organizacionId, id);
          // Quitarse la marca a sí mismo podría dejar la organización sin nadie que administre.
          if (fila.id === actor.usuarioId && !cuerpo.administrador) throw problema("estado_invalido", "Otra persona administradora debe quitarle la marca");
          await marcar(fila, cuerpo.administrador, { autorId: actor.usuarioId, correlacion });
          return comoAdministrado(await administrado(actor.organizacionId, id));
        },
      });

      registrarOperacion(app, "listarDispositivos", {
        politica: politicas.administrador,
        manejar: async ({ actor }) => {
          const filas = await bd
            .select({
              id: dispositivos.id,
              usuarioId: dispositivos.usuarioId,
              nombre: usuarios.name,
              registradoEn: dispositivos.registradoEn,
              ultimoContacto: dispositivos.ultimoContacto,
              salud: dispositivos.salud,
              ordenDeBorradoEn: dispositivos.ordenDeBorradoEn,
              borradoConfirmadoEn: dispositivos.borradoConfirmadoEn,
            })
            .from(dispositivos)
            .innerJoin(usuarios, eq(usuarios.id, dispositivos.usuarioId))
            .where(eq(dispositivos.organizacionId, actor.organizacionId))
            .orderBy(desc(dispositivos.ultimoContacto));
          return {
            dispositivos: filas.map((f) => ({
              id: f.id,
              usuario: { id: f.usuarioId, nombre: f.nombre },
              registradoEn: f.registradoEn.toISOString(),
              ultimoContacto: f.ultimoContacto.toISOString(),
              salud: f.salud ?? null,
              ordenDeBorradoEn: f.ordenDeBorradoEn?.toISOString() ?? null,
              borradoConfirmadoEn: f.borradoConfirmadoEn?.toISOString() ?? null,
            })),
          };
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
