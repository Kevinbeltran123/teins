import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { llaveDeEnvio } from "@teins/protocolo";
import { claveDeObjeto, almacenamientoS3 } from "../src/plataforma/almacenamiento";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { registrarCambios } from "../src/modulos/cambios";
import { verificarCadena } from "../src/modulos/auditoria";
import { clientesYSitios } from "../src/modulos/clientes";
import { limpiarArchivosSinUso, podarVencido, quitarAccesosSinUso } from "../src/modulos/mantenimiento";
import { crearVisitas } from "../src/modulos/visitas";
import { periodicas } from "../src/tareas";
import { cabecerasSync, jpegDePrueba, ORIGEN, servidorDePrueba } from "./ayudas";
import { conPortal } from "./portal-ayudas";

const s = await servidorDePrueba();
const { app } = s;
const almacenamiento = almacenamientoS3(s.config);

describe("tareas periódicas (ADR-0043)", () => {
  it("se declaran como objetos que el worker acepta", () => {
    // El crontab de texto rechazaba «mantenimiento.recuperar» por el punto, y el worker no arrancaba.
    expect(periodicas()).toEqual([expect.objectContaining({ task: "mantenimiento.recuperar" })]);
  });
});

describe("poda en el servidor (ADR-0044)", () => {
  it("compacta el registro: queda lo último de cada cosa para cada quien, y la bajada desde cero da lo mismo", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const visita = randomUUID();
    const otraVisita = randomUUID();
    const cambio = (entidadId: string, operacion: "cambio" | "fuera_de_alcance") => ({ organizacionId, usuarioId: tecnico.id, entidad: "visita" as const, entidadId, operacion });
    await enOrganizacion(s.conexionApp.bd, organizacionId, async (tx) => {
      await registrarCambios(tx, [cambio(visita, "cambio")]);
      await registrarCambios(tx, [cambio(visita, "cambio")]);
      await registrarCambios(tx, [cambio(otraVisita, "cambio")]);
      await registrarCambios(tx, [cambio(visita, "fuera_de_alcance")]);
    });
    const filas = async () =>
      (await s.propietario.pool.query("select entidad_id, operacion from cambios.registro where usuario_id = $1 order by secuencia", [tecnico.id])).rows.map((f) => [f.entidad_id, f.operacion]);
    expect((await filas()).length).toBe(4);

    await podarVencido({ negocio: s.conexionApp.bd, propietario: s.propietario.bd });
    expect(await filas()).toEqual([
      [otraVisita, "cambio"],
      [visita, "fuera_de_alcance"],
    ]);
    // Lo de otra organización y lo de toda la organización (formatos, sin destinatario) siguen ahí.
    const formatos = (await s.propietario.pool.query("select count(*)::int as n from cambios.registro where organizacion_id = $1 and usuario_id is null", [organizacionId])).rows[0].n;
    expect(formatos).toBeGreaterThan(0);
    const bajada = await app.inject({ method: "GET", url: "/api/sync/cambios?desde=0&app=15", headers: { cookie: tecnico.cookie, ...cabecerasSync } });
    expect(bajada.statusCode, bajada.body).toBe(200);
  });

  it("borra las sesiones vencidas hace más de un día y deja las vigentes", async () => {
    const { oficina } = await s.nuevaOrganizacionConUsuarios();
    const vencida = (await s.propietario.pool.query("select id from identidad.sesiones where usuario_id = $1 limit 1", [oficina.id])).rows[0].id as string;
    await s.propietario.pool.query("update identidad.sesiones set expira_en = now() - interval '2 days' where id = $1", [vencida]);
    const otra = await s.nuevaOrganizacionConUsuarios();
    await podarVencido({ negocio: s.conexionApp.bd, propietario: s.propietario.bd });
    expect((await s.propietario.pool.query("select 1 from identidad.sesiones where id = $1", [vencida])).rowCount).toBe(0);
    expect((await s.propietario.pool.query("select 1 from identidad.sesiones where usuario_id = $1", [otra.oficina.id])).rowCount).toBeGreaterThan(0);
  });
});

