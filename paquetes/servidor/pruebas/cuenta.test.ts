import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { autenticacion, cabecerasSync, cookiesDe, iniciarSesion, ORIGEN, servidorDePrueba } from "./ayudas";
import { codigoTotp } from "./totp";

/**
 * Iteración 25 (ADR-0033): contraseña temporal obligatoria, cuenta propia y reactivar usuarios. Cada regla se
 * prueba contra la API, sin pasar por las pantallas: el servidor la exige aunque alguien las salte.
 */

const s = await servidorDePrueba();
const { app } = s;
const org = await s.nuevaOrganizacionConUsuarios();
const admin = await s.nuevoAdministrador(org.organizacionId);

const pedir = (cookie: string, method: "GET" | "POST", url: string, payload?: object, extra: Record<string, string> = {}) =>
  app.inject({ method, url, headers: { cookie, origin: ORIGEN, ...extra }, ...(payload ? { payload } : {}) });

/** Un usuario creado desde Administración, con su contraseña temporal. */
async function creadoPorAdministracion(rol: "tecnico" | "oficina") {
  const usuario = `${rol}.${randomBytes(4).toString("hex")}`;
  const r = await pedir(admin.cookie, "POST", "/api/administracion/usuarios", { usuario, nombre: `Persona ${usuario}`, rol });
  expect(r.statusCode, r.body).toBe(201);
  const { usuario: creado, contrasena } = r.json() as { usuario: { id: string }; contrasena: string };
  return { id: creado.id, usuario, temporal: contrasena };
}

const eventosDe = async (usuarioId: string) =>
  (await s.propietario.pool.query("select tipo_evento from auditoria.registros where agregado_id = $1 order by secuencia", [usuarioId])).rows.map((f) => f.tipo_evento as string);

describe("la contraseña temporal se cambia antes de cualquier otra cosa", () => {
  it("quien entra con la temporal solo puede leer su sesión, cambiarla o salir; después trabaja con la nueva", async () => {
    const tecnico = await creadoPorAdministracion("tecnico");
    const cookie = await iniciarSesion(app, tecnico.usuario, tecnico.temporal);
    expect((await pedir(cookie, "GET", "/api/sesion")).json().usuario).toMatchObject({ debeCambiarContrasena: true });

    // El resto de la API lo niega, también lo que pasa por Better Auth con la sesión.
    const sincronizar = await pedir(cookie, "GET", "/api/sync/cambios?desde=0&app=8&limite=500", undefined, cabecerasSync);
    expect(sincronizar.statusCode).toBe(403);
    expect(sincronizar.json().codigo).toBe("cambio_de_contrasena_requerido");
    expect((await autenticacion(app, "/passkey/generate-register-options", {}, cookie)).statusCode).toBe(403);

    // Igual a la temporal no sirve.
    const igual = await pedir(cookie, "POST", "/api/cuenta/contrasena", { actual: tecnico.temporal, nueva: tecnico.temporal });
    expect(igual.statusCode).toBe(400);
    expect(igual.json().campos).toEqual([expect.objectContaining({ ruta: "nueva" })]);

    const cambio = await pedir(cookie, "POST", "/api/cuenta/contrasena", { actual: tecnico.temporal, nueva: "una-contrasena-propia" });
    expect(cambio.statusCode, cambio.body).toBe(200);
    const nueva = cookiesDe(cambio);
    expect((await pedir(nueva, "GET", "/api/sesion")).json().usuario).toMatchObject({ debeCambiarContrasena: false });
    expect((await pedir(nueva, "GET", "/api/sync/cambios?desde=0&app=8&limite=500", undefined, cabecerasSync)).statusCode).toBe(200);
    // La temporal ya no entra; la nueva sí.
    expect((await autenticacion(app, "/sign-in/username", { username: tecnico.usuario, password: tecnico.temporal })).statusCode).toBe(401);
    await iniciarSesion(app, tecnico.usuario, "una-contrasena-propia");
    expect(await eventosDe(tecnico.id)).toContain("contrasena_cambiada");
  });

  it("restablecer desde Administración también la marca; la que fija un comando del servidor no", async () => {
    const oficina = await creadoPorAdministracion("oficina");
    const r = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${oficina.id}/restablecer-contrasena`);
    const cookie = await iniciarSesion(app, oficina.usuario, r.json().contrasena);
    expect((await pedir(cookie, "GET", "/api/levantamientos")).json().codigo).toBe("cambio_de_contrasena_requerido");

    // Quien corre el comando en el servidor elige la contraseña (aprovisionamiento): no es temporal.
    await s.identidad.restablecerContrasena(oficina.usuario, "elegida-por-el-operador", { autorId: "operador", correlacion: "prueba" });
    const propia = await iniciarSesion(app, oficina.usuario, "elegida-por-el-operador");
    expect((await pedir(propia, "GET", "/api/levantamientos")).statusCode).toBe(200);
  });

  it("quien administra no restablece la suya desde Administración: perdería el segundo factor y quedaría con una temporal", async () => {
    const r = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${admin.id}/restablecer-contrasena`);
    expect(r.statusCode).toBe(409);
    expect(r.json().codigo).toBe("estado_invalido");
    expect((await pedir(admin.cookie, "GET", "/api/sesion")).json().usuario).toMatchObject({ segundoFactor: true, debeCambiarContrasena: false });
  });

  it("Better Auth no expone cambiar la contraseña ni quitar el segundo factor: solo pasan por la operación propia", async () => {
    expect((await autenticacion(app, "/change-password", { currentPassword: "x", newPassword: "y".repeat(12) }, org.oficina.cookie)).statusCode).toBe(404);
    expect((await autenticacion(app, "/two-factor/disable", { password: "x" }, admin.cookie)).statusCode).toBe(404);
  });
});

