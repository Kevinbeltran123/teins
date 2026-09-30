import type { ReactNode } from "react";

/** Casilla con su texto; el texto explica, el color no basta (DESIGN.md). */
export function Casilla({ marcada, onCambio, deshabilitada, children }: { marcada: boolean; onCambio: (marcada: boolean) => void; deshabilitada?: boolean; children: ReactNode }) {
  return (
    <label
      className={`flex min-h-tactil items-center gap-3 text-cuerpo has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-superficie ${deshabilitada ? "cursor-not-allowed text-texto-secundario" : "cursor-pointer"}`}
    >
      <input type="checkbox" className="size-5 shrink-0 accent-superficie" checked={marcada} disabled={deshabilitada} onChange={(e) => onCambio(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}
