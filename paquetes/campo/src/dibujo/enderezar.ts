import type { Punto } from "@teins/dominio";

/**
 * Enderezar un trazo al dejar el dedo quieto (ADR-0026, como QuickShape de Procreate): si se parece a una línea,
 * una pared en L, un triángulo, un rectángulo o una elipse, se vuelve esa forma; si no, queda como se dibujó.
 * Sin biblioteca: se simplifica el trazo (Ramer-Douglas-Peucker), se cuentan las esquinas y se mira si cierra.
 */
export type Forma =
  | { tipo: "linea"; desde: Punto; hasta: Punto }
  | { tipo: "polilinea"; puntos: Punto[]; cerrada: boolean }
  | { tipo: "elipse"; centro: Punto; radios: Punto; giro: number };

const r1 = (n: number) => Math.round(n * 10) / 10;
const distancia = (a: Punto, b: Punto) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function distanciaASegmento(p: Punto, a: Punto, b: Punto): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const largo = dx * dx + dy * dy;
  const t = largo === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** Ramer-Douglas-Peucker: los puntos que hacen falta para seguir el trazo con un error menor que `epsilon`. */
export function simplificar(puntos: readonly Punto[], epsilon: number): Punto[] {
  if (puntos.length < 3) return [...puntos];
  let maxima = 0;
  let indice = 0;
  for (let i = 1; i < puntos.length - 1; i++) {
    const d = distanciaASegmento(puntos[i]!, puntos[0]!, puntos.at(-1)!);
    if (d > maxima) [maxima, indice] = [d, i];
  }
  if (maxima <= epsilon) return [puntos[0]!, puntos.at(-1)!];
  return [...simplificar(puntos.slice(0, indice + 1), epsilon).slice(0, -1), ...simplificar(puntos.slice(indice), epsilon)];
}

/** Ángulos a los que se pegan las líneas: horizontal, vertical y 45°, si quedan a menos de 6°. */
const TOLERANCIA_ANGULO = 6;

/** Endereza `hasta` alrededor de `desde` si la línea queda cerca de 0°, 45° o 90° (y sus opuestos). */
export function ajustarAngulo(desde: Punto, hasta: Punto): Punto {
  const largo = distancia(desde, hasta);
  if (largo === 0) return hasta;
  const angulo = (Math.atan2(hasta[1] - desde[1], hasta[0] - desde[0]) * 180) / Math.PI;
  const cercano = Math.round(angulo / 45) * 45;
  if (Math.abs(angulo - cercano) > TOLERANCIA_ANGULO) return hasta;
  const radianes = (cercano * Math.PI) / 180;
  return [r1(desde[0] + Math.cos(radianes) * largo), r1(desde[1] + Math.sin(radianes) * largo)];
}

/** El punto se pega al extremo cercano de otro elemento (para cerrar un cuarto con la última pared). */
export function pegarA(punto: Punto, candidatos: readonly Punto[], tolerancia: number): Punto {
  let mejor: Punto | null = null;
  for (const c of candidatos) if (distancia(punto, c) <= tolerancia && (!mejor || distancia(punto, c) < distancia(punto, mejor))) mejor = c;
  return mejor ?? punto;
}

const redondear = (p: Punto): Punto => [r1(p[0]), r1(p[1])];

function anguloInterior(a: Punto, b: Punto, c: Punto): number {
  const v1 = [a[0] - b[0], a[1] - b[1]];
  const v2 = [c[0] - b[0], c[1] - b[1]];
  const coseno = (v1[0]! * v2[0]! + v1[1]! * v2[1]!) / (Math.hypot(v1[0]!, v1[1]!) * Math.hypot(v2[0]!, v2[1]!) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, coseno))) * 180) / Math.PI;
}

