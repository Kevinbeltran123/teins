import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { verificarCadena } from "../src/modulos/auditoria";
import { crearFormatos } from "../src/modulos/formatos";
import { cabecerasSync, formatoDePrueba, iniciarSesion, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;

const potencia = (valor: string) => ({ valor, unidad: "kVA" });

/** Organización con un levantamiento enviado (formato v1, sin fotos) y dos personas de oficina. */
async function levantamientoEnviado() {
  const org = await s.nuevaOrganizacionConUsuarios();
  const id = randomUUID();
  const r = await app.inject({
    method: "POST",
    url: "/api/sync/comandos",
    headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
    payload: {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(id),
      levantamiento: {
        id,
        formato: "prueba-ups",
        versionFormato: 1,
        respuestas: { cuarto_tecnico: { potencia_nominal: potencia("10"), descripcion: "Cuarto de prueba" } },
        creadoEn: "2026-09-24T10:00:00.000-05:00",
        enviadoEn: "2026-09-24T11:30:00.000-05:00",
      },
    },
  });
  expect(r.statusCode, r.body).toBe(200);
  const usuario = `oficina.${randomBytes(4).toString("hex")}`;
  await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre: "Otra de oficina", rol: "oficina", contrasena: "contrasena-de-prueba" });
  const otra = { cookie: await iniciarSesion(app, usuario, "contrasena-de-prueba") };
  return { ...org, id, otra };
}

const post = (cookie: string, id: string, accion: string, payload: object) =>
  app.inject({ method: "POST", url: `/api/levantamientos/${id}/${accion}`, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: "GET", url, headers: { cookie } });
// La bajada exige la cabecera del protocolo.
const getSync = (cookie: string, url: string) => app.inject({ method: "GET", url, headers: { cookie, ...cabecerasSync } });

