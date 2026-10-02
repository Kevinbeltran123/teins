import { archivosReferenciados, fotosReferenciadas, type Repeticiones, type Respuestas } from "@teins/dominio";
import type { EnviarLevantamiento } from "@teins/protocolo";
import type { BaseCampo } from "./base";
import { abrirBytes, abrirJson, contexto, enBorrado, sellarBytes, sellarJson } from "./cofre";
import type {
  ArchivoGuardado,
  ArchivoLocal,
  ComentarioDeOficina,
  EnvioGuardado,
  EnvioLocal,
  EstadoServidor,
  EstadoServidorGuardado,
  LevantamientoGuardado,
  LevantamientoLocal,
  VisitaGuardada,
  VisitaLocal,
} from "./modelo";

/**
 * Paso entre la forma guardada (sellada, ADR-0022) y la del dominio. Todo lo que lee o escribe la base
 * pasa por aquí: el resto de la app no sabe que existe el cifrado.
 */

interface ContenidoLevantamiento {
  respuestas: Respuestas;
  repeticiones: Repeticiones | null;
}

/** Huellas de los archivos del levantamiento, sin abrir el sellado. */
export function referencias(g: LevantamientoGuardado): { archivos: string[]; fotos: string[] } {
  if (g.archivos && g.fotos) return { archivos: g.archivos, fotos: g.fotos };
  const respuestas = g.respuestas ?? {};
  return { archivos: archivosReferenciados(respuestas), fotos: fotosReferenciadas(respuestas) };
}

export async function abrirLevantamiento(db: BaseCampo, g: LevantamientoGuardado): Promise<LevantamientoLocal> {
  const { sellado, archivos: _a, fotos: _f, rev: _r, respuestas, repeticiones, ...resto } = g;
  if (!sellado) return { ...resto, respuestas: respuestas ?? {}, ...(repeticiones ? { repeticiones } : {}) };
  const contenido = await abrirJson<ContenidoLevantamiento>(db, g.tecnicoId!, contexto.levantamiento(g.id), sellado);
  return { ...resto, respuestas: contenido.respuestas, ...(contenido.repeticiones ? { repeticiones: contenido.repeticiones } : {}) };
}

/** Sin responsable todavía (borradores del corte 0) no hay clave: queda a la vista hasta conocerlo. */
export async function sellarLevantamiento(db: BaseCampo, l: LevantamientoLocal, rev: number): Promise<LevantamientoGuardado> {
  const { respuestas, repeticiones, ...resto } = l;
  const huellas = { archivos: archivosReferenciados(respuestas), fotos: fotosReferenciadas(respuestas) };
  if (!l.tecnicoId) return { ...l, ...huellas, rev };
  const contenido: ContenidoLevantamiento = { respuestas, repeticiones: repeticiones ?? null };
  return { ...resto, ...huellas, rev, sellado: await sellarJson(db, l.tecnicoId, contexto.levantamiento(l.id), contenido) };
}

export async function abrirArchivo(db: BaseCampo, g: ArchivoGuardado): Promise<ArchivoLocal> {
  const { iv, tecnicoId: _t, cifrado: _c, ...resto } = g;
  if (!iv) return resto;
  return { ...resto, datos: await abrirBytes(db, g.tecnicoId!, contexto.archivo(g.id), { iv, datos: g.datos }) };
}

export async function sellarArchivo(db: BaseCampo, a: ArchivoLocal, tecnicoId: string | undefined): Promise<ArchivoGuardado> {
  if (!tecnicoId) return a;
  const { iv, datos } = await sellarBytes(db, tecnicoId, contexto.archivo(a.id), a.datos);
  return { ...a, datos, iv, tecnicoId, cifrado: 1 };
}

export async function abrirEnvio(db: BaseCampo, g: EnvioGuardado): Promise<EnvioLocal> {
  const { sellado, comando, ...resto } = g;
  if (!sellado) return { ...resto, comando: comando! };
  return { ...resto, comando: await abrirJson<EnviarLevantamiento>(db, g.tecnicoId, contexto.envio(g.levantamientoId), sellado) };
}

