import { createECDH, randomBytes, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import webpush from "web-push";
import { llaveDeEnvio } from "@teins/protocolo";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { crearAvisos, enviadorWebPush, opcionesDeEnvio, type Destino } from "../src/modulos/avisos";
import { suscripciones } from "../src/modulos/avisos/esquema";
import { cabecerasSync, iniciarSesion, ORIGEN, servidorDePrueba } from "./ayudas";

/** Servicio de avisos falso: guarda lo que recibiría el navegador y responde el estado que se le pida. */
const recibidos: { destino: Destino; carga: { web_push: number; notification: { title: string; body: string; navigate: string; tag: string } }; tema: string }[] = [];
let respuesta = 201;
const claves = webpush.generateVAPIDKeys();
const clavesVapid = { publica: claves.publicKey, privada: claves.privateKey, contacto: "mailto:soporte@example.invalid" };
const s = await servidorDePrueba({
  config: { AVISOS_VAPID_PUBLICA: claves.publicKey, AVISOS_VAPID_PRIVADA: claves.privateKey, AVISOS_CONTACTO: "mailto:soporte@example.invalid" },
  enviadorDeAvisos: async (destino, carga, { tema }) => {
    recibidos.push({ destino, carga: JSON.parse(carga), tema });
    return respuesta;
  },
});
const { app } = s;

beforeEach(() => {
  recibidos.length = 0;
  respuesta = 201;
});

const pedir = (cookie: string, method: "GET" | "POST", url: string, payload?: object, origen: string | null = ORIGEN) =>
  app.inject({ method, url, headers: { cookie, ...(origen ? { origin: origen } : {}) }, ...(payload ? { payload } : {}) });

/** Una suscripción como la que entrega el navegador (las claves solo tienen que tener la forma correcta). */
const suscripcion = (servicio = "https://fcm.googleapis.com/fcm/send") => ({
  endpoint: `${servicio}/${randomUUID()}`,
  claves: { p256dh: randomBytes(65).toString("base64url"), auth: randomBytes(16).toString("base64url") },
});

async function suscribir(cookie: string, origen = ORIGEN) {
  const datos = suscripcion();
  const r = await pedir(cookie, "POST", "/api/avisos/suscripciones", datos, origen);
  expect(r.statusCode, r.body).toBe(200);
  return datos;
}

const filas = (organizacionId: string) => enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => tx.select().from(suscripciones));

async function clienteConSitio(cookie: string) {
  const r = await pedir(cookie, "POST", "/api/clientes", { nombre: "Clínica Confidencial", sitio: { nombre: "Sede Secreta", direccion: "Calle [N] # [N]-[N]" } });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string; sitios: { id: string }[] };
}

async function programar(org: Awaited<ReturnType<typeof s.nuevaOrganizacionConUsuarios>>, tecnicos = [org.tecnico.id], programadaPara = "2026-10-03") {
  const cliente = await clienteConSitio(org.oficina.cookie);
  const r = await pedir(org.oficina.cookie, "POST", "/api/visitas", { clienteId: cliente.id, sitioId: cliente.sitios[0]!.id, motivo: "Mantenimiento UPS", programadaPara, tecnicos });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string; version: number };
}

async function enviarLevantamiento(cookie: string) {
  const id = randomUUID();
  const r = await app.inject({
    method: "POST",
    url: "/api/sync/comandos",
    headers: { cookie, ...cabecerasSync },
    payload: {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(id),
      levantamiento: {
        id,
        formato: "prueba-ups",
        versionFormato: 1,
        respuestas: { cuarto_tecnico: { potencia_nominal: { valor: "10", unidad: "kVA" }, descripcion: "Cuarto de prueba" } },
        creadoEn: "2026-09-30T10:00:00.000-05:00",
        enviadoEn: "2026-09-30T11:30:00.000-05:00",
      },
    },
  });
  expect(r.statusCode, r.body).toBe(200);
  return id;
}

const avisos = () => recibidos.map((r) => ({ titulo: r.carga.notification.title, cuerpo: r.carga.notification.body }));

