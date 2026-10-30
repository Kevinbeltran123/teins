import { describe, expect, it } from "vitest";
import { duracionTexto, fechaEnColombia, formatearDia, horaCorta, minutosDeHorario, pesos } from "./fechas";

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

  it("la hora se dice como en Colombia: 12 horas, a. m. y p. m., y el mediodía es p. m.", () => {
    expect(horaCorta("00:05")).toBe("12:05 a. m.");
    expect(horaCorta("08:14")).toBe("8:14 a. m.");
    expect(horaCorta("12:00")).toBe("12:00 p. m.");
    expect(horaCorta("14:05")).toBe("2:05 p. m.");
  });

  it("la duración se escribe en horas y minutos", () => {
    expect(duracionTexto(196)).toBe("3 h 16 min");
    expect(duracionTexto(120)).toBe("2 h");
    expect(duracionTexto(45)).toBe("45 min");
    expect(duracionTexto(0)).toBe("0 min");
  });

  it("los minutos de un horario: salir antes de entrar es el día siguiente", () => {
    expect(minutosDeHorario({ desde: "08:14", hasta: "11:30" })).toBe(196);
    expect(minutosDeHorario({ desde: "22:00", hasta: "01:30" })).toBe(210);
    expect(minutosDeHorario({ desde: "08:00", hasta: "08:00" })).toBe(0);
    expect(minutosDeHorario({ desde: "08:00" })).toBeNull();
  });
});