export async function sellarEnvio(db: BaseCampo, e: EnvioLocal): Promise<EnvioGuardado> {
  const { comando, ...resto } = e;
  return { ...resto, sellado: await sellarJson(db, e.tecnicoId, contexto.envio(e.levantamientoId), comando) };
}

type DatosDeVisita = Omit<VisitaLocal, "id" | "tecnicoId" | "fueraDeAlcance" | "motivoSalida" | "terminacionPendiente">;

export async function abrirVisita(db: BaseCampo, g: VisitaGuardada): Promise<VisitaLocal> {
  const { sellado, id, tecnicoId, fueraDeAlcance, motivoSalida, terminacionPendiente, ...resto } = g;
  const datos = sellado ? await abrirJson<DatosDeVisita>(db, tecnicoId, contexto.visita(tecnicoId, id), sellado) : (resto as DatosDeVisita);
  return {
    ...datos,
    id,
    tecnicoId,
    ...(fueraDeAlcance ? { fueraDeAlcance } : {}),
    ...(motivoSalida ? { motivoSalida } : {}),
    ...(terminacionPendiente ? { terminacionPendiente } : {}),
  };
}

export async function sellarVisita(db: BaseCampo, v: VisitaLocal): Promise<VisitaGuardada> {
  const { id, tecnicoId, fueraDeAlcance, motivoSalida, terminacionPendiente, ...datos } = v;
  return {
    id,
    tecnicoId,
    ...(fueraDeAlcance ? { fueraDeAlcance } : {}),
    ...(motivoSalida ? { motivoSalida } : {}),
    ...(terminacionPendiente ? { terminacionPendiente } : {}),
    sellado: await sellarJson(db, tecnicoId, contexto.visita(tecnicoId, id), datos),
  };
}

export async function abrirEstado(db: BaseCampo, g: EstadoServidorGuardado): Promise<EstadoServidor> {
  const { sellado, ...resto } = g;
  if (!sellado) return resto;
  return { ...resto, comentarios: await abrirJson<ComentarioDeOficina[]>(db, g.tecnicoId, contexto.estado(g.id), sellado) };
}

export async function sellarEstado(db: BaseCampo, e: EstadoServidor): Promise<EstadoServidorGuardado> {
  const { comentarios, ...resto } = e;
  return { ...resto, sellado: await sellarJson(db, e.tecnicoId, contexto.estado(e.id), comentarios ?? []) };
}

/**
 * Un archivo es de quien tiene el levantamiento que lo usa; sin responsable conocido, o si el responsable
 * tiene un borrado pendiente, no tiene dueño.
 */
async function duenosDeArchivos(db: BaseCampo, borrando: Set<string>): Promise<Map<string, string>> {
  const duenos = new Map<string, string>();
  for (const l of await db.levantamientos.toArray()) {
    if (l.tecnicoId && !borrando.has(l.tecnicoId)) for (const huella of referencias(l).archivos) if (!duenos.has(huella)) duenos.set(huella, l.tecnicoId);
  }
  return duenos;
}

/** Levantamientos a la vista que ya se pueden sellar: tienen responsable y no están por borrarse. */
const levantamientosPorSellar = (db: BaseCampo, borrando: Set<string>) => db.levantamientos.filter((l) => !l.sellado && l.tecnicoId !== undefined && !borrando.has(l.tecnicoId));

/** Registros a la vista que ya se pueden sellar (tienen responsable). Para el diagnóstico. */
export async function contarPorSellar(db: BaseCampo): Promise<number> {
  const borrando = await enBorrado(db);
  const duenos = await duenosDeArchivos(db, borrando);
  const sellados = new Set(await db.archivos.where("cifrado").equals(1).primaryKeys());
  const [levantamientos, archivos, envios, visitas, estados] = await Promise.all([
    levantamientosPorSellar(db, borrando).count(),
    db.archivos
      .toCollection()
      .primaryKeys()
      .then((huellas) => huellas.filter((h) => duenos.has(h) && !sellados.has(h)).length),
    db.envios.filter((e) => !e.sellado && !borrando.has(e.tecnicoId)).count(),
    db.visitas.filter((v) => !v.sellado && !borrando.has(v.tecnicoId)).count(),
    db.estadosServidor.filter((e) => !e.sellado && !borrando.has(e.tecnicoId)).count(),
  ]);
  return levantamientos + archivos + envios + visitas + estados;
}

