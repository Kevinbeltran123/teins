import { describe, expect, it } from "vitest";
import type { VersionFormato } from "./formato";
import { corregir, marcarRevisado, puedeEditar, tomarRevision } from "./revision";

// Formato ficticio (R5).
const formato: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [
    {
      clave: "s",
      titulo: "S",
      campos: [
        { clave: "potencia", etiqueta: "Potencia", tipo: "medida", unidades: ["kVA", "kW"], obligatorio: true },
        { clave: "nota", etiqueta: "Nota", tipo: "texto" },
        { clave: "fotos", etiqueta: "Fotos", tipo: "foto" },
      ],
    },
  ],
};
const respuestas = { s: { potencia: { valor: "10", unidad: "kVA" }, nota: "antes" } };

describe("toma de revisión (I-1)", () => {
  it("un enviado se toma; otra persona solo lo quita pidiéndolo, y se sabe a quién", () => {
    const tomada = tomarRevision({ estado: "enviado", revisorId: null }, "ana", false);
    expect(tomada).toEqual({ ok: true, revision: { estado: "en_revision", revisorId: "ana" }, anterior: null });
    const enRevision = { estado: "en_revision" as const, revisorId: "ana" };
    expect(tomarRevision(enRevision, "luis", false)).toEqual({ ok: false, motivo: "tomado_por_otro", revisorId: "ana" });
    expect(tomarRevision(enRevision, "luis", true)).toEqual({ ok: true, revision: { estado: "en_revision", revisorId: "luis" }, anterior: "ana" });
    expect(tomarRevision(enRevision, "ana", false)).toEqual({ ok: false, motivo: "ya_es_suya" });
    expect(tomarRevision({ estado: "revisado", revisorId: "ana" }, "luis", true)).toEqual({ ok: false, motivo: "estado_invalido" });
  });

  it("solo quien la tomó edita, y solo en revisión", () => {
    expect(puedeEditar({ estado: "en_revision", revisorId: "ana" }, "ana")).toBeNull();
    expect(puedeEditar({ estado: "en_revision", revisorId: "ana" }, "luis")).toBe("no_tomado");
    expect(puedeEditar({ estado: "enviado", revisorId: null }, "ana")).toBe("estado_invalido");
  });
});

describe("corregir (QA-8)", () => {
  it("devuelve solo lo que cambia, con valor anterior y nuevo", () => {
    const r = corregir(formato, respuestas, [
      { seccion: "s", campo: "potencia", valor: { valor: "12.5", unidad: "kVA" } },
      { seccion: "s", campo: "nota", valor: "antes" },
    ]);
    expect(r).toEqual({
      ok: true,
      respuestas: { s: { potencia: { valor: "12.5", unidad: "kVA" }, nota: "antes" } },
      cambios: [{ seccion: "s", campo: "potencia", anterior: { valor: "10", unidad: "kVA" }, nuevo: { valor: "12.5", unidad: "kVA" } }],
    });
    // Las respuestas originales no se tocan.
    expect(respuestas.s.potencia.valor).toBe("10");
  });

  it("aplica las reglas del envío, no corrige fotos ni campos ajenos al formato", () => {
    const r = corregir(formato, respuestas, [
      { seccion: "s", campo: "potencia", valor: { valor: "12", unidad: "m" } },
      { seccion: "s", campo: "fotos", valor: [] },
      { seccion: "s", campo: "otro", valor: "x" },
      { seccion: "s", campo: "potencia", valor: undefined },
    ]);
    expect(r).toEqual({
      ok: false,
      errores: [
        { seccion: "s", campo: "potencia", codigo: "unidad_no_permitida" },
        { seccion: "s", campo: "fotos", codigo: "no_corregible" },
        { seccion: "s", campo: "otro", codigo: "campo_desconocido" },
        { seccion: "s", campo: "potencia", codigo: "campo_obligatorio" },
      ],
    });
  });

  it("borrar un dato opcional es un cambio con valor nuevo vacío", () => {
    const r = corregir(formato, respuestas, [{ seccion: "s", campo: "nota", valor: undefined }]);
    expect(r).toMatchObject({ ok: true, respuestas: { s: { potencia: { valor: "10", unidad: "kVA" } } }, cambios: [{ campo: "nota", anterior: "antes", nuevo: undefined }] });
  });
});

describe("marcar revisado", () => {
  it("exige la toma y respuestas válidas", () => {
    const enRevision = { estado: "en_revision" as const, revisorId: "ana" };
    expect(marcarRevisado(enRevision, "ana", formato, respuestas)).toEqual({ ok: true, revision: { estado: "revisado", revisorId: "ana" } });
    expect(marcarRevisado(enRevision, "luis", formato, respuestas)).toEqual({ ok: false, motivo: "no_tomado" });
    expect(marcarRevisado(enRevision, "ana", formato, { s: {} })).toMatchObject({ ok: false, motivo: "respuestas_invalidas" });
  });
});
