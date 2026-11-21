import { describe, expect, it } from "vitest";
import { documentoOpenApi } from "./openapi";
import { DestacadoDelAsistente, IntercambioDelAsistente, operaciones, PasoDelAsistente, RespuestaDelAsistente, TablaDelAsistente } from "./operaciones";
import { ESTADO_POR_CODIGO, REINTENTABLE } from "./problemas";

const id = "01927a3e-7c1b-7e2a-9f00-123456789abc";
const otro = "01927a3e-7c1b-7e2a-9f00-123456789abd";

const OPERACIONES_DEL_ASISTENTE = [
  "estadoDelAsistente",
  "listarConversacionesDelAsistente",
  "obtenerConversacionDelAsistente",
  "preguntarAlAsistente",
  "detenerRespuestaDelAsistente",
  "eliminarConversacionDelAsistente",
  "restaurarConversacionDelAsistente",
  "usoDelAsistente",
  "cambiarTopeDelAsistente",
] as const;

describe("preguntarAlAsistente", () => {
  const cuerpo = operaciones.preguntarAlAsistente.cuerpo;
  const pregunta = { llave: id, conversacionId: null, texto: "¿Cuánto cable se gastó este año?" };

  it("acepta una pregunta nueva y una dentro de una conversación", () => {
    expect(cuerpo.safeParse(pregunta).success).toBe(true);
    expect(cuerpo.safeParse({ ...pregunta, conversacionId: otro }).success).toBe(true);
    expect(cuerpo.safeParse({ ...pregunta, texto: "x".repeat(2000) }).success).toBe(true);
  });

  it("rechaza el texto vacío, solo espacios o de más de 2000 caracteres", () => {
    expect(cuerpo.safeParse({ ...pregunta, texto: "" }).success).toBe(false);
    expect(cuerpo.safeParse({ ...pregunta, texto: "   " }).success).toBe(false);
    expect(cuerpo.safeParse({ ...pregunta, texto: "x".repeat(2001) }).success).toBe(false);
  });

  it("rechaza sin llave, una conversación que no es uuid y campos de más", () => {
    const { llave: _, ...sinLlave } = pregunta;
    expect(cuerpo.safeParse(sinLlave).success).toBe(false);
    expect(cuerpo.safeParse({ ...pregunta, conversacionId: "conversacion-1" }).success).toBe(false);
    expect(cuerpo.safeParse({ ...pregunta, extra: true }).success).toBe(false);
  });

  it("responde 202 y declara sus errores", () => {
    expect(operaciones.preguntarAlAsistente.estadoExito).toBe(202);
    expect(operaciones.preguntarAlAsistente.errores).toEqual(expect.arrayContaining(["no_disponible", "tope_agotado", "estado_invalido", "no_encontrado", "demasiadas_solicitudes"]));
  });
});

describe("cambiarTopeDelAsistente", () => {
  const cuerpo = operaciones.cambiarTopeDelAsistente.cuerpo;

  it("acepta de 0 a 1000 dólares con hasta 2 decimales", () => {
    for (const topeUsd of ["0", "5", "12.5", "999.99", "1000", "1000.00"]) expect(cuerpo.safeParse({ topeUsd }).success).toBe(true);
  });

  it("rechaza negativos, más de 1000, más de 2 decimales y números sin comillas", () => {
    for (const topeUsd of ["-1", "1000.01", "1001", "5.001", "5,5", "05", "", 5]) expect(cuerpo.safeParse({ topeUsd }).success).toBe(false);
  });
});

