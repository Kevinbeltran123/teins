/** Quién hace la solicitud. Lo resuelve `identidad` a partir de la sesión; nunca lo declara el cliente. */
export interface Actor {
  usuarioId: string;
  organizacionId: string;
  rol: Rol;
}

export type Rol = "tecnico" | "oficina";
export const ROLES: readonly Rol[] = ["tecnico", "oficina"];
