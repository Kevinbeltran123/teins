import { describe, expect, it } from "vitest";
import { crearMedida, normalizarDecimal } from "./medida";

describe("normalizarDecimal", () => {
  it.each([
    ["12.5", "12.5"],
    ["12,5", "12.5"],
    ["7", "7"],
    [" 3,25 ", "3.25"],
    ["12,", "12"],
    [",5", "0.5"],
    ["007", "7"],
    ["12,50", "12.50"],
    ["1.234", "1.234"],
  ])("acepta %j como %j", (entrada, esperado) => {
    expect(normalizarDecimal(entrada)).toBe(esperado);
  });

  it.each(["", "abc", "12m", "1,2,3", ",", "-5", "1.234,5"])("rechaza %j", (entrada) => {
    expect(normalizarDecimal(entrada)).toBeNull();
  });
});

describe("crearMedida", () => {
  const unidades = ["m", "cm"];

  it("guarda el valor normalizado con su unidad", () => {
    expect(crearMedida("12,5", "m", unidades)).toEqual({ valor: "12.5", unidad: "m" });
  });

  it("rechaza una unidad que el campo no permite", () => {
    expect(crearMedida("12", "kVA", unidades)).toBeNull();
  });
});
