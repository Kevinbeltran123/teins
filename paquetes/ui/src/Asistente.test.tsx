import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BotonAsistente, Destello, OrbeAsistente } from "./Asistente";

const sinOp = () => undefined;

const pintar = (extra: Partial<Parameters<typeof BotonAsistente>[0]> = {}) =>
  renderToStaticMarkup(<BotonAsistente nombre="Chispa" abierto={false} pensando={false} listo={false} onClick={sinOp} {...extra} />);

describe("BotonAsistente", () => {
  it("el nombre accesible dice el estado", () => {
    expect(pintar()).toContain('aria-label="Chispa"');
    expect(pintar({ pensando: true })).toContain('aria-label="Chispa: respondiendo"');
    expect(pintar({ listo: true })).toContain('aria-label="Chispa: hay una respuesta lista"');
  });

  it("la ayuda al pasar el cursor solo dice para qué sirve: no repite el nombre accesible", () => {
    expect(pintar()).toContain('title="Preguntar sobre sus datos"');
    expect(pintar({ pensando: true })).toContain('title="Preguntar sobre sus datos"');
  });

  it("abre y cierra un panel: aria-expanded y cuál controla", () => {
    expect(pintar()).toContain('aria-expanded="false"');
    expect(pintar()).not.toContain("aria-pressed");
    const abierto = pintar({ abierto: true, controla: "panel-asistente", id: "boton-asistente" });
    expect(abierto).toContain('aria-expanded="true"');
    expect(abierto).toContain('aria-controls="panel-asistente"');
    expect(abierto).toContain('id="boton-asistente"');
  });

  it("muestra el destello y el nombre; el punto solo con una respuesta lista", () => {
    const html = pintar();
    expect(html).toContain('class="destello"');
    expect(html).toContain(">Chispa</span>");
    expect(html).not.toContain('class="punto"');
    expect(pintar({ listo: true })).toContain('class="punto"');
  });

  it("mientras responde no muestra el punto: la respuesta todavía no está", () => {
    const html = pintar({ pensando: true, listo: true });
    expect(html).toContain('aria-label="Chispa: respondiendo"');
    expect(html).not.toContain('class="punto"');
  });

  it("mientras responde lleva la clase de pensando", () => {
    expect(pintar()).toContain('class="ia"');
    expect(pintar({ pensando: true })).toContain('class="ia pensando"');
  });
});

describe("Destello y OrbeAsistente", () => {
  it("son decoración: aria-hidden", () => {
    expect(renderToStaticMarkup(<Destello />)).toBe('<span aria-hidden="true" class="destello"></span>');
    expect(renderToStaticMarkup(<Destello latiendo className="x" />)).toContain('class="destello latiendo x"');
    const orbe = renderToStaticMarkup(<OrbeAsistente tamano="grande" pensando />);
    expect(orbe).toMatch(/^<span aria-hidden="true" class="orbe-ia grande pensando">/);
    expect(renderToStaticMarkup(<OrbeAsistente tamano="chico" />)).toMatch(/^<span aria-hidden="true" class="orbe-ia">/);
  });
});