describe("teléfonos en Administración (ADR-0044)", () => {
  it("muestra los que tuvieron contacto en 90 días y los que tienen una orden de borrado sin confirmar; no borra ninguno", async () => {
    const { tecnico, organizacionId } = await s.nuevaOrganizacionConUsuarios();
    const admin = await s.nuevoAdministrador(organizacionId);
    const [reciente, olvidado, conOrden] = [randomUUID(), randomUUID(), randomUUID()];
    const insertar = (id: string, dias: number, orden = false) =>
      s.propietario.pool.query(
        `insert into identidad.dispositivos (id, usuario_id, organizacion_id, secreto_huella, ultimo_contacto, orden_de_borrado_en) values ($1, $2, $3, 'x', now() - ($4 || ' days')::interval, ${orden ? "now()" : "null"})`,
        [id, tecnico.id, organizacionId, String(dias)],
      );
    await insertar(reciente, 3);
    await insertar(olvidado, 120);
    await insertar(conOrden, 200, true);
    const r = await app.inject({ method: "GET", url: "/api/administracion/dispositivos", headers: { cookie: admin.cookie, origin: ORIGEN } });
    expect(r.statusCode, r.body).toBe(200);
    expect((r.json().dispositivos as { id: string }[]).map((d) => d.id).sort()).toEqual([reciente, conOrden].sort());
    expect((await s.propietario.pool.query("select 1 from identidad.dispositivos where id = $1", [olvidado])).rowCount).toBe(1);
  });
});

describe("archivos sin uso (ADR-0007, ADR-0048)", () => {
  async function subir(cookie: string, datos: Buffer, tipo: "image/jpeg" | "application/pdf") {
    const huella = createHash("sha256").update(datos).digest("hex");
    const r = await app.inject({ method: "POST", url: "/api/archivos/subidas", headers: { cookie, ...cabecerasSync }, payload: { huella, bytes: datos.length, tipo } });
    expect(r.statusCode, r.body).toBe(200);
    const a = r.json();
    if (a.estado === "autorizada") expect((await fetch(a.url, { method: "PUT", headers: a.cabeceras, body: datos })).status).toBe(200);
    await app.inject({ method: "POST", url: `/api/archivos/${huella}/subido`, headers: { cookie, ...cabecerasSync } });
    return huella;
  }
  const post = (cookie: string, url: string, payload: object) => app.inject({ method: "POST", url, headers: { cookie }, payload });

  it("borra la fila y el objeto de lo que nadie usa pasado el plazo; no lo reciente, lo usado, lo publicado ni los planos", async () => {
    const org = await s.nuevaOrganizacionConUsuarios();
    const { organizacionId, tecnico, oficina } = org;
    const visitaId = await enOrganizacion(s.conexionApp.bd, organizacionId, async (tx) => {
      const { clienteId, sitioId } = await clientesYSitios.crear(tx, { organizacionId, nombre: "Cliente ficticio", sitio: { nombre: "Sede", direccion: "Calle [N]" } });
      return crearVisitas(clientesYSitios).crear(tx, { organizacionId, autorId: "prueba", correlacion: "prueba", clienteId, sitioId, motivo: "Mantenimiento", programadaPara: "2026-09-30", tecnicos: [tecnico.id] });
    });
    const foto = () => subir(tecnico.cookie, jpegDePrueba().datos, "image/jpeg");
    const [sinUso, reciente, usada, publicada] = [await foto(), await foto(), await foto(), await foto()];
    const plano = await subir(oficina.cookie, Buffer.from(`%PDF-1.7 ${randomUUID()} plano ficticio`), "application/pdf");
    await s.procesarCola();

    const enviar = async (fotos: string[], cookie = tecnico.cookie) => {
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
            visitaId,
            respuestas: { cuarto_tecnico: { potencia_nominal: { valor: "12.5", unidad: "kVA" }, fotos_equipo: fotos } },
            creadoEn: "2026-09-30T10:00:00.000-05:00",
            enviadoEn: "2026-09-30T11:00:00.000-05:00",
          },
        },
      });
      expect(r.statusCode, r.body).toBe(200);
      return id;
    };
    // De un segundo técnico: cada uno envía un solo levantamiento por visita (ADR-0054).
    await enviar([usada], (await s.nuevoTecnico(organizacionId)).cookie);
    const revisado = await enviar([publicada]);
    expect((await post(oficina.cookie, `/api/levantamientos/${revisado}/tomar`, { version: 1 })).statusCode).toBe(200);
    expect((await post(oficina.cookie, `/api/levantamientos/${revisado}/marcar-revisado`, { version: 2 })).statusCode).toBe(200);
    const { id: informeId } = (await post(oficina.cookie, "/api/informes", { visitaId })).json();
    await post(oficina.cookie, `/api/informes/${informeId}/borrador`, { version: 1, introduccion: "", conclusiones: "", levantamientos: [revisado], planos: [] });
    expect((await post(oficina.cookie, `/api/informes/${informeId}/publicar`, { version: 2 })).statusCode).toBe(201);

    const envejecer = (huellas: string[], dias: number) =>
      s.propietario.pool.query(
        "update archivos.archivos set creado_en = now() - ($3 || ' days')::interval, subido_en = now() - ($3 || ' days')::interval, verificado_en = now() - ($3 || ' days')::interval where organizacion_id = $1 and huella = any($2)",
        [organizacionId, huellas, String(dias)],
      );
    await envejecer([sinUso, usada, publicada, plano], 200);
    await envejecer([reciente], 100);

    const limpiar = () => limpiarArchivosSinUso({ negocio: s.conexionApp.bd, propietario: s.propietario.bd, almacenamiento });
    await limpiar();
    const filas = async () =>
      (await s.propietario.pool.query("select huella from archivos.archivos where organizacion_id = $1", [organizacionId])).rows.map((f) => f.huella as string).sort();
    expect(await filas()).toEqual([reciente, usada, publicada, plano].sort());
    const existe = (huella: string) => almacenamiento.existe(claveDeObjeto(organizacionId, huella));
    expect(await existe(sinUso)).toBe(false);
    for (const h of [reciente, usada, publicada, plano]) expect(await existe(h)).toBe(true);

    // Otra pasada no encuentra nada que borrar.
    expect(await limpiar()).toBe(0);
    expect(await filas()).toEqual([reciente, usada, publicada, plano].sort());
  }, 60_000);
});

