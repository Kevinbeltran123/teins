import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { verificarCadena } from "../src/modulos/auditoria";
import { cabecerasSync, iniciarSesion, ORIGEN, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;

const pedir = (cookie: string, method: "GET" | "POST", url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });
const bajar = (cookie: string, desde = 0) => app.inject({ method: "GET", url: `/api/sync/cambios?desde=${desde}&app=3`, headers: { cookie, ...cabecerasSync } });
const HOY = "2026-09-25";

const org = await s.nuevaOrganizacionConUsuarios();

async function clienteConSitio(nombre = `Cliente ${randomUUID().slice(0, 6)}`) {
  const r = await pedir(org.oficina.cookie, "POST", "/api/clientes", { nombre, sitio: { nombre: "Sede principal", direccion: "Calle [N] # [N]-[N]" } });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string; nombre: string; sitios: { id: string }[] };
}

async function programar(cliente: { id: string; sitios: { id: string }[] }, tecnicos = [org.tecnico.id], programadaPara = "2026-10-01") {
  const r = await pedir(org.oficina.cookie, "POST", "/api/visitas", { clienteId: cliente.id, sitioId: cliente.sitios[0]!.id, motivo: "Mantenimiento", programadaPara, tecnicos });
  expect(r.statusCode, r.body).toBe(201);
  return r.json();
}

describe("clientes y sitios (iteración 7)", () => {
  it("oficina crea un cliente con su primer sitio y le agrega otro; queda en la auditoría", async () => {
    const cliente = await clienteConSitio("Cliente Uno");
    expect(cliente).toMatchObject({ nombre: "Cliente Uno", sitios: [{ nombre: "Sede principal" }] });
    const r = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios`, { nombre: "Bodega", direccion: "Carrera [N]" });
    expect(r.json().sitios.map((x: { nombre: string }) => x.nombre)).toEqual(["Bodega", "Sede principal"]);
    const lista = (await pedir(org.oficina.cookie, "GET", "/api/clientes")).json().clientes;
    expect(lista.find((c: { id: string }) => c.id === cliente.id).sitios).toHaveLength(2);

    const cadena = await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => verificarCadena(tx, org.organizacionId, "cliente", cliente.id));
    expect(cadena).toEqual({ integra: true, eslabones: 2 });

    // Otra organización no lo ve ni le agrega sitios.
    const otra = await s.nuevaOrganizacionConUsuarios();
    expect((await pedir(otra.oficina.cookie, "GET", "/api/clientes")).json().clientes).toEqual([]);
    expect((await pedir(otra.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios`, { nombre: "X", direccion: "Y" })).statusCode).toBe(404);
  });

  it("el cliente nuevo puede llegar con su contacto principal, en la misma operación (iteración 29)", async () => {
    const contacto = { nombre: "Ana Torres", cargo: "Mantenimiento", correo: "ana@example.com", recibeCorreo: true, recibeWhatsapp: false, recibeInformes: true, recibeCotizaciones: true };
    const r = await pedir(org.oficina.cookie, "POST", "/api/clientes", { nombre: "Cliente Con Contacto", sitio: { nombre: "Sede", direccion: "Calle [N]" }, contacto });
    expect(r.statusCode, r.body).toBe(201);
    const detalle = (await pedir(org.oficina.cookie, "GET", `/api/clientes/${r.json().id}`)).json();
    expect(detalle.contactos).toMatchObject([{ nombre: "Ana Torres", correo: "ana@example.com", recibeCorreo: true, recibeCotizaciones: true }]);
    expect(r.json().reciben).toBe(1);
    const cadena = await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => verificarCadena(tx, org.organizacionId, "cliente", r.json().id));
    expect(cadena).toEqual({ integra: true, eslabones: 2 });

    // Sin correo ni celular no hay por dónde mandarle los documentos: no se crea nada.
    const sinCanal = await pedir(org.oficina.cookie, "POST", "/api/clientes", { nombre: "Cliente Sin Canal", sitio: { nombre: "Sede", direccion: "Calle [N]" }, contacto: { nombre: "Nadie", recibeCorreo: false, recibeWhatsapp: false } });
    expect(sinCanal.statusCode).toBe(400);
    expect(sinCanal.json().campos.map((c: { ruta: string }) => c.ruta)).toContain("cuerpo.contacto.correo");
    expect((await pedir(org.oficina.cookie, "GET", "/api/clientes")).json().clientes.some((c: { nombre: string }) => c.nombre === "Cliente Sin Canal")).toBe(false);
  });

  it("un técnico no crea clientes ni programa visitas", async () => {
    expect((await pedir(org.tecnico.cookie, "POST", "/api/clientes", { nombre: "X", sitio: { nombre: "X", direccion: "X" } })).statusCode).toBe(403);
    expect((await pedir(org.tecnico.cookie, "GET", "/api/visitas?vista=proximas&hoy=2026-09-25")).statusCode).toBe(403);
  });
});

