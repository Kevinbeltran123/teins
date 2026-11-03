import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { contieneTexto } from "../../plataforma/busqueda";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import type { Cuerpo, Respuesta } from "@teins/protocolo";
import { autoria, registrar, type EntradaAuditoria } from "../auditoria";
import { nombreDe, type Identidad } from "../identidad";
import { clientes, contactos, sitios, type FilaContacto } from "./esquema";

export interface Sitio {
  id: string;
  clienteId: string;
  cliente: string;
  nombre: string;
  direccion: string;
  /** Ciudad del sitio y NIT del cliente, para el encabezado del informe (ADR-0051). */
  ciudad: string | null;
  clienteNit: string | null;
  /** El sitio o su cliente están archivados: ya no se les programa (ADR-0035). */
  archivado: boolean;
}

/** Lo que el módulo de visitas lee de un contacto (ADR-0051): a quién preguntar al llegar. */
export interface ContactoDeVisita {
  id: string;
  clienteId: string;
  nombre: string;
  cargo: string;
  /** Sin celular si oficina quitó al contacto: se borran sus datos de contacto y queda el nombre (regla 18). */
  celular: string | null;
  /** Oficina lo quitó: sigue saliendo en lo ya programado, pero no se elige para una visita nueva. */
  quitado: boolean;
}

export interface NuevoCliente {
  organizacionId: string;
  nombre: string;
  nit?: string | undefined;
  sitio: { nombre: string; direccion: string; ciudad?: string | undefined };
}

export interface ClienteConSitios {
  id: string;
  nombre: string;
  nit: string | null;
  /** Sus sitios activos. */
  sitios: { id: string; nombre: string; direccion: string; ciudad: string | null }[];
  /** Contactos que reciben el informe por algún canal. */
  reciben: number;
  archivadoEn: Date | null;
  archivadoPor: string | null;
}

/** Visita sin cancelar desde hoy: la da el módulo de visitas, que depende de este (se inyecta al armar la app). */
export interface VisitaPorHacer {
  id: string;
  programadaPara: string;
  sitioId: string;
  tecnicos: string[];
}
export type VisitasPorHacer = (tx: TxOrganizacion, clienteId: string) => Promise<VisitaPorHacer[]>;

/**
 * Lo que otros módulos hacen en la misma transacción al corregir un cliente o un sitio (la composición lo pasa): los
 * teléfonos vuelven a bajar sus visitas y el portal toma el nombre nuevo.
 */
export interface AlCorregir {
  cliente(tx: TxOrganizacion, datos: { organizacionId: string; clienteId: string; nombre: string }): Promise<void>;
  sitio(tx: TxOrganizacion, datos: { organizacionId: string; clienteId: string; sitioId: string }): Promise<void>;
}

/** Un destinatario listo para enviar: el contacto con el dato del canal (ADR-0028). */
export interface Destinatario {
  contactoId: string;
  nombre: string;
  canal: "correo" | "whatsapp";
  destino: string;
}

const vigente = isNull(contactos.quitadoEn);
/** "Reciben el informe": con un canal y los informes marcados. */
const recibeAlgo = and(vigente, eq(contactos.recibeInformes, true), or(eq(contactos.recibeCorreo, true), eq(contactos.recibeWhatsapp, true)));

/**
 * Interfaz pública del módulo de clientes (soporte, capas simples). Oficina los crea desde su
 * pantalla (iteración 7) o con el comando `crear-cliente`.
 */
