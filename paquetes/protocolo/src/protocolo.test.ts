import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LIMITES } from "@teins/dominio";
import { Valor, VersionFormato } from "./dominio";
import { documentoOpenApi } from "./openapi";
import { Bajada, DatosContacto, EnviarLevantamiento, llaveDeEnvio, operaciones } from "./operaciones";
import { ESTADO_POR_CODIGO, REINTENTABLE } from "./problemas";

const id = "01927a3e-7c1b-7e2a-9f00-123456789abc";
const comando = {
  tipo: "EnviarLevantamiento",
  llave: llaveDeEnvio(id),
  levantamiento: {
    id,
    formato: "prueba",
    versionFormato: 1,
    respuestas: { cuarto: { potencia: { valor: "12.5", unidad: "kVA" }, fotos: ["a".repeat(64)], nota: "texto" } },
    creadoEn: "2026-09-24T10:00:00.000Z",
    enviadoEn: "2026-09-24T11:00:00.000-05:00",
  },
};

describe("EnviarLevantamiento", () => {
  it("acepta un comando bien formado", () => {
    expect(EnviarLevantamiento.safeParse(comando).success).toBe(true);
  });

  it("rechaza una llave que no corresponde al levantamiento", () => {
    const otra = { ...comando, llave: llaveDeEnvio("01927a3e-7c1b-7e2a-9f00-000000000000") };
    expect(EnviarLevantamiento.safeParse(otra).success).toBe(false);
  });

  it("rechaza medidas no canónicas, huellas inválidas y textos que superan el límite", () => {
    const con = (valor: unknown) => ({ ...comando, levantamiento: { ...comando.levantamiento, respuestas: { cuarto: { x: valor } } } });
    expect(EnviarLevantamiento.safeParse(con({ valor: "12,5", unidad: "m" })).success).toBe(false);
    expect(EnviarLevantamiento.safeParse(con(["A".repeat(64)])).success).toBe(false);
    expect(EnviarLevantamiento.safeParse(con("x".repeat(LIMITES.texto + 1))).success).toBe(false);
    expect(EnviarLevantamiento.safeParse(con({ valor: "1", unidad: "m", extra: true })).success).toBe(false);
  });

  it("rechaza claves de sección o campo fuera del alfabeto permitido", () => {
    const con = { ...comando, levantamiento: { ...comando.levantamiento, respuestas: { "__proto__x": {} } } };
    expect(EnviarLevantamiento.safeParse(con).success).toBe(false);
  });
});

describe("EnviarLevantamiento con visita (ADR-0015, expansión)", () => {
  it("acepta el comando con y sin visita, y rechaza una visita que no es UUID", () => {
    const con = (visitaId: unknown) => ({ ...comando, levantamiento: { ...comando.levantamiento, visitaId } });
    expect(EnviarLevantamiento.safeParse(con("01927a3e-7c1b-7e2a-9f00-000000000001")).success).toBe(true);
    expect(EnviarLevantamiento.safeParse(comando).success).toBe(true);
    expect(EnviarLevantamiento.safeParse(con("visita-1")).success).toBe(false);
  });
});

describe("Bajada", () => {
  const bajada = {
    cambios: [
      { tipo: "formato", definicion: { formato: "ups", version: 2, nombre: "UPS", appMinima: 2, secciones: [] } },
      {
        tipo: "visita",
        visita: { id, cliente: { nombre: "Cliente ficticio" }, sitio: { nombre: "Sede", direccion: "Calle [N]" }, motivo: "Mantenimiento", programadaPara: "2026-09-25" },
      },
      { tipo: "levantamiento", id, estado: "enviado", recibidoEn: "2026-09-24T11:00:00.000Z" },
      { tipo: "fuera_de_alcance", entidad: "visita", id },
    ],
    puntoDeControl: 42,
    hayMas: false,
    permisoLocalHasta: "2026-10-01T11:00:00.000Z",
  };

  it("acepta los cuatro tipos de cambio", () => {
    expect(Bajada.safeParse(bajada).success).toBe(true);
  });

  it("rechaza un tipo de cambio desconocido y un punto de control negativo", () => {
    expect(Bajada.safeParse({ ...bajada, cambios: [{ tipo: "otro", id }] }).success).toBe(false);
    expect(Bajada.safeParse({ ...bajada, puntoDeControl: -1 }).success).toBe(false);
  });

  it("la consulta exige la versión de la app y parte de cero", () => {
    const consulta = operaciones.obtenerCambios.consulta;
    expect(consulta.safeParse({}).success).toBe(false);
    expect(consulta.parse({ app: "2" })).toEqual({ desde: 0, app: 2, limite: 200 });
  });
});

