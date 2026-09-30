/**
 * Boceto (ADR-0019, ADR-0026): croquis a mano sobre cuadrícula, en una o varias hojas, guardado como documento
 * vectorial y no como imagen.
 * Viaja como archivo inmutable direccionado por su huella (ADR-0007), así que la serialización es
 * canónica: el mismo dibujo produce siempre los mismos bytes.
 *
 * Cada trazo libre guarda sus puntos (con presión) y el contorno que calculó el editor de `campo` con
 * perfect-freehand al terminarlo: así oficina y el PDF lo dibujan con este mismo código, sin depender
 * de la biblioteca de dibujo.
 */
import { LIMITES_BOCETO, LIMITES_SIMBOLO } from "./limites";
import { esTrazadoValido, GROSOR_SIMBOLO, type DefinicionSimbolo } from "./simbolos";

export type Punto = readonly [number, number];
export type PuntoConPresion = readonly [number, number, number];

export type ElementoBoceto =
  | { tipo: "trazo"; grosor: number; puntos: readonly PuntoConPresion[]; contorno: readonly Punto[] }
  | { tipo: "linea"; grosor: number; desde: Punto; hasta: Punto }
  | { tipo: "texto"; en: Punto; texto: string; tamano: number }
  /** Versión 2 (ADR-0026): paredes en L, rectángulos y triángulos, enderezados o movidos. */
  | { tipo: "polilinea"; grosor: number; puntos: readonly Punto[]; cerrada: boolean }
  /** Versión 2: círculos y elipses; `giro` en grados. */
  | { tipo: "elipse"; grosor: number; centro: Punto; radios: Punto; giro: number }
  /** Versión 2: una medida escrita por el técnico sobre una línea con topes ("4,50 m"); no se calcula. */
  | { tipo: "cota"; grosor: number; desde: Punto; hasta: Punto; texto: string }
  /**
   * Versión 2, desde la app 10 (ADR-0027): un símbolo de la biblioteca, copiado con su dibujo para que el boceto
   * se vea igual aunque la biblioteca cambie. Su caja de 100 × 100 se centra en `centro`, mide `tamano` y gira `giro`°.
   */
  | {
      tipo: "simbolo";
      simbolo: string;
      nombre: string;
      trazado: string;
      relleno?: string | undefined;
      texto?: string | undefined;
      codigo?: string | undefined;
      centro: Punto;
      tamano: number;
      giro: number;
    };

/** Una hoja del boceto (versión 2, ADR-0026): un piso, un cuarto, un detalle; su nombre sale en el informe. */
export interface HojaBoceto {
  nombre: string;
  /** Lienzo lógico de la hoja: el mismo en cualquier pantalla; se escala al mostrarlo. */
  ancho: number;
  alto: number;
  elementos: readonly ElementoBoceto[];
}

/** Versión 1 (ADR-0019): una sola hoja apaisada con trazo, línea y texto. Las firmas siguen en ella (ADR-0024). */
export interface BocetoV1 {
  formato: "teins-boceto";
  version: 1;
  ancho: number;
  alto: number;
  /** Lado de cada cuadro de la cuadrícula, en unidades del lienzo. */
  cuadricula: number;
  elementos: readonly ElementoBoceto[];
}

/** Versión 2 (ADR-0026): varias hojas con nombre, verticales y del alto de la pantalla; además polilínea, elipse y cota. */
export interface BocetoV2 {
  formato: "teins-boceto";
  version: 2;
  cuadricula: number;
  hojas: readonly HojaBoceto[];
}

export type DocumentoBoceto = BocetoV1 | BocetoV2;

/** Tipo del archivo del boceto (ADR-0007): lo sube el técnico, lo verifica el worker. */
export const TIPO_ARCHIVO_BOCETO = "application/vnd.teins.boceto+json";

