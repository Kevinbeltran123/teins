import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import type { ContenidoVersion, VersionFormato } from "@teins/dominio";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { crearFormatos } from "../src/modulos/formatos";
import { plantillaInforme } from "@teins/documentos";
import { cabecerasSync, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;

/** Formato ficticio (R5) con una sección repetible de uno a dos tableros. */
const edificio: VersionFormato = {
  formato: "prueba-edificio",
  version: 1,
  nombre: "Edificio de prueba",
  appMinima: 4,
  secciones: [
    { clave: "general", titulo: "Datos generales", campos: [{ clave: "direccion", etiqueta: "Dirección", tipo: "texto" }] },
    {
      clave: "tableros",
      titulo: "Tableros",
      repetible: { etiqueta: "Tablero", min: 1, max: 2 },
      campos: [
        { clave: "ubicacion", etiqueta: "Ubicación", tipo: "texto", obligatorio: true },
        { clave: "corriente", etiqueta: "Corriente nominal", tipo: "medida", unidades: ["A"], obligatorio: true },
      ],
    },
  ],
};

const org = await s.nuevaOrganizacionConUsuarios();
await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, edificio));

const tablero = (ubicacion: string) => ({ ubicacion, corriente: { valor: "63", unidad: "A" } });
const enviar = (repeticiones: object, respuestas: object, id = randomUUID()) =>
  app.inject({
    method: "POST",
    url: "/api/sync/comandos",
    headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
    payload: {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(id),
      levantamiento: { id, formato: "prueba-edificio", versionFormato: 1, respuestas, repeticiones, creadoEn: "2026-09-25T10:00:00.000Z", enviadoEn: "2026-09-25T11:00:00.000Z" },
    },
  });
const oficina = (method: "GET" | "POST", url: string, payload?: object) => app.inject({ method, url, headers: { cookie: org.oficina.cookie }, ...(payload ? { payload } : {}) });

describe("secciones repetibles en el servidor (iteración 9)", () => {
  it("recibe las repeticiones, oficina las ve, corrige una y el historial dice cuál", async () => {
    const id = randomUUID();
    const repeticiones = { tableros: [{ id: "sotano01", nombre: "Tablero del sótano" }, { id: "piso0001", nombre: "Tablero 2" }] };
    const r = await enviar(repeticiones, { general: { direccion: "Calle [N]" }, "tableros~sotano01": tablero("Sótano"), "tableros~piso0001": tablero("Piso 1") }, id);
    expect(r.statusCode, r.body).toBe(200);

    const detalle = (await oficina("GET", `/api/levantamientos/${id}`)).json();
    expect(detalle.repeticiones).toEqual(repeticiones);
    expect(detalle.respuestas["tableros~piso0001"].ubicacion).toBe("Piso 1");

    await oficina("POST", `/api/levantamientos/${id}/tomar`, { version: 1 });
    const corregido = await oficina("POST", `/api/levantamientos/${id}/correcciones`, {
      version: 2,
      correcciones: [{ seccion: "tableros~piso0001", campo: "ubicacion", valor: "Piso 2" }],
    });
    expect(corregido.statusCode, corregido.body).toBe(200);
    const { rows } = await s.propietario.pool.query("select ruta_campo from auditoria.registros where agregado_id = $1 and tipo_evento = 'campo_corregido'", [id]);
    expect(rows).toEqual([{ ruta_campo: "tableros~piso0001.ubicacion" }]);

    // Una repetición que no existe no se corrige ni se comenta: oficina no crea repeticiones.
    const inexistente = await oficina("POST", `/api/levantamientos/${id}/correcciones`, { version: 3, correcciones: [{ seccion: "tableros~nuevo001", campo: "ubicacion", valor: "x" }] });
    expect(inexistente.json().codigo).toBe("respuestas_invalidas");
    expect((await oficina("POST", `/api/levantamientos/${id}/comentarios`, { texto: "Revisa el breaker", seccion: "tableros~sotano01", campo: "corriente" })).statusCode).toBe(201);
    expect((await oficina("POST", `/api/levantamientos/${id}/comentarios`, { texto: "x", seccion: "tableros~nuevo001" })).json().codigo).toBe("entrada_invalida");
  });

  it("rechaza repeticiones de menos o de más, obligatorios vacíos y claves que no están en la lista", async () => {
    const codigos = async (repeticiones: object, respuestas: object) => (await enviar(repeticiones, respuestas)).json().errores?.map((e: { codigo: string }) => e.codigo);
    expect(await codigos({ tableros: [] }, {})).toContain("repeticiones_insuficientes");
    const tres = ["a0000001", "a0000002", "a0000003"].map((id) => ({ id, nombre: id }));
    expect(await codigos({ tableros: tres }, Object.fromEntries(tres.map((t) => [`tableros~${t.id}`, tablero("x")])))).toContain("repeticiones_excedidas");
    expect(await codigos({ tableros: [{ id: "a0000001", nombre: "T" }] }, { "tableros~a0000001": { ubicacion: "x" } })).toContain("campo_obligatorio");
    expect(await codigos({ tableros: [{ id: "a0000001", nombre: "T" }] }, { "tableros~a0000001": tablero("x"), "tableros~b0000001": tablero("y") })).toContain(
      "seccion_desconocida",
    );
  });

  it("un formato con secciones repetibles no baja a una app anterior, y sin appMinima no se publica", async () => {
    const formatosQueBajan = async (app_: number) =>
      (await app.inject({ method: "GET", url: `/api/sync/cambios?desde=0&app=${app_}`, headers: { cookie: org.tecnico.cookie, ...cabecerasSync } }))
        .json()
        .cambios.filter((c: { tipo: string }) => c.tipo === "formato")
        .map((c: { definicion: VersionFormato }) => c.definicion.formato);
    expect(await formatosQueBajan(3)).not.toContain("prueba-edificio");
    expect(await formatosQueBajan(4)).toContain("prueba-edificio");

    await expect(
      enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, { ...edificio, version: 2, appMinima: undefined })),
    ).rejects.toThrow(/appMinima 4/);
  });

  it("el informe muestra cada repetición con su nombre, en orden", () => {
    const contenido = {
      formatoContenido: 1,
      numero: 1,
      publicadaEn: "2026-09-25T12:00:00.000Z",
      publicadaPor: "Oficina de prueba",
      organizacion: { nombre: "Organización de prueba" },
      visita: { cliente: "Cliente", sitio: "Sede", direccion: "Calle [N]", motivo: "Mantenimiento", programadaPara: "2026-09-25" },
      introduccion: "",
      conclusiones: "",
      planos: [],
      levantamientos: [
        {
          id: randomUUID(),
          formato: edificio,
          tecnico: "Técnico",
          revisor: "Oficina",
          recibidoEn: "2026-09-25T11:00:00.000Z",
          respuestas: { "tableros~sotano01": tablero("Sótano"), "tableros~piso0001": tablero("Piso 1") },
          repeticiones: { tableros: [{ id: "sotano01", nombre: "Tablero del sótano" }, { id: "piso0001", nombre: "Tablero 2" }] },
        },
      ],
    } satisfies ContenidoVersion;
    const html = plantillaInforme(contenido, { salida: { tipo: "pdf", fuente: "" }, fotos: new Map() });
    const primero = html.indexOf("Tableros · Tablero del sótano");
    const segundo = html.indexOf("Tableros · Tablero 2");
    expect(primero).toBeGreaterThan(0);
    expect(segundo).toBeGreaterThan(primero);
    expect(html).toContain("Piso 1");
  });
});
