import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import type { Config } from "../../config";
import { contieneTexto } from "../../plataforma/busqueda";
import { ROLES, type Actor, type Rol } from "../../plataforma/actor";
import { enOrganizacion, esViolacionUnica, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion, registrarOperacionDeDispositivo, registrarRutaPublica, type ContextoHttp } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import { olvidarSuscripciones } from "../avisos";
import { crearAuth, type Auth, type EventosDeAuth } from "./auth";
import { cuentas, dispositivos, llavesDeAcceso, organizaciones, segundosFactores, sesiones, usuarios } from "./esquema";

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/;

export interface NuevoUsuario {
  organizacionId: string;
  usuario: string;
  nombre: string;
  rol: Rol;
  contrasena: string;
  /** La contraseña se entrega como temporal (desde oficina): debe cambiarla al entrar (ADR-0033). */
  temporal?: boolean;
}

type Ejecutor = BaseDeDatos | TxOrganizacion;

const RUTAS_DE_AUTENTICACION = new Set([
  "/sign-in/username",
  "/sign-out",
  "/two-factor/enable",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
  "/passkey/generate-authenticate-options",
  "/passkey/verify-authentication",
  "/passkey/list-user-passkeys",
  "/passkey/delete-passkey",
]);

export interface Identidad {
  auth: Auth;
  /** Con `respuesta`, la cookie renovada de una sesión que se desliza vuelve al navegador. */
  resolverActor(solicitud: FastifyRequest, respuesta?: FastifyReply): Promise<Actor | null>;
  /**
   * Nombres por id. Dentro de una transacción se pasa `en: tx`: pedir otra conexión del pool mientras se
   * retiene una puede agotarlo y dejar todas las solicitudes esperando.
   */
  nombres(organizacionId: string, ids: readonly string[], en?: Ejecutor): Promise<Map<string, string>>;
  /** Personas cuyo nombre contiene el texto: para buscar por técnico (iteración 23). Igual que `nombres` con `en`. */
  buscarPorNombre(organizacionId: string, texto: string, en?: Ejecutor): Promise<string[]>;
  /** Con `contexto`, queda el evento `usuario_creado` (desde oficina o por comando). */
  crearUsuario(datos: NuevoUsuario, contexto?: { autorId: string; correlacion: string }): Promise<{ id: string }>;
  /**
   * Recuperación de acceso por comando (ADR-0009): cambia la contraseña y cierra todas sus sesiones. Quien corre el
   * comando elige la contraseña (aprovisionamiento), así que no queda marcada como temporal (ADR-0033).
   */
  restablecerContrasena(usuario: string, contrasena: string, contexto: { autorId: string; correlacion: string }): Promise<void>;
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
  debeCambiarContrasena: usuarios.debeCambiarContrasena,
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
  debeCambiarContrasena: boolean;
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
  debeCambiarContrasena: f.debeCambiarContrasena,
  creadoEn: f.creadoEn.toISOString(),
});

/**
 * Rutas de Better Auth que actúan sobre una sesión ya abierta. Con la contraseña temporal no pasan: registrar una
 * llave o activar el segundo factor antes de cambiarla dejaría una puerta que no depende de la contraseña (ADR-0033).
 */
const RUTAS_CON_SESION = new Set(["/two-factor/enable", "/passkey/generate-register-options", "/passkey/verify-registration", "/passkey/list-user-passkeys", "/passkey/delete-passkey"]);

/** El token de la cookie de sesión que deja Better Auth (`teins.session_token=TOKEN.FIRMA`), para reconocer la sesión nueva. */
function tokenDeSesion(cookies: readonly string[]): string | undefined {
  const cookie = cookies.find((c) => /session_token=/.test(c.split(";")[0]!));
  const valor = cookie?.split(";")[0]!.split("=").slice(1).join("=");
  return valor ? decodeURIComponent(valor).split(".")[0] : undefined;
}

