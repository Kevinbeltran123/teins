import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { contieneTexto } from "../../plataforma/busqueda";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import type { Cuerpo, Respuesta } from "@teins/protocolo";
import { registrar } from "../auditoria";
import type { Identidad } from "../identidad";
import { clientes, contactos, sitios, type FilaContacto } from "./esquema";

export interface Sitio {
  id: string;
  clienteId: string;
  cliente: string;
  nombre: string;
  direccion: string;
  /** El sitio o su cliente están archivados: ya no se les programa (ADR-0035). */
  archivado: boolean;
}

export interface NuevoCliente {
  organizacionId: string;
  nombre: string;
  sitio: { nombre: string; direccion: string };
}

export interface ClienteConSitios {
  id: string;
  nombre: string;
  /** Sus sitios activos. */
  sitios: { id: string; nombre: string; direccion: string }[];
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
  async crear(tx: TxOrganizacion, { organizacionId, nombre, sitio }: NuevoCliente): Promise<{ clienteId: string; sitioId: string }> {
    const clienteId = randomUUID();
    const sitioId = randomUUID();
    await tx.insert(clientes).values({ id: clienteId, organizacionId, nombre: nombre.trim() });
    await tx.insert(sitios).values({ id: sitioId, organizacionId, clienteId, nombre: sitio.nombre.trim(), direccion: sitio.direccion.trim() });
    return { clienteId, sitioId };
  },

  async obtener(tx: TxOrganizacion, id: string): Promise<{ id: string; nombre: string } | undefined> {
    const [fila] = await tx.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes).where(eq(clientes.id, id));
    return fila;
  },

  async listar(tx: TxOrganizacion): Promise<{ id: string; nombre: string }[]> {
    return tx.select({ id: clientes.id, nombre: clientes.nombre }).from(clientes).orderBy(asc(clientes.nombre));
  },

  async agregarSitio(tx: TxOrganizacion, { organizacionId, clienteId, nombre, direccion }: { organizacionId: string; clienteId: string; nombre: string; direccion: string }): Promise<string> {
    const id = randomUUID();
    await tx.insert(sitios).values({ id, organizacionId, clienteId, nombre: nombre.trim(), direccion: direccion.trim() });
    return id;
  },

  /**
   * Clientes con sus sitios activos, por nombre. `ids` limita a esos clientes, archivados o no; sin `ids`, los de la
   * vista: los activos (por omisión) o los archivados (ADR-0035).
   */
  async conSitios(tx: TxOrganizacion, ids?: readonly string[], vista: "activos" | "archivados" = "activos"): Promise<ClienteConSitios[]> {
    const lista = await tx
      .select({ id: clientes.id, nombre: clientes.nombre, archivadoEn: clientes.archivadoEn, archivadoPor: clientes.archivadoPor })
      .from(clientes)
      .where(ids ? inArray(clientes.id, [...ids]) : vista === "activos" ? isNull(clientes.archivadoEn) : isNotNull(clientes.archivadoEn))
      .orderBy(asc(clientes.nombre));
    if (lista.length === 0) return [];
    const deEllos = await tx
      .select({ id: sitios.id, clienteId: sitios.clienteId, nombre: sitios.nombre, direccion: sitios.direccion })
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
      sitios: deEllos.filter((s) => s.clienteId === c.id).map(({ id, nombre, direccion }) => ({ id, nombre, direccion })),
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
        nombre: sitios.nombre,
        direccion: sitios.direccion,
        archivado: sql<boolean>`(${sitios.archivadoEn} is not null or ${clientes.archivadoEn} is not null)`,
      })
      .from(sitios)
      .innerJoin(clientes, eq(clientes.id, sitios.clienteId))
      .where(inArray(sitios.id, [...ids]));
    return new Map(filas.map((f) => [f.id, f]));
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

