import { describe, expect, it } from "vitest";
import { LIMITES } from "@teins/dominio";
import { documentoOpenApi } from "./openapi";
import { EnviarLevantamiento, llaveDeEnvio, operaciones } from "./operaciones";
import { ESTADO_POR_CODIGO, REINTENTABLE } from "./problemas";

const id = "01927a3e-7c1b-7e2a-9f00-123456789abc";
const comando = {
  tipo: "EnviarLevantamiento",
  llave: llaveDeEnvio(id),
  levantamiento: {
    id,
    formato: "prueba",
    versionFormato: 1,
    respuestas: { cuarto: { potencia: { valor: "12.5", unidad: "kVA" }, fotos: ["a".repeat(64)], nota: "texto" } },
    creadoEn: "2026-09-24T10:00:00.000Z",
    enviadoEn: "2026-09-24T11:00:00.000-05:00",
  },
};

describe("EnviarLevantamiento", () => {
  it("acepta un comando bien formado", () => {
    expect(EnviarLevantamiento.safeParse(comando).success).toBe(true);
  });

  it("rechaza una llave que no corresponde al levantamiento", () => {
    const otra = { ...comando, llave: llaveDeEnvio("01927a3e-7c1b-7e2a-9f00-000000000000") };
    expect(EnviarLevantamiento.safeParse(otra).success).toBe(false);
  });

  it("rechaza medidas no canónicas, huellas inválidas y textos que superan el límite", () => {
    const con = (valor: unknown) => ({ ...comando, levantamiento: { ...comando.levantamiento, respuestas: { cuarto: { x: valor } } } });
    expect(EnviarLevantamiento.safeParse(con({ valor: "12,5", unidad: "m" })).success).toBe(false);
    expect(EnviarLevantamiento.safeParse(con(["A".repeat(64)])).success).toBe(false);
    expect(EnviarLevantamiento.safeParse(con("x".repeat(LIMITES.texto + 1))).success).toBe(false);
    expect(EnviarLevantamiento.safeParse(con({ valor: "1", unidad: "m", extra: true })).success).toBe(false);
  });

  it("rechaza claves de sección o campo fuera del alfabeto permitido", () => {
    const con = { ...comando, levantamiento: { ...comando.levantamiento, respuestas: { "__proto__x": {} } } };
    expect(EnviarLevantamiento.safeParse(con).success).toBe(false);
  });
});

describe("catálogo de operaciones", () => {
  it("no repite método y ruta", () => {
    const claves = Object.values(operaciones).map((o) => `${o.metodo} ${o.ruta}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("toda ruta vive bajo /api y todo código de error tiene estado y política de reintento", () => {
    for (const op of Object.values(operaciones)) {
      expect(op.ruta.startsWith("/api/")).toBe(true);
      for (const codigo of op.errores) {
        expect(ESTADO_POR_CODIGO[codigo]).toBeGreaterThanOrEqual(400);
        expect(typeof REINTENTABLE[codigo]).toBe("boolean");
      }
    }
  });

  it("genera un OpenAPI con cada operación", () => {
    const doc = documentoOpenApi();
    const ids = Object.values(doc.paths ?? {}).flatMap((p) => Object.values(p as object).map((o: { operationId?: string }) => o.operationId));
    expect(ids.sort()).toEqual(Object.keys(operaciones).sort());
    expect(doc.components?.schemas).toHaveProperty("Problema");
  });
});
