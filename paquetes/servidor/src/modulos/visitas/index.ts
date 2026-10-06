import { randomUUID } from "node:crypto";
import { and, arrayContains, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
import { avisar as avisarPush } from "../avisos";
import { registrarCambios, type Cambio } from "../cambios";
import type { ClientesYSitios } from "../clientes";
import type { Identidad } from "../identidad";
import { visitas } from "./esquema";

export interface VisitaAsignada {
  id: string;
  cliente: { nombre: string };
  sitio: { nombre: string; direccion: string };
  motivo: string;
  programadaPara: string;
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
  /** AAAA-MM-DD */
  programadaPara: string;
  tecnicos: readonly string[];
  horaInicio?: string | null | undefined;
  horaFin?: string | null | undefined;
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
  crear(tx: TxOrganizacion, datos: NuevaVisita): Promise<string>;
  /**
   * Reemplaza los técnicos asignados. Regla 17: no invalida levantamientos ya iniciados. Con `version`,
   * rechaza si otra persona cambió la visita desde que se abrió (QA-25).
   */
  reasignar(tx: TxOrganizacion, datos: Contexto & { visitaId: string; tecnicos: readonly string[]; version?: number }): Promise<void>;
  reprogramar(tx: TxOrganizacion, datos: Contexto & { visitaId: string; version: number; programadaPara: string; motivo: string; horaInicio?: string | null; horaFin?: string | null }): Promise<void>;
  /** Cancela: sale de los teléfonos; lo empezado se conserva y se puede enviar (regla 17). */
  cancelar(tx: TxOrganizacion, datos: Contexto & { visitaId: string; version: number; motivo: string }): Promise<void>;
  existe(tx: TxOrganizacion, id: string): Promise<boolean>;
  /** Visitas sin cancelar desde `hoy` de un cliente: mientras haya, ni él ni esos sitios se archivan (ADR-0035). */
  porHacer(tx: TxOrganizacion, clienteId: string, hoy: string): Promise<VisitaPorHacer[]>;
  /** Visitas que siguen asignadas al técnico y sin cancelar; las demás no aparecen. */
  asignadas(tx: TxOrganizacion, ids: readonly string[], tecnicoId: string): Promise<Map<string, VisitaAsignada>>;
  /** Cuáles de estas visitas están canceladas: la bajada le dice al teléfono por qué salen. */
  canceladas(tx: TxOrganizacion, ids: readonly string[]): Promise<Set<string>>;
  /** Visitas del técnico que podrían cerrarse (ADR-0041): asignadas, sin cancelar ni cerrar, de un día anterior a `hoy`. */
  porCerrar(tx: TxOrganizacion, tecnicoId: string, hoy: string): Promise<{ id: string; terminada: boolean }[]>;
  /** Cierra estas visitas (ADR-0041): salen de los teléfonos de sus técnicos y no vuelven a bajar. */
  cerrar(tx: TxOrganizacion, organizacionId: string, ids: readonly string[]): Promise<void>;
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
const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
const ZONA = "America/Bogota";
/** Minuto del día en Colombia de un momento, o null si cae en otro día que `fecha`. */
function minutoDelDia(momento: Date, fecha: string): number | null {
  if (momento.toLocaleDateString("en-CA", { timeZone: ZONA }) !== fecha) return null;
  const [h, m] = momento.toLocaleTimeString("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }).split(":");
  return Number(h) * 60 + Number(m);
}

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
export function crearVisitas(clientes: ClientesYSitios): Visitas {
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

  const publica: Visitas = {
    async crear(tx, { organizacionId, autorId, correlacion, clienteId, sitioId, motivo, programadaPara, tecnicos, horaInicio = null, horaFin = null }) {
      validarFecha(programadaPara);
      if (!motivo.trim()) throw problema("entrada_invalida", "La visita necesita un motivo");
      const sitio = (await clientes.sitios(tx, [sitioId])).get(sitioId);
      if (!sitio || sitio.clienteId !== clienteId) throw problema("entrada_invalida", "El sitio no pertenece al cliente");
      // A lo archivado ya no se le programa (ADR-0035): primero se recupera.
      if (sitio.archivado) throw problema("estado_invalido", "El cliente o el sitio están archivados: recupérelos para programarles una visita");
      const unicos = [...new Set(tecnicos)];
      const id = randomUUID();
      await tx.insert(visitas).values({ id, organizacionId, clienteId, sitioId, motivo: motivo.trim(), programadaPara, horaInicio, horaFin, tecnicos: unicos });
      await registrar(tx, [
        { organizacionId, agregadoTipo: "visita", agregadoId: id, tipoEvento: "visita_creada", autorId, correlacion, valorNuevo: { clienteId, sitioId, programadaPara, horaInicio, horaFin, tecnicos: unicos } },
      ]);
      await avisarPush(tx, { tipo: "visita_asignada", organizacionId, tecnicos: unicos, visitaId: id, programadaPara, horaInicio });
      await registrarCambios(tx, avisar(organizacionId, id, unicos, "cambio"));
      return id;
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

    async reprogramar(tx, { organizacionId, autorId, correlacion, visitaId, version, programadaPara, motivo, horaInicio = null, horaFin = null }) {
      validarFecha(programadaPara);
      const actual = await paraCambiar(tx, visitaId, version);
      // Otro día u otra hora: lo que ya se había terminado vuelve a estar por hacer.
      const cambiaHorario = actual.programadaPara !== programadaPara || aHoraCorta(actual.horaInicio) !== horaInicio || aHoraCorta(actual.horaFin) !== horaFin;
      await tx
        .update(visitas)
        // Otro día u otra hora también reabre una visita cerrada (ADR-0041).
        .set({ programadaPara, horaInicio, horaFin, motivo: motivo.trim(), ...(cambiaHorario ? { terminadaEn: null, terminadaPor: null, cerradaEn: null } : {}), version: sql`${visitas.version} + 1` })
        .where(eq(visitas.id, visitaId));
      await registrar(tx, [
        {
          organizacionId,
          agregadoTipo: "visita",
          agregadoId: visitaId,
          tipoEvento: "visita_reprogramada",
          autorId,
          correlacion,
          valorAnterior: { programadaPara: actual.programadaPara, horaInicio: aHoraCorta(actual.horaInicio), horaFin: aHoraCorta(actual.horaFin), motivo: actual.motivo },
          valorNuevo: { programadaPara, horaInicio, horaFin, motivo: motivo.trim() },
        },
      ]);
      // Los teléfonos de sus técnicos reciben la visita con la fecha y el motivo nuevos.
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

    async porHacer(tx, clienteId, hoy) {
      return tx
        .select({ id: visitas.id, programadaPara: visitas.programadaPara, sitioId: visitas.sitioId, tecnicos: visitas.tecnicos })
        .from(visitas)
        // Lo terminado o cerrado ya se hizo (ADR-0037, ADR-0041): no detiene archivar.
        .where(and(eq(visitas.clienteId, clienteId), isNull(visitas.canceladaEn), isNull(visitas.terminadaEn), isNull(visitas.cerradaEn), gte(visitas.programadaPara, hoy)))
        .orderBy(asc(visitas.programadaPara));
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

    async porCerrar(tx, tecnicoId, hoy) {
      const filas = await tx
        .select({ id: visitas.id, terminadaEn: visitas.terminadaEn })
        .from(visitas)
        .where(and(arrayContains(visitas.tecnicos, [tecnicoId]), isNull(visitas.canceladaEn), isNull(visitas.cerradaEn), lt(visitas.programadaPara, hoy)));
      return filas.map((f) => ({ id: f.id, terminada: f.terminadaEn !== null }));
    },

    async cerrar(tx, organizacionId, ids) {
      if (ids.length === 0) return;
      // Solo las que nadie cerró antes: dos bajadas a la vez no registran la salida dos veces.
      const cerradas = await tx
        .update(visitas)
        .set({ cerradaEn: new Date() })
        .where(and(inArray(visitas.id, [...ids]), isNull(visitas.cerradaEn)))
        .returning({ id: visitas.id, tecnicos: visitas.tecnicos });
      await registrarCambios(tx, cerradas.flatMap((v) => avisar(organizacionId, v.id, v.tecnicos, "fuera_de_alcance")));
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
        if (unicos.some((id) => !activos.has(id))) throw problema("entrada_invalida", "Solo se asignan técnicos activos de la organización");
        return unicos;
      }

      /** Visitas completas para oficina: cliente, sitio, técnicos con nombre y avance. */
      async function programadas(organizacionId: string, filas: (typeof visitas.$inferSelect)[], tx: TxOrganizacion) {
        const sitios = await clientes.sitios(tx, filas.map((f) => f.sitioId));
        const avance = await conteos(tx, filas.map((f) => f.id));
        const nombres = await identidad.nombres(organizacionId, [...new Set(filas.flatMap((f) => [...f.tecnicos, ...(f.canceladaPor ? [f.canceladaPor] : []), ...(f.terminadaPor ? [f.terminadaPor] : [])]))], tx);
        const persona = (id: string) => ({ id, nombre: nombres.get(id) ?? "[Usuario no disponible]" });
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
              programadaPara: f.programadaPara,
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

      /**
       * Rechaza a los técnicos que ya tienen otra visita a esa hora (ADR-0037), aunque se llame a la API sin pasar por la
       * pantalla. Un bloqueo por organización y día serializa a quienes programan a la vez, para que dos no se crucen.
       */
      async function sinCruces(tx: TxOrganizacion, organizacionId: string, fecha: string, horario: Horario, tecnicos: readonly string[], excluir?: string) {
        if (tecnicos.length === 0) return;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`visitas:${organizacionId}:${fecha}`}))`);
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
        const lista = ocupados.map((o) => ({ tecnico: { id: o.tecnicoId, nombre: nombres.get(o.tecnicoId) ?? "[Usuario no disponible]" }, visitaId: o.visitaId, cliente: o.cliente }));
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

      registrarOperacion(app, "programarVisita", {
        politica: politicas.oficina,
        manejar: async ({ cuerpo, actor, correlacion }) => {
          const tecnicos = await tecnicosValidos(actor.organizacionId, cuerpo.tecnicos);
          return enOrganizacion(bd, actor.organizacionId, async (tx) => {
            // Primero se valida el pedido (fecha, sitio); el cruce se mira después, sin contarse a sí misma.
            const id = await publica.crear(tx, { organizacionId: actor.organizacionId, autorId: actor.usuarioId, correlacion, ...cuerpo, tecnicos });
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
            await publica.reasignar(tx, { organizacionId: actor.organizacionId, autorId: actor.usuarioId, correlacion, visitaId: id, version: cuerpo.version, tecnicos });
            return una(actor.organizacionId, tx, id);
          });
        },
      });

      registrarOperacion(app, "reprogramarVisita", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [actual] = await tx.select().from(visitas).where(eq(visitas.id, id));
            if (actual) await sinCruces(tx, actor.organizacionId, cuerpo.programadaPara, cuerpo, actual.tecnicos, id);
            await publica.reprogramar(tx, { organizacionId: actor.organizacionId, autorId: actor.usuarioId, correlacion, visitaId: id, ...cuerpo });
            return una(actor.organizacionId, tx, id);
          }),
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
            await registrar(tx, [{ organizacionId: actor.organizacionId, agregadoTipo: "visita", agregadoId: id, tipoEvento: "visita_terminada", autorId: actor.usuarioId, correlacion, valorNuevo: { en: en.toISOString(), llave: cuerpo.llave } }]);
            // Los demás técnicos de la visita la ven terminada en su siguiente bajada.
            await registrarCambios(tx, avisar(actor.organizacionId, id, actual.tecnicos, "cambio"));
            return { terminada: { en: en.toISOString() } };
          }),
      });

      registrarOperacion(app, "cancelarVisita", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            await publica.cancelar(tx, { organizacionId: actor.organizacionId, autorId: actor.usuarioId, correlacion, visitaId: id, ...cuerpo });
            return una(actor.organizacionId, tx, id);
          }),
      });
    },
  };
  return publica;

  async function leer(tx: TxOrganizacion, ids: readonly string[], tecnicoId?: string): Promise<Map<string, VisitaAsignada>> {
    if (ids.length === 0) return new Map();
    const filas = await tx
      .select({ id: visitas.id, sitioId: visitas.sitioId, motivo: visitas.motivo, programadaPara: visitas.programadaPara, horaInicio: visitas.horaInicio, horaFin: visitas.horaFin, terminadaEn: visitas.terminadaEn })
      .from(visitas)
      .where(and(inArray(visitas.id, [...ids]), tecnicoId ? and(arrayContains(visitas.tecnicos, [tecnicoId]), isNull(visitas.canceladaEn), isNull(visitas.cerradaEn)) : undefined));
    const sitios = await clientes.sitios(tx, filas.map((f) => f.sitioId));
    const resultado = new Map<string, VisitaAsignada>();
    for (const f of filas) {
      const sitio = sitios.get(f.sitioId);
      if (!sitio) continue;
      resultado.set(f.id, {
        id: f.id,
        cliente: { nombre: sitio.cliente },
        sitio: { nombre: sitio.nombre, direccion: sitio.direccion },
        motivo: f.motivo,
        programadaPara: f.programadaPara,
        horaInicio: aHoraCorta(f.horaInicio),
        horaFin: aHoraCorta(f.horaFin),
        terminada: f.terminadaEn ? { en: f.terminadaEn.toISOString() } : null,
      });
    }
    return resultado;
  }
}
