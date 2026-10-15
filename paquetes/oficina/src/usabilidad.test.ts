import { describe, expect, it } from "vitest";
import { destinoAlArrastrar, esAtajo, etiquetaAtajo, etiquetaEnter, moverEnLista } from "@teins/ui";
import { leerPreferencia, llaveDePreferencia, escribirPreferencia } from "./preferencias";
import { copiaParaRestaurar, copiaTrasCambio, estadoTrasError } from "./guardado";
import { ErrorApi, ErrorDeRed } from "@teins/protocolo";

/** Un almacenamiento en memoria con la forma de localStorage. */
function almacen(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("atajos de teclado en Mac y en Windows", () => {
  it("se escriben como los conoce cada sistema", () => {
    expect(etiquetaAtajo("K", "mac")).toBe("⌘K");
    expect(etiquetaAtajo("B", "windows")).toBe("Ctrl + B");
    expect(etiquetaEnter("mac")).toBe("↵");
    expect(etiquetaEnter("windows")).toBe("Enter");
  });

  it("en Mac es ⌘ y en Windows Ctrl; en Mac no se toma Ctrl, que en los campos borra hasta el final de la línea", () => {
    const tecla = (k: string, m: Partial<KeyboardEvent> = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...m }) as KeyboardEvent;
    expect(esAtajo(tecla("b", { metaKey: true }), "B", "mac")).toBe(true);
    expect(esAtajo(tecla("b", { ctrlKey: true }), "B", "mac")).toBe(false);
    expect(esAtajo(tecla("b", { ctrlKey: true }), "B", "windows")).toBe(true);
    expect(esAtajo(tecla("B", { ctrlKey: true }), "B", "windows")).toBe(true);
    expect(esAtajo(tecla("b", { metaKey: true }), "B", "windows")).toBe(false);
    expect(esAtajo(tecla("b", { ctrlKey: true, altKey: true }), "B", "windows")).toBe(false);
  });
});

describe("ordenar arrastrando", () => {
  it("mueve un elemento sin tocar la lista original", () => {
    const l = ["a", "b", "c", "d"];
    expect(moverEnLista(l, 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moverEnLista(l, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moverEnLista(l, 1, 1)).toBe(l);
    expect(l).toEqual(["a", "b", "c", "d"]);
  });

  it("el destino es la fila cuya mitad pasó el centro de la que se arrastra, también hasta el borde", () => {
    // Cuatro filas de 40 px desde 0; el centro de cada una: 20, 60, 100, 140.
    const filas = [0, 40, 80, 120].map((top) => ({ top, height: 40 }));
    expect(destinoAlArrastrar(filas, 2, 100)).toBe(2);
    expect(destinoAlArrastrar(filas, 2, 59)).toBe(1);
    expect(destinoAlArrastrar(filas, 2, 20)).toBe(0);
    expect(destinoAlArrastrar(filas, 0, 140)).toBe(3);
    expect(destinoAlArrastrar(filas, 0, 61)).toBe(1);
    // Filas de alto distinto (un capítulo con su selección abierta).
    const distintas = [{ top: 0, height: 40 }, { top: 40, height: 200 }, { top: 240, height: 40 }];
    expect(destinoAlArrastrar(distintas, 0, 150)).toBe(1);
    expect(destinoAlArrastrar(distintas, 2, 130)).toBe(1);
    expect(destinoAlArrastrar(distintas, 2, 141)).toBe(2);
  });
});

describe("lo que se recuerda en el equipo", () => {
  it("es de cada persona", () => {
    expect(llaveDePreferencia("u1", "menu-plegado")).toBe("teins-oficina:u1:menu-plegado");
    expect(llaveDePreferencia("u2", "menu-plegado")).not.toBe(llaveDePreferencia("u1", "menu-plegado"));
  });

  it("vuelve al valor inicial si no hay nada, si no se lee o si ya no es válido", () => {
    const a = almacen();
    const esPestana = (v: unknown): v is "enviado" | "revisado" => v === "enviado" || v === "revisado";
    expect(leerPreferencia(a, "x", "enviado", esPestana)).toBe("enviado");
    escribirPreferencia(a, "x", "revisado");
    expect(leerPreferencia(a, "x", "enviado", esPestana)).toBe("revisado");
    a.setItem("x", JSON.stringify("otra"));
    expect(leerPreferencia(a, "x", "enviado", esPestana)).toBe("enviado");
    a.setItem("x", "{roto");
    expect(leerPreferencia(a, "x", "enviado", esPestana)).toBe("enviado");
    expect(leerPreferencia(null, "x", "enviado", esPestana)).toBe("enviado");
  });

  it("escribir sin almacenamiento (navegación privada) no rompe", () => {
    const lleno = { ...almacen(), setItem: () => { throw new Error("QuotaExceededError"); } } as Storage;
    expect(() => escribirPreferencia(lleno, "x", 1)).not.toThrow();
    expect(() => escribirPreferencia(null, "x", 1)).not.toThrow();
  });
});

describe("el guardado automático", () => {
  it("dice qué pasó según el error", () => {
    const problema = (codigo: "conflicto_de_version" | "informe_invalido", status: number) => new ErrorApi({ type: "about:blank", title: "", status, codigo });
    expect(estadoTrasError(problema("conflicto_de_version", 409), true)).toBe("conflicto");
    expect(estadoTrasError(new ErrorDeRed(new TypeError("Failed to fetch")), true)).toBe("sin-conexion");
    expect(estadoTrasError(problema("informe_invalido", 422), false)).toBe("sin-conexion");
    expect(estadoTrasError(problema("informe_invalido", 422), true)).toBe("error");
    expect(estadoTrasError(new ErrorApi({ type: "about:blank", title: "", status: 401, codigo: "no_autenticado" }), true)).toBe("pendiente");
  });

  it("lo escrito en este equipo se recupera si se basa en lo que hay; si otra persona guardó después, se pregunta", () => {
    const borrador = { introduccion: "lo mío" };
    expect(copiaParaRestaurar(null, 3)).toBeNull();
    expect(copiaParaRestaurar({ version: 3, borrador }, 3)).toEqual({ accion: "restaurar", borrador });
    expect(copiaParaRestaurar({ version: 2, borrador }, 3)).toEqual({ accion: "preguntar", borrador });
    // Una copia de una versión que el servidor no tiene todavía no sirve (otra base de datos, una copia vieja rota).
    expect(copiaParaRestaurar({ version: 9, borrador }, 3)).toBeNull();
  });

  it("lo escrito queda en el equipo también con un conflicto; el de lo escrito antes conserva su copia hasta elegir", () => {
    expect(copiaTrasCambio("pendiente", true, false)).toBe("escribir");
    expect(copiaTrasCambio("sin-conexion", true, false)).toBe("escribir");
    expect(copiaTrasCambio("guardado", false, false)).toBe("borrar");
    expect(copiaTrasCambio("conflicto", true, false)).toBe("escribir");
    expect(copiaTrasCambio("conflicto", true, true)).toBe("dejar");
    expect(copiaTrasCambio("conflicto", false, false)).toBe("dejar");
    expect(copiaTrasCambio("guardando", true, false)).toBe("dejar");
  });
});
