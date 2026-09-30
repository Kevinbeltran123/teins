import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import type { ContenidoVersion, LineaCantidad, VersionFormato } from "@teins/dominio";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearFormatos } from "../src/modulos/formatos";
import { plantillaInforme } from "../src/modulos/informes/pdf/plantilla";
import { crearVisitas } from "../src/modulos/visitas";
import { cabecerasSync, ORIGEN, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;

/** Formato ficticio (R5) con una tabla de materiales. */
const conMateriales: VersionFormato = {
  formato: "prueba-materiales",
  version: 1,
  appMinima: 6,
  secciones: [{ clave: "obra", titulo: "Obra", campos: [{ clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["m", "und"], obligatorio: true }] }],
};

const org = await s.nuevaOrganizacionConUsuarios();
await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, conMateriales));
const { visitaId } = await enOrganizacion(s.conexionApp.bd, org.organizacionId, async (tx) => {
  const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre: "Cliente de materiales", sitio: { nombre: "Sede", direccion: "Calle [N]" } });
  const visitaId = await crearVisitas(clientesYSitios).crear(tx, {
    organizacionId: org.organizacionId,
    autorId: "prueba",
    correlacion: "prueba",
    clienteId,
    sitioId,
    motivo: "Cotización",
    programadaPara: "2026-09-30",
    tecnicos: [org.tecnico.id],
  });
  return { visitaId };
});

const linea = (id: string, descripcion: string, cantidad: string, unidad = "m"): LineaCantidad => ({ id, descripcion, cantidad, unidad });
const enviar = (materiales: unknown, id = randomUUID()) =>
  app.inject({
    method: "POST",
    url: "/api/sync/comandos",
    headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
    payload: {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(id),
      levantamiento: { id, formato: "prueba-materiales", versionFormato: 1, visitaId, respuestas: { obra: { materiales } }, creadoEn: "2026-09-25T10:00:00.000Z", enviadoEn: "2026-09-25T11:00:00.000Z" },
    },
  });