describe("suscripciones (ADR-0023)", () => {
  it("entrega la clave pública y guarda la suscripción con la superficie según el rol, no según el cliente", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    expect((await pedir(org.tecnico.cookie, "GET", "/api/avisos/configuracion")).json()).toEqual({ clavePublica: claves.publicKey });

    const deCampo = await suscribir(org.tecnico.cookie);
    const deOficina = await suscribir(org.oficina.cookie, "http://localhost:5174");
    const guardadas = await filas(org.organizacionId);
    expect(guardadas.find((f) => f.endpoint === deCampo.endpoint)).toMatchObject({ usuarioId: org.tecnico.id, superficie: "campo", origen: ORIGEN });
    expect(guardadas.find((f) => f.endpoint === deOficina.endpoint)).toMatchObject({ usuarioId: org.oficina.id, superficie: "oficina", origen: "http://localhost:5174" });
  });

  it("solo acepta servicios de avisos conocidos, por https y con el origen de la superficie", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    for (const servicio of ["https://169.254.169.254/latest", "https://ejemplo.invalid/push", "http://fcm.googleapis.com/fcm/send"]) {
      expect((await pedir(org.tecnico.cookie, "POST", "/api/avisos/suscripciones", suscripcion(servicio))).json().codigo).toBe("entrada_invalida");
    }
    expect((await pedir(org.tecnico.cookie, "POST", "/api/avisos/suscripciones", suscripcion(), null)).json().codigo).toBe("entrada_invalida");
    // Un origen ajeno ni siquiera llega al manejador.
    expect((await pedir(org.tecnico.cookie, "POST", "/api/avisos/suscripciones", suscripcion(), "https://ajeno.example")).statusCode).toBe(403);
    for (const servicio of ["https://web.push.apple.com", "https://updates.push.services.mozilla.com/wpush/v2", "https://wns2-bl2p.notify.windows.com/w"]) {
      expect((await pedir(org.tecnico.cookie, "POST", "/api/avisos/suscripciones", suscripcion(servicio))).statusCode).toBe(200);
    }
  });

  it("en un teléfono compartido el navegador pasa a quien inicia sesión; quitar solo quita la propia", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const usuario = `tecnico.${randomBytes(4).toString("hex")}`;
    await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre: "Otro técnico", rol: "tecnico", contrasena: "contrasena-de-prueba" });
    const otro = await iniciarSesion(app, usuario, "contrasena-de-prueba");

    const datos = await suscribir(org.tecnico.cookie);
    expect((await pedir(otro, "POST", "/api/avisos/suscripciones", datos)).statusCode).toBe(200);
    expect((await filas(org.organizacionId)).filter((f) => f.endpoint === datos.endpoint).map((f) => f.usuarioId)).toEqual([expect.not.stringMatching(org.tecnico.id)]);

    // El primero ya no la tiene: su "quitar" no toca la del otro.
    await pedir(org.tecnico.cookie, "POST", "/api/avisos/suscripciones/quitar", { endpoint: datos.endpoint });
    expect(await filas(org.organizacionId)).toHaveLength(1);
    await pedir(otro, "POST", "/api/avisos/suscripciones/quitar", { endpoint: datos.endpoint });
    expect(await filas(org.organizacionId)).toHaveLength(0);
  });
});

