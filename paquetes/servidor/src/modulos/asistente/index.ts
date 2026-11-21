import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { IntercambioDelAsistente } from "@teins/protocolo";
import { enOrganizacion, esViolacionUnica, type BaseDeDatos, type TxOrganizacion } from "../../plataforma/base-de-datos";
import { encolar, type Trabajos } from "../../plataforma/cola";
import { problema } from "../../plataforma/errores";
import { politicas } from "../../plataforma/politicas";
import { registrarOperacion } from "../../plataforma/rutas";
import { autoria, registrar } from "../auditoria";
import { nombreDe, type Identidad } from "../identidad";
import { responder, type RegistroDelAsistente } from "./bucle";
import { ajustesDe, gastoDelMes, mesActual, NOMBRE_POR_OMISION, sumarGasto, topeAgotado, vencida } from "./consultas";
import { decimalCorto } from "./costo";
import { ajustes, conversaciones, gastos, intercambios, type FilaIntercambio } from "./esquema";
import type { ModeloAsistente } from "./modelo";
import type { Herramienta } from "./tipos";

export type { ContextoHerramienta, CifraCandidata, Herramienta, ResultadoHerramienta } from "./tipos";
export type { ModeloAsistente, VueltaDelModelo, MensajeDelModelo, LlamadaAHerramienta, DefinicionDeHerramienta } from "./modelo";
export { modeloAnthropic, ErrorDelModelo } from "./modelo";
export { modeloSimulado } from "./simulado";
export { costoDe } from "./costo";
export type { RegistroDelAsistente } from "./bucle";

/** Largo del título de una conversación nueva: su primera pregunta, recortada. */
const LARGO_DEL_TITULO = 80;
/** Respuestas en curso a la vez por persona: cada una ocupa el modelo y cuesta. */
const EN_CURSO_POR_PERSONA = 2;
/** La conservación (Ley 1581, temporalidad): lo eliminado se borra al día; lo inactivo, al año. */
const ELIMINADA_SE_BORRA_EN_MS = 24 * 60 * 60 * 1000;
const INACTIVA_SE_BORRA_EN_MS = 365 * 24 * 60 * 60 * 1000;

export type CoberturaDeLevantamientos = (tx: TxOrganizacion) => Promise<{ revisados: number; primerRecibido: Date | null; ultimoRecibido: Date | null }>;

export interface Asistente {
  registrarRutas(app: FastifyInstance): void;
  /** Manejador del trabajo `asistente.responder` (worker): un solo intento. */
  responder(datos: Trabajos["asistente.responder"]): Promise<void>;
}

const recortar = (texto: string) => {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length <= LARGO_DEL_TITULO ? limpio : `${limpio.slice(0, LARGO_DEL_TITULO - 1).trimEnd()}…`;
};

const aIntercambio = (f: FilaIntercambio): IntercambioDelAsistente => ({
  id: f.id,
  pregunta: f.pregunta,
  creadoEn: f.creadoEn.toISOString(),
  estado: f.estado,
  duracionSegundos: f.terminadoEn ? Math.max(0, Math.round((f.terminadoEn.getTime() - f.creadoEn.getTime()) / 1000)) : null,
  pasos: f.pasos.map((p) => ({ herramienta: p.herramienta, etiqueta: p.estado === "en_curso" ? p.etiquetaEnCurso : p.etiquetaHecha, resultado: p.resumen ?? null, estado: p.estado })),
  respuesta: f.respuesta ?? null,
  error: f.error,
});

/** Los pasos sin su resultado completo, en el mismo orden (Ley 1581, temporalidad). */
const sinResultados = sql`(select coalesce(jsonb_agg(p.value - 'resultado' order by p.orden), '[]'::jsonb) from jsonb_array_elements(${intercambios.pasos}) with ordinality as p(value, orden))`;

/** Las respuestas en curso que vencieron se interrumpieron: quedan en error, nunca en curso para siempre. */
async function cerrarInterrumpidas(tx: TxOrganizacion, filtro: SQL) {
  await tx
    .update(intercambios)
    .set({ estado: "error", error: "La respuesta se interrumpió. Vuelva a preguntar.", terminadoEn: new Date(), pasos: sinResultados })
    .where(and(filtro, eq(intercambios.estado, "en_curso"), vencida));
}

/**
 * Purga de conservación (Ley 1581, principio de temporalidad), para la tarea periódica: borra del todo, con sus
 * intercambios, las conversaciones eliminadas hace más de un día y las que llevan un año sin actividad, y cierra como
 * interrumpidas las respuestas vencidas. El gasto del mes está aparte y no cambia. Devuelve cuántas conversaciones borró.
 */
