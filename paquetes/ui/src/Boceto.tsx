import type { ReactNode, Ref } from "react";

/**
 * Un boceto dibujado con los tokens (ADR-0019): el mismo en la miniatura de campo, el lienzo del editor y
 * la revisión de oficina. La forma del documento la define `dominio`; aquí solo lo que hace falta para
 * dibujarlo, para que `ui` no dependa de otro paquete.
 */
type Par = readonly [number, number];
export type ElementoDibujable =
  | { tipo: "trazo"; contorno: readonly Par[] }
  | { tipo: "linea"; grosor: number; desde: Par; hasta: Par }
  | { tipo: "texto"; en: Par; texto: string; tamano: number };

export function Boceto({
  ancho,
  alto,
  cuadricula,
  elementos,
  etiqueta,
  children,
  ref,
  className = "",
}: {
  ancho: number;
  alto: number;
  cuadricula: number;
  elementos: readonly ElementoDibujable[];
  /** Nombre accesible del boceto: su campo ("Croquis del cuarto"). */
  etiqueta: string;
  /** Lo que el editor dibuja encima mientras se traza. */
  children?: ReactNode;
  ref?: Ref<SVGSVGElement>;
  className?: string;
}) {
  const lineas: string[] = [];
  for (let x = cuadricula; x < ancho; x += cuadricula) lineas.push(`M${x} 0V${alto}`);
  for (let y = cuadricula; y < alto; y += cuadricula) lineas.push(`M0 ${y}H${ancho}`);
  return (
    <svg ref={ref} role="img" aria-label={etiqueta} viewBox={`0 0 ${ancho} ${alto}`} className={`block h-auto w-full bg-panel ${className}`}>
      <path d={lineas.join("")} className="fill-none stroke-division" strokeWidth={1} />
      {elementos.map((e, i) => (
        <ElementoDeBoceto key={i} elemento={e} />
      ))}
      {children}
    </svg>
  );
}

export function ElementoDeBoceto({ elemento: e }: { elemento: ElementoDibujable }) {
  if (e.tipo === "trazo") {
    const [primero, ...resto] = e.contorno;
    return primero ? <path d={`M${primero[0]} ${primero[1]}${resto.map(([x, y]) => `L${x} ${y}`).join("")}Z`} className="fill-texto" /> : null;
  }
  if (e.tipo === "linea") {
    return <line x1={e.desde[0]} y1={e.desde[1]} x2={e.hasta[0]} y2={e.hasta[1]} className="stroke-texto" strokeWidth={e.grosor} strokeLinecap="round" />;
  }
  return (
    <text x={e.en[0]} y={e.en[1]} fontSize={e.tamano} className="fill-texto font-texto">
      {e.texto}
    </text>
  );
}
