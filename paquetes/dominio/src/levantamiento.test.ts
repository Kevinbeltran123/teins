import { describe, expect, it } from "vitest";
import { agregarFoto, crearLevantamiento, LevantamientoNoEditable, responder } from "./levantamiento";

const formato = { formato: "prueba", version: 1, secciones: [] };
const ahora = new Date("2026-09-24T10:00:00.000Z");
const despues = new Date("2026-09-24T10:05:00.000Z");
const h1 = "a".repeat(64);

describe("edición del borrador", () => {
  it("responder guarda, reemplaza y borra sin mutar el original", () => {
    const original = crearLevantamiento(formato, "l1", ahora);
    const con = responder(original, "s", "t", "hola", despues);
    expect(con.respuestas).toEqual({ s: { t: "hola" } });
    expect(con.actualizadoEn).toBe(despues.toISOString());
    expect(original.respuestas).toEqual({});
    expect(responder(con, "s", "t", undefined, despues).respuestas).toEqual({ s: {} });
  });

  it("agregarFoto no repite una huella", () => {
    let l = crearLevantamiento(formato, "l1", ahora);
    l = agregarFoto(l, "s", "f", h1, despues);
    l = agregarFoto(l, "s", "f", h1, despues);
    expect(l.respuestas["s"]?.["f"]).toEqual([h1]);
  });

  it("un levantamiento enviado no se puede editar (regla 4)", () => {
    const enviado = { ...crearLevantamiento(formato, "l1", ahora), estado: "enviado" as const };
    expect(() => responder(enviado, "s", "t", "x", despues)).toThrow(LevantamientoNoEditable);
    expect(() => agregarFoto(enviado, "s", "f", h1, despues)).toThrow(LevantamientoNoEditable);
  });
});
