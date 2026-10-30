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

  it("una selección única se lee como su texto; una múltiple, como una lista con «Otro» al final", () => {
    const opcion = { clave: "o", etiqueta: "O", tipo: "opcion", opciones: ["Sí", "No"] } as const;
    const opciones = { clave: "s", etiqueta: "S", tipo: "opciones", opciones: ["CCTV", "UPS", "Alarma"], otro: true } as const;
    expect(describirValor(opcion, "Sí")).toBe("Sí");
    expect(describirValor(opciones, { elegidas: ["CCTV"] })).toBe("CCTV");
    expect(describirValor(opciones, { elegidas: ["CCTV", "UPS"], otro: "cerca eléctrica" })).toBe("CCTV, UPS y otro: cerca eléctrica");
    expect(describirValor(opciones, { elegidas: ["CCTV", "UPS", "Alarma"] })).toBe("CCTV, UPS y Alarma");
    expect(describirValor(opciones, { elegidas: [], otro: "cerca eléctrica" })).toBe("Otro: cerca eléctrica");
    expect(describirValor(opciones, { elegidas: [] })).toBe("Sin dato");
  });

  it("un horario dice la hora de entrada y de salida con el total", () => {
    const horario = { clave: "h", etiqueta: "H", tipo: "horario" } as const;
    expect(describirValor(horario, { desde: "08:14", hasta: "11:30" })).toBe("8:14 a. m. a 11:30 a. m. · 3 h 16 min");
    expect(describirValor(horario, { desde: "22:00", hasta: "01:30" })).toBe("10:00 p. m. a 1:30 a. m. · 3 h 30 min");
    expect(describirValor(horario, { desde: "08:14" })).toBe("Desde 8:14 a. m.");
  });

  it("una firma con cédula la dice", () => {
    const firma = { clave: "f", etiqueta: "F", tipo: "firma" } as const;
    const valor = { firma: "a".repeat(64), nombre: "Ana Pérez", firmadoEn: "2026-10-29T15:00:00.000Z", declaracion: "x", documento: "52123456" };
    expect(describirValor(firma, valor)).toBe("Firmada por Ana Pérez · C. C. 52123456");
  });
});
