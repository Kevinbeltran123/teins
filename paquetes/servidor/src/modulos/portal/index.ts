import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Config } from "../../config";
import { claveDeObjeto, type Almacenamiento } from "../../plataforma/almacenamiento";
import { enClienteDelPortal, enOrganizacion, type BaseDeDatos } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion, registrarOperacionDelPortal } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import { clientesYSitios } from "../clientes";
import { informesParaElPortal } from "../informes";
import { HASH_DE_RELLENO, hashDeClave, huellaDeToken, nuevaClave, nuevoIdentificador, nuevoToken, verificarClave } from "./claves";
import { accesosDeClientes, intentos, sesionesDelPortal } from "./esquema";

/** Sesiones cortas (ADR-0009, parte 4): 30 minutos desde el último uso. */
const DURACION_SESION_S = 30 * 60;
/**
 * Límite de intentos (QA-7): desde el quinto fallo con un identificador, o el vigésimo desde un mismo
 * origen, espera creciente (1, 2, 4… minutos, hasta una hora). Los fallos se olvidan tras una hora sin fallar.
 */
const UMBRAL = { acceso: 5, origen: 20 } as const;
const ESPERA_MAXIMA_S = 60 * 60;

export interface SesionDelPortal {
  tokenHuella: string;
  accesoId: string;
  organizacionId: string;
  clienteId: string;
  cliente: string;
}

const noAutenticado = () => problema("no_autenticado", "El identificador o la clave no son correctos");