describe("cambiar la propia contraseña", () => {
  it("pide la actual, cierra las demás sesiones y conserva la que la cambió", async () => {
    const oficina = await creadoPorAdministracion("oficina");
    const primera = await iniciarSesion(app, oficina.usuario, oficina.temporal);
    const cambio = await pedir(primera, "POST", "/api/cuenta/contrasena", { actual: oficina.temporal, nueva: "contrasena-numero-1" });
    const esta = cookiesDe(cambio);
    const otra = await iniciarSesion(app, oficina.usuario, "contrasena-numero-1");

    // La actual equivocada no es una sesión vencida (401): es un dato equivocado, con su campo.
    const mala = await pedir(esta, "POST", "/api/cuenta/contrasena", { actual: "no-es-la-actual", nueva: "contrasena-numero-2" });
    expect(mala.statusCode).toBe(422);
    expect(mala.json()).toMatchObject({ codigo: "credencial_incorrecta", campos: [expect.objectContaining({ ruta: "actual" })] });
    // Corta o larga no pasa del contrato.
    expect((await pedir(esta, "POST", "/api/cuenta/contrasena", { actual: "contrasena-numero-1", nueva: "corta" })).statusCode).toBe(400);
    expect((await pedir(esta, "POST", "/api/cuenta/contrasena", { actual: "contrasena-numero-1", nueva: "x".repeat(129) })).statusCode).toBe(400);

    const bien = await pedir(esta, "POST", "/api/cuenta/contrasena", { actual: "contrasena-numero-1", nueva: "contrasena-numero-2" });
    expect(bien.statusCode, bien.body).toBe(200);
    expect((await pedir(cookiesDe(bien), "GET", "/api/sesion")).statusCode).toBe(200);
    expect((await pedir(otra, "GET", "/api/sesion")).statusCode).toBe(401);
  });

  it("tiene el mismo límite de intentos que el ingreso", async () => {
    const conLimite = await servidorDePrueba({ config: { INICIOS_DE_SESION_POR_MINUTO: "3" } });
    // Los contadores viven en la base, compartida con los demás servidores de prueba: una IP propia no hereda sus intentos.
    const remoteAddress = `10.25.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
    const usuario = `oficina.${randomBytes(4).toString("hex")}`;
    await conLimite.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre: "Con límite", rol: "oficina", contrasena: "contrasena-de-prueba" });
    const ingreso = await conLimite.app.inject({ method: "POST", url: "/api/auth/sign-in/username", remoteAddress, headers: { origin: ORIGEN }, payload: { username: usuario, password: "contrasena-de-prueba" } });
    const cookie = cookiesDe(ingreso);
    const intentos = [];
    for (let i = 0; i < 5; i++) {
      intentos.push(
        await conLimite.app.inject({ method: "POST", url: "/api/cuenta/contrasena", remoteAddress, headers: { cookie, origin: ORIGEN }, payload: { actual: `equivocada-${i}`, nueva: "contrasena-numero-9" } }),
      );
    }
    expect(intentos.map((r) => r.statusCode)).toContain(429);
    expect(intentos.find((r) => r.statusCode === 429)!.json().codigo).toBe("demasiadas_solicitudes");
  });
});

describe("quitar el propio segundo factor", () => {
  async function conSegundoFactor() {
    const oficina = await creadoPorAdministracion("oficina");
    const temporal = await iniciarSesion(app, oficina.usuario, oficina.temporal);
    const contrasena = "contrasena-con-factor";
    const cookie = cookiesDe(await pedir(temporal, "POST", "/api/cuenta/contrasena", { actual: oficina.temporal, nueva: contrasena }));
    const { totpURI } = (await autenticacion(app, "/two-factor/enable", { password: contrasena }, cookie)).json() as { totpURI: string };
    const verificado = await autenticacion(app, "/two-factor/verify-totp", { code: codigoTotp(totpURI) }, cookie);
    expect(verificado.statusCode, verificado.body).toBe(200);
    return { ...oficina, contrasena, totpURI, cookie: cookiesDe(verificado) };
  }

  it("pide la contraseña y un código vigente, cierra las demás sesiones y lo registra", async () => {
    const p = await conSegundoFactor();
    const ingreso = await autenticacion(app, "/sign-in/username", { username: p.usuario, password: p.contrasena });
    const otra = cookiesDe(await autenticacion(app, "/two-factor/verify-totp", { code: codigoTotp(p.totpURI) }, cookiesDe(ingreso)));

    const sinCodigo = await pedir(p.cookie, "POST", "/api/cuenta/segundo-factor/quitar", { contrasena: p.contrasena, codigo: "000000" });
    expect(sinCodigo.statusCode).toBe(422);
    expect(sinCodigo.json().campos).toEqual([expect.objectContaining({ ruta: "codigo" })]);
    const malaContrasena = await pedir(p.cookie, "POST", "/api/cuenta/segundo-factor/quitar", { contrasena: "no-es-esta", codigo: codigoTotp(p.totpURI) });
    expect(malaContrasena.statusCode).toBe(422);
    expect(malaContrasena.json().campos).toEqual([expect.objectContaining({ ruta: "contrasena" })]);
    expect((await pedir(p.cookie, "GET", "/api/sesion")).json().usuario.segundoFactor).toBe(true);

    const quitado = await pedir(p.cookie, "POST", "/api/cuenta/segundo-factor/quitar", { contrasena: p.contrasena, codigo: codigoTotp(p.totpURI) });
    expect(quitado.statusCode, quitado.body).toBe(200);
    expect((await pedir(cookiesDe(quitado), "GET", "/api/sesion")).json().usuario.segundoFactor).toBe(false);
    expect((await pedir(otra, "GET", "/api/sesion")).statusCode).toBe(401);
    // El siguiente ingreso ya no pide código.
    expect((await autenticacion(app, "/sign-in/username", { username: p.usuario, password: p.contrasena })).json()).not.toHaveProperty("twoFactorRedirect");
    expect(await eventosDe(p.id)).toContain("segundo_factor_quitado");
  });

  it("quien administra no puede quitarlo, aunque llame a la API directamente", async () => {
    const r = await pedir(admin.cookie, "POST", "/api/cuenta/segundo-factor/quitar", { contrasena: admin.contrasena, codigo: codigoTotp(admin.totpURI) });
    expect(r.statusCode).toBe(403);
    expect(r.json().codigo).toBe("sin_permiso");
    expect((await pedir(admin.cookie, "GET", "/api/sesion")).json().usuario.segundoFactor).toBe(true);
  });
});

describe("reactivar un usuario desactivado", () => {
  it("vuelve con su misma cuenta y una temporal que debe cambiar; no recupera sesiones ni deshace órdenes de borrado", async () => {
    const tecnico = await creadoPorAdministracion("tecnico");
    // Un teléfono suyo que todavía no cumplió la orden de borrado.
    await s.propietario.pool.query(
      "insert into identidad.dispositivos (id, usuario_id, organizacion_id, secreto_huella, ultimo_contacto) values ($1, $2, $3, 'huella', now())",
      [randomUUID(), tecnico.id, org.organizacionId],
    );
    expect((await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${tecnico.id}/desactivar`)).statusCode).toBe(200);

    // Solo quien administra con segundo factor reactiva.
    expect((await pedir(org.oficina.cookie, "POST", `/api/administracion/usuarios/${tecnico.id}/reactivar`)).statusCode).toBe(403);
    const r = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${tecnico.id}/reactivar`);
    expect(r.statusCode, r.body).toBe(200);
    const { usuario, contrasena } = r.json();
    expect(usuario).toMatchObject({ id: tecnico.id, desactivadoEn: null, debeCambiarContrasena: true });

    const cookie = await iniciarSesion(app, tecnico.usuario, contrasena);
    expect((await pedir(cookie, "GET", "/api/sesion")).json().usuario).toMatchObject({ id: tecnico.id, debeCambiarContrasena: true });
    const { rows } = await s.propietario.pool.query("select orden_de_borrado_en from identidad.dispositivos where usuario_id = $1", [tecnico.id]);
    expect(rows[0].orden_de_borrado_en).not.toBeNull();
    expect(await eventosDe(tecnico.id)).toContain("usuario_reactivado");

    // Un usuario activo no se reactiva.
    const otraVez = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${tecnico.id}/reactivar`);
    expect(otraVez.statusCode).toBe(409);
    expect(otraVez.json().codigo).toBe("estado_invalido");
  });
});
