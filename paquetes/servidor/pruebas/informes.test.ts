import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { llaveDeEnvio } from "@teins/protocolo";
import { almacenamientoS3 } from "../src/plataforma/almacenamiento";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearGeneradorPdf } from "../src/modulos/informes";
import { crearVisitas } from "../src/modulos/visitas";
import { recuperarTrabajosAMedias } from "../src/modulos/mantenimiento";
import { escapar, LOGO_TEINS, plantillaInforme } from "@teins/documentos";
import { cabecerasSync, jpegDePrueba, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;
const visitas = crearVisitas(clientesYSitios);

async function subir(cookie: string, datos: Buffer, tipo: "image/jpeg" | "application/pdf") {
  const huella = createHash("sha256").update(datos).digest("hex");
  const r = await app.inject({ method: "POST", url: "/api/archivos/subidas", headers: { cookie, ...cabecerasSync }, payload: { huella, bytes: datos.length, tipo } });
  expect(r.statusCode, r.body).toBe(200);
  const a = r.json();
  if (a.estado === "autorizada") expect((await fetch(a.url, { method: "PUT", headers: a.cabeceras, body: datos })).status).toBe(200);
  await app.inject({ method: "POST", url: `/api/archivos/${huella}/subido`, headers: { cookie, ...cabecerasSync } });
  return huella;
}

async function planoDePrueba(paginas = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([612, 792]).drawText(`Plano ficticio ${randomUUID()}`, { x: 50, y: 700 });
  return Buffer.from(await doc.save());
}

const post = (cookie: string, url: string, payload: object) => app.inject({ method: "POST", url, headers: { cookie }, payload });
const get = (cookie: string, url: string) => app.inject({ method: "GET", url, headers: { cookie } });

/** Visita con un levantamiento revisado (con foto) y otro solo enviado. */
async function visitaConRevisado() {
  const org = await s.nuevaOrganizacionConUsuarios();
  const visitaId = await enOrganizacion(s.conexionApp.bd, org.organizacionId, async (tx) => {
    const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre: "Cliente <ficticio>", sitio: { nombre: "Sede", direccion: "Calle [N]" } });
    return visitas.crear(tx, { organizacionId: org.organizacionId, autorId: "prueba", correlacion: "prueba", clienteId, sitioId, motivo: "Mantenimiento", programadaPara: "2026-09-30", tecnicos: [org.tecnico.id] });
  });
  const foto = await subir(org.tecnico.cookie, jpegDePrueba().datos, "image/jpeg");
  await s.procesarCola();
  const enviar = async (fotos: string[]) => {
    const id = randomUUID();
    const r = await app.inject({
      method: "POST",
      url: "/api/sync/comandos",
      headers: { cookie: org.tecnico.cookie, ...cabecerasSync },
      payload: {
        tipo: "EnviarLevantamiento",
        llave: llaveDeEnvio(id),
        levantamiento: {
          id,
          formato: "prueba-ups",
          versionFormato: 1,
          visitaId,
          respuestas: { cuarto_tecnico: { potencia_nominal: { valor: "12.5", unidad: "kVA" }, ...(fotos.length ? { fotos_equipo: fotos } : {}) } },
          creadoEn: "2026-09-30T10:00:00.000-05:00",
          enviadoEn: "2026-09-30T11:00:00.000-05:00",
        },
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    return id;
  };
  const revisado = await enviar([foto]);
  const enviado = await enviar([]);
  expect((await post(org.oficina.cookie, `/api/levantamientos/${revisado}/tomar`, { version: 1 })).statusCode).toBe(200);
  expect((await post(org.oficina.cookie, `/api/levantamientos/${revisado}/marcar-revisado`, { version: 2 })).statusCode).toBe(200);
  const { id: informeId } = (await post(org.oficina.cookie, "/api/informes", { visitaId })).json();
  return { ...org, visitaId, revisado, enviado, informeId, foto };
}

/** La cola `pdf` procesa de a uno y otro archivo de pruebas puede estar usándola: se insiste hasta que termine. */
const hastaQueLosPdfEstenListos = (informeId: string) => s.esperarPdf({ informeId });

async function descargar(cookie: string, informeId: string, numero: number) {
  const r = await get(cookie, `/api/informes/${informeId}/versiones/${numero}/pdf`);
  expect(r.statusCode, r.body).toBe(200);
  const archivo = await fetch(r.json().url);
  // Se descarga como adjunto con el nombre del informe: la aplicación no pierde la pantalla.
  expect(archivo.headers.get("content-disposition")).toMatch(new RegExp(`^attachment; filename=".* - version ${numero}\\.pdf"`));
  return Buffer.from(await archivo.arrayBuffer());
}

describe("bandeja (iteración 14)", () => {
  it("cada levantamiento dice de qué cliente y sitio es, en cualquier pestaña", async () => {
    const { oficina, visitaId, revisado, enviado } = await visitaConRevisado();
    const deLaPestana = async (estado: string, id: string) =>
      (await get(oficina.cookie, `/api/levantamientos?estado=${estado}`)).json().elementos.find((e: { id: string }) => e.id === id);
    const visita = { id: visitaId, cliente: "Cliente <ficticio>", sitio: "Sede" };
    expect((await deLaPestana("enviado", enviado)).visita).toEqual(visita);
    expect((await deLaPestana("revisado", revisado)).visita).toEqual(visita);
  });
});

describe("estado de un plano (iteración 26, ADR-0031)", () => {
  it("al verificarlo se cuentan las páginas que se anexan; uno que pdf-lib no puede anexar queda ilegible", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const tres = await subir(org.oficina.cookie, await planoDePrueba(3), "application/pdf");
    const danado = await subir(org.oficina.cookie, Buffer.from(`%PDF-1.7 ${randomUUID()} sin estructura`), "application/pdf");
    const estado = (cookie: string, huella: string) => get(cookie, `/api/archivos/${huella}/plano`);
    // La cola es compartida con otros archivos de prueba: pudo verificarse ya. Se fija el estado que se prueba y su
    // trabajo vuelve a la cola, para no depender de quién la procesa primero.
    await s.propietario.pool.query("update archivos.archivos set estado = 'subido', verificado_en = null where huella = $1 and organizacion_id = $2", [tres, org.organizacionId]);
    expect((await estado(org.oficina.cookie, tres)).json()).toEqual({ estado: "verificando", paginas: null });
    await s.propietario.pool.query("select cola.encolar('archivos.verificar', $1::jsonb, null, $2, 10)", [JSON.stringify({ organizacionId: org.organizacionId, huella: tres }), `archivos.verificar:${org.organizacionId}:${tres}`]);
    await s.procesarCola();
    expect((await estado(org.oficina.cookie, tres)).json()).toEqual({ estado: "listo", paginas: 3 });
    // Empieza como un PDF y pasa la verificación de siempre, pero el informe no podría anexarlo: se avisa antes de publicar.
    expect((await estado(org.oficina.cookie, danado)).json()).toEqual({ estado: "ilegible", paginas: null });

    expect((await estado(org.tecnico.cookie, tres)).statusCode).toBe(403);
    expect((await estado(org.oficina.cookie, "0".repeat(64))).statusCode).toBe(404);
    const otra = await s.nuevaOrganizacionConUsuarios();
    expect((await estado(otra.oficina.cookie, tres)).statusCode).toBe(404);
  });
});

describe("PDF que no se puede generar", () => {
  it("un plano ilegible falla en el primer intento y sus envíos en cola quedan 'No llegó'", async () => {
    const { oficina, visitaId, revisado, informeId } = await visitaConRevisado();
    const { rows } = await s.propietario.pool.query("select cliente_id from visitas.visitas where id = $1", [visitaId]);
    const contacto = await post(oficina.cookie, `/api/clientes/${rows[0].cliente_id}/contactos`, { nombre: "Ana Torres", cargo: "", correo: "ana@cliente.example", celular: null, recibeCorreo: true, recibeWhatsapp: false });
    expect(contacto.statusCode, contacto.body).toBe(201);
    const plano = await subir(oficina.cookie, Buffer.from(`%PDF-1.7 ${randomUUID()} sin estructura`), "application/pdf");
    await s.procesarCola();
    await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "", conclusiones: "", levantamientos: [revisado], planos: [{ huella: plano, nombre: "Plano dañado" }] });
    const publicada = await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2, destinatarios: [contacto.json().contactos[0].id] });
    expect(publicada.statusCode, publicada.body).toBe(201);

    await hastaQueLosPdfEstenListos(informeId);
    const { rows: versiones } = await s.propietario.pool.query(
      "select v.pdf_estado, (select attempts from graphile_worker.jobs j where j.key = 'informes.generarPdf:' || v.id) as intentos from informes.versiones v where informe_id = $1",
      [informeId],
    );
    expect(versiones[0]).toMatchObject({ pdf_estado: "fallido", intentos: null });
    const detalle = (await get(oficina.cookie, `/api/informes/${informeId}`)).json();
    expect(detalle.versiones[0].envios).toEqual([expect.objectContaining({ estado: "fallido", error: expect.stringContaining("PDF") })]);
  }, 90_000);

  it("un fallo tardío no pisa un PDF que ya quedó listo ni da por no llegados sus envíos", async () => {
    const { oficina, organizacionId, visitaId, revisado, informeId } = await visitaConRevisado();
    const { rows } = await s.propietario.pool.query("select cliente_id from visitas.visitas where id = $1", [visitaId]);
    const contacto = await post(oficina.cookie, `/api/clientes/${rows[0].cliente_id}/contactos`, { nombre: "Ana Torres", cargo: "", correo: "ana@cliente.example", celular: null, recibeCorreo: true, recibeWhatsapp: false });
    await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "", conclusiones: "", levantamientos: [revisado], planos: [] });
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2 });
    await hastaQueLosPdfEstenListos(informeId);
    // Como justo después de publicar: el PDF se está generando y un envío lo espera.
    const { rows: versiones } = await s.propietario.pool.query("update informes.versiones set pdf_estado = 'generando' where informe_id = $1 returning id", [informeId]);
    const versionId: string = versiones[0].id;
    expect((await post(oficina.cookie, `/api/informes/${informeId}/versiones/1/enviar`, { destinos: [{ contactoId: contacto.json().contactos[0].id }] })).statusCode).toBe(200);

    // Otra pasada del trabajo lo deja listo; a esta se le pierde la conexión en su último intento.
    const almacenamiento = almacenamientoS3(s.config);
    const generador = crearGeneradorPdf({
      bd: s.conexionApp.bd,
      config: s.config,
      almacenamiento: {
        ...almacenamiento,
        async guardar() {
          await s.propietario.pool.query("update informes.versiones set pdf_estado = 'listo' where id = $1", [versionId]);
          throw new Error("Se perdió la conexión");
        },
      },
    });
    await generador.generarPdf({ organizacionId, versionId }, { ultimoIntento: true });
    const { rows: despues } = await s.propietario.pool.query("select pdf_estado from informes.versiones where id = $1", [versionId]);
    expect(despues[0].pdf_estado).toBe("listo");
    expect((await get(oficina.cookie, `/api/informes/${informeId}`)).json().versiones[0].envios).toEqual([expect.objectContaining({ estado: "en_cola" })]);
  }, 90_000);
});

