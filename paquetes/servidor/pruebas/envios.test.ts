import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import { almacenamientoS3, claveDeObjeto, type Almacenamiento } from "../src/plataforma/almacenamiento";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearVisitas } from "../src/modulos/visitas";
import { crearEnvios, proveedoresSegunConfig, RechazoDefinitivo, type ProveedorDeCorreo, type ProveedorDeWhatsapp } from "../src/modulos/envios";
import { firmaMetaValida, firmaSvixValida } from "../src/modulos/envios/eventos";
import { asunto, htmlDeCorreo, textoDeCorreo, variablesDeWhatsapp } from "@teins/documentos";
import type { CorreoSaliente, WhatsappSaliente } from "../src/modulos/envios/proveedores";
import { cabecerasSync, configDePrueba, servidorDePrueba } from "./ayudas";

const SECRETO_RESEND = `whsec_${randomBytes(24).toString("base64")}`;
const SECRETO_META = randomBytes(16).toString("hex");
const TOKEN_VERIFICACION = randomBytes(16).toString("hex");

/** Proveedores falsos que guardan lo que saldría; una dirección con "rebota" se rechaza como lo haría el real. */
const correos: CorreoSaliente[] = [];
const whatsapps: WhatsappSaliente[] = [];
/** Lo que pasa mientras Resend recibe un correo: para probar lo que ocurre justo cuando sale. */
let alSalir: (() => Promise<void>) | undefined;
const correo: ProveedorDeCorreo = async (c) => {
  if (c.para.includes("rebota")) throw new RechazoDefinitivo("Resend lo rechazó: dirección inválida");
  await alSalir?.();
  correos.push(c);
  return { id: `correo-${randomUUID()}` };
};
const whatsapp: ProveedorDeWhatsapp = async (m) => {
  whatsapps.push(m);
  // Meta lo aceptó pero la respuesta no llegó: no se sabe si salió.
  if (m.para.endsWith("0199")) throw new Error("The operation was aborted due to timeout");
  return { id: `wamid.${randomUUID()}` };
};

const s = await servidorDePrueba({
  proveedoresDeEnvio: { correo, whatsapp },
  config: { RESEND_SECRETO_EVENTOS: SECRETO_RESEND, WHATSAPP_SECRETO_APP: SECRETO_META, WHATSAPP_TOKEN_VERIFICACION: TOKEN_VERIFICACION, PORTAL_URL: "https://portal.example.com" },
});
const { app } = s;
const visitas = crearVisitas(clientesYSitios);

const post = (cookie: string, url: string, payload: object = {}) => app.inject({ method: "POST", url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: "GET", url, headers: { cookie } });

const ANA = { nombre: "Ana Torres", cargo: "Jefa de mantenimiento", correo: "ana@cliente.example", celular: "+573005550117", recibeCorreo: true, recibeWhatsapp: true, whatsappAutorizado: true };
const JORGE = { nombre: "Jorge Pardo", cargo: "", correo: "rebota@cliente.example", celular: null, recibeCorreo: true, recibeWhatsapp: false };

/** Visita con un levantamiento revisado, su informe en borrador y un cliente sin contactos todavía. */
async function informeListoParaPublicar() {
  const org = await s.nuevaOrganizacionConUsuarios();
  const { visitaId, clienteId } = await enOrganizacion(s.conexionApp.bd, org.organizacionId, async (tx) => {
    const creado = await clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre: "Clínica ficticia", sitio: { nombre: "Sede Norte", direccion: "Calle [N]" } });
    const visitaId = await visitas.crear(tx, { organizacionId: org.organizacionId, autorId: "prueba", correlacion: "prueba", clienteId: creado.clienteId, sitioId: creado.sitioId, motivo: "Mantenimiento UPS", programadaPara: "2026-10-03", tecnicos: [org.tecnico.id] });
    return { visitaId, clienteId: creado.clienteId };
  });
  const levantamientoId = randomUUID();
  const enviado = await app.inject({
    method: "POST",
    url: "/api/sync/comandos",
    headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
    payload: {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(levantamientoId),
      levantamiento: {
        id: levantamientoId,
        formato: "prueba-ups",
        versionFormato: 1,
        visitaId,
        respuestas: { cuarto_tecnico: { potencia_nominal: { valor: "12.5", unidad: "kVA" } } },
        creadoEn: "2026-10-03T10:00:00.000-05:00",
        enviadoEn: "2026-10-03T11:00:00.000-05:00",
      },
    },
  });
  expect(enviado.statusCode, enviado.body).toBe(200);
  expect((await post(org.oficina.cookie, `/api/levantamientos/${levantamientoId}/tomar`, { version: 1 })).statusCode).toBe(200);
  expect((await post(org.oficina.cookie, `/api/levantamientos/${levantamientoId}/marcar-revisado`, { version: 2 })).statusCode).toBe(200);
  const { id: informeId } = (await post(org.oficina.cookie, "/api/informes", { visitaId })).json();
  expect((await post(org.oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "", conclusiones: "", levantamientos: [levantamientoId], planos: [] })).statusCode).toBe(200);
  return { ...org, clienteId, informeId };
}

async function crearContacto(cookie: string, clienteId: string, datos: object) {
  const r = await post(cookie, `/api/clientes/${clienteId}/contactos`, datos);
  expect(r.statusCode, r.body).toBe(201);
  return r.json().contactos as { id: string; nombre: string }[];
}

const enviosDe = async (cookie: string, informeId: string, numero = 1) =>
  ((await get(cookie, `/api/informes/${informeId}`)).json().versiones as { numero: number; envios: { id: string; contacto: { nombre: string }; canal: string; estado: string; error: string | null; destino: string }[] }[]).find((v) => v.numero === numero)!.envios;

