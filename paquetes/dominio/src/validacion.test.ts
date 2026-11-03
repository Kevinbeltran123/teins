import { describe, expect, it } from "vitest";
import fc from "fast-check";
import conformidad from "../conformidad/validacion.json" with { type: "json" };
import type { DefinicionCampo, VersionFormato } from "./formato";
import type { Respuestas, Valor } from "./levantamiento";
import { normalizarDecimal } from "./medida";
import { DECIMAL_CANONICO, fotosReferenciadas, LIMITES, validarCampo, validarRespuestas } from "./validacion";

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
        ? fc.record({ valor: fc.stringMatching(DECIMAL_CANONICO).filter((v) => v.length <= LIMITES.decimal), unidad: fc.constantFrom(...c.unidades) })
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

  it("una medida más larga que la que recibe el protocolo es inválida: el teléfono no la deja salir (iteración 42)", () => {
    const medida: DefinicionCampo = { clave: "m", etiqueta: "M", tipo: "medida", unidades: ["m"] };
    expect(validarCampo(medida, { valor: "1".repeat(LIMITES.decimal), unidad: "m" })).toBeNull();
    expect(validarCampo(medida, { valor: "1".repeat(LIMITES.decimal + 1), unidad: "m" })).toBe("medida_invalida");
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

describe("selección, horario y cédula de la firma (ADR-0050)", () => {
  const opcion = (extra: Partial<Extract<DefinicionCampo, { tipo: "opcion" }>> = {}): DefinicionCampo => ({ clave: "o", etiqueta: "O", tipo: "opcion", opciones: ["Totalmente", "Parcialmente"], ...extra });
  const opciones = (extra: Partial<Extract<DefinicionCampo, { tipo: "opciones" }>> = {}): DefinicionCampo => ({ clave: "s", etiqueta: "S", tipo: "opciones", opciones: ["CCTV", "UPS", "Alarma"], ...extra });
  const horario = (obligatorio = false): DefinicionCampo => ({ clave: "h", etiqueta: "H", tipo: "horario", ...(obligatorio ? { obligatorio } : {}) });
  const v = (x: unknown) => x as Valor;

  it("opcion: una de las opciones; «Otro» solo si el campo lo permite", () => {
    expect(validarCampo(opcion(), "Totalmente")).toBeNull();
    expect(validarCampo(opcion(), "Cualquiera")).toBe("opcion_invalida");
    expect(validarCampo(opcion({ otro: true }), "Cualquiera")).toBeNull();
    expect(validarCampo(opcion({ otro: true }), "x".repeat(121))).toBe("opcion_invalida");
    expect(validarCampo(opcion(), v(["Totalmente"]))).toBe("tipo_invalido");
    expect(validarCampo(opcion(), v(3))).toBe("tipo_invalido");
  });

  it("opcion: vacía solo si no es obligatoria", () => {
    expect(validarCampo(opcion(), undefined)).toBeNull();
    expect(validarCampo(opcion({ obligatorio: true }), undefined)).toBe("campo_obligatorio");
    expect(validarCampo(opcion({ obligatorio: true }), "  ")).toBe("campo_obligatorio");
    expect(validarCampo(opcion({ obligatorio: true }), v({ noObtenido: true, motivo: "El cliente no estaba" }))).toBeNull();
  });

  it("opciones: elegidas dentro de las opciones y sin repetir", () => {
    expect(validarCampo(opciones(), v({ elegidas: ["CCTV", "UPS"] }))).toBeNull();
    expect(validarCampo(opciones(), v({ elegidas: ["CCTV", "Radar"] }))).toBe("opcion_invalida");
    expect(validarCampo(opciones(), v({ elegidas: ["CCTV", "CCTV"] }))).toBe("opcion_invalida");
    expect(validarCampo(opciones(), v({ elegidas: "CCTV" }))).toBe("tipo_invalido");
    expect(validarCampo(opciones(), v(["CCTV"]))).toBe("tipo_invalido");
    expect(validarCampo(opciones(), v({ elegidas: ["CCTV"], extra: 1 }))).toBe("tipo_invalido");
  });

  it("opciones: «Otro» solo si el campo lo permite, con texto", () => {
    expect(validarCampo(opciones(), v({ elegidas: ["CCTV"], otro: "cerca eléctrica" }))).toBe("opcion_invalida");
    expect(validarCampo(opciones({ otro: true }), v({ elegidas: ["CCTV"], otro: "cerca eléctrica" }))).toBeNull();
    expect(validarCampo(opciones({ otro: true }), v({ elegidas: [], otro: "cerca eléctrica" }))).toBeNull();
    expect(validarCampo(opciones({ otro: true }), v({ elegidas: ["CCTV"], otro: "  " }))).toBe("opcion_invalida");
    expect(validarCampo(opciones({ otro: true }), v({ elegidas: ["CCTV"], otro: "x".repeat(121) }))).toBe("opcion_invalida");
  });

  it("opciones: obligatorio es al menos una elegida o un «Otro» escrito", () => {
    expect(validarCampo(opciones({ obligatorio: true }), undefined)).toBe("campo_obligatorio");
    expect(validarCampo(opciones({ obligatorio: true }), v({ elegidas: [] }))).toBe("campo_obligatorio");
    expect(validarCampo(opciones({ obligatorio: true, otro: true }), v({ elegidas: [], otro: "cerca eléctrica" }))).toBeNull();
    expect(validarCampo(opciones(), v({ elegidas: [] }))).toBeNull();
  });

  it("horario: horas HH:MM válidas; obligatorio exige las dos", () => {
    expect(validarCampo(horario(), v({ desde: "08:14", hasta: "11:30" }))).toBeNull();
    expect(validarCampo(horario(), v({ desde: "22:00", hasta: "01:30" }))).toBeNull();
    expect(validarCampo(horario(), v({ desde: "08:14" }))).toBeNull();
    expect(validarCampo(horario(true), v({ desde: "08:14" }))).toBe("campo_obligatorio");
    expect(validarCampo(horario(true), undefined)).toBe("campo_obligatorio");
    expect(validarCampo(horario(), v({ desde: "24:00" }))).toBe("horario_invalido");
    expect(validarCampo(horario(), v({ desde: "8:14" }))).toBe("horario_invalido");
    expect(validarCampo(horario(), v({ desde: "08:14", hasta: "11:60" }))).toBe("horario_invalido");
    expect(validarCampo(horario(), v({ hasta: "11:30" }))).toBe("tipo_invalido");
    expect(validarCampo(horario(), v("08:14"))).toBe("tipo_invalido");
    expect(validarCampo(horario(), v({ desde: "08:14", extra: 1 }))).toBe("tipo_invalido");
  });

  describe("la firma con cédula", () => {
    const firma = (documento?: "opcional" | "obligatorio"): DefinicionCampo => ({ clave: "f", etiqueta: "F", tipo: "firma", ...(documento ? { documento } : {}) });
    const valor = (extra: Record<string, unknown> = {}) => v({ firma: "a".repeat(64), nombre: "Ana Pérez", firmadoEn: "2026-10-29T15:00:00.000Z", declaracion: "Confirmo", ...extra });

    it("obligatoria: exige la cédula, de 5 a 12 dígitos", () => {
      expect(validarCampo(firma("obligatorio"), valor())).toBe("firma_invalida");
      expect(validarCampo(firma("obligatorio"), valor({ documento: "52123456" }))).toBeNull();
      expect(validarCampo(firma("obligatorio"), valor({ documento: "1234" }))).toBe("firma_invalida");
      expect(validarCampo(firma("obligatorio"), valor({ documento: "1234567890123" }))).toBe("firma_invalida");
      expect(validarCampo(firma("obligatorio"), valor({ documento: "52.123.456" }))).toBe("firma_invalida");
    });

    it("opcional: sin cédula pasa; con cédula, tiene que ser válida", () => {
      expect(validarCampo(firma("opcional"), valor())).toBeNull();
      expect(validarCampo(firma("opcional"), valor({ documento: "52123456" }))).toBeNull();
      expect(validarCampo(firma("opcional"), valor({ documento: "abc" }))).toBe("firma_invalida");
    });

    it("un formato que no la pide no la recibe", () => {
      expect(validarCampo(firma(), valor())).toBeNull();
      expect(validarCampo(firma(), valor({ documento: "52123456" }))).toBe("firma_invalida");
    });
  });

  it("las respuestas con los tipos nuevos se validan y no se confunden con fotos", () => {
    const formato: VersionFormato = { formato: "f", version: 1, secciones: [{ clave: "s", titulo: "S", campos: [opciones({ obligatorio: true }), horario(true)] }] };
    expect(validarRespuestas(formato, { s: { s: v({ elegidas: ["CCTV"] }), h: v({ desde: "08:00", hasta: "09:00" }) } })).toEqual([]);
    expect(fotosReferenciadas({ s: { s: v({ elegidas: ["CCTV"] }), h: v({ desde: "08:00", hasta: "09:00" }) } })).toEqual([]);
  });
});
