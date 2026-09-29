import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { llaveDeEnvio, operaciones, TIPO_PROBLEMA } from "@teins/protocolo";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { verificarCadena } from "../src/modulos/auditoria";
import { crearArchivos } from "../src/modulos/archivos";
import { almacenamientoS3 } from "../src/plataforma/almacenamiento";
import { cabecerasSync, jpegDePrueba, ORIGEN, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;
const almacenamiento = almacenamientoS3(s.config);

async function subir(cookie: string, foto = jpegDePrueba(), opciones: { contenido?: Buffer } = {}) {
  const autorizacion = await app.inject({
    method: "POST",
    url: "/api/archivos/subidas",
    headers: { cookie, ...cabecerasSync },
    payload: { huella: foto.huella, bytes: foto.datos.length, tipo: "image/jpeg" },
  });
  expect(autorizacion.statusCode, autorizacion.body).toBe(200);
  const cuerpo = autorizacion.json();
  if (cuerpo.estado === "autorizada") {
    const put = await fetch(cuerpo.url, { method: "PUT", headers: cuerpo.cabeceras, body: opciones.contenido ?? foto.datos });
    if (!opciones.contenido) expect(put.status).toBe(200);
  }
  // Como un navegador real: content-type JSON sin cuerpo.
  return app.inject({
    method: "POST",
    url: `/api/archivos/${foto.huella}/subido`,
    headers: { cookie, ...cabecerasSync, "content-type": "application/json" },
  });
}

function comando(id: string, respuestas: object, versionFormato = 2) {
  return {
    tipo: "EnviarLevantamiento",
    llave: llaveDeEnvio(id),
    levantamiento: {
      id,
      formato: "prueba-ups",
      versionFormato,
      respuestas,
      creadoEn: "2026-09-24T10:00:00.000-05:00",
      enviadoEn: "2026-09-24T11:30:00.000-05:00",
    },
  };
}

const completo = (huellas: string[]) => ({
  cuarto_tecnico: { potencia_nominal: { valor: "12.5", unidad: "kVA" }, fotos_equipo: huellas, descripcion: "Cuarto de prueba" },
});

const enviar = (cookie: string, cuerpo: object, cabeceras: Record<string, string> = cabecerasSync) =>
  app.inject({ method: "POST", url: "/api/sync/comandos", headers: { cookie, ...cabeceras }, payload: cuerpo });

async function fotoVerificada(cookie: string) {
  const foto = jpegDePrueba();
  expect((await subir(cookie, foto)).statusCode).toBe(202);
  await s.procesarCola();
  return foto;
}

describe("contrato y políticas (ADR-0009, ADR-0014)", () => {
  it("toda operación del contrato está registrada y toda ruta tiene política", () => {
    for (const op of Object.values(operaciones)) {
      expect(s.rutas, `${op.metodo} ${op.ruta}`).toContain(`${op.metodo} ${op.ruta.replace(/\{(\w+)\}/g, ":$1")}`);
    }
  });

  it("una ruta nueva sin política impide arrancar el servidor", async () => {
    const Fastify = (await import("fastify")).default;
    const { exigirPoliticas } = await import("../src/plataforma/rutas");
    const minima = Fastify();
    exigirPoliticas(minima, new Set());
    expect(() => minima.get("/sin-politica", async () => "hola")).toThrow(/no declara política/);
  });

  it("sin sesión responde 401 en formato Problem Details", async () => {
    const r = await app.inject({ method: "GET", url: "/api/sesion" });
    expect(r.statusCode).toBe(401);
    expect(r.headers["content-type"]).toContain(TIPO_PROBLEMA);
    expect(r.json()).toMatchObject({ codigo: "no_autenticado", status: 401 });
    expect(r.headers["x-correlacion"]).toBeTruthy();
  });

  it("cada rol solo accede a lo suyo", async () => {
    const { tecnico, oficina } = await s.nuevaOrganizacionConUsuarios();
    expect((await app.inject({ method: "GET", url: "/api/sesion", headers: { cookie: tecnico.cookie } })).json()).toMatchObject({
      usuario: { rol: "tecnico", nombre: "Técnico de prueba" },
    });
    expect((await app.inject({ method: "GET", url: "/api/levantamientos", headers: { cookie: tecnico.cookie } })).json()).toMatchObject({
      codigo: "sin_permiso",
    });
    expect((await enviar(oficina.cookie, comando(randomUUID(), {}))).json()).toMatchObject({ codigo: "sin_permiso" });
  });

  it("una contraseña equivocada no inicia sesión y un origen no confiable se rechaza", async () => {
    await s.nuevaOrganizacionConUsuarios();
    const mala = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/username",
      headers: { origin: ORIGEN, "content-type": "application/json" },
      payload: { username: "no.existe", password: "cualquier-cosa" },
    });
    expect(mala.statusCode).toBe(401);
    const ajeno = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/username",
      headers: { origin: "https://sitio-ajeno.example", "content-type": "application/json" },
      payload: { username: "no.existe", password: "cualquier-cosa" },
    });
    expect(ajeno.statusCode).toBe(403);
  });

  it("la sincronización exige una versión del protocolo aceptada (ADR-0015)", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const r = await enviar(tecnico.cookie, comando(randomUUID(), {}), {});
    expect(r.statusCode).toBe(426);
    expect(r.json()).toMatchObject({ codigo: "version_protocolo_no_soportada", versionMinima: 1 });
  });

  it("rechaza un JSON que intenta contaminar prototipos", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const r = await app.inject({
      method: "POST",
      url: "/api/sync/comandos",
      headers: { cookie: tecnico.cookie, ...cabecerasSync, "content-type": "application/json" },
      payload: '{"__proto__": {"admin": true}}',
    });
    expect(r.statusCode).toBe(400);
  });

  it("la especificación OpenAPI es pública y la salud verifica la base", async () => {
    expect((await app.inject({ method: "GET", url: "/api/openapi.json" })).json()).toHaveProperty("openapi", "3.1.0");
    expect((await app.inject({ method: "GET", url: "/salud" })).json()).toEqual({ estado: "ok" });
  });
});

