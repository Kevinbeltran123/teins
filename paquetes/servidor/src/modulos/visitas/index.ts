import { randomUUID } from "node:crypto";
import { and, arrayContains, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { autoria, registrar } from "../auditoria";
import { avisar as avisarPush } from "../avisos";
import { registrarCambios, type Cambio } from "../cambios";
import type { ClientesYSitios } from "../clientes";
import type { Formatos } from "../formatos";
import { nombreDe, type Identidad } from "../identidad";
import { consecutivosDeOrden, visitas } from "./esquema";
import { fechaEnColombia, numeroDeOrden, ZONA_COLOMBIA } from "@teins/dominio";

/** Quien pidió la visita (ADR-0051): el técnico pregunta por esta persona al llegar. */
export interface Solicitante {
  id: string;
  nombre: string;
  cargo: string;
  celular: string | null;
}

export interface VisitaAsignada {
  id: string;
  /** `nit` y `ciudad`: los del encabezado del informe (ADR-0051). */
  cliente: { nombre: string; nit: string | null };
  sitio: { nombre: string; direccion: string; ciudad: string | null };
  motivo: string;
  /** El servicio (ADR-0057): la clave del formato; null en las anteriores. */
  formato: string | null;
  programadaPara: string;
  /** Número de orden de servicio y referencia del cliente (ADR-0051); las visitas anteriores no tienen número. */
  ordenDeServicio: number | null;
  referencia: string | null;
  solicitante: Solicitante | null;
  /** Horario (ADR-0037): "HH:MM"; sin inicio, todo el día; con inicio y sin fin, hasta que la terminen. */
  horaInicio: string | null;
  horaFin: string | null;
  terminada: { en: string } | null;
}

/** El horario de una visita (ADR-0037). */
export interface Horario {
  horaInicio: string | null;
  horaFin: string | null;
}

interface Contexto {
  organizacionId: string;
  autorId: string;
  correlacion: string;
}

export interface NuevaVisita extends Contexto {
  clienteId: string;
  sitioId: string;
  motivo: string;
  /** El servicio (ADR-0057); `motivo` lleva su nombre. Sin él, el teléfono ofrece todos los formatos. */
  formato?: string | null | undefined;
  /** AAAA-MM-DD */
  programadaPara: string;
  tecnicos: readonly string[];
  horaInicio?: string | null | undefined;
  horaFin?: string | null | undefined;
  /** Un contacto del mismo cliente (ADR-0051). */
  solicitanteContactoId?: string | null | undefined;
  /** La referencia del cliente (el «Ticket No.»). */
  referenciaCliente?: string | null | undefined;
}

/** Avance de una visita según sus levantamientos; lo aporta el módulo de levantamientos. */
export type ConteosPorVisita = (tx: TxOrganizacion, visitaIds: readonly string[]) => Promise<Map<string, { enviados: number; enRevision: number; revisados: number }>>;

export type Vista = "proximas" | "anteriores" | "canceladas";

export interface VisitaPorHacer {
  id: string;
  programadaPara: string;
  sitioId: string;
  tecnicos: string[];
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Las vistas de historia muestran las más recientes; la agenda (próximas) va completa. */
const LIMITE_HISTORIA = 100;

export interface Visitas {
  /** Programa la visita y le asigna el siguiente número de orden de servicio, en la misma transacción (ADR-0051). */
  crear(tx: TxOrganizacion, datos: NuevaVisita): Promise<string>;
  /**
   * Fija el último número de orden de la organización, para seguir desde el de TEINS (ADR-0051). Nunca baja ni repite:
   * un número menor o igual al último, o a cualquiera ya asignado, se rechaza.
   */
  fijarConsecutivoDeOrdenes(tx: TxOrganizacion, organizacionId: string, ultimo: number): Promise<void>;
  /**
   * Reemplaza los técnicos asignados. Regla 17: no invalida levantamientos ya iniciados. Con `version`,
   * rechaza si otra persona cambió la visita desde que se abrió (QA-25).
   */
  reasignar(tx: TxOrganizacion, datos: Contexto & { visitaId: string; tecnicos: readonly string[]; version?: number }): Promise<void>;
  /**
   * Sin `solicitanteContactoId`, `referenciaCliente`, `motivo` o `formato` se conservan; con null se quitan los dos primeros.
   * El número de orden no cambia.
   */
  reprogramar(
    tx: TxOrganizacion,
    datos: Contexto & { visitaId: string; version: number; programadaPara: string; motivo?: string; formato?: string; horaInicio?: string | null; horaFin?: string | null; solicitanteContactoId?: string | null; referenciaCliente?: string | null },
  ): Promise<void>;
  /** Cancela: sale de los teléfonos; lo empezado se conserva y se puede enviar (regla 17). */
  cancelar(tx: TxOrganizacion, datos: Contexto & { visitaId: string; version: number; motivo: string }): Promise<void>;
  existe(tx: TxOrganizacion, id: string): Promise<boolean>;
  /**
   * Visitas por hacer de un cliente: mientras haya, ni él ni esos sitios se archivan (ADR-0035). Sin cancelar, terminar
   * ni cerrar, desde `hoy`, y sin ningún levantamiento recibido, salvo las de otro día (ADR-0042).
   */
  porHacer(tx: TxOrganizacion, clienteId: string, hoy: string, conteos: ConteosPorVisita): Promise<VisitaPorHacer[]>;
  /** Visitas que siguen asignadas al técnico y sin cancelar; las demás no aparecen. */
  asignadas(tx: TxOrganizacion, ids: readonly string[], tecnicoId: string): Promise<Map<string, VisitaAsignada>>;
  /** Cuáles de estas visitas están canceladas: la bajada le dice al teléfono por qué salen. */
  canceladas(tx: TxOrganizacion, ids: readonly string[]): Promise<Set<string>>;
  /**
   * Visitas atendidas del técnico que se cierran (ADR-0041): asignadas, sin cancelar ni cerrar, de un día anterior a
   * `hoy`, y terminadas o con algún levantamiento recibido. Lo atrasado sin atender no: oficina lo decide.
   */
  porCerrar(tx: TxOrganizacion, tecnicoId: string, hoy: string, conteos: ConteosPorVisita): Promise<string[]>;
  /**
   * Cierra estas visitas (ADR-0041): salen de los teléfonos de sus técnicos y no vuelven a bajar. Solo las que siguen
   * sin cancelar y de un día anterior a `hoy`: oficina pudo reprogramarlas o cancelarlas después de `porCerrar`.
   */
  cerrar(tx: TxOrganizacion, organizacionId: string, ids: readonly string[], hoy: string): Promise<void>;
  /**
   * Se corrigió el nombre del cliente o el nombre o la dirección de un sitio (ADR-0035): las visitas que siguen en los
   * teléfonos, sin cancelar ni cerrar, vuelven a bajar a sus técnicos con el dato nuevo. Sin `sitioId`, las del cliente.
   */
  avisarCorreccion(tx: TxOrganizacion, datos: { organizacionId: string; clienteId: string; sitioId?: string }): Promise<void>;
  /** Cuáles de estas visitas están cerradas: salen del teléfono como atendidas. */
  cerradas(tx: TxOrganizacion, ids: readonly string[]): Promise<Set<string>>;
  clienteDe(tx: TxOrganizacion, visitaId: string): Promise<string | undefined>;
  /** Cliente, sitio, motivo y fecha de cada visita, sin importar a quién esté asignada (oficina). */
  resumenes(tx: TxOrganizacion, ids: readonly string[]): Promise<Map<string, VisitaAsignada>>;
  /** Visitas cuyo cliente o sitio contienen el texto: para buscar levantamientos por cliente (iteración 23). */
  coincidentes(tx: TxOrganizacion, texto: string): Promise<string[]>;
  registrarRutas(app: FastifyInstance, deps: { bd: BaseDeDatos; identidad: Pick<Identidad, "nombres" | "tecnicosActivos">; conteos: ConteosPorVisita }): void;
}

/** "09:00:00" (Postgres) o "09:00" → "09:00". */
const aHoraCorta = (hora: string | null) => (hora ? hora.slice(0, 5) : null);
/** El solicitante de una visita como lo ven oficina y el teléfono (ADR-0051), o null si no tiene. */
const solicitanteDe = (contactoId: string | null, contactos: ReadonlyMap<string, { id: string; nombre: string; cargo: string; celular: string | null }>): Solicitante | null => {
  const c = contactoId ? contactos.get(contactoId) : undefined;
  return c ? { id: c.id, nombre: c.nombre, cargo: c.cargo, celular: c.celular } : null;
};
const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
/** Minuto del día en Colombia de un momento, o null si cae en otro día que `fecha`. */
function minutoDelDia(momento: Date, fecha: string): number | null {
  if (fechaEnColombia(momento) !== fecha) return null;
  const [h, m] = momento.toLocaleTimeString("en-GB", { timeZone: ZONA_COLOMBIA, hour: "2-digit", minute: "2-digit", hour12: false }).split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * La visita como la pide el encabezado del informe (ADR-0051), solo con lo que hay: lo que falta no se escribe y el
 * informe lo dice con un marcador. El número de orden va ya escrito, para que una versión publicada no cambie si cambia
 * cómo se escribe. La usan el informe y la revisión, que muestra el capítulo como saldrá.
 */
export const visitaDelInforme = (v: VisitaAsignada) => ({
  cliente: v.cliente.nombre,
  sitio: v.sitio.nombre,
  direccion: v.sitio.direccion,
  motivo: v.motivo,
  programadaPara: v.programadaPara,
  ...(v.cliente.nit ? { nit: v.cliente.nit } : {}),
  ...(v.sitio.ciudad ? { ciudad: v.sitio.ciudad } : {}),
  ...(v.solicitante ? { solicitante: { nombre: v.solicitante.nombre, ...(v.solicitante.celular ? { telefono: v.solicitante.celular } : {}) } } : {}),
  ...(v.ordenDeServicio ? { ordenDeServicio: numeroDeOrden(v.ordenDeServicio) } : {}),
  ...(v.referencia ? { referencia: v.referencia } : {}),
});

/**
 * Lo que ocupa una visita ese día, en minutos [desde, hasta) (ADR-0037): todo el día sin hora de inicio; su rango
 * con fin; desde el inicio hasta que la terminen, sin fin. Una terminada antes del final del día libera desde ahí.
 */
export function intervaloDe(v: { programadaPara: string; horaInicio: string | null; horaFin: string | null; terminadaEn: Date | null }): [number, number] {
  if (!v.horaInicio) return [0, 24 * 60];
  const desde = minutos(v.horaInicio);
  if (v.horaFin) return [desde, minutos(v.horaFin)];
  const terminada = v.terminadaEn ? minutoDelDia(v.terminadaEn, v.programadaPara) : null;
  return [desde, terminada === null ? 24 * 60 : Math.max(desde, terminada)];
}
const seCruzan = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

const validarFecha = (programadaPara: string) => {
  if (!FECHA.test(programadaPara) || Number.isNaN(Date.parse(programadaPara))) throw problema("entrada_invalida", "Fecha inválida: use AAAA-MM-DD");
};

/** Interfaz pública del módulo de visitas (soporte, capas simples). */
export function crearVisitas(clientes: ClientesYSitios, formatos?: Pick<Formatos, "vigentes">): Visitas {
  const avisar = (organizacionId: string, visitaId: string, tecnicos: Iterable<string>, operacion: Cambio["operacion"]): Cambio[] =>
    [...tecnicos].map((usuarioId) => ({ organizacionId, usuarioId, entidad: "visita", entidadId: visitaId, operacion }));

  /** Bloquea la visita para cambiarla: debe existir, no estar cancelada y, si se da, seguir en la versión que se abrió. */
  async function paraCambiar(tx: TxOrganizacion, visitaId: string, version?: number) {
    const [actual] = await tx.select().from(visitas).where(eq(visitas.id, visitaId)).for("update");
    if (!actual) throw problema("no_encontrado", "La visita no existe");
    if (actual.canceladaEn) throw problema("estado_invalido", "La visita está cancelada");
    if (version !== undefined && actual.version !== version) throw problema("conflicto_de_version", "Otra persona cambió esta visita mientras usted la tenía abierta", { versionActual: actual.version });
    return actual;
  }

  /** El solicitante es un contacto del mismo cliente y no un contacto que oficina ya quitó (ADR-0051). */
  async function exigirSolicitante(tx: TxOrganizacion, clienteId: string, contactoId: string | null) {
    if (contactoId === null) return;
    const contacto = (await clientes.contactos(tx, [contactoId])).get(contactoId);
    if (!contacto || contacto.clienteId !== clienteId) throw problema("entrada_invalida", "El solicitante no es contacto de este cliente");
    if (contacto.quitado) throw problema("entrada_invalida", "El solicitante ya no es contacto del cliente");
  }

  const publica: Visitas = {
    async crear(tx, { organizacionId, autorId, correlacion, clienteId, sitioId, motivo, formato = null, programadaPara, tecnicos, horaInicio = null, horaFin = null, solicitanteContactoId = null, referenciaCliente = null }) {
      validarFecha(programadaPara);
      if (!motivo.trim()) throw problema("entrada_invalida", "La visita necesita un motivo");
      const referencia = referenciaCliente?.trim() || null;
      // Con el cliente tomado, quien archiva el cliente o el sitio al mismo tiempo espera a esta visita y la ve, o esta
      // espera al archivo y lo ve en la lectura siguiente: nunca queda una visita por hacer en algo archivado.
      await clientes.bloquear(tx, clienteId);
      const sitio = (await clientes.sitios(tx, [sitioId])).get(sitioId);
      if (!sitio || sitio.clienteId !== clienteId) throw problema("entrada_invalida", "El sitio no pertenece al cliente");
      // A lo archivado ya no se le programa (ADR-0035): primero se recupera.
      if (sitio.archivado) throw problema("estado_invalido", "El cliente o el sitio están archivados: recupérelos para programarles una visita");
      await exigirSolicitante(tx, clienteId, solicitanteContactoId);
      const unicos = [...new Set(tecnicos)];
      const id = randomUUID();
      // El número se incrementa en esta transacción: nunca se repite ni se reutiliza (ADR-0051), como el de las cotizaciones.
      const [{ ultimo: ordenDeServicio } = { ultimo: 0 }] = await tx
        .insert(consecutivosDeOrden)
        .values({ organizacionId, ultimo: 1 })
        .onConflictDoUpdate({ target: consecutivosDeOrden.organizacionId, set: { ultimo: sql`${consecutivosDeOrden.ultimo} + 1` } })
        .returning({ ultimo: consecutivosDeOrden.ultimo });
      await tx.insert(visitas).values({ id, organizacionId, clienteId, sitioId, motivo: motivo.trim(), formato, programadaPara, horaInicio, horaFin, tecnicos: unicos, solicitanteContactoId, ordenDeServicio, referenciaCliente: referencia });
      await registrar(tx, [
        { organizacionId, agregadoTipo: "visita", agregadoId: id, tipoEvento: "visita_creada", autorId, correlacion, valorNuevo: { clienteId, sitioId, formato, programadaPara, horaInicio, horaFin, tecnicos: unicos, ordenDeServicio, solicitanteContactoId, referenciaCliente: referencia } },
      ]);
      await avisarPush(tx, { tipo: "visita_asignada", organizacionId, tecnicos: unicos, visitaId: id, programadaPara, horaInicio });
      await registrarCambios(tx, avisar(organizacionId, id, unicos, "cambio"));
      return id;
    },

    async fijarConsecutivoDeOrdenes(tx, organizacionId, ultimo) {
      if (!Number.isInteger(ultimo) || ultimo < 0) throw problema("entrada_invalida", "El número de orden debe ser un entero desde 0");
      // Tomado: dos programaciones a la vez esperan a que el número quede fijo.
      const [actual] = await tx.select({ ultimo: consecutivosDeOrden.ultimo }).from(consecutivosDeOrden).where(eq(consecutivosDeOrden.organizacionId, organizacionId)).for("update");
      const [{ mayor } = { mayor: null }] = await tx.select({ mayor: sql<number | null>`max(${visitas.ordenDeServicio})` }).from(visitas).where(eq(visitas.organizacionId, organizacionId));
      const yaVa = Math.max(actual?.ultimo ?? 0, mayor ?? 0);
      if (ultimo <= yaVa && (actual || mayor !== null)) throw problema("estado_invalido", `El consecutivo no puede bajar ni repetirse: la organización ya va en ${yaVa}`);
      await tx
        .insert(consecutivosDeOrden)
        .values({ organizacionId, ultimo })
        // Con el mayor, nunca menos: si una programación creó la fila entre la lectura y aquí, no se baja.
        .onConflictDoUpdate({ target: consecutivosDeOrden.organizacionId, set: { ultimo: sql`greatest(${consecutivosDeOrden.ultimo}, excluded.ultimo)` } });
    },

    async reasignar(tx, { organizacionId, autorId, correlacion, visitaId, tecnicos, version }) {
      const actual = await paraCambiar(tx, visitaId, version);
      const nuevos = new Set(tecnicos);
      const anteriores = new Set(actual.tecnicos);
      await tx
        .update(visitas)
        // Una cerrada sigue cerrada: reasignar lo pasado corrige quién la hizo; para volver se reprograma (ADR-0041).
        .set({ tecnicos: [...nuevos], version: sql`${visitas.version} + 1` })
        .where(eq(visitas.id, visitaId));
      await registrar(tx, [
        {
          organizacionId,
          agregadoTipo: "visita",
          agregadoId: visitaId,
          tipoEvento: "visita_reasignada",
          autorId,
          correlacion,
          rutaCampo: "tecnicos",
          valorAnterior: actual.tecnicos,
          valorNuevo: [...nuevos],
        },
      ]);
      const salen = [...anteriores].filter((t) => !nuevos.has(t));
      const entran = [...nuevos].filter((t) => !anteriores.has(t));
      await avisarPush(tx, { tipo: "visita_retirada", organizacionId, tecnicos: salen, visitaId, programadaPara: actual.programadaPara });
      await avisarPush(tx, { tipo: "visita_asignada", organizacionId, tecnicos: entran, visitaId, programadaPara: actual.programadaPara });
      await registrarCambios(tx, [...avisar(organizacionId, visitaId, salen, "fuera_de_alcance"), ...avisar(organizacionId, visitaId, entran, "cambio")]);
    },

    async reprogramar(tx, { organizacionId, autorId, correlacion, visitaId, version, programadaPara, motivo: motivoNuevo, formato: formatoNuevo, horaInicio = null, horaFin = null, solicitanteContactoId, referenciaCliente }) {
      validarFecha(programadaPara);
      // A lo archivado no se le reprograma, como no se le programa (ADR-0035): volvería a estar por hacer. El cliente se
      // toma antes que la visita, como al programar: quien archiva al mismo tiempo espera o se ve (iteración 42).
      const [donde] = await tx.select({ clienteId: visitas.clienteId, sitioId: visitas.sitioId }).from(visitas).where(eq(visitas.id, visitaId));
      if (donde) {
        await clientes.bloquear(tx, donde.clienteId);
        if ((await clientes.sitios(tx, [donde.sitioId])).get(donde.sitioId)?.archivado) throw problema("estado_invalido", "El cliente o el sitio están archivados: recupérelos para reprogramar la visita");
      }
      const actual = await paraCambiar(tx, visitaId, version);
      // Sin el dato, se conserva; con null, se quita (ADR-0051). Un solicitante nuevo tiene que ser del mismo cliente.
      const solicitante = solicitanteContactoId === undefined ? actual.solicitanteContactoId : solicitanteContactoId;
      if (solicitante !== actual.solicitanteContactoId) await exigirSolicitante(tx, actual.clienteId, solicitante);
      const referencia = referenciaCliente === undefined ? actual.referenciaCliente : referenciaCliente?.trim() || null;
      const motivo = motivoNuevo?.trim() || actual.motivo;
      const formato = formatoNuevo ?? actual.formato;
      // Otro día u otra hora: lo que ya se había terminado vuelve a estar por hacer.
      const cambiaHorario = actual.programadaPara !== programadaPara || aHoraCorta(actual.horaInicio) !== horaInicio || aHoraCorta(actual.horaFin) !== horaFin;
      await tx
        .update(visitas)
        // Otro día u otra hora también reabre una visita cerrada (ADR-0041).
        .set({ programadaPara, horaInicio, horaFin, motivo, formato, solicitanteContactoId: solicitante, referenciaCliente: referencia, ...(cambiaHorario ? { terminadaEn: null, terminadaPor: null, cerradaEn: null } : {}), version: sql`${visitas.version} + 1` })
        .where(eq(visitas.id, visitaId));
      await registrar(tx, [
        {
          organizacionId,
          agregadoTipo: "visita",
          agregadoId: visitaId,
          tipoEvento: "visita_reprogramada",
          autorId,
          correlacion,
          valorAnterior: { programadaPara: actual.programadaPara, horaInicio: aHoraCorta(actual.horaInicio), horaFin: aHoraCorta(actual.horaFin), motivo: actual.motivo, formato: actual.formato, solicitanteContactoId: actual.solicitanteContactoId, referenciaCliente: actual.referenciaCliente },
          valorNuevo: { programadaPara, horaInicio, horaFin, motivo, formato, solicitanteContactoId: solicitante, referenciaCliente: referencia },
        },
      ]);
      // Los teléfonos de sus técnicos reciben la visita con la fecha y el servicio nuevos.
      await avisarPush(tx, { tipo: "visita_reprogramada", organizacionId, tecnicos: actual.tecnicos, visitaId, antes: actual.programadaPara, despues: programadaPara, horaAntes: aHoraCorta(actual.horaInicio), horaDespues: horaInicio });
      await registrarCambios(tx, avisar(organizacionId, visitaId, actual.tecnicos, "cambio"));
    },

    async cancelar(tx, { organizacionId, autorId, correlacion, visitaId, version, motivo }) {
      const actual = await paraCambiar(tx, visitaId, version);
      await tx
        .update(visitas)
        .set({ canceladaEn: new Date(), canceladaPor: autorId, motivoCancelacion: motivo.trim(), version: sql`${visitas.version} + 1` })
        .where(eq(visitas.id, visitaId));
      await registrar(tx, [{ organizacionId, agregadoTipo: "visita", agregadoId: visitaId, tipoEvento: "visita_cancelada", autorId, correlacion, motivo: motivo.trim() }]);
      await avisarPush(tx, { tipo: "visita_cancelada", organizacionId, tecnicos: actual.tecnicos, visitaId, programadaPara: actual.programadaPara });
      await registrarCambios(tx, avisar(organizacionId, visitaId, actual.tecnicos, "fuera_de_alcance"));
    },

    async porHacer(tx, clienteId, hoy, conteos) {
      const porHacer = await tx
        .select({ id: visitas.id, programadaPara: visitas.programadaPara, sitioId: visitas.sitioId, tecnicos: visitas.tecnicos })
        .from(visitas)
        // Lo terminado o cerrado ya se hizo (ADR-0037, ADR-0041): no detiene archivar.
        .where(and(eq(visitas.clienteId, clienteId), isNull(visitas.canceladaEn), isNull(visitas.terminadaEn), isNull(visitas.cerradaEn), gte(visitas.programadaPara, hoy)))
        .orderBy(asc(visitas.programadaPara));
      const atendidas = await conteos(tx, porHacer.map((v) => v.id));
      // Una visita de otro día con un levantamiento ya recibido se reprogramó para volver (ADR-0042): sigue por hacer.
      return porHacer.filter((v) => !atendidas.has(v.id) || v.programadaPara > hoy);
    },

    async existe(tx, id) {
      const [fila] = await tx.select({ id: visitas.id }).from(visitas).where(eq(visitas.id, id));
      return Boolean(fila);
    },

    asignadas: (tx, ids, tecnicoId) => leer(tx, ids, tecnicoId),
    resumenes: (tx, ids) => leer(tx, ids),

    async coincidentes(tx, texto) {
      const sitios = await clientes.buscarSitios(tx, texto);
      if (sitios.length === 0) return [];
      const filas = await tx.select({ id: visitas.id }).from(visitas).where(inArray(visitas.sitioId, sitios));
      return filas.map((f) => f.id);
    },

    async porCerrar(tx, tecnicoId, hoy, conteos) {
      const candidatas = await tx
        .select({ id: visitas.id, terminadaEn: visitas.terminadaEn })
        .from(visitas)
        .where(and(arrayContains(visitas.tecnicos, [tecnicoId]), isNull(visitas.canceladaEn), isNull(visitas.cerradaEn), lt(visitas.programadaPara, hoy)));
      if (candidatas.length === 0) return [];
      const recibidos = await conteos(tx, candidatas.filter((c) => c.terminadaEn === null).map((c) => c.id));
      return candidatas.filter((c) => c.terminadaEn !== null || recibidos.has(c.id)).map((c) => c.id);
    },

    async cerrar(tx, organizacionId, ids, hoy) {
      if (ids.length === 0) return;
      // Solo las que nadie cerró antes: dos bajadas a la vez no registran la salida dos veces. La fecha y la cancelación
      // se miran otra vez en la fila: si oficina la reprogramó o la canceló después de elegirla, gana oficina.
      const cerradas = await tx
        .update(visitas)
        .set({ cerradaEn: new Date() })
        .where(and(inArray(visitas.id, [...ids]), isNull(visitas.cerradaEn), isNull(visitas.canceladaEn), lt(visitas.programadaPara, hoy)))
        .returning({ id: visitas.id, tecnicos: visitas.tecnicos });
      await registrarCambios(tx, cerradas.flatMap((v) => avisar(organizacionId, v.id, v.tecnicos, "fuera_de_alcance")));
    },

    async avisarCorreccion(tx, { organizacionId, clienteId, sitioId }) {
      const enTelefonos = await tx
        .select({ id: visitas.id, tecnicos: visitas.tecnicos })
        .from(visitas)
        .where(and(eq(visitas.clienteId, clienteId), sitioId ? eq(visitas.sitioId, sitioId) : undefined, isNull(visitas.canceladaEn), isNull(visitas.cerradaEn)));
      await registrarCambios(tx, enTelefonos.flatMap((v) => avisar(organizacionId, v.id, v.tecnicos, "cambio")));
    },

    async cerradas(tx, ids) {
      if (ids.length === 0) return new Set();
      const filas = await tx.select({ id: visitas.id }).from(visitas).where(and(inArray(visitas.id, [...ids]), isNotNull(visitas.cerradaEn)));
      return new Set(filas.map((f) => f.id));
    },

    async canceladas(tx, ids) {
      if (ids.length === 0) return new Set();
      const filas = await tx.select({ id: visitas.id }).from(visitas).where(and(inArray(visitas.id, [...ids]), isNotNull(visitas.canceladaEn)));
      return new Set(filas.map((f) => f.id));
    },

    async clienteDe(tx, visitaId) {
      const [fila] = await tx.select({ clienteId: visitas.clienteId }).from(visitas).where(eq(visitas.id, visitaId));
      return fila?.clienteId;
    },

    registrarRutas(app, { bd, identidad, conteos }) {
      /** Técnicos elegidos: activos y de la organización de quien programa. */
      async function tecnicosValidos(organizacionId: string, ids: readonly string[]) {
        const activos = new Set((await identidad.tecnicosActivos(organizacionId)).map((t) => t.id));
        const unicos = [...new Set(ids)];
        const fuera = unicos.filter((id) => !activos.has(id));
        if (fuera.length > 0) {
          // El detalle dice a quién quitar (oficina lo muestra): por ejemplo, alguien desactivado con la visita abierta.
          // Los nombres salen solo de esta organización: uno de otra no se revela.
          const nombres = await identidad.nombres(organizacionId, fuera);
          const quienes = new Intl.ListFormat("es", { type: "conjunction" }).format(fuera.map((id) => nombreDe(nombres, id)));
          throw problema(
            "entrada_invalida",
            fuera.length === 1 ? `${quienes} no es un técnico activo de la organización: quítelo de la visita` : `${quienes} no son técnicos activos de la organización: quítelos de la visita`,
          );
        }
        return unicos;
      }

      /** Visitas completas para oficina: cliente, sitio, técnicos con nombre y avance. */
      async function programadas(organizacionId: string, filas: (typeof visitas.$inferSelect)[], tx: TxOrganizacion) {
        const sitios = await clientes.sitios(tx, filas.map((f) => f.sitioId));
        const avance = await conteos(tx, filas.map((f) => f.id));
        const nombres = await identidad.nombres(organizacionId, [...new Set(filas.flatMap((f) => [...f.tecnicos, ...(f.canceladaPor ? [f.canceladaPor] : []), ...(f.terminadaPor ? [f.terminadaPor] : [])]))], tx);
        const persona = (id: string) => ({ id, nombre: nombreDe(nombres, id) });
        const solicitantes = await clientes.contactos(tx, filas.flatMap((f) => (f.solicitanteContactoId ? [f.solicitanteContactoId] : [])));
        return filas.flatMap((f) => {
          const sitio = sitios.get(f.sitioId);
          if (!sitio) return [];
          return [
            {
              id: f.id,
              version: f.version,
              cliente: { id: f.clienteId, nombre: sitio.cliente },
              sitio: { id: sitio.id, nombre: sitio.nombre, direccion: sitio.direccion },
              motivo: f.motivo,
              formato: f.formato,
              programadaPara: f.programadaPara,
              ordenDeServicio: f.ordenDeServicio,
              referencia: f.referenciaCliente,
              solicitante: solicitanteDe(f.solicitanteContactoId, solicitantes),
              horaInicio: aHoraCorta(f.horaInicio),
              horaFin: aHoraCorta(f.horaFin),
              terminada: f.terminadaEn ? { en: f.terminadaEn.toISOString(), por: persona(f.terminadaPor ?? "") } : null,
              tecnicos: f.tecnicos.map(persona),
              levantamientos: avance.get(f.id) ?? { enviados: 0, enRevision: 0, revisados: 0 },
              cancelada: f.canceladaEn ? { en: f.canceladaEn.toISOString(), por: persona(f.canceladaPor ?? ""), motivo: f.motivoCancelacion ?? "" } : null,
            },
          ];
        });
      }

      /** Un bloqueo por organización y día serializa a quienes programan ese día a la vez, para que dos no se crucen. */
      const tomarDia = (tx: TxOrganizacion, organizacionId: string, fecha: string) => tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`visitas:${organizacionId}:${fecha}`}))`);

      /**
       * Rechaza a los técnicos que ya tienen otra visita a esa hora (ADR-0037), aunque se llame a la API sin pasar por la
       * pantalla, con el día tomado.
       */
      async function sinCruces(tx: TxOrganizacion, organizacionId: string, fecha: string, horario: Horario, tecnicos: readonly string[], excluir?: string) {
        if (tecnicos.length === 0) return;
        await tomarDia(tx, organizacionId, fecha);
        const pedido = intervaloDe({ programadaPara: fecha, ...horario, terminadaEn: null });
        const delDia = await tx
          .select()
          .from(visitas)
          .where(and(eq(visitas.programadaPara, fecha), isNull(visitas.canceladaEn), sql`${visitas.tecnicos} && ${sql.param([...tecnicos])}::text[]`));
        const cruces = delDia.filter((v) => v.id !== excluir && seCruzan(pedido, intervaloDe({ ...v, horaInicio: aHoraCorta(v.horaInicio), horaFin: aHoraCorta(v.horaFin) })));
        if (cruces.length === 0) return;
        const sitios = await clientes.sitios(tx, cruces.map((v) => v.sitioId));
        const ocupados = tecnicos.flatMap((t) => cruces.filter((v) => v.tecnicos.includes(t)).slice(0, 1).map((v) => ({ tecnicoId: t, visitaId: v.id, cliente: sitios.get(v.sitioId)?.cliente ?? "[Cliente]" })));
        const nombres = await identidad.nombres(organizacionId, ocupados.map((o) => o.tecnicoId), tx);
        const lista = ocupados.map((o) => ({ tecnico: { id: o.tecnicoId, nombre: nombreDe(nombres, o.tecnicoId) }, visitaId: o.visitaId, cliente: o.cliente }));
        throw problema("tecnico_ocupado", `${lista.map((o) => o.tecnico.nombre).join(", ")} ya ${lista.length === 1 ? "tiene" : "tienen"} otra visita a esa hora`, { ocupados: lista });
      }

      async function una(organizacionId: string, tx: TxOrganizacion, id: string) {
        const filas = await tx.select().from(visitas).where(eq(visitas.id, id));
        return (await programadas(organizacionId, filas, tx))[0]!;
      }

      registrarOperacion(app, "listarVisitas", {
        politica: politicas.oficina,
        manejar: async ({ consulta: { vista, hoy }, actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const consulta = tx.select().from(visitas);
            const filas =
              vista === "proximas"
                ? await consulta.where(and(isNull(visitas.canceladaEn), gte(visitas.programadaPara, hoy))).orderBy(asc(visitas.programadaPara), asc(visitas.creadaEn))
                : vista === "anteriores"
                  ? await consulta.where(and(isNull(visitas.canceladaEn), lt(visitas.programadaPara, hoy))).orderBy(desc(visitas.programadaPara)).limit(LIMITE_HISTORIA)
                  : await consulta.where(isNotNull(visitas.canceladaEn)).orderBy(desc(visitas.canceladaEn)).limit(LIMITE_HISTORIA);
            return { visitas: await programadas(actor.organizacionId, filas, tx) };
          }),
      });

      /** El servicio elegido (ADR-0057): uno de los formatos de la organización, con el nombre que queda como motivo. */
      async function servicio(tx: TxOrganizacion, clave: string) {
        const encontrado = (await (formatos?.vigentes(tx) ?? Promise.resolve([]))).find((f) => f.clave === clave);
        if (!encontrado) throw problema("entrada_invalida", "Ese servicio no existe en la organización: elija uno de la lista");
        return { formato: encontrado.clave, motivo: encontrado.nombre };
      }

      registrarOperacion(app, "serviciosParaProgramar", {
        politica: politicas.oficina,
        manejar: async ({ actor }) => enOrganizacion(bd, actor.organizacionId, async (tx) => ({ servicios: await (formatos?.vigentes(tx) ?? Promise.resolve([])) })),
      });

      registrarOperacion(app, "programarVisita", {
        politica: politicas.oficina,
        manejar: async ({ cuerpo, actor, correlacion }) => {
          const tecnicos = await tecnicosValidos(actor.organizacionId, cuerpo.tecnicos);
          return enOrganizacion(bd, actor.organizacionId, async (tx) => {
            // El día va antes que el registro de cambios que toma crear, en el mismo orden que reprogramar y reasignar:
            // al revés, programar y reprogramar ese día a la vez se esperan uno al otro y Postgres aborta a uno.
            await tomarDia(tx, actor.organizacionId, cuerpo.programadaPara);
            // Primero se valida el pedido (fecha, sitio); el cruce se mira después, sin contarse a sí misma.
            const { solicitanteId, referencia, formato, ...visita } = cuerpo;
            const id = await publica.crear(tx, { ...autoria(actor, correlacion), ...visita, ...(await servicio(tx, formato)), solicitanteContactoId: solicitanteId, referenciaCliente: referencia, tecnicos });
            await sinCruces(tx, actor.organizacionId, cuerpo.programadaPara, cuerpo, tecnicos, id);
            return una(actor.organizacionId, tx, id);
          });
        },
      });

      registrarOperacion(app, "reasignarVisita", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) => {
          const tecnicos = await tecnicosValidos(actor.organizacionId, cuerpo.tecnicos);
          return enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [actual] = await tx.select().from(visitas).where(eq(visitas.id, id));
            // Solo los que entran: quien ya la tenía no se cruza consigo mismo.
            if (actual) await sinCruces(tx, actor.organizacionId, actual.programadaPara, { horaInicio: aHoraCorta(actual.horaInicio), horaFin: aHoraCorta(actual.horaFin) }, tecnicos.filter((t) => !actual.tecnicos.includes(t)), id);
            await publica.reasignar(tx, { ...autoria(actor, correlacion), visitaId: id, version: cuerpo.version, tecnicos });
            return una(actor.organizacionId, tx, id);
          });
        },
      });

      registrarOperacion(app, "reprogramarVisita", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) => {
          // Un técnico desactivado ya no hará esta ni sus otras visitas: no cuenta como ocupado (iteración 42). Se lee antes
          // de la transacción: dentro pediría otra conexión del pool mientras retiene una, y a la vez lo agotan.
          const activos = new Set((await identidad.tecnicosActivos(actor.organizacionId)).map((t) => t.id));
          return enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [actual] = await tx.select().from(visitas).where(eq(visitas.id, id));
            if (actual) await sinCruces(tx, actor.organizacionId, cuerpo.programadaPara, cuerpo, actual.tecnicos.filter((t) => activos.has(t)), id);
            const { solicitanteId, referencia, formato, ...cambio } = cuerpo;
            const nuevo = formato !== undefined && formato !== actual?.formato ? await servicio(tx, formato) : undefined;
            await publica.reprogramar(tx, { ...autoria(actor, correlacion), visitaId: id, ...cambio, ...(nuevo ?? {}), ...(solicitanteId !== undefined ? { solicitanteContactoId: solicitanteId } : {}), ...(referencia !== undefined ? { referenciaCliente: referencia } : {}) });
            // Otro servicio solo mientras no se haya recibido nada (ADR-0057): lo recibido ya se llenó con el anterior. Se
            // cuenta después de reprogramar, con la visita ya tomada: un envío que llegue en medio espera o se ve aquí, y el
            // error deshace todo.
            if (nuevo) {
              const avance = (await conteos(tx, [id])).get(id);
              if (avance && avance.enviados + avance.enRevision + avance.revisados > 0) {
                throw problema("estado_invalido", "Ya se recibió un levantamiento con el servicio anterior: para otro servicio, programe otra visita");
              }
            }
            return una(actor.organizacionId, tx, id);
          });
        },
      });

      registrarOperacion(app, "ocupacionDeTecnicos", {
        politica: politicas.oficina,
        manejar: async ({ consulta: { fecha }, actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const filas = await tx.select().from(visitas).where(and(eq(visitas.programadaPara, fecha), isNull(visitas.canceladaEn)));
            const sitios = await clientes.sitios(tx, filas.map((f) => f.sitioId));
            return {
              ocupaciones: filas.flatMap((f) =>
                f.tecnicos.map((tecnicoId) => ({
                  tecnicoId,
                  visitaId: f.id,
                  cliente: sitios.get(f.sitioId)?.cliente ?? "[Cliente]",
                  sitio: sitios.get(f.sitioId)?.nombre ?? "[Sitio]",
                  motivo: f.motivo,
                  horaInicio: aHoraCorta(f.horaInicio),
                  horaFin: aHoraCorta(f.horaFin),
                  terminadaEn: f.terminadaEn?.toISOString() ?? null,
                })),
              ),
            };
          }),
      });

      /**
       * El técnico la termina desde su teléfono, también sin señal y después (ADR-0037). La hora es la que declaró el
       * teléfono (regla 16), nunca en el futuro. Repetirlo no cambia nada: la primera queda.
       */
      registrarOperacion(app, "terminarVisita", {
        politica: politicas.tecnico,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [actual] = await tx.select().from(visitas).where(eq(visitas.id, id)).for("update");
            if (!actual || !actual.tecnicos.includes(actor.usuarioId)) throw problema("no_encontrado", "La visita no existe o no es suya");
            if (actual.terminadaEn) return { terminada: { en: actual.terminadaEn.toISOString() } };
            if (actual.canceladaEn) throw problema("estado_invalido", "La visita está cancelada");
            const en = new Date(Math.min(Date.parse(cuerpo.en), Date.now()));
            await tx.update(visitas).set({ terminadaEn: en, terminadaPor: actor.usuarioId }).where(eq(visitas.id, id));
            await registrar(tx, [{ ...autoria(actor, correlacion), agregadoTipo: "visita", agregadoId: id, tipoEvento: "visita_terminada", valorNuevo: { en: en.toISOString(), llave: cuerpo.llave } }]);
            // Los demás técnicos de la visita la ven terminada en su siguiente bajada.
            await registrarCambios(tx, avisar(actor.organizacionId, id, actual.tecnicos, "cambio"));
            return { terminada: { en: en.toISOString() } };
          }),
      });

      registrarOperacion(app, "cancelarVisita", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            await publica.cancelar(tx, { ...autoria(actor, correlacion), visitaId: id, ...cuerpo });
            return una(actor.organizacionId, tx, id);
          }),
      });
    },
  };
  return publica;

  async function leer(tx: TxOrganizacion, ids: readonly string[], tecnicoId?: string): Promise<Map<string, VisitaAsignada>> {
    if (ids.length === 0) return new Map();
    const filas = await tx
      .select({
        id: visitas.id,
        sitioId: visitas.sitioId,
        motivo: visitas.motivo,
        formato: visitas.formato,
        programadaPara: visitas.programadaPara,
        horaInicio: visitas.horaInicio,
        horaFin: visitas.horaFin,
        terminadaEn: visitas.terminadaEn,
        ordenDeServicio: visitas.ordenDeServicio,
        referenciaCliente: visitas.referenciaCliente,
        solicitanteContactoId: visitas.solicitanteContactoId,
      })
      .from(visitas)
      .where(and(inArray(visitas.id, [...ids]), tecnicoId ? and(arrayContains(visitas.tecnicos, [tecnicoId]), isNull(visitas.canceladaEn), isNull(visitas.cerradaEn)) : undefined));
    const sitios = await clientes.sitios(tx, filas.map((f) => f.sitioId));
    const solicitantes = await clientes.contactos(tx, filas.flatMap((f) => (f.solicitanteContactoId ? [f.solicitanteContactoId] : [])));
    const resultado = new Map<string, VisitaAsignada>();
    for (const f of filas) {
      const sitio = sitios.get(f.sitioId);
      if (!sitio) continue;
      resultado.set(f.id, {
        id: f.id,
        cliente: { nombre: sitio.cliente, nit: sitio.clienteNit },
        sitio: { nombre: sitio.nombre, direccion: sitio.direccion, ciudad: sitio.ciudad },
        motivo: f.motivo,
        formato: f.formato,
        programadaPara: f.programadaPara,
        ordenDeServicio: f.ordenDeServicio,
        referencia: f.referenciaCliente,
        solicitante: solicitanteDe(f.solicitanteContactoId, solicitantes),
        horaInicio: aHoraCorta(f.horaInicio),
        horaFin: aHoraCorta(f.horaFin),
        terminada: f.terminadaEn ? { en: f.terminadaEn.toISOString() } : null,
      });
    }
    return resultado;
  }
}