describe("informe (corte 4)", () => {
  it("compone, publica y genera en segundo plano un PDF con los datos y el plano anexo, que no se vuelve a generar (QA-17)", async () => {
    const { oficina, visitaId, revisado, enviado, informeId } = await visitaConRevisado();
    // Abrir otra vez devuelve el mismo informe: uno por visita.
    expect((await post(oficina.cookie, "/api/informes", { visitaId })).json()).toEqual({ id: informeId });

    const detalle = (await get(oficina.cookie, `/api/informes/${informeId}`)).json();
    expect(detalle.candidatos.map((c: { id: string; estado: string }) => [c.id, c.estado])).toEqual([
      [revisado, "revisado"],
      [enviado, "enviado"],
    ]);

    const plano = await subir(oficina.cookie, await planoDePrueba(2), "application/pdf");
    await s.procesarCola();
    const guardado = await post(oficina.cookie, `/api/informes/${informeId}/borrador`, {
      version: 1,
      introduccion: "Se visitó el cuarto técnico.",
      conclusiones: "La UPS está en buen estado.",
      levantamientos: [revisado],
      planos: [{ huella: plano, nombre: "Planta del cuarto" }],
    });
    expect(guardado.json()).toEqual({ version: 2 });

    const publicada = await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2 });
    expect(publicada.statusCode, publicada.body).toBe(201);
    expect(publicada.json()).toMatchObject({ numero: 1, pdf: "generando", publicadaPor: { nombre: "Oficina de prueba" } });
    // Sin PDF listo, no hay descarga.
    expect((await get(oficina.cookie, `/api/informes/${informeId}/versiones/1/pdf`)).json()).toMatchObject({ codigo: "estado_invalido" });

    await hastaQueLosPdfEstenListos(informeId);
    const lista = (await get(oficina.cookie, "/api/informes")).json();
    expect(lista.elementos).toEqual([expect.objectContaining({ id: informeId, vigente: 1, pdf: "listo" })]);

    const pdf = await descargar(oficina.cookie, informeId, 1);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const documento = await PDFDocument.load(pdf);
    expect(documento.getTitle()).toBe("Informe técnico · Cliente <ficticio> · versión 1");
    // Portada, introducción y capítulo, conclusiones... más las 2 páginas del plano al final.
    expect(documento.getPageCount()).toBeGreaterThanOrEqual(4);
    const ultima = documento.getPage(documento.getPageCount() - 1).getSize();
    expect(ultima).toEqual({ width: 612, height: 792 });

    // Otra pasada del trabajo no regenera nada: el PDF entregado queda fijo.
    const antes = await s.propietario.pool.query("select pdf_huella, pdf_generado_en from informes.versiones where informe_id = $1", [informeId]);
    await s.procesarCola();
    const despues = await s.propietario.pool.query("select pdf_huella, pdf_generado_en from informes.versiones where informe_id = $1", [informeId]);
    expect(despues.rows).toEqual(antes.rows);
    expect(createHash("sha256").update(pdf).digest("hex")).toBe(antes.rows[0].pdf_huella);
  }, 90_000);

  it("una versión nueva deja la anterior intacta, y la base no deja modificar una publicada (QA-9)", async () => {
    const { oficina, organizacionId, revisado, informeId } = await visitaConRevisado();
    const borrador = (version: number, introduccion: string) => post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version, introduccion, conclusiones: "", levantamientos: [revisado], planos: [] });
    await borrador(1, "Primera redacción");
    await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2 });
    await borrador(3, "Segunda redacción");
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 4 })).json()).toMatchObject({ numero: 2 });
    await hastaQueLosPdfEstenListos(informeId);

    const { rows } = await s.propietario.pool.query("select numero, contenido->>'introduccion' as intro, pdf_estado from informes.versiones where informe_id = $1 order by numero", [informeId]);
    expect(rows).toEqual([
      { numero: 1, intro: "Primera redacción", pdf_estado: "listo" },
      { numero: 2, intro: "Segunda redacción", pdf_estado: "listo" },
    ]);
    expect((await descargar(oficina.cookie, informeId, 1)).subarray(0, 5).toString()).toBe("%PDF-");

    const error = await enOrganizacion(s.conexionApp.bd, organizacionId, (tx) => tx.execute(`update informes.versiones set contenido = '{}'::jsonb`)).then(
      () => null,
      (e: unknown) => String((e as { cause?: { message?: string } }).cause?.message ?? e),
    );
    expect(error).toMatch(/permission denied/);
  }, 90_000);

  it("lo que oficina oculta se guarda en el borrador y no entra en la versión, ni su foto (ADR-0039)", async () => {
    const { oficina, revisado, informeId, foto } = await visitaConRevisado();
    const seleccion = { ocultos: [`${revisado}|cuarto_tecnico|fotos_equipo|${foto}`], mostrados: [] };
    const guardado = await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "", conclusiones: "", levantamientos: [revisado], planos: [], seleccion });
    expect(guardado.statusCode, guardado.body).toBe(200);
    expect((await get(oficina.cookie, `/api/informes/${informeId}`)).json().seleccion).toEqual(seleccion);
    // Sin la selección (una pestaña anterior), la guardada no cambia.
    await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 2, introduccion: "Otra", conclusiones: "", levantamientos: [revisado], planos: [] });
    expect((await get(oficina.cookie, `/api/informes/${informeId}`)).json().seleccion).toEqual(seleccion);

    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 3 })).statusCode).toBe(201);
    const { rows } = await s.propietario.pool.query("select contenido from informes.versiones where informe_id = $1", [informeId]);
    const capitulo = rows[0].contenido.levantamientos[0];
    expect(capitulo.respuestas.cuarto_tecnico).toEqual({ potencia_nominal: { valor: "12.5", unidad: "kVA" }, fotos_equipo: [] });
    expect(JSON.stringify(rows[0].contenido)).not.toContain(foto);
  });

  it("solo entran levantamientos revisados de la visita, y publicar exige alguno y planos verificados (regla 9)", async () => {
    const { oficina, enviado, revisado, informeId } = await visitaConRevisado();
    const r = await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "", conclusiones: "", levantamientos: [enviado, randomUUID()], planos: [] });
    expect(r.statusCode).toBe(422);
    expect(r.json().erroresInforme.map((e: { codigo: string }) => e.codigo)).toEqual(["no_revisado", "levantamiento_desconocido"]);
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 1 })).json()).toMatchObject({
      codigo: "informe_invalido",
      erroresInforme: [{ codigo: "sin_levantamientos" }],
    });

    // Un plano que el worker todavía no verifica no entra en una versión.
    const plano = await subir(oficina.cookie, await planoDePrueba(), "application/pdf");
    await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "", conclusiones: "", levantamientos: [revisado], planos: [{ huella: plano, nombre: "Planta" }] });
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2 })).json()).toMatchObject({ codigo: "archivos_en_verificacion" });
    // Guardar con una versión vieja se rechaza.
    expect((await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "x", conclusiones: "", levantamientos: [], planos: [] })).json()).toMatchObject({
      codigo: "conflicto_de_version",
    });
  });

  it("un plano es un PDF: una foto verificada con su huella no se anexa", async () => {
    const { oficina, revisado, informeId, foto } = await visitaConRevisado();
    await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "", conclusiones: "", levantamientos: [revisado], planos: [{ huella: foto, nombre: "Planta" }] });
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2 })).json()).toMatchObject({
      codigo: "informe_invalido",
      erroresInforme: [{ codigo: "plano_invalido", huella: foto }],
    });
  });

  it("los técnicos no ven informes; campo sube fotos y oficina sube planos, nunca al revés", async () => {
    const { tecnico, oficina, informeId } = await visitaConRevisado();
    expect((await get(tecnico.cookie, `/api/informes/${informeId}`)).json()).toMatchObject({ codigo: "sin_permiso" });
    const intento = (cookie: string, tipo: string) =>
      app.inject({ method: "POST", url: "/api/archivos/subidas", headers: { cookie, ...cabecerasSync }, payload: { huella: "a".repeat(64), bytes: 10, tipo } });
    expect((await intento(tecnico.cookie, "application/pdf")).json()).toMatchObject({ codigo: "tipo_de_archivo_no_permitido" });
    expect((await intento(oficina.cookie, "image/jpeg")).json()).toMatchObject({ codigo: "tipo_de_archivo_no_permitido" });
  });
});

