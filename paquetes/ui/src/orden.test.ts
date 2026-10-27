import { describe, expect, it } from "vitest";
import { destinoAlArrastrar, moverEnLista } from "./orden";

describe("ordenar arrastrando", () => {
  it("mueve un elemento sin tocar la lista original", () => {
    const l = ["a", "b", "c", "d"];
    expect(moverEnLista(l, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moverEnLista(l, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moverEnLista(l, 1, 1)).toBe(l);
    expect(l).toEqual(["a", "b", "c", "d"]);
  });

  it("el destino es la fila cuya mitad pasó el centro de la que se arrastra, también hasta el borde", () => {
    // Cuatro filas de 40 px desde 0; el centro de cada una: 20, 60, 100, 140.
    const filas = [0, 40, 80, 120].map((top) => ({ top, height: 40 }));
    expect(destinoAlArrastrar(filas, 2, 100)).toBe(2);
    expect(destinoAlArrastrar(filas, 2, 59)).toBe(1);
    expect(destinoAlArrastrar(filas, 2, 20)).toBe(0);
    expect(destinoAlArrastrar(filas, 0, 140)).toBe(3);
    expect(destinoAlArrastrar(filas, 0, 61)).toBe(1);
    // Filas de alto distinto (un capítulo con su selección abierta).
    const distintas = [{ top: 0, height: 40 }, { top: 40, height: 200 }, { top: 240, height: 40 }];
    expect(destinoAlArrastrar(distintas, 0, 150)).toBe(1);
    expect(destinoAlArrastrar(distintas, 2, 130)).toBe(1);
    expect(destinoAlArrastrar(distintas, 2, 141)).toBe(2);
  });

  it("una fila sola, o un centro que no pasó ninguna mitad, se queda donde está", () => {
    expect(destinoAlArrastrar([{ top: 0, height: 40 }], 0, 500)).toBe(0);
    const filas = [0, 40, 80].map((top) => ({ top, height: 40 }));
    expect(destinoAlArrastrar(filas, 1, 61)).toBe(1);
    expect(destinoAlArrastrar(filas, 1, 59)).toBe(1);
  });
});
