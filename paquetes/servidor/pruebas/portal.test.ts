import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { llaveDeEnvio } from "@teins/protocolo";
import { enClienteDelPortal, enOrganizacion } from "../src/plataforma/base-de-datos";
import { verificarCadena } from "../src/modulos/auditoria";
import { clientesYSitios } from "../src/modulos/clientes";
import type { CorreoSaliente } from "../src/modulos/envios";
import { crearVisitas } from "../src/modulos/visitas";
import { cabecerasSync, ORIGEN, servidorDePrueba } from "./ayudas";
import { codigoDePrueba, conPortal } from "./portal-ayudas";

/*
  Acceso al portal por contacto, con código por correo (ADR-0053). Este archivo es el único que procesa los correos
  del portal: los guarda en `correos` para leer la invitación y el código.
*/
const correos: CorreoSaliente[] = [];
const s = await servidorDePrueba({
  correosDelPortal: async (c) => {
    correos.push(c);
    return { id: randomUUID() };
  },
});
const { app } = s;
const p = conPortal(s);
const visitas = crearVisitas(clientesYSitios);
const contexto = { autorId: "administrador", correlacion: "prueba-portal" };

type Org = Awaited<ReturnType<typeof s.nuevaOrganizacionConUsuarios>>;

/** Un cliente con un informe publicado (PDF listo) de una visita con un levantamiento revisado. */
async function clienteConInforme(org: Org, nombre: string) {
  const { clienteId, visitaId } = await enOrganizacion(s.conexionApp.bd, org.organizacionId, async (tx) => {
    const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre, sitio: { nombre: `Sede de ${nombre}`, direccion: "Calle [N]" } });
    const visitaId = await visitas.crear(tx, { organizacionId: org.organizacionId, ...contexto, clienteId, sitioId, motivo: "Mantenimiento", programadaPara: "2026-09-30", tecnicos: [org.tecnico.id] });
    return { clienteId, visitaId };
  });
  const id = randomUUID();
  const enviado = await app.inject({
    method: "POST",
    url: "/api/sync/comandos",
    headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
    payload: {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(id),
      levantamiento: { id, formato: "prueba-ups", versionFormato: 1, visitaId, respuestas: {}, creadoEn: "2026-09-30T10:00:00.000Z", enviadoEn: "2026-09-30T11:00:00.000Z" },
    },
  });
  expect(enviado.statusCode, enviado.body).toBe(200);
  const oficina = (url: string, payload: object) => app.inject({ method: "POST", url, headers: { cookie: org.oficina.cookie }, payload });
  await oficina(`/api/levantamientos/${id}/tomar`, { version: 1 });
  await oficina(`/api/levantamientos/${id}/marcar-revisado`, { version: 2 });
  const { id: informeId } = (await oficina("/api/informes", { visitaId })).json();
  await oficina(`/api/informes/${informeId}/borrador`, { version: 1, introduccion: `Informe de ${nombre}`, conclusiones: "", levantamientos: [id], planos: [] });
  expect((await oficina(`/api/informes/${informeId}/publicar`, { version: 2 })).statusCode).toBe(201);
  await s.esperarPdf({ organizacionId: org.organizacionId });
  return { clienteId, informeId, publicarOtra: () => oficina(`/api/informes/${informeId}/publicar`, { version: 3 }) };
}

