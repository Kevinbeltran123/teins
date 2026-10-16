import type { ReactNode } from "react";
import { CircleAlert } from "./iconos";

/** Etiqueta de campo. "Obligatorio" va escrito: el color o un asterisco no bastan (DESIGN.md). */
export function EtiquetaCampo({ children, obligatorio, htmlFor, id }: { children: ReactNode; obligatorio?: boolean | undefined; htmlFor?: string; id?: string }) {
  const contenido = (
    <>
      {children}
      {obligatorio && <span className="ml-2 text-ayuda font-normal text-texto-secundario">obligatorio</span>}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className="text-cuerpo font-medium">
      {contenido}
    </label>
  ) : (
    <span id={id} className="text-cuerpo font-medium">
      {contenido}
    </span>
  );
}

export function MensajeError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-ayuda font-medium text-error">
      <CircleAlert aria-hidden className="mt-[0.15em] size-[1.1em] shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Después de validar un formulario con errores, el foco va al primer campo marcado (DESIGN.md: validar al enviar, cada
 * campo con su mensaje). Espera al siguiente cuadro, cuando los campos ya llevan `aria-invalid`.
 */
export function enfocarPrimerError(formulario: string) {
  requestAnimationFrame(() => document.getElementById(formulario)?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
