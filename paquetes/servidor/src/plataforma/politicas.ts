import type { Actor, Rol } from "./actor";

/**
 * Módulo central de políticas (ADR-0009). Ningún manejador verifica permisos por su cuenta:
 * cada ruta declara una de estas y el registro de rutas la aplica antes del manejador.
 */
export type Politica =
  | { tipo: "publica"; motivo: string }
  | { tipo: "roles"; roles: readonly Rol[] }
  /** Sin sesión: el manejador verifica el secreto del dispositivo (órdenes de borrado, ADR-0009). */
  | { tipo: "secreto_de_dispositivo" }
  /** Sesión del portal del cliente, con su propia cookie y su propio rol de base de datos (ADR-0009). */
  | { tipo: "sesion_de_portal" };

export const politicas = {
  /** Sin sesión. Solo para salud, contrato y autenticación; el motivo queda escrito. */
  publica: (motivo: string): Politica => ({ tipo: "publica", motivo }),
  autenticado: { tipo: "roles", roles: ["tecnico", "oficina"] } satisfies Politica,
  tecnico: { tipo: "roles", roles: ["tecnico"] } satisfies Politica,
  oficina: { tipo: "roles", roles: ["oficina"] } satisfies Politica,
} as const;

export type ResultadoPolitica = "permitido" | "no_autenticado" | "sin_permiso";

export function evaluar(politica: Politica, actor: Actor | null): ResultadoPolitica {
  if (politica.tipo === "publica" || politica.tipo === "secreto_de_dispositivo" || politica.tipo === "sesion_de_portal") return "permitido";
  if (!actor) return "no_autenticado";
  return politica.roles.includes(actor.rol) ? "permitido" : "sin_permiso";
}