function firmarResend(cuerpo: string, hora = Math.floor(Date.now() / 1000)) {
  const id = `msg_${randomUUID()}`;
  const firma = createHmac("sha256", Buffer.from(SECRETO_RESEND.slice(6), "base64")).update(`${id}.${hora}.${cuerpo}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": String(hora), "svix-signature": `v1,${firma}`, "content-type": "application/json" };
}
const eventoResend = (tipo: string, organizacionId: string, envio: { id: string; proveedorId: string }, extra: object = {}) =>
  JSON.stringify({ type: tipo, created_at: new Date().toISOString(), data: { email_id: envio.proveedorId, tags: { organizacion: organizacionId, envio: envio.id }, ...extra } });

describe("contactos del cliente (iteración 20)", () => {
  it("se crean, cambian y quitan; WhatsApp exige la autorización y queda con quién y cuándo", async () => {
    const { oficina, clienteId } = await informeListoParaPublicar();
    const sinAutorizar = await post(oficina.cookie, `/api/clientes/${clienteId}/contactos`, { ...ANA, whatsappAutorizado: false });
    expect(sinAutorizar.json()).toMatchObject({ codigo: "entrada_invalida" });
    expect(JSON.stringify(sinAutorizar.json())).toContain("whatsappAutorizado");

    const [ana] = await crearContacto(oficina.cookie, clienteId, ANA);
    expect(ana).toMatchObject({ nombre: "Ana Torres", correo: "ana@cliente.example", celular: "+573005550117", whatsappAutorizado: { por: { nombre: "Oficina de prueba" } }, correoRebotado: null });
    const lista = (await get(oficina.cookie, "/api/clientes")).json().clientes;
    expect(lista.find((c: { id: string }) => c.id === clienteId).reciben).toBe(1);

    // Otro celular pide autorizar de nuevo: la autorización era para el número anterior.
    const otroNumero = await post(oficina.cookie, `/api/clientes/${clienteId}/contactos/${ana!.id}`, { ...ANA, celular: "+573105550142", whatsappAutorizado: false });
    expect(otroNumero.json()).toMatchObject({ codigo: "entrada_invalida" });
    const sinWhatsapp = await post(oficina.cookie, `/api/clientes/${clienteId}/contactos/${ana!.id}`, { ...ANA, celular: "+573105550142", recibeWhatsapp: false, whatsappAutorizado: false });
    expect(sinWhatsapp.statusCode, sinWhatsapp.body).toBe(200);
    expect(sinWhatsapp.json().contactos[0]).toMatchObject({ celular: "+573105550142", recibeWhatsapp: false, whatsappAutorizado: null });

    const quitado = await post(oficina.cookie, `/api/clientes/${clienteId}/contactos/${ana!.id}/quitar`);
    expect(quitado.json().contactos).toEqual([]);
    const { rows } = await s.propietario.pool.query("select tipo_evento, valor_anterior, valor_nuevo from auditoria.registros where agregado_id = $1 order by secuencia", [clienteId]);
    expect(rows.map((r) => r.tipo_evento)).toEqual(expect.arrayContaining(["contacto_creado", "contacto_editado", "contacto_quitado"]));
    // La auditoría no se puede borrar: guarda el correo y el celular enmascarados, así quitar el contacto sí los borra.
    const auditado = JSON.stringify(rows);
    for (const dato of ["ana@cliente.example", "+573005550117", "+573105550142"]) expect(auditado).not.toContain(dato);
    expect(rows.find((r) => r.tipo_evento === "contacto_editado")).toMatchObject({
      valor_anterior: { correo: "a•••@cliente.example", celular: "•••0117" },
      valor_nuevo: { correo: "a•••@cliente.example", celular: "•••0142" },
    });
  });

  it("el técnico no ve ni cambia contactos", async () => {
    const { tecnico, clienteId } = await informeListoParaPublicar();
    expect((await get(tecnico.cookie, `/api/clientes/${clienteId}`)).statusCode).toBe(403);
    expect((await post(tecnico.cookie, `/api/clientes/${clienteId}/contactos`, ANA)).statusCode).toBe(403);
  });
});

describe("envío del informe al cliente (ADR-0028)", () => {
  it("los envíos esperan el PDF y salen con el adjunto por correo y WhatsApp", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, ANA);
    const publicada = await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [ana!.id] });
    expect(publicada.statusCode, publicada.body).toBe(201);
    expect((await enviosDe(oficina.cookie, informeId)).map((e) => [e.canal, e.estado])).toEqual(
      expect.arrayContaining([
        ["correo", "en_cola"],
        ["whatsapp", "en_cola"],
      ]),
    );

    await s.esperarPdf({ informeId });
    await s.procesarCola();
    const envios = await enviosDe(oficina.cookie, informeId);
    expect(envios.map((e) => e.estado)).toEqual(["enviado", "enviado"]);

    const alCorreo = correos.find((c) => c.etiquetas["envio"] === envios.find((e) => e.canal === "correo")!.id)!;
    expect(alCorreo).toMatchObject({ para: "ana@cliente.example", asunto: "Informe de la visita del 3 oct 2026 · Sede Norte", adjunto: { nombre: "Informe Clínica ficticia - Sede Norte - versión 1.pdf" } });
    expect(alCorreo.adjunto!.contenido.subarray(0, 5).toString()).toBe("%PDF-");
    expect(alCorreo.texto).toContain("Hola, Ana:");
    expect(alCorreo.html).toContain("https://portal.example.com");

    const alWhatsapp = whatsapps.find((m) => m.referencia.endsWith(envios.find((e) => e.canal === "whatsapp")!.id))!;
    expect(alWhatsapp).toMatchObject({ para: "+573005550117", plantilla: "informe_publicado", idioma: "es", variables: ["Ana", "3 oct 2026", "Sede Norte", "1"] });
  }, 90_000);

  it("lo que no llega queda con su motivo, se marca en la bandeja y se vuelve a enviar", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const contactos = await crearContacto(oficina.cookie, clienteId, JORGE);
    const jorge = contactos.find((c) => c.nombre === "Jorge Pardo")!;
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [jorge.id] });
    await s.esperarPdf({ informeId });
    await s.procesarCola();

    const [fallido] = await enviosDe(oficina.cookie, informeId);
    expect(fallido).toMatchObject({ estado: "fallido", error: "Resend lo rechazó: dirección inválida" });
    const bandeja = async () => (await get(oficina.cookie, "/api/informes")).json().elementos.find((e: { id: string }) => e.id === informeId);
    expect(await bandeja()).toMatchObject({ envioSinEntregar: true });

    // Oficina corrige la dirección y vuelve a enviar solo ese canal: el intento anterior se conserva.
    await post(oficina.cookie, `/api/clientes/${clienteId}/contactos/${jorge.id}`, { ...JORGE, correo: "jorge@cliente.example" });
    const reenvio = await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: jorge.id, canal: "correo" }] });
    expect(reenvio.statusCode, reenvio.body).toBe(200);
    await s.procesarCola();
    expect((await enviosDe(oficina.cookie, informeId)).map((e) => [e.destino, e.estado])).toEqual([
      ["jorge@cliente.example", "enviado"],
      ["rebota@cliente.example", "fallido"],
    ]);
    expect(await bandeja()).toMatchObject({ envioSinEntregar: false });
  }, 90_000);

  it("lo que no llegó deja de contar como sin entregar si oficina quita al contacto o deja de enviarle por ese canal", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const jorge = (await crearContacto(oficina.cookie, clienteId, JORGE)).find((c) => c.nombre === "Jorge Pardo")!;
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [jorge.id] });
    await s.esperarPdf({ informeId });
    await s.procesarCola();
    const bandeja = async () => (await get(oficina.cookie, "/api/informes")).json().elementos.find((e: { id: string }) => e.id === informeId);
    expect(await bandeja()).toMatchObject({ envioSinEntregar: true });

    // Ya no recibe por correo: «Volver a enviar» por ese canal no se puede, así que no queda nada pendiente.
    const sinCorreo = await post(oficina.cookie, `/api/clientes/${clienteId}/contactos/${jorge.id}`, { ...JORGE, recibeCorreo: false, celular: "+573005550121", recibeWhatsapp: true, whatsappAutorizado: true });
    expect(sinCorreo.statusCode, sinCorreo.body).toBe(200);
    expect(await bandeja()).toMatchObject({ envioSinEntregar: false });
    // Vuelve a recibir por correo en la misma dirección: lo que no le llegó vuelve a estar pendiente.
    expect((await post(oficina.cookie, `/api/clientes/${clienteId}/contactos/${jorge.id}`, JORGE)).statusCode).toBe(200);
    expect(await bandeja()).toMatchObject({ envioSinEntregar: true });

    // Quitado, ya no es contacto del cliente: la alerta no se podría quitar nunca.
    expect((await post(oficina.cookie, `/api/clientes/${clienteId}/contactos/${jorge.id}/quitar`)).statusCode).toBe(200);
    expect(await bandeja()).toMatchObject({ envioSinEntregar: false });
    // El intento se conserva como constancia.
    expect((await enviosDe(oficina.cookie, informeId)).map((e) => [e.contacto.nombre, e.estado])).toEqual([["Jorge Pardo", "fallido"]]);
  }, 90_000);

  it("el correo sale con el asunto y el texto que escribió oficina; el WhatsApp, con su plantilla (ADR-0036)", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, correo: "ana.propio@cliente.example", celular: "+573005550118" });
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] });
    await s.esperarPdf({ informeId });
    const mensaje = { asunto: "Informe de su UPS", texto: "Le dejamos el informe de la visita.\n\nCualquier duda <nos escribe>." };
    const r = await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: ana!.id }], llave: randomUUID(), mensaje });
    expect(r.statusCode, r.body).toBe(200);
    await s.procesarCola();
    const envios = (await get(oficina.cookie, `/api/informes/${informeId}`)).json().versiones[0].envios as { id: string; canal: string; personalizado: boolean }[];
    expect(envios.map((e) => [e.canal, e.personalizado]).sort()).toEqual([
      ["correo", true],
      ["whatsapp", false],
    ]);
    const alCorreo = correos.find((c) => c.para === "ana.propio@cliente.example")!;
    expect(alCorreo.asunto).toBe("Informe de su UPS");
    expect(alCorreo.texto).toContain("Hola, Ana:\n\nLe dejamos el informe de la visita.");
    expect(alCorreo.html).toContain("Cualquier duda &lt;nos escribe&gt;.");
    // El portal y el pie los sigue poniendo la plantilla.
    expect(alCorreo.html).toContain("https://portal.example.com");
    const alWhatsapp = whatsapps.find((m) => m.para === "+573005550118")!;
    expect(alWhatsapp.plantilla).toBe("informe_publicado");

    // Un asunto vacío no se acepta: no saldría nada que oficina no escribió.
    const vacio = await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: ana!.id }], llave: randomUUID(), mensaje: { asunto: " ", texto: "Hola" } });
    expect(vacio.statusCode).toBe(400);
  }, 90_000);

  it("el mismo pedido con su llave (doble clic, respuesta perdida) sale una sola vez; otra llave es otra decisión (regla 4)", async () => {
    const { oficina, clienteId, informeId, organizacionId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, correo: "ana.llave@cliente.example" });
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] });
    await s.esperarPdf({ informeId });

    const pedido = { destinos: [{ contactoId: ana!.id, canal: "correo" }], llave: randomUUID() };
    const url = `/api/informes/${informeId}/versiones/1/enviar`;
    // Doble clic: llegan juntos.
    const dobles = await Promise.all([post(oficina.cookie, url, pedido), post(oficina.cookie, url, pedido)]);
    for (const r of dobles) expect(r.statusCode, r.body).toBe(200);
    await s.procesarCola();
    // La respuesta se perdió y oficina reintenta cuando ya salió.
    expect((await post(oficina.cookie, url, pedido)).statusCode).toBe(200);
    await s.procesarCola();
    expect(await enviosDe(oficina.cookie, informeId)).toHaveLength(1);
    expect(correos.filter((c) => c.para === "ana.llave@cliente.example")).toHaveLength(1);

    // Volver a enviar es una decisión nueva, con otra llave: sí sale.
    expect((await post(oficina.cookie, url, { ...pedido, llave: randomUUID() })).statusCode).toBe(200);
    expect(await enviosDe(oficina.cookie, informeId)).toHaveLength(2);
    const { rows } = await s.propietario.pool.query("select count(*)::int as n from auditoria.registros where organizacion_id = $1 and tipo_evento = 'informe_enviado'", [organizacionId]);
    expect(rows[0].n).toBe(2);
  }, 90_000);

  it("no envía a contactos de otro cliente, ni por un canal que no recibe, ni una versión retirada", async () => {
    const otro = await informeListoParaPublicar();
    const [ajeno] = await crearContacto(otro.oficina.cookie, otro.clienteId, ANA);
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const contactos = await crearContacto(oficina.cookie, clienteId, JORGE);
    const jorge = contactos[0]!;
    // De otra organización: la seguridad por fila ni siquiera lo deja ver.
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [ajeno!.id] })).json()).toMatchObject({ codigo: "entrada_invalida" });
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] })).statusCode).toBe(201);
    expect((await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: jorge.id, canal: "whatsapp" }] })).json()).toMatchObject({ codigo: "entrada_invalida" });

    const admin = await s.nuevoAdministrador(await organizacionDe(informeId));
    expect((await post(admin.cookie, `/api/informes/${informeId}/versiones/1/retirar`, { motivo: "Prueba" })).statusCode).toBe(200);
    expect((await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: jorge.id }] })).json()).toMatchObject({
      codigo: "estado_invalido",
      detail: "La versión está retirada del portal: publique una nueva para enviarla",
    });
  }, 90_000);

  it("si no se sabe si WhatsApp lo recibió, no lo manda otra vez", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, celular: "+573005550199", recibeCorreo: false });
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [ana!.id] });
    await s.esperarPdf({ informeId });
    await s.procesarCola();
    const [envio] = await enviosDe(oficina.cookie, informeId);
    expect(whatsapps.filter((m) => m.referencia.endsWith(envio!.id))).toHaveLength(1);
    expect(envio!.estado).toBe("enviado");
  }, 90_000);

  it("enviar otra vez mientras el PDF queda listo no deja el envío en cola para siempre", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, recibeWhatsapp: false });
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] });
    await s.esperarPdf({ informeId });
    // El trabajo del PDF está por confirmar "listo" justo cuando oficina pide enviar.
    await s.propietario.pool.query("update informes.versiones set pdf_estado = 'generando' where informe_id = $1", [informeId]);
    const cliente = await s.propietario.pool.connect();
    try {
      await cliente.query("begin");
      await cliente.query("select id from informes.versiones where informe_id = $1 for update", [informeId]);
      const envio = post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: ana!.id }] });
      await new Promise((r) => setTimeout(r, 300));
      await cliente.query("update informes.versiones set pdf_estado = 'listo' where informe_id = $1", [informeId]);
      await cliente.query("commit");
      expect((await envio).statusCode).toBe(200);
    } finally {
      cliente.release();
    }
    await s.procesarCola();
    expect((await enviosDe(oficina.cookie, informeId)).map((e) => e.estado)).toEqual(["enviado"]);
  }, 90_000);

  it("retirar la versión antes de que el PDF esté listo cancela sus envíos en cola, sin poder reanudarlos (ADR-0047)", async () => {
    const { oficina, clienteId, informeId, organizacionId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, ANA);
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [ana!.id] })).statusCode).toBe(201);
    const admin = await s.nuevoAdministrador(organizacionId);
    expect((await post(admin.cookie, `/api/informes/${informeId}/versiones/1/retirar`, { motivo: "Tenía un error" })).statusCode).toBe(200);

    await s.esperarPdf({ informeId });
    await s.procesarCola();
    const envios = await enviosDe(oficina.cookie, informeId);
    expect(envios).toEqual([
      expect.objectContaining({ estado: "cancelado", error: "Versión retirada", cancelado: expect.objectContaining({ por: expect.objectContaining({ nombre: "Administradora de prueba" }) }) }),
      expect.objectContaining({ estado: "cancelado", error: "Versión retirada" }),
    ]);
    expect(correos.some((c) => envios.some((e) => e.id === c.etiquetas["envio"]))).toBe(false);
    expect((await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/envios/${envios[0]!.id}/reanudar`)).json()).toMatchObject({ codigo: "estado_invalido" });
  }, 90_000);

  it("un contacto quitado mientras su envío espera el PDF no lo recibe", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, ANA);
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [ana!.id] });
    expect((await post(oficina.cookie, `/api/clientes/${clienteId}/contactos/${ana!.id}/quitar`)).statusCode).toBe(200);

    await s.esperarPdf({ informeId });
    await s.procesarCola();
    const envios = await enviosDe(oficina.cookie, informeId);
    expect(envios.map((e) => e.estado)).toEqual(["fallido", "fallido"]);
    expect(whatsapps.some((m) => envios.some((e) => m.referencia.endsWith(e.id)))).toBe(false);
  }, 90_000);

  it("una versión cuyo PDF no se pudo generar no se envía: su envío quedaría en cola para siempre", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, ANA);
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] });
    await s.esperarPdf({ informeId });
    await s.propietario.pool.query("update informes.versiones set pdf_estado = 'fallido' where informe_id = $1", [informeId]);

    const envio = await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: ana!.id }] });
    expect(envio.json()).toMatchObject({ codigo: "estado_invalido" });
    expect(await enviosDe(oficina.cookie, informeId)).toEqual([]);
  }, 90_000);

  it("retirar la versión mientras una copia sale no la da por no enviada: salió", async () => {
    const { oficina, clienteId, informeId, organizacionId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, recibeWhatsapp: false });
    const admin = await s.nuevoAdministrador(organizacionId);
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] });
    await s.esperarPdf({ informeId });
    await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: ana!.id }] });

    let retiro: number | undefined;
    alSalir = async () => {
      alSalir = undefined;
      retiro = (await post(admin.cookie, `/api/informes/${informeId}/versiones/1/retirar`, { motivo: "Tenía un error" })).statusCode;
    };
    await s.procesarCola();
    expect(retiro).toBe(200);
    expect(await enviosDe(oficina.cookie, informeId)).toEqual([expect.objectContaining({ estado: "enviado", error: null })]);
  }, 90_000);

  it("retirar la versión mientras una copia sale y el proveedor la rechaza: queda cancelada, no «No llegó» (ADR-0047)", async () => {
    const { oficina, clienteId, informeId, organizacionId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, recibeWhatsapp: false });
    const admin = await s.nuevoAdministrador(organizacionId);
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] });
    await s.esperarPdf({ informeId });
    await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: ana!.id }] });
    const envioId = (await enviosDe(oficina.cookie, informeId))[0]!.id;
    const { rows } = await s.propietario.pool.query("select pdf_huella from informes.versiones where informe_id = $1", [informeId]);

    const rechaza: ProveedorDeCorreo = async () => {
      expect((await post(admin.cookie, `/api/informes/${informeId}/versiones/1/retirar`, { motivo: "Tenía un error" })).statusCode).toBe(200);
      throw new RechazoDefinitivo("Resend lo rechazó: dirección inválida");
    };
    const envios = crearEnvios({ bd: s.conexionApp.bd, almacenamiento: almacenamientoS3(s.config), config: s.config, proveedores: { correo: rechaza, whatsapp } });
    await envios.enviar({ organizacionId, envioId, pdfRuta: claveDeObjeto(organizacionId, rows[0].pdf_huella) }, { ultimoIntento: false });
    expect((await enviosDe(oficina.cookie, informeId))[0]).toMatchObject({ estado: "cancelado", error: "Versión retirada" });
  }, 90_000);

  it("el PDF se lee antes de marcar la salida: si el proceso muere leyéndolo, el WhatsApp no queda por enviado", async () => {
    const { oficina, clienteId, informeId, organizacionId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, recibeCorreo: false });
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] });
    await s.esperarPdf({ informeId });
    await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: ana!.id }] });
    const envioId = (await enviosDe(oficina.cookie, informeId))[0]!.id;
    const { rows } = await s.propietario.pool.query("select pdf_huella from informes.versiones where informe_id = $1", [informeId]);

    // Al leer el PDF, lo que dice la base de la salida del envío.
    const salidaAlLeer: unknown[] = [];
    const almacenamiento = almacenamientoS3(s.config);
    const espia: Almacenamiento = {
      ...almacenamiento,
      async leer(clave) {
        salidaAlLeer.push((await s.propietario.pool.query("select enviado_en from envios.envios where id = $1", [envioId])).rows[0].enviado_en);
        return almacenamiento.leer(clave);
      },
    };
    const envios = crearEnvios({ bd: s.conexionApp.bd, almacenamiento: espia, config: s.config, proveedores: { correo, whatsapp } });
    await envios.enviar({ organizacionId, envioId, pdfRuta: claveDeObjeto(organizacionId, rows[0].pdf_huella) }, { ultimoIntento: false });
    expect(salidaAlLeer).toEqual([null]);
    expect((await enviosDe(oficina.cookie, informeId))[0]).toMatchObject({ estado: "enviado" });
  }, 90_000);
});