describe("qué se avisa (ADR-0023)", () => {
  it("visita asignada, reprogramada y cancelada llegan al técnico sin datos del cliente", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    await suscribir(org.tecnico.cookie);
    await suscribir(org.oficina.cookie, "http://localhost:5174");

    const visita = await programar(org);
    await s.procesarCola();
    expect(avisos()).toEqual([{ titulo: "Visita nueva", cuerpo: "Para el sáb, 3 de oct. Ábrela para ver el cliente y el sitio." }]);
    const [{ carga, tema }] = recibidos as [(typeof recibidos)[number]];
    expect(carga).toMatchObject({ web_push: 8030, notification: { navigate: `${ORIGEN}/`, tag: `visita:${visita.id}` } });
    expect(tema).toMatch(/^[A-Za-z0-9_-]{32}$/);

    recibidos.length = 0;
    const reprogramada = await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/reprogramar`, { version: 1, programadaPara: "2026-10-05", motivo: "Mantenimiento UPS" });
    expect(reprogramada.statusCode, reprogramada.body).toBe(200);
    await s.procesarCola();
    expect(avisos()).toEqual([{ titulo: "Visita reprogramada", cuerpo: "La del sáb, 3 de oct pasó al lun, 5 de oct." }]);

    recibidos.length = 0;
    await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/cancelar`, { version: 2, motivo: "El cliente pidió aplazar" });
    await s.procesarCola();
    expect(avisos()).toEqual([{ titulo: "Visita cancelada", cuerpo: "Oficina canceló la visita del lun, 5 de oct." }]);

    const todo = JSON.stringify(recibidos);
    expect(todo).not.toContain("Clínica Confidencial");
    expect(todo).not.toContain("Sede Secreta");
  });

  it("reasignar avisa a quien la recibe y a quien la pierde; un cambio rechazado no avisa", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const usuario = `tecnico.${randomBytes(4).toString("hex")}`;
    const nuevo = await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre: "Otro técnico", rol: "tecnico", contrasena: "contrasena-de-prueba" });
    const cookieNuevo = await iniciarSesion(app, usuario, "contrasena-de-prueba");
    const deAntes = await suscribir(org.tecnico.cookie);
    const deNuevo = await suscribir(cookieNuevo);

    const visita = await programar(org);
    await s.procesarCola();
    recibidos.length = 0;

    // Versión vieja: la reasignación se revierte y con ella el aviso.
    expect((await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/tecnicos`, { version: 7, tecnicos: [nuevo.id] })).json().codigo).toBe("conflicto_de_version");
    await s.procesarCola();
    expect(recibidos).toEqual([]);

    await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/tecnicos`, { version: 1, tecnicos: [nuevo.id] });
    await s.procesarCola();
    const porDestino = new Map(recibidos.map((r) => [r.destino.endpoint, r.carga.notification.title]));
    expect(porDestino).toEqual(
      new Map([
        [deAntes.endpoint, "Visita asignada a otra persona"],
        [deNuevo.endpoint, "Visita nueva"],
      ]),
    );
  });

  it("oficina sabe del levantamiento nuevo; el técnico, del comentario y de la revisión", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    await suscribir(org.tecnico.cookie);
    await suscribir(org.oficina.cookie, "http://localhost:5174");

    const id = await enviarLevantamiento(org.tecnico.cookie);
    await s.procesarCola();
    expect(recibidos.map((r) => [r.carga.notification.title, r.carga.notification.body, r.carga.notification.navigate])).toEqual([
      ["Levantamiento nuevo", "Técnico de prueba envió un levantamiento.", "http://localhost:5174/"],
    ]);

    recibidos.length = 0;
    await pedir(org.oficina.cookie, "POST", `/api/levantamientos/${id}/comentarios`, { texto: "Falta la foto de la placa" });
    await pedir(org.oficina.cookie, "POST", `/api/levantamientos/${id}/tomar`, { version: 1 });
    await pedir(org.oficina.cookie, "POST", `/api/levantamientos/${id}/marcar-revisado`, { version: 2 });
    await s.procesarCola();
    expect(avisos()).toEqual(
      expect.arrayContaining([
        { titulo: "Comentario de oficina", cuerpo: "En tu levantamiento del mié, 30 de sept." },
        { titulo: "Levantamiento revisado", cuerpo: "Oficina revisó tu levantamiento del mié, 30 de sept." },
      ]),
    );
    expect(recibidos).toHaveLength(2);
    // El comentario no llega a oficina ni el envío al técnico.
    expect(recibidos.every((r) => r.carga.notification.navigate === `${ORIGEN}/`)).toBe(true);
  });

  it("otra organización nunca recibe los avisos de esta", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const otra = await s.nuevaOrganizacionConUsuarios();
    await suscribir(otra.oficina.cookie, "http://localhost:5174");
    await enviarLevantamiento(org.tecnico.cookie);
    await s.procesarCola();
    expect(recibidos).toEqual([]);
  });
});