describe("plantilla del informe", () => {
  it("escapa lo que escriben las personas y marca lo que falta en lugar de inventarlo", () => {
    expect(escapar(`<script>"x"</script>&'`)).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;&amp;&#39;");
    const html = plantillaInforme(
      {
        formatoContenido: 1,
        numero: 3,
        publicadaEn: "2026-09-30T15:00:00.000Z",
        publicadaPor: "Oficina",
        organizacion: { nombre: "Organización ficticia" },
        visita: { cliente: "Cliente <b>", sitio: "Sede", direccion: "Calle [N]", motivo: "Mantenimiento", programadaPara: "2026-09-30" },
        introduccion: "Primer párrafo.\n\nSegundo <párrafo>.",
        conclusiones: "",
        levantamientos: [
          {
            id: "l1",
            formato: { formato: "f", version: 1, nombre: "Formato", secciones: [{ clave: "s", titulo: "Sección", campos: [{ clave: "fotos", etiqueta: "Fotos", tipo: "foto" }, { clave: "t", etiqueta: "Texto", tipo: "texto" }] }] },
            tecnico: "Técnico",
            revisor: "Revisora",
            recibidoEn: "2026-09-30T16:00:00.000Z",
            respuestas: { s: { fotos: ["a".repeat(64)] } },
          },
        ],
        planos: [],
      },
      { salida: { tipo: "pdf", fuente: "" }, fotos: new Map() },
    );
    expect(html).toContain("Cliente &lt;b&gt;");
    expect(html).toContain("<p>Segundo &lt;párrafo&gt;.</p>");
    // El logo oficial ya existe (DESIGN.md): va incrustado, no como marcador.
    expect(html).toContain(`<img class="logo" src="${LOGO_TEINS}"`);
    expect(html).toContain("[FOTO]");
    expect(html).toContain("Sin dato");
    expect(html).toContain("Versión 3");
    expect(html).not.toContain("<b>");
  });
});