/**
 * Sella lo que quedó a la vista de antes del cifrado (regla 5: se transforma, nunca se borra). Cada
 * registro se lee, se sella fuera de la transacción y se escribe solo si nadie lo cambió entre tanto;
 * si cambió, lo sella quien lo cambió o la próxima pasada. Se puede interrumpir y repetir.
 */
export async function sellarPendientes(db: BaseCampo): Promise<void> {
  // Lo de un técnico con un borrado pendiente no se sella: `completarBorrados` lo borra.
  const borrando = await enBorrado(db);
  for (const g of await levantamientosPorSellar(db, borrando).toArray()) {
    const nuevo = await sellarLevantamiento(db, await abrirLevantamiento(db, g), (g.rev ?? 0) + 1);
    await db.transaction("rw", db.levantamientos, async () => {
      const actual = await db.levantamientos.get(g.id);
      if (actual && !actual.sellado && (actual.rev ?? 0) === (g.rev ?? 0) && actual.tecnicoId === g.tecnicoId) await db.levantamientos.put(nuevo);
    });
  }

  // Sin responsable conocido, el archivo espera.
  const duenos = await duenosDeArchivos(db, borrando);
  // De a uno: las fotos pesan, y en un teléfono no caben todas en memoria a la vez.
  const sellados = new Set(await db.archivos.where("cifrado").equals(1).primaryKeys());
  for (const huella of await db.archivos.toCollection().primaryKeys()) {
    const dueno = duenos.get(huella);
    if (sellados.has(huella) || !dueno) continue;
    const a = await db.archivos.get(huella);
    if (!a || a.iv) continue;
    const sellado = await sellarArchivo(db, a, dueno);
    await db.transaction("rw", db.archivos, async () => {
      const actual = await db.archivos.get(a.id);
      // El contenido no cambia (se direcciona por su huella); el estado de subida sí puede haber cambiado.
      if (actual && !actual.iv) await db.archivos.put({ ...sellado, subida: actual.subida, ultimoErrorDeSubida: actual.ultimoErrorDeSubida });
    });
  }

  for (const e of await db.envios.filter((e) => !e.sellado && !borrando.has(e.tecnicoId)).toArray()) {
    if (!e.comando) continue;
    const sellado = await sellarEnvio(db, await abrirEnvio(db, e));
    await db.transaction("rw", db.envios, async () => {
      const actual = await db.envios.get(e.levantamientoId);
      // El comando es inmutable; estado e intentos se toman de lo actual.
      if (actual && !actual.sellado) {
        const { comando: _c, ...resto } = actual;
        await db.envios.put({ ...resto, sellado: sellado.sellado });
      }
    });
  }

  for (const v of await db.visitas.filter((v) => !v.sellado && !borrando.has(v.tecnicoId)).toArray()) {
    const sellada = await sellarVisita(db, await abrirVisita(db, v));
    await db.transaction("rw", db.visitas, async () => {
      const actual = await db.visitas.get([v.tecnicoId, v.id]);
      if (actual && !actual.sellado && JSON.stringify(actual) === JSON.stringify(v)) await db.visitas.put(sellada);
    });
  }

  for (const e of await db.estadosServidor.filter((e) => !e.sellado && !borrando.has(e.tecnicoId)).toArray()) {
    const sellado = await sellarEstado(db, await abrirEstado(db, e));
    await db.transaction("rw", db.estadosServidor, async () => {
      const actual = await db.estadosServidor.get(e.id);
      if (actual && !actual.sellado && JSON.stringify(actual) === JSON.stringify(e)) await db.estadosServidor.put(sellado);
    });
  }
}