export async function purgarConversaciones(tx: TxOrganizacion, ahora = new Date()): Promise<number> {
  // Las vencidas se cierran aunque nadie vuelva a abrir su conversación.
  await cerrarInterrumpidas(tx, sql`true`);
  const viejas = await tx
    .select({ id: conversaciones.id })
    .from(conversaciones)
    .where(
      or(
        and(isNotNull(conversaciones.eliminadaEn), lt(conversaciones.eliminadaEn, new Date(ahora.getTime() - ELIMINADA_SE_BORRA_EN_MS))),
        lt(conversaciones.actualizadaEn, new Date(ahora.getTime() - INACTIVA_SE_BORRA_EN_MS)),
      ),
    );
  if (viejas.length === 0) return 0;
  const ids = viejas.map((c) => c.id);
  await tx.delete(intercambios).where(inArray(intercambios.conversacionId, ids));
  await tx.delete(conversaciones).where(inArray(conversaciones.id, ids));
  return ids.length;
}

/**
 * Detiene las respuestas en curso: la que todavía espera turno queda detenida de una vez (el worker no la encontrará en
 * curso); la que ya arrancó para antes de su siguiente llamada al modelo.
 */
async function detener(tx: TxOrganizacion, filtro: SQL) {
  await tx
    .update(intercambios)
    .set({ estado: "detenida", detenerPedido: true, terminadoEn: new Date() })
    .where(and(filtro, eq(intercambios.estado, "en_curso"), isNull(intercambios.iniciadoEn)));
  await tx.update(intercambios).set({ detenerPedido: true }).where(and(filtro, eq(intercambios.estado, "en_curso")));
}

/** Una conversación propia; la de otra persona (o eliminada, salvo para restaurar) es `no_encontrado`, nunca `sin_permiso`. */
async function conversacionPropia(tx: TxOrganizacion, usuarioId: string, id: string, { eliminadas = false } = {}) {
  const [fila] = await tx
    .select()
    .from(conversaciones)
    .where(and(eq(conversaciones.id, id), eq(conversaciones.usuarioId, usuarioId), ...(eliminadas ? [] : [isNull(conversaciones.eliminadaEn)])));
  if (!fila) throw problema("no_encontrado", "La conversación no existe");
  return fila;
}

/**
 * El asistente de datos de oficina (ADR-0060). La web atiende las operaciones; el worker corre el bucle con el modelo y
 * las herramientas. `disponible` dice si este entorno tiene modelo: en la web es `ASISTENTE_ACTIVO` o el modo simulado.
 */
