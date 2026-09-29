import { randomUUID } from "node:crypto";
import { bloqueDe, corregir, marcarRevisado, puedeEditar, tomarRevision, type EstadoRevision, type Valor } from "@teins/dominio";
import type { Actor } from "../../../plataforma/actor";
import { enOrganizacion, type BaseDeDatos, type TxOrganizacion } from "../../../plataforma/base-de-datos";
import { problema } from "../../../plataforma/errores";
import type { Avisar, LevantamientoEnRevision, PuertoCatalogo, PuertoFormatos, RegistrarAuditoria, RegistrarCambios, RepositorioRevision } from "./puertos";

export interface DependenciasRevision {
  bd: BaseDeDatos;
  repositorio: RepositorioRevision;
  formatos: PuertoFormatos;
  registrarAuditoria: RegistrarAuditoria;
  registrarCambios: RegistrarCambios;
  avisar: Avisar;
  catalogo: PuertoCatalogo;
  /** Para decir quién tiene la revisión cuando otra persona intenta tomarla. */
  nombres: (organizacionId: string, ids: readonly string[], en?: TxOrganizacion) => Promise<Map<string, string>>;
  reloj?: () => Date;
}

export interface EstadoDeRevision {
  estado: EstadoRevision;
  revisorId: string | null;
  version: number;
}

/**
 * Carga el levantamiento y exige que la persona haya visto la versión vigente (QA-25): si otra guardó
 * antes, se rechaza y se avisa, en lugar de pisar su cambio en silencio.
 */
function conVersion<T>(
  deps: DependenciasRevision,
  actor: Actor,
  id: string,
  versionVista: number,
  fn: (tx: TxOrganizacion, actual: LevantamientoEnRevision) => Promise<T>,
): Promise<T> {
  return enOrganizacion(deps.bd, actor.organizacionId, async (tx) => {
    const actual = await deps.repositorio.obtener(tx, id);
    if (!actual) throw problema("no_encontrado");
    if (actual.version !== versionVista) throw conflicto(actual.version);
    return fn(tx, actual);
  });
}

const conflicto = (versionActual?: number) =>
  problema("conflicto_de_version", "Otra persona guardó cambios en este levantamiento. Recargue para ver la versión actual.", versionActual ? { versionActual } : {});

/** El UPDATE con la versión vista resuelve la carrera entre dos guardados que leyeron lo mismo. */
async function guardar(deps: DependenciasRevision, tx: TxOrganizacion, actual: LevantamientoEnRevision, cambios: Parameters<RepositorioRevision["actualizar"]>[3]) {
  if (!(await deps.repositorio.actualizar(tx, actual.id, actual.version, cambios))) throw conflicto();
  return actual.version + 1;
}

/** El técnico ve el estado y los comentarios de su levantamiento en la siguiente bajada. */
const avisarAlTecnico = (deps: DependenciasRevision, tx: TxOrganizacion, actor: Actor, actual: LevantamientoEnRevision) =>
  deps.registrarCambios(tx, [{ organizacionId: actor.organizacionId, usuarioId: actual.tecnicoId, entidad: "levantamiento", entidadId: actual.id, operacion: "cambio" }]);

const comun = (actor: Actor, id: string, correlacion: string) => ({
  organizacionId: actor.organizacionId,
  agregadoTipo: "levantamiento" as const,
  agregadoId: id,
  autorId: actor.usuarioId,
  correlacion,
});

export function tomar(deps: DependenciasRevision, actor: Actor, id: string, versionVista: number, reasignar: boolean, correlacion: string): Promise<EstadoDeRevision> {
  return conVersion(deps, actor, id, versionVista, async (tx, actual) => {
    const r = tomarRevision({ estado: actual.estado, revisorId: actual.revisorId }, actor.usuarioId, reasignar);
    if (!r.ok) {
      // Tomar dos veces lo propio no es un error: responde el estado vigente.
      if (r.motivo === "ya_es_suya") return { estado: actual.estado, revisorId: actual.revisorId, version: actual.version };
      if (r.motivo === "tomado_por_otro") {
        const nombre = (await deps.nombres(actor.organizacionId, [r.revisorId], tx)).get(r.revisorId) ?? "[Usuario no disponible]";
        throw problema("tomado_por_otro", `${nombre} tiene la revisión de este levantamiento`, { revisor: { id: r.revisorId, nombre }, versionActual: actual.version });
      }
      throw problema("estado_invalido", "Este levantamiento ya no se puede tomar para revisar");
    }
    const version = await guardar(deps, tx, actual, { estado: r.revision.estado, revisorId: actor.usuarioId, tomadoEn: (deps.reloj ?? (() => new Date()))() });
    await deps.registrarAuditoria(tx, [
      r.anterior
        ? { ...comun(actor, id, correlacion), tipoEvento: "revision_reasignada", valorAnterior: { revisor: r.anterior }, valorNuevo: { revisor: actor.usuarioId } }
        : { ...comun(actor, id, correlacion), tipoEvento: "revision_tomada", valorNuevo: { revisor: actor.usuarioId } },
    ]);
    await avisarAlTecnico(deps, tx, actor, actual);
    return { ...r.revision, version };
  });
}

