import { randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
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

async function nuevaVisita(organizacionId: string, tecnicos: string[], programadaPara = "2026-09-30") {
  return enOrganizacion(s.conexionApp.bd, organizacionId, async (tx) => {
    const { clienteId, sitioId } = await clientesYSitios.crear(tx, {
      organizacionId,
      nombre: "Cliente ficticio",
      sitio: { nombre: "Sede de prueba", direccion: "Calle [N] # [N]-[N]" },
    });
    return visitas.crear(tx, { organizacionId, ...contexto, clienteId, sitioId, motivo: "Mantenimiento", programadaPara, tecnicos });
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

describe("época de la bajada (ADR-0038)", () => {
  it("es la inicial hasta que se deja limpio el entorno, y cada organización tiene la suya", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const otra = await s.nuevaOrganizacionConUsuarios();
    expect((await bajar(tecnico.cookie)).json().epoca).toBe("inicial");

    // Lo que hace dejar-limpio.sql como dueño de la base: la aplicación solo la lee.
    await s.propietario.pool.query("insert into cambios.epocas (organizacion_id, epoca) values ($1, 'limpieza-1') on conflict (organizacion_id) do update set epoca = excluded.epoca", [organizacionId]);
    expect((await bajar(tecnico.cookie)).json().epoca).toBe("limpieza-1");
    expect((await bajar(otra.tecnico.cookie)).json().epoca).toBe("inicial");
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
        // Sin horario: todo el día (ADR-0037).
        horaInicio: null,
        horaFin: null,
        terminada: null,
      },
    });
    expect((await bajar(otro.cookie, puntoOtro)).json().cambios).toEqual([]);
    expect((await bajar(ajena.tecnico.cookie, puntoAjeno)).json().cambios).toEqual([]);

    await enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => visitas.reasignar(tx, { organizacionId, ...contexto, visitaId, tecnicos: [otro.id] }));
    expect((await bajar(tecnico.cookie, bajada.puntoDeControl)).json().cambios).toEqual([{ tipo: "fuera_de_alcance", entidad: "visita", id: visitaId, motivo: "reasignada" }]);
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

  it("confirmar el borrado varias veces a la vez (reintentos del teléfono) lo registra una sola vez", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const dispositivo = { id: randomUUID(), secreto: secretoNuevo() };
    await informar(tecnico.cookie, { ...dispositivo, salud });
    const usuario = (await s.propietario.pool.query("select usuario from identidad.usuarios where id = $1", [tecnico.id])).rows[0].usuario;
    await s.identidad.desactivarUsuario(usuario, contexto);

    const respuestas = await Promise.all(Array.from({ length: 20 }, () => consultar({ ...dispositivo, confirmados: [tecnico.id] })));
    for (const r of respuestas) expect(r.json()).toEqual({ borrar: [] });
    const { rows } = await s.propietario.pool.query(
      "select count(*)::int as n from auditoria.registros where organizacion_id = $1 and agregado_id = $2 and tipo_evento = 'borrado_local_confirmado'",
      [organizacionId, tecnico.id],
    );
    expect(rows[0].n).toBe(1);
  });
});