/** Rutas del portal. Todo lo que hacen pasa por la conexión con el rol `teins_portal` (ADR-0009, parte 3). */
export function crearPortal({ bdPortal, almacenamiento, config }: { bdPortal: BaseDeDatos; almacenamiento: Almacenamiento; config: Config }) {
  const seguro = config.NODE_ENV === "production";
  const nombreCookie = seguro ? "__Host-teins-portal" : "teins-portal";

  async function resolverSesion(token: string): Promise<SesionDelPortal | null> {
    const tokenHuella = huellaDeToken(token);
    return bdPortal.transaction(async (tx) => {
      const [fila] = await tx
        .select({ accesoId: sesionesDelPortal.accesoId, organizacionId: sesionesDelPortal.organizacionId, clienteId: sesionesDelPortal.clienteId, cliente: accesosDeClientes.clienteNombre })
        .from(sesionesDelPortal)
        .innerJoin(accesosDeClientes, eq(accesosDeClientes.id, sesionesDelPortal.accesoId))
        .where(and(eq(sesionesDelPortal.tokenHuella, tokenHuella), gt(sesionesDelPortal.expiraEn, sql`now()`)));
      if (!fila) return null;
      await tx.update(sesionesDelPortal).set({ expiraEn: sql`now() + make_interval(secs => ${DURACION_SESION_S})` }).where(eq(sesionesDelPortal.tokenHuella, tokenHuella));
      return { tokenHuella, ...fila };
    });
  }

  /** Suma un fallo a cada llave y bloquea las que pasaron su umbral. */
  async function registrarFallo(llaves: { llave: string; umbral: number }[]) {
    await bdPortal.transaction(async (tx) => {
      for (const { llave, umbral } of llaves) {
        const [{ fallos } = { fallos: 1 }] = await tx
          .insert(intentos)
          .values({ llave, fallos: 1, ultimoFallo: sql`now()` })
          .onConflictDoUpdate({
            target: intentos.llave,
            set: { fallos: sql`case when ${intentos.ultimoFallo} < now() - interval '1 hour' then 1 else ${intentos.fallos} + 1 end`, ultimoFallo: sql`now()` },
          })
          .returning({ fallos: intentos.fallos });
        if (fallos >= umbral) {
          const espera = Math.min(ESPERA_MAXIMA_S, 60 * 2 ** (fallos - umbral));
          await tx.update(intentos).set({ bloqueadoHasta: sql`now() + make_interval(secs => ${espera})` }).where(eq(intentos.llave, llave));
        }
      }
    });
  }

  const comun = { nombreCookie, seguro, resolverSesion };

  return {
    registrarRutas(app: FastifyInstance) {
      registrarOperacionDelPortal(app, "ingresarAlPortal", {
        ...comun,
        publica: "Ingreso del cliente al portal: identificador del QR y clave, con límite de intentos (QA-7)",
        manejar: async ({ cuerpo, portal, correlacion }) => {
          const llaves = [
            { llave: `acceso:${cuerpo.identificador}`, umbral: UMBRAL.acceso },
            { llave: `origen:${portal.ip}`, umbral: UMBRAL.origen },
          ];
          const bloqueos = await bdPortal
            .select({ hasta: intentos.bloqueadoHasta })
            .from(intentos)
            .where(and(inArray(intentos.llave, llaves.map((l) => l.llave)), gt(intentos.bloqueadoHasta, sql`now()`)));
          if (bloqueos.length > 0) {
            const hasta = Math.max(...bloqueos.map((b) => b.hasta!.getTime()));
            throw problema("demasiadas_solicitudes", "Demasiados intentos. Espere antes de volver a intentar.", { reintentarEnSegundos: Math.ceil((hasta - Date.now()) / 1000) });
          }

          const [acceso] = await bdPortal.select().from(accesosDeClientes).where(eq(accesosDeClientes.identificador, cuerpo.identificador));
          // Con un identificador desconocido se verifica igual: la respuesta no revela si existe.
          const valida = await verificarClave(cuerpo.clave, acceso?.claveHash ?? HASH_DE_RELLENO);
          if (!acceso || !valida) {
            await registrarFallo(llaves);
            throw noAutenticado();
          }

          const token = nuevoToken();
          await enOrganizacion(bdPortal, acceso.organizacionId, async (tx) => {
            await tx.delete(intentos).where(eq(intentos.llave, llaves[0]!.llave));
            await tx.insert(sesionesDelPortal).values({
              tokenHuella: huellaDeToken(token),
              accesoId: acceso.id,
              organizacionId: acceso.organizacionId,
              clienteId: acceso.clienteId,
              expiraEn: sql`now() + make_interval(secs => ${DURACION_SESION_S})`,
            });
            await registrar(tx, [
              { organizacionId: acceso.organizacionId, agregadoTipo: "acceso_cliente", agregadoId: acceso.id, tipoEvento: "ingreso_portal", autorId: `acceso:${acceso.id}`, correlacion },
            ]);
          });
          portal.ponerSesion(token, DURACION_SESION_S);
          return { cliente: acceso.clienteNombre };
        },
      });

      registrarOperacionDelPortal(app, "sesionDelPortal", { ...comun, manejar: async ({ sesion }) => ({ cliente: sesion.cliente }) });

      registrarOperacionDelPortal(app, "salirDelPortal", {
        ...comun,
        publica: "Cerrar la sesión del portal: sin sesión no hay nada que cerrar",
        manejar: async ({ portal }) => {
          if (portal.token) await bdPortal.delete(sesionesDelPortal).where(eq(sesionesDelPortal.tokenHuella, huellaDeToken(portal.token)));
          portal.quitarSesion();
          return {};
        },
      });

      registrarOperacionDelPortal(app, "informesDelPortal", {
        ...comun,
        manejar: async ({ sesion }) => {
          const vigentes = await enClienteDelPortal(bdPortal, sesion.organizacionId, sesion.clienteId, (tx) => informesParaElPortal.vigentes(tx));
          return {
            cliente: sesion.cliente,
            informes: vigentes.map((v) => ({
              id: v.informeId,
              numero: v.numero,
              publicadaEn: v.publicadaEn.toISOString(),
              sitio: v.visita.sitio,
              direccion: v.visita.direccion,
              motivo: v.visita.motivo,
              programadaPara: v.visita.programadaPara,
            })),
          };
        },
      });

      registrarOperacionDelPortal(app, "pdfDelPortal", {
        ...comun,
        manejar: async ({ sesion, parametros: { id }, correlacion }) => {
          const pdf = await enClienteDelPortal(bdPortal, sesion.organizacionId, sesion.clienteId, async (tx) => {
            const vigente = await informesParaElPortal.pdfVigente(tx, id);
            // La descarga queda en el registro de seguridad (ADR-0009, parte 4).
            if (vigente) {
              await registrar(tx, [
                {
                  organizacionId: sesion.organizacionId,
                  agregadoTipo: "acceso_cliente",
                  agregadoId: sesion.accesoId,
                  tipoEvento: "descarga_portal",
                  autorId: `acceso:${sesion.accesoId}`,
                  correlacion,
                  valorNuevo: { informe: id, numero: vigente.numero },
                },
              ]);
            }
            return vigente;
          });
          // Otro cliente o un informe sin publicar dan lo mismo: no existe (QA-4).
          if (!pdf) throw problema("no_encontrado");
          // Se descarga, no se abre: el portal no pierde la pantalla.
          const firma = await almacenamiento.firmarDescarga(claveDeObjeto(sesion.organizacionId, pdf.huella), { descargarComo: pdf.nombre });
          return { url: firma.url, expiraEn: firma.expiraEn.toISOString() };
        },
      });
    },
  };
}