describe("cancelar un envío en cola (ADR-0034)", () => {
  const url = (informeId: string, envio: string, accion: "cancelar" | "reanudar") => `/api/informes/${informeId}/versiones/1/envios/${envio}/${accion}`;

  it("un envío cancelado mientras espera el PDF nunca sale; queda quién lo canceló y se puede reanudar", async () => {
    const { oficina, tecnico, clienteId, informeId, organizacionId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, correo: "ana.cancelada@cliente.example" });
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [ana!.id] })).statusCode).toBe(201);
    const [porWhatsapp, porCorreo] = [...(await enviosDe(oficina.cookie, informeId))].sort((a, b) => b.canal.localeCompare(a.canal));

    // El técnico no corrige envíos; otro id no existe en esta versión.
    expect((await post(tecnico.cookie, url(informeId, porCorreo!.id, "cancelar"))).statusCode).toBe(403);
    expect((await post(oficina.cookie, url(informeId, randomUUID(), "cancelar"))).json()).toMatchObject({ codigo: "no_encontrado" });

    const cancelado = await post(oficina.cookie, url(informeId, porCorreo!.id, "cancelar"));
    expect(cancelado.statusCode, cancelado.body).toBe(200);
    expect(cancelado.json().envios.find((e: { id: string }) => e.id === porCorreo!.id)).toMatchObject({ estado: "cancelado", cancelado: { por: { nombre: "Oficina de prueba" } } });
    expect((await post(oficina.cookie, url(informeId, porCorreo!.id, "cancelar"))).json()).toMatchObject({ codigo: "estado_invalido" });

    await s.esperarPdf({ informeId });
    await s.procesarCola();
    expect(correos.some((c) => c.para === "ana.cancelada@cliente.example")).toBe(false);
    expect(Object.fromEntries((await enviosDe(oficina.cookie, informeId)).map((e) => [e.canal, e.estado]))).toEqual({ correo: "cancelado", whatsapp: "enviado" });
    // Lo que ya salió no se cancela: el WhatsApp se fue.
    expect((await post(oficina.cookie, url(informeId, porWhatsapp!.id, "cancelar"))).json()).toMatchObject({ codigo: "estado_invalido" });

    // "Deshacer" con el PDF ya listo: vuelve a la cola y sale.
    const reanudado = await post(oficina.cookie, url(informeId, porCorreo!.id, "reanudar"));
    expect(reanudado.statusCode, reanudado.body).toBe(200);
    expect(reanudado.json().envios.find((e: { id: string }) => e.id === porCorreo!.id)).toMatchObject({ estado: "en_cola", cancelado: null });
    await s.procesarCola();
    expect(correos.filter((c) => c.para === "ana.cancelada@cliente.example")).toHaveLength(1);
    expect((await post(oficina.cookie, url(informeId, porCorreo!.id, "reanudar"))).json()).toMatchObject({ codigo: "estado_invalido" });

    const { rows } = await s.propietario.pool.query(
      "select tipo_evento from auditoria.registros where organizacion_id = $1 and tipo_evento in ('envio_cancelado', 'envio_reanudado') order by secuencia",
      [organizacionId],
    );
    expect(rows.map((r) => r.tipo_evento)).toEqual(["envio_cancelado", "envio_reanudado"]);
  }, 90_000);

  it("cancelar mientras la copia sale no la detiene: salió, y la app lo dice", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, recibeWhatsapp: false });
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] });
    await s.esperarPdf({ informeId });
    await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: ana!.id }] });
    const [envio] = await enviosDe(oficina.cookie, informeId);

    let cancelacion: unknown;
    alSalir = async () => {
      alSalir = undefined;
      cancelacion = (await post(oficina.cookie, url(informeId, envio!.id, "cancelar"))).json();
    };
    await s.procesarCola();
    expect(cancelacion).toMatchObject({ codigo: "estado_invalido" });
    expect(await enviosDe(oficina.cookie, informeId)).toEqual([expect.objectContaining({ estado: "enviado" })]);
  }, 90_000);

  it("cancelado justo antes de que el worker lo tome, no sale aunque su trabajo ya esté en la cola", async () => {
    const { oficina, clienteId, informeId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, correo: "ana.en.cola@cliente.example", recibeWhatsapp: false });
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [] });
    await s.esperarPdf({ informeId });
    // Con el PDF listo, enviar encola el trabajo de una vez; se cancela antes de que el worker corra.
    await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: ana!.id }] });
    const [envio] = await enviosDe(oficina.cookie, informeId);
    expect((await post(oficina.cookie, url(informeId, envio!.id, "cancelar"))).statusCode).toBe(200);
    await s.procesarCola();
    expect(correos.some((c) => c.para === "ana.en.cola@cliente.example")).toBe(false);
    expect((await enviosDe(oficina.cookie, informeId))[0]).toMatchObject({ estado: "cancelado" });
  }, 90_000);

  it("una versión retirada no reanuda sus envíos", async () => {
    const { oficina, clienteId, informeId, organizacionId } = await informeListoParaPublicar();
    const [ana] = await crearContacto(oficina.cookie, clienteId, { ...ANA, recibeWhatsapp: false });
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [ana!.id] });
    const [envio] = await enviosDe(oficina.cookie, informeId);
    expect((await post(oficina.cookie, url(informeId, envio!.id, "cancelar"))).statusCode).toBe(200);
    const admin = await s.nuevoAdministrador(organizacionId);
    expect((await post(admin.cookie, `/api/informes/${informeId}/versiones/1/retirar`, { motivo: "Tenía un error" })).statusCode).toBe(200);
    expect((await post(oficina.cookie, url(informeId, envio!.id, "reanudar"))).json()).toMatchObject({
      codigo: "estado_invalido",
      detail: "La versión está retirada del portal: no se puede reanudar el envío",
    });
  }, 90_000);
});

