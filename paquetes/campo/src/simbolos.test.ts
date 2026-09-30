import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SimboloLocal } from "./datos/modelo";
import { buscarSimbolos, porCategoria, recientes, recordarReciente } from "./simbolos";

const s = (id: string, nombre: string, categoria: string, orden: number, extra: Partial<SimboloLocal> = {}): SimboloLocal => ({ id, nombre, categoria, trazado: "M0 0L1 1", orden, activo: true, ...extra });
const biblioteca = [
  s("rack", "Rack", "Datos", 3),
  s("tablero", "Tablero", "Energía", 0),
  s("toma", "Tomacorriente", "Energía", 1),
  s("regulada", "Toma regulada", "Energía", 2),
  s("ups", "Respaldo", "Energía", 4, { texto: "UPS" }),
  s("viejo", "Tablero viejo", "Energía", 5, { activo: false }),
];

describe("biblioteca de símbolos en el teléfono (iteración 19)", () => {
  // Las pruebas corren en Node: un almacenamiento en memoria hace de localStorage.
  beforeEach(() => {
    const guardado = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => void guardado.set(k, v) });
  });

  it("agrupa los activos por categoría, en el orden de la biblioteca", () => {
    expect(porCategoria(biblioteca).map((g) => [g.categoria, g.simbolos.map((x) => x.id)])).toEqual([
      ["Energía", ["tablero", "toma", "regulada", "ups"]],
      ["Datos", ["rack"]],
    ]);
  });

  it("busca sin tildes por el comienzo de cada palabra, también por la sigla; nunca los retirados", () => {
    expect(buscarSimbolos(biblioteca, "tom").map((x) => x.id)).toEqual(["toma", "regulada"]);
    expect(buscarSimbolos(biblioteca, "ENERGIA reg").map((x) => x.id)).toEqual(["regulada"]);
    expect(buscarSimbolos(biblioteca, "ups").map((x) => x.id)).toEqual(["ups"]);
    expect(buscarSimbolos(biblioteca, "tablero").map((x) => x.id)).toEqual(["tablero"]);
    expect(buscarSimbolos(biblioteca, "  ")).toEqual([]);
  });

  it("sin almacenamiento (navegación privada) no hay recientes y no falla", () => {
    vi.unstubAllGlobals();
    recordarReciente("toma");
    expect(recientes(biblioteca)).toEqual([]);
  });

  it("recuerda los últimos puestos, el más reciente primero, sin repetidos ni retirados", () => {
    expect(recientes(biblioteca)).toEqual([]);
    recordarReciente("toma");
    recordarReciente("rack");
    recordarReciente("toma");
    recordarReciente("viejo");
    expect(recientes(biblioteca).map((x) => x.id)).toEqual(["toma", "rack"]);
  });
});
