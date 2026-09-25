import { randomUUID } from "node:crypto";
import { and, arrayContains, eq, inArray, sql } from "drizzle-orm";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";
import { problema } from "../../plataforma/errores";
import { registrar } from "../auditoria";
import { registrarCambios, type Cambio } from "../cambios";
import type { ClientesYSitios } from "../clientes";
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

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export interface Visitas {
  crear(tx: TxOrganizacion, datos: NuevaVisita): Promise<string>;
  /** Reemplaza los técnicos asignados. Regla 17: no invalida levantamientos ya iniciados. */
  reasignar(tx: TxOrganizacion, datos: Contexto & { visitaId: string; tecnicos: readonly string[] }): Promise<void>;
  existe(tx: TxOrganizacion, id: string): Promise<boolean>;
  /** Visitas que siguen asignadas al técnico; las demás no aparecen. */
  asignadas(tx: TxOrganizacion, ids: readonly string[], tecnicoId: string): Promise<Map<string, VisitaAsignada>>;
  clienteDe(tx: TxOrganizacion, visitaId: string): Promise<string | undefined>;
  /** Cliente, sitio, motivo y fecha de cada visita, sin importar a quién esté asignada (oficina). */
  resumenes(tx: TxOrganizacion, ids: readonly string[]): Promise<Map<string, VisitaAsignada>>;
}

/** Interfaz pública del módulo de visitas (soporte, capas simples). */
export function crearVisitas(clientes: ClientesYSitios): Visitas {
  const avisar = (organizacionId: string, visitaId: string, tecnicos: Iterable<string>, operacion: Cambio["operacion"]): Cambio[] =>
    [...tecnicos].map((usuarioId) => ({ organizacionId, usuarioId, entidad: "visita", entidadId: visitaId, operacion }));

  const publica: Visitas = {
    async crear(tx, { organizacionId, autorId, correlacion, clienteId, sitioId, motivo, programadaPara, tecnicos }) {
      if (!FECHA.test(programadaPara) || Number.isNaN(Date.parse(programadaPara))) throw problema("entrada_invalida", "Fecha inválida: use AAAA-MM-DD");
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

    async reasignar(tx, { organizacionId, autorId, correlacion, visitaId, tecnicos }) {
      const [actual] = await tx.select({ tecnicos: visitas.tecnicos }).from(visitas).where(eq(visitas.id, visitaId)).for("update");
      if (!actual) throw problema("no_encontrado", "La visita no existe");
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

    async existe(tx, id) {
      const [fila] = await tx.select({ id: visitas.id }).from(visitas).where(eq(visitas.id, id));
      return Boolean(fila);
    },

    asignadas: (tx, ids, tecnicoId) => leer(tx, ids, tecnicoId),
    resumenes: (tx, ids) => leer(tx, ids),
    async clienteDe(tx, visitaId) {
      const [fila] = await tx.select({ clienteId: visitas.clienteId }).from(visitas).where(eq(visitas.id, visitaId));
      return fila?.clienteId;
    },
  };
  return publica;

  async function leer(tx: TxOrganizacion, ids: readonly string[], tecnicoId?: string): Promise<Map<string, VisitaAsignada>> {
      if (ids.length === 0) return new Map();
      const filas = await tx
        .select({ id: visitas.id, sitioId: visitas.sitioId, motivo: visitas.motivo, programadaPara: visitas.programadaPara })
        .from(visitas)
        .where(and(inArray(visitas.id, [...ids]), tecnicoId ? arrayContains(visitas.tecnicos, [tecnicoId]) : undefined));
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