const oficina = (method: "GET" | "POST", url: string, payload?: object) => app.inject({ method, url, headers: { cookie: org.oficina.cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });
const lineas = async (levantamientoId: string) =>
  (
    await s.propietario.pool.query(
      "select linea, cantidad, item_catalogo_id is not null as vinculada, quitada_en is not null as quitada from levantamientos.lineas_cantidad where levantamiento_id = $1 order by linea",
      [levantamientoId],
    )
  ).rows;

describe("cantidades con catálogo en el servidor (iteración 11)", () => {
  it("rechaza líneas sin descripción, con cantidad cero o con una unidad no permitida (regla 6)", async () => {
    for (const mala of [[linea("a0000001", " ", "3")], [linea("a0000001", "Cable", "0")], [linea("a0000001", "Cable", "3", "kg")]]) {
      const r = await enviar(mala);
      expect(r.json(), JSON.stringify(mala)).toMatchObject({ codigo: "respuestas_invalidas", errores: [{ codigo: "cantidades_invalidas" }] });
    }
  });

  it("proyecta las líneas; oficina importa el catálogo, vincula, corrige y exporta la visita", async () => {
    const id = randomUUID();
    expect((await enviar([linea("a0000001", "Cable 12 AWG", "25"), linea("a0000002", "Breaker 20 A", "2", "und")], id)).statusCode).toBe(200);
    expect(await lineas(id)).toEqual([
      { linea: "a0000001", cantidad: "25", vinculada: false, quitada: false },
      { linea: "a0000002", cantidad: "2", vinculada: false, quitada: false },
    ]);

    // Catálogo: importación en bloque, un código repetido no se duplica.
    const importado = await oficina("POST", "/api/catalogo/importar", {
      items: [
        { codigo: "C-12", descripcion: "Cable THHN 12 AWG", unidad: "m" },
        { codigo: "B-20", descripcion: "Breaker 1P 20 A", unidad: "und" },
      ],
    });
    expect(importado.json()).toEqual({ creados: 2, actualizados: 0 });
    expect((await oficina("POST", "/api/catalogo/importar", { items: [{ codigo: "C-12", descripcion: "Cable THHN 12 AWG negro", unidad: "m" }] })).json()).toEqual({ creados: 0, actualizados: 1 });
    expect((await oficina("POST", "/api/catalogo", { codigo: "C-12", descripcion: "Otro", unidad: "m" })).json().codigo).toBe("conflicto");
    const { items } = (await oficina("GET", "/api/catalogo")).json();
    const cable = items.find((i: { codigo: string }) => i.codigo === "C-12");
    expect(cable.descripcion).toBe("Cable THHN 12 AWG negro");

    // Vincular exige tener la revisión.
    const vincular = (version: number, itemId: string | null, lineaId = "a0000001") =>
      oficina("POST", `/api/levantamientos/${id}/lineas/vincular`, { version, seccion: "obra", campo: "materiales", linea: lineaId, itemId });
    expect((await vincular(1, cable.id)).json().codigo).toBe("estado_invalido");
    await oficina("POST", `/api/levantamientos/${id}/tomar`, { version: 1 });
    const vinculada = await vincular(2, cable.id);
    expect(vinculada.json()).toEqual({ version: 3 });
    expect((await oficina("GET", `/api/levantamientos/${id}`)).json().vinculos).toEqual([
      { seccion: "obra", campo: "materiales", linea: "a0000001", item: { id: cable.id, codigo: "C-12", descripcion: "Cable THHN 12 AWG negro", unidad: "m" }, elegidoEnCampo: false },
    ]);
    const { rows: eventos } = await s.propietario.pool.query("select tipo_evento, valor_nuevo from auditoria.registros where agregado_id = $1 and tipo_evento = 'linea_vinculada'", [id]);
    expect(eventos).toEqual([{ tipo_evento: "linea_vinculada", valor_nuevo: { linea: "a0000001", item: cable.id } }]);

    // Corregir: cambia una, quita otra y agrega una tercera; el vínculo de la primera se conserva.
    const corregida = await oficina("POST", `/api/levantamientos/${id}/correcciones`, {
      version: 3,
      motivo: "Conteo en sitio",
      correcciones: [{ seccion: "obra", campo: "materiales", valor: [linea("a0000001", "Cable 12 AWG", "30"), linea("a0000003", "Canaleta 40x25", "6")] }],
    });
    expect(corregida.statusCode, corregida.body).toBe(200);
    expect(await lineas(id)).toEqual([
      { linea: "a0000001", cantidad: "30", vinculada: true, quitada: false },
      { linea: "a0000002", cantidad: "2", vinculada: false, quitada: true },
      { linea: "a0000003", cantidad: "6", vinculada: false, quitada: false },
    ]);

    // Exportación de la visita: solo las líneas vigentes, con su ubicación y su ítem.
    const exportadas = (await oficina("GET", `/api/visitas/${visitaId}/cantidades`)).json();
    expect(exportadas.visita).toEqual({ cliente: "Cliente de materiales", sitio: "Sede", programadaPara: "2026-09-30" });
    expect(exportadas.lineas.filter((l: { levantamientoId: string }) => l.levantamientoId === id)).toEqual([
      expect.objectContaining({ ubicacion: "Obra · Materiales", descripcion: "Cable 12 AWG", cantidad: "30", unidad: "m", item: { codigo: "C-12", descripcion: "Cable THHN 12 AWG negro" } }),
      expect.objectContaining({ descripcion: "Canaleta 40x25", cantidad: "6", item: null }),
    ]);
  });

  it("la exportación sigue el orden del levantamiento: cada repetición en el orden en que se creó", async () => {
    const conTableros: VersionFormato = {
      formato: "prueba-tableros",
      version: 1,
      appMinima: 6,
      secciones: [{ clave: "tablero", titulo: "Tablero", repetible: { etiqueta: "Tablero", min: 1, max: 3 }, campos: [{ clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["m"] }] }],
    };
    await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, conTableros));
    const id = randomUUID();
    // El id de la primera repetición ordena después del de la segunda.
    const r = await app.inject({
      method: "POST",
      url: "/api/sync/comandos",
      headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
      payload: {
        tipo: "EnviarLevantamiento",
        llave: llaveDeEnvio(id),
        levantamiento: {
          id,
          formato: "prueba-tableros",
          versionFormato: 1,
          visitaId,
          repeticiones: { tablero: [{ id: "zzzzzzzz", nombre: "Principal" }, { id: "aaaaaaaa", nombre: "Secundario" }] },
          respuestas: { "tablero~zzzzzzzz": { materiales: [linea("a0000001", "Cable del principal", "5")] }, "tablero~aaaaaaaa": { materiales: [linea("a0000001", "Cable del secundario", "3")] } },
          creadoEn: "2026-09-25T10:00:00.000Z",
          enviadoEn: "2026-09-25T11:00:00.000Z",
        },
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    const exportadas = (await oficina("GET", `/api/visitas/${visitaId}/cantidades`)).json();
    expect(exportadas.lineas.filter((l: { levantamientoId: string }) => l.levantamientoId === id).map((l: { descripcion: string }) => l.descripcion)).toEqual(["Cable del principal", "Cable del secundario"]);
  });

  it("un ítem desactivado no se vincula; el catálogo es de oficina", async () => {
    const creado = (await oficina("POST", "/api/catalogo", { codigo: `X-${randomUUID().slice(0, 4)}`, descripcion: "Ítem viejo", unidad: "und" })).json();
    expect((await oficina("POST", `/api/catalogo/${creado.id}`, { descripcion: "Ítem viejo", unidad: "und", activo: false })).json().activo).toBe(false);
    const id = randomUUID();
    await enviar([linea("a0000001", "Algo", "1", "und")], id);
    await oficina("POST", `/api/levantamientos/${id}/tomar`, { version: 1 });
    const r = await oficina("POST", `/api/levantamientos/${id}/lineas/vincular`, { version: 2, seccion: "obra", campo: "materiales", linea: "a0000001", itemId: creado.id });
    expect(r.json().codigo).toBe("entrada_invalida");
    expect((await app.inject({ method: "GET", url: "/api/catalogo", headers: { cookie: org.tecnico.cookie } })).statusCode).toBe(403);
  });

  it("el PDF trae la tabla de cantidades con coma decimal", () => {
    const contenido: ContenidoVersion = {
      formatoContenido: 1,
      numero: 1,
      publicadaEn: "2026-09-25T12:00:00.000Z",
      publicadaPor: "Oficina",
      organizacion: { nombre: "Organización de prueba" },
      visita: { cliente: "Cliente", sitio: "Sede", direccion: "Calle [N]", motivo: "Cotización", programadaPara: "2026-09-30" },
      introduccion: "",
      conclusiones: "",
      planos: [],
      levantamientos: [{ id: randomUUID(), formato: conMateriales, tecnico: "T", revisor: "O", recibidoEn: "2026-09-25T11:00:00.000Z", respuestas: { obra: { materiales: [linea("a0000001", "Cable <12>", "12.5")] } } }],
    };
    const html = plantillaInforme(contenido, { fuente: "", fotos: new Map() });
    expect(html).toContain('<table class="cantidades">');
    expect(html).toContain("<td>Cable &lt;12&gt;</td><td class=\"numero\">12,5</td><td>m</td>");
  });
});
