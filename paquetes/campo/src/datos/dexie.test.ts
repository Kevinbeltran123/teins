import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { crearLevantamiento, type VersionFormato } from "@teins/dominio";
import { abrirBase, repositorioDexie } from "./dexie";
import type { ArchivoLocal } from "./repositorio";

// Formato ficticio (R5).
const formato: VersionFormato = { formato: "prueba", version: 1, secciones: [] };
const ahora = new Date("2026-09-24T10:00:00.000Z");
const despues = new Date("2026-09-24T10:05:00.000Z");

function archivo(id: string): ArchivoLocal {
  return { id, datos: new Uint8Array([1, 2, 3]).buffer, tipo: "image/jpeg", creadoEn: ahora.toISOString() };
}

let n = 0;
const bases: ReturnType<typeof abrirBase>[] = [];
function nuevaBase() {
  const db = abrirBase(`prueba-${n++}`);
  bases.push(db);
  return db;
}
afterEach(async () => {
  for (const db of bases.splice(0)) await db.delete();
});

describe("repositorio de levantamientos en Dexie", () => {
  it("guarda y borra respuestas, y actualiza la hora de modificación", async () => {
    const repo = repositorioDexie(nuevaBase());
    await repo.crear(crearLevantamiento(formato, "l1", ahora));

    await repo.guardarRespuesta("l1", "s", "potencia", { valor: "12.5", unidad: "kVA" }, despues);
    expect((await repo.obtener("l1"))?.respuestas).toEqual({ s: { potencia: { valor: "12.5", unidad: "kVA" } } });
    expect((await repo.obtener("l1"))?.actualizadoEn).toBe(despues.toISOString());

    await repo.guardarRespuesta("l1", "s", "potencia", undefined, despues);
    expect((await repo.obtener("l1"))?.respuestas).toEqual({ s: {} });
  });

  it("guarda la foto y su referencia juntas, sin duplicar la misma huella", async () => {
    const repo = repositorioDexie(nuevaBase());
    await repo.crear(crearLevantamiento(formato, "l1", ahora));

    await repo.agregarFoto("l1", "s", "fotos", archivo("h1"), despues);
    await repo.agregarFoto("l1", "s", "fotos", archivo("h1"), despues);
    await repo.agregarFoto("l1", "s", "fotos", archivo("h2"), despues);

    expect((await repo.obtener("l1"))?.respuestas["s"]?.["fotos"]).toEqual(["h1", "h2"]);
    expect((await repo.todosLosArchivos()).map((a) => a.id)).toEqual(["h1", "h2"]);
  });

  it("no guarda el archivo si el levantamiento no existe", async () => {
    const repo = repositorioDexie(nuevaBase());
    await expect(repo.agregarFoto("no-existe", "s", "fotos", archivo("h1"), despues)).rejects.toThrow();
    expect(await repo.todosLosArchivos()).toEqual([]);
  });

  it("conserva los datos al cerrar y volver a abrir la base", async () => {
    const db = nuevaBase();
    await repositorioDexie(db).crear(crearLevantamiento(formato, "l1", ahora));
    await repositorioDexie(db).agregarFoto("l1", "s", "fotos", archivo("h1"), despues);
    db.close();

    const reabierta = abrirBase(db.name);
    bases.push(reabierta);
    const repo = repositorioDexie(reabierta);
    expect(await repo.obtener("l1")).toBeDefined();
    expect(await repo.obtenerArchivos(["h1"])).toHaveLength(1);
  });
});