/** Los correos del portal que llegaron a una dirección, procesando la cola hasta que haya `cuantos`. */
async function correosPara(para: string, cuantos: number): Promise<CorreoSaliente[]> {
  for (let i = 0; i < 60; i++) {
    await s.procesarCola();
    const suyos = correos.filter((c) => c.para === para);
    if (suyos.length >= cuantos) return suyos;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No llegaron ${cuantos} correos a ${para}`);
}

const orgA = await s.nuevaOrganizacionConUsuarios();
const [a, b] = [await clienteConInforme(orgA, "Cliente A"), await clienteConInforme(orgA, "Cliente B")];
const orgC = await s.nuevaOrganizacionConUsuarios();
const c = await clienteConInforme(orgC, "Cliente C");

describe("acceso al portal por contacto (ADR-0053)", () => {
  it("oficina da acceso a un contacto; le llega la invitación; entra con el código una sola vez y ve lo que recibe", async () => {
    const ana = await p.contacto(orgA, a.clienteId, { nombre: "Ana Rojas", correo: "ana.rojas@cliente-a.example", recibeInformes: true, recibeCotizaciones: false });
    const detalle = await p.darAcceso(orgA, a.clienteId, ana.id);
    expect(detalle.statusCode, detalle.body).toBe(200);
    expect(detalle.json().contactos.find((x: { id: string }) => x.id === ana.id).accesoPortal).toEqual({ activo: true, ultimoIngreso: null });
    const [invitacion] = await correosPara("ana.rojas@cliente-a.example", 1);
    expect(invitacion!.asunto).toMatch(/le dio acceso a sus informes$/);

    // Pedir el código responde sin decir nada y deja una cookie atada a este navegador por 10 minutos.
    const pedido = await p.pedir("  Ana.Rojas@Cliente-A.example ", "10.1.0.1");
    expect(pedido.statusCode).toBe(202);
    expect(pedido.json()).toEqual({});
    expect(String(pedido.headers["set-cookie"])).toMatch(/teins-portal-pendiente=[^;]+; Max-Age=600; Path=\/; HttpOnly; SameSite=Strict/);
    const [, correoDelCodigo] = await correosPara("ana.rojas@cliente-a.example", 2);
    const codigo = await codigoDePrueba(s, "ana.rojas@cliente-a.example");
    expect(correoDelCodigo!.asunto).toContain(`${codigo.slice(0, 3)} ${codigo.slice(3)}`);
    // El código no queda en la base: ni en el pedido ni en la cola.
    const guardado = JSON.stringify((await s.propietario.pool.query("select * from portal.pedidos")).rows);
    expect(guardado).not.toContain(codigo);

    const entrada = await p.entrar("ana.rojas@cliente-a.example", codigo, pedido, "10.1.0.1");
    expect(entrada.statusCode, entrada.body).toBe(200);
    expect(entrada.json()).toEqual({ cliente: "Cliente A", contacto: "Ana Rojas", ve: { informes: true, cotizaciones: false } });
    const cookie = p.sesionDe(entrada);
    expect((await p.leer(cookie, "/api/portal/informes")).json().informes.map((i: { id: string }) => i.id)).toEqual([a.informeId]);
    expect((await p.leer(cookie, "/api/portal/cotizaciones")).json()).toMatchObject({ codigo: "sin_permiso" });

    // Un solo uso.
    expect((await p.entrar("ana.rojas@cliente-a.example", codigo, pedido, "10.1.0.1")).statusCode).toBe(401);

    const despues = (await app.inject({ method: "GET", url: `/api/clientes/${a.clienteId}`, headers: { cookie: orgA.oficina.cookie } })).json();
    expect(despues.contactos.find((x: { id: string }) => x.id === ana.id).accesoPortal.ultimoIngreso).not.toBeNull();
    const eventos = await s.propietario.pool.query("select agregado_tipo, agregado_id, tipo_evento from auditoria.registros where organizacion_id = $1 and tipo_evento in ('acceso_portal_activado', 'ingreso_portal') order by hora_servidor", [orgA.organizacionId]);
    expect(eventos.rows.map((f) => f.tipo_evento)).toEqual(["acceso_portal_activado", "ingreso_portal"]);
    const ingreso = eventos.rows[1]!;
    expect(await enOrganizacion(s.conexionApp.bd, orgA.organizacionId, (tx) => verificarCadena(tx, orgA.organizacionId, ingreso.agregado_tipo, ingreso.agregado_id))).toMatchObject({ integra: true });
  });

  it("sin correo no hay acceso, y un correo tiene un solo acceso en la organización", async () => {
    const luis = await p.contacto(orgA, a.clienteId, { nombre: "Luis Ortiz", correo: null, recibeInformes: true, recibeCotizaciones: false });
    expect((await p.darAcceso(orgA, a.clienteId, luis.id)).json()).toMatchObject({ codigo: "entrada_invalida" });

    const enA = await p.contacto(orgA, a.clienteId, { nombre: "Compras A", correo: "compras@grupo.example", recibeInformes: false, recibeCotizaciones: true });
    const enB = await p.contacto(orgA, b.clienteId, { nombre: "Compras B", correo: "compras@grupo.example", recibeInformes: false, recibeCotizaciones: true });
    expect((await p.darAcceso(orgA, a.clienteId, enA.id)).statusCode).toBe(200);
    expect((await p.darAcceso(orgA, b.clienteId, enB.id)).json()).toMatchObject({ codigo: "conflicto" });
  });

  it("pedir el código responde lo mismo con o sin acceso, y sin acceso no envía nada", async () => {
    const sinAcceso = await p.pedir("nadie@cliente.example", "10.2.0.1");
    expect(sinAcceso.statusCode).toBe(202);
    expect(sinAcceso.json()).toEqual({});
    expect(String(sinAcceso.headers["set-cookie"])).toContain("teins-portal-pendiente=");
    await s.procesarCola();
    expect(correos.filter((x) => x.para === "nadie@cliente.example")).toEqual([]);
    expect((await p.entrar("nadie@cliente.example", "123456", sinAcceso, "10.2.0.1")).json()).toMatchObject({
      codigo: "no_autenticado",
      detail: "El código no es correcto o venció. Pida uno nuevo.",
    });
  });

  it("el código vence a los 10 minutos, se agota al quinto error, vale el último pedido y solo en el navegador que lo pidió", async () => {
    const marta = await p.contacto(orgA, b.clienteId, { nombre: "Marta Gil", correo: "marta@cliente-b.example", recibeInformes: true, recibeCotizaciones: true });
    await p.darAcceso(orgA, b.clienteId, marta.id);
    const correo = "marta@cliente-b.example";
    const mal = "El código no es correcto o venció. Pida uno nuevo.";

    // Vencido.
    const vencido = await p.pedir(correo, "10.3.0.1");
    const codigoVencido = await codigoDePrueba(s, correo);
    await s.propietario.pool.query("update portal.pedidos set expira_en = now() - interval '1 second'");
    expect((await p.entrar(correo, codigoVencido, vencido, "10.3.0.1")).json()).toMatchObject({ codigo: "no_autenticado", detail: mal });

    // Cinco errores agotan el código: el correcto ya no entra.
    const agotado = await p.pedir(correo, "10.3.0.2");
    const codigoAgotado = await codigoDePrueba(s, correo);
    const otro = codigoAgotado === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await p.entrar(correo, otro, agotado, "10.3.0.2")).statusCode).toBe(401);
    expect((await p.entrar(correo, codigoAgotado, agotado, "10.3.0.2")).json()).toMatchObject({ codigo: "no_autenticado", detail: mal });

    // Dos pedidos seguidos: solo vale el último.
    const primero = await p.pedir(correo, "10.3.0.3");
    const codigoPrimero = await codigoDePrueba(s, correo);
    const segundo = await p.pedir(correo, "10.3.0.3");
    const codigoSegundo = await codigoDePrueba(s, correo);
    expect((await p.entrar(correo, codigoPrimero, primero, "10.3.0.3")).statusCode).toBe(401);

    // El código del último pedido no entra sin la cookie del navegador que lo pidió, ni con la de otro.
    expect((await p.entrar(correo, codigoSegundo, null, "10.3.0.4")).statusCode).toBe(401);
    expect((await p.entrar(correo, codigoSegundo, primero, "10.3.0.4")).statusCode).toBe(401);
    expect((await p.entrar(correo, codigoSegundo, segundo, "10.3.0.3")).statusCode).toBe(200);
  });

  it("intentos simultáneos con un mismo código no pasan de cinco: cada uno cuenta antes de comparar (QA-7)", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const g = await clienteConInforme(org, "Cliente G");
    const gina = await p.contacto(org, g.clienteId, { nombre: "Gina", correo: "gina@cliente-g.example", recibeInformes: true, recibeCotizaciones: false });
    await p.darAcceso(org, g.clienteId, gina.id);
    const pedido = await p.pedir("gina@cliente-g.example", "10.4.0.1");
    const codigo = await codigoDePrueba(s, "gina@cliente-g.example");
    const otro = codigo === "000000" ? "111111" : "000000";
    await Promise.all(Array.from({ length: 30 }, (_, i) => p.entrar("gina@cliente-g.example", otro, pedido, `10.4.1.${i + 1}`)));
    expect((await p.entrar("gina@cliente-g.example", codigo, pedido, "10.4.0.1")).statusCode).toBe(401);
  });

  it("límites (QA-7): cinco pedidos por correo y veinte intentos fallidos por origen", async () => {
    for (let i = 0; i < 5; i++) expect((await p.pedir("limite@cliente.example", `10.5.0.${i + 1}`)).statusCode).toBe(202);
    const sexto = await p.pedir("limite@cliente.example", "10.5.0.9");
    expect(sexto.statusCode).toBe(429);
    expect(sexto.json().reintentarEnSegundos).toBeGreaterThan(50);

    const ip = "10.5.1.1";
    const pendiente = await p.pedir("origen@cliente.example", ip);
    for (let i = 0; i < 20; i++) expect((await p.entrar(`origen${i}@cliente.example`, "123456", pendiente, ip)).statusCode).toBe(401);
    expect((await p.entrar("origen@cliente.example", "123456", pendiente, ip)).statusCode).toBe(429);
  });

  it("quitar el acceso, quitar el contacto, cambiarle el correo o archivar el cliente cierran su sesión", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const { clienteId } = await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) =>
      clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre: "Cliente D", sitio: { nombre: "Sede", direccion: "Calle [N]" } }),
    );
    const nuevo = async (nombre: string) => {
      const x = await p.contacto(org, clienteId, { nombre, correo: `${nombre.toLowerCase()}@cliente-d.example`, recibeInformes: true, recibeCotizaciones: true });
      expect((await p.darAcceso(org, clienteId, x.id)).statusCode).toBe(200);
      return { ...x, sesion: await p.entrarCompleto(`${nombre.toLowerCase()}@cliente-d.example`, `10.6.${x.id.charCodeAt(0)}.1`) };
    };
    const [uno, dos, tres] = [await nuevo("Uno"), await nuevo("Dos"), await nuevo("Tres")];
    const oficina = (url: string, payload: object = {}) => app.inject({ method: "POST", url, headers: { cookie: org.oficina.cookie, origin: ORIGEN }, payload });

    const invitacionesAntes = correos.filter((x) => x.para === "uno@cliente-d.example").length;
    expect((await oficina(`/api/clientes/${clienteId}/contactos/${uno.id}/portal`, { activo: false })).statusCode).toBe(200);
    expect((await p.leer(uno.sesion, "/api/portal/sesion")).statusCode).toBe(401);
    // «Deshacer»: vuelve sin otra invitación.
    expect((await oficina(`/api/clientes/${clienteId}/contactos/${uno.id}/portal`, { activo: true, invitar: false })).statusCode).toBe(200);
    await s.procesarCola();
    expect(correos.filter((x) => x.para === "uno@cliente-d.example")).toHaveLength(invitacionesAntes);

    expect((await oficina(`/api/clientes/${clienteId}/contactos/${dos.id}/quitar`)).statusCode).toBe(200);
    expect((await p.leer(dos.sesion, "/api/portal/sesion")).statusCode).toBe(401);

    const editado = await oficina(`/api/clientes/${clienteId}/contactos/${tres.id}`, { nombre: "Tres", correo: "otra@cliente-d.example", recibeCorreo: true, recibeWhatsapp: false, recibeInformes: true, recibeCotizaciones: true });
    expect(editado.statusCode, editado.body).toBe(200);
    expect((await p.leer(tres.sesion, "/api/portal/sesion")).statusCode).toBe(401);
    // Sigue con acceso, con el correo nuevo.
    expect(editado.json().contactos.find((x: { id: string }) => x.id === tres.id).accesoPortal.activo).toBe(true);
    const conElNuevo = await p.entrarCompleto("otra@cliente-d.example", "10.6.9.1");

    expect((await oficina(`/api/clientes/${clienteId}/archivar`)).statusCode).toBe(200);
    expect((await p.leer(conElNuevo, "/api/portal/sesion")).statusCode).toBe(401);
    const { rows } = await s.propietario.pool.query("select count(*)::int as n from portal.accesos where cliente_id = $1", [clienteId]);
    expect(rows[0].n).toBe(0);
  });

  it("deja de ver lo que deja de recibir: sin «Recibe cotizaciones», el portal no se las muestra", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const e = await clienteConInforme(org, "Cliente E");
    const eva = await p.contacto(org, e.clienteId, { nombre: "Eva", correo: "eva@cliente-e.example", recibeInformes: true, recibeCotizaciones: true });
    await p.darAcceso(org, e.clienteId, eva.id);
    const cookie = await p.entrarCompleto("eva@cliente-e.example", "10.7.0.1");
    expect((await p.leer(cookie, "/api/portal/cotizaciones")).statusCode).toBe(200);
    const editado = await app.inject({
      method: "POST",
      url: `/api/clientes/${e.clienteId}/contactos/${eva.id}`,
      headers: { cookie: org.oficina.cookie, origin: ORIGEN },
      payload: { nombre: "Eva", correo: "eva@cliente-e.example", recibeCorreo: true, recibeWhatsapp: false, recibeInformes: true, recibeCotizaciones: false },
    });
    expect(editado.statusCode, editado.body).toBe(200);
    expect((await p.leer(cookie, "/api/portal/cotizaciones")).json()).toMatchObject({ codigo: "sin_permiso" });
    expect((await p.leer(cookie, "/api/portal/sesion")).json().ve).toEqual({ informes: true, cotizaciones: false });
  });

  it("cero accesos cruzados (QA-4): ni por la API, ni directo en la base con el rol del portal", async () => {
    const bea = await p.contacto(orgA, b.clienteId, { nombre: "Bea", correo: "bea@cliente-b.example", recibeInformes: true, recibeCotizaciones: false });
    await p.darAcceso(orgA, b.clienteId, bea.id);
    const cookie = await p.entrarCompleto("bea@cliente-b.example", "10.8.0.1");
    expect((await p.leer(cookie, "/api/portal/informes")).json().informes.map((i: { id: string }) => i.id)).toEqual([b.informeId]);
    expect((await p.leer(cookie, `/api/portal/informes/${a.informeId}/pdf`)).json()).toMatchObject({ codigo: "no_encontrado" });
    expect((await p.leer(cookie, `/api/portal/informes/${c.informeId}/pdf`)).json()).toMatchObject({ codigo: "no_encontrado" });

    const visibles = await enClienteDelPortal(s.conexionPortal.bd, orgA.organizacionId, b.clienteId, (tx) => tx.execute(sql`select informe_id from informes.versiones`));
    expect(visibles.rows.map((f) => f.informe_id)).toEqual([b.informeId]);
    const sinCliente = await enOrganizacion(s.conexionPortal.bd, orgA.organizacionId, (tx) => tx.execute(sql`select informe_id from informes.versiones`));
    expect(sinCliente.rows).toEqual([]);
    const auditoria = await enOrganizacion(s.conexionPortal.bd, orgA.organizacionId, (tx) => tx.execute(sql`select distinct agregado_tipo from auditoria.registros`));
    expect(auditoria.rows.map((f) => f.agregado_tipo)).toEqual(["acceso_cliente"]);
    for (const tabla of ["levantamientos.levantamientos", "identidad.usuarios", "clientes.clientes", "clientes.contactos", "informes.informes", "visitas.visitas"]) {
      const error = await s.conexionPortal.pool.query(`select 1 from ${tabla} limit 1`).then(
        () => null,
        (e: Error) => e.message,
      );
      expect(error, tabla).toMatch(/permission denied/);
    }
  });

  it("el portal muestra el nombre vigente del cliente y del contacto, también en la sesión abierta", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const { clienteId } = await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) =>
      clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre: "Clinica Santafe", sitio: { nombre: "Sede", direccion: "Calle [N]" } }),
    );
    const sara = await p.contacto(org, clienteId, { nombre: "Sara", correo: "sara@santafe.example", recibeInformes: true, recibeCotizaciones: false });
    await p.darAcceso(org, clienteId, sara.id);
    const cookie = await p.entrarCompleto("sara@santafe.example", "10.9.0.1");
    expect((await p.leer(cookie, "/api/portal/sesion")).json()).toMatchObject({ cliente: "Clinica Santafe", contacto: "Sara" });

    const oficina = (url: string, payload: object) => app.inject({ method: "POST", url, headers: { cookie: org.oficina.cookie, origin: ORIGEN }, payload });
    expect((await oficina(`/api/clientes/${clienteId}`, { nombre: "Clínica Santa Fe" })).statusCode).toBe(200);
    expect((await oficina(`/api/clientes/${clienteId}/contactos/${sara.id}`, { nombre: "Sara Díaz", correo: "sara@santafe.example", recibeCorreo: true, recibeWhatsapp: false, recibeInformes: true, recibeCotizaciones: false })).statusCode).toBe(200);
    expect((await p.leer(cookie, "/api/portal/sesion")).json()).toMatchObject({ cliente: "Clínica Santa Fe", contacto: "Sara Díaz" });
  });

  it("cada uso renueva la cookie: la sesión vence 30 minutos después del último uso; salir la cierra; la de oficina no sirve", async () => {
    const fito = await p.contacto(orgC, c.clienteId, { nombre: "Fito", correo: "fito@cliente-c.example", recibeInformes: true, recibeCotizaciones: false });
    await p.darAcceso(orgC, c.clienteId, fito.id);
    const cookie = await p.entrarCompleto("fito@cliente-c.example", "10.10.0.1");
    expect(String((await p.leer(cookie, "/api/portal/sesion")).headers["set-cookie"])).toMatch(/Max-Age=1800; Path=\/; HttpOnly/);
    expect((await p.leer(orgC.oficina.cookie, "/api/portal/informes")).statusCode).toBe(401);
    const salida = await app.inject({ method: "POST", url: "/api/portal/salir", headers: { cookie, origin: p.ORIGEN_PORTAL } });
    expect(String(salida.headers["set-cookie"])).toContain("Max-Age=0");
    expect((await p.leer(cookie, "/api/portal/informes")).statusCode).toBe(401);
  });

  it("una versión retirada deja de verse en el portal; mientras el PDF de la nueva se genera, se ve la anterior", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const admin = await s.nuevoAdministrador(org.organizacionId);
    const f = await clienteConInforme(org, "Cliente F");
    const flor = await p.contacto(org, f.clienteId, { nombre: "Flor", correo: "flor@cliente-f.example", recibeInformes: true, recibeCotizaciones: false });
    await p.darAcceso(org, f.clienteId, flor.id);
    const cookie = await p.entrarCompleto("flor@cliente-f.example", "10.11.0.1");

    expect((await f.publicarOtra()).statusCode).toBe(201);
    expect((await p.leer(cookie, "/api/portal/informes")).json().informes[0].numero).toBe(1);
    await s.esperarPdf({ organizacionId: org.organizacionId });
    expect((await p.leer(cookie, "/api/portal/informes")).json().informes[0].numero).toBe(2);

    const retirar = (numero: number) =>
      app.inject({ method: "POST", url: `/api/informes/${f.informeId}/versiones/${numero}/retirar`, headers: { cookie: admin.cookie, origin: ORIGEN }, payload: { motivo: "Datos del equipo equivocados" } });
    expect((await retirar(2)).statusCode).toBe(200);
    expect((await p.leer(cookie, "/api/portal/informes")).json().informes[0].numero).toBe(1);
    expect((await retirar(1)).statusCode).toBe(200);
    expect((await p.leer(cookie, "/api/portal/informes")).json().informes).toEqual([]);
    expect((await p.leer(cookie, `/api/portal/informes/${f.informeId}/pdf`)).json().codigo).toBe("no_encontrado");
  });
});