export const clientesYSitios = {
  async crear(tx: TxOrganizacion, { organizacionId, nombre, nit, sitio }: NuevoCliente): Promise<{ clienteId: string; sitioId: string }> {
    const clienteId = randomUUID();
    const sitioId = randomUUID();
    await tx.insert(clientes).values({ id: clienteId, organizacionId, nombre: nombre.trim(), nit: nit?.trim() || null });
    await tx.insert(sitios).values({ id: sitioId, organizacionId, clienteId, nombre: sitio.nombre.trim(), direccion: sitio.direccion.trim(), ciudad: sitio.ciudad?.trim() || null });
    return { clienteId, sitioId };
  },

  async obtener(tx: TxOrganizacion, id: string): Promise<{ id: string; nombre: string } | undefined> {
    const [fila] = await tx.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes).where(eq(clientes.id, id));
    return fila;
  },

  /**
   * Toma el cliente para compartir hasta el final de la transacción. Archivarlo, o archivar uno de sus sitios, lo toma
   * para cambiarlo: uno espera al otro, y lo que se lee después ya ve lo que el otro confirmó (ADR-0035).
   */
  async bloquear(tx: TxOrganizacion, id: string): Promise<void> {
    await tx.select({ id: clientes.id }).from(clientes).where(eq(clientes.id, id)).for("share");
  },

  async listar(tx: TxOrganizacion): Promise<{ id: string; nombre: string }[]> {
    return tx.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes).orderBy(asc(clientes.nombre));
  },

  async agregarSitio(tx: TxOrganizacion, { organizacionId, clienteId, nombre, direccion, ciudad }: { organizacionId: string; clienteId: string; nombre: string; direccion: string; ciudad?: string | undefined }): Promise<string> {
    const id = randomUUID();
    await tx.insert(sitios).values({ id, organizacionId, clienteId, nombre: nombre.trim(), direccion: direccion.trim(), ciudad: ciudad?.trim() || null });
    return id;
  },

  /**
   * Clientes con sus sitios activos, por nombre. `ids` limita a esos clientes, archivados o no; sin `ids`, los de la
   * vista: los activos (por omisión) o los archivados (ADR-0035).
   */
  async conSitios(tx: TxOrganizacion, ids?: readonly string[], vista: "activos" | "archivados" = "activos"): Promise<ClienteConSitios[]> {
    const lista = await tx
      .select({ id: clientes.id, nombre: clientes.nombre, nit: clientes.nit, archivadoEn: clientes.archivadoEn, archivadoPor: clientes.archivadoPor })
      .from(clientes)
      .where(ids ? inArray(clientes.id, [...ids]) : vista === "activos" ? isNull(clientes.archivadoEn) : isNotNull(clientes.archivadoEn))
      .orderBy(asc(clientes.nombre));
    if (lista.length === 0) return [];
    const deEllos = await tx
      .select({ id: sitios.id, clienteId: sitios.clienteId, nombre: sitios.nombre, direccion: sitios.direccion, ciudad: sitios.ciudad })
      .from(sitios)
      .where(and(inArray(sitios.clienteId, lista.map((c) => c.id)), isNull(sitios.archivadoEn)))
      .orderBy(asc(sitios.nombre));
    const conteos = await tx
      .select({ clienteId: contactos.clienteId, reciben: sql<number>`count(*)::int` })
      .from(contactos)
      .where(and(inArray(contactos.clienteId, lista.map((c) => c.id)), recibeAlgo))
      .groupBy(contactos.clienteId);
    return lista.map((c) => ({
      ...c,
      sitios: deEllos.filter((s) => s.clienteId === c.id).map(({ id, nombre, direccion, ciudad }) => ({ id, nombre, direccion, ciudad })),
      reciben: conteos.find((x) => x.clienteId === c.id)?.reciben ?? 0,
    }));
  },

  /** Sitios cuyo cliente, nombre o dirección contienen el texto: para buscar en otras listas (iteración 23). */
  async buscarSitios(tx: TxOrganizacion, texto: string): Promise<string[]> {
    const filas = await tx
      .select({ id: sitios.id })
      .from(sitios)
      .innerJoin(clientes, eq(clientes.id, sitios.clienteId))
      .where(or(contieneTexto(clientes.nombre, texto), contieneTexto(sitios.nombre, texto), contieneTexto(sitios.direccion, texto)));
    return filas.map((f) => f.id);
  },

  async sitios(tx: TxOrganizacion, ids: readonly string[]): Promise<Map<string, Sitio>> {
    if (ids.length === 0) return new Map();
    const filas = await tx
      .select({
        id: sitios.id,
        clienteId: sitios.clienteId,
        cliente: clientes.nombre,
        clienteNit: clientes.nit,
        nombre: sitios.nombre,
        direccion: sitios.direccion,
        ciudad: sitios.ciudad,
        archivado: sql<boolean>`(${sitios.archivadoEn} is not null or ${clientes.archivadoEn} is not null)`,
      })
      .from(sitios)
      .innerJoin(clientes, eq(clientes.id, sitios.clienteId))
      .where(inArray(sitios.id, [...ids]));
    return new Map(filas.map((f) => [f.id, f]));
  },

  /** Contactos por id, para la visita (ADR-0051): también los quitados, que conservan el nombre y pierden el celular. */
  async contactos(tx: TxOrganizacion, ids: readonly string[]): Promise<Map<string, ContactoDeVisita>> {
    if (ids.length === 0) return new Map();
    const filas = await tx
      .select({ id: contactos.id, clienteId: contactos.clienteId, nombre: contactos.nombre, cargo: contactos.cargo, celular: contactos.celular, quitadoEn: contactos.quitadoEn })
      .from(contactos)
      .where(inArray(contactos.id, [...ids]));
    return new Map(filas.map(({ quitadoEn, celular, ...c }) => [c.id, { ...c, celular: quitadoEn ? null : celular, quitado: quitadoEn !== null }]));
  },
};

