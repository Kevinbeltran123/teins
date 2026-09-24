import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Principal: la única acción amarilla de la pantalla (DESIGN.md, acento). */
  variante?: "principal" | "secundaria";
};

const variantes = {
  principal: "bg-acento text-sobre-acento font-bold",
  secundaria: "bg-panel text-texto font-bold border-[1.5px] border-borde-control",
};

/** Clase del botón, para enlaces que se ven como botón (navegación con forma de acción). */
export const claseBoton = (variante: "principal" | "secundaria" = "secundaria") =>
  `inline-flex min-h-tactil items-center justify-center gap-2 rounded-control px-5 text-cuerpo transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:shadow-[0_0_0_3px_var(--t-panel)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-superficie ${variantes[variante]}`;

export function Boton({ variante = "secundaria", className = "", type = "button", ...props }: Props) {
  return <button type={type} className={`${claseBoton(variante)} ${className}`} {...props} />;
}
