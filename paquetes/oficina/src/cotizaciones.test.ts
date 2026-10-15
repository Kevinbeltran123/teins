import { describe, expect, it } from "vitest";
import { devolverLinea } from "./cotizaciones";

const l = (id: string) => ({ id, descripcion: id });

describe("«Deshacer» al quitar una línea", () => {
  it("la devuelve a su lugar, sobre las líneas de ahora", () => {
    // Se quitó «b» (posición 1) y después se agregó «d».
    expect(devolverLinea([l("a"), l("c"), l("d")], l("b"), 1).map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("una sola vez: si la línea ya volvió, no se duplica", () => {
    const lineas = [l("a"), l("b"), l("c")];
    expect(devolverLinea(lineas, l("b"), 1)).toBe(lineas);
  });

  it("si después se quitaron otras, va al final", () => {
    expect(devolverLinea([l("a")], l("c"), 2).map((x) => x.id)).toEqual(["a", "c"]);
  });
});
