import type { Herramienta } from "../tipos";
import type { DependenciasDeHerramientas } from "./comun";
import { leerLevantamiento, valoresDeCampo } from "./levantamientos";
import { estimarMateriales, sumarMateriales } from "./materiales";
import { buscarEnCatalogo, buscarVisitas, ciudades, contarVisitas } from "./visitas";

export type { DependenciasDeHerramientas } from "./comun";

/**
 * Las herramientas de solo lectura del asistente (ADR-0060): cada una pide los datos a su módulo por la interfaz pública
 * y devuelve un resultado acotado y minimizado. Ninguna escribe.
 */
export function crearHerramientasDelAsistente(deps: DependenciasDeHerramientas): Herramienta[] {
  return [buscarEnCatalogo(deps), ciudades(deps), buscarVisitas(deps), sumarMateriales(deps), estimarMateriales(deps), contarVisitas(deps), valoresDeCampo(deps), leerLevantamiento(deps)];
}
