import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampoHorario, horaDelTelefono } from "./CampoHorario";
import { CampoOpcion, formaDeOpciones } from "./CampoOpcion";
import { armarSeleccion, CampoOpciones } from "./CampoOpciones";
import { TablaDeMedidas } from "./TablaDeMedidas";

/*
  Los controles de selección, horario y tablas de medidas (ADR-0050). Lo que depende de tocar la pantalla lo recorre la
  prueba de extremo a extremo; aquí, la forma de cada uno y las funciones puras.
*/

const sinOp = () => undefined;

describe("la forma de una selección única", () => {
  it("pocas opciones y cortas van en una fila de botones; si no, en una lista", () => {
    expect(formaDeOpciones(["Sí", "No"])).toBe("fila");
    expect(formaDeOpciones(["Bueno", "Regular", "Malo", "No aplica"])).toBe("fila");
    expect(formaDeOpciones(["Bueno", "Regular", "Malo", "No aplica"], true)).toBe("lista");
    expect(formaDeOpciones(["Totalmente", "Parcialmente", "No solucionado"])).toBe("fila");
    expect(formaDeOpciones(["Solucionado remotamente", "Sí"])).toBe("lista");
    expect(formaDeOpciones(["A", "B", "C", "D", "E"])).toBe("lista");
  });
});

describe("CampoOpcion", () => {
  const pintar = (extra: Partial<Parameters<typeof CampoOpcion>[0]> = {}) =>
    renderToStaticMarkup(<CampoOpcion etiqueta="Solucionado" opciones={["Totalmente", "Parcialmente"]} valorInicial={undefined} onCambio={sinOp} {...extra} />);

  it("es un grupo de radios con su nombre y nada viene elegido", () => {
    const html = pintar({ obligatorio: true });
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain("obligatorio");
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).not.toContain('checked=""');
  });

  it("marca lo guardado y, si es un «Otro» ya escrito, abre su texto", () => {
    expect(pintar({ valorInicial: "Parcialmente" })).toContain('checked=""');
    const libre = pintar({ otro: true, valorInicial: "Cerca eléctrica" });
    expect(libre).toContain('aria-label="Solucionado: escribe cuál"');
    expect(libre).toContain('value="Cerca eléctrica"');
    expect(pintar({ otro: true })).not.toContain("escribe cuál");
  });

  it("muestra el error junto al control", () => {
    expect(pintar({ error: "Falta este dato" })).toContain("Falta este dato");
  });
});

describe("CampoOpciones", () => {
  it("armar la selección: en el orden de la lista, con «Otro» solo si tiene texto, y nada es sin respuesta", () => {
    const op = ["CCTV", "UPS", "Alarma"];
    expect(armarSeleccion(op, new Set(["Alarma", "CCTV"]), "")).toEqual({ elegidas: ["CCTV", "Alarma"] });
    expect(armarSeleccion(op, new Set(["UPS"]), "  cerca eléctrica ")).toEqual({ elegidas: ["UPS"], otro: "cerca eléctrica" });
    expect(armarSeleccion(op, new Set(), "cerca eléctrica")).toEqual({ elegidas: [], otro: "cerca eléctrica" });
    expect(armarSeleccion(op, new Set(), "  ")).toBeUndefined();
    expect(armarSeleccion(op, new Set(["Radar"]), "")).toBeUndefined();
  });

  const pintar = (extra: Partial<Parameters<typeof CampoOpciones>[0]> = {}) =>
    renderToStaticMarkup(<CampoOpciones etiqueta="Sistema revisado" opciones={["CCTV", "UPS", "Alarma"]} valorInicial={undefined} onCambio={sinOp} {...extra} />);

  it("una casilla por opción, con la lista como grupo", () => {
    const html = pintar({ otro: true });
    expect(html.match(/type="checkbox"/g)).toHaveLength(4);
    expect(html).toContain('role="group"');
    expect(html).toContain("elige todas las que apliquen");
  });

  it("marca lo guardado y abre «Otro» con su texto", () => {
    const html = pintar({ otro: true, valorInicial: { elegidas: ["UPS"], otro: "cerca eléctrica" } });
    expect(html.match(/checked=""/g)).toHaveLength(2);
    expect(html).toContain('value="cerca eléctrica"');
  });
});

