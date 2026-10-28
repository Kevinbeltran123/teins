import { describe, expect, it } from "vitest";
import { alMarcarRevisado, correccionesDe, loEscritoAlMarcar, seccionCorregida, type Escrito, type Historial, type Levantamiento } from "./revision";

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

describe("antes y después de cada dato corregido", () => {
  const corregido = (campo: string, anterior: unknown, autor: string, motivo: string | null) =>
    ({ tipo: "campo_corregido", seccion: "tablero", campo, anterior, autor: { nombre: autor }, motivo }) as Historial["eventos"][number];

  it("de varias correcciones del mismo dato, el original es el primero y el autor y el motivo, los últimos", () => {
    const historial = { eventos: [corregido("marca", "ABB", "Ana", "La placa"), corregido("marca", "Siemens", "Luis", null), corregido("tension", "220", "Ana", "Medida")] } as unknown as Historial;
    expect(correccionesDe(historial)).toEqual(
      new Map([
        ["tablero|marca", { original: "ABB", autor: "Luis", motivo: undefined }],
        ["tablero|tension", { original: "220", autor: "Ana", motivo: "Medida" }],
      ]),
    );
  });

  it("sin historial todavía, no hay correcciones", () => {
    expect(correccionesDe(undefined).size).toBe(0);
  });
});

describe("lo que «Marcar revisado» deja atrás, en la confirmación", () => {
  const l = {
    tecnico: { nombre: "Jorge" },
    formatoDefinicion: { secciones: [{ clave: "tablero", campos: [{ clave: "marca", etiqueta: "Marca" }] }] },
    repeticiones: {},
    comentarios: [{ id: "c1", seccion: "tablero", campo: "marca" }],
  } as unknown as Levantamiento;

  it("nombra lo que se pierde y lo que el técnico ya no podrá responder", () => {
    const consecuencias = loEscritoAlMarcar(l, [
      escrito({ tipo: "correccion", seccion: "tablero", campo: "marca" }, true),
      escrito({ tipo: "respuesta", comentarioId: "c1" }, "Ya la revisé"),
      escrito({ tipo: "general" }, "Gracias"),
    ]);
    expect(consecuencias.map(({ texto, detalle }) => ({ texto, detalle }))).toEqual([
      { texto: "Se pierden la corrección sin guardar de «Marca» y la respuesta sin enviar sobre «Marca»", detalle: "Ya no se corrige y las conversaciones se cierran" },
      { texto: "Jorge no podrá responder el comentario general sin enviar", detalle: "Envíelo antes si espera respuesta" },
    ]);
  });

  it("sin nada escrito, no agrega consecuencias", () => {
    expect(loEscritoAlMarcar(l, [])).toEqual([]);
  });
});
