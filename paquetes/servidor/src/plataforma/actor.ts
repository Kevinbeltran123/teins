/** Quién hace la solicitud. Lo resuelve `identidad` a partir de la sesión; nunca lo declara el cliente. */
export interface Actor {
  usuarioId: string;
  organizacionId: string;
  rol: Rol;
  /** Persona de oficina que además administra (iteración 6). */
  administrador: boolean;
  /** Segundo factor activo (ADR-0009): sin él, la marca de administrador no habilita nada. */
  segundoFactor: boolean;
}

export type Rol = "tecnico" | "oficina";
export const ROLES: readonly Rol[] = ["tecnico", "oficina"];
