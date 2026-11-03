import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { llaveDeEnvio } from "@teins/protocolo";
import type { LineaCantidad, VersionFormato } from "@teins/dominio";
import { enClienteDelPortal, enOrganizacion } from "../src/plataforma/base-de-datos";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearFormatos } from "../src/modulos/formatos";
import { crearAccesosDeClientes } from "../src/modulos/portal";
import { crearVisitas } from "../src/modulos/visitas";
import { cabecerasSync, ORIGEN, servidorDePrueba } from "./ayudas";

/*
  Cotizaciones en el portal (ADR-0053): el cliente ve y descarga la versión vigente de cada una, con la misma barrera
  de la base que los informes (QA-4).
*/
const s = await servidorDePrueba();
const { app } = s;
const accesos = crearAccesosDeClientes(s.conexionApp.bd);
const contexto = { autorId: "administrador", correlacion: "prueba-portal-cotizaciones" };
const PORTAL = "http://localhost:5175";

/** Formato ficticio (R5) con una tabla de materiales. */
const conMateriales: VersionFormato = {
  formato: "prueba-materiales",
  version: 1,
  appMinima: 6,
  secciones: [{ clave: "obra", titulo: "Obra", campos: [{ clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["m", "und"], obligatorio: true }] }],
};

type Org = Awaited<ReturnType<typeof s.nuevaOrganizacionConUsuarios>>;

async function organizacion() {
  const org = await s.nuevaOrganizacionConUsuarios();
  await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, conMateriales));
  const admin = await s.nuevoAdministrador(org.organizacionId);
  return { ...org, admin };
}

/** La cola `pdf` es compartida: se insiste hasta que no quede ningún PDF de esta cotización generándose. */
async function esperarPdf(cotizacionId: string) {
  for (let i = 0; i < 180; i++) {
    await s.procesarCola();
    const { rows } = await s.propietario.pool.query("select count(*)::int as n from cotizaciones.versiones where pdf_estado = 'generando' and cotizacion_id = $1", [cotizacionId]);
    if (rows[0].n === 0) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Hay PDF de cotización sin generar");
}

/** Un cliente con una cotización publicada (PDF listo) desde las cantidades revisadas de su visita. */
async function clienteConCotizacion(org: Org & { admin: { cookie: string } }, nombre: string) {
  const { clienteId, visitaId } = await enOrganizacion(s.conexionApp.bd, org.organizacionId, async (tx) => {
    const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre, sitio: { nombre: `Sede de ${nombre}`, direccion: "Calle [N]" } });
    const visitaId = await crearVisitas(clientesYSitios).crear(tx, { organizacionId: org.organizacionId, ...contexto, clienteId, sitioId, motivo: "Cotización", programadaPara: "2026-10-28", tecnicos: [org.tecnico.id] });
    return { clienteId, visitaId };
  });
  const oficina = (method: "GET" | "POST", url: string, payload?: object, cookie = org.oficina.cookie) => app.inject({ method, url, headers: { cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });
  const id = randomUUID();
  const materiales: LineaCantidad[] = [{ id: "a0000001", descripcion: "Cable UTP", cantidad: "10", unidad: "m" }];
  const enviado = await app.inject({
    method: "POST",
    url: "/api/sync/comandos",
    headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
    payload: {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(id),
      levantamiento: { id, formato: "prueba-materiales", versionFormato: 1, visitaId, respuestas: { obra: { materiales } }, creadoEn: "2026-10-28T10:00:00.000Z", enviadoEn: "2026-10-28T11:00:00.000Z" },
    },
  });
  expect(enviado.statusCode, enviado.body).toBe(200);
  await oficina("POST", `/api/levantamientos/${id}/tomar`, { version: 1 });
  expect((await oficina("POST", `/api/levantamientos/${id}/marcar-revisado`, { version: 2 })).statusCode).toBe(200);

  const { id: cotizacionId } = (await oficina("POST", "/api/cotizaciones", { visitaId })).json();
  const detalle = (await oficina("GET", `/api/cotizaciones/${cotizacionId}`)).json();
  const borrador = { lineas: detalle.lineas.map((l: object) => ({ ...l, precio: 4800 })), impuestos: { tipo: "iva" }, condiciones: detalle.condiciones };
  expect((await oficina("POST", `/api/cotizaciones/${cotizacionId}/borrador`, { version: 1, ...borrador })).statusCode).toBe(200);
  expect((await oficina("POST", `/api/cotizaciones/${cotizacionId}/publicar`, { version: 2, destinatarios: [] })).statusCode).toBe(201);
  await esperarPdf(cotizacionId);
  return {
    clienteId,
    cotizacionId,
    numero: detalle.numero as string,
    publicarOtra: async () => {
      expect((await oficina("POST", `/api/cotizaciones/${cotizacionId}/publicar`, { version: 3, destinatarios: [] })).statusCode).toBe(201);
      await esperarPdf(cotizacionId);
    },
    retirar: (numero: number) => oficina("POST", `/api/cotizaciones/${cotizacionId}/versiones/${numero}/retirar`, { motivo: "El precio estaba mal" }, org.admin.cookie),
  };
}

