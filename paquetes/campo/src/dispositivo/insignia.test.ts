import { afterEach, describe, expect, it, vi } from "vitest";
import { ponerInsignia } from "./insignia";

/*
  El número en el ícono de la app (Badging API): lo que el técnico no ha leído de oficina. iOS 16.4+ lo muestra en la
  app instalada con permiso de avisos; donde no existe la API o falla, no pasa nada.
*/

afterEach(() => vi.unstubAllGlobals());

describe("la insignia del ícono", () => {
  it("con algo sin leer pone el número; sin nada, la quita", async () => {
    const setAppBadge = vi.fn(async () => undefined);
    const clearAppBadge = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { setAppBadge, clearAppBadge });
    await ponerInsignia(3);
    expect(setAppBadge).toHaveBeenCalledWith(3);
    await ponerInsignia(0);
    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(setAppBadge).toHaveBeenCalledTimes(1);
  });

  it("sin la API no lanza", async () => {
    vi.stubGlobal("navigator", {});
    await expect(ponerInsignia(2)).resolves.toBeUndefined();
    await expect(ponerInsignia(0)).resolves.toBeUndefined();
  });

  it("si la API rechaza (sin permiso de avisos), no lanza", async () => {
    vi.stubGlobal("navigator", { setAppBadge: vi.fn(async () => Promise.reject(new Error("sin permiso"))), clearAppBadge: vi.fn(() => Promise.reject(new Error("sin permiso"))) });
    await expect(ponerInsignia(2)).resolves.toBeUndefined();
    await expect(ponerInsignia(0)).resolves.toBeUndefined();
  });

  it("si la API lanza al llamarla, tampoco", async () => {
    vi.stubGlobal("navigator", {
      setAppBadge: () => {
        throw new Error("no soportado");
      },
    });
    await expect(ponerInsignia(1)).resolves.toBeUndefined();
  });
});
