import { fotosReferenciadas } from "@teins/dominio";
import type { RepositorioLevantamientos } from "../datos/repositorio";
import { huella } from "./procesar";

export interface Verificacion {
  guardadas: number;
  integras: number;
  /** Fotos que un levantamiento menciona pero que no están en la base: pérdida real. */
  faltantes: number;
}

/** Solo las fotos de quien tiene la sesión: lo de otro técnico del mismo teléfono no se abre (ADR-0022). */
export async function verificarFotos(repositorio: RepositorioLevantamientos, tecnicoId: string): Promise<Verificacion> {
  const referenciadas = new Set((await repositorio.listar(tecnicoId)).flatMap((l) => fotosReferenciadas(l.respuestas)));
  const archivos = await repositorio.obtenerArchivos([...referenciadas]);
  let integras = 0;
  for (const a of archivos) if ((await huella(a.datos)) === a.id) integras++;
  return { guardadas: archivos.length, integras, faltantes: referenciadas.size - archivos.length };
}
