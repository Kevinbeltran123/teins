import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { registrarCambios } from "../src/modulos/cambios";
import { podarVencido } from "../src/modulos/mantenimiento";
import { periodicas } from "../src/tareas";
import { cabecerasSync, ORIGEN, servidorDePrueba } from "./ayudas";

const s = await servidorDePrueba();
const { app } = s;

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
