import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { verificarCadena } from "../src/modulos/auditoria";
import { clientesYSitios } from "../src/modulos/clientes";
import { autenticacion, cabecerasSync, cookiesDe, iniciarSesion, ORIGEN, servidorDePrueba } from "./ayudas";
import { codigoTotp } from "./totp";

const s = await servidorDePrueba();
const { app } = s;

const pedir = (cookie: string, method: "GET" | "POST", url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });

const org = await s.nuevaOrganizacionConUsuarios();
const admin = await s.nuevoAdministrador(org.organizacionId);

describe("segundo factor obligatorio para administrar (ADR-0009)", () => {
  it("con la marca y sin segundo factor no administra; lo activa y desde entonces el ingreso pide el código", async () => {
    const usuario = `admin.${randomUUID().slice(0, 8)}`;
    const contrasena = "contrasena-de-prueba";
    await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre: "Nueva administradora", rol: "oficina", contrasena });
    await s.identidad.marcarAdministrador(usuario, true, { autorId: "administrador", correlacion: "prueba" });

    const sinFactor = await iniciarSesion(app, usuario, contrasena);
    const otraSinFactor = await iniciarSesion(app, usuario, contrasena);
    const negado = await pedir(sinFactor, "GET", "/api/administracion/usuarios");
    expect(negado.statusCode).toBe(403);
    expect(negado.json().codigo).toBe("segundo_factor_requerido");
    expect((await pedir(sinFactor, "GET", "/api/sesion")).json().usuario).toMatchObject({ administrador: true, segundoFactor: false });

    // Activar: la contraseña otra vez, el URI para la app autenticadora y un código que lo confirme.
    const activado = await autenticacion(app, "/two-factor/enable", { password: contrasena }, sinFactor);
    expect(activado.statusCode, activado.body).toBe(200);
    const { totpURI, backupCodes } = activado.json();
    expect(totpURI).toMatch(/^otpauth:\/\/totp\/TEINS:/);
    expect(backupCodes.length).toBeGreaterThan(0);
    // Sin confirmar con un código, todavía no cuenta.
    expect((await pedir(sinFactor, "GET", "/api/administracion/usuarios")).statusCode).toBe(403);
    expect((await autenticacion(app, "/two-factor/verify-totp", { code: "000000" }, sinFactor)).statusCode).toBe(401);
    const confirmado = await autenticacion(app, "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, sinFactor);
    expect(confirmado.statusCode, confirmado.body).toBe(200);
    expect((await pedir(cookiesDe(confirmado), "GET", "/api/administracion/usuarios")).statusCode).toBe(200);
    // Las sesiones abiertas solo con contraseña antes de activarlo se cierran: nunca administran sin código.
    expect((await pedir(otraSinFactor, "GET", "/api/administracion/usuarios")).statusCode).toBe(401);

    // El siguiente ingreso no da sesión con la sola contraseña.
    const ingreso = await autenticacion(app, "/sign-in/username", { username: usuario, password: contrasena });
    expect(ingreso.json()).toMatchObject({ twoFactorRedirect: true, twoFactorMethods: ["totp"] });
    const desafio = cookiesDe(ingreso);
    expect(desafio).not.toMatch(/session_token/);
    expect((await pedir(desafio, "GET", "/api/sesion")).statusCode).toBe(401);
    const conCodigo = await autenticacion(app, "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, desafio);
    expect(conCodigo.statusCode, conCodigo.body).toBe(200);
    expect((await pedir(cookiesDe(conCodigo), "GET", "/api/sesion")).json().usuario).toMatchObject({ administrador: true, segundoFactor: true });

    // Activarlo es un evento de seguridad en la cadena del usuario; verificar un ingreso no lo repite.
    const { rows } = await s.propietario.pool.query(
      "select r.tipo_evento from auditoria.registros r join identidad.usuarios u on u.id = r.agregado_id where u.usuario = $1 order by r.secuencia",
      [usuario],
    );
    expect(rows.map((f) => f.tipo_evento)).toEqual(["administrador_cambiado", "segundo_factor_activado"]);

    // Ingresos: los dos de solo contraseña (aún sin factor) y el que pasó el código. Ni el paso de la
    // contraseña con el factor activo ni la rotación al activarlo cuentan como ingreso.
    const { rows: ingresos } = await s.propietario.pool.query(
      "select count(*)::int as n from auditoria.registros r join identidad.usuarios u on u.id = r.autor_id where u.usuario = $1 and r.tipo_evento = 'inicio_de_sesion'",
      [usuario],
    );
    expect(ingresos[0].n).toBe(3);
  });

  it("activarlo con la sesión abierta no es un ingreso, aunque el navegador traiga una cookie que nombre la del desafío", async () => {
    const usuario = `admin.${randomUUID().slice(0, 8)}`;
    const contrasena = "contrasena-de-prueba";
    await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre: "Otra administradora", rol: "oficina", contrasena });
    await s.identidad.marcarAdministrador(usuario, true, { autorId: "administrador", correlacion: "prueba" });
    const sesion = await iniciarSesion(app, usuario, contrasena);
    const { totpURI } = (await autenticacion(app, "/two-factor/enable", { password: contrasena }, sesion)).json();
    const confirmado = await autenticacion(app, "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, `${sesion}; preferencias=teins.two_factor`);
    expect(confirmado.statusCode, confirmado.body).toBe(200);

    const { rows } = await s.propietario.pool.query(
      "select count(*)::int as n from auditoria.registros r join identidad.usuarios u on u.id = r.autor_id where u.usuario = $1 and r.tipo_evento = 'inicio_de_sesion'",
      [usuario],
    );
    expect(rows[0].n).toBe(1);
  });

  it("sin la marca de administrador no se administra, y un técnico no puede activar el segundo factor", async () => {
    for (const cookie of [org.oficina.cookie, org.tecnico.cookie]) {
      const r = await pedir(cookie, "GET", "/api/administracion/usuarios");
      expect(r.statusCode).toBe(403);
      expect(r.json().codigo).toBe("sin_permiso");
    }
    const tecnico = await autenticacion(app, "/two-factor/enable", { password: "contrasena-de-prueba" }, org.tecnico.cookie);
    expect(tecnico.statusCode).toBe(403);
  });
});