describe("las visitas atendidas salen del teléfono al día siguiente (ADR-0041)", () => {
  /** El día en Colombia, como lo cuenta el servidor, corrido `dias`. */
  const dia = (dias: number) => new Date(Date.now() + dias * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  async function enviarCon(cookie: string, visitaId: string) {
    const id = randomUUID();
    const r = await app.inject({
      method: "POST",
      url: "/api/sync/comandos",
      headers: { cookie, ...cabecerasSync },
      payload: { tipo: "EnviarLevantamiento", llave: llaveDeEnvio(id), levantamiento: { id, visitaId, formato: "prueba-ups", versionFormato: 1, respuestas: {}, creadoEn: new Date().toISOString(), enviadoEn: new Date().toISOString() } },
    });
    expect(r.statusCode, r.body).toBe(200);
  }
  const salidas = (cambios: { tipo: string; id?: string; motivo?: string }[]) => cambios.filter((c) => c.tipo === "fuera_de_alcance").map((c) => [c.id, c.motivo]);
  const visitasQueBajan = (cambios: { tipo: string; visita?: { id: string } }[]) => cambios.filter((c) => c.tipo === "visita").map((c) => c.visita!.id);

  it("cierra lo atendido de días anteriores, no lo de hoy ni lo atrasado sin atender; la app 14 no recibe el motivo", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const enviadaAyer = await nuevaVisita(organizacionId, [tecnico.id], dia(-1));
    const terminadaAyer = await nuevaVisita(organizacionId, [tecnico.id], dia(-1));
    const atrasada = await nuevaVisita(organizacionId, [tecnico.id], dia(-2));
    const deHoy = await nuevaVisita(organizacionId, [tecnico.id], dia(0));
    await enviarCon(tecnico.cookie, enviadaAyer);
    await enviarCon(tecnico.cookie, deHoy);
    await s.propietario.pool.query("update visitas.visitas set terminada_en = now() - interval '1 day' where id = $1", [terminadaAyer]);

    // Una app que no conoce el motivo no recibe la salida: lo tomaría por una reasignación.
    expect(salidas((await bajar(tecnico.cookie, 0, 14)).json().cambios)).toEqual([]);

    const bajada = (await bajar(tecnico.cookie, 0, 15)).json();
    expect(salidas(bajada.cambios).sort()).toEqual([
      [enviadaAyer, "atendida"],
      [terminadaAyer, "atendida"],
    ].sort());
    // Una cerrada no vuelve a bajar, ni a la app que se actualiza y baja todo de nuevo.
    expect(visitasQueBajan(bajada.cambios).sort()).toEqual([atrasada, deHoy].sort());
    expect(visitasQueBajan((await bajar(tecnico.cookie, 0, 14)).json().cambios).sort()).toEqual([atrasada, deHoy].sort());
    // Se cierra una sola vez: la siguiente bajada no la repite.
    expect(salidas((await bajar(tecnico.cookie, bajada.puntoDeControl, 15)).json().cambios)).toEqual([]);
  });

  it("reprogramar una visita cerrada la reabre; reasignarla sin cambiar la fecha la deja cerrada", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const otro = await nuevoTecnico(organizacionId);
    const movida = await nuevaVisita(organizacionId, [tecnico.id], dia(-1));
    const pasada = await nuevaVisita(organizacionId, [tecnico.id], dia(-1));
    await enviarCon(tecnico.cookie, movida);
    await enviarCon(tecnico.cookie, pasada);
    const cerro = (await bajar(tecnico.cookie, 0, 15)).json();
    expect(salidas(cerro.cambios).map(([id]) => id).sort()).toEqual([movida, pasada].sort());

    await enOrganizacion(s.conexionApp.bd, organizacionId, async (tx) => {
      const [m] = await tx.execute<{ version: number }>(sql`select version from visitas.visitas where id = ${movida}`).then((r) => r.rows);
      await visitas.reprogramar(tx, { organizacionId, ...contexto, visitaId: movida, version: m!.version, programadaPara: dia(1), motivo: "Volver a medir" });
      await visitas.reasignar(tx, { organizacionId, ...contexto, visitaId: pasada, tecnicos: [otro.id] });
    });
    // Reprogramada a mañana: vuelve como trabajo por hacer.
    const despues = (await bajar(tecnico.cookie, cerro.puntoDeControl, 15)).json();
    expect(visitasQueBajan(despues.cambios)).toEqual([movida]);
    // Reasignar lo pasado corrige quién la hizo: no vuelve a ningún teléfono como pendiente.
    expect(visitasQueBajan((await bajar(otro.cookie, 0, 15)).json().cambios)).toEqual([]);
  });

  it("cerrar vuelve a mirar la fecha y la cancelación: lo que oficina reprogramó o canceló después de elegirlo no se cierra", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const movida = await nuevaVisita(organizacionId, [tecnico.id], dia(-1));
    const cancelada = await nuevaVisita(organizacionId, [tecnico.id], dia(-1));
    await enviarCon(tecnico.cookie, movida);
    await enviarCon(tecnico.cookie, cancelada);
    await enOrganizacion(s.conexionApp.bd, organizacionId, async (tx) => {
      // La bajada las eligió para cerrar; antes de cerrarlas, oficina reprogramó una para mañana y canceló la otra.
      const elegidas = (await visitas.porCerrar(tx, tecnico.id, dia(0))).map((v) => v.id);
      expect(elegidas.sort()).toEqual([movida, cancelada].sort());
      await visitas.reprogramar(tx, { organizacionId, ...contexto, visitaId: movida, version: 1, programadaPara: dia(1), motivo: "Volver a medir" });
      await visitas.cancelar(tx, { organizacionId, ...contexto, visitaId: cancelada, version: 1, motivo: "Aplazada" });
      await visitas.cerrar(tx, organizacionId, elegidas, dia(0));
    });
    const { rows } = await s.propietario.pool.query("select cerrada_en from visitas.visitas where id = any($1)", [[movida, cancelada]]);
    expect(rows.map((r) => r.cerrada_en)).toEqual([null, null]);
    // La reprogramada sigue en el teléfono como trabajo por hacer; la cancelada sale como cancelada, no como atendida.
    const bajada = (await bajar(tecnico.cookie, 0, 15)).json();
    expect(visitasQueBajan(bajada.cambios)).toEqual([movida]);
    expect(salidas(bajada.cambios)).toEqual([[cancelada, "cancelada"]]);
  });
});