describe("revisión (QA-8, I-1)", () => {
  it("la bandeja busca por formato y por técnico, sin tildes ni mayúsculas, y cuenta solo lo que coincide (iteración 23)", async () => {
    const { oficina } = await levantamientoEnviado();
    const buscar = async (texto: string) => (await get(oficina.cookie, `/api/levantamientos?estado=enviado&buscar=${encodeURIComponent(texto)}`)).json();
    expect((await buscar("PRUEBA-UPS")).total).toBe(1);
    expect((await buscar("tecnico de prueba")).total).toBe(1);
    const nada = await buscar("no existe 100%");
    expect(nada).toMatchObject({ total: 0, elementos: [] });
    // Sin texto, la bandeja completa del estado.
    expect((await buscar("   ")).total).toBe(1);
  });

  it("la bandeja también busca por el nombre visible del formato, y un cursor alterado es un error de entrada", async () => {
    const { oficina, organizacionId } = await levantamientoEnviado();
    await enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => crearFormatos().publicar(tx, organizacionId, { ...formatoDePrueba(2), version: 3, nombre: "Mantenimiento de climatización" }));
    expect((await get(oficina.cookie, `/api/levantamientos?estado=enviado&buscar=${encodeURIComponent("climatizacion")}`)).json().total).toBe(1);
    const cursor = Buffer.from(JSON.stringify(["2026-01-01T00:00:00.000Z", "no-es-un-id"])).toString("base64url");
    expect((await get(oficina.cookie, `/api/levantamientos?estado=enviado&cursor=${cursor}`)).json()).toMatchObject({ codigo: "entrada_invalida" });
  });

  it("tomar, corregir y marcar revisado dejan historial por campo con la cadena íntegra", async () => {
    const { oficina, tecnico, organizacionId, id } = await levantamientoEnviado();

    const tomado = await post(oficina.cookie, id, "tomar", { version: 1 });
    expect(tomado.json()).toEqual({ estado: "en_revision", revisor: { id: oficina.id, nombre: "Oficina de prueba" }, version: 2 });

    const corregido = await post(oficina.cookie, id, "correcciones", {
      version: 2,
      motivo: "La placa dice 12,5",
      correcciones: [
        { seccion: "cuarto_tecnico", campo: "potencia_nominal", valor: potencia("12.5") },
        { seccion: "cuarto_tecnico", campo: "descripcion", valor: "Cuarto de prueba" },
      ],
    });
    // Reescribir el mismo valor no es un cambio.
    expect(corregido.json()).toEqual({ version: 3, cambios: 1 });

    const revisado = await post(oficina.cookie, id, "marcar-revisado", { version: 3 });
    expect(revisado.json()).toMatchObject({ estado: "revisado", version: 4 });

    const detalle = (await get(oficina.cookie, `/api/levantamientos/${id}`)).json();
    expect(detalle).toMatchObject({ estado: "revisado", version: 4, respuestas: { cuarto_tecnico: { potencia_nominal: potencia("12.5") } } });

    const historial = (await get(oficina.cookie, `/api/levantamientos/${id}/historial`)).json();
    expect(historial.integra).toBe(true);
    expect(historial.eventos.map((e: { tipo: string }) => e.tipo)).toEqual([
      "levantamiento_creado",
      "levantamiento_enviado",
      "revision_tomada",
      "campo_corregido",
      "levantamiento_revisado",
    ]);
    expect(historial.eventos[2]).toMatchObject({ nuevo: { revisor: "Oficina de prueba" }, autor: { nombre: "Oficina de prueba" } });
    expect(historial.eventos[3]).toMatchObject({
      seccion: "cuarto_tecnico",
      campo: "potencia_nominal",
      anterior: potencia("10"),
      nuevo: potencia("12.5"),
      motivo: "La placa dice 12,5",
      autor: { id: oficina.id },
    });
    expect(await enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => verificarCadena(tx, organizacionId, "levantamiento", id))).toEqual({
      integra: true,
      eslabones: 5,
    });

    // La bandeja filtra por estado.
    const revisados = (await get(oficina.cookie, "/api/levantamientos?estado=revisado")).json();
    expect(revisados.elementos.map((e: { id: string }) => e.id)).toEqual([id]);
    expect((await get(oficina.cookie, "/api/levantamientos?estado=enviado")).json().total).toBe(0);

    // El técnico lo ve revisado; una app anterior sigue leyendo "enviado" (ADR-0015).
    expect((await bajarSync(tecnico.cookie, 3))[0]).toMatchObject({ id, estado: "revisado", comentarios: [] });
    expect((await bajarSync(tecnico.cookie, 2))[0]).toEqual({ tipo: "levantamiento", id, estado: "enviado", recibidoEn: expect.any(String) });
  });

  it("dos guardados sobre la misma versión: uno se acepta y el otro se rechaza y avisa (QA-25)", async () => {
    const { oficina, id } = await levantamientoEnviado();
    await post(oficina.cookie, id, "tomar", { version: 1 });
    const corregir = (valor: string) =>
      post(oficina.cookie, id, "correcciones", { version: 2, correcciones: [{ seccion: "cuarto_tecnico", campo: "potencia_nominal", valor: potencia(valor) }] });
    const [a, b] = await Promise.all([corregir("11"), corregir("13")]);
    const estados = [a.statusCode, b.statusCode].sort();
    expect(estados).toEqual([200, 409]);
    const rechazo = [a, b].find((r) => r.statusCode === 409)!.json();
    expect(rechazo).toMatchObject({ codigo: "conflicto_de_version" });

    // Nada se perdió en silencio: queda exactamente el cambio aceptado, y guardar con la versión vieja se rechaza.
    const aceptado = [a, b].find((r) => r.statusCode === 200)!;
    const historial = (await get(oficina.cookie, `/api/levantamientos/${id}/historial`)).json();
    expect(historial.eventos.filter((e: { tipo: string }) => e.tipo === "campo_corregido")).toHaveLength(1);
    expect(aceptado.json()).toEqual({ version: 3, cambios: 1 });
    expect((await corregir("14")).json()).toMatchObject({ codigo: "conflicto_de_version", versionActual: 3 });
  });

  it("solo quien tomó la revisión la edita; otra persona se la quita solo pidiéndolo y queda registrado", async () => {
    const { oficina, otra, tecnico, id } = await levantamientoEnviado();
    await post(oficina.cookie, id, "tomar", { version: 1 });

    const ajena = await post(otra.cookie, id, "correcciones", { version: 2, correcciones: [{ seccion: "cuarto_tecnico", campo: "descripcion", valor: "x" }] });
    expect(ajena.json()).toMatchObject({ codigo: "no_tomado" });
    const sinPedir = await post(otra.cookie, id, "tomar", { version: 2 });
    expect(sinPedir.json()).toMatchObject({ codigo: "tomado_por_otro", revisor: { id: oficina.id, nombre: "Oficina de prueba" } });

    const reasignada = await post(otra.cookie, id, "tomar", { version: 2, reasignar: true });
    expect(reasignada.json()).toMatchObject({ estado: "en_revision", revisor: { nombre: "Otra de oficina" }, version: 3 });
    expect((await post(oficina.cookie, id, "marcar-revisado", { version: 3 })).json()).toMatchObject({ codigo: "no_tomado" });

    const historial = (await get(oficina.cookie, `/api/levantamientos/${id}/historial`)).json();
    expect(historial.eventos.at(-1)).toMatchObject({
      tipo: "revision_reasignada",
      anterior: { revisor: "Oficina de prueba" },
      nuevo: { revisor: "Otra de oficina" },
    });

    // El técnico no revisa nada.
    expect((await post(tecnico.cookie, id, "tomar", { version: 3, reasignar: true })).json()).toMatchObject({ codigo: "sin_permiso" });
  });

  it("las correcciones cumplen las reglas del formato y no tocan fotos", async () => {
    const { oficina, id } = await levantamientoEnviado();
    await post(oficina.cookie, id, "tomar", { version: 1 });
    const r = await post(oficina.cookie, id, "correcciones", {
      version: 2,
      correcciones: [
        { seccion: "cuarto_tecnico", campo: "potencia_nominal", valor: { valor: "12", unidad: "m" } },
        { seccion: "cuarto_tecnico", campo: "fotos_equipo", valor: null },
      ],
    });
    expect(r.statusCode).toBe(422);
    expect(r.json().errores).toEqual([
      { seccion: "cuarto_tecnico", campo: "potencia_nominal", codigo: "unidad_no_permitida" },
      { seccion: "cuarto_tecnico", campo: "fotos_equipo", codigo: "no_corregible" },
    ]);
    // Un enviado sin tomar no se corrige ni se marca.
    const otro = await levantamientoEnviado();
    expect((await post(otro.oficina.cookie, otro.id, "marcar-revisado", { version: 1 })).json()).toMatchObject({ codigo: "estado_invalido" });
  });

  it("los comentarios llegan al técnico con su autor, y deben apuntar a un campo del formato", async () => {
    const { oficina, otra, tecnico, id } = await levantamientoEnviado();
    const antes = (await bajarSync(tecnico.cookie, 3)).length;
    const c = await post(otra.cookie, id, "comentarios", { texto: "La potencia parece baja, revisa la placa", seccion: "cuarto_tecnico", campo: "potencia_nominal" });
    expect(c.statusCode).toBe(201);
    expect(c.json()).toMatchObject({ texto: "La potencia parece baja, revisa la placa", campo: "potencia_nominal", autor: { nombre: "Otra de oficina" } });

    const detalle = (await get(oficina.cookie, `/api/levantamientos/${id}`)).json();
    expect(detalle.comentarios).toHaveLength(1);
    // Comentar no cambia la versión ni el estado.
    expect(detalle).toMatchObject({ estado: "enviado", version: 1 });

    const cambios = await bajarSync(tecnico.cookie, 3);
    expect(cambios.length).toBeGreaterThanOrEqual(antes);
    expect(cambios.at(-1)).toMatchObject({ id, comentarios: [{ texto: "La potencia parece baja, revisa la placa", campo: "potencia_nominal", autor: "Otra de oficina" }] });

    expect((await post(oficina.cookie, id, "comentarios", { texto: "x", seccion: "cuarto_tecnico", campo: "no_existe" })).json()).toMatchObject({ codigo: "entrada_invalida" });
    const historial = (await get(oficina.cookie, `/api/levantamientos/${id}/historial`)).json();
    expect(historial.eventos.at(-1)).toMatchObject({ tipo: "comentario_agregado", seccion: "cuarto_tecnico", campo: "potencia_nominal" });
  });
});

