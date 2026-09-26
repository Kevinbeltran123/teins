/**
 * Boceto (ADR-0019): croquis a mano sobre cuadrícula, guardado como documento vectorial y no como imagen.
 * Viaja como archivo inmutable direccionado por su huella (ADR-0007), así que la serialización es
 * canónica: el mismo dibujo produce siempre los mismos bytes.
 *
 * Cada trazo libre guarda sus puntos (con presión) y el contorno que calculó el editor de `campo` con
 * perfect-freehand al terminarlo: así oficina y el PDF lo dibujan con este mismo código, sin depender
 * de la biblioteca de dibujo.
 */
import { LIMITES_BOCETO } from "./limites";

export type Punto = readonly [number, number];
export type PuntoConPresion = readonly [number, number, number];

export type ElementoBoceto =
  | { tipo: "trazo"; grosor: number; puntos: readonly PuntoConPresion[]; contorno: readonly Punto[] }
  | { tipo: "linea"; grosor: number; desde: Punto; hasta: Punto }
  | { tipo: "texto"; en: Punto; texto: string; tamano: number };

export interface DocumentoBoceto {
  formato: "teins-boceto";
  version: 1;
  /** Lienzo lógico: el mismo en cualquier pantalla; se escala al mostrarlo. */
  ancho: number;
  alto: number;
  /** Lado de cada cuadro de la cuadrícula, en unidades del lienzo. */
  cuadricula: number;
  elementos: readonly ElementoBoceto[];
}

/** Tipo del archivo del boceto (ADR-0007): lo sube el técnico, lo verifica el worker. */
export const TIPO_ARCHIVO_BOCETO = "application/vnd.teins.boceto+json";

/** Primera versión de `campo` que sabe dibujar bocetos (ADR-0015, punto 4). */
export const VERSION_APP_BOCETOS = 5;

/** Lienzo 4:3, como una hoja cuadriculada apaisada. */
export const LIENZO = { ancho: 1000, alto: 750, cuadricula: 25 } as const;

export const bocetoVacio = (): DocumentoBoceto => ({ formato: "teins-boceto", version: 1, ...LIENZO, elementos: [] });

const esNumero = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const dentro = (n: unknown, max: number) => esNumero(n) && n >= -max && n <= 2 * max;
const esPunto = (p: unknown, conPresion: boolean) =>
  Array.isArray(p) && p.length === (conPresion ? 3 : 2) && dentro(p[0], LIENZO.ancho) && dentro(p[1], LIENZO.alto) && (!conPresion || (esNumero(p[2]) && p[2] >= 0 && p[2] <= 1));

/**
 * Valida un boceto que llega de afuera (el worker lo hace con cada archivo subido). Es total: devuelve
 * los problemas, nunca lanza.
 */
export function validarBoceto(valor: unknown): string[] {
  if (typeof valor !== "object" || valor === null) return ["No es un boceto"];
  const d = valor as Record<string, unknown>;
  const errores: string[] = [];
  if (d.formato !== "teins-boceto" || d.version !== 1) errores.push("Formato o versión de boceto desconocidos");
  if (d.ancho !== LIENZO.ancho || d.alto !== LIENZO.alto || d.cuadricula !== LIENZO.cuadricula) errores.push("Lienzo distinto al de la versión 1");
  if (!Array.isArray(d.elementos)) return [...errores, "Faltan los elementos"];
  if (d.elementos.length > LIMITES_BOCETO.elementos) errores.push("Demasiados elementos");
  d.elementos.forEach((e: unknown, i: number) => {
    const el = (typeof e === "object" && e !== null ? e : {}) as Record<string, unknown>;
    const ok = (() => {
      switch (el.tipo) {
        case "trazo":
          return (
            esNumero(el.grosor) && el.grosor > 0 && el.grosor <= 40 &&
            Array.isArray(el.puntos) && el.puntos.length >= 1 && el.puntos.length <= LIMITES_BOCETO.puntosPorTrazo && el.puntos.every((p) => esPunto(p, true)) &&
            Array.isArray(el.contorno) && el.contorno.length >= 3 && el.contorno.length <= 4 * LIMITES_BOCETO.puntosPorTrazo && el.contorno.every((p) => esPunto(p, false))
          );
        case "linea":
          return esNumero(el.grosor) && el.grosor > 0 && el.grosor <= 40 && esPunto(el.desde, false) && esPunto(el.hasta, false);
        case "texto":
          return (
            esPunto(el.en, false) && typeof el.texto === "string" && el.texto.trim() !== "" && el.texto.length <= LIMITES_BOCETO.texto &&
            esNumero(el.tamano) && el.tamano >= 8 && el.tamano <= 120
          );
        default:
          return false;
      }
    })();
    if (!ok) errores.push(`Elemento ${i + 1} inválido`);
  });
  return errores;
}