export type ClientesYSitios = typeof clientesYSitios;

/**
 * Contactos del cliente vistos desde los envíos (ADR-0028): a quién y por dónde, y el rebote de un correo.
 */
export const contactosDelCliente = {
  /**
   * Destinatarios por canal. Sin canal pedido, todos los que el contacto recibe. Un contacto de otro
   * cliente, o un canal que no recibe, es un error de quien pide: nunca se envía a medias.
   */
  async paraEnviar(tx: TxOrganizacion, clienteId: string, pedidos: readonly { contactoId: string; canal?: "correo" | "whatsapp" | undefined }[]): Promise<Destinatario[]> {
    if (pedidos.length === 0) return [];
    // Un cliente archivado no recibe envíos (ADR-0035).
    const [cliente] = await tx.select({ archivadoEn: clientes.archivadoEn }).from(clientes).where(eq(clientes.id, clienteId));
    if (cliente?.archivadoEn) throw problema("estado_invalido", "El cliente está archivado: no recibe envíos. Recupérelo para enviarle");
    const filas = await tx
      .select()
      .from(contactos)
      .where(and(eq(contactos.clienteId, clienteId), vigente, inArray(contactos.id, [...new Set(pedidos.map((p) => p.contactoId))])));
    const destinatarios: Destinatario[] = [];
    for (const pedido of pedidos) {
      const c = filas.find((f) => f.id === pedido.contactoId);
      if (!c) throw problema("entrada_invalida", "Un destinatario no es contacto de este cliente");
      const canales = canalesDe(c).filter((canal) => !pedido.canal || canal === pedido.canal);
      if (canales.length === 0) throw problema("entrada_invalida", `${c.nombre} no recibe el informe por ${pedido.canal === "whatsapp" ? "WhatsApp" : pedido.canal ?? "ningún canal"}`);
      for (const canal of canales) {
        if (destinatarios.some((d) => d.contactoId === c.id && d.canal === canal)) continue;
        destinatarios.push({ contactoId: c.id, nombre: c.nombre, canal, destino: canal === "correo" ? c.correo! : c.celular! });
      }
    }
    return destinatarios;
  },

  /**
   * Por qué canales recibe hoy cada uno de estos contactos; uno que oficina quitó no aparece, ni los de un cliente
   * archivado, que no recibe envíos hasta recuperarlo (iteración 42).
   */
  async canales(tx: TxOrganizacion, contactoIds: readonly string[]): Promise<Map<string, ("correo" | "whatsapp")[]>> {
    if (contactoIds.length === 0) return new Map();
    const filas = await tx
      .select({ contacto: contactos })
      .from(contactos)
      .innerJoin(clientes, eq(clientes.id, contactos.clienteId))
      .where(and(inArray(contactos.id, [...contactoIds]), vigente, isNull(clientes.archivadoEn)));
    return new Map(filas.map(({ contacto }) => [contacto.id, canalesDe(contacto)]));
  },

  /** Si el contacto sigue recibiendo por ese canal en ese destino: al salir, un envío en cola lo confirma. */
  async sigueRecibiendo(tx: TxOrganizacion, contactoId: string, canal: "correo" | "whatsapp", destino: string): Promise<boolean> {
    // Archivar el cliente detiene lo que todavía esperaba salir (ADR-0035).
    const [fila] = await tx
      .select({ contacto: contactos })
      .from(contactos)
      .innerJoin(clientes, eq(clientes.id, contactos.clienteId))
      .where(and(eq(contactos.id, contactoId), vigente, isNull(clientes.archivadoEn)));
    const c = fila?.contacto;
    return !!c && canalesDe(c).includes(canal) && (canal === "correo" ? c.correo : c.celular) === destino;
  },

  /** El correo rebotó: queda marcado mientras la dirección siga siendo la misma. */
  async marcarRebote(tx: TxOrganizacion, contactoId: string, correo: string, motivo: string): Promise<void> {
    await tx
      .update(contactos)
      .set({ correoRebotadoEn: new Date(), correoRebotadoMotivo: motivo.slice(0, 300) })
      .where(and(eq(contactos.id, contactoId), eq(contactos.correo, correo)));
  },
};