const SIN_NOMBRE = "[Usuario no disponible]";
const marca = (en: Date | null, por: string | null, nombres: Map<string, string>) => (en ? { en: en.toISOString(), por: { id: por ?? "", nombre: nombres.get(por ?? "") ?? SIN_NOMBRE } } : null);

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
    sitios: susSitios.map((x) => ({ id: x.id, nombre: x.nombre, direccion: x.direccion, archivado: marca(x.archivadoEn, x.archivadoPor, nombres) })),
    editado: marca(cliente.editadoEn, cliente.editadoPor, nombres),
    archivado: marca(cliente.archivadoEn, cliente.archivadoPor, nombres),
    visitasPorHacer: visitas.map((v) => ({
      id: v.id,
      programadaPara: v.programadaPara,
      sitioId: v.sitioId,
      sitio: susSitios.find((x) => x.id === v.sitioId)?.nombre ?? "",
      tecnicos: v.tecnicos.map((t) => nombres.get(t) ?? SIN_NOMBRE),
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
          ? { por: { id: f.whatsappAutorizadoPor, nombre: nombres.get(f.whatsappAutorizadoPor) ?? SIN_NOMBRE }, en: f.whatsappAutorizadoEn.toISOString() }
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

/** Operaciones de oficina sobre clientes, sitios (iteración 7) y contactos (iteración 20). */
export function registrarRutasDeClientes(app: FastifyInstance, bd: BaseDeDatos, identidad: Pick<Identidad, "nombres">, porHacer: VisitasPorHacer): void {
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
          { organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: id, tipoEvento: "contacto_creado", autorId: actor.usuarioId, correlacion, valorNuevo: { id: contactoId, ...auditable(valores) } },
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
            organizacionId: actor.organizacionId,
            agregadoTipo: "cliente",
            agregadoId: id,
            tipoEvento: "contacto_editado",
            autorId: actor.usuarioId,
            correlacion,
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
          { organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: id, tipoEvento: "contacto_quitado", autorId: actor.usuarioId, correlacion, valorAnterior: { id: contactoId, nombre: quitado.nombre } },
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
        const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId: actor.organizacionId, nombre: cuerpo.nombre, sitio: cuerpo.sitio });
        await registrar(tx, [
          { organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: clienteId, tipoEvento: "cliente_creado", autorId: actor.usuarioId, correlacion, valorNuevo: { nombre: cuerpo.nombre, sitio: { id: sitioId, ...cuerpo.sitio } } },
        ]);
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
          { organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: id, tipoEvento: "sitio_agregado", autorId: actor.usuarioId, correlacion, valorNuevo: { id: sitioId, ...cuerpo } },
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
        const anterior = await leerCliente(tx, id);
        if (anterior.archivadoEn) throw problema("estado_invalido", "El cliente está archivado: recupérelo para corregirlo");
        if (anterior.nombre !== cuerpo.nombre) {
          await tx.update(clientes).set({ nombre: cuerpo.nombre, editadoPor: actor.usuarioId, editadoEn: new Date() }).where(eq(clientes.id, id));
          await registrar(tx, [
            { organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: id, tipoEvento: "cliente_editado", autorId: actor.usuarioId, correlacion, valorAnterior: { nombre: anterior.nombre }, valorNuevo: { nombre: cuerpo.nombre } },
          ]);
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
        await registrar(tx, [{ organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: id, tipoEvento: "cliente_archivado", autorId: actor.usuarioId, correlacion, valorNuevo: { nombre: cliente.nombre } }]);
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
        await registrar(tx, [{ organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: id, tipoEvento: "cliente_recuperado", autorId: actor.usuarioId, correlacion, valorNuevo: { nombre: cliente.nombre } }]);
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
        if (sitio.nombre !== cuerpo.nombre || sitio.direccion !== cuerpo.direccion) {
          await tx.update(sitios).set({ nombre: cuerpo.nombre, direccion: cuerpo.direccion }).where(eq(sitios.id, sitioId));
          await tx.update(clientes).set({ editadoPor: actor.usuarioId, editadoEn: new Date() }).where(eq(clientes.id, id));
          await registrar(tx, [
            {
              organizacionId: actor.organizacionId,
              agregadoTipo: "cliente",
              agregadoId: id,
              tipoEvento: "sitio_editado",
              autorId: actor.usuarioId,
              correlacion,
              valorAnterior: { id: sitioId, nombre: sitio.nombre, direccion: sitio.direccion },
              valorNuevo: { id: sitioId, ...cuerpo },
            },
          ]);
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
        await registrar(tx, [{ organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: id, tipoEvento: "sitio_archivado", autorId: actor.usuarioId, correlacion, valorNuevo: { id: sitioId, nombre: sitio.nombre } }]);
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
        await registrar(tx, [{ organizacionId: actor.organizacionId, agregadoTipo: "cliente", agregadoId: id, tipoEvento: "sitio_recuperado", autorId: actor.usuarioId, correlacion, valorNuevo: { id: sitioId, nombre: sitio.nombre } }]);
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
