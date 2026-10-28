import { describe, expect, it } from "vitest";
import { primeroLoNuevo } from "./transicion";

describe("lo nuevo arriba", () => {
  const lista = ["viejo-1", "de-otra", "mio-antes", "viejo-2", "mio-ahora"].map((id) => ({ id }));
  const esNuevo = (id: string) => !id.startsWith("viejo");

  it("lo propio primero, del más reciente al más viejo; después lo nuevo de otros y al final lo que ya estaba", () => {
    expect(primeroLoNuevo(lista, esNuevo, ["mio-ahora", "mio-antes"]).map((x) => x.id)).toEqual(["mio-ahora", "mio-antes", "de-otra", "viejo-1", "viejo-2"]);
  });

  it("lo propio que ya estaba (un cambio, no una creación) se queda en su lugar", () => {
    expect(primeroLoNuevo(lista, esNuevo, ["viejo-2"]).map((x) => x.id)).toEqual(["de-otra", "mio-antes", "mio-ahora", "viejo-1", "viejo-2"]);
  });
});
