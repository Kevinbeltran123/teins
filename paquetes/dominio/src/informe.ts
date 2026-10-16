import type { Repeticiones } from "./repeticiones";
import { validarSeleccion, type SeleccionInforme } from "./seleccion";
import type { VersionFormato } from "./formato";
import type { Respuestas } from "./levantamiento";
import type { EstadoRevision } from "./revision";
import { HUELLA_SHA256 } from "./validacion";

/** Plano elaborado en oficina con sus herramientas, adjunto como PDF (modelo de dominio: no se dibuja en el sistema). */
export interface Plano {
  huella: string;
  nombre: string;
}

/** Lo que oficina compone antes de publicar. */
export interface BorradorInforme {
  introduccion: string;
  conclusiones: string;
  /** En el orden en que aparecen en el informe. */
  levantamientos: readonly string[];
  planos: readonly Plano[];
  /** Qué sale de cada levantamiento (ADR-0039). */
  seleccion: SeleccionInforme;
}

export const LIMITES_INFORME = { texto: 20_000, planos: 20, nombrePlano: 200, levantamientos: 50 } as const;

export interface LevantamientoParaInforme {
  id: string;
  visitaId: string | null;
  estado: EstadoRevision;
}

export type ErrorInforme =
  | { codigo: "levantamiento_desconocido" | "levantamiento_repetido" | "otra_visita" | "no_revisado"; levantamientoId: string }
  | { codigo: "plano_invalido" | "plano_repetido"; huella: string }
  | { codigo: "texto_muy_largo"; campo: "introduccion" | "conclusiones" }
  | { codigo: "demasiados_elementos" }
  | { codigo: "sin_levantamientos" };

/**
 * Regla 9: un informe solo incluye levantamientos de su visita en estado revisado. El borrador se
 * valida al guardarlo; publicar exige además al menos un levantamiento.
 */
export function validarBorrador(visitaId: string, borrador: BorradorInforme, levantamientos: ReadonlyMap<string, LevantamientoParaInforme>): ErrorInforme[] {
  const errores: ErrorInforme[] = [];
  if (borrador.introduccion.length > LIMITES_INFORME.texto) errores.push({ codigo: "texto_muy_largo", campo: "introduccion" });
  if (borrador.conclusiones.length > LIMITES_INFORME.texto) errores.push({ codigo: "texto_muy_largo", campo: "conclusiones" });
  if (borrador.levantamientos.length > LIMITES_INFORME.levantamientos || borrador.planos.length > LIMITES_INFORME.planos || !validarSeleccion(borrador.seleccion)) errores.push({ codigo: "demasiados_elementos" });

  const vistos = new Set<string>();
  for (const id of borrador.levantamientos) {
    const l = levantamientos.get(id);
    if (vistos.has(id)) errores.push({ codigo: "levantamiento_repetido", levantamientoId: id });
    else if (!l) errores.push({ codigo: "levantamiento_desconocido", levantamientoId: id });
    else if (l.visitaId !== visitaId) errores.push({ codigo: "otra_visita", levantamientoId: id });
    else if (l.estado !== "revisado") errores.push({ codigo: "no_revisado", levantamientoId: id });
    vistos.add(id);
  }

  const huellas = new Set<string>();
  for (const p of borrador.planos) {
    if (!HUELLA_SHA256.test(p.huella) || !p.nombre.trim() || p.nombre.length > LIMITES_INFORME.nombrePlano) errores.push({ codigo: "plano_invalido", huella: p.huella });
    else if (huellas.has(p.huella)) errores.push({ codigo: "plano_repetido", huella: p.huella });
    huellas.add(p.huella);
  }
  return errores;
}

export function validarParaPublicar(visitaId: string, borrador: BorradorInforme, levantamientos: ReadonlyMap<string, LevantamientoParaInforme>): ErrorInforme[] {
  const errores = validarBorrador(visitaId, borrador, levantamientos);
  if (borrador.levantamientos.length === 0) errores.push({ codigo: "sin_levantamientos" });
  return errores;
}

/**
 * Copia congelada de una versión publicada (modelo de dominio: la versión es una copia, no una
 * referencia). Lleva todo lo que el PDF y el portal necesitan: nada se vuelve a leer de datos vivos.
 * Los datos personales van minimizados (regla 18): nombres de quienes capturaron y revisaron, nada más.
 */
export interface ContenidoVersion {
  formatoContenido: 1;
  numero: number;
  publicadaEn: string;
  publicadaPor: string;
  organizacion: { nombre: string };
  visita: { cliente: string; sitio: string; direccion: string; motivo: string; programadaPara: string };
  introduccion: string;
  conclusiones: string;
  levantamientos: {
    id: string;
    formato: VersionFormato;
    tecnico: string;
    revisor: string;
    recibidoEn: string;
    respuestas: Respuestas;
    /** Repeticiones de las secciones repetibles (iteración 9); ausente en las versiones anteriores. */
    repeticiones?: Repeticiones | undefined;
    /** Lo que oficina dejó fuera (ADR-0039), ya sin sus valores: "<bloque>" o "<bloque>|<campo>". Ausente antes. */
    ocultos?: readonly string[] | undefined;
  }[];
  planos: Plano[];
}