const ingresar = async (organizacionId: string, clienteId: string, ip: string) => {
  const { identificador, clave } = await accesos.crear(organizacionId, clienteId, contexto);
  const r = await app.inject({ method: "POST", url: "/api/portal/ingresar", remoteAddress: ip, headers: { origin: PORTAL }, payload: { identificador, clave } });
  expect(r.statusCode, r.body).toBe(200);
  return String(r.headers["set-cookie"]).split(";")[0]!;
};
const portal = (cookie: string, url: string) => app.inject({ method: "GET", url, headers: { cookie } });

// Una organización con dos clientes y otra con un tercero, cada uno con su cotización publicada.
const orgA = await organizacion();
const [a, b] = [await clienteConCotizacion(orgA, "Cliente A"), await clienteConCotizacion(orgA, "Cliente B")];
const orgC = await organizacion();
const c = await clienteConCotizacion(orgC, "Cliente C");

describe("cotizaciones en el portal (ADR-0053)", () => {
  it("el cliente ve la versión vigente de su cotización y descarga su PDF; la descarga queda registrada", async () => {
    await a.publicarOtra();
    const cookie = await ingresar(orgA.organizacionId, a.clienteId, "10.5.0.1");
    const lista = await portal(cookie, "/api/portal/cotizaciones");
    expect(lista.statusCode, lista.body).toBe(200);
    expect(lista.json().cotizaciones).toEqual([expect.objectContaining({ id: a.cotizacionId, numero: a.numero, version: 2, sitio: "Sede de Cliente A", programadaPara: "2026-10-28" })]);

    const pdf = await portal(cookie, `/api/portal/cotizaciones/${a.cotizacionId}/pdf`);
    expect(pdf.statusCode, pdf.body).toBe(200);
    const archivo = await fetch(pdf.json().url);
    expect(archivo.headers.get("content-disposition")).toMatch(/^attachment; filename=".*COT-\d{4}-\d{4}.*2\.pdf"/);
    expect(Buffer.from(await archivo.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");

    const { rows } = await s.propietario.pool.query(
      "select valor_nuevo from auditoria.registros where organizacion_id = $1 and tipo_evento = 'descarga_portal' order by hora_servidor desc limit 1",
      [orgA.organizacionId],
    );
    expect(rows[0].valor_nuevo).toEqual({ cotizacion: a.cotizacionId, numero: 2 });
  });

  it("cero accesos cruzados (QA-4): ni por la API, ni directo en la base con el rol del portal", async () => {
    const cookie = await ingresar(orgA.organizacionId, b.clienteId, "10.5.0.2");
    expect((await portal(cookie, "/api/portal/cotizaciones")).json().cotizaciones.map((x: { id: string }) => x.id)).toEqual([b.cotizacionId]);
    // La de otro cliente de la misma organización, o de otra organización, no existe para él aunque adivine el id.
    expect((await portal(cookie, `/api/portal/cotizaciones/${a.cotizacionId}/pdf`)).json()).toMatchObject({ codigo: "no_encontrado" });
    expect((await portal(cookie, `/api/portal/cotizaciones/${c.cotizacionId}/pdf`)).json()).toMatchObject({ codigo: "no_encontrado" });

    // La barrera no depende del código: con el rol del portal, la base solo devuelve lo del cliente fijado.
    const visibles = await enClienteDelPortal(s.conexionPortal.bd, orgA.organizacionId, b.clienteId, (tx) => tx.execute(sql`select cotizacion_id from cotizaciones.versiones`));
    expect(visibles.rows.map((f) => f.cotizacion_id)).toEqual([b.cotizacionId]);
    const sinCliente = await enOrganizacion(s.conexionPortal.bd, orgA.organizacionId, (tx) => tx.execute(sql`select cotizacion_id from cotizaciones.versiones`));
    expect(sinCliente.rows).toEqual([]);
    // El borrador, con sus precios de trabajo, no está al alcance del portal.
    const error = await s.conexionPortal.pool.query("select 1 from cotizaciones.cotizaciones limit 1").then(
      () => null,
      (e: Error) => e.message,
    );
    expect(error).toMatch(/permission denied/);
  });

  it("una versión retirada o con el PDF sin generar no se ve: queda la anterior, o ninguna", async () => {
    const cookie = await ingresar(orgC.organizacionId, c.clienteId, "10.5.0.3");
    await c.publicarOtra();
    expect((await portal(cookie, "/api/portal/cotizaciones")).json().cotizaciones).toEqual([expect.objectContaining({ id: c.cotizacionId, version: 2 })]);
    expect((await c.retirar(2)).statusCode).toBe(200);
    expect((await portal(cookie, "/api/portal/cotizaciones")).json().cotizaciones).toEqual([expect.objectContaining({ id: c.cotizacionId, version: 1 })]);

    // Mientras el PDF de la vigente se genera, el cliente ve la anterior: nunca un enlace a un PDF que no existe.
    await s.propietario.pool.query("update cotizaciones.versiones set pdf_estado = 'generando' where cotizacion_id = $1 and numero = 1", [c.cotizacionId]);
    expect((await portal(cookie, "/api/portal/cotizaciones")).json().cotizaciones).toEqual([]);
    expect((await portal(cookie, `/api/portal/cotizaciones/${c.cotizacionId}/pdf`)).json()).toMatchObject({ codigo: "no_encontrado" });
  });
});
