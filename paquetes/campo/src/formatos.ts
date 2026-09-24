import type { Levantamiento, VersionFormato } from "@teins/dominio";
import v1 from "@teins/dominio/formatos-de-prueba/prueba-ups.v1.json";
import v2 from "@teins/dominio/formatos-de-prueba/prueba-ups.v2.json";

/**
 * Formatos incluidos en la app hasta que la bajada del corte 2 los entregue como datos.
 * Ficticios (R5). Un borrador termina con la versión con que empezó (ADR-0006, regla 3).
 */
const incluidos = [v1, v2] as VersionFormato[];

export const NOMBRE_FORMATO = "Formato de prueba";

/** Versión con la que se crean los levantamientos nuevos. */
export const formatoVigente: VersionFormato = incluidos.reduce((a, b) => (b.version > a.version ? b : a));

export function formatoDe(levantamiento: Pick<Levantamiento, "formato" | "versionFormato">): VersionFormato | undefined {
  return incluidos.find((f) => f.formato === levantamiento.formato && f.version === levantamiento.versionFormato);
}
