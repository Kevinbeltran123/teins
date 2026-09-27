import type { ReactNode, Ref } from "react";
import { ElementoDeBoceto, type ElementoDibujable } from "./Boceto";

type Par = readonly [number, number];

function puntosDe(e: ElementoDibujable): readonly Par[] {
  switch (e.tipo) {
    case "trazo":
      return e.contorno;
    case "linea":
    case "cota":
      return [e.desde, e.hasta];
    case "texto":
      return [e.en];
    case "polilinea":
      return e.puntos;
    case "simbolo": {
      const r = (e.tamano / 2) * Math.SQRT2;
      return [
        [e.centro[0] - r, e.centro[1] - r],
        [e.centro[0] + r, e.centro[1] + r],
      ];
    }
    case "elipse": {
      const r = Math.max(...e.radios);
      return [
        [e.centro[0] - r, e.centro[1] - r],
        [e.centro[0] + r, e.centro[1] + r],
      ];
    }
  }
}

/**
 * Una firma (ADR-0024): los trazos de un boceto sin cuadrícula. Recortada, muestra solo la firma con un margen;
 * sin recortar, es el recuadro donde se firma (el lienzo completo, para que el dedo y el dibujo coincidan).
 */
export function Firma({
  ancho,
  alto,
  elementos,
  etiqueta,
  recortar = true,
  children,
  ref,
  className = "",
}: {
  ancho: number;
  alto: number;
  elementos: readonly ElementoDibujable[];
  /** Nombre accesible: "Firma de Martha Gómez". */
  etiqueta: string;
  recortar?: boolean;
  /** Lo que se dibuja encima mientras se firma (el trazo en curso, la línea guía). */
  children?: ReactNode;
  ref?: Ref<SVGSVGElement>;
  className?: string;
}) {
  const puntos = elementos.flatMap(puntosDe);
  let caja = `0 0 ${ancho} ${alto}`;
  if (recortar && puntos.length > 0) {
    const margen = 12;
    const xs = puntos.map(([x]) => x);
    const ys = puntos.map(([, y]) => y);
    const x = Math.max(0, Math.min(...xs) - margen);
    const y = Math.max(0, Math.min(...ys) - margen);
    caja = `${x} ${y} ${Math.min(ancho, Math.max(...xs) + margen) - x} ${Math.min(alto, Math.max(...ys) + margen) - y}`;
  }
  return (
    <svg ref={ref} role="img" aria-label={etiqueta} viewBox={caja} className={`block h-auto w-full ${className}`}>
      {children}
      {elementos.map((e, i) => (
        <ElementoDeBoceto key={i} elemento={e} />
      ))}
    </svg>
  );
}