/** Rectángulo a partir de cuatro esquinas casi rectas: la caja en la dirección del primer lado (ya enderezado). */
function rectangulo(esquinas: readonly Punto[]): Punto[] {
  const [a, b] = [esquinas[0]!, ajustarAngulo(esquinas[0]!, esquinas[1]!)];
  const angulo = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const [cos, sen] = [Math.cos(-angulo), Math.sin(-angulo)];
  const girados = esquinas.map(([x, y]) => [x * cos - y * sen, x * sen + y * cos] as const);
  const [x0, x1] = [Math.min(...girados.map((p) => p[0])), Math.max(...girados.map((p) => p[0]))];
  const [y0, y1] = [Math.min(...girados.map((p) => p[1])), Math.max(...girados.map((p) => p[1]))];
  const [cosV, senV] = [Math.cos(angulo), Math.sin(angulo)];
  return ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as const).map(([x, y]) => redondear([x * cosV - y * senV, x * senV + y * cosV]));
}

/** La forma a la que se parece el trazo, o `null` si no se parece a ninguna. */
export function enderezar(puntos: readonly Punto[]): Forma | null {
  if (puntos.length < 2) return null;
  const xs = puntos.map((p) => p[0]);
  const ys = puntos.map((p) => p[1]);
  const [ancho, alto] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
  const diagonal = Math.hypot(ancho, alto);
  if (diagonal < 20) return null;
  let recorrido = 0;
  for (let i = 1; i < puntos.length; i++) recorrido += distancia(puntos[i - 1]!, puntos[i]!);
  const epsilon = Math.max(10, diagonal * 0.07);
  const cierra = distancia(puntos[0]!, puntos.at(-1)!) < Math.max(30, recorrido * 0.12);

  if (!cierra) {
    const esquinas = simplificar(puntos, epsilon);
    if (esquinas.length === 2) return { tipo: "linea", desde: redondear(esquinas[0]!), hasta: ajustarAngulo(redondear(esquinas[0]!), redondear(esquinas[1]!)) };
    if (esquinas.length <= 5) {
      // Cada tramo se endereza desde donde terminó el anterior: las paredes quedan unidas.
      const enderezados: Punto[] = [redondear(esquinas[0]!)];
      for (const p of esquinas.slice(1)) enderezados.push(ajustarAngulo(enderezados.at(-1)!, redondear(p)));
      return { tipo: "polilinea", puntos: enderezados, cerrada: false };
    }
    return null;
  }

  // Cerrado: se parte en el punto más lejano del inicio, para que la simplificación no se quede sin base.
  let lejano = 0;
  for (let i = 1; i < puntos.length; i++) if (distancia(puntos[0]!, puntos[i]!) > distancia(puntos[0]!, puntos[lejano]!)) lejano = i;
  const esquinas = [...simplificar(puntos.slice(0, lejano + 1), epsilon).slice(0, -1), ...simplificar(puntos.slice(lejano), epsilon)];
  if (esquinas.length > 1 && distancia(esquinas[0]!, esquinas.at(-1)!) < epsilon * 2) esquinas.pop();
  if (esquinas.length === 3) return { tipo: "polilinea", puntos: esquinas.map(redondear), cerrada: true };
  if (esquinas.length === 4) {
    const rectos = esquinas.every((b, i) => Math.abs(anguloInterior(esquinas[(i + 3) % 4]!, b, esquinas[(i + 1) % 4]!) - 90) < 25);
    if (rectos) return { tipo: "polilinea", puntos: rectangulo(esquinas), cerrada: true };
  }

  // ¿Redondo y parejo? La distancia al centro, en proporción a los radios, tiene que ser casi 1 en todo el trazo.
  const centro: Punto = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const [rx, ry] = [ancho / 2, alto / 2];
  if (rx < 5 || ry < 5) return null;
  const desvio = puntos.reduce((total, [x, y]) => total + Math.abs(Math.hypot((x - centro[0]) / rx, (y - centro[1]) / ry) - 1), 0) / puntos.length;
  if (desvio > 0.12) return null;
  // Casi un círculo: se deja círculo.
  const radios: Punto = Math.abs(rx - ry) / Math.max(rx, ry) < 0.15 ? [r1((rx + ry) / 2), r1((rx + ry) / 2)] : [r1(rx), r1(ry)];
  return { tipo: "elipse", centro: redondear(centro), radios, giro: 0 };
}