async function organizacionDe(informeId: string): Promise<string> {
  const { rows } = await s.propietario.pool.query("select organizacion_id from informes.informes where id = $1", [informeId]);
  return rows[0].organizacion_id;
}

describe("eventos de los proveedores (ADR-0028, parte 4)", () => {
  async function publicadoYEnviado() {
    const datos = await informeListoParaPublicar();
    const [ana] = await crearContacto(datos.oficina.cookie, datos.clienteId, ANA);
    await post(datos.oficina.cookie, `/api/informes/${datos.informeId}/publicar`, { version: 2, destinatarios: [ana!.id] });
    await s.esperarPdf({ informeId: datos.informeId });
    await s.procesarCola();
    const envios = await enviosDe(datos.oficina.cookie, datos.informeId);
    // El id del mensaje en el proveedor: con él llegan sus eventos.
    const conProveedor = async (e: { id: string }) => ({ ...e, proveedorId: (await s.propietario.pool.query("select proveedor_id from envios.envios where id = $1", [e.id])).rows[0].proveedor_id as string });
    return { ...datos, correo: await conProveedor(envios.find((e) => e.canal === "correo")!), whatsapp: await conProveedor(envios.find((e) => e.canal === "whatsapp")!) };
  }

  it("Resend: entregado y después rebotado marca al contacto; sin firma válida no cambia nada", async () => {
    const { oficina, organizacionId, clienteId, informeId, correo: envio } = await publicadoYEnviado();
    const url = "/api/envios/eventos/correo";

    const falso = eventoResend("email.delivered", organizacionId, envio);
    const sinFirma = await app.inject({ method: "POST", url, headers: { ...firmarResend(falso), "svix-signature": "v1,AAAA" }, payload: falso });
    expect(sinFirma.statusCode).toBe(401);
    const viejo = await app.inject({ method: "POST", url, headers: firmarResend(falso, Math.floor(Date.now() / 1000) - 3600), payload: falso });
    expect(viejo.statusCode).toBe(401);

    const entregado = eventoResend("email.delivered", organizacionId, envio);
    expect((await app.inject({ method: "POST", url, headers: firmarResend(entregado), payload: entregado })).statusCode).toBe(204);
    expect((await enviosDe(oficina.cookie, informeId)).find((e) => e.id === envio.id)).toMatchObject({ estado: "entregado" });

    const rebote = eventoResend("email.bounced", organizacionId, envio, { bounce: { message: "Buzón inexistente" } });
    expect((await app.inject({ method: "POST", url, headers: firmarResend(rebote), payload: rebote })).statusCode).toBe(204);
    expect((await enviosDe(oficina.cookie, informeId)).find((e) => e.id === envio.id)).toMatchObject({ estado: "fallido", error: "El correo rebotó: Buzón inexistente" });
    expect((await get(oficina.cookie, `/api/clientes/${clienteId}`)).json().contactos[0].correoRebotado).toMatchObject({ motivo: "El correo rebotó: Buzón inexistente" });
  }, 90_000);

  it("Meta: verifica la dirección con su token y aplica los estados firmados", async () => {
    const { oficina, organizacionId, informeId, whatsapp: envio } = await publicadoYEnviado();
    const url = "/api/envios/eventos/whatsapp";
    const reto = await app.inject({ method: "GET", url: `${url}?hub.mode=subscribe&hub.verify_token=${TOKEN_VERIFICACION}&hub.challenge=12345` });
    expect([reto.statusCode, reto.body]).toEqual([200, "12345"]);
    expect((await app.inject({ method: "GET", url: `${url}?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1` })).statusCode).toBe(403);

    const estado = (status: string) =>
      JSON.stringify({
        object: "whatsapp_business_account",
        entry: [{ changes: [{ value: { statuses: [{ id: envio.proveedorId, status, biz_opaque_callback_data: `${organizacionId}:${envio.id}`, errors: status === "failed" ? [{ title: "Message undeliverable" }] : undefined }] } }] }],
      });
    const firmado = (cuerpo: string) => ({ "x-hub-signature-256": `sha256=${createHmac("sha256", SECRETO_META).update(cuerpo).digest("hex")}`, "content-type": "application/json" });

    const leido = estado("read");
    expect((await app.inject({ method: "POST", url, headers: { ...firmado(leido), "x-hub-signature-256": "sha256=00" }, payload: leido })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url, headers: firmado(leido), payload: leido })).statusCode).toBe(200);
    expect((await enviosDe(oficina.cookie, informeId)).find((e) => e.id === envio.id)).toMatchObject({ estado: "entregado" });

    const fallo = estado("failed");
    await app.inject({ method: "POST", url, headers: firmado(fallo), payload: fallo });
    expect((await enviosDe(oficina.cookie, informeId)).find((e) => e.id === envio.id)).toMatchObject({ estado: "fallido", error: "WhatsApp no lo entregó: Message undeliverable" });
  }, 90_000);

  it("un evento firmado que no se entiende se acusa: reintentarlo no lo arregla", async () => {
    for (const cuerpo of ["no es JSON", "null"]) {
      expect((await app.inject({ method: "POST", url: "/api/envios/eventos/correo", headers: firmarResend(cuerpo), payload: cuerpo })).statusCode).toBe(204);
    }
    for (const cuerpo of ["no es JSON", "null", '{"entry":5}']) {
      const firma = `sha256=${createHmac("sha256", SECRETO_META).update(cuerpo).digest("hex")}`;
      const r = await app.inject({ method: "POST", url: "/api/envios/eventos/whatsapp", headers: { "x-hub-signature-256": firma, "content-type": "application/json" }, payload: cuerpo });
      expect(r.statusCode).toBe(200);
    }
  });
});

