import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hayCorreccionAbierta, LoSinEnviar, sinEnviarDe } from "./sinEnviar";

/** La pestaña: un `sessionStorage` en memoria. */
function pestana() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

const comentario = { que: { tipo: "comentario" as const, seccion: "tablero", campo: "marca" }, valor: "Falta la marca" };
const correccion = { que: { tipo: "correccion" as const, seccion: "tablero", campo: "potencia" }, valor: true };

describe("lo escrito sin enviar en la revisión (iteración 42)", () => {
  let almacen: ReturnType<typeof pestana>;
  beforeEach(() => {
    almacen = pestana();
    vi.stubGlobal("sessionStorage", almacen);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("los comentarios vuelven al recargar; de una corrección no queda nada en la pestaña", () => {
    const antes = new LoSinEnviar("lev-1");
    antes.set("a", comentario);
    antes.set("b", correccion);
    const despues = new LoSinEnviar("lev-1");
    expect([...despues]).toEqual([["a", comentario]]);
    expect(hayCorreccionAbierta(antes.values())).toBe(true);
    expect(hayCorreccionAbierta(despues.values())).toBe(false);
  });

  it("enviado o descartado todo, la pestaña queda limpia", () => {
    const registro = new LoSinEnviar("lev-2");
    registro.set("a", comentario);
    registro.delete("a");
    expect(almacen.m.has("revision-sin-enviar:lev-2")).toBe(false);
    registro.set("a", comentario);
    registro.clear();
    expect(almacen.m.size).toBe(0);
  });

  it("sin almacenamiento de la pestaña, lo escrito sigue en memoria", () => {
    vi.stubGlobal("sessionStorage", undefined);
    const registro = new LoSinEnviar("lev-3");
    registro.set("a", comentario);
    expect(registro.get("a")).toEqual(comentario);
  });

  it("salir del detalle y volver encuentra el mismo registro", () => {
    expect(sinEnviarDe("lev-4")).toBe(sinEnviarDe("lev-4"));
    expect(sinEnviarDe("lev-4")).not.toBe(sinEnviarDe("lev-5"));
  });
});