export interface CorreccionPedida {
  seccion: string;
  campo: string;
  valor: Valor | null;
}

export function corregirCampos(
  deps: DependenciasRevision,
  actor: Actor,
  id: string,
  versionVista: number,
  pedidas: readonly CorreccionPedida[],
  motivo: string | undefined,
  correlacion: string,
): Promise<{ version: number; cambios: number }> {
  return conVersion(deps, actor, id, versionVista, async (tx, actual) => {
    const sinPermiso = puedeEditar({ estado: actual.estado, revisorId: actual.revisorId }, actor.usuarioId);
    if (sinPermiso === "no_tomado") throw problema("no_tomado", "Solo quien tomó la revisión corrige este levantamiento");
    if (sinPermiso) throw problema("estado_invalido", "Solo se corrige un levantamiento en revisión");
    const formato = await deps.formatos.obtener(tx, actual.formato, actual.versionFormato);
    if (!formato) throw problema("error_interno", "El formato del levantamiento no existe");

    const r = corregir(formato, actual.respuestas, pedidas.map((c) => ({ seccion: c.seccion, campo: c.campo, valor: c.valor ?? undefined })), actual.repeticiones);
    if (!r.ok) throw problema("respuestas_invalidas", undefined, { errores: r.errores });
    if (r.cambios.length === 0) return { version: actual.version, cambios: 0 };

    const version = await guardar(deps, tx, actual, { respuestas: r.respuestas });
    await deps.repositorio.proyectarCantidades(tx, {
      organizacionId: actor.organizacionId,
      levantamientoId: id,
      formato,
      respuestas: r.respuestas,
      repeticiones: actual.repeticiones,
    });
    // Un registro por campo, todos con la misma correlación: "estos cambios fueron un solo guardado" (ADR-0008).
    await deps.registrarAuditoria(
      tx,
      r.cambios.map((c) => ({
        ...comun(actor, id, correlacion),
        tipoEvento: "campo_corregido" as const,
        rutaCampo: `${c.seccion}.${c.campo}`,
        valorAnterior: c.anterior ?? null,
        valorNuevo: c.nuevo ?? null,
        ...(motivo ? { motivo } : {}),
      })),
    );
    return { version, cambios: r.cambios.length };
  });
}

export function marcar(deps: DependenciasRevision, actor: Actor, id: string, versionVista: number, correlacion: string): Promise<EstadoDeRevision> {
  return conVersion(deps, actor, id, versionVista, async (tx, actual) => {
    const formato = await deps.formatos.obtener(tx, actual.formato, actual.versionFormato);
    if (!formato) throw problema("error_interno", "El formato del levantamiento no existe");
    const r = marcarRevisado({ estado: actual.estado, revisorId: actual.revisorId }, actor.usuarioId, formato, actual.respuestas, actual.repeticiones);
    if (!r.ok) {
      if (r.motivo === "respuestas_invalidas") throw problema("respuestas_invalidas", undefined, { errores: r.errores });
      if (r.motivo === "no_tomado") throw problema("no_tomado", "Solo quien tomó la revisión la marca como revisada");
      throw problema("estado_invalido", "Solo se marca revisado un levantamiento en revisión");
    }
    const version = await guardar(deps, tx, actual, { estado: "revisado", revisadoEn: (deps.reloj ?? (() => new Date()))() });
    await deps.registrarAuditoria(tx, [{ ...comun(actor, id, correlacion), tipoEvento: "levantamiento_revisado" }]);
    await deps.avisar(tx, { tipo: "levantamiento_revisado", organizacionId: actor.organizacionId, tecnicoId: actual.tecnicoId, levantamientoId: id, creadoEn: actual.creadoEnDispositivo });
    await avisarAlTecnico(deps, tx, actor, actual);
    return { ...r.revision, version };
  });
}

