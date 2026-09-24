import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { encolar } from "../src/plataforma/cola";
import { archivos } from "../src/modulos/archivos/esquema";
import { registrar, verificarCadena } from "../src/modulos/auditoria";
import { conexionesDePrueba, nuevaOrganizacion } from "./ayudas";

const { app, propietario } = conexionesDePrueba();
const huella = () => randomUUID().replaceAll("-", "").repeat(2);

/** Drizzle envuelve el error de PostgreSQL; el motivo real está en la causa. */
const causa = (error: unknown) => String((error as { cause?: { message?: string } }).cause?.message ?? error);
async function rechazaPorPermiso(promesa: Promise<unknown>) {
  const error = await promesa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(causa(error)).toMatch(/permission denied/);
}

describe("seguridad por fila (ADR-0009)", () => {
  it("una organización no ve ni escribe datos de otra, y sin organización no se ve nada", async () => {
    const [a, b] = await Promise.all([nuevaOrganizacion(propietario), nuevaOrganizacion(propietario)]);
    const h = huella();
    await enOrganizacion(app.bd, a, (tx) =>
      tx.insert(archivos).values({ organizacionId: a, huella: h, tipo: "image/jpeg", bytes: 1, estado: "pendiente", creadoPor: "u" }),
    );

    const deA = await enOrganizacion(app.bd, a, (tx) => tx.select().from(archivos));
    const deB = await enOrganizacion(app.bd, b, (tx) => tx.select().from(archivos));
    const sinOrganizacion = await app.bd.select().from(archivos);
    expect(deA.map((f) => f.huella)).toEqual([h]);
    expect(deB).toEqual([]);
    expect(sinOrganizacion).toEqual([]);

    await expect(
      enOrganizacion(app.bd, b, (tx) =>
        tx.insert(archivos).values({ organizacionId: a, huella: huella(), tipo: "image/jpeg", bytes: 1, estado: "pendiente", creadoPor: "u" }),
      ),
    ).rejects.toThrow();
  });
});

describe("permisos del rol de la aplicación", () => {
  it("toda tabla de negocio tiene seguridad por fila y la aplicación no puede borrar en ninguna", async () => {
    const { rows } = await propietario.pool.query<{ tabla: string; rls: boolean; borrar: boolean }>(`
      select n.nspname || '.' || c.relname as tabla, c.relrowsecurity as rls,
             has_table_privilege('teins_app', c.oid, 'DELETE') as borrar
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where c.relkind = 'r' and n.nspname in ('formatos', 'archivos', 'auditoria', 'levantamientos')
      order by 1`);
    expect(rows.length).toBeGreaterThan(0);
    for (const fila of rows) {
      expect(fila, fila.tabla).toMatchObject({ rls: true, borrar: false });
    }
  });

  it("la auditoría y los formatos no se pueden modificar desde la aplicación", async () => {
    const { rows } = await propietario.pool.query<{ tabla: string; actualizar: boolean }>(`
      select t as tabla, has_table_privilege('teins_app', t, 'UPDATE') as actualizar
      from unnest(array['auditoria.registros', 'formatos.versiones']) as t`);
    expect(rows.every((r) => !r.actualizar)).toBe(true);
  });
});

describe("auditoría con cadena de hashes (ADR-0008)", () => {
  const evento = (organizacionId: string, agregadoId: string, n: number) => ({
    organizacionId,
    agregadoTipo: "levantamiento" as const,
    agregadoId,
    tipoEvento: "levantamiento_enviado" as const,
    autorId: "u1",
    correlacion: `c${n}`,
    valorNuevo: { n, texto: "Cuarto de prueba", lista: [1, 2] },
  });

  it("encadena por agregado y detecta la alteración de un eslabón", async () => {
    const org = await nuevaOrganizacion(propietario);
    const id = randomUUID();
    await enOrganizacion(app.bd, org, (tx) => registrar(tx, [evento(org, id, 1), evento(org, id, 2)]));
    await enOrganizacion(app.bd, org, (tx) => registrar(tx, [evento(org, id, 3)]));

    expect(await enOrganizacion(app.bd, org, (tx) => verificarCadena(tx, org, "levantamiento", id))).toEqual({ integra: true, eslabones: 3 });

    // Solo alguien con acceso de dueño puede alterar la tabla; la cadena lo delata.
    await propietario.pool.query(
      `update auditoria.registros set valor_nuevo = '{"n": 99}' where agregado_id = $1 and secuencia = 2`,
      [id],
    );
    expect(await enOrganizacion(app.bd, org, (tx) => verificarCadena(tx, org, "levantamiento", id))).toEqual({
      integra: false,
      primerEslabonRoto: 2,
    });
  });

  it("la aplicación no puede actualizar ni borrar registros", async () => {
    const org = await nuevaOrganizacion(propietario);
    const id = randomUUID();
    await enOrganizacion(app.bd, org, (tx) => registrar(tx, [evento(org, id, 1)]));
    await rechazaPorPermiso(enOrganizacion(app.bd, org, (tx) => tx.execute(sql`update auditoria.registros set motivo = 'x'`)));
    await rechazaPorPermiso(enOrganizacion(app.bd, org, (tx) => tx.execute(sql`delete from auditoria.registros`)));
  });

  it("escrituras simultáneas en la misma cadena no se pisan", async () => {
    const org = await nuevaOrganizacion(propietario);
    const id = randomUUID();
    await Promise.all(
      Array.from({ length: 8 }, (_, n) => enOrganizacion(app.bd, org, (tx) => registrar(tx, [evento(org, id, n)]))),
    );
    expect(await enOrganizacion(app.bd, org, (tx) => verificarCadena(tx, org, "levantamiento", id))).toEqual({ integra: true, eslabones: 8 });
  });
});

describe("cola transaccional (ADR-0012)", () => {
  const contar = async (llave: string) =>
    (
      await propietario.pool.query<{ n: string }>(
        "select count(*) as n from graphile_worker.jobs where task_identifier = 'archivos.verificar' and key = $1",
        [llave],
      )
    ).rows[0]!.n;

  it("un trabajo encolado en una transacción revertida no existe; en una confirmada, sí", async () => {
    const org = await nuevaOrganizacion(propietario);
    const revertida = huella();
    await expect(
      enOrganizacion(app.bd, org, async (tx) => {
        await encolar(tx, "archivos.verificar", { organizacionId: org, huella: revertida }, { llave: revertida });
        throw new Error("falla después de encolar");
      }),
    ).rejects.toThrow("falla después de encolar");
    expect(await contar(revertida)).toBe("0");

    const confirmada = huella();
    await enOrganizacion(app.bd, org, (tx) => encolar(tx, "archivos.verificar", { organizacionId: org, huella: confirmada }, { llave: confirmada }));
    expect(await contar(confirmada)).toBe("1");
  });
});