describe("sesión del personal", () => {
  it("cuando Better Auth renueva la sesión, la cookie nueva llega al navegador", async () => {
    const { oficina } = await s.nuevaOrganizacionConUsuarios();
    // Una sesión con más de un día de uso: la siguiente solicitud la renueva (updateAge).
    await s.propietario.pool.query("update identidad.sesiones set expira_en = now() + make_interval(days => $2) where usuario_id = $1", [oficina.id, s.config.DURACION_SESION_DIAS - 2]);
    const r = await app.inject({ method: "GET", url: "/api/sesion", headers: { cookie: oficina.cookie } });
    expect(r.statusCode).toBe(200);
    expect(String(r.headers["set-cookie"])).toMatch(/teins\.session_token=.*Max-Age=\d+/);
  });
});

describe("rutas de autenticación", () => {
  it("solo pasan las que usan las aplicaciones: nadie cambia su propio nombre ni ingresa por correo", async () => {
    const { oficina } = await s.nuevaOrganizacionConUsuarios();
    const pedir = (url: string, payload: object) => app.inject({ method: "POST", url, headers: { cookie: oficina.cookie, origin: ORIGEN }, payload });
    expect((await pedir("/api/auth/update-user", { name: "Ing. Supervisor TEINS" })).statusCode).toBe(404);
    expect((await pedir("/api/auth/sign-in/email", { email: "x@y.co", password: "contrasena-de-prueba" })).statusCode).toBe(404);
    expect((await pedir("/api/auth/is-username-available", { username: "otro" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/sesion", headers: { cookie: oficina.cookie } })).json()).toMatchObject({ usuario: { nombre: "Oficina de prueba" } });
  });
});

describe("archivos (ADR-0007)", () => {
  it("autoriza, recibe, verifica y sirve una foto; la segunda autorización no vuelve a subirla", async () => {
    const { tecnico, oficina } = await s.nuevaOrganizacionConUsuarios();
    const foto = jpegDePrueba();
    const confirmacion = await subir(tecnico.cookie, foto);
    expect(confirmacion.statusCode).toBe(202);
    expect(confirmacion.json()).toEqual({ archivo: "subido" });

    await s.procesarCola();
    const otra = await app.inject({
      method: "POST",
      url: "/api/archivos/subidas",
      headers: { cookie: tecnico.cookie, ...cabecerasSync },
      payload: { huella: foto.huella, bytes: foto.datos.length, tipo: "image/jpeg" },
    });
    expect(otra.json()).toEqual({ estado: "existente", archivo: "verificado" });

    const url = await app.inject({ method: "GET", url: `/api/archivos/${foto.huella}/url`, headers: { cookie: oficina.cookie } });
    expect(url.statusCode).toBe(200);
    const descarga = await fetch(url.json().url);
    expect(Buffer.from(await descarga.arrayBuffer()).equals(foto.datos)).toBe(true);
  });

  it("el almacenamiento rechaza un contenido distinto al de la huella firmada", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const foto = jpegDePrueba();
    const alterado = Buffer.from(foto.datos);
    alterado[alterado.length - 3] = alterado[alterado.length - 3]! ^ 0xff;
    const r = await subir(tecnico.cookie, foto, { contenido: alterado });
    expect(r.json()).toMatchObject({ codigo: "archivos_faltantes", faltantes: [foto.huella] });
  });

  it("rechaza y elimina un archivo que dice ser JPEG y no lo es", async () => {
    const { tecnico, oficina, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const noEsJpeg = Buffer.from("esto no es una imagen, aunque diga image/jpeg");
    const huella = (await import("node:crypto")).createHash("sha256").update(noEsJpeg).digest("hex");
    expect((await subir(tecnico.cookie, { datos: noEsJpeg, huella })).statusCode).toBe(202);
    await s.procesarCola();

    const { rows } = await s.propietario.pool.query("select estado, motivo_rechazo from archivos.archivos where organizacion_id = $1 and huella = $2", [
      organizacionId,
      huella,
    ]);
    expect(rows[0]).toEqual({ estado: "rechazado", motivo_rechazo: "el contenido no es image/jpeg" });
    expect((await app.inject({ method: "GET", url: `/api/archivos/${huella}/url`, headers: { cookie: oficina.cookie } })).statusCode).toBe(404);
  });

  it("una clave ocupada sin fila de archivo (un PDF generado) no se puede autorizar ni, por tanto, borrar", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const generado = Buffer.from(`%PDF-1.7 generado ${randomUUID()}`);
    const huella = createHash("sha256").update(generado).digest("hex");
    await almacenamiento.guardar(`${organizacionId}/${huella}`, generado, "application/pdf");
    const r = await app.inject({ method: "POST", url: "/api/archivos/subidas", headers: { cookie: tecnico.cookie, ...cabecerasSync }, payload: { huella, bytes: 1, tipo: "image/jpeg" } });
    expect(r.json()).toMatchObject({ codigo: "estado_invalido" });
    expect(await almacenamiento.existe(`${organizacionId}/${huella}`)).toBe(true);
  });

  it("si la verificación agota sus intentos, el archivo queda rechazado y se puede volver a subir", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const foto = jpegDePrueba();
    expect((await subir(tecnico.cookie, foto)).statusCode).toBe(202);
    await almacenamiento.eliminar(`${organizacionId}/${foto.huella}`);
    const archivos = crearArchivos({ bd: s.conexionApp.bd, almacenamiento, config: s.config });
    await expect(archivos.verificar({ organizacionId, huella: foto.huella }, { ultimoIntento: true })).resolves.toBeUndefined();

    const { rows } = await s.propietario.pool.query("select estado from archivos.archivos where organizacion_id = $1 and huella = $2", [organizacionId, foto.huella]);
    expect(rows[0].estado).toBe("rechazado");
    expect((await subir(tecnico.cookie, foto)).statusCode).toBe(202);
  });

  it("no autoriza archivos que superan el límite", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const r = await app.inject({
      method: "POST",
      url: "/api/archivos/subidas",
      headers: { cookie: tecnico.cookie, ...cabecerasSync },
      payload: { huella: "a".repeat(64), bytes: s.config.BYTES_MAXIMOS_ARCHIVO + 1, tipo: "image/jpeg" },
    });
    expect(r.statusCode).toBe(413);
  });
});

describe("envío de levantamientos (ADR-0003, ADR-0005)", () => {
  it("acepta un envío completo, lo audita y lo muestra en la bandeja de oficina", async () => {
    const { tecnico, oficina, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const foto = await fotoVerificada(tecnico.cookie);
    const id = randomUUID();

    const r = await enviar(tecnico.cookie, comando(id, completo([foto.huella])));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ resultado: "aceptado", levantamientoId: id });

    const bandeja = (await app.inject({ method: "GET", url: "/api/levantamientos", headers: { cookie: oficina.cookie } })).json();
    expect(bandeja.elementos).toEqual([
      expect.objectContaining({ id, estado: "enviado", fotos: 1, tecnico: { id: tecnico.id, nombre: "Técnico de prueba" } }),
    ]);
    const detalle = (await app.inject({ method: "GET", url: `/api/levantamientos/${id}`, headers: { cookie: oficina.cookie } })).json();
    expect(detalle).toMatchObject({ respuestas: completo([foto.huella]), formatoDefinicion: { formato: "prueba-ups", version: 2 } });

    const cadena = await enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => verificarCadena(tx, organizacionId, "levantamiento", id));
    expect(cadena).toEqual({ integra: true, eslabones: 2 });
  });

  it("es idempotente: diez envíos simultáneos del mismo levantamiento crean uno y todos reciben la misma respuesta", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const foto = await fotoVerificada(tecnico.cookie);
    const id = randomUUID();
    const respuestas = await Promise.all(Array.from({ length: 10 }, () => enviar(tecnico.cookie, comando(id, completo([foto.huella])))));

    expect(new Set(respuestas.map((r) => r.statusCode))).toEqual(new Set([200]));
    expect(new Set(respuestas.map((r) => r.body)).size).toBe(1);
    const { rows } = await s.propietario.pool.query("select count(*)::int as n from levantamientos.levantamientos where organizacion_id = $1", [organizacionId]);
    expect(rows[0].n).toBe(1);

    // Un reintento días después, con una app reinstalada, recibe lo mismo.
    const tarde = await enviar(tecnico.cookie, comando(id, completo([foto.huella])));
    expect(tarde.body).toBe(respuestas[0]!.body);
  });

  it("indica qué archivos faltan y cuáles siguen en verificación", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const noSubida = jpegDePrueba();
    const faltan = await enviar(tecnico.cookie, comando(randomUUID(), completo([noSubida.huella])));
    expect(faltan.statusCode).toBe(409);
    expect(faltan.json()).toMatchObject({ codigo: "archivos_faltantes", faltantes: [noSubida.huella] });

    const sinVerificar = jpegDePrueba();
    await subir(tecnico.cookie, sinVerificar);
    const id = randomUUID();
    const espera = await enviar(tecnico.cookie, comando(id, completo([sinVerificar.huella])));
    expect(espera.json()).toMatchObject({ codigo: "archivos_en_verificacion", pendientes: [sinVerificar.huella], reintentarEnSegundos: 5 });

    // El rechazo no consumió la llave: al terminar la verificación, el mismo comando pasa.
    await s.procesarCola();
    expect((await enviar(tecnico.cookie, comando(id, completo([sinVerificar.huella])))).statusCode).toBe(200);
  });

  it("rechaza respuestas que no cumplen el formato con el detalle por campo", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const r = await enviar(tecnico.cookie, comando(randomUUID(), { cuarto_tecnico: { descripcion: "Sin potencia ni fotos" } }));
    expect(r.statusCode).toBe(422);
    expect(r.json().errores).toEqual(
      expect.arrayContaining([
        { seccion: "cuarto_tecnico", campo: "potencia_nominal", codigo: "campo_obligatorio" },
        { seccion: "cuarto_tecnico", campo: "fotos_equipo", codigo: "campo_obligatorio" },
      ]),
    );
  });

  it("un borrador de la versión 1 del formato se valida con su versión (ADR-0006)", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const r = await enviar(tecnico.cookie, comando(randomUUID(), { cuarto_tecnico: { descripcion: "Borrador del corte 0" } }, 1));
    expect(r.statusCode, r.body).toBe(200);
  });

  it("rechaza un formato desconocido y una entrada mal formada", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    expect((await enviar(tecnico.cookie, comando(randomUUID(), {}, 99))).json()).toMatchObject({ codigo: "formato_desconocido" });
    const mal = await enviar(tecnico.cookie, { tipo: "EnviarLevantamiento", llave: "x" });
    expect(mal.statusCode).toBe(400);
    expect(mal.json().campos.length).toBeGreaterThan(0);
  });

  it("otro técnico o otra organización no pueden apropiarse de un levantamiento enviado", async () => {
    const a = await s.nuevaOrganizacionConUsuarios();
    const b = await s.nuevaOrganizacionConUsuarios();
    const id = randomUUID();
    await enviar(a.tecnico.cookie, comando(id, { cuarto_tecnico: {} }, 1));

    const deOtraOrganizacion = await enviar(b.tecnico.cookie, comando(id, { cuarto_tecnico: {} }, 1));
    expect(deOtraOrganizacion.json()).toMatchObject({ codigo: "conflicto" });
    // Y la otra organización tampoco lo ve.
    expect((await app.inject({ method: "GET", url: `/api/levantamientos/${id}`, headers: { cookie: b.oficina.cookie } })).statusCode).toBe(404);
  });

  it("la bandeja pagina del más antiguo al más reciente sin repetir ni saltar", async () => {
    const { tecnico, oficina } = await s.nuevaOrganizacionConUsuarios();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = randomUUID();
      ids.push(id);
      await enviar(tecnico.cookie, comando(id, { cuarto_tecnico: {} }, 1));
    }
    const vistos: string[] = [];
    let cursor: string | null = null;
    do {
      const url: string = `/api/levantamientos?limite=2${cursor ? `&cursor=${cursor}` : ""}`;
      const pagina = (await app.inject({ method: "GET", url, headers: { cookie: oficina.cookie } })).json();
      vistos.push(...pagina.elementos.map((e: { id: string }) => e.id));
      cursor = pagina.siguienteCursor;
    } while (cursor);
    expect(vistos).toEqual(ids);
    expect((await app.inject({ method: "GET", url: "/api/levantamientos?limite=2", headers: { cookie: oficina.cookie } })).json().total).toBe(5);
    expect((await app.inject({ method: "GET", url: "/api/levantamientos?cursor=basura", headers: { cookie: oficina.cookie } })).statusCode).toBe(400);
  });

  it("los revisados paginan del más reciente al más antiguo, sin repetir ni saltar", async () => {
    const { tecnico, oficina } = await s.nuevaOrganizacionConUsuarios();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const id = randomUUID();
      ids.push(id);
      await enviar(tecnico.cookie, comando(id, { cuarto_tecnico: {} }, 1));
    }
    // El orden es lo que se prueba, no la revisión: se marcan revisados directo en la base.
    await s.propietario.pool.query("update levantamientos.levantamientos set estado = 'revisado' where id = any($1)", [ids]);
    const vistos: string[] = [];
    let cursor: string | null = null;
    do {
      const url: string = `/api/levantamientos?estado=revisado&limite=2${cursor ? `&cursor=${cursor}` : ""}`;
      const pagina = (await app.inject({ method: "GET", url, headers: { cookie: oficina.cookie } })).json();
      vistos.push(...pagina.elementos.map((e: { id: string }) => e.id));
      cursor = pagina.siguienteCursor;
    } while (cursor);
    expect(vistos).toEqual([...ids].reverse());
    // Enviados sin visita (como los de los cortes 0 y 1): la bandeja lo dice con un nulo, no con un error.
    const primera = (await app.inject({ method: "GET", url: "/api/levantamientos?estado=revisado&limite=1", headers: { cookie: oficina.cookie } })).json();
    expect(primera.elementos[0].visita).toBeNull();
  });
});

export type { FastifyInstance };

describe("recuperación de acceso (ADR-0009)", () => {
  it("restablecer la contraseña cierra todas las sesiones del usuario", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const { crearIdentidad } = await import("../src/modulos/identidad");
    const [{ username }] = (await s.propietario.pool.query("select usuario as username from identidad.usuarios where id = $1", [tecnico.id])).rows;
    expect((await app.inject({ method: "GET", url: "/api/sesion", headers: { cookie: tecnico.cookie } })).statusCode).toBe(200);

    await crearIdentidad(s.conexionApp.bd, s.config).restablecerContrasena(username, "otra-contrasena-segura", { autorId: "administrador", correlacion: "prueba" });
    expect((await app.inject({ method: "GET", url: "/api/sesion", headers: { cookie: tecnico.cookie } })).statusCode).toBe(401);
  });
});