describe("tipos del asistente", () => {
  const paso = { herramienta: "buscar_en_catalogo", etiqueta: "Buscó «cable» en el catálogo", resultado: "3 ítems", estado: "hecho" };
  const tabla = {
    titulo: "Materiales",
    columnas: [
      { titulo: "Material", numerica: false },
      { titulo: "Cantidad", numerica: true },
    ],
    filas: [[{ texto: "UTP categoría 6" }, { texto: "4.485", detalle: "m" }], [{ texto: "Cable sin catálogo", marca: "sin_vincular" }, { texto: "10" }]],
  };
  const respuesta = { texto: "Se gastaron 4.485 m.", destacado: { cifras: [{ valor: "4.485", unidad: "m" }], descripcion: "UTP categoría 6" }, tablas: [tabla], fuentes: null, serie: null };

  it("acepta un paso, una tabla y una respuesta bien formados", () => {
    expect(PasoDelAsistente.safeParse(paso).success).toBe(true);
    expect(PasoDelAsistente.safeParse({ ...paso, resultado: null, estado: "en_curso" }).success).toBe(true);
    expect(TablaDelAsistente.safeParse(tabla).success).toBe(true);
    expect(RespuestaDelAsistente.safeParse(respuesta).success).toBe(true);
  });

  it("rechaza estados fuera de su lista", () => {
    expect(PasoDelAsistente.safeParse({ ...paso, estado: "lista" }).success).toBe(false);
    const intercambio = {
      id,
      pregunta: "¿Cuántas visitas hubo?",
      creadoEn: "2026-11-20T10:00:00.000Z",
      estado: "lista",
      duracionSegundos: 4.2,
      pasos: [paso],
      respuesta,
      error: null,
    };
    expect(IntercambioDelAsistente.safeParse(intercambio).success).toBe(true);
    expect(IntercambioDelAsistente.safeParse({ ...intercambio, estado: "hecho" }).success).toBe(false);
    expect(TablaDelAsistente.safeParse({ ...tabla, filas: [[{ texto: "x", marca: "otra" }, { texto: "1" }]] }).success).toBe(false);
  });

  it("cada fila de una tabla lleva una celda por columna", () => {
    expect(TablaDelAsistente.safeParse({ ...tabla, filas: [[{ texto: "UTP categoría 6" }]] }).success).toBe(false);
    expect(TablaDelAsistente.safeParse({ ...tabla, filas: [[{ texto: "a" }, { texto: "1" }, { texto: "sobra" }]] }).success).toBe(false);
    expect(TablaDelAsistente.safeParse({ ...tabla, filas: [] }).success).toBe(true);
  });

  it("el destacado lleva una o dos cifras", () => {
    const cifra = { valor: "1.215", unidad: "m" };
    expect(DestacadoDelAsistente.safeParse({ cifras: [cifra], descripcion: "Percentil 80" }).success).toBe(true);
    expect(DestacadoDelAsistente.safeParse({ cifras: [cifra, { valor: "$3.523.500", unidad: null }], descripcion: "Para 40 puntos" }).success).toBe(true);
    expect(DestacadoDelAsistente.safeParse({ cifras: [], descripcion: "x" }).success).toBe(false);
    expect(DestacadoDelAsistente.safeParse({ cifras: [cifra, cifra, cifra], descripcion: "x" }).success).toBe(false);
  });

  it("la fuente apunta a una visita por uuid", () => {
    const fuentes = {
      titulo: "Visitas",
      visitas: [{ visitaId: id, levantamientoId: null, orden: "0058", fecha: "2026-03-04", cliente: "Cliente ficticio", sitio: "Sede", ciudad: null, revisado: false }],
    };
    expect(RespuestaDelAsistente.safeParse({ ...respuesta, fuentes }).success).toBe(true);
    const mala = { ...fuentes, visitas: [{ ...fuentes.visitas[0], visitaId: "visita-1" }] };
    expect(RespuestaDelAsistente.safeParse({ ...respuesta, fuentes: mala }).success).toBe(false);
  });

  it("una visita anterior al número de orden (ADR-0051) es fuente sin número", () => {
    const fuentes = {
      titulo: "Visitas",
      visitas: [{ visitaId: id, levantamientoId: null, orden: null, fecha: "2026-03-04", cliente: "Cliente ficticio", sitio: "Sede", ciudad: null, revisado: true }],
    };
    expect(RespuestaDelAsistente.safeParse({ ...respuesta, fuentes }).success).toBe(true);
  });
});

describe("uso del asistente", () => {
  it("el mes va como AAAA-MM y el gasto como decimal", () => {
    const uso = { mes: "2026-11", gastoUsd: "0.0123", topeUsd: "5", preguntas: 3, porPersona: [{ usuarioId: "u1", nombre: "Ana", preguntas: 3, gastoUsd: "0.0123" }] };
    const respuesta = operaciones.usoDelAsistente.respuesta;
    expect(respuesta.safeParse(uso).success).toBe(true);
    expect(respuesta.safeParse({ ...uso, mes: "2026-13" }).success).toBe(false);
    expect(respuesta.safeParse({ ...uso, gastoUsd: "-1" }).success).toBe(false);
  });
});

describe("tope_agotado", () => {
  it("responde 429 y no se reintenta", () => {
    expect(ESTADO_POR_CODIGO.tope_agotado).toBe(429);
    expect(REINTENTABLE.tope_agotado).toBe(false);
  });
});

describe("OpenAPI del asistente", () => {
  it("incluye las nueve operaciones y sus tipos reutilizados", () => {
    const doc = documentoOpenApi();
    const ids = Object.values(doc.paths ?? {}).flatMap((p) => Object.values(p as object).map((o: { operationId?: string }) => o.operationId));
    expect(ids).toEqual(expect.arrayContaining([...OPERACIONES_DEL_ASISTENTE]));
    expect(Object.keys(doc.components?.schemas ?? {})).toEqual(expect.arrayContaining(["IntercambioDelAsistente", "RespuestaDelAsistente", "PasoDelAsistente"]));
    expect(doc.paths?.["/api/asistente/preguntas"]?.post?.responses).toHaveProperty("202");
    expect(doc.paths?.["/api/asistente/preguntas"]?.post?.responses).toHaveProperty("429");
  });
});