export interface ComentarioCreado {
  id: string;
  texto: string;
  seccion: string | null;
  campo: string | null;
  creadoEn: Date;
}

/** Cualquier persona de oficina comenta; el comentario no modifica datos ni la versión. */
export function comentar(
  deps: DependenciasRevision,
  actor: Actor,
  id: string,
  datos: { texto: string; seccion?: string | undefined; campo?: string | undefined },
  correlacion: string,
): Promise<ComentarioCreado> {
  return enOrganizacion(deps.bd, actor.organizacionId, async (tx) => {
    const actual = await deps.repositorio.obtener(tx, id);
    if (!actual) throw problema("no_encontrado");
    if (datos.campo && !datos.seccion) throw problema("entrada_invalida", "Un comentario sobre un campo necesita su sección");
    if (datos.seccion) {
      const formato = await deps.formatos.obtener(tx, actual.formato, actual.versionFormato);
      // También una repetición de una sección repetible (`tableros~id`), si existe en este levantamiento.
      const seccion = formato && bloqueDe(formato, actual.repeticiones, datos.seccion)?.seccion;
      if (!seccion || (datos.campo && !seccion.campos.some((c) => c.clave === datos.campo))) {
        throw problema("entrada_invalida", "El comentario apunta a un campo que no está en el formato");
      }
    }
    const comentario = {
      id: randomUUID(),
      organizacionId: actor.organizacionId,
      levantamientoId: id,
      autorId: actor.usuarioId,
      texto: datos.texto,
      seccion: datos.seccion ?? null,
      campo: datos.campo ?? null,
      creadoEn: (deps.reloj ?? (() => new Date()))(),
    };
    await deps.repositorio.agregarComentario(tx, comentario);
    await deps.registrarAuditoria(tx, [
      {
        ...comun(actor, id, correlacion),
        tipoEvento: "comentario_agregado",
        ...(datos.seccion ? { rutaCampo: datos.campo ? `${datos.seccion}.${datos.campo}` : datos.seccion } : {}),
        valorNuevo: { texto: datos.texto },
      },
    ]);
    await deps.avisar(tx, { tipo: "comentario", organizacionId: actor.organizacionId, tecnicoId: actual.tecnicoId, levantamientoId: id, creadoEn: actual.creadoEnDispositivo });
    await avisarAlTecnico(deps, tx, actor, actual);
    return comentario;
  });
}

/**
 * Vincula una línea de cantidad al catálogo (regla 6: lo completa oficina). Solo quien tiene la revisión,
 * con la versión vista (QA-25); queda en la auditoría como un cambio posterior al envío (regla 8).
 */
export function vincular(
  deps: DependenciasRevision,
  actor: Actor,
  id: string,
  datos: { version: number; seccion: string; campo: string; linea: string; itemId: string | null },
  correlacion: string,
): Promise<{ version: number }> {
  return conVersion(deps, actor, id, datos.version, async (tx, actual) => {
    const sinPermiso = puedeEditar({ estado: actual.estado, revisorId: actual.revisorId }, actor.usuarioId);
    if (sinPermiso === "no_tomado") throw problema("no_tomado", "Solo quien tomó la revisión vincula las cantidades");
    if (sinPermiso) throw problema("estado_invalido", "Solo se vincula en un levantamiento en revisión");
    if (datos.itemId) {
      const item = (await deps.catalogo.items(tx, [datos.itemId])).get(datos.itemId);
      if (!item?.activo) throw problema("entrada_invalida", "El ítem no existe en el catálogo o está desactivado");
    }
    const anterior = await deps.repositorio.vincularLinea(tx, { levantamientoId: id, ...datos, autorId: actor.usuarioId });
    if (anterior === undefined) throw problema("no_encontrado", "La línea no existe en este levantamiento");
    if (anterior === datos.itemId) return { version: actual.version };
    const version = await guardar(deps, tx, actual, {});
    await deps.registrarAuditoria(tx, [
      {
        ...comun(actor, id, correlacion),
        tipoEvento: "linea_vinculada" as const,
        rutaCampo: `${datos.seccion}.${datos.campo}`,
        valorAnterior: { linea: datos.linea, item: anterior },
        valorNuevo: { linea: datos.linea, item: datos.itemId },
      },
    ]);
    return { version };
  });
}
