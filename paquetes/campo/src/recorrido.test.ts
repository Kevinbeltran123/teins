import { describe, expect, it } from "vitest";
import { claveDeRepeticion, type VersionFormato } from "@teins/dominio";
import type { LevantamientoLocal } from "./datos/modelo";
import { enFrase, pasosDe, resumenDeRecorrido } from "./recorrido";

// Formato ficticio (R5).
const formato: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [
    {
      clave: "datos",
      titulo: "Datos",
      campos: [
        { clave: "nombre", etiqueta: "Nombre", tipo: "texto", obligatorio: true },
        { clave: "fotos", etiqueta: "Fotos", tipo: "foto" },
        { clave: "notas", etiqueta: "Notas", tipo: "texto" },
        { clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["und"] },
        { clave: "firma", etiqueta: "Firma", tipo: "firma" },
      ],
    },
    { clave: "tableros", titulo: "Tableros", repetible: { etiqueta: "Tablero" }, campos: [{ clave: "corriente", etiqueta: "Corriente", tipo: "texto", obligatorio: true }] },
    { clave: "cierre", titulo: "Cierre", campos: [{ clave: "obs", etiqueta: "Observaciones", tipo: "texto" }] },
  ],
};

function levantamiento(respuestas: LevantamientoLocal["respuestas"], repeticiones: LevantamientoLocal["repeticiones"] = { tableros: [] }): LevantamientoLocal {
  return { id: "l1", formato: "prueba", versionFormato: 1, estado: "borrador", respuestas, repeticiones, creadoEn: "2026-09-24T10:00:00.000Z", actualizadoEn: "2026-09-24T10:00:00.000Z" };
}

describe("pasosDe", () => {
  it("datos y fotos juntos; materiales y firma en su propio paso con su etiqueta; una sección repetible es un paso", () => {
    expect(pasosDe(formato).map((p) => [p.id, p.titulo, p.campos.map((c) => c.clave)])).toEqual([
      ["datos#0", "Datos", ["nombre", "fotos", "notas"]],
      ["datos#1", "Materiales", ["materiales"]],
      ["datos#2", "Firma", ["firma"]],
      ["tableros", "Tableros", ["corriente"]],
      ["cierre#0", "Cierre", ["obs"]],
    ]);
  });
});

describe("resumenDeRecorrido", () => {
  it("un paso está hecho si se tocó y no le falta nada; el siguiente es el primero que no", () => {
    const l = levantamiento({ datos: { nombre: "Ana" }, cierre: { obs: "Ok" } }, { tableros: [{ id: "r1000000", nombre: "Tablero 1" }] });
    const { hechos, siguiente } = resumenDeRecorrido(formato, l);
    // El tablero existe pero le falta la corriente.
    expect(hechos).toEqual([true, false, false, false, true]);
    expect(siguiente?.id).toBe("datos#1");
  });

  it("todo hecho: no hay siguiente", () => {
    const l = levantamiento(
      {
        datos: { nombre: "Ana", materiales: [{ id: "linea001", descripcion: "Cable", cantidad: "1", unidad: "und" }], firma: { firma: "a".repeat(64), nombre: "Ana", firmadoEn: "2026-09-24T10:00:00.000Z", declaracion: "Constancia" } },
        [claveDeRepeticion("tableros", "r1000000")]: { corriente: "20 A" },
        cierre: { obs: "Ok" },
      },
      { tableros: [{ id: "r1000000", nombre: "Tablero 1" }] },
    );
    const { hechos, siguiente } = resumenDeRecorrido(formato, l);
    expect(hechos.every(Boolean)).toBe(true);
    expect(siguiente).toBeUndefined();
  });
});

describe("enFrase", () => {
  it("baja solo la primera letra, y no la de una sigla", () => {
    expect(enFrase("Identificación del equipo")).toBe("identificación del equipo");
    expect(enFrase("UPS y baterías")).toBe("UPS y baterías");
    expect(enFrase("Informe de baterías UPS")).toBe("informe de baterías UPS");
  });
});

describe("pasos con condiciones (ADR-0058)", () => {
  const conCondiciones: VersionFormato = {
    formato: "condiciones",
    version: 1,
    appMinima: 17,
    secciones: [
      {
        clave: "servicio",
        titulo: "Servicio",
        campos: [
          { clave: "tipo", etiqueta: "Tipo", tipo: "opcion", opciones: ["Preventivo", "Correctivo"] },
          { clave: "nota", etiqueta: "Nota", tipo: "texto", visibleSi: { campo: "tipo", en: ["Correctivo"] } },
        ],
      },
      { clave: "causas", titulo: "Causas", visibleSi: { seccion: "servicio", campo: "tipo", en: ["Correctivo"] }, campos: [{ clave: "causa", etiqueta: "Causa", tipo: "texto" }] },
      { clave: "cierre", titulo: "Cierre", campos: [{ clave: "obs", etiqueta: "Observaciones", tipo: "texto" }] },
    ],
  };

  it("lo oculto no da pasos ni campos; aparece al elegir la opción, con los mismos ids", () => {
    const sin = pasosDe(conCondiciones, { servicio: { tipo: "Preventivo" } });
    expect(sin.map((p) => p.id)).toEqual(["servicio#0", "cierre#0"]);
    expect(sin[0]!.campos.map((c) => c.clave)).toEqual(["tipo"]);
    const con = pasosDe(conCondiciones, { servicio: { tipo: "Correctivo" } });
    expect(con.map((p) => p.id)).toEqual(["servicio#0", "causas#0", "cierre#0"]);
    expect(con[0]!.campos.map((c) => c.clave)).toEqual(["tipo", "nota"]);
  });
});
