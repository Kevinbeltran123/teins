import { describe, expect, it } from "vitest";
import { resumenDelAvance } from "./informes";

const envio = (estado: "en_cola" | "enviado") => ({ estado }) as never;
const version = (v: Partial<Parameters<typeof resumenDelAvance>[0]> = {}) => ({ pdf: "listo" as const, retirada: null, envios: [], ...v });

describe("el avance de una versión recién publicada (iteración 27)", () => {
  it("dice dónde va: el PDF, los envíos y el portal", () => {
    expect(resumenDelAvance(version({ pdf: "generando" }))).toBe("Generando el PDF");
    expect(resumenDelAvance(version({ pdf: "fallido" }))).toBe("No se generó el PDF");
    expect(resumenDelAvance(version({ envios: [envio("en_cola")] }))).toBe("Enviando");
    expect(resumenDelAvance(version({ envios: [envio("enviado")] }))).toBe("En el portal y enviada");
    expect(resumenDelAvance(version())).toBe("En el portal");
  });

  it("retirada en la misma sesión, ya no dice que está en el portal (ADR-0034)", () => {
    const retirada = { en: "2026-10-02T15:00:00.000Z", por: { id: "u1", nombre: "Administración" }, motivo: "Datos equivocados" };
    expect(resumenDelAvance(version({ retirada, envios: [envio("enviado")] }))).toBe("Retirada del portal");
  });
});