describe("accesos al portal sin uso (ADR-0055)", () => {
  it("quita los que llevan 12 meses sin entrar, o sin estrenar, con sus sesiones; deja los demás y lo audita", async () => {
    const p = conPortal(s);
    const org = await s.nuevaOrganizacionConUsuarios();
    const { clienteId } = await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) =>
      clientesYSitios.crear(tx, { organizacionId: org.organizacionId, nombre: "Cliente con portal", sitio: { nombre: "Sede", direccion: "Calle [N]" } }),
    );
    const sufijo = randomUUID().slice(0, 8);
    const conAcceso = async (nombre: string) => {
      const contacto = await p.contacto(org, clienteId, { nombre, correo: `${nombre.toLowerCase()}.${sufijo}@cliente.example`, recibeInformes: true, recibeCotizaciones: false });
      expect((await p.darAcceso(org, clienteId, contacto.id)).statusCode).toBe(200);
      return contacto.id;
    };
    const [viejo, sinEstrenar, reciente, nuevo] = [await conAcceso("Viejo"), await conAcceso("Estreno"), await conAcceso("Reciente"), await conAcceso("Nuevo")];
    await p.entrarCompleto(`viejo.${sufijo}@cliente.example`, "203.0.113.71");
    await p.entrarCompleto(`reciente.${sufijo}@cliente.example`, "203.0.113.72");

    const fijar = (contactoId: string, columna: "creado_en" | "ultimo_ingreso", meses: number) =>
      s.propietario.pool.query(`update portal.accesos set ${columna} = now() - make_interval(months => $2) where contacto_id = $1`, [contactoId, meses]);
    await fijar(viejo, "creado_en", 20);
    await fijar(viejo, "ultimo_ingreso", 13);
    await fijar(sinEstrenar, "creado_en", 13);
    await fijar(reciente, "creado_en", 20);
    await fijar(reciente, "ultimo_ingreso", 11);
    await fijar(nuevo, "creado_en", 11);

    expect(await quitarAccesosSinUso(s.conexionApp.bd)).toBeGreaterThanOrEqual(2);

    const quedan = await s.propietario.pool.query("select contacto_id from portal.accesos where cliente_id = $1", [clienteId]);
    expect(quedan.rows.map((f) => f.contacto_id).sort()).toEqual([reciente, nuevo].sort());
    // La sesión del viejo se fue con su acceso; queda solo la del reciente.
    const { rows: [{ total }] } = await s.propietario.pool.query("select count(*)::int as total from portal.sesiones where cliente_id = $1", [clienteId]);
    expect(total).toBe(1);

    const eventos = await s.propietario.pool.query(
      "select valor_anterior, autor_id, motivo from auditoria.registros where agregado_id = $1 and tipo_evento = 'acceso_portal_quitado' order by secuencia",
      [clienteId],
    );
    expect(eventos.rows.map((f) => f.valor_anterior.contacto).sort()).toEqual([viejo, sinEstrenar].sort());
    expect(eventos.rows.every((f) => f.autor_id === "sistema" && f.motivo === "sin_uso")).toBe(true);
    expect(await enOrganizacion(s.conexionApp.bd, org.organizacionId, (tx) => verificarCadena(tx, org.organizacionId, "cliente", clienteId))).toMatchObject({ integra: true });

    // Otra pasada no quita nada más de este cliente.
    await quitarAccesosSinUso(s.conexionApp.bd);
    expect((await s.propietario.pool.query("select count(*)::int as total from portal.accesos where cliente_id = $1", [clienteId])).rows[0].total).toBe(2);
  }, 60_000);
});
