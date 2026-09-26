import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import type { VersionFormato } from "@teins/dominio";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { crearFormatos } from "../src/modulos/formatos";
import { cabecerasSync, ORIGEN, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;

/** Formato ficticio (R5) con una tabla de materiales. */
const conMateriales: VersionFormato = {
  formato: "prueba-catalogo-campo",
  version: 1,
  appMinima: 6,
  secciones: [{ clave: "obra", titulo: "Obra", campos: [{ clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["m", "und"], obligatorio: true }] }],
};

const org = await s.nuevaOrganizacionConUsuarios();
await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, conMateriales));

const oficina = (method: "GET" | "POST", url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie: org.oficina.cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });
const bajar = (version: number, desde = 0) =>
  app.inject({ method: "GET", url: `/api/sync/cambios?desde=${desde}&app=${version}&limite=500`, headers: { cookie: org.tecnico.cookie, ...cabecerasSync } });

async function nuevoItem(codigo: string, unidad = "m") {
  const r = await oficina("POST", "/api/catalogo", { codigo, descripcion: `Ítem ${codigo}`, unidad });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string };
}

const itemsDe = (bajada: { cambios: { tipo: string; item?: unknown }[] }) => bajada.cambios.filter((c) => c.tipo === "item_catalogo").map((c) => c.item);

describe("catálogo en el teléfono (iteración 17, ADR-0025)", () => {
  it("baja a la app 8 sin precio; una app anterior no lo recibe; desactivar un ítem baja como inactivo", async () => {
    const cable = await nuevoItem("CAB-6A");
    const importado = await oficina("POST", "/api/catalogo/importar", { items: [{ codigo: "JCK-6A", descripcion: "Jack categoría 6A", unidad: "und" }] });
    expect(importado.statusCode, importado.body).toBe(200);

    const vieja = (await bajar(7)).json();
    expect(itemsDe(vieja)).toEqual([]);

    const nueva = (await bajar(8)).json();
    expect(itemsDe(nueva)).toEqual(
      expect.arrayContaining([
        { id: cable.id, codigo: "CAB-6A", descripcion: "Ítem CAB-6A", unidad: "m", activo: true },
        expect.objectContaining({ codigo: "JCK-6A", descripcion: "Jack categoría 6A", unidad: "und", activo: true }),
      ]),
    );

    await oficina("POST", `/api/catalogo/${cable.id}`, { descripcion: "Ítem CAB-6A", unidad: "m", activo: false });
    const despues = (await bajar(8, nueva.puntoDeControl)).json();
    expect(itemsDe(despues)).toEqual([{ id: cable.id, codigo: "CAB-6A", descripcion: "Ítem CAB-6A", unidad: "m", activo: false }]);

    // Otra organización no ve este catálogo.
    const otra = await s.nuevaOrganizacionConUsuarios();
    const ajena = (await app.inject({ method: "GET", url: "/api/sync/cambios?desde=0&app=8&limite=500", headers: { cookie: otra.tecnico.cookie, ...cabecerasSync } })).json();
    expect(itemsDe(ajena)).toEqual([]);
  });

  it("la línea que eligió el técnico llega vinculada a su nombre; un ítem desconocido no rechaza el envío; oficina lo cambia", async () => {
    const soporte = await nuevoItem("SOP-L", "und");
    const id = randomUUID();
    const lineas = [
      { id: "l0000001", descripcion: "Ítem SOP-L", cantidad: "4", unidad: "und", item: soporte.id },
      { id: "l0000002", descripcion: "Algo de un catálogo viejo", cantidad: "1", unidad: "und", item: randomUUID() },
      { id: "l0000003", descripcion: "Escrito a mano", cantidad: "2.5", unidad: "m" },
    ];
    const r = await app.inject({
      method: "POST",
      url: "/api/sync/comandos",
      headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
      payload: {
        tipo: "EnviarLevantamiento",
        llave: llaveDeEnvio(id),
        levantamiento: { id, formato: "prueba-catalogo-campo", versionFormato: 1, respuestas: { obra: { materiales: lineas } }, creadoEn: "2026-09-26T10:00:00.000Z", enviadoEn: "2026-09-26T11:00:00.000Z" },
      },
    });
    expect(r.statusCode, r.body).toBe(200);

    const detalle = (await oficina("GET", `/api/levantamientos/${id}`)).json();
    expect(detalle.vinculos).toEqual([{ seccion: "obra", campo: "materiales", linea: "l0000001", item: { id: soporte.id, codigo: "SOP-L", descripcion: "Ítem SOP-L", unidad: "und" }, elegidoEnCampo: true }]);

    // Oficina lo confirma cambiándolo: deja de ser "elegido en campo".
    const otro = await nuevoItem("SOP-L2", "und");
    await oficina("POST", `/api/levantamientos/${id}/tomar`, { version: 1 });
    const vinculada = await oficina("POST", `/api/levantamientos/${id}/lineas/vincular`, { version: 2, seccion: "obra", campo: "materiales", linea: "l0000001", itemId: otro.id });
    expect(vinculada.statusCode, vinculada.body).toBe(200);
    const despues = (await oficina("GET", `/api/levantamientos/${id}`)).json();
    expect(despues.vinculos).toEqual([expect.objectContaining({ linea: "l0000001", item: expect.objectContaining({ codigo: "SOP-L2" }), elegidoEnCampo: false })]);
  });
});
