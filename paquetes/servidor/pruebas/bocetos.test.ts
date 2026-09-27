import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import { bocetoNuevo, bocetoVacio, hojaNueva, serializarBoceto, TIPO_ARCHIVO_BOCETO, type DocumentoBoceto, type VersionFormato } from "@teins/dominio";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { crearFormatos } from "../src/modulos/formatos";
import { plantillaInforme } from "../src/modulos/informes/pdf/plantilla";
import { cabecerasSync, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;

/** Formato ficticio (R5) con un boceto obligatorio. */
const conBoceto: VersionFormato = {
  formato: "prueba-croquis",
  version: 1,
  appMinima: 5,
  secciones: [{ clave: "cuarto", titulo: "Cuarto", campos: [{ clave: "croquis", etiqueta: "Croquis del cuarto", tipo: "boceto", obligatorio: true }] }],
};

const org = await s.nuevaOrganizacionConUsuarios();
await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, conBoceto));

const dibujo = (texto: string): DocumentoBoceto => ({
  ...bocetoVacio(),
  elementos: [
    { tipo: "linea", grosor: 3, desde: [100, 100], hasta: [400, 100] },
    { tipo: "texto", en: [120, 90], texto, tamano: 24 },
  ],
});

function archivoDe(contenido: string) {
  const datos = Buffer.from(contenido, "utf8");
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

const estado = async (huella: string) =>
  (await s.propietario.pool.query("select estado, motivo_rechazo from archivos.archivos where huella = $1 and organizacion_id = $2", [huella, org.organizacionId])).rows[0];

const enviar = (huella: string, id = randomUUID()) =>
  app.inject({
    method: "POST",
    url: "/api/sync/comandos",
    headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
    payload: {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(id),
      levantamiento: { id, formato: "prueba-croquis", versionFormato: 1, respuestas: { cuarto: { croquis: { boceto: huella } } }, creadoEn: "2026-09-25T10:00:00.000Z", enviadoEn: "2026-09-25T11:00:00.000Z" },
    },
  });

describe("bocetos en el servidor (iteración 10)", () => {
  it("el técnico sube el boceto, el worker lo verifica y solo entonces se registra el envío (QA-2)", async () => {
    const archivo = archivoDe(serializarBoceto(dibujo("Tablero")));
    // Sin el archivo, el envío espera.
    expect((await enviar(archivo.huella)).json().codigo).toBe("archivos_faltantes");
    await subir(archivo);
    await s.procesarCola();
    expect(await estado(archivo.huella)).toMatchObject({ estado: "verificado" });
    const r = await enviar(archivo.huella);
    expect(r.statusCode, r.body).toBe(200);

    // Oficina lo recibe ya verificado, para dibujarlo; un técnico no usa esta ruta.
    const documento = await app.inject({ method: "GET", url: `/api/archivos/${archivo.huella}/boceto`, headers: { cookie: org.oficina.cookie } });
    expect(documento.json()).toEqual(JSON.parse(archivo.datos.toString("utf8")));
    expect((await app.inject({ method: "GET", url: `/api/archivos/${archivo.huella}/boceto`, headers: { cookie: org.tecnico.cookie } })).statusCode).toBe(403);
  });

  it("un boceto de la versión 2, con dos hojas y formas, se verifica y oficina lo recibe igual (ADR-0026)", async () => {
    const conHojas: DocumentoBoceto = {
      ...bocetoNuevo(1352),
      hojas: [
        { ...hojaNueva("Primer piso", 1352), elementos: [{ tipo: "polilinea", grosor: 5, puntos: [[100, 200], [650, 200], [650, 900], [100, 900]], cerrada: true }] },
        { ...hojaNueva("Segundo piso", 1352), elementos: [{ tipo: "cota", grosor: 3, desde: [100, 940], hasta: [650, 940], texto: "5,50 m" }] },
      ],
    };
    const archivo = archivoDe(serializarBoceto(conHojas));
    await subir(archivo);
    await s.procesarCola();
    expect(await estado(archivo.huella)).toMatchObject({ estado: "verificado" });
    const documento = await app.inject({ method: "GET", url: `/api/archivos/${archivo.huella}/boceto`, headers: { cookie: org.oficina.cookie } });
    expect(documento.json()).toEqual(conHojas);
  });

  it("el worker rechaza un boceto con estructura inválida o que no es JSON", async () => {
    const malo = archivoDe(JSON.stringify({ formato: "teins-boceto", version: 1, ancho: 1000, alto: 750, cuadricula: 25, elementos: [{ tipo: "circulo" }] }));
    const noJson = archivoDe("<svg>esto no es un boceto</svg>");
    await subir(malo);
    await subir(noJson);
    await s.procesarCola();
    expect(await estado(malo.huella)).toMatchObject({ estado: "rechazado", motivo_rechazo: "el contenido no es un boceto válido" });
    expect(await estado(noJson.huella)).toMatchObject({ estado: "rechazado" });
  });

  it("oficina no sube bocetos, y un formato con bocetos sin appMinima 5 no se publica", async () => {
    const archivo = archivoDe(serializarBoceto(dibujo("Oficina")));
    const r = await app.inject({
      method: "POST",
      url: "/api/archivos/subidas",
      headers: { cookie: org.oficina.cookie, ...cabecerasSync },
      payload: { huella: archivo.huella, bytes: archivo.datos.length, tipo: TIPO_ARCHIVO_BOCETO },
    });
    expect(r.json().codigo).toBe("tipo_de_archivo_no_permitido");
    await expect(
      enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, { ...conBoceto, version: 2, appMinima: 4 })),
    ).rejects.toThrow(/appMinima 5/);
  });

  it("el PDF incrusta el boceto como SVG, o un marcador si falta", () => {
    const huella = "c".repeat(64);
    const contenido = {
      formatoContenido: 1 as const,
      numero: 1,
      publicadaEn: "2026-09-25T12:00:00.000Z",
      publicadaPor: "Oficina",
      organizacion: { nombre: "Organización de prueba" },
      visita: { cliente: "Cliente", sitio: "Sede", direccion: "Calle [N]", motivo: "Mantenimiento", programadaPara: "2026-09-25" },
      introduccion: "",
      conclusiones: "",
      planos: [],
      levantamientos: [{ id: randomUUID(), formato: conBoceto, tecnico: "T", revisor: "O", recibidoEn: "2026-09-25T11:00:00.000Z", respuestas: { cuarto: { croquis: { boceto: huella } } } }],
    };
    const apaisada = [{ nombre: "", vertical: false, svg: '<svg id="croquis"></svg>' }];
    expect(plantillaInforme(contenido, { fuente: "", fotos: new Map(), bocetos: new Map([[huella, apaisada]]) })).toContain('<figure class="boceto apaisada"><svg id="croquis"></svg></figure>');
    // Con varias hojas, cada una lleva su nombre.
    const pisos = [
      { nombre: "Primer piso", vertical: true, svg: "<svg id=\"p1\"></svg>" },
      { nombre: "Segundo <piso>", vertical: true, svg: "<svg id=\"p2\"></svg>" },
    ];
    const html = plantillaInforme(contenido, { fuente: "", fotos: new Map(), bocetos: new Map([[huella, pisos]]) });
    expect(html).toContain('<div class="hojas"><figure class="boceto"><svg id="p1"></svg><figcaption>Primer piso</figcaption></figure>');
    expect(html).toContain("<figcaption>Segundo &lt;piso&gt;</figcaption>");
    expect(plantillaInforme(contenido, { fuente: "", fotos: new Map() })).toContain("[BOCETO]");
  });
});