/** Primera versión de `campo` que sabe dibujar bocetos (ADR-0015, punto 4). */
export const VERSION_APP_BOCETOS = 5;
/** Primera versión de `campo` que crea bocetos de la versión 2 (ADR-0026). */
export const VERSION_APP_FORMAS = 9;

/** Lienzo de la versión 1: 4:3, como una hoja cuadriculada apaisada. */
export const LIENZO = { ancho: 1000, alto: 750, cuadricula: 25 } as const;

/** Hoja de la versión 2: vertical, a lo ancho de la pantalla y tan alta como el espacio que deja el editor. */
export const HOJA = { ancho: 750, altoMinimo: 1000, altoMaximo: 1700 } as const;

/** Una firma (ADR-0024): versión 1, sin trazos. */
export const bocetoVacio = (): BocetoV1 => ({ formato: "teins-boceto", version: 1, ...LIENZO, elementos: [] });

/** El alto de una hoja nueva para un espacio de `ancho` × `alto` en pantalla: lo llena, dentro de los límites. */
export function altoDeHoja(ancho: number, alto: number): number {
  if (!(ancho > 0) || !(alto > 0)) return HOJA.altoMinimo;
  return Math.min(HOJA.altoMaximo, Math.max(HOJA.altoMinimo, Math.round((HOJA.ancho * alto) / ancho)));
}

export const hojaNueva = (nombre: string, alto: number): HojaBoceto => ({ nombre, ancho: HOJA.ancho, alto, elementos: [] });

/** Un boceto nuevo: una hoja, "Hoja 1". */
export const bocetoNuevo = (alto: number): BocetoV2 => ({ formato: "teins-boceto", version: 2, cuadricula: LIENZO.cuadricula, hojas: [hojaNueva("Hoja 1", alto)] });

/** Las hojas de cualquier boceto: el de la versión 1 es una hoja apaisada sin nombre. */
export const hojasDe = (d: DocumentoBoceto): readonly HojaBoceto[] =>
  d.version === 1 ? [{ nombre: "", ancho: d.ancho, alto: d.alto, elementos: d.elementos }] : d.hojas;

/** Un boceto de la versión 1 que se vuelve a editar pasa a la 2: su hoja apaisada queda como "Hoja 1". */
export const aVersion2 = (d: DocumentoBoceto): BocetoV2 =>
  d.version === 2 ? d : { formato: "teins-boceto", version: 2, cuadricula: d.cuadricula, hojas: [{ nombre: "Hoja 1", ancho: d.ancho, alto: d.alto, elementos: d.elementos }] };

