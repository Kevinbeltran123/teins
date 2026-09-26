import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { llaveDeEnvio } from "@teins/protocolo";
import { enClienteDelPortal, enOrganizacion } from "../src/plataforma/base-de-datos";
import { verificarCadena } from "../src/modulos/auditoria";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearAccesosDeClientes } from "../src/modulos/portal";
import { crearVisitas } from "../src/modulos/visitas";
import { cabecerasSync, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;
const visitas = crearVisitas(clientesYSitios);
const accesos = crearAccesosDeClientes(s.conexionApp.bd);
const contexto = { autorId: "administrador", correlacion: "prueba-portal" };
const PORTAL = "http://localhost:5175";

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
  await hastaQueNoHayaPdfPendientes(org.organizacionId);
  return { clienteId, informeId, publicarOtra: () => oficina(`/api/informes/${informeId}/publicar`, { version: 3 }) };
}

const hastaQueNoHayaPdfPendientes = (organizacionId: string) => s.esperarPdf({ organizacionId });

const ingresar = (identificador: string, clave: string, ip = "10.1.1.1") =>
  app.inject({ method: "POST", url: "/api/portal/ingresar", remoteAddress: ip, headers: { origin: PORTAL }, payload: { identificador, clave } });
const cookieDe = (r: { headers: Record<string, unknown> }) => String(r.headers["set-cookie"]).split(";")[0]!;
const portal = (cookie: string, url: string) => app.inject({ method: "GET", url, headers: { cookie } });

// Una organización con dos clientes y otra organización con un tercero: todos con informe publicado.
const orgA = await s.nuevaOrganizacionConUsuarios();
const [a, b] = [await clienteConInforme(orgA, "Cliente A"), await clienteConInforme(orgA, "Cliente B")];
const orgC = await s.nuevaOrganizacionConUsuarios();
const c = await clienteConInforme(orgC, "Cliente C");