export type ContactosDelCliente = typeof contactosDelCliente;

function canalesDe(c: FilaContacto): ("correo" | "whatsapp")[] {
  return [
    ...(c.recibeCorreo && c.correo ? (["correo"] as const) : []),
    // Sin autorización registrada no sale por WhatsApp, aunque la marca haya quedado (ADR-0028, parte 5).
    ...(c.recibeWhatsapp && c.celular && c.whatsappAutorizadoEn ? (["whatsapp"] as const) : []),
  ];
}

type DetalleCliente = Respuesta<"obtenerCliente">;

/** Lo que el detalle necesita de otros módulos: los nombres de las personas y las visitas por hacer. */
interface Dependencias {
  identidad: Pick<Identidad, "nombres">;
  porHacer: VisitasPorHacer;
}

const marca = (en: Date | null, por: string | null, nombres: Map<string, string>) => (en ? { en: en.toISOString(), por: { id: por ?? "", nombre: nombreDe(nombres, por) } } : null);

async function detalleDe(tx: TxOrganizacion, deps: Dependencias, organizacionId: string, id: string): Promise<DetalleCliente> {
  const [cliente] = await tx.select().from(clientes).where(eq(clientes.id, id));
  if (!cliente) throw problema("no_encontrado", "El cliente no existe");
  const susSitios = await tx.select().from(sitios).where(eq(sitios.clienteId, id)).orderBy(asc(sitios.nombre));
  const filas = await tx.select().from(contactos).where(and(eq(contactos.clienteId, id), vigente)).orderBy(asc(contactos.nombre));
  const visitas = await deps.porHacer(tx, id);
  const personas = [
    ...filas.flatMap((f) => (f.whatsappAutorizadoPor ? [f.whatsappAutorizadoPor] : [])),
    ...[cliente.editadoPor, cliente.archivadoPor, ...susSitios.map((x) => x.archivadoPor)].flatMap((p) => (p ? [p] : [])),
    ...visitas.flatMap((v) => v.tecnicos),
  ];
  const nombres = await deps.identidad.nombres(organizacionId, [...new Set(personas)], tx);
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    nit: cliente.nit,
    sitios: susSitios.map((x) => ({ id: x.id, nombre: x.nombre, direccion: x.direccion, ciudad: x.ciudad, archivado: marca(x.archivadoEn, x.archivadoPor, nombres) })),
    editado: marca(cliente.editadoEn, cliente.editadoPor, nombres),
    archivado: marca(cliente.archivadoEn, cliente.archivadoPor, nombres),
    visitasPorHacer: visitas.map((v) => ({
      id: v.id,
      programadaPara: v.programadaPara,
      sitioId: v.sitioId,
      sitio: susSitios.find((x) => x.id === v.sitioId)?.nombre ?? "",
      tecnicos: v.tecnicos.map((t) => nombreDe(nombres, t)),
    })),
    contactos: filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      cargo: f.cargo,
      correo: f.correo,
      celular: f.celular,
      recibeCorreo: f.recibeCorreo,
      recibeWhatsapp: f.recibeWhatsapp,
      recibeInformes: f.recibeInformes,
      recibeCotizaciones: f.recibeCotizaciones,
      whatsappAutorizado:
        f.whatsappAutorizadoPor && f.whatsappAutorizadoEn
          ? { por: { id: f.whatsappAutorizadoPor, nombre: nombreDe(nombres, f.whatsappAutorizadoPor) }, en: f.whatsappAutorizadoEn.toISOString() }
          : null,
      correoRebotado: f.correoRebotadoEn ? { en: f.correoRebotadoEn.toISOString(), motivo: f.correoRebotadoMotivo ?? "" } : null,
    })),
  };
}

