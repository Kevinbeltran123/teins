import type { Punto } from "@teins/dominio";

/**
 * Dónde queda la hoja en la pantalla del editor (ADR-0026): encajada en el espacio que dejan los controles y,
 * con dos dedos, acercada y movida sin salirse. Todo en píxeles del marco, con el origen arriba a la izquierda.
 */
export interface Tamano {
  ancho: number;
  alto: number;
}

/** La hoja a escala 1: centrada y tan grande como quepa. `escala` son píxeles por unidad del lienzo. */
export interface Encaje {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  escala: number;
}

/** Acercamiento sobre el encaje: `escala` de 1 a `ESCALA_MAXIMA`, y el corrimiento en píxeles. */
export interface Vista {
  escala: number;
  x: number;
  y: number;
}

export const ESCALA_MAXIMA = 4;
export const VISTA_COMPLETA: Vista = { escala: 1, x: 0, y: 0 };

export function encajar(marco: Tamano, hoja: Tamano): Encaje {
  const escala = Math.min(marco.ancho / hoja.ancho, marco.alto / hoja.alto);
  const [ancho, alto] = [hoja.ancho * escala, hoja.alto * escala];
  return { x: (marco.ancho - ancho) / 2, y: (marco.alto - alto) / 2, ancho, alto, escala };
}

/** Por cada eje: si la hoja cabe, queda centrada; si no, sus bordes no dejan ver lo que hay fuera de ella. */
export function limitar(v: Vista, marco: Tamano, e: Encaje): Vista {
  const eje = (corrido: number, tamano: number, contenedor: number, origen: number) => {
    const lleno = tamano * v.escala;
    if (lleno <= contenedor) return (contenedor - lleno) / 2 - origen;
    return Math.min(-origen, Math.max(contenedor - lleno - origen, corrido));
  };
  return { escala: v.escala, x: eje(v.x, e.ancho, marco.ancho, e.x), y: eje(v.y, e.alto, marco.alto, e.y) };
}

/**
 * Pellizco con dos dedos: el punto de la hoja que estaba bajo el centro de los dedos (`desde`) sigue bajo él
 * (`hasta`), con la escala multiplicada por `factor`.
 */
export function acercar(inicio: Vista, factor: number, desde: Punto, hasta: Punto, marco: Tamano, e: Encaje): Vista {
  const escala = Math.min(ESCALA_MAXIMA, Math.max(1, inicio.escala * factor));
  const [qx, qy] = [(desde[0] - e.x - inicio.x) / inicio.escala, (desde[1] - e.y - inicio.y) / inicio.escala];
  return limitar({ escala, x: hasta[0] - e.x - qx * escala, y: hasta[1] - e.y - qy * escala }, marco, e);
}

/** Un punto del lienzo, en píxeles del marco: para poner encima de la hoja lo que no es dibujo (las acciones). */
export const aPantalla = (p: Punto, v: Vista, e: Encaje): Punto => [e.x + v.x + p[0] * e.escala * v.escala, e.y + v.y + p[1] * e.escala * v.escala];