describe("CampoHorario", () => {
  const total = (d: string, h: string) => (d === "08:14" && h === "11:30" ? "3 h 16 min" : "x");
  const pintar = (extra: Partial<Parameters<typeof CampoHorario>[0]> = {}) => renderToStaticMarkup(<CampoHorario etiqueta="Hora de inicio y final" valorInicial={undefined} onCambio={sinOp} total={total} {...extra} />);

  it("llegada y salida, cada una con su «Ahora»; la salida espera a la llegada", () => {
    const html = pintar();
    expect(html).toContain("Llegada");
    expect(html).toContain("Salida");
    expect(html.match(/type="time"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Poner la hora actual en llegada"');
    // La salida, sin llegada, está deshabilitada; la llegada no.
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).not.toContain("Total");
  });

  it("con las dos horas dice el total; si la salida es menor, avisa que es del día siguiente", () => {
    expect(pintar({ valorInicial: { desde: "08:14", hasta: "11:30" } })).toContain("3 h 16 min");
    expect(pintar({ valorInicial: { desde: "22:00", hasta: "01:30" } })).toContain("la salida es al día siguiente");
    expect(pintar({ valorInicial: { desde: "08:14" } })).not.toContain("Total");
  });

  it("sugiere la llegada solo mientras está vacía, sin llenarla", () => {
    const sugerencia = { hora: "08:14", texto: "Usar 8:14 a. m. (foto de llegada)" };
    const vacia = pintar({ sugerenciaDeLlegada: sugerencia });
    expect(vacia).toContain("Usar 8:14 a. m. (foto de llegada)");
    expect(vacia).not.toContain('value="08:14"');
    expect(pintar({ sugerenciaDeLlegada: sugerencia, valorInicial: { desde: "09:00" } })).not.toContain("Usar 8:14");
  });

  it("la hora del teléfono tiene la forma HH:MM", () => {
    expect(horaDelTelefono(new Date(2026, 9, 29, 8, 5))).toBe("08:05");
    expect(horaDelTelefono(new Date(2026, 9, 29, 21, 40))).toBe("21:40");
  });
});

describe("TablaDeMedidas", () => {
  const filas = [
    { etiqueta: "Voltaje F-N", unidad: "V", celdas: [{ clave: "v1", valorInicial: "127" }, { clave: "v2", valorInicial: "" }, { clave: "v3", valorInicial: "" }] },
    { etiqueta: "Frecuencia", unidad: "Hz", celdas: [{ clave: "hz", valorInicial: "60" }] },
  ];
  const html = renderToStaticMarkup(<TablaDeMedidas titulo="Acometida" columnas={["F1", "F2", "F3"]} filas={filas} onCambio={() => true} />);

  it("el encabezado dice las columnas una vez y cada fila, su etiqueta y su unidad una vez", () => {
    expect(html).toContain("Acometida");
    expect(html.match(/>F1</g)).toHaveLength(1);
    expect(html.match(/>V</g)).toHaveLength(1);
    expect(html.match(/>Hz</g)).toHaveLength(1);
  });

  it("cada casilla se nombra con su fila y su columna; una fila de un campo, solo con su fila", () => {
    expect(html).toContain('aria-label="Voltaje F-N, F1"');
    expect(html).toContain('aria-label="Voltaje F-N, F3"');
    expect(html).toContain('aria-label="Frecuencia"');
    expect(html.match(/inputMode="decimal"/g)).toHaveLength(4);
  });

  it("muestra lo que ya tenía escrito", () => {
    expect(html).toContain('value="127"');
    expect(html).toContain('value="60"');
  });
});