const esNumero = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const grosorValido = (g: unknown) => esNumero(g) && g > 0 && g <= 40;
const dentro = (n: unknown, max: number) => esNumero(n) && n >= -max && n <= 2 * max;
const textoCorto = (t: unknown, max: number) => typeof t === "string" && t.trim() !== "" && t.length <= max;
const objeto = (v: unknown) => (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;

/** Los elementos de una hoja de `ancho` × `alto`; los de la versión 2 no existen en un documento de la versión 1. */
function validarElementos(elementos: unknown, { ancho, alto }: { ancho: number; alto: number }, version2: boolean, prefijo: string): string[] {
  const esPunto = (p: unknown, conPresion: boolean) =>
    Array.isArray(p) && p.length === (conPresion ? 3 : 2) && dentro(p[0], ancho) && dentro(p[1], alto) && (!conPresion || (esNumero(p[2]) && p[2] >= 0 && p[2] <= 1));
  if (!Array.isArray(elementos)) return [`${prefijo}Faltan los elementos`];
  const errores: string[] = [];
  if (elementos.length > LIMITES_BOCETO.elementos) errores.push(`${prefijo}Demasiados elementos`);
  elementos.forEach((e: unknown, i: number) => {
    const el = objeto(e);
    const ok = (() => {
      switch (el.tipo) {
        case "trazo":
          return (
            grosorValido(el.grosor) &&
            Array.isArray(el.puntos) && el.puntos.length >= 1 && el.puntos.length <= LIMITES_BOCETO.puntosPorTrazo && el.puntos.every((p) => esPunto(p, true)) &&
            Array.isArray(el.contorno) && el.contorno.length >= 3 && el.contorno.length <= 4 * LIMITES_BOCETO.puntosPorTrazo && el.contorno.every((p) => esPunto(p, false))
          );
        case "linea":
          return grosorValido(el.grosor) && esPunto(el.desde, false) && esPunto(el.hasta, false);
        case "texto":
          return (
            esPunto(el.en, false) && typeof el.texto === "string" && el.texto.trim() !== "" && el.texto.length <= LIMITES_BOCETO.texto &&
            esNumero(el.tamano) && el.tamano >= 8 && el.tamano <= 120
          );
        case "polilinea":
          return (
            version2 && grosorValido(el.grosor) && typeof el.cerrada === "boolean" &&
            Array.isArray(el.puntos) && el.puntos.length >= 2 && el.puntos.length <= LIMITES_BOCETO.puntosPorPolilinea && el.puntos.every((p) => esPunto(p, false))
          );
        case "elipse":
          return (
            version2 && grosorValido(el.grosor) && esPunto(el.centro, false) &&
            Array.isArray(el.radios) && el.radios.length === 2 && el.radios.every((r) => esNumero(r) && r > 0 && r <= Math.max(ancho, alto)) &&
            esNumero(el.giro) && el.giro >= -360 && el.giro <= 360
          );
        case "cota":
          return (
            version2 && grosorValido(el.grosor) && esPunto(el.desde, false) && esPunto(el.hasta, false) &&
            typeof el.texto === "string" && el.texto.trim() !== "" && el.texto.length <= LIMITES_BOCETO.texto
          );
        // Desde la app 10 (ADR-0027): el dibujo copiado de la biblioteca se valida como ella.
        case "simbolo":
          return (
            version2 && typeof el.simbolo === "string" && el.simbolo.length <= 36 &&
            textoCorto(el.nombre, LIMITES_SIMBOLO.nombre) && esTrazadoValido(el.trazado) &&
            (el.relleno === undefined || esTrazadoValido(el.relleno)) &&
            (el.texto === undefined || textoCorto(el.texto, LIMITES_SIMBOLO.texto)) &&
            (el.codigo === undefined || textoCorto(el.codigo, LIMITES_SIMBOLO.codigo)) &&
            esPunto(el.centro, false) && esNumero(el.tamano) && el.tamano >= LIMITES_SIMBOLO.tamanoMinimo && el.tamano <= LIMITES_SIMBOLO.tamanoMaximo &&
            esNumero(el.giro) && el.giro >= -360 && el.giro <= 360
          );
        default:
          return false;
      }
    })();
    if (!ok) errores.push(`${prefijo}Elemento ${i + 1} inválido`);
  });
  return errores;
}

/**
 * Valida un boceto que llega de afuera (el worker lo hace con cada archivo subido). Es total: devuelve
 * los problemas, nunca lanza.
 */
export function validarBoceto(valor: unknown): string[] {
  if (typeof valor !== "object" || valor === null) return ["No es un boceto"];
  const d = valor as Record<string, unknown>;
  if (d.formato !== "teins-boceto" || (d.version !== 1 && d.version !== 2)) return ["Formato o versión de boceto desconocidos"];
  if (d.version === 1) {
    const lienzo = d.ancho === LIENZO.ancho && d.alto === LIENZO.alto && d.cuadricula === LIENZO.cuadricula;
    return [...(lienzo ? [] : ["Lienzo distinto al de la versión 1"]), ...validarElementos(d.elementos, LIENZO, false, "")];
  }
  const errores: string[] = d.cuadricula === LIENZO.cuadricula ? [] : ["Cuadrícula distinta"];
  if (!Array.isArray(d.hojas) || d.hojas.length === 0) return [...errores, "Faltan las hojas"];
  if (d.hojas.length > LIMITES_BOCETO.hojas) errores.push("Demasiadas hojas");
  d.hojas.forEach((h: unknown, i: number) => {
    const hoja = objeto(h);
    const prefijo = `Hoja ${i + 1}: `;
    if (typeof hoja.nombre !== "string" || hoja.nombre.trim() === "" || hoja.nombre.length > LIMITES_BOCETO.nombreDeHoja) errores.push(`${prefijo}Nombre inválido`);
    // Vertical (la de la versión 2) o apaisada (la de un boceto de la versión 1 que se volvió a editar).
    const apaisada = hoja.ancho === LIENZO.ancho && hoja.alto === LIENZO.alto;
    const vertical = hoja.ancho === HOJA.ancho && Number.isInteger(hoja.alto) && (hoja.alto as number) >= HOJA.altoMinimo && (hoja.alto as number) <= HOJA.altoMaximo;
    if (!apaisada && !vertical) errores.push(`${prefijo}Tamaño inválido`);
    else errores.push(...validarElementos(hoja.elementos, { ancho: hoja.ancho as number, alto: hoja.alto as number }, true, prefijo));
  });
  return errores;
}

const r = (n: number) => Math.round(n * 10) / 10;
const punto = ([x, y]: Punto): Punto => [r(x), r(y)];

function serializarElementos(elementos: readonly ElementoBoceto[]) {
  return elementos.map((e) => {
    switch (e.tipo) {
      case "trazo":
        return { tipo: e.tipo, grosor: r(e.grosor), puntos: e.puntos.map(([x, y, p]) => [r(x), r(y), Math.round(p * 100) / 100]), contorno: e.contorno.map(punto) };
      case "linea":
        return { tipo: e.tipo, grosor: r(e.grosor), desde: punto(e.desde), hasta: punto(e.hasta) };
      case "texto":
        return { tipo: e.tipo, en: punto(e.en), texto: e.texto, tamano: r(e.tamano) };
      case "polilinea":
        return { tipo: e.tipo, grosor: r(e.grosor), puntos: e.puntos.map(punto), cerrada: e.cerrada };
      case "elipse":
        return { tipo: e.tipo, grosor: r(e.grosor), centro: punto(e.centro), radios: punto(e.radios), giro: r(e.giro) };
      case "cota":
        return { tipo: e.tipo, grosor: r(e.grosor), desde: punto(e.desde), hasta: punto(e.hasta), texto: e.texto };
      case "simbolo":
        return {
          tipo: e.tipo,
          simbolo: e.simbolo,
          nombre: e.nombre,
          trazado: e.trazado,
          ...(e.relleno === undefined ? {} : { relleno: e.relleno }),
          ...(e.texto === undefined ? {} : { texto: e.texto }),
          ...(e.codigo === undefined ? {} : { codigo: e.codigo }),
          centro: punto(e.centro),
          tamano: r(e.tamano),
          giro: r(e.giro),
        };
    }
  });
}

/** JSON canónico: orden de claves fijo y un decimal. El mismo dibujo, los mismos bytes, la misma huella. */
export function serializarBoceto(d: DocumentoBoceto): string {
  if (d.version === 1) return JSON.stringify({ formato: d.formato, version: d.version, ancho: d.ancho, alto: d.alto, cuadricula: d.cuadricula, elementos: serializarElementos(d.elementos) });
  const hojas = d.hojas.map((h) => ({ nombre: h.nombre, ancho: h.ancho, alto: h.alto, elementos: serializarElementos(h.elementos) }));
  return JSON.stringify({ formato: d.formato, version: d.version, cuadricula: d.cuadricula, hojas });
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

/** Los puntos que ocupa un elemento: para recortar una firma y para saber qué hay bajo el dedo. */
export function puntosDeElemento(e: ElementoBoceto): readonly Punto[] {
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
      // Girado, la caja cabe en el círculo que la contiene.
      const medio = e.giro % 90 === 0 ? e.tamano / 2 : (e.tamano / 2) * Math.SQRT2;
      return [
        [e.centro[0] - medio, e.centro[1] - medio],
        [e.centro[0] + medio, e.centro[1] + medio],
      ];
    }
    case "elipse": {
      // Girada, la caja de la elipse cabe en la del radio mayor.
      const [rx, ry] = e.giro % 180 === 0 ? e.radios : [Math.max(...e.radios), Math.max(...e.radios)];
      return [
        [e.centro[0] - rx, e.centro[1] - ry],
        [e.centro[0] + rx, e.centro[1] + ry],
      ];
    }
  }
}