describe("entrega y ciclo de vida (ADR-0023, QA-5)", () => {
  it("410 borra la suscripción, 400 la marca y 5xx reintenta", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const datos = await suscribir(org.tecnico.cookie);

    respuesta = 400;
    await programar(org);
    await s.procesarCola();
    expect((await filas(org.organizacionId))[0]!.ultimoError).toMatch(/^400 el /);

    respuesta = 503;
    await programar(org);
    await s.procesarCola();
    const { rows } = await s.propietario.pool.query(
      "select j.attempts, j.last_error from graphile_worker._private_jobs j join graphile_worker._private_tasks t on t.id = j.task_id where t.identifier = 'avisos.enviar' and j.payload->>'organizacionId' = $1",
      [org.organizacionId],
    );
    expect(rows).toEqual([expect.objectContaining({ attempts: 1, last_error: expect.stringContaining("503") })]);
    await s.propietario.pool.query("delete from graphile_worker._private_jobs where payload->>'organizacionId' = $1", [org.organizacionId]);

    respuesta = 410;
    await programar(org);
    await s.procesarCola();
    expect((await filas(org.organizacionId)).map((f) => f.endpoint)).not.toContain(datos.endpoint);
  });

  it("desactivar o restablecer a una persona apaga sus avisos", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const admin = await s.nuevoAdministrador(org.organizacionId);
    await suscribir(org.tecnico.cookie);
    await suscribir(org.oficina.cookie, "http://localhost:5174");

    const restablecido = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${org.oficina.id}/restablecer-contrasena`, {});
    expect(restablecido.statusCode, restablecido.body).toBe(200);
    expect((await filas(org.organizacionId)).map((f) => f.usuarioId)).toEqual([org.tecnico.id]);

    const desactivado = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${org.tecnico.id}/desactivar`, {});
    expect(desactivado.statusCode, desactivado.body).toBe(200);
    expect(await filas(org.organizacionId)).toEqual([]);
  });

  it("cada envío va cifrado y firmado con VAPID (RFC 8291, RFC 8292), con vigencia y tema", async () => {
    // Claves reales de un "navegador": el cifrado exige un punto válido de la curva P-256.
    const navegador = createECDH("prime256v1");
    navegador.generateKeys();
    const claro = JSON.stringify({ web_push: 8030, notification: { title: "Visita nueva" } });
    const pedido = webpush.generateRequestDetails(
      { endpoint: "https://fcm.googleapis.com/fcm/send/uno", keys: { p256dh: navegador.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") } },
      claro,
      opcionesDeEnvio(clavesVapid, { vigenciaSegundos: 86_400, tema: "a".repeat(32) }),
    );
    expect(pedido.headers).toMatchObject({ "Content-Encoding": "aes128gcm", TTL: 86_400, Urgency: "normal", Topic: "a".repeat(32) });
    expect(String(pedido.headers.Authorization)).toMatch(new RegExp(`^vapid t=.+, k=${claves.publicKey}$`));
    // El servicio de avisos no puede leer el contenido.
    expect(Buffer.from(pedido.body!).toString("utf8")).not.toContain("Visita nueva");
  });

  it("un error de red se lanza para que la cola reintente", async () => {
    const enviar = enviadorWebPush(clavesVapid);
    const navegador = createECDH("prime256v1");
    navegador.generateKeys();
    const destino = { endpoint: "https://127.0.0.1:1/push", p256dh: navegador.getPublicKey("base64url"), auth: randomBytes(16).toString("base64url") };
    await expect(enviar(destino, "{}", { vigenciaSegundos: 60, tema: "a".repeat(32) })).rejects.toThrow();
  });

  it("sin claves en el entorno, el trabajo no envía nada", async () => {
    const sinClaves = crearAvisos({ bd: s.conexionApp.bd, config: s.config, enviador: undefined });
    await expect(sinClaves.enviar({ organizacionId: randomUUID(), suscripcionId: randomUUID(), titulo: "x", cuerpo: "y", etiqueta: "z" })).resolves.toBeUndefined();
  });
});
