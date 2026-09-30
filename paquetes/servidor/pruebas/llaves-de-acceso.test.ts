import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { nuevoAutenticador, type Autenticador } from "./autenticador";
import { autenticacion, cookiesDe, iniciarSesion, nuevaOrganizacion, ORIGEN, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app, identidad, propietario } = s;
const organizacionId = await nuevaOrganizacion(propietario);
const contrasena = "contrasena-de-prueba";

async function nuevoTecnico() {
  const usuario = `tecnico.${randomBytes(4).toString("hex")}`;
  const { id } = await identidad.crearUsuario({ organizacionId, usuario, nombre: "Técnico de prueba", rol: "tecnico", contrasena });
  return { id, usuario, cookie: await iniciarSesion(app, usuario, contrasena) };
}

const unir = (...cookies: string[]) => cookies.filter(Boolean).join("; ");
const obtener = (url: string, cookie?: string) => app.inject({ method: "GET", url: `/api/auth${url}`, headers: { origin: ORIGEN, ...(cookie ? { cookie } : {}) } });

/** Registra una llave con la sesión dada, como lo haría el navegador. */
async function registrar(cookie: string, autenticador: Autenticador) {
  const opciones = await obtener("/passkey/generate-register-options", cookie);
  expect(opciones.statusCode, opciones.body).toBe(200);
  const r = await autenticacion(app, "/passkey/verify-registration", { response: autenticador.crear(opciones.json(), ORIGEN) }, unir(cookie, cookiesDe(opciones)));
  return { opciones: opciones.json(), respuesta: r };
}

/** Entra con la llave, sin usuario ni contraseña. Devuelve la respuesta de la verificación. */
async function entrar(autenticador: Autenticador, verificada = true) {
  const opciones = await obtener("/passkey/generate-authenticate-options");
  return autenticacion(app, "/passkey/verify-authentication", { response: autenticador.firmar(opciones.json(), ORIGEN, verificada) }, cookiesDe(opciones));
}

const eventos = async (usuarioId: string) =>
  (await propietario.pool.query("select tipo_evento from auditoria.registros where agregado_id = $1 order by secuencia", [usuarioId])).rows.map((f) => f.tipo_evento);

describe("llaves de acceso (iteración 13, ADR-0009)", () => {
  it("se registra con el usuario como nombre y exige verificar a la persona; con ella se entra sin contraseña", async () => {
    const t = await nuevoTecnico();
    const llave = nuevoAutenticador();
    const { opciones, respuesta } = await registrar(t.cookie, llave);
    // Lo que muestra el teléfono es el usuario, no el correo interno.
    expect(opciones.user.name).toBe(t.usuario);
    expect(opciones.rp).toEqual({ name: "TEINS", id: "localhost" });
    expect(opciones.authenticatorSelection).toMatchObject({ residentKey: "required", userVerification: "required" });
    expect(respuesta.statusCode, respuesta.body).toBe(200);
    expect(await eventos(t.id)).toContain("llave_de_acceso_creada");

    const entrada = await entrar(llave);
    expect(entrada.statusCode, entrada.body).toBe(200);
    const sesion = await app.inject({ method: "GET", url: "/api/sesion", headers: { cookie: cookiesDe(entrada) } });
    expect(sesion.json().usuario).toMatchObject({ id: t.id, rol: "tecnico" });
  });

  it("sin Face ID, huella ni PIN (solo un toque) no entra", async () => {
    const t = await nuevoTecnico();
    const llave = nuevoAutenticador();
    await registrar(t.cookie, llave);
    const entrada = await entrar(llave, false);
    expect(entrada.statusCode).toBe(401);
    expect(cookiesDe(entrada)).not.toMatch(/session_token/);
  });

  it("sin sesión no se registra una llave, y una persona no quita la llave de otra", async () => {
    expect((await obtener("/passkey/generate-register-options")).statusCode).toBe(401);
    const [a, b] = [await nuevoTecnico(), await nuevoTecnico()];
    await registrar(a.cookie, nuevoAutenticador());
    const [deA] = (await obtener("/passkey/list-user-passkeys", a.cookie)).json();
    expect((await autenticacion(app, "/passkey/delete-passkey", { id: deA.id }, b.cookie)).statusCode).not.toBe(200);
    expect(await obtener("/passkey/list-user-passkeys", a.cookie).then((r) => r.json())).toHaveLength(1);

    // Quitar la propia queda en la auditoría.
    expect((await autenticacion(app, "/passkey/delete-passkey", { id: deA.id }, a.cookie)).statusCode).toBe(200);
    expect(await eventos(a.id)).toContain("llave_de_acceso_quitada");
  });

  it("un usuario desactivado no entra con su llave; restablecer el acceso quita las llaves (teléfono perdido)", async () => {
    const desactivado = await nuevoTecnico();
    const suya = nuevoAutenticador();
    await registrar(desactivado.cookie, suya);
    await identidad.desactivarUsuario(desactivado.usuario, { autorId: "prueba", correlacion: "prueba" });
    expect((await entrar(suya)).statusCode).toBe(401);

    const restablecido = await nuevoTecnico();
    const perdida = nuevoAutenticador();
    await registrar(restablecido.cookie, perdida);
    await identidad.restablecerContrasena(restablecido.usuario, "otra-contrasena-de-prueba", { autorId: "administrador", correlacion: "prueba" });
    expect((await entrar(perdida)).statusCode).not.toBe(200);
  });
});