describe("revisión (corte 3)", () => {
  it("una corrección acepta borrar con null y exige al menos un cambio con su versión", () => {
    const cuerpo = operaciones.corregirLevantamiento.cuerpo;
    expect(cuerpo.safeParse({ version: 2, correcciones: [{ seccion: "s", campo: "c", valor: null }] }).success).toBe(true);
    expect(cuerpo.safeParse({ version: 2, correcciones: [] }).success).toBe(false);
    expect(cuerpo.safeParse({ correcciones: [{ seccion: "s", campo: "c", valor: "x" }] }).success).toBe(false);
  });

  it("tomar no reasigna si no se pide", () => {
    expect(operaciones.tomarLevantamiento.cuerpo.parse({ version: 1 })).toEqual({ version: 1, reasignar: false });
  });

  it("la bajada lleva estados de revisión y comentarios, que siguen siendo opcionales", () => {
    const base = { tipo: "levantamiento", id, estado: "revisado", recibidoEn: "2026-09-24T11:00:00.000Z" };
    const comentario = { id, texto: "Revisa la placa", campo: "potencia", seccion: "cuarto", autor: "Oficina", creadoEn: "2026-09-25T10:00:00.000Z" };
    const bajada = (cambio: object) => Bajada.safeParse({ cambios: [cambio], puntoDeControl: 1, hayMas: false, permisoLocalHasta: "2026-10-01T00:00:00.000Z" });
    expect(bajada({ ...base, comentarios: [comentario] }).success).toBe(true);
    expect(bajada(base).success).toBe(true);
    expect(bajada({ ...base, estado: "anulado" }).success).toBe(false);
  });
});

describe("dispositivo", () => {
  const secreto = "A".repeat(43);
  it("el secreto tiene exactamente 32 bytes en base64url", () => {
    const cuerpo = operaciones.consultarOrdenes.cuerpo;
    expect(cuerpo.parse({ id, secreto })).toEqual({ id, secreto, confirmados: [] });
    expect(cuerpo.safeParse({ id, secreto: "A".repeat(42) }).success).toBe(false);
    expect(cuerpo.safeParse({ id, secreto: `${"A".repeat(42)}=` }).success).toBe(false);
  });
});

