import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { enviarLevantamiento } from "./estados";
import type { VersionFormato } from "./formato";
import { crearLevantamiento, type Levantamiento } from "./levantamiento";

const formato: VersionFormato = {
  formato: "prueba",
  version: 2,
  secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto", obligatorio: true }] }],
};
const ahora = new Date("2026-09-24T10:00:00.000Z");
const despues = new Date("2026-09-24T12:00:00.000Z");
const completo = { ...crearLevantamiento(formato, "l1", ahora), respuestas: { s: { t: "listo" } } };

describe("enviarLevantamiento", () => {
  it("pasa de borrador a enviado con la hora del dispositivo", () => {
    const r = enviarLevantamiento(completo, formato, despues);
    expect(r).toEqual({ ok: true, levantamiento: { ...completo, estado: "enviado", enviadoEn: despues.toISOString() } });
  });

  it("no envía si faltan obligatorios", () => {
    const r = enviarLevantamiento(crearLevantamiento(formato, "l1", ahora), formato, despues);
    expect(r).toMatchObject({ ok: false, motivo: "respuestas_invalidas" });
  });

  it("no valida contra otra versión del formato", () => {
    expect(enviarLevantamiento(completo, { ...formato, version: 3 }, despues)).toEqual({ ok: false, motivo: "formato_distinto" });
  });

  it("un levantamiento enviado no se puede volver a enviar, sin importar cuántas veces se intente", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (intentos) => {
        let actual: Levantamiento = completo;
        let exitos = 0;
        for (let i = 0; i < intentos; i++) {
          const r = enviarLevantamiento(actual, formato, despues);
          if (r.ok) {
            exitos++;
            actual = r.levantamiento;
          } else expect(r.motivo).toBe("no_es_borrador");
        }
        return exitos === 1 && actual.estado === "enviado";
      }),
    );
  });
});
