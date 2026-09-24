import { describe, expect, it } from "vitest";
import { describirValor } from "./describir";

const medida = { clave: "p", etiqueta: "P", tipo: "medida", unidades: ["kVA"] } as const;
const texto = { clave: "t", etiqueta: "T", tipo: "texto" } as const;

describe("describirValor", () => {
  it("escribe medidas con coma decimal y su unidad", () => {
    expect(describirValor(medida, { valor: "12.5", unidad: "kVA" })).toBe("12,5 kVA");
  });
  it("explica un dato no obtenido y uno vacío", () => {
    expect(describirValor(texto, { noObtenido: true, motivo: "Tablero cerrado" })).toBe("No se pudo obtener: Tablero cerrado");
    expect(describirValor(texto, undefined)).toBe("Sin dato");
  });
});
