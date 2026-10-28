import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { crearLevantamiento, type VersionFormato } from "@teins/dominio";
import { anclaDeSeccion } from "./contexto";
import { Repeticiones } from "./Repeticiones";

// Formato ficticio (R5).
const formato: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [{ clave: "tableros", titulo: "Tableros", repetible: { etiqueta: "Tablero", min: 0, max: 3 }, campos: [{ clave: "t", etiqueta: "T", tipo: "texto" }] }],
};

describe("Repeticiones", () => {
  it("lleva el ancla de su sección: «Completar ahora» y el resumen de errores llegan a la lista cuando faltan repeticiones", () => {
    const actual = { ...crearLevantamiento(formato, "0192f0e0-0000-7000-8000-000000000001", new Date("2026-10-27T10:00:00.000Z")), tecnicoId: "t1" };
    const html = renderToStaticMarkup(
      <Repeticiones id={actual.id} formato={formato} seccion={formato.secciones[0]!} actual={actual} faltanEn={new Map()} error="repeticiones_insuficientes" alGuardar={() => undefined} abrir={() => undefined} />,
    );
    expect(html).toContain(`id="${anclaDeSeccion("tableros")}"`);
  });
});
