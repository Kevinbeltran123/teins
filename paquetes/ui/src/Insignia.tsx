import type { ReactNode } from "react";

/**
 * Insignia de estado: una o dos palabras con su color. El texto siempre va: el color nunca es la única
 * señal (DESIGN.md). Los estados del documento tienen colores fijos para toda organización (ADR-0020).
 */
const tonos = {
  borrador: "bg-superficie-pista text-sobre-superficie",
  enviado: "bg-estado-enviado-fondo text-estado-enviado-texto",
  revision: "bg-estado-revision-fondo text-estado-revision-texto",
  revisado: "bg-estado-revisado-fondo text-estado-revisado-texto",
  publicado: "bg-superficie text-sobre-superficie",
  anulado: "bg-estado-anulado-fondo text-estado-anulado-texto",
  /** Algo en uso o vigente: acceso activo, ítem activo. */
  exito: "bg-exito-fondo text-exito-texto",
  /** Algo inactivo o sin configurar: sin acceso, desactivado. */
  neutro: "bg-division text-texto",
  alerta: "bg-alerta-fondo text-alerta-texto",
  peligro: "bg-peligro-fondo text-error",
  /** Lo recién creado en esta pantalla. */
  nuevo: "bg-acento text-sobre-acento",
};

export type TonoInsignia = keyof typeof tonos;

export function Insignia({ tono, children }: { tono: TonoInsignia; children: ReactNode }) {
  return <span className={`inline-flex min-h-6 shrink-0 items-center rounded-control px-2 py-0.5 text-ayuda leading-tight font-bold whitespace-nowrap ${tonos[tono]}`}>{children}</span>;
}
