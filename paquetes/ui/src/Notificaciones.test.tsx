import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProveedorNotificaciones } from "./Notificaciones";

describe("la región de notificaciones", () => {
  it("se reconoce por un atributo estable y deja a la derecha el hueco de un panel abierto", () => {
    const html = renderToStaticMarkup(<ProveedorNotificaciones lugar="abajo-derecha">{null}</ProveedorNotificaciones>);
    expect(html).toContain("data-notificaciones");
    expect(html).toContain("right-[calc(var(--hueco-derecho,0px)+1.5rem)]");
  });

});
