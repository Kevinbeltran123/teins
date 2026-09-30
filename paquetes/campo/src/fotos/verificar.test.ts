import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { crearLevantamiento, type VersionFormato } from "@teins/dominio";
import { abrirBase, repositorioDexie } from "../datos/dexie";
import { verificarFotos } from "./verificar";

// Formato y datos ficticios (R5).
const formato: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "fotos", etiqueta: "F", tipo: "foto" }] }],
};
const ahora = new Date("2026-09-29T10:00:00.000Z");
const id = (n: number) => `0192f0e0-0000-7000-8000-${String(n).padStart(12, "0")}`;

function foto(texto: string) {
  const datos = new TextEncoder().encode(texto);
  return { id: createHash("sha256").update(datos).digest("hex"), datos: datos.buffer as ArrayBuffer, tipo: "image/jpeg", creadoEn: ahora.toISOString() };
}

const bases: ReturnType<typeof abrirBase>[] = [];
afterEach(async () => {
  for (const db of bases.splice(0)) await db.delete();
});

describe("verificar fotos (diagnóstico)", () => {
  it("verifica solo las fotos de quien tiene la sesión: lo de otro técnico no se abre, aunque su borrado esté a medias", async () => {
    const db = abrirBase(`verificar-${Math.random()}`);
    bases.push(db);
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, id(1), ahora), "t1");
    await repo.agregarFoto(id(1), "s", "fotos", foto("de t1"), ahora);
    await repo.crear(crearLevantamiento(formato, id(2), ahora), "t2");
    await repo.agregarFoto(id(2), "s", "fotos", foto("de t2"), ahora);
    // El borrado de t1 se interrumpió después de destruir su clave.
    await db.claves.delete("t1");

    expect(await verificarFotos(repo, "t2")).toEqual({ guardadas: 1, integras: 1, faltantes: 0 });
  });
});