/** Un símbolo de la biblioteca puesto en la hoja: se copia su dibujo (ADR-0027). */
export function elementoDeSimbolo(s: DefinicionSimbolo, centro: Punto, tamano: number): Extract<ElementoBoceto, { tipo: "simbolo" }> {
  return {
    tipo: "simbolo",
    simbolo: s.id,
    nombre: s.nombre,
    trazado: s.trazado,
    ...(s.relleno === undefined ? {} : { relleno: s.relleno }),
    ...(s.texto === undefined ? {} : { texto: s.texto }),
    ...(s.codigo === undefined ? {} : { codigo: s.codigo }),
    centro,
    tamano,
    giro: 0,
  };
}

/** Tamaño del texto de una cota, en unidades del lienzo. */
export const TAMANO_COTA = 28;

/**
 * Dónde van los topes y la medida de una cota: topes perpendiculares en cada extremo y el texto sobre la mitad
 * de la línea, girado con ella pero nunca de cabeza. `ui` repite esta cuenta (no depende de `dominio`).
 */
export function geometriaDeCota(desde: Punto, hasta: Punto): { tope1: [Punto, Punto]; tope2: [Punto, Punto]; textoEn: Punto; angulo: number } {
  const [dx, dy] = [hasta[0] - desde[0], hasta[1] - desde[1]];
  const largo = Math.hypot(dx, dy) || 1;
  const [nx, ny] = [(-dy / largo) * 14, (dx / largo) * 14];
  let angulo = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angulo > 90) angulo -= 180;
  if (angulo < -90) angulo += 180;
  // El texto va del lado de "arriba" de la línea ya enderezada.
  const radianes = (angulo * Math.PI) / 180;
  const medio: Punto = [(desde[0] + hasta[0]) / 2, (desde[1] + hasta[1]) / 2];
  return {
    tope1: [[desde[0] - nx, desde[1] - ny], [desde[0] + nx, desde[1] + ny]],
    tope2: [[hasta[0] - nx, hasta[1] - ny], [hasta[0] + nx, hasta[1] + ny]],
    textoEn: [Math.round((medio[0] + Math.sin(radianes) * 16) * 10) / 10, Math.round((medio[1] - Math.cos(radianes) * 16) * 10) / 10],
    angulo: Math.round(angulo * 10) / 10,
  };
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

