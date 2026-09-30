import { describe, expect, it } from "vitest";
import { acercar, aPantalla, encajar, limitar, VISTA_COMPLETA } from "./vista";

const marco = { ancho: 390, alto: 703 };

describe("la hoja en la pantalla del editor (iteración 18, ADR-0026)", () => {
  it("una hoja hecha para esta pantalla la llena; una apaisada queda centrada a lo ancho", () => {
    const hecha = encajar(marco, { ancho: 750, alto: 1352 });
    for (const [valor, esperado] of [[hecha.x, 0], [hecha.y, 0], [hecha.ancho, 390], [hecha.alto, 703], [hecha.escala, 0.52]] as const) expect(valor).toBeCloseTo(esperado, 1);
    const apaisada = encajar(marco, { ancho: 1000, alto: 750 });
    expect(apaisada).toMatchObject({ x: 0, ancho: 390, alto: 292.5, y: 205.25 });
  });

  it("al acercar, lo que estaba bajo los dedos sigue bajo ellos, y la hoja no deja ver lo de afuera", () => {
    const e = encajar(marco, { ancho: 750, alto: 1352 });
    const v = acercar(VISTA_COMPLETA, 2, [195, 350], [195, 350], marco, e);
    expect(v.escala).toBe(2);
    expect(aPantalla([375, 673], v, e)[0]).toBeCloseTo(195, 0);
    // Arrastrar más allá del borde izquierdo: se queda en el borde.
    expect(e.x + limitar({ ...v, x: 500 }, marco, e).x).toBeCloseTo(0, 5);
    expect(e.x + limitar({ ...v, x: -5000 }, marco, e).x + e.ancho * 2).toBeCloseTo(390, 5);
  });

  it("no se aleja más que la hoja completa ni se acerca más de 4 veces", () => {
    const e = encajar(marco, { ancho: 750, alto: 1352 });
    expect(acercar(VISTA_COMPLETA, 0.3, [100, 100], [100, 100], marco, e)).toEqual(limitar(VISTA_COMPLETA, marco, e));
    expect(acercar(VISTA_COMPLETA, 9, [100, 100], [100, 100], marco, e).escala).toBe(4);
  });

  it("la apaisada acercada puede ocupar todo el alto del marco", () => {
    const e = encajar(marco, { ancho: 1000, alto: 750 });
    const v = limitar({ escala: 3, x: 0, y: 0 }, marco, e);
    // 877,5 px de alto en un marco de 703: el borde de arriba no baja del marco.
    expect(e.y + v.y).toBeLessThanOrEqual(0);
    expect(e.y + v.y + e.alto * 3).toBeGreaterThanOrEqual(703);
  });
});
