import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Principal: la única acción amarilla de la pantalla (DESIGN.md, acento). */
  variante?: "principal" | "secundaria";
};

const variantes = {
  principal: "bg-acento text-sobre-acento font-bold",
  secundaria: "bg-panel text-texto font-bold border-[1.5px] border-borde-control",
};

export function Boton({ variante = "secundaria", className = "", type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-tactil-campo items-center justify-center gap-2 rounded-control px-5 text-campo transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie ${variantes[variante]} ${className}`}
      {...props}
    />
  );
}
