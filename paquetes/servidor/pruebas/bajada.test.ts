import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { verificarCadena } from "../src/modulos/auditoria";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearFormatos } from "../src/modulos/formatos";
import { crearVisitas } from "../src/modulos/visitas";
import { cabecerasSync, formatoDePrueba, iniciarSesion, ORIGEN, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;
const visitas = crearVisitas(clientesYSitios);
const contexto = { autorId: "prueba", correlacion: "prueba-bajada" };

const bajar = (cookie: string, desde = 0, app_ = 1, limite?: number) =>
  app.inject({
    method: "GET",
    url: `/api/sync/cambios?desde=${desde}&app=${app_}${limite ? `&limite=${limite}` : ""}`,
    headers: { cookie, ...cabecerasSync },
  });

async function nuevaVisita(organizacionId: string, tecnicos: string[]) {
  return enOrganizacion(s.conexionApp.bd, organizacionId, async (tx) => {
    const { clienteId, sitioId } = await clientesYSitios.crear(tx, {
      organizacionId,
      nombre: "Cliente ficticio",
      sitio: { nombre: "Sede de prueba", direccion: "Calle [N] # [N]-[N]" },
    });
    return visitas.crear(tx, { organizacionId, ...contexto, clienteId, sitioId, motivo: "Mantenimiento", programadaPara: "2026-09-30", tecnicos });
  });
}

async function nuevoTecnico(organizacionId: string) {
  const usuario = `tecnico.${randomBytes(4).toString("hex")}`;
  const contrasena = "contrasena-de-prueba";
  const { id } = await s.identidad.crearUsuario({ organizacionId, usuario, nombre: "Otro técnico", rol: "tecnico", contrasena });
  return { id, usuario, contrasena, cookie: await iniciarSesion(app, usuario, contrasena) };
}

const tipos = (r: { json(): { cambios: { tipo: string }[] } }) => r.json().cambios.map((c) => c.tipo);

describe("bajada (ADR-0003)", () => {
  it("entrega los formatos de la organización, renueva el permiso local y no retrocede", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const r = await bajar(tecnico.cookie);
    expect(r.statusCode, r.body).toBe(200);
    const bajada = r.json();
    expect(bajada.cambios.map((c: { definicion: { version: number } }) => c.definicion.version)).toEqual([1, 2]);
    expect(bajada.hayMas).toBe(false);
    expect(bajada.puntoDeControl).toBeGreaterThan(0);
    const dias = (Date.parse(bajada.permisoLocalHasta) - Date.now()) / 86_400_000;
    expect(dias).toBeGreaterThan(6.9);
    expect(dias).toBeLessThanOrEqual(7);

    // Desde el punto de control no hay nada nuevo, y el punto no retrocede.
    const otra = (await bajar(tecnico.cookie, bajada.puntoDeControl)).json();
    expect(otra).toMatchObject({ cambios: [], puntoDeControl: bajada.puntoDeControl, hayMas: false });
  });

  it("pagina con hayMas sin perder ni repetir cambios", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const primera = (await bajar(tecnico.cookie, 0, 1, 1)).json();
    expect(primera.hayMas).toBe(true);
    const segunda = (await bajar(tecnico.cookie, primera.puntoDeControl, 1, 1)).json();
    expect(segunda.hayMas).toBe(false);
    expect([...primera.cambios, ...segunda.cambios].map((c: { definicion: { version: number } }) => c.definicion.version)).toEqual([1, 2]);
  });

  it("un formato publicado llega sin publicar la app; uno que exige una app más nueva no llega a una vieja (QA-11, ADR-0015)", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const { puntoDeControl } = (await bajar(tecnico.cookie)).json();
    const formatos = crearFormatos();
    await enOrganizacion(s.conexionApp.bd, organizacionId, async (tx) => {
      await formatos.publicar(tx, organizacionId, { ...formatoDePrueba(2), version: 3, nombre: "Formato de prueba" });
      await formatos.publicar(tx, organizacionId, { ...formatoDePrueba(2), version: 4, appMinima: 5 });
    });

    const vieja = (await bajar(tecnico.cookie, puntoDeControl, 4)).json();
    expect(vieja.cambios.map((c: { definicion: { version: number } }) => c.definicion.version)).toEqual([3]);
    // Una app vieja que se actualiza vuelve a pedir desde cero (lo hace campo) y ahí la recibe.
    const nueva = (await bajar(tecnico.cookie, 0, 5)).json();
    expect(nueva.cambios.map((c: { definicion: { version: number } }) => c.definicion.version)).toEqual([1, 2, 3, 4]);
  });

  it("solo técnicos, con versión del protocolo", async () => {
    const { tecnico, oficina } = await s.nuevaOrganizacionConUsuarios();
    expect((await bajar(oficina.cookie)).json()).toMatchObject({ codigo: "sin_permiso" });
    const sinVersion = await app.inject({ method: "GET", url: "/api/sync/cambios?app=1", headers: { cookie: tecnico.cookie } });
    expect(sinVersion.statusCode).toBe(426);
    expect((await app.inject({ method: "GET", url: "/api/sync/cambios?app=1", headers: cabecerasSync })).statusCode).toBe(401);
  });
});

