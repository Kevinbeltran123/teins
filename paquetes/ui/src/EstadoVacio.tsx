import type { ReactNode } from "react";
import type { LucideIcon } from "./iconos";

/**
 * Lista sin nada: qué va a aparecer aquí y cómo llega (DESIGN.md, estados obligatorios). Una sola acción, y solo
 * si la pantalla no la tiene ya a la vista.
 */
export function EstadoVacio({ icono: Icono, titulo, children, accion }: { icono: LucideIcon; titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-borde-suave bg-panel px-6 py-8">
      <span className="flex size-10 items-center justify-center rounded-control bg-superficie-suave text-superficie [&_svg]:size-5">
        <Icono aria-hidden />
      </span>
      <div className="flex max-w-xl flex-col gap-1">
        <p className="text-cuerpo font-bold">{titulo}</p>
        {children && <div className="text-cuerpo text-texto-secundario">{children}</div>}
      </div>
      {accion}
    </div>
  );
}
