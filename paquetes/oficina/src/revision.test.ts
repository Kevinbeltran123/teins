import { describe, expect, it } from "vitest";
import { alMarcarRevisado, seccionCorregida, type Escrito } from "./revision";

const escrito = (que: Escrito, valor: unknown) => ({ que, valor });

describe("«Marcar revisado» con algo escrito sin guardar ni enviar", () => {
  it("se pierden las correcciones, las respuestas y la edición de un comentario; los comentarios nuevos se quedan sin respuesta", () => {
    const correccion = escrito({ tipo: "correccion", seccion: "cuarto_tecnico", campo: "potencia_nominal" }, true);
    const respuesta = escrito({ tipo: "respuesta", comentarioId: "c1" }, "La placa dice 25 kVA");
    const edicion = escrito({ tipo: "edicion" }, { id: "c2", texto: "Revise la foto" });
    const comentario = escrito({ tipo: "comentario", seccion: "cuarto_tecnico", campo: "descripcion" }, "Falta la marca");
    const general = escrito({ tipo: "general" }, "Gracias");
    expect(alMarcarRevisado([correccion, respuesta, edicion, comentario, general])).toEqual({ sePierden: [correccion, respuesta, edicion], sinRespuesta: [comentario, general] });
  });

  it("lo que quedó vacío no cuenta", () => {
    const vacios = [escrito({ tipo: "general" }, "   "), escrito({ tipo: "respuesta", comentarioId: "c1" }, ""), escrito({ tipo: "edicion" }, null)];
    expect(alMarcarRevisado(vacios)).toEqual({ sePierden: [], sinRespuesta: [] });
  });
});

describe("la marca «con correcciones» de cada sección", () => {
  it("cuenta la sección y sus repeticiones, no otra que empieza igual", () => {
    expect(seccionCorregida(["tableros~a0000001"], "tableros")).toBe(true);
    expect(seccionCorregida(["tableros~a0000001"], "tablero")).toBe(false);
    expect(seccionCorregida(["tablero"], "tablero")).toBe(true);
    expect(seccionCorregida(["tablero"], "tableros")).toBe(false);
  });
});