describe("visitas asignadas", () => {
  it("baja al técnico asignado, no a otros ni a otra organización, y sale del alcance al reasignar (regla 17)", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const otro = await nuevoTecnico(organizacionId);
    const ajena = await s.nuevaOrganizacionConUsuarios();
    const { puntoDeControl: puntoOtro } = (await bajar(otro.cookie)).json();
    const { puntoDeControl: puntoAjeno } = (await bajar(ajena.tecnico.cookie)).json();

    const visitaId = await nuevaVisita(organizacionId, [tecnico.id]);
    const bajada = (await bajar(tecnico.cookie)).json();
    expect(bajada.cambios.at(-1)).toEqual({
      tipo: "visita",
      visita: {
        id: visitaId,
        cliente: { nombre: "Cliente ficticio" },
        sitio: { nombre: "Sede de prueba", direccion: "Calle [N] # [N]-[N]" },
        motivo: "Mantenimiento",
        programadaPara: "2026-09-30",
      },
    });
    expect((await bajar(otro.cookie, puntoOtro)).json().cambios).toEqual([]);
    expect((await bajar(ajena.tecnico.cookie, puntoAjeno)).json().cambios).toEqual([]);

    await enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => visitas.reasignar(tx, { organizacionId, ...contexto, visitaId, tecnicos: [otro.id] }));
    expect((await bajar(tecnico.cookie, bajada.puntoDeControl)).json().cambios).toEqual([{ tipo: "fuera_de_alcance", entidad: "visita", id: visitaId }]);
    expect(tipos(await bajar(otro.cookie, puntoOtro))).toEqual(["visita"]);
    expect(await enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => verificarCadena(tx, organizacionId, "visita", visitaId))).toEqual({ integra: true, eslabones: 2 });
  });

  it("varios cambios de la misma visita bajan una sola vez con su estado actual", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const otro = await nuevoTecnico(organizacionId);
    const { puntoDeControl } = (await bajar(tecnico.cookie)).json();
    const visitaId = await nuevaVisita(organizacionId, [tecnico.id]);
    const reasignar = (tecnicos: string[]) =>
      enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => visitas.reasignar(tx, { organizacionId, ...contexto, visitaId, tecnicos }));
    await reasignar([otro.id]);
    await reasignar([tecnico.id, otro.id]);
    expect(tipos(await bajar(tecnico.cookie, puntoDeControl))).toEqual(["visita"]);
  });
});

describe("envío con visita y estado de mis levantamientos", () => {
  const comando = (id: string, visitaId?: string) => ({
    tipo: "EnviarLevantamiento",
    llave: llaveDeEnvio(id),
    levantamiento: {
      id,
      formato: "prueba-ups",
      versionFormato: 1,
      ...(visitaId ? { visitaId } : {}),
      respuestas: {},
      creadoEn: "2026-09-24T10:00:00.000-05:00",
      enviadoEn: "2026-09-24T11:30:00.000-05:00",
    },
  });
  const enviar = (cookie: string, cuerpo: object) => app.inject({ method: "POST", url: "/api/sync/comandos", headers: { cookie, ...cabecerasSync }, payload: cuerpo });

  it("guarda la visita, rechaza una que no existe y baja el estado solo a su técnico", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const otro = await nuevoTecnico(organizacionId);
    const visitaId = await nuevaVisita(organizacionId, [tecnico.id]);
    const { puntoDeControl } = (await bajar(tecnico.cookie)).json();
    const { puntoDeControl: puntoOtro } = (await bajar(otro.cookie)).json();

    const id = randomUUID();
    const r = await enviar(tecnico.cookie, comando(id, visitaId));
    expect(r.statusCode, r.body).toBe(200);
    const { rows } = await s.propietario.pool.query("select visita_id from levantamientos.levantamientos where id = $1", [id]);
    expect(rows[0].visita_id).toBe(visitaId);

    expect((await bajar(tecnico.cookie, puntoDeControl)).json().cambios).toEqual([
      { tipo: "levantamiento", id, estado: "enviado", recibidoEn: r.json().recibidoEn },
    ]);
    expect((await bajar(otro.cookie, puntoOtro)).json().cambios).toEqual([]);

    const inexistente = await enviar(tecnico.cookie, comando(randomUUID(), randomUUID()));
    expect(inexistente.json()).toMatchObject({ codigo: "entrada_invalida", detail: "La visita del levantamiento no existe" });
  });

  it("un levantamiento sin visita (cortes 0 y 1) se sigue aceptando", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    expect((await enviar(tecnico.cookie, comando(randomUUID()))).statusCode).toBe(200);
  });
});