/** Interfaz pública del módulo de identidad (ADR-0009). */
export function crearIdentidad(bd: BaseDeDatos, config: Config): Identidad {
  /** Evento de seguridad del usuario en la cadena de su organización (ADR-0008). */
  async function eventoDeUsuario(usuarioId: string, tipoEvento: "segundo_factor_activado" | "llave_de_acceso_creada" | "llave_de_acceso_quitada" | "contrasena_cambiada" | "segundo_factor_quitado") {
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
    alActivarSegundoFactor: async (usuarioId) => {
      // Al activarlo se cierran las sesiones abiertas solo con contraseña: el factor es del usuario, y sin esto
      // una de ellas administraría sin haber presentado nunca un código (ADR-0009). La que lo confirmó se rota
      // después de este gancho y sigue abierta.
      await bd.delete(sesiones).where(eq(sesiones.userId, usuarioId));
      await eventoDeUsuario(usuarioId, "segundo_factor_activado");
    },
    alCambiarLlaveDeAcceso: (usuarioId, cambio) => eventoDeUsuario(usuarioId, cambio === "creada" ? "llave_de_acceso_creada" : "llave_de_acceso_quitada"),
  };

  // Una instancia por dominio de superficie: cada llave de acceso queda ligada al suyo (rpID).
  const dominios = [...new Set(config.ORIGENES_CONFIABLES.map((o) => new URL(o).hostname))];
  const porDominio = new Map(dominios.map((d) => [d, crearAuth(bd, config, d, eventos)]));
  const auth = porDominio.get(dominios[0]!)!;

  async function resolverActor(solicitud: FastifyRequest, respuesta?: FastifyReply): Promise<Actor | null> {
    const { headers, response: sesion } = await auth.api.getSession({ headers: fromNodeHeaders(solicitud.headers), returnHeaders: true });
    // Better Auth renueva la sesión una vez al día de uso: sin su cookie nueva, el navegador la pierde a los días de ingresar.
    const cookies = headers.getSetCookie();
    if (respuesta && cookies.length > 0) respuesta.header("set-cookie", cookies);
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
    return {
      usuarioId: id,
      organizacionId,
      rol: rol as Rol,
      administrador: rol === "oficina" && !!administrador,
      segundoFactor: !!twoFactorEnabled,
      debeCambiarContrasena: !!(sesion.user as { debeCambiarContrasena?: boolean | null }).debeCambiarContrasena,
    };
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
   * Restablecer el acceso cambia la contraseña, cierra todas las sesiones y quita las llaves de acceso y el
   * segundo factor: si se restablece porque se perdió el teléfono, nada de ese teléfono sigue sirviendo, y
   * quien administra vuelve a activar su factor al entrar. Todo en una transacción, con su registro (ADR-0008).
   */
  async function restablecer(
    { id, organizacionId }: { id: string; organizacionId: string },
    contrasena: string,
    { autorId, correlacion, temporal }: { autorId: string; correlacion: string; temporal: boolean },
  ): Promise<void> {
    const hash = await (await auth.$context).password.hash(contrasena);
    await enOrganizacion(bd, organizacionId, async (tx) => {
      const quitado = await restablecerEn(tx, id, hash, temporal);
      await registrar(tx, [{ organizacionId, agregadoTipo: "usuario", agregadoId: id, tipoEvento: "contrasena_restablecida", autorId, correlacion, valorNuevo: { ...quitado, temporal } }]);
    });
  }

  /**
   * Lo que tienen en común restablecer y reactivar: la contraseña nueva, sin sesiones, llaves, segundo factor ni
   * avisos. `temporal` marca que debe cambiarla al entrar (ADR-0033): la que se entrega desde oficina lo es.
   */
  async function restablecerEn(tx: TxOrganizacion, id: string, hash: string, temporal: boolean) {
    await tx.update(cuentas).set({ password: hash, updatedAt: new Date() }).where(and(eq(cuentas.userId, id), eq(cuentas.providerId, "credential")));
    await tx.delete(sesiones).where(eq(sesiones.userId, id));
    const quitadas = await tx.delete(llavesDeAcceso).where(eq(llavesDeAcceso.userId, id)).returning({ id: llavesDeAcceso.id });
    const factor = await tx.delete(segundosFactores).where(eq(segundosFactores.userId, id)).returning({ id: segundosFactores.id });
    await tx.update(usuarios).set({ twoFactorEnabled: false, debeCambiarContrasena: temporal }).where(eq(usuarios.id, id));
    // El teléfono perdido tampoco sigue recibiendo sus avisos (ADR-0023).
    await olvidarSuscripciones(tx, id);
    return { llavesQuitadas: quitadas.length, segundoFactorQuitado: factor.length > 0 };
  }

  /**
   * Reactivar (ADR-0033): vuelve con su misma cuenta y una contraseña temporal. No recupera sesiones, llaves ni
   * segundo factor, y las órdenes de borrado de sus teléfonos siguen: lo que había antes de desactivarlo se borra.
   */
  async function reactivar(fila: FilaAdministrada, contrasena: string, { autorId, correlacion }: { autorId: string; correlacion: string }) {
    const hash = await (await auth.$context).password.hash(contrasena);
    await enOrganizacion(bd, fila.organizacionId, async (tx) => {
      const reactivado = await tx
        .update(usuarios)
        .set({ desactivadoEn: null })
        .where(and(eq(usuarios.id, fila.id), sql`${usuarios.desactivadoEn} is not null`))
        .returning({ id: usuarios.id });
      // Otra persona lo reactivó al mismo tiempo: no se entrega una segunda contraseña.
      if (reactivado.length === 0) throw problema("estado_invalido", "El usuario ya está activo");
      const quitado = await restablecerEn(tx, fila.id, hash, true);
      await registrar(tx, [{ organizacionId: fila.organizacionId, agregadoTipo: "usuario", agregadoId: fila.id, tipoEvento: "usuario_reactivado", autorId, correlacion, valorNuevo: quitado }]);
    });
  }

  /**
   * Llama a una ruta de Better Auth desde una operación propia (ADR-0033), por su manejador HTTP y no por su API
   * interna: así aplica su límite de intentos por origen, con la IP que resolvió Fastify, y verifica el origen.
   * El cuerpo lo arma el servidor; el cliente no elige, por ejemplo, si se cierran las demás sesiones.
   */
  async function llamarAuth(http: ContextoHttp, ruta: string, cuerpo: object): Promise<{ estado: number; datos: { code?: string } | null; cookies: string[] }> {
    const host = http.cabeceras.host ?? "localhost";
    const url = new URL(`/api/auth${ruta}`, `http://${host}`);
    const cabeceras = fromNodeHeaders(http.cabeceras);
    cabeceras.set("x-forwarded-for", http.ip);
    cabeceras.set("content-type", "application/json");
    cabeceras.delete("content-length");
    const resultado = await (porDominio.get(url.hostname) ?? auth).handler(new Request(url, { method: "POST", headers: cabeceras, body: JSON.stringify(cuerpo) }));
    const texto = await resultado.text();
    let datos: { code?: string } | null = null;
    try {
      datos = texto ? (JSON.parse(texto) as { code?: string }) : null;
    } catch {
      datos = null;
    }
    return { estado: resultado.status, datos, cookies: resultado.headers.getSetCookie() };
  }

  /** Lo que responde Better Auth, en el idioma del contrato: un intento de más o un dato equivocado, con su campo. */
  function siFallo(r: { estado: number; datos: { code?: string } | null }, campo: string, mensaje: string) {
    if (r.estado === 200) return;
    if (r.estado === 429) throw problema("demasiadas_solicitudes", "Demasiados intentos. Espere un minuto e intente de nuevo.");
    if (r.estado === 400 || r.estado === 401) throw problema("credencial_incorrecta", mensaje, { campos: [{ ruta: campo, mensaje }] });
    throw new Error(`La autenticación respondió ${r.estado} (${r.datos?.code ?? "sin código"})`);
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

    async nombres(organizacionId, ids, en = bd) {
      if (ids.length === 0) return new Map();
      const filas = await en
        .select({ id: usuarios.id, nombre: usuarios.name })
        .from(usuarios)
        .where(and(eq(usuarios.organizacionId, organizacionId), inArray(usuarios.id, [...ids])));
      return new Map(filas.map((f) => [f.id, f.nombre]));
    },

    async buscarPorNombre(organizacionId, texto, en = bd) {
      const filas = await en
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(and(eq(usuarios.organizacionId, organizacionId), contieneTexto(usuarios.name, texto)));
      return filas.map((f) => f.id);
    },

    async crearUsuario({ organizacionId, usuario, nombre, rol, contrasena, temporal = false }, contexto) {
      const nombreDeUsuario = usuario.trim().toLowerCase();
      if (!USUARIO_VALIDO.test(nombreDeUsuario)) throw new Error("Usuario: 3 a 30 caracteres entre a-z, 0-9, punto, guion y guion bajo");
      if (contrasena.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres");
      const contextoAuth = await auth.$context;
      const creado = await contextoAuth.internalAdapter.createUser({
        name: nombre.trim(),
        // Correo interno no entregable (RFC 2606): Better Auth lo exige y los técnicos no tienen (P35).
        email: `${nombreDeUsuario}@${organizacionId}.invalid`,
        emailVerified: false,
        username: nombreDeUsuario,
        displayUsername: usuario.trim(),
        organizacionId,
        rol,
        debeCambiarContrasena: temporal,
      }, { method: "admin" });
      try {
        await contextoAuth.internalAdapter.linkAccount({
          providerId: "credential",
          accountId: creado.id,
          userId: creado.id,
          password: await contextoAuth.password.hash(contrasena),
        });
      } catch (error) {
        await contextoAuth.internalAdapter.deleteUser(creado.id);
        throw error;
      }
      // Better Auth crea el usuario con su propia conexión: el registro va después, en su transacción.
      if (contexto) {
        await enOrganizacion(bd, organizacionId, (tx) =>
          registrar(tx, [
            { organizacionId, agregadoTipo: "usuario", agregadoId: creado.id, tipoEvento: "usuario_creado", autorId: contexto.autorId, correlacion: contexto.correlacion, valorNuevo: { usuario: nombreDeUsuario, rol } },
          ]),
        );
      }
      return { id: creado.id };
    },

    async restablecerContrasena(usuario, contrasena, contexto) {
      if (contrasena.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres");
      await restablecer(await porNombreDeUsuario(usuario), contrasena, { ...contexto, temporal: false });
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
          // Solo lo que usan las aplicaciones: el resto de Better Auth (cambiar el propio nombre o usuario,
          // ingresar por correo, consultar usuarios) no pasa, porque no tiene auditoría ni límite propio.
          const ruta = url.pathname.slice("/api/auth".length);
          if (!RUTAS_DE_AUTENTICACION.has(ruta)) throw problema("no_encontrado");
          if (RUTAS_CON_SESION.has(ruta) && (await resolverActor(solicitud))?.debeCambiarContrasena) {
            throw problema("cambio_de_contrasena_requerido", "Cambie su contraseña temporal para seguir");
          }
          // La IP del cliente la resuelve Fastify (trustProxy, app.ts) y Better Auth la recibe sola: con la
          // cabecera del proxy, que trae además un salto interno, no sabría cuál es y usaría un solo límite de
          // intentos para todos.
          const cabeceras = fromNodeHeaders(solicitud.headers);
          cabeceras.set("x-forwarded-for", solicitud.ip);
          const peticion = new Request(url, {
            method: solicitud.method,
            headers: cabeceras,
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
        politica: politicas.autenticadoConContrasenaTemporal,
        manejar: async ({ actor }) => {
          const nombre = (await this.nombres(actor.organizacionId, [actor.usuarioId])).get(actor.usuarioId);
          if (!nombre) throw problema("no_autenticado");
          return {
            usuario: { id: actor.usuarioId, nombre, rol: actor.rol, administrador: actor.administrador, segundoFactor: actor.segundoFactor, debeCambiarContrasena: actor.debeCambiarContrasena },
            permisoLocalHasta: permisoLocalHasta(),
          };
        },
      });

      registrarOperacion(app, "cambiarContrasena", {
        politica: politicas.autenticadoConContrasenaTemporal,
        manejar: async ({ cuerpo, actor, http }) => {
          if (cuerpo.nueva === cuerpo.actual) throw problema("entrada_invalida", "Debe ser distinta de la actual", { campos: [{ ruta: "nueva", mensaje: "Debe ser distinta de la actual" }] });
          // Las demás sesiones se cierran siempre: si alguien más la conocía, deja de tener acceso.
          const r = await llamarAuth(http, "/change-password", { currentPassword: cuerpo.actual, newPassword: cuerpo.nueva, revokeOtherSessions: true });
          siFallo(r, "actual", "La contraseña actual no es correcta");
          http.ponerCookies(r.cookies);
          await bd.update(usuarios).set({ debeCambiarContrasena: false }).where(eq(usuarios.id, actor.usuarioId));
          await eventoDeUsuario(actor.usuarioId, "contrasena_cambiada");
          return {};
        },
      });

      registrarOperacion(app, "quitarSegundoFactor", {
        politica: politicas.autenticado,
        manejar: async ({ cuerpo, actor, http }) => {
          // Quien administra lo necesita siempre (ADR-0009): ni la pantalla ni una llamada directa lo quitan.
          if (actor.administrador) throw problema("sin_permiso", "Quien administra debe tener el segundo factor");
          if (!actor.segundoFactor) throw problema("estado_invalido", "No tiene el segundo factor activo");
          // El código prueba que tiene la app autenticadora, no solo una sesión abierta y la contraseña.
          siFallo(await llamarAuth(http, "/two-factor/verify-totp", { code: cuerpo.codigo }), "codigo", "El código no es correcto o ya venció");
          const r = await llamarAuth(http, "/two-factor/disable", { password: cuerpo.contrasena });
          siFallo(r, "contrasena", "La contraseña no es correcta");
          http.ponerCookies(r.cookies);
          // Better Auth deja una sesión nueva en lugar de esta; las demás se cierran, como al cambiar la contraseña.
          const nueva = tokenDeSesion(r.cookies);
          await bd.delete(sesiones).where(and(eq(sesiones.userId, actor.usuarioId), ...(nueva ? [sql`${sesiones.token} <> ${nueva}`] : [])));
          await eventoDeUsuario(actor.usuarioId, "segundo_factor_quitado");
          return {};
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
            ({ id } = await this.crearUsuario({ organizacionId: actor.organizacionId, usuario: cuerpo.usuario, nombre: cuerpo.nombre, rol: cuerpo.rol, contrasena, temporal: true }, { autorId: actor.usuarioId, correlacion }));
          } catch (error) {
            // El nombre de usuario es único en todo el sistema: es con lo que se inicia sesión.
            if (esViolacionUnica(error)) throw problema("conflicto", "Ese nombre de usuario ya existe");
            throw error;
          }
          return { usuario: comoAdministrado(await administrado(actor.organizacionId, id)), contrasena };
        },
      });

      registrarOperacion(app, "restablecerContrasenaAdministrada", {
        politica: politicas.administrador,
        manejar: async ({ parametros: { id }, actor, correlacion }) => {
          const fila = await administrado(actor.organizacionId, id);
          if (fila.desactivadoEn) throw problema("estado_invalido", "El usuario está desactivado");
          // La propia se cambia desde "Mi cuenta": restablecerla aquí le quitaría el segundo factor a quien administra.
          if (fila.id === actor.usuarioId) throw problema("estado_invalido", "Cambie su contraseña desde Mi cuenta");
          const contrasena = contrasenaTemporal();
          await restablecer(fila, contrasena, { autorId: actor.usuarioId, correlacion, temporal: true });
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

      registrarOperacion(app, "reactivarUsuarioAdministrado", {
        politica: politicas.administrador,
        manejar: async ({ parametros: { id }, actor, correlacion }) => {
          const fila = await administrado(actor.organizacionId, id);
          if (!fila.desactivadoEn) throw problema("estado_invalido", "El usuario ya está activo");
          const contrasena = contrasenaTemporal();
          await reactivar(fila, contrasena, { autorId: actor.usuarioId, correlacion });
          return { usuario: comoAdministrado(await administrado(actor.organizacionId, id)), contrasena };
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
            // Un reintento simultáneo del teléfono también leyó la orden sin confirmar: solo uno la confirma y la registra.
            const confirmado = await tx
              .update(dispositivos)
              .set({ borradoConfirmadoEn: fila.borradoConfirmadoEn })
              .where(and(eq(dispositivos.id, cuerpo.id), eq(dispositivos.usuarioId, fila.usuarioId), isNull(dispositivos.borradoConfirmadoEn)))
              .returning({ id: dispositivos.id });
            if (confirmado.length === 0) return;
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