describe("mensajes y firmas", () => {
  const mensaje = { organizacion: "TEINS", cliente: "Clínica <ficticia>", sitio: "Sede Norte", motivo: "UPS", programadaPara: "2026-10-03", numero: 2, nombreArchivo: "x.pdf" };

  it("la cotización tiene su asunto y su texto, sin el portal (ADR-0029)", () => {
    const cotizacion = { documento: "cotizacion" as const, organizacion: "TEINS", cliente: "Clínica <ficticia>", sitio: "Sede Norte", cotizacion: "COT-2026-0007", numero: 2, nombreArchivo: "x.pdf" };
    expect(asunto(cotizacion)).toBe("Cotización COT-2026-0007 · Sede Norte (versión 2)");
    const texto = textoDeCorreo(cotizacion, { nombre: "Marta Gil", portal: undefined, sinAdjunto: false });
    expect(texto).toContain("Le enviamos la cotización COT-2026-0007 para Sede Norte. Va adjunta en PDF.");
    expect(texto).toContain("para las cotizaciones");
    expect(htmlDeCorreo(cotizacion, { nombre: "Marta Gil", portal: undefined, sinAdjunto: false })).toContain("Clínica &lt;ficticia&gt;");
    expect(variablesDeWhatsapp(cotizacion, "Marta Gil")).toEqual(["Marta", "COT-2026-0007", "Sede Norte", "2"]);
  });

  it("el asunto lleva la versión desde la 2 y el texto dice cuándo el PDF no va adjunto", () => {
    expect(asunto(mensaje)).toBe("Informe de la visita del 3 oct 2026 · Sede Norte (versión 2)");
    expect(textoDeCorreo(mensaje, { nombre: "Ana Torres", portal: undefined, sinAdjunto: true })).toContain("El PDF pesa demasiado para el correo");
  });

  it("un salto de línea en un nombre no llega al asunto ni a las variables de WhatsApp", () => {
    const conSaltos = { ...mensaje, sitio: "Sede\r\nBcc: otro@example.com" };
    expect(asunto(conSaltos)).toBe("Informe de la visita del 3 oct 2026 · Sede Bcc: otro@example.com (versión 2)");
    // Meta rechaza una variable con saltos de línea, tabulaciones o más de cuatro espacios seguidos.
    expect(variablesDeWhatsapp(conSaltos, "Ana\tTorres")).toEqual(["Ana", "3 oct 2026", "Sede Bcc: otro@example.com", "2"]);
    expect(variablesDeWhatsapp({ ...mensaje, sitio: "Sede      Norte" }, "Ana")[2]).toBe("Sede Norte");
  });

  it("las firmas solo valen con el secreto y el cuerpo exactos", () => {
    const cuerpo = Buffer.from('{"a":1}');
    const hora = String(Math.floor(Date.now() / 1000));
    const firma = createHmac("sha256", Buffer.from(SECRETO_RESEND.slice(6), "base64")).update(`m1.${hora}.`).update(cuerpo).digest("base64");
    expect(firmaSvixValida(SECRETO_RESEND, { id: "m1", hora, firma: `v1,otra v1,${firma}` }, cuerpo)).toBe(true);
    expect(firmaSvixValida(SECRETO_RESEND, { id: "m1", hora, firma: `v1,${firma}` }, Buffer.from('{"a":2}'))).toBe(false);
    expect(firmaMetaValida(SECRETO_META, `sha256=${createHmac("sha256", SECRETO_META).update(cuerpo).digest("hex")}`, cuerpo)).toBe(true);
    expect(firmaMetaValida(SECRETO_META, undefined, cuerpo)).toBe(false);
  });
});

