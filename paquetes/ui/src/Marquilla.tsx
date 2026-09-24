import type { ReactNode } from "react";

/** Etiqueta con punta a la derecha. Solo identifica: códigos, unidades, estados (DESIGN.md). */
const tonos = {
  borrador: "bg-superficie-pista text-sobre-superficie",
  superficie: "bg-superficie text-sobre-superficie",
  /** Sobre el bloque azul del encabezado. */
  "sobre-superficie": "bg-panel text-superficie",
};

export function Marquilla({ tono, children }: { tono: keyof typeof tonos; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[30px] items-center pl-2.5 pr-[18px] text-ayuda font-bold ${tonos[tono]}`}
      style={{ clipPath: "polygon(0 0, calc(100% - var(--t-marquilla-punta-md)) 0, 100% 50%, calc(100% - var(--t-marquilla-punta-md)) 100%, 0 100%)" }}
    >
      {children}
    </span>
  );
}
