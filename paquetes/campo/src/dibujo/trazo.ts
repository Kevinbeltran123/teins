import { getStroke } from "perfect-freehand";
import type { Punto, PuntoConPresion } from "@teins/dominio";

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Contorno de un trazo con perfect-freehand (ADR-0019): con lápiz usa su presión, con el dedo la simula. Lo usan
 * el editor de bocetos y la firma; el contorno se guarda en el documento, así nadie más necesita la biblioteca.
 */
export function contornoDe(puntos: readonly PuntoConPresion[], lapiz: boolean, grosor: number): Punto[] {
  const contorno = getStroke(puntos.map(([x, y, presion]) => [x, y, presion]), { size: grosor, thinning: 0.55, smoothing: 0.5, streamline: 0.45, simulatePressure: !lapiz });
  const redondeado = contorno.map(([x, y]) => [r1(x!), r1(y!)] as const);
  // Un toque es un punto: el contorno necesita al menos tres vértices.
  return redondeado.length >= 3 ? redondeado : [[puntos[0]![0] - 2, puntos[0]![1] - 2], [puntos[0]![0] + 2, puntos[0]![1] - 2], [puntos[0]![0], puntos[0]![1] + 2]];
}
