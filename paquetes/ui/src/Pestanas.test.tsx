import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Pestanas } from "./Pestanas";

const pintar = (cantidad: number | null | undefined) =>
  renderToStaticMarkup(<Pestanas etiqueta="Estado" activa="a" onCambio={() => undefined} pestanas={[{ valor: "a", etiqueta: "Revisados", cantidad }]} />);

describe("conteo de una pestaña", () => {
  it("mientras llega guarda su lugar, sin un número inventado", () => {
    const html = pintar(null);
    expect(html).toContain('aria-hidden="true" class="num');
    expect(html).not.toMatch(/Revisados<span[^>]*>\d/);
  });

  it("con número lo muestra y sin conteo no pone nada", () => {
    expect(pintar(287)).toContain('<span class="num">287</span>');
    expect(pintar(undefined)).not.toContain('class="num');
  });
});
