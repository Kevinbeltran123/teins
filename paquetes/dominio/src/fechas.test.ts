import { describe, expect, it } from "vitest";
import { fechaEnColombia, formatearDia, pesos } from "./fechas";

describe("fechas", () => {
  it("el día en Colombia no es el de UTC cerca de la medianoche", () => {
    // 2026-10-28 02:00 UTC es todavía el 27 en Bogotá (UTC-5).
    expect(fechaEnColombia(new Date("2026-10-28T02:00:00Z"))).toBe("2026-10-27");
  });

  it("un día de calendario no se corre al anterior", () => {
    expect(formatearDia("2026-10-01", { day: "numeric", month: "long", year: "numeric" })).toBe("1 de octubre de 2026");
  });

  it("pesos enteros con separador de miles", () => {
    expect(pesos(1234567)).toBe("$ 1.234.567");
  });
});
