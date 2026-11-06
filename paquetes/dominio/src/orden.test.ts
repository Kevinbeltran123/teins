import { describe, expect, it } from "vitest";
import { numeroDeOrden } from "./orden";

describe("el número de orden de servicio (ADR-0051)", () => {
  it("se escribe con 4 dígitos; una sola función sabe cómo", () => {
    expect(numeroDeOrden(1)).toBe("0001");
    expect(numeroDeOrden(42)).toBe("0042");
    expect(numeroDeOrden(12345)).toBe("12345");
  });
});
