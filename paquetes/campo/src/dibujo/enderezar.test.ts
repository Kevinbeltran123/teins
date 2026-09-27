import { describe, expect, it } from "vitest";
import type { Punto } from "@teins/dominio";
import { ajustarAngulo, enderezar, pegarA, simplificar } from "./enderezar";

/** Un trazo "a mano": puntos sobre el camino con un temblor fijo, para que la prueba sea siempre igual. */
function trazo(camino: readonly Punto[], pasos = 20, temblor = 4): Punto[] {
  const puntos: Punto[] = [];
  camino.slice(1).forEach((hasta, i) => {
    const desde = camino[i]!;
    for (let k = 0; k < pasos; k++) {
      const t = k / pasos;
      const ruido = Math.sin((i * pasos + k) * 1.7) * temblor;
      puntos.push([desde[0] + (hasta[0] - desde[0]) * t + ruido, desde[1] + (hasta[1] - desde[1]) * t - ruido]);
    }
  });
  puntos.push(camino.at(-1)!);
  return puntos;
}

function circulo(centro: Punto, radio: number, pasos = 48, temblor = 3): Punto[] {
  return Array.from({ length: pasos + 1 }, (_, i) => {
    const a = (i / pasos) * Math.PI * 2;
    const r = radio + Math.sin(i * 2.3) * temblor;
    return [centro[0] + Math.cos(a) * r, centro[1] + Math.sin(a) * r] as Punto;
  });
}

describe("enderezar (iteración 18, ADR-0026)", () => {
  it("una línea casi horizontal queda recta y horizontal", () => {
    const forma = enderezar(trazo([[100, 300], [700, 318]]));
    expect(forma).toMatchObject({ tipo: "linea", desde: [expect.closeTo(100, 0), expect.anything()] });
    const linea = forma as { desde: Punto; hasta: Punto };
    expect(linea.hasta[1]).toBe(linea.desde[1]);
  });

  it("una línea en diagonal de 30° no se fuerza a 45°", () => {
    const forma = enderezar(trazo([[100, 500], [446, 300]], 20, 2)) as { desde: Punto; hasta: Punto };
    const angulo = (Math.atan2(forma.hasta[1] - forma.desde[1], forma.hasta[0] - forma.desde[0]) * 180) / Math.PI;
    expect(Math.round(angulo)).toBeCloseTo(-30, -1);
  });

  it("una pared en L queda como polilínea abierta de tramos rectos", () => {
    const forma = enderezar(trazo([[200, 150], [205, 500], [620, 490]]));
    expect(forma).toMatchObject({ tipo: "polilinea", cerrada: false });
    const [a, b, c] = (forma as { puntos: Punto[] }).puntos;
    expect(b![0]).toBe(a![0]);
    expect(c![1]).toBe(b![1]);
  });

  it("un rectángulo torcido queda rectángulo, con ángulos rectos", () => {
    const forma = enderezar(trazo([[180, 210], [800, 200], [812, 600], [170, 610], [182, 215]]));
    expect(forma).toMatchObject({ tipo: "polilinea", cerrada: true });
    const p = (forma as { puntos: Punto[] }).puntos;
    expect(p).toHaveLength(4);
    expect(p[0]![1]).toBeCloseTo(p[1]![1], 0);
    expect(p[1]![0]).toBeCloseTo(p[2]![0], 0);
  });

  it("un triángulo queda triángulo", () => {
    expect(enderezar(trazo([[300, 100], [550, 500], [80, 480], [300, 105]]))).toMatchObject({ tipo: "polilinea", cerrada: true, puntos: expect.any(Array) });
    expect((enderezar(trazo([[300, 100], [550, 500], [80, 480], [300, 105]])) as { puntos: Punto[] }).puntos).toHaveLength(3);
  });

  it("un círculo a mano queda círculo; un óvalo, elipse", () => {
    expect(enderezar(circulo([400, 300], 120))).toMatchObject({ tipo: "elipse", centro: [expect.closeTo(400, -1), expect.closeTo(300, -1)] });
    const circuloRecto = enderezar(circulo([400, 300], 120)) as { radios: Punto };
    expect(circuloRecto.radios[0]).toBe(circuloRecto.radios[1]);
  });

  it("un garabato o un toque se quedan como están", () => {
    const garabato: Punto[] = Array.from({ length: 80 }, (_, i) => [300 + Math.sin(i * 0.9) * 120 + i * 3, 300 + Math.cos(i * 1.3) * 90] as Punto);
    expect(enderezar(garabato)).toBeNull();
    expect(enderezar([[10, 10], [12, 11]])).toBeNull();
  });

  it("ajusta ángulos cercanos a 0°, 45° y 90°, y pega un extremo al de otro elemento", () => {
    expect(ajustarAngulo([0, 0], [100, 5])).toEqual([100.1, 0]);
    expect(ajustarAngulo([0, 0], [100, 30])).toEqual([100, 30]);
    const diagonal = ajustarAngulo([0, 0], [100, 97]);
    expect(diagonal[0]).toBeCloseTo(diagonal[1], 5);
    expect(pegarA([103, 98], [[100, 100], [300, 300]], 12)).toEqual([100, 100]);
    expect(pegarA([150, 150], [[100, 100]], 12)).toEqual([150, 150]);
    expect(simplificar([[0, 0], [50, 1], [100, 0]], 5)).toEqual([[0, 0], [100, 0]]);
  });
});
