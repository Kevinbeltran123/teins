import type { VersionFormato } from "./formato";

/**
 * Versión vigente de cada formato para una app (ADR-0006, regla 3; ADR-0015, punto 4): la más
 * reciente que esa app sabe mostrar. Los levantamientos nuevos la usan; un borrador en curso
 * termina con la suya.
 */
export function versionesVigentes(versiones: readonly VersionFormato[], versionApp: number): VersionFormato[] {
  const vigentes = new Map<string, VersionFormato>();
  for (const v of versiones) {
    if ((v.appMinima ?? 0) > versionApp) continue;
    const actual = vigentes.get(v.formato);
    if (!actual || v.version > actual.version) vigentes.set(v.formato, v);
  }
  return [...vigentes.values()].sort((a, b) => (a.nombre ?? a.formato).localeCompare(b.nombre ?? b.formato, "es"));
}
