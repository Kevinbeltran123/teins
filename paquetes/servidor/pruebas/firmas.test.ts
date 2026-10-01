import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import { bocetoVacio, serializarBoceto, TIPO_ARCHIVO_BOCETO, type DocumentoBoceto, type ValorFirma, type VersionFormato } from "@teins/dominio";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { crearFormatos } from "../src/modulos/formatos";
import { plantillaInforme } from "@teins/documentos";
import { cabecerasSync, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;

/** Formato ficticio (R5) con la firma de quien recibe la visita, obligatoria. */
const conFirma: VersionFormato = {
  formato: "prueba-firma",
  version: 1,
  appMinima: 7,
  secciones: [
    { clave: "cuarto", titulo: "Cuarto", campos: [{ clave: "descripcion", etiqueta: "Descripción", tipo: "texto" }] },
    { clave: "cierre", titulo: "Cierre de la visita", campos: [{ clave: "firma_cliente", etiqueta: "Firma de quien recibe la visita", tipo: "firma", obligatorio: true }] },
  ],
};

const org = await s.nuevaOrganizacionConUsuarios();
await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, conFirma));

const trazos: DocumentoBoceto = {
  ...bocetoVacio(),
  elementos: [{ tipo: "trazo", grosor: 6, puntos: [[300, 400, 0.5], [500, 420, 0.6]], contorno: [[300, 395], [500, 415], [498, 425], [300, 405]] }],
};

function archivoDe(documento: DocumentoBoceto) {
  const datos = Buffer.from(serializarBoceto(documento), "utf8");
  return { datos, huella: createHash("sha256").update(datos).digest("hex") };
}

async function subir(archivo: { datos: Buffer; huella: string }) {
  const autorizacion = await app.inject({
    method: "POST",
    url: "/api/archivos/subidas",
    headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
    payload: { huella: archivo.huella, bytes: archivo.datos.length, tipo: TIPO_ARCHIVO_BOCETO },
  });
  expect(autorizacion.statusCode, autorizacion.body).toBe(200);
  const cuerpo = autorizacion.json();
  if (cuerpo.estado === "autorizada") expect((await fetch(cuerpo.url, { method: "PUT", headers: cuerpo.cabeceras, body: archivo.datos })).status).toBe(200);
  await app.inject({ method: "POST", url: `/api/archivos/${archivo.huella}/subido`, headers: { cookie: org.tecnico.cookie, ...cabecerasSync, "content-type": "application/json" } });
}

const firma = (huella: string): ValorFirma => ({
  firma: huella,
  nombre: "Martha Gómez",
  cargo: "Jefe de mantenimiento",
  firmadoEn: "2026-09-26T15:40:00.000-05:00",
  declaracion: "Confirmo que Técnico de prueba visitó Cliente de prueba · Sede principal el viernes, 26 de septiembre de 2026.",
});

const enviar = (valor: unknown, id = randomUUID()) =>
  app.inject({
    method: "POST",
    url: "/api/sync/comandos",
    headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
    payload: {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(id),
      levantamiento: { id, formato: "prueba-firma", versionFormato: 1, respuestas: { cierre: { firma_cliente: valor } }, creadoEn: "2026-09-26T10:00:00.000-05:00", enviadoEn: "2026-09-26T16:00:00.000-05:00" },
    },
  });