describe("corregir clientes y sitios (ADR-0035)", () => {
  const vista = async (v: "activos" | "archivados") => ((await pedir(org.oficina.cookie, "GET", `/api/clientes?vista=${v}`)).json().clientes as { id: string; archivado: unknown }[]).map((c) => c.id);

  it("el nombre se corrige con registro; lo publicado no cambia porque es una copia", async () => {
    const cliente = await clienteConSitio("Clinica Santafe");
    const r = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}`, { nombre: "Clínica Santa Fe" });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ nombre: "Clínica Santa Fe", editado: { por: { nombre: "Oficina de prueba" } } });
    const sitio = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios/${cliente.sitios[0]!.id}`, { nombre: "Sede Norte", direccion: "Calle [N] # [N]-[N]" });
    expect(sitio.json().sitios[0]).toMatchObject({ nombre: "Sede Norte", archivado: null });
    const { rows } = await s.propietario.pool.query(
      "select tipo_evento, valor_anterior from auditoria.registros where agregado_tipo = 'cliente' and agregado_id = $1 and tipo_evento in ('cliente_editado', 'sitio_editado') order by secuencia",
      [cliente.id],
    );
    expect(rows.map((x) => [x.tipo_evento, x.valor_anterior.nombre])).toEqual([["cliente_editado", "Clinica Santafe"], ["sitio_editado", "Sede principal"]]);
    expect((await pedir(org.tecnico.cookie, "POST", `/api/clientes/${cliente.id}`, { nombre: "X" })).statusCode).toBe(403);
  });

  it("corregir el sitio o el nombre del cliente llega a los teléfonos con sus visitas por hacer; las canceladas no vuelven", async () => {
    const usuario = `t.${randomUUID().slice(0, 8)}`;
    const { id: tecnicoId } = await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre: "Técnico del sitio", rol: "tecnico", contrasena: "contrasena-de-prueba" });
    const cookie = await iniciarSesion(app, usuario, "contrasena-de-prueba");
    const cliente = await clienteConSitio("Clinica Santafe");
    const visita = await programar(cliente, [tecnicoId], "2027-04-01");
    const cancelada = await programar(cliente, [tecnicoId], "2027-04-02");
    expect((await pedir(org.oficina.cookie, "POST", `/api/visitas/${cancelada.id}/cancelar`, { version: 1, motivo: "Aplazada" })).statusCode).toBe(200);
    const antes = (await bajar(cookie)).json();

    const sitio = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios/${cliente.sitios[0]!.id}`, { nombre: "Sede Norte", direccion: "Carrera [N] # [N]-[N]" });
    expect(sitio.statusCode, sitio.body).toBe(200);
    // El teléfono que ya tenía la visita recibe la dirección nueva: el técnico no va a la vieja.
    const tras = (await bajar(cookie, antes.puntoDeControl)).json();
    expect(tras.cambios).toEqual([{ tipo: "visita", visita: expect.objectContaining({ id: visita.id, sitio: { nombre: "Sede Norte", direccion: "Carrera [N] # [N]-[N]" } }) }]);

    expect((await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}`, { nombre: "Clínica Santa Fe" })).statusCode).toBe(200);
    expect((await bajar(cookie, tras.puntoDeControl)).json().cambios).toEqual([{ tipo: "visita", visita: expect.objectContaining({ id: visita.id, cliente: { nombre: "Clínica Santa Fe" } }) }]);
  });

  it("con visitas por hacer no se archiva; archivado sale de la lista, de programar y de los envíos, y se recupera", async () => {
    const cliente = await clienteConSitio();
    const visita = await programar(cliente, [org.tecnico.id], "2027-01-15");
    const detalle = (await pedir(org.oficina.cookie, "GET", `/api/clientes/${cliente.id}`)).json();
    expect(detalle.visitasPorHacer).toEqual([expect.objectContaining({ programadaPara: "2027-01-15", sitio: "Sede principal", tecnicos: ["Técnico de prueba"] })]);
    expect((await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/archivar`)).json()).toMatchObject({ codigo: "estado_invalido" });

    expect((await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/cancelar`, { version: 1, motivo: "Se aplazó" })).statusCode).toBe(200);
    const archivado = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/archivar`);
    expect(archivado.statusCode, archivado.body).toBe(200);
    expect(archivado.json()).toMatchObject({ archivado: { por: { nombre: "Oficina de prueba" } }, visitasPorHacer: [] });
    expect(await vista("activos")).not.toContain(cliente.id);
    expect(await vista("archivados")).toContain(cliente.id);
    // Ya no se le programa, ni se le agregan sitios, ni se corrige hasta recuperarlo.
    const programada = await pedir(org.oficina.cookie, "POST", "/api/visitas", { clienteId: cliente.id, sitioId: cliente.sitios[0]!.id, motivo: "Mantenimiento", programadaPara: "2027-02-01", tecnicos: [org.tecnico.id] });
    expect(programada.json()).toMatchObject({ codigo: "estado_invalido" });
    expect((await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios`, { nombre: "Bodega", direccion: "Carrera [N]" })).json()).toMatchObject({ codigo: "estado_invalido" });

    const recuperado = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/recuperar`);
    expect(recuperado.json()).toMatchObject({ archivado: null });
    expect(await vista("activos")).toContain(cliente.id);
    expect((await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/recuperar`)).json()).toMatchObject({ codigo: "estado_invalido" });
  });

  it("una visita de hoy ya atendida o terminada no cuenta como por hacer: el cliente se archiva (iteración 41)", async () => {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const atendido = await clienteConSitio();
    const visitaAtendida = await programar(atendido, [org.tecnico.id], hoy);
    const id = randomUUID();
    const envio = await app.inject({
      method: "POST",
      url: "/api/sync/comandos",
      headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
      payload: { tipo: "EnviarLevantamiento", llave: llaveDeEnvio(id), levantamiento: { id, visitaId: visitaAtendida.id, formato: "prueba-ups", versionFormato: 1, respuestas: {}, creadoEn: new Date().toISOString(), enviadoEn: new Date().toISOString() } },
    });
    expect(envio.statusCode, envio.body).toBe(200);
    const archivarAtendido = await pedir(org.oficina.cookie, "POST", `/api/clientes/${atendido.id}/archivar`);
    expect(archivarAtendido.statusCode, archivarAtendido.body).toBe(200);

    // Otro técnico: el primero ya tiene una visita de todo el día hoy.
    const otro = await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario: `tecnico.${randomUUID().slice(0, 8)}`, nombre: "Otro técnico", rol: "tecnico", contrasena: "contrasena-de-prueba" });
    const terminado = await clienteConSitio();
    const visitaTerminada = await programar(terminado, [otro.id], hoy);
    await s.propietario.pool.query("update visitas.visitas set terminada_en = now() where id = $1", [visitaTerminada.id]);
    expect((await pedir(org.oficina.cookie, "POST", `/api/clientes/${terminado.id}/archivar`)).statusCode).toBe(200);
  });

  it("un sitio archivado no se programa; no se archiva el único sitio activo ni uno con visitas por hacer", async () => {
    const cliente = await clienteConSitio();
    const principal = cliente.sitios[0]!.id;
    expect((await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios/${principal}/archivar`)).json()).toMatchObject({ codigo: "estado_invalido" });
    const conBodega = (await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios`, { nombre: "Bodega", direccion: "Carrera [N]" })).json();
    const bodega = conBodega.sitios.find((x: { nombre: string }) => x.nombre === "Bodega").id as string;
    await programar({ id: cliente.id, sitios: [{ id: bodega }] }, [org.tecnico.id], "2027-03-01");
    expect((await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios/${bodega}/archivar`)).json()).toMatchObject({ codigo: "estado_invalido" });

    const archivado = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios/${principal}/archivar`);
    expect(archivado.statusCode, archivado.body).toBe(200);
    expect(archivado.json().sitios.find((x: { id: string }) => x.id === principal)).toMatchObject({ archivado: { por: { nombre: "Oficina de prueba" } } });
    // En la lista (y en "Programar visita") solo quedan los activos.
    const enLista = ((await pedir(org.oficina.cookie, "GET", "/api/clientes")).json().clientes as { id: string; sitios: { id: string }[] }[]).find((c) => c.id === cliente.id)!;
    expect(enLista.sitios.map((x) => x.id)).toEqual([bodega]);
    const programada = await pedir(org.oficina.cookie, "POST", "/api/visitas", { clienteId: cliente.id, sitioId: principal, motivo: "Mantenimiento", programadaPara: "2027-02-01", tecnicos: [org.tecnico.id] });
    expect(programada.json()).toMatchObject({ codigo: "estado_invalido" });
    expect((await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios/${principal}/recuperar`)).json().sitios.find((x: { id: string }) => x.id === principal)).toMatchObject({ archivado: null });
  });
});

describe("pool de conexiones", () => {
  it("muchas consultas de visitas a la vez no agotan el pool: los nombres se leen en la misma transacción", async () => {
    await programar(await clienteConSitio(), [org.tecnico.id], "2026-10-05");
    const respuestas = await Promise.all(Array.from({ length: 12 }, () => pedir(org.oficina.cookie, "GET", "/api/visitas?vista=proximas&hoy=2026-10-01")));
    expect(respuestas.map((r) => r.statusCode)).toEqual(Array(12).fill(200));
  }, 30_000);
});

describe("visitas (iteración 7)", () => {
  it("programar llega al teléfono; reprogramar le cambia la fecha; cancelar la saca con su motivo", async () => {
    const cliente = await clienteConSitio();
    const visita = await programar(cliente);
    expect(visita).toMatchObject({ version: 1, tecnicos: [{ id: org.tecnico.id, nombre: "Técnico de prueba" }], levantamientos: { enviados: 0 }, cancelada: null });

    const inicial = (await bajar(org.tecnico.cookie)).json();
    expect(inicial.cambios).toContainEqual({ tipo: "visita", visita: expect.objectContaining({ id: visita.id, programadaPara: "2026-10-01" }) });

    const reprogramada = await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/reprogramar`, { version: 1, programadaPara: "2026-10-03", motivo: "Cotización" });
    expect(reprogramada.json()).toMatchObject({ version: 2, programadaPara: "2026-10-03", motivo: "Cotización" });
    const tras = (await bajar(org.tecnico.cookie, inicial.puntoDeControl)).json();
    expect(tras.cambios).toEqual([{ tipo: "visita", visita: expect.objectContaining({ id: visita.id, programadaPara: "2026-10-03", motivo: "Cotización" }) }]);

    const cancelada = await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/cancelar`, { version: 2, motivo: "El cliente la aplazó" });
    expect(cancelada.json().cancelada).toMatchObject({ por: { id: org.oficina.id }, motivo: "El cliente la aplazó" });
    expect((await bajar(org.tecnico.cookie, tras.puntoDeControl)).json().cambios).toEqual([{ tipo: "fuera_de_alcance", entidad: "visita", id: visita.id, motivo: "cancelada" }]);

    // Una cancelada no se cambia más; aparece solo en su vista.
    expect((await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/reprogramar`, { version: 3, programadaPara: "2026-10-04", motivo: "X" })).json().codigo).toBe("estado_invalido");
    const ids = async (vista: string) => (await pedir(org.oficina.cookie, "GET", `/api/visitas?vista=${vista}&hoy=${HOY}`)).json().visitas.map((v: { id: string }) => v.id);
    expect(await ids("canceladas")).toContain(visita.id);
    expect(await ids("proximas")).not.toContain(visita.id);

    const cadena = await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => verificarCadena(tx, org.organizacionId, "visita", visita.id));
    expect(cadena).toEqual({ integra: true, eslabones: 3 });
  });

  it("dos personas cambiando la misma visita: la segunda recibe conflicto de versión (QA-25)", async () => {
    const visita = await programar(await clienteConSitio());
    const primera = await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/reprogramar`, { version: 1, programadaPara: "2026-12-05", motivo: "Mantenimiento" });
    expect(primera.statusCode).toBe(200);
    const segunda = await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/cancelar`, { version: 1, motivo: "Otra razón" });
    expect(segunda.statusCode).toBe(409);
    expect(segunda.json()).toMatchObject({ codigo: "conflicto_de_version", versionActual: 2 });
  });

  it("reasignar y cancelar conservan lo empezado, que se puede enviar (regla 17), y el avance se ve en la lista", async () => {
    const otro = await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario: `otro.${randomUUID().slice(0, 6)}`, nombre: "Otro técnico", rol: "tecnico", contrasena: "contrasena-de-prueba" });
    const visita = await programar(await clienteConSitio(), [org.tecnico.id], "2026-09-20");
    const reasignada = await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/tecnicos`, { version: 1, tecnicos: [otro.id] });
    expect(reasignada.json().tecnicos).toEqual([{ id: otro.id, nombre: "Otro técnico" }]);
    await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/cancelar`, { version: 2, motivo: "Aplazada" });

    // El técnico original había empezado un levantamiento en esa visita: lo envía igual.
    const id = randomUUID();
    const enviado = await app.inject({
      method: "POST",
      url: "/api/sync/comandos",
      headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
      payload: {
        tipo: "EnviarLevantamiento",
        llave: llaveDeEnvio(id),
        levantamiento: { id, formato: "prueba-ups", versionFormato: 1, visitaId: visita.id, respuestas: {}, creadoEn: "2026-09-20T10:00:00.000Z", enviadoEn: "2026-09-20T11:00:00.000Z" },
      },
    });
    expect(enviado.statusCode, enviado.body).toBe(200);
    const canceladas = (await pedir(org.oficina.cookie, "GET", `/api/visitas?vista=canceladas&hoy=${HOY}`)).json().visitas;
    expect(canceladas.find((v: { id: string }) => v.id === visita.id).levantamientos).toEqual({ enviados: 1, enRevision: 0, revisados: 0 });
  });

  it("solo se asignan técnicos activos de la organización; la fecha y el sitio se validan", async () => {
    const cliente = await clienteConSitio();
    const base = { clienteId: cliente.id, sitioId: cliente.sitios[0]!.id, motivo: "Mantenimiento", programadaPara: "2026-10-01" };
    const otra = await s.nuevaOrganizacionConUsuarios();
    for (const tecnicos of [[otra.tecnico.id], [org.oficina.id]]) {
      expect((await pedir(org.oficina.cookie, "POST", "/api/visitas", { ...base, tecnicos })).json().codigo).toBe("entrada_invalida");
    }
    const ajeno = await pedir(otra.oficina.cookie, "POST", "/api/clientes", { nombre: "Ajeno", sitio: { nombre: "S", direccion: "D" } });
    expect((await pedir(org.oficina.cookie, "POST", "/api/visitas", { ...base, sitioId: ajeno.json().sitios[0].id, tecnicos: [org.tecnico.id] })).json().codigo).toBe("entrada_invalida");
    expect((await pedir(org.oficina.cookie, "POST", "/api/visitas", { ...base, programadaPara: "2026-02-30", tecnicos: [org.tecnico.id] })).json().codigo).toBe("entrada_invalida");

    const { tecnicos } = (await pedir(org.oficina.cookie, "GET", "/api/tecnicos")).json();
    expect(tecnicos.map((t: { id: string }) => t.id)).toContain(org.tecnico.id);
    expect(tecnicos.map((t: { id: string }) => t.id)).not.toContain(org.oficina.id);
  });

  it("si un técnico elegido ya no está activo, el rechazo dice quién es: oficina lo muestra para quitarlo", async () => {
    const usuario = `t.${randomUUID().slice(0, 8)}`;
    const { id } = await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre: "Técnico Retirado", rol: "tecnico", contrasena: "contrasena-de-prueba" });
    const cliente = await clienteConSitio();
    const visita = await programar(cliente, [org.tecnico.id, id], "2027-05-03");
    await s.identidad.desactivarUsuario(usuario, { autorId: "prueba", correlacion: "prueba" });

    // Reasignar con la lista que oficina tenía abierta: el desactivado sigue en ella.
    const r = await pedir(org.oficina.cookie, "POST", `/api/visitas/${visita.id}/tecnicos`, { version: 1, tecnicos: [org.tecnico.id, id] });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject({ codigo: "entrada_invalida", detail: "Técnico Retirado no es un técnico activo de la organización: quítelo de la visita" });
    const otro = await s.nuevaOrganizacionConUsuarios();
    const nueva = await pedir(org.oficina.cookie, "POST", "/api/visitas", { clienteId: cliente.id, sitioId: cliente.sitios[0]!.id, motivo: "Mantenimiento", programadaPara: "2027-05-04", tecnicos: [id, otro.tecnico.id] });
    // El de otra organización no se nombra: ni siquiera se sabe que existe.
    expect(nueva.json().detail).toBe("Técnico Retirado y [Usuario no disponible] no son técnicos activos de la organización: quítelos de la visita");
  });
});