describe("portal del cliente (ADR-0009, parte 4)", () => {
  it("con el identificador del QR y la clave ve su informe vigente y descarga el PDF; queda registrado", async () => {
    const credenciales = await accesos.crear(orgA.organizacionId, a.clienteId, contexto);
    expect(credenciales.clave).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    // La clave se puede escribir en minúsculas y sin guiones.
    const r = await ingresar(credenciales.identificador, credenciales.clave.toLowerCase().replaceAll("-", ""));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ cliente: "Cliente A" });
    expect(String(r.headers["set-cookie"])).toMatch(/HttpOnly; SameSite=Strict/);
    const cookie = cookieDe(r);

    const informes = (await portal(cookie, "/api/portal/informes")).json();
    expect(informes).toMatchObject({ cliente: "Cliente A", informes: [{ id: a.informeId, numero: 1, sitio: "Sede de Cliente A", programadaPara: "2026-09-30" }] });
    const pdf = await portal(cookie, `/api/portal/informes/${a.informeId}/pdf`);
    expect(pdf.statusCode).toBe(200);
    const bytes = Buffer.from(await (await fetch(pdf.json().url)).arrayBuffer());
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

    const { rows } = await s.propietario.pool.query(
      "select tipo_evento from auditoria.registros where organizacion_id = $1 and agregado_tipo = 'acceso_cliente' order by secuencia",
      [orgA.organizacionId],
    );
    expect(rows.map((f) => f.tipo_evento)).toEqual(["acceso_cliente_creado", "ingreso_portal", "descarga_portal"]);
    const [{ agregado_id }] = (await s.propietario.pool.query("select agregado_id from auditoria.registros where tipo_evento = 'ingreso_portal' and organizacion_id = $1", [orgA.organizacionId])).rows;
    expect(await enOrganizacion(s.conexionApp.bd, orgA.organizacionId, (tx) => verificarCadena(tx, orgA.organizacionId, "acceso_cliente", agregado_id))).toMatchObject({ integra: true });

    // La clave nunca se guarda: solo su hash.
    const guardado = (await s.propietario.pool.query("select clave_hash from portal.accesos where cliente_id = $1", [a.clienteId])).rows[0].clave_hash as string;
    expect(guardado).toMatch(/^scrypt\$/);
    expect(guardado).not.toContain(credenciales.clave.replaceAll("-", ""));
  });

  it("cero accesos cruzados (QA-4): ni por la API, ni directo en la base con el rol del portal", async () => {
    const credenciales = await accesos.crear(orgA.organizacionId, b.clienteId, contexto);
    const cookie = cookieDe(await ingresar(credenciales.identificador, credenciales.clave, "10.1.1.2"));
    expect((await portal(cookie, "/api/portal/informes")).json().informes.map((i: { id: string }) => i.id)).toEqual([b.informeId]);
    // El informe de otro cliente de la misma organización, o de otra organización, no existe para él.
    expect((await portal(cookie, `/api/portal/informes/${a.informeId}/pdf`)).json()).toMatchObject({ codigo: "no_encontrado" });
    expect((await portal(cookie, `/api/portal/informes/${c.informeId}/pdf`)).json()).toMatchObject({ codigo: "no_encontrado" });

    // La barrera no depende del código: con el rol del portal, la base solo devuelve lo del cliente fijado.
    const visibles = await enClienteDelPortal(s.conexionPortal.bd, orgA.organizacionId, b.clienteId, (tx) => tx.execute(sql`select informe_id from informes.versiones`));
    expect(visibles.rows.map((f) => f.informe_id)).toEqual([b.informeId]);
    const sinCliente = await enOrganizacion(s.conexionPortal.bd, orgA.organizacionId, (tx) => tx.execute(sql`select informe_id from informes.versiones`));
    expect(sinCliente.rows).toEqual([]);
    for (const tabla of ["levantamientos.levantamientos", "identidad.usuarios", "clientes.clientes", "informes.informes", "visitas.visitas"]) {
      const error = await s.conexionPortal.pool.query(`select 1 from ${tabla} limit 1`).then(
        () => null,
        (e: Error) => e.message,
      );
      expect(error, tabla).toMatch(/permission denied/);
    }
  });

  it("los intentos fallidos bloquean con espera creciente por identificador y por origen (QA-7)", async () => {
    const credenciales = await accesos.crear(orgC.organizacionId, c.clienteId, contexto);
    for (let i = 0; i < 5; i++) expect((await ingresar(credenciales.identificador, "AAAA-AAAA-AAAA", "10.2.0.1")).statusCode).toBe(401);
    // Bloqueado: ni la clave correcta entra mientras dura la espera.
    const bloqueado = await ingresar(credenciales.identificador, credenciales.clave, "10.2.0.2");
    expect(bloqueado.statusCode).toBe(429);
    expect(bloqueado.json().reintentarEnSegundos).toBeGreaterThan(50);

    // Desde un mismo origen, veinte fallos con identificadores cualquiera también bloquean.
    const ip = "10.3.0.1";
    for (let i = 0; i < 20; i++) expect((await ingresar("abcdefghjkmnpqrstuvw".slice(0, 19) + "xyz23456789"[i % 11], "AAAA", ip)).statusCode).toBe(401);
    expect((await ingresar("zzzzzzzzzzzzzzzzzzzz", "AAAA", ip)).statusCode).toBe(429);
    // Un identificador inexistente responde igual que una clave equivocada.
    expect((await ingresar("zzzzzzzzzzzzzzzzzzzz", "AAAA", "10.4.0.1")).json()).toMatchObject({ codigo: "no_autenticado", detail: "El identificador o la clave no son correctos" });
  });

  it("regenerar invalida el identificador anterior, la clave y las sesiones abiertas", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const d = await clienteConInforme(org, "Cliente D");
    const anteriores = await accesos.crear(org.organizacionId, d.clienteId, contexto);
    const cookie = cookieDe(await ingresar(anteriores.identificador, anteriores.clave, "10.5.0.1"));
    expect((await portal(cookie, "/api/portal/sesion")).json()).toEqual({ cliente: "Cliente D" });

    const nuevas = await accesos.regenerar(org.organizacionId, d.clienteId, contexto);
    expect((await portal(cookie, "/api/portal/sesion")).statusCode).toBe(401);
    expect((await ingresar(anteriores.identificador, anteriores.clave, "10.5.0.2")).statusCode).toBe(401);
    expect((await ingresar(nuevas.identificador, nuevas.clave, "10.5.0.3")).statusCode).toBe(200);
  });

  it("muestra la versión vigente con PDF listo; salir cierra la sesión; la cookie de oficina no sirve aquí", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const e = await clienteConInforme(org, "Cliente E");
    const credenciales = await accesos.crear(org.organizacionId, e.clienteId, contexto);
    const cookie = cookieDe(await ingresar(credenciales.identificador, credenciales.clave, "10.6.0.1"));

    expect((await e.publicarOtra()).statusCode).toBe(201);
    // Mientras el PDF de la versión 2 se genera, el cliente sigue viendo la 1 (ADR-0013).
    expect((await portal(cookie, "/api/portal/informes")).json().informes[0].numero).toBe(1);
    await hastaQueNoHayaPdfPendientes(org.organizacionId);
    expect((await portal(cookie, "/api/portal/informes")).json().informes[0].numero).toBe(2);

    expect((await portal(org.oficina.cookie, "/api/portal/informes")).statusCode).toBe(401);
    const salida = await app.inject({ method: "POST", url: "/api/portal/salir", headers: { cookie, origin: PORTAL } });
    expect(String(salida.headers["set-cookie"])).toContain("Max-Age=0");
    expect((await portal(cookie, "/api/portal/informes")).statusCode).toBe(401);
  });

  it("una versión retirada deja de verse en el portal, se conserva para oficina y queda registrada (iteración 6)", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const admin = await s.nuevoAdministrador(org.organizacionId);
    const f = await clienteConInforme(org, "Cliente F");
    expect((await f.publicarOtra()).statusCode).toBe(201);
    await hastaQueNoHayaPdfPendientes(org.organizacionId);
    const credenciales = await accesos.crear(org.organizacionId, f.clienteId, contexto);
    const cookie = cookieDe(await ingresar(credenciales.identificador, credenciales.clave, "10.7.0.1"));
    expect((await portal(cookie, "/api/portal/informes")).json().informes[0].numero).toBe(2);

    const retirar = (quien: string, numero: number) =>
      app.inject({ method: "POST", url: `/api/informes/${f.informeId}/versiones/${numero}/retirar`, headers: { cookie: quien, origin: PORTAL }, payload: { motivo: "Datos del equipo equivocados" } });
    expect((await retirar(org.oficina.cookie, 2)).json().codigo).toBe("sin_permiso");
    const retirada = await retirar(admin.cookie, 2);
    expect(retirada.statusCode, retirada.body).toBe(200);
    expect(retirada.json()).toMatchObject({ numero: 2, retirada: { por: { id: admin.id }, motivo: "Datos del equipo equivocados" } });
    expect((await retirar(admin.cookie, 2)).json().codigo).toBe("estado_invalido");

    // El cliente vuelve a ver la versión anterior; si se retiran todas, el informe desaparece del portal.
    expect((await portal(cookie, "/api/portal/informes")).json().informes[0].numero).toBe(1);
    expect((await retirar(admin.cookie, 1)).statusCode).toBe(200);
    expect((await portal(cookie, "/api/portal/informes")).json().informes).toEqual([]);
    expect((await portal(cookie, `/api/portal/informes/${f.informeId}/pdf`)).json().codigo).toBe("no_encontrado");

    const detalle = (await app.inject({ method: "GET", url: `/api/informes/${f.informeId}`, headers: { cookie: org.oficina.cookie } })).json();
    expect(detalle.versiones.map((v: { retirada: unknown }) => v.retirada !== null)).toEqual([true, true]);
    const { rows } = await s.propietario.pool.query("select motivo from auditoria.registros where tipo_evento = 'version_retirada' and agregado_id = $1", [f.informeId]);
    expect(rows).toHaveLength(2);

    // Retirar no abre la copia congelada: la aplicación sigue sin poder escribirla.
    const error = await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => tx.execute(sql`update informes.versiones set contenido = '{}'::jsonb`)).then(
      () => null,
      (e: Error) => String((e as { cause?: Error }).cause?.message ?? e.message),
    );
    expect(error).toMatch(/permission denied/);
  });
});
