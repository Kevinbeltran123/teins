import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle, type LucideIcon } from "./iconos";

/**
 * Principal: la acción que la pantalla o la sección existe para hacer; una por región (DESIGN.md).
 * Secundaria: las demás. Fantasma: acciones repetidas en filas y listas, que no deben competir con el contenido.
 * Peligro: solo el botón que confirma algo que no se deshace.
 */
export type VarianteBoton = "principal" | "secundaria" | "fantasma" | "peligro";
/** Normal para acciones de página y formularios; pequeño dentro de filas, tablas y barras de herramientas. */
export type TamanoBoton = "normal" | "pequeno";

const variantes: Record<VarianteBoton, string> = {
  principal: "bg-superficie text-sobre-superficie not-disabled:hover:bg-superficie-elevada",
  secundaria: "border border-borde-suave bg-panel text-texto not-disabled:hover:bg-panel-hundido",
  fantasma: "bg-transparent text-superficie not-disabled:hover:bg-encima",
  peligro: "bg-peligro text-sobre-peligro not-disabled:hover:brightness-90",
};

const tamanos: Record<TamanoBoton, string> = {
  normal: "min-h-control gap-2 px-4 text-cuerpo [&_svg]:size-[1.15em]",
  pequeno: "min-h-control-sm gap-1.5 px-3 text-ayuda [&_svg]:size-4",
};

const base =
  "inline-flex shrink-0 items-center justify-center rounded-control text-center font-bold transition-[background-color,filter,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 aria-busy:opacity-80 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie [&_svg]:shrink-0";

/** Clase del botón, para enlaces que se ven como botón (navegación con forma de acción). */
export const claseBoton = (variante: VarianteBoton = "secundaria", tamano: TamanoBoton = "normal") => `${base} ${variantes[variante]} ${tamanos[tamano]}`;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  /** Solo cuando ayuda a reconocer la acción de un vistazo (DESIGN.md, iconos). */
  icono?: LucideIcon | undefined;
  /**
   * Trabajando: el botón conserva su texto y el foco (no se deshabilita) y no repite la acción.
   * Deshabilitarlo le quitaría el foco a quien usa el teclado.
   */
  cargando?: boolean | undefined;
};

export function Boton({ variante = "secundaria", tamano = "normal", icono: Icono, cargando, className = "", type = "button", onClick, children, ...props }: Props) {
  return (
    <button
      type={type}
      className={`${claseBoton(variante, tamano)} ${className}`}
      aria-busy={cargando || undefined}
      onClick={(evento) => {
        if (cargando) {
          evento.preventDefault();
          return;
        }
        onClick?.(evento);
      }}
      {...props}
    >
      {cargando ? <LoaderCircle aria-hidden className="motion-safe:animate-spin" /> : Icono && <Icono aria-hidden />}
      {children}
    </button>
  );
}

const variantesIcono = {
  fantasma: "bg-transparent text-texto-secundario not-disabled:hover:bg-encima not-disabled:hover:text-texto",
  secundaria: "border border-borde-suave bg-panel text-texto not-disabled:hover:bg-panel-hundido",
};

/**
 * Botón de solo icono: acciones conocidas y repetidas (más acciones, subir, bajar, cerrar). Lleva el nombre
 * accesible y la misma frase como ayuda al pasar el cursor.
 */
export function BotonIcono({
  icono: Icono,
  etiqueta,
  variante = "fantasma",
  tamano = "normal",
  className = "",
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  icono: LucideIcon;
  etiqueta: string;
  variante?: keyof typeof variantesIcono;
  tamano?: TamanoBoton;
}) {
  const medida = tamano === "normal" ? "size-control [&_svg]:size-5" : "size-control-sm [&_svg]:size-4";
  return (
    <button type={type} aria-label={etiqueta} title={etiqueta} className={`${base} ${variantesIcono[variante]} ${medida} ${className}`} {...props}>
      <Icono aria-hidden />
    </button>
  );
}
