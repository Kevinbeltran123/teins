import type { ReactNode } from "react";

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
    <p id={id} className="text-ayuda font-bold text-error">
      {children}
    </p>
  );
}