describe("visitas con horario (ADR-0037)", () => {
  const nuevoTecnico = async (nombre: string) => {
    const usuario = `t.${randomUUID().slice(0, 8)}`;
    const { id } = await s.identidad.crearUsuario({ organizacionId: org.organizacionId, usuario, nombre, rol: "tecnico", contrasena: "contrasena-de-prueba" });
    return { id, cookie: await iniciarSesion(app, usuario, "contrasena-de-prueba") };
  };
  const conHorario = async (tecnicos: string[], horaInicio: string | null, horaFin: string | null, programadaPara = "2026-11-02") => {
    const cliente = await clienteConSitio();
    return pedir(org.oficina.cookie, "POST", "/api/visitas", { clienteId: cliente.id, sitioId: cliente.sitios[0]!.id, motivo: "Mantenimiento", programadaPara, horaInicio, horaFin, tecnicos });
  };

  it("de una hora a otra: se cruza con lo que la toca, no con lo que empieza cuando termina", async () => {
    const ana = await nuevoTecnico("Ana Técnica");
    const primera = await conHorario([ana.id], "09:00", "12:00");
    expect(primera.statusCode, primera.body).toBe(201);
    expect(primera.json()).toMatchObject({ horaInicio: "09:00", horaFin: "12:00", terminada: null });
    const cruzada = await conHorario([ana.id], "11:00", "13:00");
    expect(cruzada.statusCode).toBe(409);
    expect(cruzada.json()).toMatchObject({ codigo: "tecnico_ocupado", ocupados: [{ tecnico: { id: ana.id, nombre: "Ana Técnica" }, visitaId: primera.json().id }] });
    expect((await conHorario([ana.id], "12:00", "13:00")).statusCode).toBe(201);
    // Otro día no cuenta.
    expect((await conHorario([ana.id], "09:00", "12:00", "2026-11-03")).statusCode).toBe(201);
  });

  it("todo el día ocupa el día entero; el fin exige el inicio y va después", async () => {
    const beto = await nuevoTecnico("Beto Técnico");
    expect((await conHorario([beto.id], null, null)).statusCode).toBe(201);
    expect((await conHorario([beto.id], "15:00", "16:00")).json().codigo).toBe("tecnico_ocupado");
    expect((await conHorario([beto.id], null, "10:00", "2026-11-04")).statusCode).toBe(400);
    expect((await conHorario([beto.id], "10:00", "09:00", "2026-11-04")).statusCode).toBe(400);
  });

  it("sin hora de fin ocupa hasta que el técnico la termina desde su teléfono; repetirlo no cambia nada", async () => {
    const ciro = await nuevoTecnico("Ciro Técnico");
    const abierta = (await conHorario([ciro.id], "14:00", null, "2026-09-28")).json();
    expect((await conHorario([ciro.id], "16:00", "17:00", "2026-09-28")).json().codigo).toBe("tecnico_ocupado");

    const ocupacion = (await pedir(org.oficina.cookie, "GET", "/api/visitas/ocupacion?fecha=2026-09-28")).json().ocupaciones;
    expect(ocupacion).toContainEqual(expect.objectContaining({ tecnicoId: ciro.id, visitaId: abierta.id, horaInicio: "14:00", horaFin: null, terminadaEn: null }));

    // Otro técnico no la termina; el asignado sí, a las 3:00 p. m. de Colombia.
    expect((await pedir(org.tecnico.cookie, "POST", `/api/visitas/${abierta.id}/terminar`, { llave: randomUUID(), en: "2026-09-28T15:00:00-05:00" })).statusCode).toBe(404);
    {
      const terminada = await pedir(ciro.cookie, "POST", `/api/visitas/${abierta.id}/terminar`, { llave: randomUUID(), en: "2026-09-28T15:00:00-05:00" });
      expect(terminada.json()).toEqual({ terminada: { en: "2026-09-28T20:00:00.000Z" } });
      const otra = await pedir(ciro.cookie, "POST", `/api/visitas/${abierta.id}/terminar`, { llave: randomUUID(), en: "2026-09-28T16:30:00-05:00" });
      expect(otra.json()).toEqual({ terminada: { en: "2026-09-28T20:00:00.000Z" } });
      expect((await conHorario([ciro.id], "16:00", "17:00", "2026-09-28")).statusCode).toBe(201);
    }
  });

  it("reprogramar a una hora ocupada se rechaza; el teléfono recibe el horario", async () => {
    const dora = await nuevoTecnico("Dora Técnica");
    await conHorario([dora.id], "08:00", "10:00", "2026-11-05");
    const otra = (await conHorario([dora.id], "13:00", "15:00", "2026-11-05")).json();
    const r = await pedir(org.oficina.cookie, "POST", `/api/visitas/${otra.id}/reprogramar`, { version: 1, programadaPara: "2026-11-05", horaInicio: "09:00", horaFin: "11:00", motivo: "Mantenimiento" });
    expect(r.json().codigo).toBe("tecnico_ocupado");
    const ok = await pedir(org.oficina.cookie, "POST", `/api/visitas/${otra.id}/reprogramar`, { version: 1, programadaPara: "2026-11-05", horaInicio: "10:00", horaFin: null, motivo: "Mantenimiento" });
    expect(ok.json()).toMatchObject({ horaInicio: "10:00", horaFin: null });
  });
});