describe("usuarios (iteración 6)", () => {
  it("crea con contraseña temporal que sirve una vez mostrada; no repite el nombre de usuario", async () => {
    const usuario = `ana.${randomUUID().slice(0, 8)}`;
    const r = await pedir(admin.cookie, "POST", "/api/administracion/usuarios", { usuario, nombre: "Ana Prueba", rol: "tecnico" });
    expect(r.statusCode, r.body).toBe(201);
    const { usuario: creado, contrasena } = r.json();
    expect(creado).toMatchObject({ usuario, nombre: "Ana Prueba", rol: "tecnico", administrador: false, desactivadoEn: null });
    expect(contrasena.length).toBeGreaterThanOrEqual(16);
    await iniciarSesion(app, usuario, contrasena);

    const repetido = await pedir(admin.cookie, "POST", "/api/administracion/usuarios", { usuario, nombre: "Otra", rol: "oficina" });
    expect(repetido.json().codigo).toBe("conflicto");

    const lista = (await pedir(admin.cookie, "GET", "/api/administracion/usuarios")).json().usuarios;
    expect(lista.map((u: { usuario: string }) => u.usuario)).toContain(usuario);
    // Solo los de su organización.
    const otra = await s.nuevaOrganizacionConUsuarios();
    expect(lista.map((u: { id: string }) => u.id)).not.toContain(otra.tecnico.id);
    expect((await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${otra.tecnico.id}/desactivar`)).statusCode).toBe(404);

    const cadena = await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => verificarCadena(tx, org.organizacionId, "usuario", creado.id));
    expect(cadena).toEqual({ integra: true, eslabones: 1 });
  });

  it("un usuario con guion, permitido al crearlo, también inicia sesión", async () => {
    const usuario = `ana-${randomUUID().slice(0, 8)}`;
    const r = await pedir(admin.cookie, "POST", "/api/administracion/usuarios", { usuario, nombre: "Ana Guion", rol: "tecnico" });
    expect(r.statusCode, r.body).toBe(201);
    await iniciarSesion(app, usuario, r.json().contrasena);
  });

  it("restablecer también quita el segundo factor: quien perdió su autenticador vuelve a entrar y lo activa de nuevo", async () => {
    const otro = await s.nuevoAdministrador(org.organizacionId);
    const r = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${otro.id}/restablecer-contrasena`);
    expect(r.statusCode, r.body).toBe(200);
    const ingreso = await autenticacion(app, "/sign-in/username", { username: otro.usuario, password: r.json().contrasena });
    expect(ingreso.json()).not.toHaveProperty("twoFactorRedirect");
    expect((await pedir(cookiesDe(ingreso), "GET", "/api/sesion")).json().usuario).toMatchObject({ segundoFactor: false });
    const { rows } = await s.propietario.pool.query("select valor_nuevo from auditoria.registros where agregado_id = $1 and tipo_evento = 'contrasena_restablecida'", [otro.id]);
    expect(rows).toEqual([{ valor_nuevo: { llavesQuitadas: 0, segundoFactorQuitado: true, temporal: true } }]);
  });

  it("restablecer da una contraseña nueva y cierra las sesiones; desactivar revoca y no se aplica a sí mismo", async () => {
    const usuario = `luis.${randomUUID().slice(0, 8)}`;
    const { usuario: creado, contrasena } = (await pedir(admin.cookie, "POST", "/api/administracion/usuarios", { usuario, nombre: "Luis Prueba", rol: "oficina" })).json();
    const sesion = await iniciarSesion(app, usuario, contrasena);

    const r = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${creado.id}/restablecer-contrasena`);
    expect(r.statusCode, r.body).toBe(200);
    expect((await pedir(sesion, "GET", "/api/sesion")).statusCode).toBe(401);
    await expect(iniciarSesion(app, usuario, contrasena)).rejects.toThrow();
    const nueva = await iniciarSesion(app, usuario, r.json().contrasena);

    const desactivado = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${creado.id}/desactivar`);
    expect(desactivado.json().desactivadoEn).not.toBeNull();
    expect((await pedir(nueva, "GET", "/api/sesion")).statusCode).toBe(401);
    expect((await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${creado.id}/restablecer-contrasena`)).json().codigo).toBe("estado_invalido");

    expect((await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${admin.id}/desactivar`)).json().codigo).toBe("estado_invalido");
  });

  it("la marca de administrador solo va a oficina y nadie se la quita a sí mismo", async () => {
    expect((await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${org.tecnico.id}/administrador`, { administrador: true })).json().codigo).toBe("estado_invalido");
    const dada = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${org.oficina.id}/administrador`, { administrador: true });
    expect(dada.json()).toMatchObject({ administrador: true, segundoFactor: false });
    expect((await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${org.oficina.id}/administrador`, { administrador: false })).json().administrador).toBe(false);
    expect((await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${admin.id}/administrador`, { administrador: false })).json().codigo).toBe("estado_invalido");
  });
});

