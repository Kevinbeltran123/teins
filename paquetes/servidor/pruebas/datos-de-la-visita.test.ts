import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { crearVisitas } from "../src/modulos/visitas";
import { clientesYSitios } from "../src/modulos/clientes";
import { cabecerasSync, ORIGEN, servidorDePrueba } from "./ayudas";

/*
  Los datos que el informe de TEINS pide de la visita (iteración 47, ADR-0051): el NIT del cliente, la ciudad del sitio,
  el solicitante, la referencia del cliente y el número de orden de servicio, y la cédula de las cuentas.
*/

const s = await servidorDePrueba();
const { app } = s;
const org = await s.nuevaOrganizacionConUsuarios();
const admin = await s.nuevoAdministrador(org.organizacionId);

const pedir = (cookie: string, method: "GET" | "POST", url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });
const bajar = (cookie: string, desde = 0) => app.inject({ method: "GET", url: `/api/sync/cambios?desde=${desde}&app=15`, headers: { cookie, ...cabecerasSync } });

const contacto = (nombre: string, extra: object = {}) => ({ nombre, cargo: "Mantenimiento", celular: "+573105550142", recibeCorreo: false, recibeWhatsapp: false, recibeInformes: true, recibeCotizaciones: false, ...extra });

async function clienteConSitio(extra: { nit?: string; ciudad?: string; contactos?: string[] } = {}) {
  const nombre = `Cliente ${randomUUID().slice(0, 6)}`;
  const r = await pedir(org.oficina.cookie, "POST", "/api/clientes", {
    nombre,
    ...(extra.nit ? { nit: extra.nit } : {}),
    sitio: { nombre: "Sede", direccion: "Calle [N] # [N]-[N]", ...(extra.ciudad ? { ciudad: extra.ciudad } : {}) },
  });
  expect(r.statusCode, r.body).toBe(201);
  const cliente = r.json() as { id: string; sitios: { id: string }[] };
  const contactos: { id: string; nombre: string }[] = [];
  for (const nombreDeContacto of extra.contactos ?? []) {
    const c = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/contactos`, contacto(nombreDeContacto, { celular: "+573105550142" }));
    expect(c.statusCode, c.body).toBe(201);
    contactos.push(...(c.json().contactos as { id: string; nombre: string }[]).filter((x) => x.nombre === nombreDeContacto));
  }
  return { ...cliente, contactos };
}

/** Un día distinto por visita: las de todo el día del mismo técnico no se cruzan (ADR-0037). */
let dias = 0;
const diaNuevo = () => new Date(Date.UTC(2027, 0, 1 + dias++)).toISOString().slice(0, 10);
const programar = (cliente: { id: string; sitios: { id: string }[] }, extra: object = {}, cookie = org.oficina.cookie, dia = diaNuevo()) =>
  pedir(cookie, "POST", "/api/visitas", { clienteId: cliente.id, sitioId: cliente.sitios[0]!.id, formato: "prueba-ups", programadaPara: dia, tecnicos: [org.tecnico.id], ...extra });

describe("el NIT del cliente y la ciudad del sitio", () => {
  it("se escriben al crear, se corrigen y salen en el detalle y en la lista", async () => {
    const cliente = await clienteConSitio({ nit: "900.123.456-7", ciudad: "Ibagué" });
    const lista = (await pedir(org.oficina.cookie, "GET", "/api/clientes")).json().clientes.find((c: { id: string }) => c.id === cliente.id);
    expect(lista).toMatchObject({ nit: "900.123.456-7", sitios: [{ nombre: "Sede", ciudad: "Ibagué" }] });

    const editado = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}`, { nombre: lista.nombre, nit: "900.999.888-1" });
    expect(editado.statusCode, editado.body).toBe(200);
    expect(editado.json()).toMatchObject({ nit: "900.999.888-1" });
    const sitio = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/sitios/${cliente.sitios[0]!.id}`, { nombre: "Sede", direccion: "Calle [N] # [N]-[N]", ciudad: "Bogotá" });
    expect(sitio.json().sitios[0]).toMatchObject({ ciudad: "Bogotá" });

    // Sin escribirlo, el dato queda vacío y no se inventa; sin mandarlo al corregir, no se borra.
    const sinDatos = await clienteConSitio();
    expect((await pedir(org.oficina.cookie, "GET", `/api/clientes/${sinDatos.id}`)).json()).toMatchObject({ nit: null, sitios: [{ ciudad: null }] });
    const igual = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}`, { nombre: lista.nombre });
    expect(igual.json()).toMatchObject({ nit: "900.999.888-1" });
    const vacio = await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}`, { nombre: lista.nombre, nit: null });
    expect(vacio.json()).toMatchObject({ nit: null });
  });
});

describe("el número de orden de servicio", () => {
  it("dos visitas seguidas reciben números consecutivos; reprogramar y cancelar no lo cambian ni lo reutilizan", async () => {
    const cliente = await clienteConSitio();
    const a = (await programar(cliente)).json();
    const b = (await programar(cliente)).json();
    expect(typeof a.ordenDeServicio).toBe("number");
    expect(b.ordenDeServicio).toBe(a.ordenDeServicio + 1);

    const r = await pedir(org.oficina.cookie, "POST", `/api/visitas/${a.id}/reprogramar`, { version: a.version, programadaPara: a.programadaPara, motivo: "Mantenimiento" });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().ordenDeServicio).toBe(a.ordenDeServicio);

    const c = (await programar(cliente)).json();
    await pedir(org.oficina.cookie, "POST", `/api/visitas/${c.id}/cancelar`, { version: c.version, motivo: "El cliente la aplazó" });
    const d = (await programar(cliente)).json();
    // La cancelada conserva su número: el siguiente no lo recupera.
    expect(d.ordenDeServicio).toBe(c.ordenDeServicio + 1);
  });

  it("cada organización lleva su propia cuenta", async () => {
    const otra = await s.nuevaOrganizacionConUsuarios();
    const cliente = await pedir(otra.oficina.cookie, "POST", "/api/clientes", { nombre: "Otro cliente", sitio: { nombre: "Sede", direccion: "Calle [N]" } });
    const { id, sitios } = cliente.json();
    const primera = await programar({ id, sitios }, { tecnicos: [otra.tecnico.id] }, otra.oficina.cookie);
    expect(primera.json().ordenDeServicio).toBe(1);
  });

  it("el comando fija desde cuál sigue y nunca baja el número", async () => {
    const otra = await s.nuevaOrganizacionConUsuarios();
    const visitas = crearVisitas(clientesYSitios);
    const fijar = (ultimo: number) => enOrganizacion(s.conexionApp.bd, otra.organizacionId, (tx) => visitas.fijarConsecutivoDeOrdenes(tx, otra.organizacionId, ultimo));
    await fijar(773);
    const cliente = (await pedir(otra.oficina.cookie, "POST", "/api/clientes", { nombre: "Cliente 774", sitio: { nombre: "Sede", direccion: "Calle [N]" } })).json();
    const primera = (await programar(cliente, { tecnicos: [otra.tecnico.id] }, otra.oficina.cookie)).json();
    expect(primera.ordenDeServicio).toBe(774);
    await expect(fijar(100)).rejects.toThrow(/no puede bajar/i);
    await expect(fijar(774)).rejects.toThrow(/no puede bajar/i);
    await fijar(800);
    const segunda = (await programar(cliente, { tecnicos: [otra.tecnico.id] }, otra.oficina.cookie)).json();
    expect(segunda.ordenDeServicio).toBe(801);
  });

  it("las visitas anteriores a esta iteración quedan sin número", async () => {
    const cliente = await clienteConSitio();
    const id = randomUUID();
    await s.propietario.pool.query(
      "insert into visitas.visitas (id, organizacion_id, cliente_id, sitio_id, motivo, programada_para, tecnicos) values ($1, $2, $3, $4, 'Antigua', '2026-09-01', $5)",
      [id, org.organizacionId, cliente.id, cliente.sitios[0]!.id, [org.tecnico.id]],
    );
    const lista = (await pedir(org.oficina.cookie, "GET", "/api/visitas?vista=anteriores&hoy=2026-12-31")).json().visitas;
    expect(lista.find((v: { id: string }) => v.id === id)).toMatchObject({ ordenDeServicio: null, solicitante: null, referencia: null });
  });
});

describe("el solicitante y la referencia", () => {
  it("salen en la lista de oficina y en el teléfono del técnico, con su nombre, cargo y celular", async () => {
    const cliente = await clienteConSitio({ nit: "900.123.456-7", ciudad: "Ibagué", contactos: ["Laura Gómez"] });
    const laura = cliente.contactos[0]!;
    const r = await programar(cliente, { solicitanteId: laura.id, referencia: "TKT-4821" });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({ solicitante: { id: laura.id, nombre: "Laura Gómez", cargo: "Mantenimiento", celular: "+573105550142" }, referencia: "TKT-4821" });

    const bajada = (await bajar(org.tecnico.cookie)).json();
    const visita = bajada.cambios.find((c: { tipo: string; visita: { id: string } }) => c.tipo === "visita" && c.visita.id === r.json().id).visita;
    expect(visita).toMatchObject({
      ordenDeServicio: r.json().ordenDeServicio,
      referencia: "TKT-4821",
      cliente: { nit: "900.123.456-7" },
      sitio: { ciudad: "Ibagué" },
      solicitante: { nombre: "Laura Gómez", cargo: "Mantenimiento", celular: "+573105550142" },
    });
  });

  it("el solicitante de otro cliente se rechaza", async () => {
    const uno = await clienteConSitio({ contactos: ["Persona de uno"] });
    const otro = await clienteConSitio();
    const r = await programar(otro, { solicitanteId: uno.contactos[0]!.id });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject({ codigo: "entrada_invalida" });
  });

  it("al reprogramar se cambian o se quitan; sin mandarlos, se conservan", async () => {
    const cliente = await clienteConSitio({ contactos: ["Laura Gómez", "Mario Ruiz"] });
    const laura = cliente.contactos[0]!;
    const mario = cliente.contactos[1]!;
    const v = (await programar(cliente, { solicitanteId: laura.id, referencia: "A-1" })).json();
    const reprogramar = (version: number, extra: object) => pedir(org.oficina.cookie, "POST", `/api/visitas/${v.id}/reprogramar`, { version, programadaPara: v.programadaPara, motivo: "Mantenimiento", ...extra });

    const conservada = (await reprogramar(v.version, {})).json();
    expect(conservada).toMatchObject({ solicitante: { nombre: "Laura Gómez" }, referencia: "A-1" });
    const cambiada = (await reprogramar(conservada.version, { solicitanteId: mario.id, referencia: "B-2" })).json();
    expect(cambiada).toMatchObject({ solicitante: { nombre: "Mario Ruiz" }, referencia: "B-2" });
    const quitada = (await reprogramar(cambiada.version, { solicitanteId: null, referencia: null })).json();
    expect(quitada).toMatchObject({ solicitante: null, referencia: null });
  });

  it("un contacto que oficina quitó conserva el nombre pero no el celular", async () => {
    const cliente = await clienteConSitio({ contactos: ["Laura Gómez"] });
    const laura = cliente.contactos[0]!;
    const v = (await programar(cliente, { solicitanteId: laura.id })).json();
    expect((await pedir(org.oficina.cookie, "POST", `/api/clientes/${cliente.id}/contactos/${laura.id}/quitar`)).statusCode).toBe(200);
    const bajada = (await bajar(org.tecnico.cookie)).json();
    const visita = bajada.cambios.find((c: { tipo: string; visita: { id: string } }) => c.tipo === "visita" && c.visita.id === v.id)?.visita;
    // Si el cambio ya bajó antes de quitarlo, la lista de oficina es la que cuenta.
    const lista = (await pedir(org.oficina.cookie, "GET", "/api/visitas?vista=proximas&hoy=2026-09-01")).json().visitas.find((x: { id: string }) => x.id === v.id);
    expect((visita ?? lista).solicitante).toMatchObject({ nombre: "Laura Gómez" });
    expect((visita ?? lista).solicitante.celular ?? null).toBeNull();
  });
});

describe("la cédula de las cuentas", () => {
  const crear = (extra: object = {}) => pedir(admin.cookie, "POST", "/api/administracion/usuarios", { usuario: `ana.${randomUUID().slice(0, 8)}`, nombre: "Ana Prueba", rol: "tecnico", ...extra });

  it("la pone y la cambia un administrador; la ve solo él y su cambio queda en la auditoría sin el valor", async () => {
    const creada = await crear({ documento: "52123456" });
    expect(creada.statusCode, creada.body).toBe(201);
    const id = creada.json().usuario.id as string;
    expect(creada.json().usuario).toMatchObject({ documento: "52123456" });

    const cambio = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${id}/documento`, { documento: "79888777" });
    expect(cambio.statusCode, cambio.body).toBe(200);
    expect(cambio.json()).toMatchObject({ documento: "79888777" });
    const lista = (await pedir(admin.cookie, "GET", "/api/administracion/usuarios")).json().usuarios.find((u: { id: string }) => u.id === id);
    expect(lista).toMatchObject({ documento: "79888777" });

    // Nadie más lo ve ni lo cambia: ni oficina sin la marca, ni un técnico.
    expect((await pedir(org.oficina.cookie, "POST", `/api/administracion/usuarios/${id}/documento`, { documento: "11111111" })).statusCode).toBe(403);
    expect((await pedir(org.tecnico.cookie, "GET", "/api/administracion/usuarios")).statusCode).toBe(403);
    const tecnicos = (await pedir(org.oficina.cookie, "GET", "/api/tecnicos")).json();
    expect(JSON.stringify(tecnicos)).not.toContain("79888777");

    // La auditoría dice que cambió, nunca a qué valor.
    const { rows } = await s.propietario.pool.query("select tipo_evento, valor_anterior, valor_nuevo, ruta_campo from auditoria.registros where agregado_id = $1 order by secuencia", [id]);
    expect(rows.map((f) => f.tipo_evento)).toContain("documento_cambiado");
    expect(JSON.stringify(rows)).not.toMatch(/79888777|52123456/);
  });

  it("solo con cédula válida y solo para su organización", async () => {
    const creada = await crear();
    const id = creada.json().usuario.id as string;
    expect(creada.json().usuario).toMatchObject({ documento: null });
    for (const mal of ["1234", "52.123.456", "abcdefgh", "1234567890123"]) {
      expect((await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${id}/documento`, { documento: mal })).statusCode, mal).toBe(400);
    }
    const quitada = await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${id}/documento`, { documento: null });
    expect(quitada.json()).toMatchObject({ documento: null });
    const otra = await s.nuevaOrganizacionConUsuarios();
    expect((await pedir(admin.cookie, "POST", `/api/administracion/usuarios/${otra.tecnico.id}/documento`, { documento: "52123456" })).statusCode).toBe(404);
  });
});