describe("dispositivo y revocación (ADR-0009, ADR-0017, QA-5)", () => {
  const salud = {
    versionApp: 2,
    versionEsquemaLocal: 3,
    pendientes: 1,
    pendienteMasAntiguo: "2026-09-24T10:00:00.000Z",
    bytesUsados: 1_000_000,
    bytesDisponibles: 50_000_000,
    persistente: true,
    ultimoError: null,
  };
  const secretoNuevo = () => randomBytes(32).toString("base64url");
  const informar = (cookie: string, cuerpo: object) =>
    app.inject({ method: "POST", url: "/api/sync/dispositivo", headers: { cookie, ...cabecerasSync }, payload: cuerpo });
  const consultar = (cuerpo: object) => app.inject({ method: "POST", url: "/api/sync/dispositivo/ordenes", headers: cabecerasSync, payload: cuerpo });

  it("registra el dispositivo con su salud y rechaza otro secreto para el mismo", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const dispositivo = { id: randomUUID(), secreto: secretoNuevo() };
    expect((await informar(tecnico.cookie, { ...dispositivo, salud })).statusCode).toBe(202);
    expect((await informar(tecnico.cookie, { ...dispositivo, salud: { ...salud, pendientes: 0 } })).statusCode).toBe(202);
    const { rows } = await s.propietario.pool.query("select salud, secreto_huella from identidad.dispositivos where id = $1", [dispositivo.id]);
    expect(rows[0].salud).toMatchObject({ pendientes: 0, persistente: true });
    // El servidor nunca guarda el secreto.
    expect(rows[0].secreto_huella).not.toContain(dispositivo.secreto);

    const r = await informar(tecnico.cookie, { ...dispositivo, secreto: secretoNuevo(), salud });
    expect(r.json()).toMatchObject({ codigo: "conflicto" });
  });

  it("sin orden, la consulta no devuelve nada; con un secreto equivocado no autentica", async () => {
    const { tecnico } = await s.nuevaOrganizacionConUsuarios();
    const dispositivo = { id: randomUUID(), secreto: secretoNuevo() };
    await informar(tecnico.cookie, { ...dispositivo, salud });
    expect((await consultar(dispositivo)).json()).toEqual({ borrar: [] });
    expect((await consultar({ ...dispositivo, secreto: secretoNuevo() })).statusCode).toBe(401);
    expect((await consultar({ id: randomUUID(), secreto: dispositivo.secreto })).statusCode).toBe(401);
  });

  it("desactivar revoca de inmediato, ordena el borrado solo de ese usuario y registra la confirmación", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const companero = await nuevoTecnico(organizacionId);
    // Teléfono compartido: los dos usan el mismo dispositivo y el mismo secreto.
    const dispositivo = { id: randomUUID(), secreto: secretoNuevo() };
    await informar(tecnico.cookie, { ...dispositivo, salud });
    await informar(companero.cookie, { ...dispositivo, salud });
    const usuario = (await s.propietario.pool.query("select usuario from identidad.usuarios where id = $1", [tecnico.id])).rows[0].usuario;

    expect(await s.identidad.desactivarUsuario(usuario, contexto)).toBe("desactivado");
    expect(await s.identidad.desactivarUsuario(usuario, contexto)).toBe("ya_estaba");

    // La sesión ya no sirve: lo pendiente no se acepta (P36).
    expect((await app.inject({ method: "GET", url: "/api/sesion", headers: { cookie: tecnico.cookie } })).statusCode).toBe(401);
    expect((await bajar(tecnico.cookie)).statusCode).toBe(401);
    // Y no vuelve a iniciar sesión: la respuesta es la de una contraseña equivocada.
    const ingreso = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/username",
      headers: { origin: ORIGEN, "content-type": "application/json" },
      payload: { username: usuario, password: "contrasena-de-prueba" },
    });
    expect(ingreso.statusCode).toBe(401);

    expect((await consultar(dispositivo)).json()).toEqual({ borrar: [tecnico.id] });
    // El compañero sigue trabajando.
    expect((await bajar(companero.cookie)).statusCode).toBe(200);

    expect((await consultar({ ...dispositivo, confirmados: [tecnico.id] })).json()).toEqual({ borrar: [] });
    const { rows } = await s.propietario.pool.query(
      "select tipo_evento from auditoria.registros where organizacion_id = $1 and agregado_tipo = 'usuario' and agregado_id = $2 order by secuencia",
      [organizacionId, tecnico.id],
    );
    expect(rows.map((r) => r.tipo_evento)).toEqual(["usuario_desactivado", "borrado_local_confirmado"]);
  });
});
