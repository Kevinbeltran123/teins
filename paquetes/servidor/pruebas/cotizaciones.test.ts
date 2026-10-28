import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { llaveDeEnvio } from "@teins/protocolo";
import type { LineaCantidad, VersionFormato } from "@teins/dominio";
import { almacenamientoS3 } from "../src/plataforma/almacenamiento";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearGeneradorPdfDeCotizaciones } from "../src/modulos/cotizaciones";
import { crearFormatos } from "../src/modulos/formatos";
import { crearVisitas } from "../src/modulos/visitas";
import { cabecerasSync, ORIGEN, servidorDePrueba } from "./ayudas";

// Sin proveedores de envío: la cola es compartida y los envíos los procesa envios.test.ts con los suyos.
const s = await servidorDePrueba();
const { app } = s;

/** Formato ficticio (R5) con una tabla de materiales. */
const conMateriales: VersionFormato = {
  formato: "prueba-materiales",
  version: 1,
  appMinima: 6,
  secciones: [{ clave: "obra", titulo: "Obra", campos: [{ clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["m", "und"], obligatorio: true }] }],
};

const linea = (id: string, descripcion: string, cantidad: string, unidad = "m"): LineaCantidad => ({ id, descripcion, cantidad, unidad });

async function escenario() {
  const org = await s.nuevaOrganizacionConUsuarios();
  await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => crearFormatos().publicar(tx, org.organizacionId, conMateriales));
  const { visitaId, clienteId } = await enOrganizacion(s.conexionApp.bd, org.organizacionId, async (tx) => {
    const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre: "Clínica ficticia", sitio: { nombre: "Sede Norte", direccion: "Calle [N]" } });
    const visitaId = await crearVisitas(clientesYSitios).crear(tx, { organizacionId: org.organizacionId, autorId: "prueba", correlacion: "prueba", clienteId, sitioId, motivo: "Cotización", programadaPara: "2026-10-03", tecnicos: [org.tecnico.id] });
    return { visitaId, clienteId };
  });
  const oficina = (method: "GET" | "POST", url: string, payload?: object, cookie = org.oficina.cookie) => app.inject({ method, url, headers: { cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });
  const admin = await s.nuevoAdministrador(org.organizacionId);
  const comoAdmin = (method: "GET" | "POST", url: string, payload?: object) => oficina(method, url, payload, admin.cookie);

  /** Un levantamiento con materiales, revisado, con el cable vinculado al catálogo. */
  async function revisado(materiales: LineaCantidad[], vinculos: Record<string, string> = {}) {
    const id = randomUUID();
    const r = await app.inject({
      method: "POST",
      url: "/api/sync/comandos",
      headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
      payload: {
        tipo: "EnviarLevantamiento",
        llave: llaveDeEnvio(id),
        levantamiento: { id, formato: "prueba-materiales", versionFormato: 1, visitaId, respuestas: { obra: { materiales } }, creadoEn: "2026-10-03T10:00:00.000Z", enviadoEn: "2026-10-03T11:00:00.000Z" },
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    let version = (await oficina("POST", `/api/levantamientos/${id}/tomar`, { version: 1 })).json().version as number;
    for (const [lineaId, itemId] of Object.entries(vinculos)) {
      const v = await oficina("POST", `/api/levantamientos/${id}/lineas/vincular`, { version, seccion: "obra", campo: "materiales", linea: lineaId, itemId });
      expect(v.statusCode, v.body).toBe(200);
      version = v.json().version;
    }
    expect((await oficina("POST", `/api/levantamientos/${id}/marcar-revisado`, { version })).statusCode).toBe(200);
    return id;
  }
  return { ...org, visitaId, clienteId, oficina, comoAdmin, revisado };
}

/** La cola `pdf` es compartida: se insiste hasta que no quede ningún PDF de cotización generándose. */
async function esperarPdfDeCotizaciones(cotizacionId: string) {
  for (let i = 0; i < 180; i++) {
    await s.procesarCola();
    const { rows } = await s.propietario.pool.query("select count(*)::int as n from cotizaciones.versiones where pdf_estado = 'generando' and cotizacion_id = $1", [cotizacionId]);
    if (rows[0].n === 0) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Hay PDF de cotización sin generar");
}

describe("lista de precios con historia (ADR-0029, parte 1)", () => {
  it("solo administración cambia un precio; el anterior queda en la historia", async () => {
    const e = await escenario();
    const cable = (await e.oficina("POST", "/api/catalogo", { codigo: "CAB-6A", descripcion: "Cable UTP 6A", unidad: "m" })).json();
    expect(cable.precio).toBeNull();
    expect((await e.oficina("POST", `/api/catalogo/${cable.id}/precio`, { precio: 4500 })).statusCode).toBe(403);

    expect((await e.comoAdmin("POST", `/api/catalogo/${cable.id}/precio`, { precio: 4500 })).json().precio).toMatchObject({ valor: 4500 });
    await e.comoAdmin("POST", `/api/catalogo/${cable.id}/precio`, { precio: 4800 });
    const lista = (await e.oficina("GET", "/api/catalogo")).json().items;
    expect(lista.find((i: { id: string }) => i.id === cable.id).precio).toMatchObject({ valor: 4800 });
    const historia = (await e.oficina("GET", `/api/catalogo/${cable.id}/precios`)).json().precios;
    expect(historia.map((p: { valor: number; origen: string; por: { nombre: string } }) => [p.valor, p.origen, p.por.nombre])).toEqual([
      [4800, "manual", "Administradora de prueba"],
      [4500, "manual", "Administradora de prueba"],
    ]);
  });

  it("importar con precio exige administración y reimportar el mismo precio no ensucia la historia", async () => {
    const e = await escenario();
    const items = [{ codigo: "SOP-L", descripcion: "Soporte en L", unidad: "und", precio: 18500 }];
    expect((await e.oficina("POST", "/api/catalogo/importar", { items })).statusCode).toBe(403);
    expect((await e.oficina("POST", "/api/catalogo/importar", { items: items.map(({ precio: _, ...i }) => i) })).statusCode).toBe(200);
    expect((await e.comoAdmin("POST", "/api/catalogo/importar", { items })).statusCode).toBe(200);
    expect((await e.comoAdmin("POST", "/api/catalogo/importar", { items })).statusCode).toBe(200);
    const soporte = (await e.oficina("GET", "/api/catalogo")).json().items.find((i: { codigo: string }) => i.codigo === "SOP-L");
    expect((await e.oficina("GET", `/api/catalogo/${soporte.id}/precios`)).json().precios).toEqual([expect.objectContaining({ valor: 18500, origen: "importado" })]);
  });
});

describe("cotización desde las cantidades revisadas (ADR-0029, parte 2)", () => {
  it("toma las cantidades revisadas con el precio vigente, se numera, se publica congelada con su PDF y se envía", async () => {
    const e = await escenario();
    const cable = (await e.oficina("POST", "/api/catalogo", { codigo: "CAB-6A", descripcion: "Cable UTP 6A", unidad: "m" })).json();
    await e.comoAdmin("POST", `/api/catalogo/${cable.id}/precio`, { precio: 4800 });
    await e.revisado([linea("a0000001", "cable utp", "10"), linea("a0000002", "Terminales", "20", "und")], { a0000001: cable.id });
    await e.revisado([linea("b0000001", "Cable", "20.5")], { b0000001: cable.id });

    const visitas = (await e.oficina("GET", "/api/cotizaciones/visitas")).json().visitas;
    expect(visitas).toEqual([expect.objectContaining({ visitaId: e.visitaId, levantamientosRevisados: 2, materiales: 2, sinPrecio: 1, cotizaciones: [] })]);

    const creada = await e.oficina("POST", "/api/cotizaciones", { visitaId: e.visitaId });
    expect(creada.statusCode, creada.body).toBe(201);
    const { id } = creada.json();
    const detalle = (await e.oficina("GET", `/api/cotizaciones/${id}`)).json();
    expect(detalle.numero).toMatch(/^COT-\d{4}-0001$/);
    expect(detalle.lineas).toEqual([
      expect.objectContaining({ codigo: "CAB-6A", descripcion: "Cable UTP 6A", cantidad: "30.5", precio: 4800, precioCatalogo: 4800, origen: "cantidades" }),
      expect.objectContaining({ codigo: null, descripcion: "Terminales", cantidad: "20", precio: null }),
    ]);
    // La segunda cotización de la organización lleva el siguiente número.
    const otra = (await e.oficina("POST", "/api/cotizaciones", { visitaId: e.visitaId })).json();
    expect((await e.oficina("GET", `/api/cotizaciones/${otra.id}`)).json().numero).toMatch(/-0002$/);

    // Sin precio en una línea no se publica, y lo dice.
    const sinPrecio = await e.oficina("POST", `/api/cotizaciones/${id}/publicar`, { version: 1 });
    expect(sinPrecio.json()).toMatchObject({ codigo: "cotizacion_invalida", erroresCotizacion: [{ codigo: "sin_precio", lineas: [detalle.lineas[1].id] }] });

    // Oficina pone el precio, agrega mano de obra y elige AIU.
    const lineas = [
      detalle.lineas[0],
      { ...detalle.lineas[1], precio: 1200 },
      { id: "m0000001", itemId: null, codigo: null, descripcion: "Mano de obra", cantidad: "1", unidad: "gl", precio: 850000, precioCatalogo: null, origen: "oficina" },
    ];
    const guardada = await e.oficina("POST", `/api/cotizaciones/${id}/borrador`, {
      version: 1,
      lineas,
      impuestos: { tipo: "aiu", administracion: "10", imprevistos: "3", utilidad: "5" },
      condiciones: { validezDias: 30, formaPago: "Contado", notas: "No incluye obra civil." },
    });
    expect(guardada.json()).toEqual({ version: 2 });
    expect((await e.oficina("POST", `/api/cotizaciones/${id}/borrador`, { version: 1, lineas, impuestos: { tipo: "iva" }, condiciones: detalle.condiciones })).json().codigo).toBe("conflicto_de_version");

    // Contactos: compras recibe cotizaciones; mantenimiento, informes.
    const contactos = (
      await e.oficina("POST", `/api/clientes/${e.clienteId}/contactos`, { nombre: "Marta Gil", correo: "compras@cliente.example", recibeCorreo: true, recibeWhatsapp: false, recibeInformes: false, recibeCotizaciones: true })
    ).json().contactos;
    const marta = contactos.find((c: { nombre: string }) => c.nombre === "Marta Gil");
    expect(marta).toMatchObject({ recibeInformes: false, recibeCotizaciones: true });

    const publicada = await e.oficina("POST", `/api/cotizaciones/${id}/publicar`, { version: 2, destinatarios: [marta.id] });
    expect(publicada.statusCode, publicada.body).toBe(201);
    // 146400 + 24000 + 850000 = 1020400; A 102040, I 30612, U 51020, IVA sobre U 9694.
    expect(publicada.json()).toMatchObject({ numero: 1, pdf: "generando", total: 1020400 + 102040 + 30612 + 51020 + 9694, envios: [{ estado: "en_cola" }] });

    // Cambiar el precio después no toca lo publicado (versión inmutable).
    await e.comoAdmin("POST", `/api/catalogo/${cable.id}/precio`, { precio: 9999 });
    await esperarPdfDeCotizaciones(id);
    await s.procesarCola();
    const final = (await e.oficina("GET", `/api/cotizaciones/${id}`)).json();
    expect(final.versiones).toEqual([expect.objectContaining({ numero: 1, pdf: "listo", total: 1213766, envios: [expect.objectContaining({ canal: "correo", contacto: { id: marta.id, nombre: "Marta Gil" } })] })]);
    const { rows } = await s.propietario.pool.query("select contenido->'lineas'->0->>'precio' as precio from cotizaciones.versiones where cotizacion_id = $1", [id]);
    expect(rows[0].precio).toBe("4800");

    // El envío sale como cotización (asunto y texto propios, sin el portal: mensajes en envios.test.ts).
    const mensaje = (await s.propietario.pool.query("select mensaje from envios.envios where contacto_id = $1", [marta.id])).rows[0].mensaje;
    expect(mensaje).toMatchObject({ documento: "cotizacion", cotizacion: detalle.numero, numero: 1, sitio: "Sede Norte" });

    const url = (await e.oficina("GET", `/api/cotizaciones/${id}/versiones/1/pdf`)).json().url;
    const descarga = await fetch(url);
    // Se descarga con su número y el cliente en el nombre (con tildes en filename*, RFC 6266).
    expect(descarga.headers.get("content-disposition")).toContain(encodeURIComponent(`Cotización ${detalle.numero} - Clínica ficticia`));
    const pdf = await PDFDocument.load(Buffer.from(await descarga.arrayBuffer()));
    expect(pdf.getTitle()).toBe(`Cotización ${detalle.numero} · Clínica ficticia · versión 1`);

    // La base no deja cambiar lo publicado.
    const error = await enOrganizacion(s.conexionApp.bd, e.organizacionId, (tx) => tx.execute(`update cotizaciones.versiones set total = 1`)).then(
      () => null,
      (causa: unknown) => String((causa as { cause?: { message?: string } }).cause?.message ?? causa),
    );
    expect(error).toMatch(/permission denied/);

    const listado = (await e.oficina("GET", "/api/cotizaciones")).json().cotizaciones;
    expect(listado.find((c: { id: string }) => c.id === id)).toMatchObject({ vigente: 1, total: 1213766, envioSinEntregar: false });
  }, 120_000);

  it("la lista para cotizar solo trae levantamientos recibidos en los últimos 90 días", async () => {
    const e = await escenario();
    const id = await e.revisado([linea("a0000001", "Canaleta", "4")]);
    expect((await e.oficina("GET", "/api/cotizaciones/visitas")).json().visitas).toEqual([expect.objectContaining({ visitaId: e.visitaId })]);
    await s.propietario.pool.query("update levantamientos.levantamientos set recibido_en = now() - interval '100 days' where id = $1", [id]);
    expect((await e.oficina("GET", "/api/cotizaciones/visitas")).json().visitas).toEqual([]);
  });

  it("una visita cancelada no aparece para cotizar", async () => {
    const e = await escenario();
    await e.revisado([linea("a0000001", "Canaleta", "4")]);
    await s.propietario.pool.query("update visitas.visitas set cancelada_en = now() where id = $1", [e.visitaId]);
    expect((await e.oficina("GET", "/api/cotizaciones/visitas")).json().visitas).toEqual([]);
  });

  it("una visita sin levantamientos revisados no se cotiza, y el técnico no ve cotizaciones", async () => {
    const e = await escenario();
    expect((await e.oficina("POST", "/api/cotizaciones", { visitaId: e.visitaId })).json().codigo).toBe("estado_invalido");
    expect((await app.inject({ method: "GET", url: "/api/cotizaciones", headers: { cookie: e.tecnico.cookie } })).statusCode).toBe(403);
  });
});

describe("envío de una cotización publicada (ADR-0029)", () => {
  /** Una cotización con precio, publicada sin destinatarios y con su PDF listo, y un contacto de compras. */
  async function publicada() {
    const e = await escenario();
    await e.revisado([linea("a0000001", "Canaleta", "4")]);
    const { id } = (await e.oficina("POST", "/api/cotizaciones", { visitaId: e.visitaId })).json();
    const detalle = (await e.oficina("GET", `/api/cotizaciones/${id}`)).json();
    const lineas = detalle.lineas.map((l: object) => ({ ...l, precio: 1000 }));
    expect((await e.oficina("POST", `/api/cotizaciones/${id}/borrador`, { version: 1, lineas, impuestos: { tipo: "iva" }, condiciones: detalle.condiciones })).statusCode).toBe(200);
    const contactos = (
      await e.oficina("POST", `/api/clientes/${e.clienteId}/contactos`, { nombre: "Marta Gil", correo: "compras@cliente.example", recibeCorreo: true, recibeWhatsapp: false, recibeInformes: false, recibeCotizaciones: true })
    ).json().contactos;
    expect((await e.oficina("POST", `/api/cotizaciones/${id}/publicar`, { version: 2, destinatarios: [] })).statusCode).toBe(201);
    await esperarPdfDeCotizaciones(id);
    const { rows } = await s.propietario.pool.query("select id from cotizaciones.versiones where cotizacion_id = $1", [id]);
    const enviar = () => e.oficina("POST", `/api/cotizaciones/${id}/versiones/1/enviar`, { destinos: [{ contactoId: contactos[0].id }] });
    return { ...e, id, versionId: rows[0].id as string, marta: contactos[0] as { id: string }, enviar };
  }

  it("retirar una versión (ADR-0034): solo administración, con motivo; deja de ser la vigente y no se envía más", async () => {
    const { id, organizacionId, oficina, comoAdmin } = await publicada();
    // Una segunda versión, que es la que se retira.
    expect((await oficina("POST", `/api/cotizaciones/${id}/publicar`, { version: 3, destinatarios: [] })).statusCode).toBe(201);
    const vigente = async () => ((await oficina("GET", "/api/cotizaciones")).json().cotizaciones as { id: string; vigente: number | null }[]).find((c) => c.id === id)!.vigente;
    expect(await vigente()).toBe(2);

    expect((await oficina("POST", `/api/cotizaciones/${id}/versiones/2/retirar`, { motivo: "El precio estaba mal" })).statusCode).toBe(403);
    expect((await comoAdmin("POST", `/api/cotizaciones/${id}/versiones/2/retirar`, { motivo: " " })).json()).toMatchObject({ codigo: "entrada_invalida" });
    const retirada = await comoAdmin("POST", `/api/cotizaciones/${id}/versiones/2/retirar`, { motivo: "El precio estaba mal" });
    expect(retirada.statusCode, retirada.body).toBe(200);
    expect(retirada.json()).toMatchObject({ numero: 2, retirada: { motivo: "El precio estaba mal", por: { nombre: expect.any(String) } } });
    expect((await comoAdmin("POST", `/api/cotizaciones/${id}/versiones/2/retirar`, { motivo: "Otra vez" })).json()).toMatchObject({ codigo: "estado_invalido" });

    // La anterior vuelve a ser la vigente; la retirada se conserva, con su PDF, y no se envía.
    expect(await vigente()).toBe(1);
    const detalle = (await oficina("GET", `/api/cotizaciones/${id}`)).json();
    expect(detalle.versiones.map((v: { numero: number; retirada: unknown }) => [v.numero, v.retirada !== null])).toEqual([[2, true], [1, false]]);
    const contacto = (await oficina("GET", `/api/clientes/${detalle.clienteId}`)).json().contactos[0];
    expect((await oficina("POST", `/api/cotizaciones/${id}/versiones/2/enviar`, { destinos: [{ contactoId: contacto.id }] })).json()).toMatchObject({
      codigo: "estado_invalido",
      detail: "La versión está retirada: publique una nueva para enviarla",
    });

    // Retirar también la 1: la cotización queda sin vigente.
    expect((await comoAdmin("POST", `/api/cotizaciones/${id}/versiones/1/retirar`, { motivo: "Ya no aplica" })).statusCode).toBe(200);
    expect(await vigente()).toBeNull();
    const { rows } = await s.propietario.pool.query("select count(*)::int as n from auditoria.registros where organizacion_id = $1 and agregado_tipo = 'cotizacion' and tipo_evento = 'version_retirada'", [organizacionId]);
    expect(rows[0].n).toBe(2);
  }, 120_000);

  it("un envío de la cotización que espera en cola se cancela y se reanuda", async () => {
    const { id, enviar, oficina } = await publicada();
    // Como justo después de publicar: el envío espera el PDF.
    await s.propietario.pool.query("update cotizaciones.versiones set pdf_estado = 'generando' where cotizacion_id = $1", [id]);
    const [envio] = (await enviar()).json().envios as { id: string }[];
    const cancelado = await oficina("POST", `/api/cotizaciones/${id}/versiones/1/envios/${envio!.id}/cancelar`);
    expect(cancelado.statusCode, cancelado.body).toBe(200);
    expect(cancelado.json().envios[0]).toMatchObject({ estado: "cancelado", cancelado: { por: { nombre: "Oficina de prueba" } } });
    const reanudado = await oficina("POST", `/api/cotizaciones/${id}/versiones/1/envios/${envio!.id}/reanudar`);
    expect(reanudado.json().envios[0]).toMatchObject({ estado: "en_cola", cancelado: null });
  }, 120_000);

  it("una versión retirada no reanuda sus envíos", async () => {
    const { id, enviar, oficina, comoAdmin } = await publicada();
    await s.propietario.pool.query("update cotizaciones.versiones set pdf_estado = 'generando' where cotizacion_id = $1", [id]);
    const [envio] = (await enviar()).json().envios as { id: string }[];
    expect((await comoAdmin("POST", `/api/cotizaciones/${id}/versiones/1/retirar`, { motivo: "El precio estaba mal" })).statusCode).toBe(200);
    expect((await oficina("POST", `/api/cotizaciones/${id}/versiones/1/envios/${envio!.id}/reanudar`)).json()).toMatchObject({
      codigo: "estado_invalido",
      detail: "La versión está retirada: no se puede reanudar el envío",
    });
  }, 120_000);

  it("el mensaje lleva el nombre de la organización que quedó en el PDF, aunque cambie después", async () => {
    const { organizacionId, marta, enviar } = await publicada();
    await s.propietario.pool.query("update identidad.organizaciones set nombre = 'Nombre nuevo' where id = $1", [organizacionId]);
    expect((await enviar()).statusCode).toBe(200);
    const { rows } = await s.propietario.pool.query("select mensaje from envios.envios where contacto_id = $1", [marta.id]);
    expect(rows[0].mensaje.organizacion).toBe("Organización de prueba");
  }, 120_000);

  it("una versión cuyo PDF no se pudo generar no se envía: su envío quedaría en cola para siempre", async () => {
    const { id, marta, enviar } = await publicada();
    await s.propietario.pool.query("update cotizaciones.versiones set pdf_estado = 'fallido' where cotizacion_id = $1", [id]);
    expect((await enviar()).json().codigo).toBe("estado_invalido");
    expect((await s.propietario.pool.query("select 1 from envios.envios where contacto_id = $1", [marta.id])).rows).toEqual([]);
  }, 120_000);

  it("un fallo tardío no pisa un PDF que ya quedó listo ni da por no llegados sus envíos", async () => {
    const { organizacionId, versionId, marta, enviar } = await publicada();
    // Como justo después de publicar: el PDF se está generando y un envío lo espera.
    await s.propietario.pool.query("update cotizaciones.versiones set pdf_estado = 'generando' where id = $1", [versionId]);
    expect((await enviar()).statusCode).toBe(200);

    // Otra pasada del trabajo lo deja listo; a esta se le pierde la conexión en su último intento.
    const almacenamiento = almacenamientoS3(s.config);
    const generador = crearGeneradorPdfDeCotizaciones({
      bd: s.conexionApp.bd,
      config: s.config,
      almacenamiento: {
        ...almacenamiento,
        async guardar() {
          await s.propietario.pool.query("update cotizaciones.versiones set pdf_estado = 'listo' where id = $1", [versionId]);
          throw new Error("Se perdió la conexión");
        },
      },
    });
    await generador.generarPdf({ organizacionId, versionId }, { ultimoIntento: true });
    expect((await s.propietario.pool.query("select pdf_estado from cotizaciones.versiones where id = $1", [versionId])).rows[0].pdf_estado).toBe("listo");
    expect((await s.propietario.pool.query("select estado from envios.envios where contacto_id = $1", [marta.id])).rows).toEqual([{ estado: "en_cola" }]);
  }, 120_000);
});
