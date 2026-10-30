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

  it("una revisión en revisión sin responsable se puede tomar sin reasignar", () => {
    expect(tomarRevision({ estado: "en_revision", revisorId: null }, "ana", false)).toEqual({ ok: true, revision: { estado: "en_revision", revisorId: "ana" }, anterior: null });
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

describe("corregir con valores guardados en jsonb", () => {
  // PostgreSQL devuelve las llaves de un jsonb en otro orden: el mismo valor no es un cambio.
  const conTabla: VersionFormato = {
    formato: "prueba",
    version: 1,
    secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "potencia", etiqueta: "Potencia", tipo: "medida", unidades: ["kVA"], obligatorio: true }] }],
  };
  it("reescribir un valor con las llaves en otro orden no deja registro", () => {
    const guardadas = { s: { potencia: { unidad: "kVA", valor: "10" } } };
    expect(corregir(conTabla, guardadas, [{ seccion: "s", campo: "potencia", valor: { valor: "10", unidad: "kVA" } }])).toMatchObject({ ok: true, cambios: [] });
    const noObtenido = { s: { potencia: { motivo: "Sin acceso", noObtenido: true as const } } };
    expect(corregir(conTabla, noObtenido, [{ seccion: "s", campo: "potencia", valor: { noObtenido: true, motivo: "Sin acceso" } }])).toMatchObject({ ok: true, cambios: [] });
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

describe("corregir los tipos nuevos (ADR-0050, regla 8)", () => {
  const nuevo: VersionFormato = {
    formato: "prueba",
    version: 1,
    secciones: [
      {
        clave: "s",
        titulo: "S",
        campos: [
          { clave: "estado", etiqueta: "Estado", tipo: "opcion", opciones: ["Totalmente", "Parcialmente"] },
          { clave: "sistemas", etiqueta: "Sistemas", tipo: "opciones", opciones: ["CCTV", "UPS"] },
          { clave: "horario", etiqueta: "Horario", tipo: "horario" },
        ],
      },
    ],
  };

  it("oficina corrige una selección, varias y un horario, y queda el valor anterior", () => {
    const r = corregir(
      nuevo,
      { s: { estado: "Totalmente", sistemas: { elegidas: ["CCTV"] }, horario: { desde: "08:00", hasta: "09:00" } } },
      [
        { seccion: "s", campo: "estado", valor: "Parcialmente" },
        { seccion: "s", campo: "sistemas", valor: { elegidas: ["CCTV", "UPS"] } },
        { seccion: "s", campo: "horario", valor: { desde: "08:00", hasta: "10:15" } },
      ],
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cambios.map((c) => [c.campo, c.anterior, c.nuevo])).toEqual([
        ["estado", "Totalmente", "Parcialmente"],
        ["sistemas", { elegidas: ["CCTV"] }, { elegidas: ["CCTV", "UPS"] }],
        ["horario", { desde: "08:00", hasta: "09:00" }, { desde: "08:00", hasta: "10:15" }],
      ]);
    }
  });

  it("rechaza lo que el envío rechazaría, y reescribir lo mismo no es un cambio", () => {
    const antes = { s: { sistemas: { elegidas: ["CCTV"] } } };
    const mal = corregir(nuevo, antes, [{ seccion: "s", campo: "sistemas", valor: { elegidas: ["Radar"] } }]);
    expect(mal).toEqual({ ok: false, errores: [{ seccion: "s", campo: "sistemas", codigo: "opcion_invalida" }] });
    const igual = corregir(nuevo, antes, [{ seccion: "s", campo: "sistemas", valor: { elegidas: ["CCTV"] } }]);
    expect(igual).toMatchObject({ ok: true, cambios: [] });
  });
});
