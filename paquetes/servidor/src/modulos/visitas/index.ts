import { randomUUID } from "node:crypto";
import { and, arrayContains, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { registrar } from "../auditoria";
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
}

/** Avance de una visita según sus levantamientos; lo aporta el módulo de levantamientos. */
export type ConteosPorVisita = (tx: TxOrganizacion, visitaIds: readonly string[]) => Promise<Map<string, { enviados: number; enRevision: number; revisados: number }>>;

export type Vista = "proximas" | "anteriores" | "canceladas";

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
  reprogramar(tx: TxOrganizacion, datos: Contexto & { visitaId: string; version: number; programadaPara: string; motivo: string }): Promise<void>;
  /** Cancela: sale de los teléfonos; lo empezado se conserva y se puede enviar (regla 17). */
  cancelar(tx: TxOrganizacion, datos: Contexto & { visitaId: string; version: number; motivo: string }): Promise<void>;
  existe(tx: TxOrganizacion, id: string): Promise<boolean>;
  /** Visitas que siguen asignadas al técnico y sin cancelar; las demás no aparecen. */
  asignadas(tx: TxOrganizacion, ids: readonly string[], tecnicoId: string): Promise<Map<string, VisitaAsignada>>;
  /** Cuáles de estas visitas están canceladas: la bajada le dice al teléfono por qué salen. */
  canceladas(tx: TxOrganizacion, ids: readonly string[]): Promise<Set<string>>;
  clienteDe(tx: TxOrganizacion, visitaId: string): Promise<string | undefined>;
  /** Cliente, sitio, motivo y fecha de cada visita, sin importar a quién esté asignada (oficina). */
  resumenes(tx: TxOrganizacion, ids: readonly string[]): Promise<Map<string, VisitaAsignada>>;
  registrarRutas(app: FastifyInstance, deps: { bd: BaseDeDatos; identidad: Pick<Identidad, "nombres" | "tecnicosActivos">; conteos: ConteosPorVisita }): void;
}

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
    async crear(tx, { organizacionId, autorId, correlacion, clienteId, sitioId, motivo, programadaPara, tecnicos }) {
      validarFecha(programadaPara);
      if (!motivo.trim()) throw problema("entrada_invalida", "La visita necesita un motivo");
      const sitio = (await clientes.sitios(tx, [sitioId])).get(sitioId);
      if (!sitio || sitio.clienteId !== clienteId) throw problema("entrada_invalida", "El sitio no pertenece al cliente");
      const unicos = [...new Set(tecnicos)];
      const id = randomUUID();
      await tx.insert(visitas).values({ id, organizacionId, clienteId, sitioId, motivo: motivo.trim(), programadaPara, tecnicos: unicos });
      await registrar(tx, [
        { organizacionId, agregadoTipo: "visita", agregadoId: id, tipoEvento: "visita_creada", autorId, correlacion, valorNuevo: { clienteId, sitioId, programadaPara, tecnicos: unicos } },
      ]);
      await registrarCambios(tx, avisar(organizacionId, id, unicos, "cambio"));
      return id;
    },

    async reasignar(tx, { organizacionId, autorId, correlacion, visitaId, tecnicos, version }) {
      const actual = await paraCambiar(tx, visitaId, version);
      const nuevos = new Set(tecnicos);
      const anteriores = new Set(actual.tecnicos);
      await tx
        .update(visitas)
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
      await registrarCambios(tx, [
        ...avisar(organizacionId, visitaId, [...anteriores].filter((t) => !nuevos.has(t)), "fuera_de_alcance"),
        ...avisar(organizacionId, visitaId, [...nuevos].filter((t) => !anteriores.has(t)), "cambio"),
      ]);
    },

    async reprogramar(tx, { organizacionId, autorId, correlacion, visitaId, version, programadaPara, motivo }) {
      validarFecha(programadaPara);
      const actual = await paraCambiar(tx, visitaId, version);
      await tx
        .update(visitas)
        .set({ programadaPara, motivo: motivo.trim(), version: sql`${visitas.version} + 1` })
        .where(eq(visitas.id, visitaId));
      await registrar(tx, [
        {
          organizacionId,
          agregadoTipo: "visita",
          agregadoId: visitaId,
          tipoEvento: "visita_reprogramada",
          autorId,
          correlacion,
          valorAnterior: { programadaPara: actual.programadaPara, motivo: actual.motivo },
          valorNuevo: { programadaPara, motivo: motivo.trim() },
        },
      ]);
      // Los teléfonos de sus técnicos reciben la visita con la fecha y el motivo nuevos.
      await registrarCambios(tx, avisar(organizacionId, visitaId, actual.tecnicos, "cambio"));
    },

    async cancelar(tx, { organizacionId, autorId, correlacion, visitaId, version, motivo }) {
      const actual = await paraCambiar(tx, visitaId, version);
      await tx
        .update(visitas)
        .set({ canceladaEn: new Date(), canceladaPor: autorId, motivoCancelacion: motivo.trim(), version: sql`${visitas.version} + 1` })
        .where(eq(visitas.id, visitaId));
      await registrar(tx, [{ organizacionId, agregadoTipo: "visita", agregadoId: visitaId, tipoEvento: "visita_cancelada", autorId, correlacion, motivo: motivo.trim() }]);
      await registrarCambios(tx, avisar(organizacionId, visitaId, actual.tecnicos, "fuera_de_alcance"));
    },

    async existe(tx, id) {
      const [fila] = await tx.select({ id: visitas.id }).from(visitas).where(eq(visitas.id, id));
      return Boolean(fila);
    },

    asignadas: (tx, ids, tecnicoId) => leer(tx, ids, tecnicoId),
    resumenes: (tx, ids) => leer(tx, ids),

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
        const nombres = await identidad.nombres(organizacionId, [...new Set(filas.flatMap((f) => [...f.tecnicos, ...(f.canceladaPor ? [f.canceladaPor] : [])]))]);
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
              tecnicos: f.tecnicos.map(persona),
              levantamientos: avance.get(f.id) ?? { enviados: 0, enRevision: 0, revisados: 0 },
              cancelada: f.canceladaEn ? { en: f.canceladaEn.toISOString(), por: persona(f.canceladaPor ?? ""), motivo: f.motivoCancelacion ?? "" } : null,
            },
          ];
        });
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
            const id = await publica.crear(tx, { organizacionId: actor.organizacionId, autorId: actor.usuarioId, correlacion, ...cuerpo, tecnicos });
            return una(actor.organizacionId, tx, id);
          });
        },
      });

      registrarOperacion(app, "reasignarVisita", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) => {
          const tecnicos = await tecnicosValidos(actor.organizacionId, cuerpo.tecnicos);
          return enOrganizacion(bd, actor.organizacionId, async (tx) => {
            await publica.reasignar(tx, { organizacionId: actor.organizacionId, autorId: actor.usuarioId, correlacion, visitaId: id, version: cuerpo.version, tecnicos });
            return una(actor.organizacionId, tx, id);
          });
        },
      });

      registrarOperacion(app, "reprogramarVisita", {
        politica: politicas.oficina,
        manejar: async ({ parametros: { id }, cuerpo, actor, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            await publica.reprogramar(tx, { organizacionId: actor.organizacionId, autorId: actor.usuarioId, correlacion, visitaId: id, ...cuerpo });
            return una(actor.organizacionId, tx, id);
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
      .select({ id: visitas.id, sitioId: visitas.sitioId, motivo: visitas.motivo, programadaPara: visitas.programadaPara })
      .from(visitas)
      .where(and(inArray(visitas.id, [...ids]), tecnicoId ? and(arrayContains(visitas.tecnicos, [tecnicoId]), isNull(visitas.canceladaEn)) : undefined));
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
      });
    }
    return resultado;
  }
}