export function crearAsistente({
  bd,
  disponible,
  identidad,
  cobertura,
  modelo = null,
  herramientas = [],
  registro = { info: () => undefined, error: () => undefined },
  limites,
}: {
  bd: BaseDeDatos;
  disponible: boolean;
  identidad: Pick<Identidad, "nombres" | "nombreDeOrganizacion">;
  /** La cobertura de levantamientos revisados (módulo de levantamientos): solo la web. */
  cobertura?: CoberturaDeLevantamientos;
  /** Solo el worker: el modelo y las herramientas de solo lectura que puede pedir. */
  modelo?: ModeloAsistente | null;
  herramientas?: readonly Herramienta[];
  registro?: RegistroDelAsistente;
  limites?: { vueltas?: number; duracionMs?: number };
}): Asistente {
  return {
    responder: (datos) => responder({ bd, modelo, herramientas, nombreDeOrganizacion: identidad.nombreDeOrganizacion, registro, limites }, datos),

    registrarRutas(app) {
      registrarOperacion(app, "estadoDelAsistente", {
        politica: politicas.oficina,
        manejar: async ({ actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const c = cobertura ? await cobertura(tx) : { revisados: 0, primerRecibido: null, ultimoRecibido: null };
            return {
              disponible,
              nombre: (await ajustesDe(tx)).nombre,
              cobertura: { revisados: c.revisados, desde: c.primerRecibido?.toISOString() ?? null, hasta: c.ultimoRecibido?.toISOString() ?? null },
              topeAgotado: await topeAgotado(tx),
            };
          }),
      });

      registrarOperacion(app, "listarConversacionesDelAsistente", {
        politica: politicas.oficina,
        manejar: async ({ actor }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const filas = await tx
              .select({ id: conversaciones.id, titulo: conversaciones.titulo, actualizadaEn: conversaciones.actualizadaEn, preguntas: count(intercambios.id) })
              .from(conversaciones)
              .leftJoin(intercambios, eq(intercambios.conversacionId, conversaciones.id))
              .where(and(eq(conversaciones.usuarioId, actor.usuarioId), isNull(conversaciones.eliminadaEn)))
              .groupBy(conversaciones.id)
              .orderBy(desc(conversaciones.actualizadaEn))
              .limit(100);
            return { conversaciones: filas.map((f) => ({ ...f, actualizadaEn: f.actualizadaEn.toISOString() })) };
          }),
      });

      registrarOperacion(app, "obtenerConversacionDelAsistente", {
        politica: politicas.oficina,
        manejar: async ({ actor, parametros }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const conversacion = await conversacionPropia(tx, actor.usuarioId, parametros.id);
            await cerrarInterrumpidas(tx, eq(intercambios.conversacionId, conversacion.id));
            const filas = await tx.select().from(intercambios).where(eq(intercambios.conversacionId, conversacion.id)).orderBy(asc(intercambios.creadoEn));
            return { id: conversacion.id, titulo: conversacion.titulo, intercambios: filas.map(aIntercambio) };
          }),
      });

      registrarOperacion(app, "preguntarAlAsistente", {
        politica: politicas.oficina,
        manejar: async ({ actor, cuerpo }) => {
          const repetida = async (tx: TxOrganizacion) => {
            const [previo] = await tx.select({ id: intercambios.id, conversacionId: intercambios.conversacionId, usuarioId: intercambios.usuarioId }).from(intercambios).where(eq(intercambios.llave, cuerpo.llave));
            if (!previo) return undefined;
            // La llave de otra persona no revela nada de su conversación.
            if (previo.usuarioId !== actor.usuarioId) throw problema("no_encontrado", "La conversación no existe");
            return { conversacionId: previo.conversacionId, intercambioId: previo.id };
          };
          try {
            return await enOrganizacion(bd, actor.organizacionId, async (tx) => {
              const previo = await repetida(tx);
              if (previo) return previo;
              if (!disponible) throw problema("no_disponible", "El asistente no está disponible en este entorno");
              if (await topeAgotado(tx)) throw problema("tope_agotado", "Se agotó el tope de gasto del mes del asistente");
              // Un bloqueo por persona hasta el fin de la transacción: pedidos a la vez cuentan uno detrás de otro.
              await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${actor.organizacionId} || ':' || ${actor.usuarioId}, 0))`);
              await cerrarInterrumpidas(tx, eq(intercambios.usuarioId, actor.usuarioId));
              const [{ enCurso } = { enCurso: 0 }] = await tx
                .select({ enCurso: count() })
                .from(intercambios)
                .where(and(eq(intercambios.usuarioId, actor.usuarioId), eq(intercambios.estado, "en_curso")));
              if (enCurso >= EN_CURSO_POR_PERSONA) throw problema("demasiadas_solicitudes", "Tiene dos respuestas en curso: espere a que termine una");
              let conversacionId = cuerpo.conversacionId;
              if (conversacionId) {
                await conversacionPropia(tx, actor.usuarioId, conversacionId);
                const [enCurso] = await tx.select({ id: intercambios.id }).from(intercambios).where(and(eq(intercambios.conversacionId, conversacionId), eq(intercambios.estado, "en_curso")));
                if (enCurso) throw problema("estado_invalido", "Ya hay una respuesta en curso en esta conversación");
                await tx.update(conversaciones).set({ actualizadaEn: new Date() }).where(eq(conversaciones.id, conversacionId));
              } else {
                conversacionId = randomUUID();
                await tx.insert(conversaciones).values({ id: conversacionId, organizacionId: actor.organizacionId, usuarioId: actor.usuarioId, titulo: recortar(cuerpo.texto) });
              }
              const intercambioId = randomUUID();
              await tx.insert(intercambios).values({
                id: intercambioId,
                organizacionId: actor.organizacionId,
                conversacionId,
                usuarioId: actor.usuarioId,
                llave: cuerpo.llave,
                pregunta: cuerpo.texto,
                modelo: "pendiente",
              });
              await sumarGasto(tx, { organizacionId: actor.organizacionId, usuarioId: actor.usuarioId, preguntas: 1 });
              // En la misma transacción (outbox, ADR-0012); un solo intento, porque cada intento cuesta (ADR-0060). La cola es
              // de la organización: Graphile corre en serie los de una cola, así el asistente ocupa un solo cupo del worker por
              // organización.
              await encolar(tx, "asistente.responder", { organizacionId: actor.organizacionId, intercambioId }, { llave: `asistente.responder:${intercambioId}`, intentosMaximos: 1, cola: `asistente:${actor.organizacionId}` });
              return { conversacionId, intercambioId };
            });
          } catch (error) {
            // Dos pedidos con la misma llave a la vez: el segundo devuelve lo que creó el primero.
            if (esViolacionUnica(error, "intercambios_llave_idx")) {
              const previo = await enOrganizacion(bd, actor.organizacionId, repetida);
              if (previo) return previo;
            }
            if (esViolacionUnica(error, "intercambios_uno_en_curso_idx")) throw problema("estado_invalido", "Ya hay una respuesta en curso en esta conversación");
            throw error;
          }
        },
      });

      registrarOperacion(app, "detenerRespuestaDelAsistente", {
        politica: politicas.oficina,
        manejar: async ({ actor, parametros }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const [fila] = await tx.select({ estado: intercambios.estado }).from(intercambios).where(and(eq(intercambios.id, parametros.id), eq(intercambios.usuarioId, actor.usuarioId)));
            if (!fila) throw problema("no_encontrado", "La respuesta no existe");
            if (fila.estado === "en_curso") await detener(tx, eq(intercambios.id, parametros.id));
            return {};
          }),
      });

      registrarOperacion(app, "eliminarConversacionDelAsistente", {
        politica: politicas.oficina,
        manejar: async ({ actor, parametros }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const c = await conversacionPropia(tx, actor.usuarioId, parametros.id, { eliminadas: true });
            if (!c.eliminadaEn) await tx.update(conversaciones).set({ eliminadaEn: new Date() }).where(eq(conversaciones.id, c.id));
            // Una conversación borrada no sigue gastando.
            await detener(tx, eq(intercambios.conversacionId, c.id));
            return {};
          }),
      });

      registrarOperacion(app, "restaurarConversacionDelAsistente", {
        politica: politicas.oficina,
        manejar: async ({ actor, parametros }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const c = await conversacionPropia(tx, actor.usuarioId, parametros.id, { eliminadas: true });
            if (c.eliminadaEn) await tx.update(conversaciones).set({ eliminadaEn: null }).where(eq(conversaciones.id, c.id));
            return {};
          }),
      });

      registrarOperacion(app, "usoDelAsistente", {
        politica: politicas.administrador,
        manejar: async ({ actor }) => {
          const datos = await enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const porPersona = await tx
              .select({ usuarioId: gastos.usuarioId, preguntas: gastos.preguntas, gasto: sql<string>`${gastos.gastoUsd}::text` })
              .from(gastos)
              .where(eq(gastos.mes, mesActual));
            const [{ mes } = { mes: "" }] = await tx.execute<{ mes: string }>(sql`select ${mesActual} as mes`).then((r) => r.rows);
            return { mes, porPersona, gastoUsd: await gastoDelMes(tx), topeUsd: (await ajustesDe(tx)).topeUsd };
          });
          const nombres = await identidad.nombres(actor.organizacionId, datos.porPersona.map((p) => p.usuarioId));
          return {
            mes: datos.mes,
            gastoUsd: datos.gastoUsd,
            topeUsd: datos.topeUsd,
            preguntas: datos.porPersona.reduce((total, p) => total + p.preguntas, 0),
            porPersona: datos.porPersona
              .map((p) => ({ usuarioId: p.usuarioId, nombre: nombreDe(nombres, p.usuarioId), preguntas: p.preguntas, gastoUsd: decimalCorto(p.gasto) }))
              .sort((a, b) => b.preguntas - a.preguntas || a.nombre.localeCompare(b.nombre, "es")),
          };
        },
      });

      registrarOperacion(app, "cambiarTopeDelAsistente", {
        politica: politicas.administrador,
        manejar: async ({ actor, cuerpo, correlacion }) =>
          enOrganizacion(bd, actor.organizacionId, async (tx) => {
            const anterior = (await ajustesDe(tx)).topeUsd;
            await tx
              .insert(ajustes)
              .values({ organizacionId: actor.organizacionId, nombre: NOMBRE_POR_OMISION, topeMensualUsd: cuerpo.topeUsd })
              .onConflictDoUpdate({ target: ajustes.organizacionId, set: { topeMensualUsd: cuerpo.topeUsd } });
            await registrar(tx, [
              {
                ...autoria(actor, correlacion),
                agregadoTipo: "organizacion",
                agregadoId: actor.organizacionId,
                tipoEvento: "tope_del_asistente_cambiado",
                valorAnterior: { topeUsd: anterior },
                valorNuevo: { topeUsd: decimalCorto(cuerpo.topeUsd) },
              },
            ]);
            return {};
          }),
      });
    },
  };
}