describe("firma del cliente en el servidor (iteración 16, ADR-0024)", () => {
  it("el envío espera los trazos verificados, y oficina ve la firma pero no la corrige", async () => {
    const archivo = archivoDe(trazos);
    expect((await enviar(firma(archivo.huella))).json().codigo).toBe("archivos_faltantes");
    await subir(archivo);
    await s.procesarCola();
    const id = randomUUID();
    const r = await enviar(firma(archivo.huella), id);
    expect(r.statusCode, r.body).toBe(200);

    const detalle = (await app.inject({ method: "GET", url: `/api/levantamientos/${id}`, headers: { cookie: org.oficina.cookie } })).json();
    expect(detalle.respuestas.cierre.firma_cliente).toEqual(firma(archivo.huella));
    // Los trazos se dibujan con la misma ruta de los bocetos.
    expect((await app.inject({ method: "GET", url: `/api/archivos/${archivo.huella}/boceto`, headers: { cookie: org.oficina.cookie } })).statusCode).toBe(200);

    await app.inject({ method: "POST", url: `/api/levantamientos/${id}/tomar`, headers: { cookie: org.oficina.cookie }, payload: { version: 1 } });
    const corregida = await app.inject({
      method: "POST",
      url: `/api/levantamientos/${id}/correcciones`,
      headers: { cookie: org.oficina.cookie },
      payload: { version: 2, motivo: "Prueba", correcciones: [{ seccion: "cierre", campo: "firma_cliente", valor: { ...firma(archivo.huella), nombre: "Otra persona" } }] },
    });
    expect(corregida.json()).toMatchObject({ codigo: "respuestas_invalidas", errores: [{ codigo: "no_corregible" }] });
  });

  it("rechaza una firma sin nombre o con datos de más, y acepta la marca de no obtenida con su motivo", async () => {
    const huella = "d".repeat(64);
    expect((await enviar({ ...firma(huella), nombre: "" })).json()).toMatchObject({ codigo: "respuestas_invalidas" });
    expect((await enviar({ ...firma(huella), cedula: "123" })).json().codigo).toBe("entrada_invalida");
    const r = await enviar({ noObtenido: true, motivo: "Nadie del cliente estaba en el sitio" });
    expect(r.statusCode, r.body).toBe(200);
  });

  it("un formato con firma sin appMinima 7 no se publica", async () => {
    await expect(
      enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, { ...conFirma, version: 2, appMinima: 6 })),
    ).rejects.toThrow(/appMinima 7/);
  });

  it("el PDF muestra la constancia con lo que se leyó, la firma, quién y cuándo; sin firma, el dato como cualquier otro", () => {
    const huella = "c".repeat(64);
    const contenido = (valor: unknown) => ({
      formatoContenido: 1 as const,
      numero: 1,
      publicadaEn: "2026-09-26T18:00:00.000Z",
      publicadaPor: "Oficina",
      organizacion: { nombre: "Organización de prueba" },
      visita: { cliente: "Cliente", sitio: "Sede", direccion: "Calle [N]", motivo: "Mantenimiento", programadaPara: "2026-09-26" },
      introduccion: "",
      conclusiones: "",
      planos: [],
      levantamientos: [
        { id: randomUUID(), formato: conFirma, tecnico: "T", revisor: "O", recibidoEn: "2026-09-26T21:00:00.000Z", respuestas: valor === undefined ? {} : { cierre: { firma_cliente: valor } } },
      ] as never,
    });
    const html = plantillaInforme(contenido(firma(huella)), { salida: { tipo: "pdf", fuente: "" }, fotos: new Map(), firmas: new Map([[huella, '<svg id="firma"></svg>']]) });
    expect(html).toContain("<h4>Constancia de visita</h4>");
    expect(html).toContain("Confirmo que Técnico de prueba visitó Cliente de prueba");
    expect(html).toContain('<div class="trazo"><svg id="firma"></svg><p><strong>Martha Gómez</strong>');
    expect(html).toContain("Jefe de mantenimiento");
    expect(html).toContain("Firmado en el sitio el 26 de septiembre de 2026 a las 3:40");
    // Firmada, no se repite en la tabla de datos.
    expect(html).not.toContain("Firmada por Martha Gómez");
    expect(plantillaInforme(contenido(firma(huella)), { salida: { tipo: "pdf", fuente: "" }, fotos: new Map() })).toContain("[FIRMA]");
    const sinFirma = plantillaInforme(contenido({ noObtenido: true, motivo: "Nadie del cliente estaba" }), { salida: { tipo: "pdf", fuente: "" }, fotos: new Map() });
    expect(sinFirma).toContain("No se pudo obtener: Nadie del cliente estaba");
    expect(sinFirma).not.toContain("Constancia de visita");
  });
});