describe("dispositivos y accesos de clientes (iteración 6)", () => {
  it("muestra la salud de los teléfonos de su organización", async () => {
    const id = randomUUID();
    const salud = { versionApp: 3, versionEsquemaLocal: 3, pendientes: 2, pendienteMasAntiguo: "2026-09-20T10:00:00.000Z", bytesUsados: null, bytesDisponibles: null, persistente: true, ultimoError: null };
    const informado = await app.inject({
      method: "POST",
      url: "/api/sync/dispositivo",
      headers: { cookie: org.tecnico.cookie, origin: ORIGEN, ...cabecerasSync },
      payload: { id, secreto: randomBytes(32).toString("base64url"), salud },
    });
    expect(informado.statusCode, informado.body).toBe(202);
    const { dispositivos } = (await pedir(admin.cookie, "GET", "/api/administracion/dispositivos")).json();
    expect(dispositivos.find((d: { id: string }) => d.id === id)).toMatchObject({ usuario: { id: org.tecnico.id, nombre: "Técnico de prueba" }, salud: { pendientes: 2 } });
  });

  it("crea el acceso de un cliente con su URL de QR, no lo duplica y lo regenera", async () => {
    const { clienteId } = await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) =>
      clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre: "Cliente con acceso", sitio: { nombre: "Sede", direccion: "Calle [N]" } }),
    );
    const antes = (await pedir(admin.cookie, "GET", "/api/administracion/accesos")).json().clientes;
    expect(antes.find((c: { id: string }) => c.id === clienteId)).toEqual({ id: clienteId, nombre: "Cliente con acceso", acceso: null });

    const creado = await pedir(admin.cookie, "POST", `/api/administracion/accesos/${clienteId}`, {});
    expect(creado.statusCode, creado.body).toBe(200);
    const c = creado.json();
    expect(c.url).toBe(`http://localhost:5175/?acceso=${c.identificador}`);
    expect(c.url).not.toContain(c.clave);
    expect((await pedir(admin.cookie, "POST", `/api/administracion/accesos/${clienteId}`, {})).json().codigo).toBe("conflicto");

    const regenerado = (await pedir(admin.cookie, "POST", `/api/administracion/accesos/${clienteId}`, { regenerar: true })).json();
    expect(regenerado.identificador).not.toBe(c.identificador);
    const despues = (await pedir(admin.cookie, "GET", "/api/administracion/accesos")).json().clientes;
    expect(despues.find((x: { id: string }) => x.id === clienteId).acceso.regeneradoEn).not.toBeNull();
  });
});