/** Un cliente de la lista, con quién lo archivó. */
async function comoClientes(tx: TxOrganizacion, identidad: Pick<Identidad, "nombres">, organizacionId: string, lista: ClienteConSitios[]) {
  const nombres = await identidad.nombres(organizacionId, [...new Set(lista.flatMap((c) => (c.archivadoPor ? [c.archivadoPor] : [])))], tx);
  return lista.map(({ archivadoEn, archivadoPor, ...c }) => ({ ...c, archivado: marca(archivadoEn, archivadoPor, nombres) }));
}

/**
 * Lo que se guarda de un contacto. La autorización de WhatsApp se registra con quien la confirma; se
 * conserva mientras el celular no cambie. Cambiar el correo borra su rebote.
 */
function valoresDeContacto(datos: Cuerpo<"crearContacto">, usuarioId: string, anterior?: FilaContacto) {
  const mismoCelular = anterior !== undefined && anterior.celular === datos.celular;
  const autorizadoAntes = mismoCelular && anterior.whatsappAutorizadoEn !== null;
  const autorizado = datos.celular !== null && datos.whatsappAutorizado;
  return {
    nombre: datos.nombre,
    cargo: datos.cargo,
    correo: datos.correo,
    celular: datos.celular,
    recibeCorreo: datos.recibeCorreo,
    recibeWhatsapp: datos.recibeWhatsapp,
    recibeInformes: datos.recibeInformes,
    recibeCotizaciones: datos.recibeCotizaciones,
    whatsappAutorizadoPor: autorizado ? (autorizadoAntes ? anterior.whatsappAutorizadoPor : usuarioId) : null,
    whatsappAutorizadoEn: autorizado ? (autorizadoAntes ? anterior.whatsappAutorizadoEn : new Date()) : null,
    ...(anterior && anterior.correo === datos.correo ? {} : { correoRebotadoEn: null, correoRebotadoMotivo: null }),
  };
}

/**
 * Lo que se audita de un contacto: con qué datos y canales quedó, y quién registró la autorización. La auditoría
 * no se borra (ADR-0008): el correo y el celular van enmascarados, así quitar el contacto sí borra sus datos
 * (regla 18) y el registro sigue mostrando cuál cambió.
 */
const auditable = (v: Pick<FilaContacto, "nombre" | "cargo" | "correo" | "celular" | "recibeCorreo" | "recibeWhatsapp" | "recibeInformes" | "recibeCotizaciones" | "whatsappAutorizadoPor">) => ({
  nombre: v.nombre,
  cargo: v.cargo,
  correo: v.correo && `${v.correo.slice(0, 1)}•••${v.correo.slice(v.correo.lastIndexOf("@"))}`,
  celular: v.celular && `•••${v.celular.slice(-4)}`,
  recibeCorreo: v.recibeCorreo,
  recibeWhatsapp: v.recibeWhatsapp,
  recibeInformes: v.recibeInformes,
  recibeCotizaciones: v.recibeCotizaciones,
  whatsappAutorizadoPor: v.whatsappAutorizadoPor,
});

export interface Clientes {
  registrarRutas(app: FastifyInstance): void;
}

/** Operaciones de oficina sobre clientes, sitios (iteración 7) y contactos (iteración 20). */
export function crearClientes(deps: Dependencias & { bd: BaseDeDatos; alCorregir: AlCorregir }): Clientes {
  return { registrarRutas: (app) => registrarRutas(app, deps) };
}

