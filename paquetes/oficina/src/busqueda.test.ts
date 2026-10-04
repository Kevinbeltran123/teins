import { describe, expect, it } from "vitest";
import { esTeclaSuelta } from "./atajos";
import { resultadosDeBusqueda, type Fuentes, type Resultado } from "./busqueda";

const r = (tipo: Resultado["tipo"], titulo: string, detalle = ""): Resultado => ({ tipo, id: `${tipo}-${titulo}`, titulo, detalle });

// Los levantamientos llegan ya buscados por el servidor: en cada prueba son los que él devolvería.
const fuentes: Fuentes = {
  recientes: [r("informe", "INF-2026-0012", "Hotel Plaza Real · Torre A")],
  acciones: [r("accion", "Programar visita"), r("accion", "Nuevo cliente")],
  secciones: [r("ir", "Clientes"), r("ir", "Catálogo")],
  clientes: [r("cliente", "Hotel Plaza Real", "2 sitios"), r("cliente", "Clínica Santa Lucía", "1 sitio"), ...["A", "B", "C", "D", "E"].map((x) => r("cliente", `Plaza ${x}`))],
  visitas: [r("visita", "Hotel Plaza Real · Torre A", "Hoy · María Gómez")],
  levantamientos: [r("levantamiento", "Hotel Plaza Real · Torre B", "Red de datos")],
  informes: [r("informe", "Informe de Hotel Plaza Real", "Torre A")],
  cotizaciones: [r("cotizacion", "COT-2026-0006", "Clínica Santa Lucía")],
};

describe("buscar en todo (⌘K / Ctrl + K)", () => {
  it("vacía, muestra lo reciente y las acciones", () => {
    expect(resultadosDeBusqueda("", fuentes).map((g) => g.grupo)).toEqual(["Recientes", "Acciones"]);
    expect(resultadosDeBusqueda("   ", fuentes)[0]!.resultados[0]!.titulo).toBe("INF-2026-0012");
  });

  it("agrupa en orden, hasta cuatro por grupo, sin importar tildes ni mayúsculas", () => {
    const grupos = resultadosDeBusqueda("PLAZA", fuentes);
    expect(grupos.map((g) => g.grupo)).toEqual(["Clientes", "Visitas", "Levantamientos", "Informes"]);
    expect(grupos[0]!.resultados).toHaveLength(4);
    expect(resultadosDeBusqueda("clinica", { ...fuentes, levantamientos: [] }).map((g) => g.grupo)).toEqual(["Clientes", "Cotizaciones"]);
  });

  it("cada palabra tiene que estar, en el título o en el detalle", () => {
    expect(resultadosDeBusqueda("plaza torre a", fuentes).flatMap((g) => g.resultados.map((x) => x.titulo))).toEqual([
      "Hotel Plaza Real · Torre A",
      "Hotel Plaza Real · Torre B",
      "Informe de Hotel Plaza Real",
    ]);
    expect(resultadosDeBusqueda("cot 0006", { ...fuentes, levantamientos: [] })[0]!.resultados[0]!.titulo).toBe("COT-2026-0006");
  });

  it("los levantamientos ya llegan buscados por el servidor (formato y técnico incluidos): no se vuelven a filtrar", () => {
    expect(resultadosDeBusqueda("datos", fuentes).find((g) => g.grupo === "Levantamientos")?.resultados).toHaveLength(1);
    expect(resultadosDeBusqueda("maría", { ...fuentes, visitas: [] }).find((g) => g.grupo === "Levantamientos")?.resultados).toHaveLength(1);
  });

  it("acciones y secciones también se buscan", () => {
    expect(resultadosDeBusqueda("programar", fuentes)[0]).toEqual({ grupo: "Acciones", resultados: [fuentes.acciones[0]] });
    expect(resultadosDeBusqueda("catalogo", fuentes)[0]!.grupo).toBe("Ir a");
  });

  it("sin nada, ningún grupo", () => {
    expect(resultadosDeBusqueda("zzz", { ...fuentes, levantamientos: [] })).toEqual([]);
  });
});

describe("las teclas sueltas de la revisión en serie", () => {
  const tecla = (k: string, m: Partial<KeyboardEvent> = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, ...m }) as KeyboardEvent;
  it("valen solo sin modificadores, fuera de un campo y sin un diálogo abierto", () => {
    expect(esTeclaSuelta(tecla("r"), "r", { escribiendo: false, dialogoAbierto: false })).toBe(true);
    expect(esTeclaSuelta(tecla("R"), "r", { escribiendo: false, dialogoAbierto: false })).toBe(true);
    expect(esTeclaSuelta(tecla("r"), "r", { escribiendo: true, dialogoAbierto: false })).toBe(false);
    expect(esTeclaSuelta(tecla("r"), "r", { escribiendo: false, dialogoAbierto: true })).toBe(false);
    expect(esTeclaSuelta(tecla("r", { metaKey: true }), "r", { escribiendo: false, dialogoAbierto: false })).toBe(false);
    expect(esTeclaSuelta(tecla("r", { ctrlKey: true }), "r", { escribiendo: false, dialogoAbierto: false })).toBe(false);
    // «?» se escribe con Mayúscula: Mayúscula no la anula.
    expect(esTeclaSuelta(tecla("?", { shiftKey: true }), "?", { escribiendo: false, dialogoAbierto: false })).toBe(true);
  });
});
