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
  | { tipo: "texto"; en: Par; texto: string; tamano: number }
  /** Versión 2 (ADR-0026). */
  | { tipo: "polilinea"; grosor: number; puntos: readonly Par[]; cerrada: boolean }
  | { tipo: "elipse"; grosor: number; centro: Par; radios: Par; giro: number }
  | { tipo: "cota"; grosor: number; desde: Par; hasta: Par; texto: string };

/** La misma cuenta de `geometriaDeCota` en `dominio` (el PDF): topes perpendiculares y el texto sin quedar de cabeza. */
function cota(desde: Par, hasta: Par) {
  const [dx, dy] = [hasta[0] - desde[0], hasta[1] - desde[1]];
  const largo = Math.hypot(dx, dy) || 1;
  const [nx, ny] = [(-dy / largo) * 14, (dx / largo) * 14];
  let angulo = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angulo > 90) angulo -= 180;
  if (angulo < -90) angulo += 180;
  const radianes = (angulo * Math.PI) / 180;
  const medio = [(desde[0] + hasta[0]) / 2, (desde[1] + hasta[1]) / 2] as const;
  return { nx, ny, angulo, textoEn: [medio[0] + Math.sin(radianes) * 16, medio[1] - Math.cos(radianes) * 16] as const };
}

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

/** Lo que hace falta para dibujar una hoja; la forma completa la define `dominio` (ADR-0026). */
export interface HojaDibujable {
  nombre: string;
  ancho: number;
  alto: number;
  elementos: readonly ElementoDibujable[];
}

/**
 * Las hojas de un boceto, para leerlo (la captura en campo, la revisión en oficina): las verticales de a dos por
 * fila y una apaisada (de la versión 1) a lo ancho. Con varias hojas, cada una lleva su nombre ("Segundo piso") y,
 * con `alAbrir`, tocarla abre esa hoja en el editor.
 */
export function HojasDeBoceto({ hojas, cuadricula, etiqueta, alAbrir }: { hojas: readonly HojaDibujable[]; cuadricula: number; etiqueta: string; alAbrir?: ((indice: number) => void) | undefined }) {
  const varias = hojas.length > 1;
  return (
    <div className="grid grid-cols-2 gap-3">
      {hojas.map((h, i) => {
        const dibujo = (
          <Boceto ancho={h.ancho} alto={h.alto} cuadricula={cuadricula} elementos={h.elementos} etiqueta={varias ? `${etiqueta}: ${h.nombre}` : etiqueta} className="rounded-control border border-division" />
        );
        return (
          <figure key={i} className={`m-0 flex min-w-0 flex-col gap-1.5 ${h.ancho > h.alto ? "col-span-2" : ""}`}>
            {varias && alAbrir ? (
              <button type="button" aria-label={`Abrir ${h.nombre}`} className="block rounded-control focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie" onClick={() => alAbrir(i)}>
                {dibujo}
              </button>
            ) : (
              dibujo
            )}
            {varias && <figcaption className="truncate text-ayuda font-bold">{h.nombre}</figcaption>}
          </figure>
        );
      })}
    </div>
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
  if (e.tipo === "polilinea") {
    const puntos = e.puntos.map(([x, y]) => `${x},${y}`).join(" ");
    return e.cerrada ? (
      <polygon points={puntos} className="fill-none stroke-texto" strokeWidth={e.grosor} strokeLinejoin="round" />
    ) : (
      <polyline points={puntos} className="fill-none stroke-texto" strokeWidth={e.grosor} strokeLinejoin="round" strokeLinecap="round" />
    );
  }
  if (e.tipo === "elipse") {
    return <ellipse cx={e.centro[0]} cy={e.centro[1]} rx={e.radios[0]} ry={e.radios[1]} transform={`rotate(${e.giro} ${e.centro[0]} ${e.centro[1]})`} className="fill-none stroke-texto" strokeWidth={e.grosor} />;
  }
  if (e.tipo === "cota") {
    const g = cota(e.desde, e.hasta);
    return (
      <g className="stroke-texto" strokeWidth={e.grosor} strokeLinecap="round">
        <line x1={e.desde[0]} y1={e.desde[1]} x2={e.hasta[0]} y2={e.hasta[1]} />
        <line x1={e.desde[0] - g.nx} y1={e.desde[1] - g.ny} x2={e.desde[0] + g.nx} y2={e.desde[1] + g.ny} />
        <line x1={e.hasta[0] - g.nx} y1={e.hasta[1] - g.ny} x2={e.hasta[0] + g.nx} y2={e.hasta[1] + g.ny} />
        <text x={g.textoEn[0]} y={g.textoEn[1]} fontSize={28} textAnchor="middle" transform={`rotate(${g.angulo} ${g.textoEn[0]} ${g.textoEn[1]})`} className="fill-texto stroke-none font-texto">
          {e.texto}
        </text>
      </g>
    );
  }
  return (
    <text x={e.en[0]} y={e.en[1]} fontSize={e.tamano} className="fill-texto font-texto">
      {e.texto}
    </text>
  );
}
