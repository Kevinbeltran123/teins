import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { correoDeCodigo, correoDeInvitacion } from "@teins/documentos";
import type { Config } from "../../config";
import { claveDeObjeto, type Almacenamiento } from "../../plataforma/almacenamiento";
import { enClienteDelPortal, enOrganizacion, esViolacionUnica, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { encolar, type Trabajos } from "../../plataforma/cola";
import { problema } from "../../plataforma/errores";
import { registrarOperacionDelPortal } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import { cotizacionesParaElPortal } from "../cotizaciones";
import { RechazoDefinitivo, type Proveedores } from "../envios";
import { informesParaElPortal } from "../informes";
import { derivarCodigo, huellaDeToken, mismaHuella, mismoCodigo, nuevoToken, secretoDeCodigos } from "./claves";
import { accesosDeContactos, intentos, pedidosDeCodigo, sesionesDelPortal } from "./esquema";

/** Sesiones cortas (ADR-0009, parte 4; ADR-0053): 30 minutos desde el último uso. */
const DURACION_SESION_S = 30 * 60;
/** El código vence a los 10 minutos y se agota al quinto intento (ADR-0053). */
const DURACION_PEDIDO_S = 10 * 60;
const INTENTOS_POR_CODIGO = 5;
/**
 * Límite de intentos (QA-7): desde el quinto pedido de código para un correo, o el vigésimo desde un mismo origen (por
 * pedidos o por ingresos fallidos), espera creciente (1, 2, 4… minutos, hasta una hora). Se olvidan una hora después
 * del último o del fin de la espera, lo que ocurra más tarde.
 */
const PEDIDOS_POR_CORREO = 5;
const ESPERA_MAXIMA_S = 60 * 60;
const olvidado = sql`greatest(${intentos.ultimoFallo}, ${intentos.bloqueadoHasta}) < now() - interval '1 hour'`;

export interface SesionDelPortal {
  tokenHuella: string;
  accesoId: string;
  organizacionId: string;
  clienteId: string;
  cliente: string;
  contacto: string;
  ve: { informes: boolean; cotizaciones: boolean };
}

type FilaAcceso = typeof accesosDeContactos.$inferSelect;
const comoSesion = (a: Pick<FilaAcceso, "clienteNombre" | "contactoNombre" | "veInformes" | "veCotizaciones">) => ({
  cliente: a.clienteNombre,
  contacto: a.contactoNombre,
  ve: { informes: a.veInformes, cotizaciones: a.veCotizaciones },
});

/** Un código incorrecto, vencido, ya usado, agotado o de otro navegador responde lo mismo (ADR-0053). */
const noAutenticado = () => problema("no_autenticado", "El código no es correcto o venció. Pida uno nuevo.");
const noRecibe = (que: "informes" | "cotizaciones") => problema("sin_permiso", `Este contacto no recibe ${que}: pídale a oficina que se los agregue`);

/** El acceso de un correo. Hoy el portal es de una organización; si dos tuvieran el mismo correo, entra al más antiguo. */
const accesoDelCorreo = (bdPortal: BaseDeDatos, correo: string) =>
  bdPortal.select().from(accesosDeContactos).where(eq(accesosDeContactos.correo, correo)).orderBy(asc(accesosDeContactos.creadoEn)).limit(1);

/** Rutas del portal. Todo lo que hacen pasa por la conexión con el rol `teins_portal` (ADR-0009, parte 3). */
export function crearPortal({ bdPortal, almacenamiento, config }: { bdPortal: BaseDeDatos; almacenamiento: Almacenamiento; config: Config }) {
  const seguro = config.NODE_ENV === "production";
  const nombreCookie = seguro ? "__Host-teins-portal" : "teins-portal";
  /** La cookie del navegador que pidió el código: el código solo vale con ella (ADR-0053). */
  const cookiePendiente = seguro ? "__Host-teins-portal-pendiente" : "teins-portal-pendiente";
  const secreto = secretoDeCodigos(config);
  const umbralOrigen = config.PORTAL_INTENTOS_POR_ORIGEN;

  async function resolverSesion(token: string): Promise<SesionDelPortal | null> {
    const tokenHuella = huellaDeToken(token);
    return bdPortal.transaction(async (tx) => {
      const [fila] = await tx
        .select({ accesoId: sesionesDelPortal.accesoId, organizacionId: sesionesDelPortal.organizacionId, clienteId: sesionesDelPortal.clienteId, acceso: accesosDeContactos })
        .from(sesionesDelPortal)
        .innerJoin(accesosDeContactos, eq(accesosDeContactos.id, sesionesDelPortal.accesoId))
        .where(and(eq(sesionesDelPortal.tokenHuella, tokenHuella), gt(sesionesDelPortal.expiraEn, sql`now()`)));
      if (!fila) return null;
      await tx.update(sesionesDelPortal).set({ expiraEn: sql`now() + make_interval(secs => ${DURACION_SESION_S})` }).where(eq(sesionesDelPortal.tokenHuella, tokenHuella));
      return { tokenHuella, accesoId: fila.accesoId, organizacionId: fila.organizacionId, clienteId: fila.clienteId, ...comoSesion(fila.acceso) };
    });
  }

  /**
   * Cuenta el intento en cada llave antes de seguir, y bloquea las que llegan a su umbral: así los intentos simultáneos
   * no pasan todos la revisión del bloqueo. Con una llave ya bloqueada no cuenta nada y responde cuánto esperar.
   */
  async function contarIntento(llaves: { llave: string; umbral: number }[]) {
    // Los olvidados se borran: cada correo u origen probado dejaría su fila para siempre. Sin esperar filas bloqueadas.
    await bdPortal.delete(intentos).where(inArray(intentos.llave, bdPortal.select({ llave: intentos.llave }).from(intentos).where(olvidado).for("update", { skipLocked: true })));
    await bdPortal.transaction(async (tx) => {
      for (const { llave, umbral } of llaves) {
        const [contado] = await tx
          .insert(intentos)
          .values({ llave, fallos: 1, ultimoFallo: sql`now()` })
          .onConflictDoUpdate({
            target: intentos.llave,
            set: { fallos: sql`case when ${olvidado} then 1 else ${intentos.fallos} + 1 end`, ultimoFallo: sql`now()` },
            setWhere: sql`${intentos.bloqueadoHasta} is null or ${intentos.bloqueadoHasta} <= now()`,
          })
          .returning({ fallos: intentos.fallos });
        if (!contado) {
          const [bloqueo] = await tx.select({ hasta: intentos.bloqueadoHasta }).from(intentos).where(eq(intentos.llave, llave));
          const hasta = bloqueo?.hasta?.getTime() ?? Date.now();
          throw problema("demasiadas_solicitudes", "Demasiados intentos. Espere antes de volver a intentar.", { reintentarEnSegundos: Math.ceil((hasta - Date.now()) / 1000) });
        }
        if (contado.fallos >= umbral) {
          const espera = Math.min(ESPERA_MAXIMA_S, 60 * 2 ** (contado.fallos - umbral));
          await tx.update(intentos).set({ bloqueadoHasta: sql`now() + make_interval(secs => ${espera})` }).where(eq(intentos.llave, llave));
        }
      }
    });
  }

  const comun = { nombreCookie, seguro, resolverSesion, duracionSesionS: DURACION_SESION_S };

  return {
    registrarRutas(app: FastifyInstance) {
      registrarOperacionDelPortal(app, "pedirCodigoDelPortal", {
        ...comun,
        publica: "Pedir el código de ingreso al portal: responde igual con o sin acceso, con límite de intentos (ADR-0053, QA-7)",
        manejar: async ({ cuerpo: { correo }, portal }) => {
          await contarIntento([
            { llave: `pedido:${huellaDeToken(correo)}`, umbral: PEDIDOS_POR_CORREO },
            { llave: `pedido-origen:${portal.ip}`, umbral: umbralOrigen },
          ]);
          // La cookie sale siempre, tenga o no acceso el correo: la respuesta no lo revela.
          const navegador = nuevoToken();
          portal.ponerCookie(cookiePendiente, navegador, DURACION_PEDIDO_S);
          const [acceso] = await accesoDelCorreo(bdPortal, correo);
          if (acceso) {
            // El correo sale en el worker: el tiempo de respuesta tampoco dice si el correo tiene acceso.
            await enOrganizacion(bdPortal, acceso.organizacionId, async (tx) => {
              const pedido = { pedidoId: randomUUID(), navegadorHuella: huellaDeToken(navegador), expiraEn: sql`now() + make_interval(secs => ${DURACION_PEDIDO_S})`, intentos: 0 };
              await tx
                .insert(pedidosDeCodigo)
                .values({ accesoId: acceso.id, organizacionId: acceso.organizacionId, ...pedido })
                .onConflictDoUpdate({ target: pedidosDeCodigo.accesoId, set: { ...pedido, creadoEn: sql`now()` } });
              await tx.execute(sql`select cola.encolar_correo_del_portal(${acceso.organizacionId}::uuid, ${acceso.id}::uuid, ${pedido.pedidoId}::uuid)`);
            });
          }
          return {};
        },
      });

      registrarOperacionDelPortal(app, "ingresarConCodigo", {
        ...comun,
        publica: "Ingreso al portal con el código del correo, desde el navegador que lo pidió, con límite de intentos (ADR-0053, QA-7)",
        manejar: async ({ cuerpo: { correo, codigo }, portal, correlacion }) => {
          const llaveOrigen = `origen:${portal.ip}`;
          await contarIntento([{ llave: llaveOrigen, umbral: umbralOrigen }]);
          const navegador = portal.cookie(cookiePendiente);
          const [acceso] = await accesoDelCorreo(bdPortal, correo);
          if (!navegador || !acceso) throw noAutenticado();

          // El intento cuenta antes de comparar y en su propia transacción: un código equivocado no lo deshace, y los
          // intentos simultáneos no pasan de cinco (QA-7).
          const [pedido] = await enOrganizacion(bdPortal, acceso.organizacionId, (tx) =>
            tx
              .update(pedidosDeCodigo)
              .set({ intentos: sql`${pedidosDeCodigo.intentos} + 1` })
              .where(eq(pedidosDeCodigo.accesoId, acceso.id))
              .returning({ pedidoId: pedidosDeCodigo.pedidoId, navegadorHuella: pedidosDeCodigo.navegadorHuella, intentos: pedidosDeCodigo.intentos, vigente: sql<boolean>`${pedidosDeCodigo.expiraEn} > now()` }),
          );
          const valido =
            pedido !== undefined &&
            pedido.vigente &&
            pedido.intentos <= INTENTOS_POR_CODIGO &&
            mismaHuella(pedido.navegadorHuella, huellaDeToken(navegador)) &&
            mismoCodigo(secreto, pedido.pedidoId, codigo);
          if (!valido) throw noAutenticado();

          const token = nuevoToken();
          await enOrganizacion(bdPortal, acceso.organizacionId, async (tx) => {
            // Un solo uso: si otra solicitud ya lo usó (o se pidió otro), esta no entra.
            const usado = await tx
              .delete(pedidosDeCodigo)
              .where(and(eq(pedidosDeCodigo.accesoId, acceso.id), eq(pedidosDeCodigo.pedidoId, pedido.pedidoId)))
              .returning({ accesoId: pedidosDeCodigo.accesoId });
            if (usado.length === 0) throw noAutenticado();
            // El ingreso correcto no es un fallo del origen: se descuenta lo que contó antes de comparar.
            await tx
              .update(intentos)
              .set({ fallos: sql`${intentos.fallos} - 1`, bloqueadoHasta: sql`case when ${intentos.fallos} - 1 >= ${umbralOrigen} then ${intentos.bloqueadoHasta} end` })
              .where(eq(intentos.llave, llaveOrigen));
            await tx.insert(sesionesDelPortal).values({
              tokenHuella: huellaDeToken(token),
              accesoId: acceso.id,
              organizacionId: acceso.organizacionId,
              clienteId: acceso.clienteId,
              expiraEn: sql`now() + make_interval(secs => ${DURACION_SESION_S})`,
            });
            await tx.update(accesosDeContactos).set({ ultimoIngreso: sql`now()` }).where(eq(accesosDeContactos.id, acceso.id));
            await registrar(tx, [
              {
                organizacionId: acceso.organizacionId,
                agregadoTipo: "acceso_cliente",
                agregadoId: acceso.id,
                tipoEvento: "ingreso_portal",
                autorId: `acceso:${acceso.id}`,
                correlacion,
                valorNuevo: { contacto: acceso.contactoId },
              },
            ]);
          });
          portal.ponerCookie(cookiePendiente, "", 0);
          portal.ponerSesion(token, DURACION_SESION_S);
          return comoSesion(acceso);
        },
      });

      registrarOperacionDelPortal(app, "sesionDelPortal", { ...comun, manejar: async ({ sesion }) => ({ cliente: sesion.cliente, contacto: sesion.contacto, ve: sesion.ve }) });

      registrarOperacionDelPortal(app, "salirDelPortal", {
        ...comun,
        publica: "Cerrar la sesión del portal: sin sesión no hay nada que cerrar",
        manejar: async ({ portal }) => {
          if (portal.token) await bdPortal.delete(sesionesDelPortal).where(eq(sesionesDelPortal.tokenHuella, huellaDeToken(portal.token)));
          portal.quitarSesion();
          return {};
        },
      });

      /** La descarga queda en el registro de seguridad, con el contacto (ADR-0053). */
      const registrarDescarga = (tx: TxOrganizacion, sesion: SesionDelPortal, correlacion: string, documento: Record<string, unknown>) =>
        registrar(tx, [
          {
            organizacionId: sesion.organizacionId,
            agregadoTipo: "acceso_cliente",
            agregadoId: sesion.accesoId,
            tipoEvento: "descarga_portal",
            autorId: `acceso:${sesion.accesoId}`,
            correlacion,
            valorNuevo: documento,
          },
        ]);

      registrarOperacionDelPortal(app, "informesDelPortal", {
        ...comun,
        manejar: async ({ sesion }) => {
          if (!sesion.ve.informes) throw noRecibe("informes");
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
          if (!sesion.ve.informes) throw noRecibe("informes");
          const pdf = await enClienteDelPortal(bdPortal, sesion.organizacionId, sesion.clienteId, async (tx) => {
            const vigente = await informesParaElPortal.pdfVigente(tx, id);
            if (vigente) await registrarDescarga(tx, sesion, correlacion, { informe: id, numero: vigente.numero });
            return vigente;
          });
          // Otro cliente o un informe sin publicar dan lo mismo: no existe (QA-4).
          if (!pdf) throw problema("no_encontrado");
          // Se descarga, no se abre: el portal no pierde la pantalla.
          const firma = await almacenamiento.firmarDescarga(claveDeObjeto(sesion.organizacionId, pdf.huella), { descargarComo: pdf.nombre });
          return { url: firma.url, expiraEn: firma.expiraEn.toISOString() };
        },
      });

      registrarOperacionDelPortal(app, "cotizacionesDelPortal", {
        ...comun,
        manejar: async ({ sesion }) => {
          if (!sesion.ve.cotizaciones) throw noRecibe("cotizaciones");
          const vigentes = await enClienteDelPortal(bdPortal, sesion.organizacionId, sesion.clienteId, (tx) => cotizacionesParaElPortal.vigentes(tx));
          return {
            cotizaciones: vigentes.map((v) => ({
              id: v.cotizacionId,
              numero: v.numero,
              version: v.version,
              publicadaEn: v.publicadaEn.toISOString(),
              sitio: v.visita.sitio,
              programadaPara: v.visita.programadaPara,
            })),
          };
        },
      });

      registrarOperacionDelPortal(app, "pdfDeCotizacionDelPortal", {
        ...comun,
        manejar: async ({ sesion, parametros: { id }, correlacion }) => {
          if (!sesion.ve.cotizaciones) throw noRecibe("cotizaciones");
          const pdf = await enClienteDelPortal(bdPortal, sesion.organizacionId, sesion.clienteId, async (tx) => {
            const vigente = await cotizacionesParaElPortal.pdfVigente(tx, id);
            if (vigente) await registrarDescarga(tx, sesion, correlacion, { cotizacion: id, numero: vigente.version });
            return vigente;
          });
          // Otro cliente, una retirada o una sin PDF dan lo mismo: no existe (QA-4).
          if (!pdf) throw problema("no_encontrado");
          const firma = await almacenamiento.firmarDescarga(claveDeObjeto(sesion.organizacionId, pdf.huella), { descargarComo: pdf.nombre });
          return { url: firma.url, expiraEn: firma.expiraEn.toISOString() };
        },
      });
    },
  };
}

/** Lo que el acceso copia del contacto: el rol del portal no puede leerlo. */
export interface DatosDeAcceso {
  correo: string;
  contactoNombre: string;
  veInformes: boolean;
  veCotizaciones: boolean;
}

/**
 * Los accesos de los contactos (ADR-0053), con la transacción de quien llama (módulo de clientes, rol teins_app): lo
 * que cambia en el contacto cambia el acceso en la misma transacción. Quitar un acceso borra sus sesiones y su pedido.
 */
export const accesosDelPortal = {
  /** Último ingreso de cada contacto con acceso; los que no están, no tienen acceso. */
  async estados(tx: TxOrganizacion, contactoIds: readonly string[]): Promise<Map<string, { ultimoIngreso: Date | null }>> {
    if (contactoIds.length === 0) return new Map();
    const filas = await tx
      .select({ contactoId: accesosDeContactos.contactoId, ultimoIngreso: accesosDeContactos.ultimoIngreso })
      .from(accesosDeContactos)
      .where(inArray(accesosDeContactos.contactoId, [...contactoIds]));
    return new Map(filas.map((f) => [f.contactoId, { ultimoIngreso: f.ultimoIngreso }]));
  },

  /** Si el contacto puede entrar al portal: el correo de un documento lleva entonces el botón que lleva a él. */
  async tieneAcceso(tx: TxOrganizacion, contactoId: string): Promise<boolean> {
    return (await accesosDelPortal.estados(tx, [contactoId])).has(contactoId);
  },

  /** Da acceso; si ya lo tenía, no hace nada. Otro contacto con el mismo correo: conflicto. Con `invitar`, encola la invitación. */
  async activar(
    tx: TxOrganizacion,
    datos: DatosDeAcceso & { organizacionId: string; organizacionNombre: string; clienteId: string; clienteNombre: string; contactoId: string },
    { invitar }: { invitar: boolean },
  ): Promise<void> {
    const [existente] = await tx.select({ id: accesosDeContactos.id }).from(accesosDeContactos).where(eq(accesosDeContactos.contactoId, datos.contactoId));
    if (existente) return;
    const id = randomUUID();
    await conCorreoUnico(tx, () => tx.insert(accesosDeContactos).values({ id, ...datos }));
    if (invitar) await encolar(tx, "portal.correo", { organizacionId: datos.organizacionId, accesoId: id, tipo: "invitacion" }, { llave: `portal.invitacion:${id}`, intentosMaximos: 5 });
  },

  /** El contacto cambió: si cambió el correo, sus sesiones y su pedido se cierran; lo que ve, cambia ya. */
  async actualizar(tx: TxOrganizacion, contactoId: string, datos: DatosDeAcceso): Promise<void> {
    const [acceso] = await tx.select().from(accesosDeContactos).where(eq(accesosDeContactos.contactoId, contactoId));
    if (!acceso) return;
    if (acceso.correo !== datos.correo) {
      await tx.delete(sesionesDelPortal).where(eq(sesionesDelPortal.accesoId, acceso.id));
      await tx.delete(pedidosDeCodigo).where(eq(pedidosDeCodigo.accesoId, acceso.id));
    }
    await conCorreoUnico(tx, () => tx.update(accesosDeContactos).set(datos).where(eq(accesosDeContactos.id, acceso.id)));
  },

  /** Quita el acceso de estos contactos, con sus sesiones y pedidos. Devuelve a cuáles se les quitó. */
  async quitar(tx: TxOrganizacion, contactoIds: readonly string[]): Promise<string[]> {
    if (contactoIds.length === 0) return [];
    const quitados = await tx.delete(accesosDeContactos).where(inArray(accesosDeContactos.contactoId, [...contactoIds])).returning({ contactoId: accesosDeContactos.contactoId });
    return quitados.map((q) => q.contactoId);
  },

  /** Quita el acceso de todos los contactos del cliente (al archivarlo). */
  async quitarDelCliente(tx: TxOrganizacion, clienteId: string): Promise<string[]> {
    const quitados = await tx.delete(accesosDeContactos).where(eq(accesosDeContactos.clienteId, clienteId)).returning({ contactoId: accesosDeContactos.contactoId });
    return quitados.map((q) => q.contactoId);
  },
};

export type AccesosDelPortal = typeof accesosDelPortal;

/** Un correo, un acceso por organización (ADR-0053): la violación de la restricción se dice como conflicto. */
async function conCorreoUnico(tx: TxOrganizacion, escribir: () => Promise<unknown>): Promise<void> {
  try {
    // En un punto de guardado: la transacción de quien llama sigue viva si esto falla.
    await tx.transaction(async () => {
      await escribir();
    });
  } catch (error) {
    if (esViolacionUnica(error, "accesos_un_correo")) throw problema("conflicto", "Otro contacto de esta organización ya tiene acceso al portal con ese correo");
    throw error;
  }
}

/**
 * Se corrigió el nombre del cliente (ADR-0035): sus accesos guardan una copia porque el rol del portal no lee los
 * clientes. Va en la transacción de quien lo corrigió, así el portal nunca muestra el anterior.
 */
export async function renombrarClienteDelPortal(tx: TxOrganizacion, clienteId: string, nombre: string): Promise<void> {
  await tx.update(accesosDeContactos).set({ clienteNombre: nombre }).where(eq(accesosDeContactos.clienteId, clienteId));
}

/** Sesiones del portal vencidas antes de `antesDe` (ADR-0044), en la organización de la transacción. */
export async function podarSesionesDelPortal(tx: TxOrganizacion, antesDe: Date): Promise<number> {
  return (await tx.delete(sesionesDelPortal).where(lt(sesionesDelPortal.expiraEn, antesDe)).returning({ accesoId: sesionesDelPortal.accesoId })).length;
}

export interface CorreosDelPortal {
  /** Manejador del trabajo `portal.correo` (worker). Un pedido reemplazado, vencido o usado ya no envía nada. */
  enviar(datos: Trabajos["portal.correo"], contexto: { ultimoIntento: boolean }): Promise<void>;
}

/**
 * Los correos del portal, en el worker (ADR-0053): el código se calcula aquí, del pedido, y nunca pasa por la cola.
 * La llave de idempotencia es la del pedido o la del acceso: un reintento no envía dos correos distintos.
 */
export function crearCorreosDelPortal({ bd, config, proveedores = {} }: { bd: BaseDeDatos; config: Config; proveedores?: Proveedores }): CorreosDelPortal {
  const secreto = secretoDeCodigos(config);
  return {
    async enviar({ organizacionId, accesoId, tipo, pedidoId }) {
      const correo = proveedores.correo;
      if (!correo) return;
      const acceso = await enOrganizacion(bd, organizacionId, async (tx) => {
        const [fila] = await tx.select().from(accesosDeContactos).where(eq(accesosDeContactos.id, accesoId));
        if (!fila || tipo === "invitacion") return fila;
        const [pedido] = await tx
          .select({ pedidoId: pedidosDeCodigo.pedidoId })
          .from(pedidosDeCodigo)
          .where(and(eq(pedidosDeCodigo.accesoId, accesoId), eq(pedidosDeCodigo.pedidoId, pedidoId ?? ""), gt(pedidosDeCodigo.expiraEn, sql`now()`)));
        return pedido ? fila : undefined;
      });
      if (!acceso) return;
      const mensaje =
        tipo === "codigo"
          ? correoDeCodigo({ organizacion: acceso.organizacionNombre, codigo: derivarCodigo(secreto, pedidoId!) })
          : correoDeInvitacion({
              organizacion: acceso.organizacionNombre,
              nombre: acceso.contactoNombre,
              cliente: acceso.clienteNombre,
              portal: config.PORTAL_URL ?? null,
              ve: { informes: acceso.veInformes, cotizaciones: acceso.veCotizaciones },
            });
      try {
        await correo({
          idempotencia: tipo === "codigo" ? `portal-codigo:${pedidoId}` : `portal-invitacion:${accesoId}`,
          de: config.CORREO_REMITENTE,
          para: acceso.correo,
          responderA: config.CORREO_RESPONDER_A,
          ...mensaje,
          adjunto: null,
          etiquetas: { organizacion: organizacionId, portal: tipo },
        });
      } catch (error) {
        // Una dirección que el proveedor no acepta no mejora reintentando; lo demás se reintenta.
        if (error instanceof RechazoDefinitivo) return;
        throw error;
      }
    },
  };
}