describe("corregir un comentario (ADR-0035)", () => {
  const corregir = (cookie: string, id: string, comentarioId: string, accion = "", payload: object = {}) =>
    app.inject({ method: "POST", url: `/api/levantamientos/${id}/comentarios/${comentarioId}${accion ? `/${accion}` : ""}`, headers: { cookie }, payload });

  it("su autor lo edita o lo retira mientras no esté revisado; el técnico ve la última versión y no ve lo retirado", async () => {
    const { oficina, otra, tecnico, id } = await levantamientoEnviado();
    const editable = (await post(oficina.cookie, id, "comentarios", { texto: "La placa dice 20 A", seccion: "cuarto_tecnico", campo: "potencia_nominal" })).json();
    const retirable = (await post(oficina.cookie, id, "comentarios", { texto: "Falta la foto del tablero" })).json();

    // Solo su autor.
    expect((await corregir(otra.cookie, id, editable.id, "", { texto: "Otro texto" })).statusCode).toBe(403);
    expect((await corregir(oficina.cookie, id, randomUUID(), "", { texto: "Otro texto" })).statusCode).toBe(404);

    const editado = await corregir(oficina.cookie, id, editable.id, "", { texto: "La placa dice 200 A: revise la foto" });
    expect(editado.statusCode, editado.body).toBe(200);
    expect(editado.json()).toMatchObject({ texto: "La placa dice 200 A: revise la foto", editadoEn: expect.any(String), retirado: null });
    const retirado = await corregir(oficina.cookie, id, retirable.id, "retirar");
    expect(retirado.json()).toMatchObject({ retirado: { por: { nombre: "Oficina de prueba" } } });
    expect((await corregir(oficina.cookie, id, retirable.id, "", { texto: "x" })).json()).toMatchObject({ codigo: "estado_invalido" });

    // Oficina ve los dos (el retirado, marcado); el técnico, solo el vigente, con su edición.
    const detalle = (await get(oficina.cookie, `/api/levantamientos/${id}`)).json();
    expect(detalle.comentarios.map((c: { texto: string; retirado: unknown }) => [c.texto, c.retirado !== null])).toEqual([["La placa dice 200 A: revise la foto", false], ["Falta la foto del tablero", true]]);
    const enElTelefono = (await bajarSync(tecnico.cookie, 3)).find((c) => c["id"] === id)!;
    expect(enElTelefono["comentarios"]).toEqual([expect.objectContaining({ texto: "La placa dice 200 A: revise la foto", editadoEn: expect.any(String) })]);

    // "Deshacer" lo devuelve.
    expect((await corregir(oficina.cookie, id, retirable.id, "restaurar")).json()).toMatchObject({ retirado: null });
    expect(((await bajarSync(tecnico.cookie, 3)).find((c) => c["id"] === id)!["comentarios"] as unknown[]).length).toBe(2);

    const historial = (await get(oficina.cookie, `/api/levantamientos/${id}/historial`)).json();
    expect(historial.eventos.map((e: { tipo: string }) => e.tipo).filter((t: string) => t.startsWith("comentario"))).toEqual([
      "comentario_agregado",
      "comentario_agregado",
      "comentario_editado",
      "comentario_retirado",
      "comentario_restaurado",
    ]);

    // Revisado, ya no se corrigen: es lo que el técnico recibió con la revisión.
    expect((await post(oficina.cookie, id, "tomar", { version: 1 })).statusCode).toBe(200);
    expect((await post(oficina.cookie, id, "marcar-revisado", { version: 2 })).statusCode).toBe(200);
    expect((await corregir(oficina.cookie, id, editable.id, "retirar")).json()).toMatchObject({ codigo: "estado_invalido" });
  });
});

async function bajarSync(cookie: string, appVersion: number) {
  const r = await getSync(cookie, `/api/sync/cambios?app=${appVersion}`);
  expect(r.statusCode, r.body).toBe(200);
  return (r.json() as { cambios: { tipo: string }[] }).cambios.filter((c) => c.tipo === "levantamiento") as Record<string, unknown>[];
}