const r = (n: number) => Math.round(n * 10) / 10;
const punto = ([x, y]: Punto): Punto => [r(x), r(y)];

/** JSON canónico: orden de claves fijo y un decimal. El mismo dibujo, los mismos bytes, la misma huella. */
export function serializarBoceto(d: DocumentoBoceto): string {
  const elementos = d.elementos.map((e) => {
    switch (e.tipo) {
      case "trazo":
        return { tipo: e.tipo, grosor: r(e.grosor), puntos: e.puntos.map(([x, y, p]) => [r(x), r(y), Math.round(p * 100) / 100]), contorno: e.contorno.map(punto) };
      case "linea":
        return { tipo: e.tipo, grosor: r(e.grosor), desde: punto(e.desde), hasta: punto(e.hasta) };
      case "texto":
        return { tipo: e.tipo, en: punto(e.en), texto: e.texto, tamano: r(e.tamano) };
    }
  });
  return JSON.stringify({ formato: d.formato, version: d.version, ancho: d.ancho, alto: d.alto, cuadricula: d.cuadricula, elementos });
}

/** Lee un boceto de su archivo; `null` si no es JSON o no es un boceto válido. */
export function leerBoceto(texto: string): DocumentoBoceto | null {
  try {
    const valor: unknown = JSON.parse(texto);
    return validarBoceto(valor).length === 0 ? (valor as DocumentoBoceto) : null;
  } catch {
    return null;
  }
}

const escaparXml = (t: string) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export interface OpcionesSvg {
  cuadricula?: boolean;
  /** Colores de la marca (ADR-0020); por defecto, los de TEINS en DESIGN.md. */
  tinta?: string;
  lineaDeCuadricula?: string;
  fondo?: string;
  fuente?: string;
}

/** El boceto como SVG: nítido a cualquier tamaño, en campo (miniatura), oficina y el PDF (QA-17). */
export function bocetoASvg(d: DocumentoBoceto, opciones: OpcionesSvg = {}): string {
  const { cuadricula = true, tinta = "#15171A", lineaDeCuadricula = "#DEDBD3", fondo = "#FFFFFF", fuente = "Atkinson Hyperlegible Next, sans-serif" } = opciones;
  const partes: string[] = [`<rect width="${d.ancho}" height="${d.alto}" fill="${fondo}"/>`];
  if (cuadricula) {
    const lineas: string[] = [];
    for (let x = d.cuadricula; x < d.ancho; x += d.cuadricula) lineas.push(`M${x} 0V${d.alto}`);
    for (let y = d.cuadricula; y < d.alto; y += d.cuadricula) lineas.push(`M0 ${y}H${d.ancho}`);
    partes.push(`<path class="cuadricula" d="${lineas.join("")}" stroke="${lineaDeCuadricula}" stroke-width="1" fill="none"/>`);
  }
  for (const e of d.elementos) {
    if (e.tipo === "trazo") {
      const [primero, ...resto] = e.contorno;
      if (primero) partes.push(`<path d="M${primero[0]} ${primero[1]}${resto.map(([x, y]) => `L${x} ${y}`).join("")}Z" fill="${tinta}"/>`);
    } else if (e.tipo === "linea") {
      partes.push(`<line x1="${e.desde[0]}" y1="${e.desde[1]}" x2="${e.hasta[0]}" y2="${e.hasta[1]}" stroke="${tinta}" stroke-width="${e.grosor}" stroke-linecap="round"/>`);
    } else {
      partes.push(`<text x="${e.en[0]}" y="${e.en[1]}" font-size="${e.tamano}" font-family="${fuente}" fill="${tinta}">${escaparXml(e.texto)}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.ancho} ${d.alto}" width="${d.ancho}" height="${d.alto}">${partes.join("")}</svg>`;
}
