import { describe, expect, it } from "vitest";
import fc from "fast-check";
import conformidad from "../conformidad/validacion.json" with { type: "json" };
import type { DefinicionCampo, VersionFormato } from "./formato";
import type { Respuestas, Valor } from "./levantamiento";
import { normalizarDecimal } from "./medida";
import { DECIMAL_CANONICO, fotosReferenciadas, validarRespuestas } from "./validacion";

const ordenar = <T extends { seccion: string; campo?: string }>(e: T[]) =>
  [...e].sort((a, b) => `${a.seccion}/${a.campo ?? ""}`.localeCompare(`${b.seccion}/${b.campo ?? ""}`));

describe("casos de conformidad", () => {
  const formato = conformidad.formato as VersionFormato;
  it.each(conformidad.casos)("$nombre", ({ respuestas, errores }) => {
    expect(ordenar(validarRespuestas(formato, respuestas as unknown as Respuestas))).toEqual(ordenar(errores));
  });
});

// Generadores: formatos arbitrarios y respuestas válidas para ellos.
const clave = fc.stringMatching(/^[a-z][a-z_]{0,11}$/);
const huella = fc.stringMatching(/^[0-9a-f]{64}$/);
const campo: fc.Arbitrary<DefinicionCampo> = fc.oneof(
  fc.record({ clave, etiqueta: fc.constant("T"), tipo: fc.constant("texto" as const), obligatorio: fc.boolean() }),
  fc.record({
    clave,
    etiqueta: fc.constant("M"),
    tipo: fc.constant("medida" as const),
    unidades: fc.uniqueArray(fc.constantFrom("m", "cm", "kVA", "kW", "A"), { minLength: 1 }),
    obligatorio: fc.boolean(),
  }),
  fc.record({ clave, etiqueta: fc.constant("F"), tipo: fc.constant("foto" as const), obligatorio: fc.boolean(), min: fc.nat(3) }),
);
const formatoArbitrario: fc.Arbitrary<VersionFormato> = fc.record({
  formato: clave,
  version: fc.integer({ min: 1, max: 50 }),
  secciones: fc.uniqueArray(
    fc.record({ clave, titulo: fc.constant("S"), campos: fc.uniqueArray(campo, { selector: (c) => c.clave, maxLength: 6 }) }),
    { selector: (s) => s.clave, minLength: 1, maxLength: 3 },
  ),
});

function valorValido(c: DefinicionCampo): fc.Arbitrary<Valor> {
  const noObtenido = fc.record({ noObtenido: fc.constant(true as const), motivo: fc.string({ minLength: 1, maxLength: 40 }).filter((m) => m.trim() !== "") });
  const propio: fc.Arbitrary<Valor> =
    c.tipo === "texto"
      ? fc.string({ minLength: 1, maxLength: 60 }).filter((t) => t.trim() !== "")
      : c.tipo === "medida"
        ? fc.record({ valor: fc.stringMatching(DECIMAL_CANONICO), unidad: fc.constantFrom(...c.unidades) })
        : c.tipo === "foto"
          ? fc.uniqueArray(huella, { minLength: Math.max(c.min ?? 0, c.obligatorio ? 1 : 0), maxLength: 5 })
          : fc.record({ boceto: huella });
  return c.obligatorio ? fc.oneof(propio, noObtenido) : propio;
}

const formatoConRespuestas = formatoArbitrario.chain((formato) =>
  fc
    .tuple(...formato.secciones.map((s) => fc.tuple(...s.campos.map((c) => valorValido(c)))))
    .map((valores) => {
      const respuestas: Record<string, Record<string, Valor>> = {};
      formato.secciones.forEach((s, i) => {
        respuestas[s.clave] = Object.fromEntries(s.campos.map((c, j) => [c.clave, valores[i]![j]!]));
      });
      return { formato, respuestas };
    }),
);

describe("propiedades del validador", () => {
  it("unas respuestas completas y bien formadas nunca tienen errores", () => {
    fc.assert(fc.property(formatoConRespuestas, ({ formato, respuestas }) => validarRespuestas(formato, respuestas).length === 0));
  });

  it("quitar un campo obligatorio siempre produce campo_obligatorio en ese campo", () => {
    fc.assert(
      fc.property(formatoConRespuestas, fc.nat(), ({ formato, respuestas }, n) => {
        const obligatorios = formato.secciones.flatMap((s) => s.campos.filter((c) => c.obligatorio).map((c) => [s.clave, c.clave] as const));
        fc.pre(obligatorios.length > 0);
        const [seccion, campo] = obligatorios[n % obligatorios.length]!;
        const { [campo]: _quitado, ...resto } = respuestas[seccion]!;
        const errores = validarRespuestas(formato, { ...respuestas, [seccion]: resto });
        return errores.some((e) => e.seccion === seccion && e.campo === campo && e.codigo === "campo_obligatorio");
      }),
    );
  });

  it("es total: con cualquier entrada devuelve una lista y no lanza", () => {
    fc.assert(
      fc.property(formatoArbitrario, fc.dictionary(fc.string(), fc.anything()), (formato, respuestas) => {
        expect(Array.isArray(validarRespuestas(formato, respuestas as Respuestas))).toBe(true);
      }),
    );
  });

  it("todo decimal normalizado es canónico", () => {
    fc.assert(
      fc.property(fc.string(), (entrada) => {
        const valor = normalizarDecimal(entrada);
        return valor === null || DECIMAL_CANONICO.test(valor);
      }),
    );
  });

  it("fotosReferenciadas encuentra cada huella una sola vez", () => {
    fc.assert(
      fc.property(formatoConRespuestas, ({ respuestas }) => {
        const todas = Object.values(respuestas).flatMap((s) => Object.values(s).flatMap((v) => (Array.isArray(v) ? v : [])));
        const encontradas = fotosReferenciadas(respuestas);
        return encontradas.length === new Set(todas).size && todas.every((h) => encontradas.includes(h));
      }),
    );
  });
});
