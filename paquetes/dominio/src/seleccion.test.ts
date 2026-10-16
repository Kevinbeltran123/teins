import { describe, expect, it } from "vitest";
import type { VersionFormato } from "./formato";
import { claveDeRepeticion } from "./repeticiones";
import { aplicarSeleccion, claveOcultable, elegir, mostrarTodo, ocultosDe, SELECCION_VACIA, validarSeleccion, type CapituloSeleccionable } from "./seleccion";

// Formato ficticio (R5): llegada solo para la empresa, un cuarto con fotos, tableros repetibles y un croquis.
const formato: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [
    { clave: "llegada", titulo: "Llegada", soloEmpresa: true, campos: [{ clave: "fotos", etiqueta: "Fotos de llegada", tipo: "foto" }, { clave: "recibe", etiqueta: "Quién recibe", tipo: "texto" }] },
    { clave: "cuarto", titulo: "Cuarto", campos: [{ clave: "potencia", etiqueta: "Potencia", tipo: "texto" }, { clave: "fotos", etiqueta: "Fotos", tipo: "foto" }, { clave: "croquis", etiqueta: "Croquis", tipo: "boceto" }] },
    { clave: "tableros", titulo: "Tableros", repetible: { etiqueta: "Tablero" }, campos: [{ clave: "ubicacion", etiqueta: "Ubicación", tipo: "texto" }] },
  ],
};
const t1 = claveDeRepeticion("tableros", "aaaaaaaa");
const t2 = claveDeRepeticion("tableros", "bbbbbbbb");
const capitulo: CapituloSeleccionable = {
  id: "L1",
  formato,
  respuestas: {
    llegada: { fotos: ["h1", "h2"], recibe: "Persona ficticia" },
    cuarto: { potencia: "15 kVA", fotos: ["h3", "h4", "h5"], croquis: { boceto: "b1" } },
    [t1]: { ubicacion: "Sótano" },
    [t2]: { ubicacion: "Piso 2" },
  },
  repeticiones: { tableros: [{ id: "aaaaaaaa", nombre: "Tablero 1" }, { id: "bbbbbbbb", nombre: "Tablero 2" }] },
};

describe("qué sale en el informe (ADR-0039)", () => {
  it("sin elegir nada, no salen lo solo para la empresa ni el croquis de campo, ni sus valores", () => {
    const r = aplicarSeleccion(capitulo, SELECCION_VACIA);
    expect(r.ocultos).toEqual(["llegada", "cuarto|croquis"]);
    expect(r.respuestas).toEqual({ cuarto: { potencia: "15 kVA", fotos: ["h3", "h4", "h5"] }, [t1]: { ubicacion: "Sótano" }, [t2]: { ubicacion: "Piso 2" } });
  });

  it("oficina oculta un tablero y una foto, y muestra la llegada; quitar una elección vuelve a lo de por omisión", () => {
    let s = elegir(SELECCION_VACIA, claveOcultable("L1", t2), true, false);
    s = elegir(s, claveOcultable("L1", "cuarto", "fotos", "h4"), true, false);
    s = elegir(s, claveOcultable("L1", "llegada"), false, true);
    const r = aplicarSeleccion(capitulo, s);
    expect(r.ocultos).toEqual(["cuarto|croquis", t2]);
    expect(r.respuestas.cuarto?.fotos).toEqual(["h3", "h5"]);
    expect(r.respuestas.llegada).toEqual({ fotos: ["h1", "h2"], recibe: "Persona ficticia" });
    expect(elegir(s, claveOcultable("L1", "llegada"), true, true).mostrados).toEqual([]);
  });

  it("lo de adentro hereda: un bloque oculto oculta sus fotos aunque se hayan mostrado una por una", () => {
    const s = elegir(elegir(SELECCION_VACIA, claveOcultable("L1", "cuarto"), true, false), claveOcultable("L1", "cuarto", "fotos", "h3"), false, false);
    const o = ocultosDe(s, "L1");
    const b = { seccion: formato.secciones[1]!, clave: "cuarto" };
    expect(o.foto(b, formato.secciones[1]!.campos[1]!, "h3")).toBe(true);
  });

  it("«Mostrar todo» quita lo elegido de ese levantamiento y muestra lo de por omisión", () => {
    const s = mostrarTodo(elegir(SELECCION_VACIA, claveOcultable("L1", t1), true, false), "L1", formato, capitulo.repeticiones ?? {});
    const r = aplicarSeleccion(capitulo, s);
    expect(r.ocultos).toBeUndefined();
    expect(r.respuestas.cuarto?.croquis).toEqual({ boceto: "b1" });
  });

  it("la selección tiene límite", () => {
    expect(validarSeleccion({ ocultos: Array.from({ length: 2001 }, (_, i) => `L|${i}`), mostrados: [] })).toBe(false);
    expect(validarSeleccion({ ocultos: ["x".repeat(301)], mostrados: [] })).toBe(false);
  });
});
