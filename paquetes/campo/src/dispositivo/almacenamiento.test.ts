import { describe, expect, it } from "vitest";
import { pocoEspacio } from "./almacenamiento";

const MB = 1024 * 1024;

describe("poco espacio (ADR-0035)", () => {
  it("avisa cuando queda libre menos del 10 % de lo que el navegador le da a la app", () => {
    expect(pocoEspacio({ usoBytes: 950 * MB, cuotaBytes: 1000 * MB })).toBe(true);
    expect(pocoEspacio({ usoBytes: 900 * MB, cuotaBytes: 1000 * MB })).toBe(false);
    expect(pocoEspacio({ usoBytes: 10 * MB, cuotaBytes: 1000 * MB })).toBe(false);
  });

  it("sin medida no avisa: no se adivina", () => {
    expect(pocoEspacio({ usoBytes: undefined, cuotaBytes: 1000 * MB })).toBe(false);
    expect(pocoEspacio({ usoBytes: 950 * MB, cuotaBytes: undefined })).toBe(false);
  });
});
