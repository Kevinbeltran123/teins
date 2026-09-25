import { describe, expect, it } from "vitest";
import type { VersionFormato } from "./formato";
import { versionesVigentes } from "./vigencia";

const version = (formato: string, v: number, extra: Partial<VersionFormato> = {}): VersionFormato => ({
  formato,
  version: v,
  secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto" }] }],
  ...extra,
});

describe("versionesVigentes", () => {
  it("elige la versión más reciente de cada formato, ordenadas por nombre", () => {
    const vigentes = versionesVigentes([version("ups", 1), version("ups", 3), version("ups", 2), version("datos", 1, { nombre: "Cableado" })], 1);
    expect(vigentes.map((v) => `${v.formato}@${v.version}`)).toEqual(["datos@1", "ups@3"]);
  });

  it("ignora las versiones que exigen una app más nueva", () => {
    const vigentes = versionesVigentes([version("ups", 1), version("ups", 2, { appMinima: 5 })], 4);
    expect(vigentes.map((v) => v.version)).toEqual([1]);
    expect(versionesVigentes([version("ups", 1), version("ups", 2, { appMinima: 5 })], 5).map((v) => v.version)).toEqual([2]);
  });
});