function registrarRutas(app: FastifyInstance, { bd, identidad, porHacer, alCorregir }: Dependencias & { bd: BaseDeDatos; alCorregir: AlCorregir }): void {
  const deps: Dependencias = { identidad, porHacer };
  registrarOperacion(app, "obtenerCliente", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id }, actor }) => enOrganizacion(bd, actor.organizacionId, (tx) => detalleDe(tx, deps, actor.organizacionId, id)),
  });

  registrarOperacion(app, "crearContacto", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        if (!(await clientesYSitios.obtener(tx, id))) throw problema("no_encontrado", "El cliente no existe");
        const contactoId = randomUUID();
        const valores = valoresDeContacto(cuerpo, actor.usuarioId);
        await tx.insert(contactos).values({ id: contactoId, organizacionId: actor.organizacionId, clienteId: id, ...valores });
        await registrar(tx, [
          { ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: id, tipoEvento: "contacto_creado", valorNuevo: { id: contactoId, ...auditable(valores) } },
        ]);
        return detalleDe(tx, deps, actor.organizacionId, id);
      }),
  });

  registrarOperacion(app, "editarContacto", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id, contactoId }, cuerpo, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        const [anterior] = await tx.select().from(contactos).where(and(eq(contactos.id, contactoId), eq(contactos.clienteId, id), vigente));
        if (!anterior) throw problema("no_encontrado", "El contacto no existe");
        const valores = valoresDeContacto(cuerpo, actor.usuarioId, anterior);
        await tx.update(contactos).set(valores).where(eq(contactos.id, contactoId));
        await registrar(tx, [
          {
            ...autoria(actor, correlacion),
            agregadoTipo: "cliente",
            agregadoId: id,
            tipoEvento: "contacto_editado",
            valorAnterior: { id: contactoId, ...auditable(anterior) },
            valorNuevo: { id: contactoId, ...auditable(valores) },
          },
        ]);
        return detalleDe(tx, deps, actor.organizacionId, id);
      }),
  });

  registrarOperacion(app, "quitarContacto", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id, contactoId }, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        // La aplicación no borra filas (ADR-0009): se borran sus datos de contacto (regla 18) y queda el nombre.
        // Los envíos anteriores guardan su propia copia del nombre y el destino.
        const [quitado] = await tx
          .update(contactos)
          .set({
            quitadoEn: new Date(),
            cargo: "",
            correo: null,
            celular: null,
            recibeCorreo: false,
            recibeWhatsapp: false,
            whatsappAutorizadoPor: null,
            whatsappAutorizadoEn: null,
            correoRebotadoEn: null,
            correoRebotadoMotivo: null,
          })
          .where(and(eq(contactos.id, contactoId), eq(contactos.clienteId, id), vigente))
          .returning({ nombre: contactos.nombre });
        if (!quitado) throw problema("no_encontrado", "El contacto no existe");
        await registrar(tx, [
          { ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: id, tipoEvento: "contacto_quitado", valorAnterior: { id: contactoId, nombre: quitado.nombre } },
        ]);
        return detalleDe(tx, deps, actor.organizacionId, id);
      }),
  });

  registrarOperacion(app, "listarClientes", {
    politica: politicas.oficina,
    manejar: async ({ consulta, actor }) => ({
      clientes: await enOrganizacion(bd, actor.organizacionId, async (tx) => comoClientes(tx, identidad, actor.organizacionId, await clientesYSitios.conSitios(tx, undefined, consulta.vista))),
    }),
  });

  registrarOperacion(app, "crearCliente", {
    politica: politicas.oficina,
    manejar: async ({ cuerpo, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId: actor.organizacionId, nombre: cuerpo.nombre, nit: cuerpo.nit, sitio: cuerpo.sitio });
        const eventos: EntradaAuditoria[] = [
          { ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: clienteId, tipoEvento: "cliente_creado", valorNuevo: { nombre: cuerpo.nombre, ...(cuerpo.nit ? { nit: cuerpo.nit } : {}), sitio: { id: sitioId, ...cuerpo.sitio } } },
        ];
        // El contacto principal, en la misma transacción: o queda el cliente con su contacto, o nada (iteración 29).
        if (cuerpo.contacto) {
          const contactoId = randomUUID();
          const valores = valoresDeContacto(cuerpo.contacto, actor.usuarioId);
          await tx.insert(contactos).values({ id: contactoId, organizacionId: actor.organizacionId, clienteId, ...valores });
          eventos.push({ ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: clienteId, tipoEvento: "contacto_creado", valorNuevo: { id: contactoId, ...auditable(valores) } });
        }
        await registrar(tx, eventos);
        return (await comoClientes(tx, identidad, actor.organizacionId, await clientesYSitios.conSitios(tx, [clienteId])))[0]!;
      }),
  });

  registrarOperacion(app, "agregarSitio", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        const cliente = await leerCliente(tx, id);
        if (cliente.archivadoEn) throw problema("estado_invalido", "El cliente está archivado: recupérelo para agregarle un sitio");
        const sitioId = await clientesYSitios.agregarSitio(tx, { organizacionId: actor.organizacionId, clienteId: id, ...cuerpo });
        await registrar(tx, [
          { ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: id, tipoEvento: "sitio_agregado", valorNuevo: { id: sitioId, ...cuerpo } },
        ]);
        return (await comoClientes(tx, identidad, actor.organizacionId, await clientesYSitios.conSitios(tx, [id])))[0]!;
      }),
  });

  /** Correcciones de clientes y sitios (ADR-0035): con registro, sin borrar; lo publicado conserva su copia. */
  const visitasDeHoy = (tx: TxOrganizacion, id: string, sitioId?: string) => porHacer(tx, id).then((v) => v.filter((x) => !sitioId || x.sitioId === sitioId));

  registrarOperacion(app, "editarCliente", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        // Tomado, como al archivar o corregir un sitio: dos correcciones a la vez no registran el mismo valor anterior.
        const anterior = await leerCliente(tx, id, true);
        if (anterior.archivadoEn) throw problema("estado_invalido", "El cliente está archivado: recupérelo para corregirlo");
        // Sin `nit` no se toca; con null se quita (ADR-0051).
        const nit = cuerpo.nit === undefined ? anterior.nit : cuerpo.nit;
        if (anterior.nombre !== cuerpo.nombre || anterior.nit !== nit) {
          await tx.update(clientes).set({ nombre: cuerpo.nombre, nit, editadoPor: actor.usuarioId, editadoEn: new Date() }).where(eq(clientes.id, id));
          await registrar(tx, [
            { ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: id, tipoEvento: "cliente_editado", valorAnterior: { nombre: anterior.nombre, nit: anterior.nit }, valorNuevo: { nombre: cuerpo.nombre, nit } },
          ]);
          await alCorregir.cliente(tx, { organizacionId: actor.organizacionId, clienteId: id, nombre: cuerpo.nombre });
        }
        return detalleDe(tx, deps, actor.organizacionId, id);
      }),
  });

  registrarOperacion(app, "archivarCliente", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id }, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        const cliente = await leerCliente(tx, id, true);
        if (cliente.archivadoEn) throw problema("estado_invalido", "El cliente ya estaba archivado");
        const pendientes = await visitasDeHoy(tx, id);
        if (pendientes.length > 0) throw problema("estado_invalido", `Tiene ${pendientes.length === 1 ? "una visita" : `${pendientes.length} visitas`} por hacer: cancélelas o reprográmelas antes de archivarlo`);
        await tx.update(clientes).set({ archivadoPor: actor.usuarioId, archivadoEn: new Date() }).where(eq(clientes.id, id));
        await registrar(tx, [{ ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: id, tipoEvento: "cliente_archivado", valorNuevo: { nombre: cliente.nombre } }]);
        return detalleDe(tx, deps, actor.organizacionId, id);
      }),
  });

  registrarOperacion(app, "recuperarCliente", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id }, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        const cliente = await leerCliente(tx, id, true);
        if (!cliente.archivadoEn) throw problema("estado_invalido", "El cliente no estaba archivado");
        await tx.update(clientes).set({ archivadoPor: null, archivadoEn: null }).where(eq(clientes.id, id));
        await registrar(tx, [{ ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: id, tipoEvento: "cliente_recuperado", valorNuevo: { nombre: cliente.nombre } }]);
        return detalleDe(tx, deps, actor.organizacionId, id);
      }),
  });

  /** El sitio, con su cliente bloqueado: dos correcciones del mismo cliente no se cruzan. */
  async function leerSitio(tx: TxOrganizacion, id: string, sitioId: string) {
    const cliente = await leerCliente(tx, id, true);
    const [sitio] = await tx.select().from(sitios).where(and(eq(sitios.id, sitioId), eq(sitios.clienteId, id)));
    if (!sitio) throw problema("no_encontrado", "El sitio no existe");
    return { cliente, sitio };
  }

  registrarOperacion(app, "editarSitio", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id, sitioId }, cuerpo, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        const { cliente, sitio } = await leerSitio(tx, id, sitioId);
        if (cliente.archivadoEn || sitio.archivadoEn) throw problema("estado_invalido", "Está archivado: recupérelo para corregirlo");
        // Sin `ciudad` no se toca; con null se quita (ADR-0051).
        const ciudad = cuerpo.ciudad === undefined ? sitio.ciudad : cuerpo.ciudad;
        if (sitio.nombre !== cuerpo.nombre || sitio.direccion !== cuerpo.direccion || sitio.ciudad !== ciudad) {
          await tx.update(sitios).set({ nombre: cuerpo.nombre, direccion: cuerpo.direccion, ciudad }).where(eq(sitios.id, sitioId));
          await tx.update(clientes).set({ editadoPor: actor.usuarioId, editadoEn: new Date() }).where(eq(clientes.id, id));
          await registrar(tx, [
            {
              ...autoria(actor, correlacion),
              agregadoTipo: "cliente",
              agregadoId: id,
              tipoEvento: "sitio_editado",
              valorAnterior: { id: sitioId, nombre: sitio.nombre, direccion: sitio.direccion, ciudad: sitio.ciudad },
              valorNuevo: { id: sitioId, nombre: cuerpo.nombre, direccion: cuerpo.direccion, ciudad },
            },
          ]);
          await alCorregir.sitio(tx, { organizacionId: actor.organizacionId, clienteId: id, sitioId });
        }
        return detalleDe(tx, deps, actor.organizacionId, id);
      }),
  });

  registrarOperacion(app, "archivarSitio", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id, sitioId }, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        const { sitio } = await leerSitio(tx, id, sitioId);
        if (sitio.archivadoEn) throw problema("estado_invalido", "El sitio ya estaba archivado");
        if ((await visitasDeHoy(tx, id, sitioId)).length > 0) throw problema("estado_invalido", "El sitio tiene visitas por hacer: cancélelas o reprográmelas antes de archivarlo");
        const [{ activos } = { activos: 0 }] = await tx
          .select({ activos: sql<number>`count(*)::int` })
          .from(sitios)
          .where(and(eq(sitios.clienteId, id), isNull(sitios.archivadoEn)));
        // Sin un sitio activo, al cliente no se le podría programar nada: para eso se archiva el cliente.
        if (activos <= 1) throw problema("estado_invalido", "Es el único sitio activo del cliente: archive el cliente en su lugar");
        await tx.update(sitios).set({ archivadoPor: actor.usuarioId, archivadoEn: new Date() }).where(eq(sitios.id, sitioId));
        await registrar(tx, [{ ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: id, tipoEvento: "sitio_archivado", valorNuevo: { id: sitioId, nombre: sitio.nombre } }]);
        return detalleDe(tx, deps, actor.organizacionId, id);
      }),
  });

  registrarOperacion(app, "recuperarSitio", {
    politica: politicas.oficina,
    manejar: async ({ parametros: { id, sitioId }, actor, correlacion }) =>
      enOrganizacion(bd, actor.organizacionId, async (tx) => {
        const { sitio } = await leerSitio(tx, id, sitioId);
        if (!sitio.archivadoEn) throw problema("estado_invalido", "El sitio no estaba archivado");
        await tx.update(sitios).set({ archivadoPor: null, archivadoEn: null }).where(eq(sitios.id, sitioId));
        await registrar(tx, [{ ...autoria(actor, correlacion), agregadoTipo: "cliente", agregadoId: id, tipoEvento: "sitio_recuperado", valorNuevo: { id: sitioId, nombre: sitio.nombre } }]);
        return detalleDe(tx, deps, actor.organizacionId, id);
      }),
  });
}

/** El cliente, o "no existe". Con `bloquear`, su fila queda tomada hasta el final de la transacción. */
async function leerCliente(tx: TxOrganizacion, id: string, bloquear = false) {
  const consulta = tx.select().from(clientes).where(eq(clientes.id, id));
  const [cliente] = bloquear ? await consulta.for("update") : await consulta;
  if (!cliente) throw problema("no_encontrado", "El cliente no existe");
  return cliente;
}
