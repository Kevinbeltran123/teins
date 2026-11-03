import { describe, expect, it } from "vitest";
import { coordenadaParaMapa } from "./ubicacion";

describe("la ubicación que sale del teléfono para el mapa (ADR-0052)", () => {
  it("va con tres decimales, unos 110 m: el punto exacto se queda en el teléfono", () => {
    expect(coordenadaParaMapa(4.438889)).toBe(4.439);
    expect(coordenadaParaMapa(-75.232222)).toBe(-75.232);
    expect(coordenadaParaMapa(4.2)).toBe(4.2);
  });
});
