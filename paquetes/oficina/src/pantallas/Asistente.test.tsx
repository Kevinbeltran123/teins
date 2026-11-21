import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { IntercambioDelAsistente } from "@teins/protocolo";
import type { ControlDelAsistente } from "../asistente";
import { Caja, RespuestaVista, SUGERENCIAS, TextoPlano } from "./Asistente";
import { conAsistente } from "./Paleta";

describe("el texto del modelo en pantalla", () => {
  it("sale como texto: el HTML no se interpreta y no hay enlaces ni imágenes", () => {
    const html = renderToStaticMarkup(<TextoPlano texto={'<b>Ojo</b> <a href="https://x.co">aquí</a>\n\n- <img src=x onerror=alert(1)>\n- [enlace](https://x.co)'} />);
    expect(html).toContain("&lt;b&gt;Ojo&lt;/b&gt;");
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("<img");
    expect(html).toContain("<li>[enlace](https://x.co)</li>");
  });

  it("párrafos y viñetas", () => {
    expect(renderToStaticMarkup(<TextoPlano texto={"Uno.\n\n- a\n- b"} />)).toBe('<div class="asis-texto"><p>Uno.</p><ul><li>a</li><li>b</li></ul></div>');
    expect(renderToStaticMarkup(<TextoPlano texto="" />)).toBe("");
  });
});

describe("el asistente en Buscar", () => {
  const acciones = [{ grupo: "Acciones", resultados: [{ tipo: "accion" as const, id: "programar", titulo: "Programar visita" }] }];

  it("sin texto, «Abrir {nombre}» va entre las acciones", () => {
    expect(conAsistente(acciones, "  ", "Chispa")).toEqual([{ grupo: "Acciones", resultados: [...acciones[0]!.resultados, { tipo: "asistente", id: "abrir", titulo: "Abrir Chispa" }] }]);
  });

  it("al escribir, un grupo con su nombre para preguntarle", () => {
    expect(conAsistente([], " cuánto cable ", "Chispa")).toEqual([{ grupo: "Chispa", resultados: [{ tipo: "asistente", id: "preguntar", titulo: "Preguntarle a Chispa «cuánto cable»" }] }]);
  });
});

const intercambio = (estado: IntercambioDelAsistente["estado"]): IntercambioDelAsistente => ({
  id: "11111111-1111-4111-8111-111111111111",
  pregunta: "¿Cuánto cable?",
  creadoEn: "2026-11-20T15:00:00.000Z",
  estado,
  duracionSegundos: null,
  pasos: [],
  respuesta: null,
  error: null,
});

function pintarCaja(estado: IntercambioDelAsistente["estado"] | null, bloqueada = false) {
  const consultas = new QueryClient();
  if (estado) consultas.setQueryData(["asistente", "conversacion", "c1"], { id: "c1", titulo: "t", intercambios: [intercambio(estado)] });
  const c = { vista: estado ? "conversacion" : "inicio", conversacionId: estado ? "c1" : null, borrador: "Hola", aperturas: 0, preguntando: false, deteniendo: false } as unknown as ControlDelAsistente;
  return renderToStaticMarkup(
    <QueryClientProvider client={consultas}>
      <Caja c={c} bloqueada={bloqueada} placeholder="Pregunte" />
    </QueryClientProvider>,
  );
}

describe("la caja de pregunta", () => {
  it("con una respuesta en curso, el botón es «Detener»", () => {
    expect(pintarCaja("en_curso")).toContain('aria-label="Detener la respuesta"');
    expect(pintarCaja("en_curso")).not.toContain('aria-label="Preguntar"');
  });
  it("sin respuesta en curso, «Preguntar»; bloqueada, deshabilitada y sin la pista de Enter", () => {
    expect(pintarCaja("lista")).toContain('aria-label="Preguntar"');
    expect(pintarCaja(null)).toContain('aria-label="Preguntar"');
    const bloqueada = pintarCaja(null, true);
    expect(bloqueada).toMatch(/<textarea[^>]* disabled=""/);
    expect(bloqueada).not.toContain("preguntar</span>");
  });
  it("respeta el largo máximo de la pregunta", () => {
    expect(pintarCaja(null)).toContain('maxLength="2000"');
  });
});

describe("la respuesta", () => {
  it("pinta una o dos cifras destacadas, la segunda más chica, con su unidad si la tiene", () => {
    const html = renderToStaticMarkup(
      <RespuestaVista r={{ texto: "", destacado: { cifras: [{ valor: "1.215", unidad: "m" }, { valor: "$ 3.523.500", unidad: null }], descripcion: "para 40 puntos" }, tablas: [], fuentes: null, serie: null }} />,
    );
    expect(html).toContain('<span class="asis-cifra">1.215<span class="asis-unidad">m</span></span>');
    expect(html).toContain('<span class="asis-cifra segunda">$ 3.523.500</span>');
    expect(html).toContain('<span class="asis-cifra-que">para 40 puntos</span>');
  });
});

describe("las sugerencias", () => {
  it("son genéricas: ni regiones ni números de orden de una empresa (R7)", () => {
    expect(SUGERENCIAS.map(([t]) => t)).toEqual(["¿Cuánto cable se gastó en los últimos 12 meses?", "¿Cuánto UTP presupuesto para un cableado de 40 puntos?", "¿Cuántas visitas hubo cada mes este año?", "Resuma el último levantamiento revisado"]);
  });
});

describe("las notificaciones con el panel abierto", () => {
  it("se corren a la izquierda del panel solo cuando hay espacio, por una variable y no por clases de Tailwind", () => {
    const css = readFileSync(new URL("../../../ui/oficina.css", import.meta.url), "utf8");
    expect(css).toContain("@media (min-width: 900px) { :root:has(.asis-panel) { --hueco-derecho: min(440px, 100vw); } }");
    expect(css).not.toMatch(/\.fixed\.z-40/);
  });
});
