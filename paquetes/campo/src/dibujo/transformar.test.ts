import { describe, expect, it } from "vitest";
import type { ElementoBoceto } from "@teins/dominio";
import { cajaDe, centroDe, duplicar, elementoEn, escalar, girar, mover } from "./transformar";

const rect: ElementoBoceto = { tipo: "polilinea", grosor: 6, puntos: [[100, 100], [300, 100], [300, 200], [100, 200]], cerrada: true };
const circulo: ElementoBoceto = { tipo: "elipse", grosor: 5, centro: [500, 400], radios: [50, 50], giro: 0 };
const texto: ElementoBoceto = { tipo: "texto", en: [600, 100], texto: "Tablero", tamano: 28 };
const cota: ElementoBoceto = { tipo: "cota", grosor: 3, desde: [100, 600], hasta: [500, 600], texto: "4,00 m" };

describe("mover, girar y cambiar el tamaño (iteración 18, ADR-0026)", () => {
  it("mover corre todos los puntos; duplicar deja la copia corrida", () => {
    expect(mover(rect, 10, -5)).toMatchObject({ puntos: [[110, 95], [310, 95], [310, 195], [110, 195]] });
    expect(duplicar(cota)).toMatchObject({ desde: [124, 624], hasta: [524, 624], texto: "4,00 m" });
  });

  it("girar 90° alrededor del centro de la caja; la elipse suma su giro; el texto no gira", () => {
    const centro = centroDe(cajaDe(rect));
    expect(centro).toEqual([200, 150]);
    expect(girar(rect, 90, centro)).toMatchObject({ puntos: [[250, 50], [250, 250], [150, 250], [150, 50]] });
    expect(girar({ ...circulo, radios: [80, 40] }, 30, [500, 400])).toMatchObject({ centro: [500, 400], giro: 30 });
    expect(girar(texto, 45, [0, 0])).toBe(texto);
  });

  it("cambiar el tamaño escala puntos y radios; el texto cambia su letra dentro de sus límites", () => {
    expect(escalar(rect, 2, [200, 150])).toMatchObject({ puntos: [[0, 50], [400, 50], [400, 250], [0, 250]], grosor: 6 });
    expect(escalar(circulo, 1.5, [500, 400])).toMatchObject({ radios: [75, 75] });
    expect(escalar(texto, 2, [600, 100])).toMatchObject({ tamano: 56 });
    expect(escalar(texto, 10, [600, 100])).toMatchObject({ tamano: 120 });
  });

  it("encuentra el elemento bajo el dedo en su borde, del más reciente al más antiguo", () => {
    const elementos = [rect, circulo, texto, cota];
    expect(elementoEn(elementos, [200, 102], 12)).toBe(0);
    // Dentro del rectángulo pero lejos del borde: nada (se toca el borde, como con el borrador).
    expect(elementoEn(elementos, [200, 150], 12)).toBe(-1);
    expect(elementoEn(elementos, [550, 400], 12)).toBe(1);
    expect(elementoEn(elementos, [640, 90], 12)).toBe(2);
    expect(elementoEn(elementos, [300, 604], 12)).toBe(3);
  });
});