describe("trabajos que quedaron a medias (ADR-0043)", () => {
  /** Como si el trabajo se hubiera perdido: ya no está en la cola. */
  const perderTrabajo = (llave: string) => s.propietario.pool.query("select graphile_worker.remove_job($1)", [llave]);
  const hayTrabajo = async (llave: string) => (await s.propietario.pool.query("select 1 from graphile_worker.jobs where key = $1", [llave])).rowCount === 1;

  it("un archivo subido sin verificar y un PDF que sigue «generando» vuelven a la cola pasadas 12 horas, y terminan", async () => {
    const { oficina, organizacionId, informeId, revisado } = await visitaConRevisado();
    const guardado = await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "Prueba", conclusiones: "Prueba", levantamientos: [revisado], planos: [] });
    expect(guardado.statusCode, guardado.body).toBe(200);
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2 })).statusCode).toBe(201);
    const { rows: versiones } = await s.propietario.pool.query("select id from informes.versiones where informe_id = $1", [informeId]);
    const versionId = versiones[0].id as string;
    const llavePdf = `informes.generarPdf:${versionId}`;

    const plano = await subir(oficina.cookie, await planoDePrueba(), "application/pdf");
    const llaveArchivo = `archivos.verificar:${organizacionId}:${plano}`;
    await perderTrabajo(llavePdf);
    await perderTrabajo(llaveArchivo);
    // La cola es compartida con otros archivos de prueba: pudieron procesarlos antes de perderlos. Se fija lo atascado.
    await s.propietario.pool.query("update informes.versiones set pdf_estado = 'generando', pdf_huella = null where id = $1", [versionId]);
    await s.propietario.pool.query("update archivos.archivos set estado = 'subido', verificado_en = null where huella = $1 and organizacion_id = $2", [plano, organizacionId]);

    // Dentro de su ventana de reintentos no se tocan: podrían seguir reintentando.
    await recuperarTrabajosAMedias(s.conexionApp.bd);
    expect(await hayTrabajo(llavePdf)).toBe(false);
    expect(await hayTrabajo(llaveArchivo)).toBe(false);

    await s.propietario.pool.query("update informes.versiones set publicada_en = now() - interval '13 hours' where id = $1", [versionId]);
    await s.propietario.pool.query("update archivos.archivos set subido_en = now() - interval '13 hours' where huella = $1 and organizacion_id = $2", [plano, organizacionId]);
    await recuperarTrabajosAMedias(s.conexionApp.bd);
    expect(await hayTrabajo(llavePdf)).toBe(true);
    expect(await hayTrabajo(llaveArchivo)).toBe(true);

    await s.esperarPdf({ informeId });
    const { rows } = await s.propietario.pool.query("select estado from archivos.archivos where huella = $1 and organizacion_id = $2", [plano, organizacionId]);
    expect(rows[0].estado).toBe("verificado");
  });
});