describe("envíos simulados por canal", () => {
  const correoDePrueba = { idempotencia: "x", de: "TEINS <a@b.co>", responderA: undefined, asunto: "", html: "", texto: "", adjunto: null, etiquetas: {} };

  it("se simula un canal y el otro sale de verdad si tiene su configuración", async () => {
    const soloWhatsapp = proveedoresSegunConfig(configDePrueba({ ENVIOS_SIMULADOS: "whatsapp", RESEND_CLAVE_API: "re_prueba_123" }));
    expect(await soloWhatsapp.whatsapp!({ para: "+573005550117", plantilla: "p", idioma: "es", variables: [], documento: { nombre: "x.pdf", contenido: Buffer.from("") }, referencia: "r" })).toMatchObject({ id: expect.stringMatching(/^simulado-/) });
    // El correo no es el simulado: es el de Resend (no se llama aquí).
    expect(soloWhatsapp.correo).toBeDefined();
    await expect(proveedoresSegunConfig(configDePrueba({ ENVIOS_SIMULADOS: "correo" })).correo!({ ...correoDePrueba, para: "delivered@resend.dev" })).resolves.toMatchObject({ id: expect.stringMatching(/^simulado-/) });
    // La dirección de prueba de rebote de Resend también se rechaza simulada: la misma prueba sirve en los dos casos.
    await expect(proveedoresSegunConfig(configDePrueba({ ENVIOS_SIMULADOS: "true" })).correo!({ ...correoDePrueba, para: "bounced@resend.dev" })).rejects.toBeInstanceOf(RechazoDefinitivo);
    expect(proveedoresSegunConfig(configDePrueba({ ENVIOS_SIMULADOS: "false" }))).toEqual({ correo: undefined, whatsapp: undefined });
  });

  it("producción nunca arranca con un canal simulado", () => {
    expect(() => configDePrueba({ NODE_ENV: "production", PROXIES_DE_CONFIANZA: "2", ENVIOS_SIMULADOS: "whatsapp" })).toThrow(/ENVIOS_SIMULADOS/);
    expect(() => configDePrueba({ NODE_ENV: "production", PROXIES_DE_CONFIANZA: "2", ENTORNO_DE_PRUEBAS: "true", ENVIOS_SIMULADOS: "whatsapp" })).not.toThrow();
  });
});
