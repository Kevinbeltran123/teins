import { puntosDeElemento, type ElementoBoceto, type Punto } from "@teins/dominio";

/**
 * Mover, girar, cambiar el tamaño y duplicar (ADR-0026): se recalculan las coordenadas del elemento; el
 * documento no guarda transformaciones. El texto solo se mueve y cambia de tamaño.
 */
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Caja {
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

export function cajaDe(e: ElementoBoceto): Caja {
  // El texto no tiene contorno: se estima por su largo y su tamaño.
  const puntos = e.tipo === "texto" ? [[e.en[0], e.en[1] - e.tamano] as const, [e.en[0] + e.texto.length * e.tamano * 0.55, e.en[1] + e.tamano * 0.2] as const] : puntosDeElemento(e);
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => p[1]);
  const [x, y] = [Math.min(...xs), Math.min(...ys)];
  return { x, y, ancho: Math.max(...xs) - x, alto: Math.max(...ys) - y };
}

export const centroDe = (c: Caja): Punto => [c.x + c.ancho / 2, c.y + c.alto / 2];

/** Aplica una función a cada punto del elemento; `radios` y `giro` de la elipse se tratan aparte. */
function cadaPunto(e: ElementoBoceto, f: (p: Punto) => Punto): ElementoBoceto {
  const g = (p: Punto): Punto => {
    const [x, y] = f(p);
    return [r1(x), r1(y)];
  };
  switch (e.tipo) {
    case "trazo":
      return { ...e, puntos: e.puntos.map(([x, y, presion]) => [...g([x, y]), presion] as const), contorno: e.contorno.map(g) };
    case "linea":
    case "cota":
      return { ...e, desde: g(e.desde), hasta: g(e.hasta) };
    case "texto":
      return { ...e, en: g(e.en) };
    case "polilinea":
      return { ...e, puntos: e.puntos.map(g) };
    case "elipse":
      return { ...e, centro: g(e.centro) };
  }
}

export const mover = (e: ElementoBoceto, dx: number, dy: number) => cadaPunto(e, ([x, y]) => [x + dx, y + dy]);

/** Gira alrededor de `centro`, en grados. El texto no gira: se deja como está. */
export function girar(e: ElementoBoceto, grados: number, centro: Punto): ElementoBoceto {
  if (e.tipo === "texto") return e;
  const [cos, sen] = [Math.cos((grados * Math.PI) / 180), Math.sin((grados * Math.PI) / 180)];
  const girado = cadaPunto(e, ([x, y]) => [centro[0] + (x - centro[0]) * cos - (y - centro[1]) * sen, centro[1] + (x - centro[0]) * sen + (y - centro[1]) * cos]);
  if (girado.tipo !== "elipse") return girado;
  let giro = r1(girado.giro + grados) % 360;
  if (giro > 180) giro -= 360;
  if (giro < -180) giro += 360;
  return { ...girado, giro };
}

/** Cambia el tamaño alrededor de `centro`. El grosor del trazo no cambia; el texto cambia su tamaño de letra. */
export function escalar(e: ElementoBoceto, factor: number, centro: Punto): ElementoBoceto {
  const escalado = cadaPunto(e, ([x, y]) => [centro[0] + (x - centro[0]) * factor, centro[1] + (y - centro[1]) * factor]);
  if (escalado.tipo === "elipse") return { ...escalado, radios: [r1(escalado.radios[0] * factor), r1(escalado.radios[1] * factor)] };
  if (escalado.tipo === "texto") return { ...escalado, tamano: Math.min(120, Math.max(8, r1(escalado.tamano * factor))) };
  return escalado;
}

/** La copia queda corrida para que se vea que hay dos. */
export const duplicar = (e: ElementoBoceto) => mover(e, 24, 24);

function distanciaASegmento(p: Punto, a: Punto, b: Punto): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const largo = dx * dx + dy * dy;
  const t = largo === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

const cercaDeTramos = (p: Punto, puntos: readonly Punto[], cerrada: boolean, tolerancia: number) =>
  puntos.some((a, i) => {
    const b = puntos[i + 1] ?? (cerrada ? puntos[0] : undefined);
    return b !== undefined && distanciaASegmento(p, a, b) <= tolerancia;
  });

/** El elemento bajo el dedo, del más reciente al más antiguo; -1 si no hay ninguno. */
export function elementoEn(elementos: readonly ElementoBoceto[], p: Punto, tolerancia: number): number {
  for (let i = elementos.length - 1; i >= 0; i--) {
    const e = elementos[i]!;
    const margen = tolerancia + ("grosor" in e ? e.grosor / 2 : 0);
    switch (e.tipo) {
      case "trazo":
        if (cercaDeTramos(p, e.puntos.map(([x, y]) => [x, y] as const), false, margen) || (e.puntos.length === 1 && Math.hypot(p[0] - e.puntos[0]![0], p[1] - e.puntos[0]![1]) <= margen)) return i;
        break;
      case "linea":
      case "cota":
        if (distanciaASegmento(p, e.desde, e.hasta) <= margen) return i;
        break;
      case "polilinea":
        if (cercaDeTramos(p, e.puntos, e.cerrada, margen)) return i;
        break;
      case "elipse": {
        // En el borde de la elipse, en el marco sin girar.
        const radianes = (-e.giro * Math.PI) / 180;
        const [dx, dy] = [p[0] - e.centro[0], p[1] - e.centro[1]];
        const [x, y] = [dx * Math.cos(radianes) - dy * Math.sin(radianes), dx * Math.sin(radianes) + dy * Math.cos(radianes)];
        const normal = Math.hypot(x / e.radios[0], y / e.radios[1]);
        if (Math.abs(normal - 1) * Math.min(...e.radios) <= margen) return i;
        break;
      }
      case "texto": {
        const c = cajaDe(e);
        if (p[0] >= c.x - tolerancia && p[0] <= c.x + c.ancho + tolerancia && p[1] >= c.y - tolerancia && p[1] <= c.y + c.alto + tolerancia) return i;
        break;
      }
    }
  }
  return -1;
}
