import type { ReactNode } from "react";
import { CircleAlert } from "./iconos";

/** Etiqueta de campo. "Obligatorio" va escrito: el color o un asterisco no bastan (DESIGN.md). */
export function EtiquetaCampo({ children, obligatorio, htmlFor, id }: { children: ReactNode; obligatorio?: boolean | undefined; htmlFor?: string; id?: string }) {
  const contenido = (
    <>
      {children}
      {obligatorio && <span className="font-normal text-texto-secundario"> (obligatorio)</span>}
    </>
  );
  return htmlFor ? (
    <label htmlFor={htmlFor} id={id} className="text-cuerpo font-bold">
      {contenido}
    </label>
  ) : (
    <span id={id} className="text-cuerpo font-bold">
      {contenido}
    </span>
  );
}

export function MensajeError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-ayuda font-bold text-error">
      <CircleAlert aria-hidden className="mt-[0.15em] size-[1.1em] shrink-0" />
      <span>{children}</span>
    </p>
  );
}