describe("catálogo de operaciones", () => {
  it("no repite método y ruta", () => {
    const claves = Object.values(operaciones).map((o) => `${o.metodo} ${o.ruta}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("toda ruta vive bajo /api y todo código de error tiene estado y política de reintento", () => {
    for (const op of Object.values(operaciones)) {
      expect(op.ruta.startsWith("/api/")).toBe(true);
      for (const codigo of op.errores) {
        expect(ESTADO_POR_CODIGO[codigo]).toBeGreaterThanOrEqual(400);
        expect(typeof REINTENTABLE[codigo]).toBe("boolean");
      }
    }
  });

  it("genera un OpenAPI con cada operación", () => {
    const doc = documentoOpenApi();
    const ids = Object.values(doc.paths ?? {}).flatMap((p) => Object.values(p as object).map((o: { operationId?: string }) => o.operationId));
    expect(ids.sort()).toEqual(Object.keys(operaciones).sort());
    expect(doc.components?.schemas).toHaveProperty("Problema");
  });
});

describe("correcciones de la revisión de código", () => {
  it("el contacto tolera espacios pegados al correo y al celular", () => {
    const datos = DatosContacto.parse({ nombre: "Ana", correo: " ana@cliente.co ", celular: "+573105550142 ", recibeCorreo: true, recibeWhatsapp: false });
    expect(datos.correo).toBe("ana@cliente.co");
    expect(datos.celular).toBe("+573105550142");
  });

  it("quitar la suscripción de avisos exige lo mismo que suscribirse", () => {
    const cuerpo = operaciones.quitarSuscripcionAvisos.cuerpo;
    expect(cuerpo.safeParse({ endpoint: "http://push.example.com/x" }).success).toBe(false);
    expect(cuerpo.safeParse({ endpoint: `https://push.example.com/${"a".repeat(2048)}` }).success).toBe(false);
    expect(cuerpo.safeParse({ endpoint: "https://push.example.com/x" }).success).toBe(true);
  });
});

describe("conversaciones (ADR-0040)", () => {
  const otro = "01927a3e-7c1b-7e2a-9f00-123456789abd";
  const comentario = { id, texto: "¿Quién te recibe?", seccion: "llegada", campo: "recibe", autor: "Oficina", creadoEn: "2026-10-05T20:26:00.000Z" };
  const respuestas = [
    { id: otro, texto: "Nadie, estaba cerrado", de: "tecnico", autor: "María Gómez", creadoEn: "2026-10-05T20:40:00.000Z", llave: otro, leido: true },
    { id, texto: "Gracias", de: "oficina", autor: "Oficina", creadoEn: "2026-10-05T20:44:00.000Z" },
  ];
  const bajada = (comentarios: object[]) =>
    Bajada.safeParse({ cambios: [{ tipo: "levantamiento", id, estado: "en_revision", recibidoEn: "2026-10-05T20:26:00.000Z", comentarios }], puntoDeControl: 1, hayMas: false, permisoLocalHasta: "2026-10-12T00:00:00.000Z" });

  it("la bajada lleva las respuestas dentro de su comentario, como campo opcional", () => {
    expect(bajada([{ ...comentario, respuestas }]).success).toBe(true);
    expect(bajada([comentario]).success).toBe(true);
    expect(bajada([{ ...comentario, respuestas: [{ ...respuestas[0], de: "cliente" }] }]).success).toBe(false);
  });

  it("la app 13, que no conoce las respuestas, las descarta al validar", () => {
    // El esquema de la app 13 es el comentario sin `respuestas`: zod quita lo que no conoce.
    const app13 = z.object({ id: z.string(), texto: z.string(), autor: z.string(), creadoEn: z.string() });
    expect(app13.parse({ ...comentario, respuestas })).not.toHaveProperty("respuestas");
  });

  it("responder exige una llave uuid y hasta 1000 caracteres", () => {
    const cuerpo = operaciones.responderComentario.cuerpo;
    expect(cuerpo.parse({ llave: otro, texto: "  Nadie me recibió  " })).toEqual({ llave: otro, texto: "Nadie me recibió" });
    expect(cuerpo.safeParse({ llave: "x", texto: "Hola" }).success).toBe(false);
    expect(cuerpo.safeParse({ llave: otro, texto: "   " }).success).toBe(false);
    expect(cuerpo.safeParse({ llave: otro, texto: "a".repeat(1001) }).success).toBe(false);
  });

  it("oficina responde en el hilo con enRespuestaA, también hasta 1000 caracteres", () => {
    const cuerpo = operaciones.comentarLevantamiento.cuerpo;
    expect(cuerpo.safeParse({ texto: "Gracias", enRespuestaA: id }).success).toBe(true);
    expect(cuerpo.safeParse({ texto: "a".repeat(1001) }).success).toBe(false);
    expect(operaciones.editarComentario.cuerpo.safeParse({ texto: "a".repeat(1001) }).success).toBe(false);
  });
});

describe("selección, horario, tablas y sello (ADR-0050)", () => {
  it("opciones es un objeto: no se confunde con una lista de fotos ni acepta llaves de más", () => {
    expect(Valor.safeParse({ elegidas: ["CCTV", "UPS"] }).success).toBe(true);
    expect(Valor.safeParse({ elegidas: ["CCTV"], otro: "cerca eléctrica" }).success).toBe(true);
    expect(Valor.safeParse({ elegidas: [] }).success).toBe(true);
    expect(Valor.safeParse({ elegidas: ["CCTV"], extra: 1 }).success).toBe(false);
    expect(Valor.safeParse({ elegidas: "CCTV" }).success).toBe(false);
    // Un arreglo de textos que no son huellas sigue siendo inválido: las opciones no se aceptan como arreglo.
    expect(Valor.safeParse(["CCTV", "UPS"]).success).toBe(false);
  });

  it("horario: horas HH:MM y nada más", () => {
    expect(Valor.safeParse({ desde: "08:14", hasta: "11:30" }).success).toBe(true);
    expect(Valor.safeParse({ desde: "08:14" }).success).toBe(true);
    expect(Valor.safeParse({ desde: "8:14" }).success).toBe(false);
    expect(Valor.safeParse({ desde: "24:00" }).success).toBe(false);
    expect(Valor.safeParse({ hasta: "11:30" }).success).toBe(false);
    expect(Valor.safeParse({ desde: "08:14", extra: 1 }).success).toBe(false);
  });

  it("la firma admite la cédula, solo con dígitos", () => {
    const firma = { firma: "a".repeat(64), nombre: "Ana", firmadoEn: "2026-10-29T15:00:00.000Z", declaracion: "x" };
    expect(Valor.safeParse({ ...firma, documento: "52123456" }).success).toBe(true);
    expect(Valor.safeParse(firma).success).toBe(true);
    expect(Valor.safeParse({ ...firma, documento: "52.123.456" }).success).toBe(false);
  });

  const formato = {
    formato: "prueba",
    version: 1,
    appMinima: 16,
    secciones: [
      {
        clave: "s",
        titulo: "S",
        tablas: [{ titulo: "Voltaje", columnas: ["F1", "F2"], filas: [{ etiqueta: "F-N", campos: ["a", "b"] }] }],
        campos: [
          { clave: "a", etiqueta: "A", tipo: "medida", unidades: ["V"] },
          { clave: "b", etiqueta: "B", tipo: "medida", unidades: ["V"] },
          { clave: "o", etiqueta: "O", tipo: "opcion", opciones: ["Sí", "No"], obligatorio: true },
          { clave: "p", etiqueta: "P", tipo: "opciones", opciones: ["CCTV", "UPS"], otro: true },
          { clave: "h", etiqueta: "H", tipo: "horario" },
          { clave: "f", etiqueta: "F", tipo: "foto", sello: { ubicacion: true, mapa: true } },
          { clave: "g", etiqueta: "G", tipo: "firma", documento: "opcional" },
        ],
      },
    ],
  };

  it("un formato con todo lo nuevo pasa el contrato y conserva lo que declara", () => {
    const leido = VersionFormato.parse(formato);
    const seccion = leido.secciones[0]!;
    expect(seccion.tablas).toEqual(formato.secciones[0]!.tablas);
    expect(seccion.campos.find((c) => c.clave === "f")).toMatchObject({ sello: { ubicacion: true, mapa: true } });
    expect(seccion.campos.find((c) => c.clave === "g")).toMatchObject({ documento: "opcional" });
    expect(seccion.campos.find((c) => c.clave === "p")).toMatchObject({ opciones: ["CCTV", "UPS"], otro: true });
  });

  it("rechaza una tabla sin columnas, una selección sin opciones y un documento desconocido", () => {
    const con = (cambio: object) => VersionFormato.safeParse({ ...formato, secciones: [{ ...formato.secciones[0]!, ...cambio }] }).success;
    expect(con({ tablas: [{ columnas: [], filas: [] }] })).toBe(false);
    expect(con({ campos: [{ clave: "o", etiqueta: "O", tipo: "opcion", opciones: [] }] })).toBe(false);
    expect(con({ campos: [{ clave: "g", etiqueta: "G", tipo: "firma", documento: "siempre" }] })).toBe(false);
  });
});