/** Una hoja como SVG: nítida a cualquier tamaño, en el PDF (QA-17). La cuadrícula es la de todo boceto. */
export function hojaASvg(d: Pick<HojaBoceto, "ancho" | "alto" | "elementos">, opciones: OpcionesSvg = {}): string {
  const { cuadricula = true, tinta = "#15171A", lineaDeCuadricula = "#DEDBD3", fondo = "#FFFFFF", fuente = "'Geist Variable', Geist, sans-serif" } = opciones;
  const partes: string[] = [`<rect width="${d.ancho}" height="${d.alto}" fill="${fondo}"/>`];
  if (cuadricula) {
    const lineas: string[] = [];
    for (let x = LIENZO.cuadricula; x < d.ancho; x += LIENZO.cuadricula) lineas.push(`M${x} 0V${d.alto}`);
    for (let y = LIENZO.cuadricula; y < d.alto; y += LIENZO.cuadricula) lineas.push(`M0 ${y}H${d.ancho}`);
    partes.push(`<path class="cuadricula" d="${lineas.join("")}" stroke="${lineaDeCuadricula}" stroke-width="1" fill="none"/>`);
  }
  for (const e of d.elementos) {
    if (e.tipo === "trazo") {
      const [primero, ...resto] = e.contorno;
      if (primero) partes.push(`<path d="M${primero[0]} ${primero[1]}${resto.map(([x, y]) => `L${x} ${y}`).join("")}Z" fill="${tinta}"/>`);
    } else if (e.tipo === "linea") {
      partes.push(`<line x1="${e.desde[0]}" y1="${e.desde[1]}" x2="${e.hasta[0]}" y2="${e.hasta[1]}" stroke="${tinta}" stroke-width="${e.grosor}" stroke-linecap="round"/>`);
    } else if (e.tipo === "texto") {
      partes.push(`<text x="${e.en[0]}" y="${e.en[1]}" font-size="${e.tamano}" font-family="${fuente}" fill="${tinta}">${escaparXml(e.texto)}</text>`);
    } else if (e.tipo === "polilinea") {
      const etiqueta = e.cerrada ? "polygon" : "polyline";
      partes.push(`<${etiqueta} points="${e.puntos.map(([x, y]) => `${x},${y}`).join(" ")}" fill="none" stroke="${tinta}" stroke-width="${e.grosor}" stroke-linejoin="round" stroke-linecap="round"/>`);
    } else if (e.tipo === "elipse") {
      partes.push(`<ellipse cx="${e.centro[0]}" cy="${e.centro[1]}" rx="${e.radios[0]}" ry="${e.radios[1]}" transform="rotate(${e.giro} ${e.centro[0]} ${e.centro[1]})" fill="none" stroke="${tinta}" stroke-width="${e.grosor}"/>`);
    } else if (e.tipo === "simbolo") {
      // La caja de 100 × 100 a su tamaño; el trazo mide lo mismo en la hoja a cualquier tamaño.
      const k = e.tamano / 100;
      partes.push(
        `<g transform="translate(${e.centro[0]} ${e.centro[1]}) rotate(${e.giro}) scale(${k}) translate(-50 -50)">` +
          `<path d="${escaparXml(e.trazado)}" fill="none" stroke="${tinta}" stroke-width="${r(GROSOR_SIMBOLO / k)}" stroke-linecap="round" stroke-linejoin="round"/>` +
          (e.relleno ? `<path d="${escaparXml(e.relleno)}" fill="${tinta}"/>` : "") +
          (e.texto ? `<text x="50" y="${e.texto.length > 2 ? 58 : 60}" font-size="${e.texto.length > 2 ? 22 : 28}" font-weight="700" font-family="${fuente}" fill="${tinta}" text-anchor="middle">${escaparXml(e.texto)}</text>` : "") +
          "</g>",
      );
    } else {
      const g = geometriaDeCota(e.desde, e.hasta);
      const linea = (a: Punto, b: Punto) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${tinta}" stroke-width="${e.grosor}" stroke-linecap="round"/>`;
      partes.push(linea(e.desde, e.hasta), linea(...g.tope1), linea(...g.tope2));
      partes.push(`<text x="${g.textoEn[0]}" y="${g.textoEn[1]}" font-size="${TAMANO_COTA}" font-family="${fuente}" fill="${tinta}" text-anchor="middle" transform="rotate(${g.angulo} ${g.textoEn[0]} ${g.textoEn[1]})">${escaparXml(e.texto)}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.ancho} ${d.alto}" width="${d.ancho}" height="${d.alto}">${partes.join("")}</svg>`;
}
