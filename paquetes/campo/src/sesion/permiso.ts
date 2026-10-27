import type { BajadaLocal } from "../datos/modelo";

/**
 * El permiso de trabajo local (ADR-0009, parte 2): vencido sin contacto, la captura se bloquea pero nada se borra.
 * Si además el servidor rechazó la sesión, conectarse no basta: hay que iniciar sesión. Sin bajada todavía no hay
 * permiso que vencer.
 */
export type PermisoLocal = "vigente" | "vencido" | "vencido_sin_sesion";

export function permisoLocal(bajada: Pick<BajadaLocal, "permisoLocalHasta" | "sesionVencida"> | null | undefined, ahora: number): PermisoLocal {
  if (!bajada || Date.parse(bajada.permisoLocalHasta) >= ahora) return "vigente";
  return bajada.sesionVencida ? "vencido_sin_sesion" : "vencido";
}