export interface CredencialesDeAcceso {
  identificador: string;
  /** Se muestra una sola vez: la base solo guarda su hash. */
  clave: string;
}

/** URL que lleva el QR: identifica el acceso, nunca lleva la clave. */
export const urlDeAcceso = (portalUrl: string, identificador: string) => `${portalUrl.replace(/\/$/, "")}/?acceso=${identificador}`;

/**
 * Administración de los accesos de clientes, con el rol de la aplicación: desde oficina, por una
 * persona administradora, o con los comandos `crear-acceso-cliente` y `regenerar-acceso-cliente`.
 */
export function crearAccesosDeClientes(bd: BaseDeDatos) {
  return {
    /** Operaciones de oficina (iteración 6). */
    registrarRutas(app: FastifyInstance, config: Config) {
      registrarOperacion(app, "listarAccesosDeClientes", {
        politica: politicas.administrador,
        manejar: async ({ actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const lista = await clientesYSitios.listar(tx);
            const accesos = await tx.select({ clienteId: accesosDeClientes.clienteId, creadoEn: accesosDeClientes.creadoEn, regeneradoEn: accesosDeClientes.regeneradoEn }).from(accesosDeClientes);
            const porCliente = new Map(accesos.map((a) => [a.clienteId, a]));
            return {
              clientes: lista.map((c) => {
                const a = porCliente.get(c.id);
                return { id: c.id, nombre: c.nombre, acceso: a ? { creadoEn: a.creadoEn.toISOString(), regeneradoEn: a.regeneradoEn?.toISOString() ?? null } : null };
              }),
            };
          }),
      });

      registrarOperacion(app, "crearAccesoDeCliente", {
        politica: politicas.administrador,
        manejar: async ({ parametros: { clienteId }, cuerpo, actor, correlacion }) => {
          if (!config.PORTAL_URL) throw problema("error_interno", "Falta PORTAL_URL: la dirección del portal que lleva el QR");
          const contexto = { autorId: actor.usuarioId, correlacion };
          const c = cuerpo.regenerar ? await this.regenerar(actor.organizacionId, clienteId, contexto) : await this.crear(actor.organizacionId, clienteId, contexto);
          return { ...c, url: urlDeAcceso(config.PORTAL_URL, c.identificador) };
        },
      });
    },

    async crear(organizacionId: string, clienteId: string, contexto: { autorId: string; correlacion: string }): Promise<CredencialesDeAcceso> {
      const credenciales = { identificador: nuevoIdentificador(), clave: nuevaClave() };
      const claveHash = await hashDeClave(credenciales.clave);
      await enOrganizacion(bd, organizacionId, async (tx) => {
        const cliente = await clientesYSitios.obtener(tx, clienteId);
        if (!cliente) throw problema("no_encontrado", "El cliente no existe en la organización");
        const id = randomUUID();
        const [creado] = await tx
          .insert(accesosDeClientes)
          .values({ id, organizacionId, clienteId, clienteNombre: cliente.nombre, identificador: credenciales.identificador, claveHash })
          .onConflictDoNothing()
          .returning({ id: accesosDeClientes.id });
        if (!creado) throw problema("conflicto", "El cliente ya tiene acceso: regenérelo para uno nuevo");
        await registrar(tx, [{ organizacionId, agregadoTipo: "acceso_cliente", agregadoId: id, tipoEvento: "acceso_cliente_creado", ...contexto, valorNuevo: { cliente: clienteId } }]);
      });
      return credenciales;
    },

    /** Identificador y clave nuevos: el QR anterior deja de servir y se cierran todas las sesionesDelPortal. */
    async regenerar(organizacionId: string, clienteId: string, contexto: { autorId: string; correlacion: string }): Promise<CredencialesDeAcceso> {
      const credenciales = { identificador: nuevoIdentificador(), clave: nuevaClave() };
      const claveHash = await hashDeClave(credenciales.clave);
      await enOrganizacion(bd, organizacionId, async (tx) => {
        const [acceso] = await tx
          .update(accesosDeClientes)
          .set({ identificador: credenciales.identificador, claveHash, regeneradoEn: new Date() })
          .where(eq(accesosDeClientes.clienteId, clienteId))
          .returning({ id: accesosDeClientes.id });
        if (!acceso) throw problema("no_encontrado", "El cliente no tiene acceso: créelo primero");
        await tx.delete(sesionesDelPortal).where(eq(sesionesDelPortal.accesoId, acceso.id));
        await registrar(tx, [{ organizacionId, agregadoTipo: "acceso_cliente", agregadoId: acceso.id, tipoEvento: "acceso_cliente_regenerado", ...contexto }]);
      });
      return credenciales;
    },
  };
}
