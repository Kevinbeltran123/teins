import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import type { LucideIcon } from "./iconos";

/**
 * Grupo flotante sobre un lienzo (editor de bocetos, ADR-0026): una barra compacta de iconos, como la de
 * GoodNotes, que deja el resto de la pantalla para el dibujo. Es una capa: lleva la sombra de menú.
 */
export function Pastilla({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`flex items-center rounded-panel border border-division bg-panel p-0.5 shadow-menu ${className}`} {...props} />;
}

/**
 * Botón de icono de 44 px dentro de una pastilla. Con `elegida` es una herramienta (la elegida, con la superficie
 * de marca); sin ella, una acción (volver, deshacer, rehacer). Lleva el nombre accesible y la misma ayuda al
 * pasar el cursor.
 */
export function BotonHerramienta({
  icono: Icono,
  etiqueta,
  elegida,
  className = "",
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "aria-pressed"> & { icono: LucideIcon; etiqueta: string; elegida?: boolean }) {
  return (
    <button
      type={type}
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={elegida}
      className={`flex size-control-sm shrink-0 items-center justify-center rounded-control text-texto transition-colors not-disabled:not-aria-pressed:hover:bg-encima disabled:text-borde-suave aria-pressed:bg-superficie aria-pressed:text-sobre-superficie focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-superficie [&_svg]:size-[22px] ${className}`}
      {...props}
    >
      <Icono aria-hidden />
    </button>
  );
}
