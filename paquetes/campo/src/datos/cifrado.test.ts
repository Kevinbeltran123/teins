import "fake-indexeddb/auto";
import { createHash } from "node:crypto";
import Dexie from "dexie";
import { afterEach, describe, expect, it, vi } from "vitest";
import { crearLevantamiento, type VersionFormato } from "@teins/dominio";
import { almacenDexie } from "../sincronizacion/almacen";
import type { BaseCampo } from "./base";
import { DatoIlegible } from "./cofre";
import { abrirBase, repositorioDexie } from "./dexie";
import { estadoDe, visitaDe } from "./lecturas";
import { contarPorSellar, sellarPendientes } from "./registros";
import { pendientesDe, responder } from "./conversacion";

// Formato y datos ficticios (R5). "SECRETO" marca lo que nunca debe leerse en la base.
const formato: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto" }, { clave: "fotos", etiqueta: "F", tipo: "foto" }] }],
};
const ahora = new Date("2026-09-25T10:00:00.000Z");
const id = (n: number) => `0192f0e0-0000-7000-8000-${String(n).padStart(12, "0")}`;

function foto(texto: string) {
  const datos = new TextEncoder().encode(texto);
  return { id: createHash("sha256").update(datos).digest("hex"), datos: datos.buffer as ArrayBuffer, tipo: "image/jpeg", creadoEn: ahora.toISOString() };
}

const bases: Dexie[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  for (const db of bases.splice(0)) await db.delete();
});
function nuevaBase(nombre = `cifrado-${Math.random()}`) {
  const db = abrirBase(nombre);
  bases.push(db);
  return db;
}

/** Todo lo que hay en la base, como texto: los bytes de los archivos se leen tal cual están guardados. */
async function contenidoCrudo(db: BaseCampo): Promise<string> {
  const partes: string[] = [];
  for (const tabla of db.tables) {
    for (const fila of await tabla.toArray()) {
      partes.push(JSON.stringify(fila, (_k, v: unknown) => (v instanceof ArrayBuffer ? new TextDecoder().decode(v) : v)));
    }
  }
  return partes.join("\n");
}

const visita = { id: id(900), cliente: { nombre: "Cliente SECRETO" }, sitio: { nombre: "Sede SECRETO", direccion: "Calle SECRETO [N]" }, motivo: "Mantenimiento", programadaPara: "2026-09-30" };
const comentario = { id: id(901), texto: "Revisa el SECRETO", autor: "Oficina", creadoEn: ahora.toISOString() };

describe("cifrado local (iteración 12, ADR-0022)", () => {
  it("lo que el técnico responde a oficina se guarda cifrado y se lee igual (ADR-0040)", async () => {
    const db = nuevaBase();
    await responder(db, "t1", { levantamientoId: id(1), comentarioId: id(2), texto: "Nadie me recibió SECRETO" }, ahora);
    expect(await contenidoCrudo(db)).not.toContain("SECRETO");
    expect(await pendientesDe(db, "t1", id(1))).toMatchObject([{ texto: "Nadie me recibió SECRETO", comentarioId: id(2), creadaEn: ahora.toISOString() }]);
  });

  it("respuestas, fotos, comando, visitas y comentarios se guardan cifrados y se leen iguales", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const almacen = almacenDexie(db);
    const f = foto("foto SECRETO");
    await repo.crear(crearLevantamiento(formato, id(1), ahora, visita.id), "t1");
    await repo.guardarRespuesta(id(1), "s", "t", "Tablero SECRETO", ahora);
    await repo.agregarFoto(id(1), "s", "fotos", f, ahora);
    expect((await repo.enviar(id(1), formato, ahora)).ok).toBe(true);
    await almacen.aplicarBajada(
      "t1",
      { cambios: [{ tipo: "visita", visita }, { tipo: "levantamiento", id: id(1), estado: "revisado", recibidoEn: ahora.toISOString(), comentarios: [comentario] }], puntoDeControl: 2, hayMas: false, permisoLocalHasta: "2026-10-01T00:00:00.000Z" },
      12,
      ahora.toISOString(),
    );

    expect(await contenidoCrudo(db)).not.toContain("SECRETO");
    expect(await contarPorSellar(db)).toBe(0);

    // Lo que ven la app y el motor es lo mismo que se guardó.
    expect((await repo.obtener(id(1)))?.respuestas).toEqual({ s: { t: "Tablero SECRETO", fotos: [f.id] } });
    const [abierta] = await repo.obtenerArchivos([f.id]);
    expect(new TextDecoder().decode(abierta!.datos)).toBe("foto SECRETO");
    expect(createHash("sha256").update(new Uint8Array(abierta!.datos)).digest("hex")).toBe(f.id);
    expect((await almacen.archivosPorSubir("t1")).map((a) => new TextDecoder().decode(a.datos))).toEqual(["foto SECRETO"]);
    const [envio] = await almacen.enviosListos(Number.MAX_SAFE_INTEGER, "t1");
    expect(envio?.comando.levantamiento.respuestas).toEqual({ s: { t: "Tablero SECRETO", fotos: [f.id] } });
    expect(await visitaDe(db, "t1", visita.id)).toEqual({ ...visita, tecnicoId: "t1" });
    expect((await estadoDe(db, id(1)))?.comentarios).toEqual([comentario]);
  });

  it("la clave no sale del navegador y un sellado copiado a otro registro no abre", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, id(1), ahora), "t1");
    await repo.crear(crearLevantamiento(formato, id(2), ahora), "t1");
    await repo.guardarRespuesta(id(1), "s", "t", "del uno", ahora);

    const { clave } = (await db.claves.get("t1"))!;
    expect(clave.extractable).toBe(false);
    await expect(crypto.subtle.exportKey("raw", clave)).rejects.toThrow();

    // El id del registro va autenticado con el cifrado: pegar el sellado del uno en el dos no lo abre.
    const uno = await db.levantamientos.get(id(1));
    await db.levantamientos.update(id(2), { sellado: uno!.sellado });
    await expect(repo.obtener(id(2))).rejects.toThrow();
  });

  it("escrituras seguidas no se pisan y quedan en el orden en que se pidieron, también entre pestañas", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const conMuchos: VersionFormato = { ...formato, secciones: [{ clave: "s", titulo: "S", campos: Array.from({ length: 8 }, (_, i) => ({ clave: `c${i}`, etiqueta: `C${i}`, tipo: "texto" as const })) }] };
    await repo.crear(crearLevantamiento(conMuchos, id(1), ahora), "t1");
    await Promise.all(Array.from({ length: 8 }, (_, i) => repo.guardarRespuesta(id(1), "s", `c${i}`, `valor ${i}`, ahora)));
    expect((await repo.obtener(id(1)))?.respuestas.s).toEqual(Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`c${i}`, `valor ${i}`])));

    // Cada tecla guarda el texto completo: la última pedida es la que queda.
    await Promise.all(["P", "Pi", "Pis", "Piso"].map((texto) => repo.guardarRespuesta(id(1), "s", "c0", texto, ahora)));
    expect((await repo.obtener(id(1)))?.respuestas.s?.c0).toBe("Piso");

    // Otra pestaña es otro repositorio sobre la misma base: la comprobación optimista la cubre.
    const otraPestana = repositorioDexie(db);
    await Promise.all([repo.guardarRespuesta(id(1), "s", "c1", "de esta", ahora), otraPestana.guardarRespuesta(id(1), "s", "c2", "de la otra", ahora)]);
    expect((await repo.obtener(id(1)))?.respuestas.s).toMatchObject({ c1: "de esta", c2: "de la otra" });
  });

  it("lo guardado antes del cifrado se cifra sin perder nada; lo que no tiene responsable espera a tenerlo (regla 5)", async () => {
    const nombre = `cifrado-migracion-${Math.random()}`;
    // Base tal como la dejó la iteración 11 (versión 3): todo a la vista.
    const v3 = new Dexie(nombre);
    v3.version(1).stores({ levantamientos: "id, estado, actualizadoEn", archivos: "id" });
    v3.version(2).stores({ levantamientos: "id, estado, actualizadoEn, tecnicoId", archivos: "id, subida", envios: "levantamientoId, estado, tecnicoId", ajustes: "clave" });
    v3.version(3).stores({ formatos: "[formato+version], formato", visitas: "[tecnicoId+id], tecnicoId", estadosServidor: "id, tecnicoId", bajadas: "tecnicoId" });
    const [subida, pendiente, deNadie] = [foto("subida SECRETO"), foto("pendiente SECRETO"), foto("de nadie SECRETO")];
    const borrador = { ...crearLevantamiento(formato, id(1), ahora), tecnicoId: "t1", respuestas: { s: { t: "borrador SECRETO", fotos: [subida.id, pendiente.id] } } };
    const sinResponsable = { ...crearLevantamiento(formato, id(2), ahora), respuestas: { s: { t: "corte 0 SECRETO", fotos: [deNadie.id] } } };
    const comando = { tipo: "EnviarLevantamiento", llave: `enviar:${id(3)}`, levantamiento: { id: id(3), formato: "prueba", versionFormato: 1, respuestas: { s: { t: "enviado SECRETO" } }, creadoEn: ahora.toISOString(), enviadoEn: ahora.toISOString() } };
    await v3.table("levantamientos").bulkAdd([borrador, sinResponsable]);
    await v3.table("archivos").bulkAdd([
      { ...subida, subida: "subida" },
      { ...pendiente, subida: "pendiente" },
      { ...deNadie, subida: "pendiente" },
    ]);
    await v3.table("envios").add({ levantamientoId: id(3), tecnicoId: "t1", comando, estado: "pendiente", intentos: 2, proximoIntentoEn: 0, creadoEn: ahora.toISOString() });
    await v3.table("visitas").add({ ...visita, tecnicoId: "t1" });
    await v3.table("estadosServidor").add({ id: id(3), tecnicoId: "t1", estado: "revisado", recibidoEn: ahora.toISOString(), comentarios: [comentario] });
    v3.close();

    const db = nuevaBase(nombre);
    const repo = repositorioDexie(db);
    expect(db.verno).toBe(7);
    expect(await contarPorSellar(db)).toBe(6);
    await sellarPendientes(db);
    expect(await contarPorSellar(db)).toBe(0);

    // Lo del técnico quedó cifrado e igual; su estado de subida y su envío siguen donde estaban.
    expect((await repo.obtener(id(1)))?.respuestas).toEqual(borrador.respuestas);
    const archivos = (await repo.todosLosArchivos()).map((a) => `${new TextDecoder().decode(a.datos)}: ${a.subida}`);
    expect(archivos.sort()).toEqual(["de nadie SECRETO: pendiente", "pendiente SECRETO: pendiente", "subida SECRETO: subida"]);
    expect((await almacenDexie(db).enviosListos(Number.MAX_SAFE_INTEGER, "t1"))[0]).toMatchObject({ comando, intentos: 2 });
    expect(await visitaDe(db, "t1", visita.id)).toEqual({ ...visita, tecnicoId: "t1" });
    expect((await estadoDe(db, id(3)))?.comentarios).toEqual([comentario]);

    // El borrador del corte 0 no tiene dueño todavía: sigue a la vista, intacto, hasta que alguien inicia sesión.
    const crudo = await contenidoCrudo(db);
    expect(crudo).toContain("corte 0 SECRETO");
    expect(crudo).toContain("de nadie SECRETO");
    expect(crudo).not.toContain("borrador SECRETO");
    expect(crudo).not.toContain("enviado SECRETO");
    await repo.asignarSinResponsable("t2");
    await sellarPendientes(db);
    expect(await contenidoCrudo(db)).not.toContain("SECRETO");
    expect((await repo.obtener(id(2)))?.respuestas).toEqual(sinResponsable.respuestas);
  });

  it("el borrado destruye primero la clave: si se interrumpe, lo que quedó es ilegible y se termina después", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const almacen = almacenDexie(db);
    await repo.crear(crearLevantamiento(formato, id(1), ahora), "t1");
    await repo.agregarFoto(id(1), "s", "fotos", foto("de t1"), ahora);

    // Como si la app se cerrara justo después del primer paso del borrado.
    await db.transaction("rw", [db.claves, db.ajustes], async () => {
      await db.claves.delete("t1");
      await db.ajustes.put({ clave: "borrados_por_confirmar", valor: ["t1"] });
    });
    await expect(repo.obtener(id(1))).rejects.toBeInstanceOf(DatoIlegible);

    await almacen.completarBorrados();
    expect(await db.levantamientos.count()).toBe(0);
    expect(await db.archivos.count()).toBe(0);
  });

  it("borrar a un técnico no le quita a otro una foto que ambos usan", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const compartida = foto("la misma foto");
    await repo.crear(crearLevantamiento(formato, id(1), ahora), "t1");
    await repo.agregarFoto(id(1), "s", "fotos", compartida, ahora);
    await repo.crear(crearLevantamiento(formato, id(2), ahora), "t2");
    await repo.agregarFoto(id(2), "s", "fotos", compartida, ahora);
    expect((await db.archivos.get(compartida.id))?.tecnicoId).toBe("t1");

    await almacenDexie(db).borrarDatosDe("t1", ahora.toISOString());
    expect(await db.claves.get("t1")).toBeUndefined();
    expect(await repo.obtener(id(1))).toBeUndefined();
    const [deT2] = await repo.obtenerArchivos([compartida.id]);
    expect(new TextDecoder().decode(deT2!.datos)).toBe("la misma foto");
    expect((await db.archivos.get(compartida.id))?.tecnicoId).toBe("t2");
  });

  it("con un borrado a medias no nace otra clave para el revocado, y lo de los demás se cifra igual", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    // A la vista, de antes del cifrado: uno del revocado y uno de otro técnico.
    await db.levantamientos.bulkAdd([
      { ...crearLevantamiento(formato, id(1), ahora), tecnicoId: "t1", respuestas: { s: { t: "de t1 SECRETO" } } },
      { ...crearLevantamiento(formato, id(2), ahora), tecnicoId: "t2", respuestas: { s: { t: "de t2 SECRETO" } } },
    ]);
    // Como si la app se cerrara justo después del primer paso del borrado de t1.
    await db.ajustes.put({ clave: "borrados_por_confirmar", valor: ["t1"] });

    await sellarPendientes(db);
    expect(await db.claves.get("t1")).toBeUndefined();
    expect((await db.levantamientos.get(id(2)))?.sellado).toBeDefined();
    expect(await contarPorSellar(db)).toBe(0);
    await expect(repo.crear(crearLevantamiento(formato, id(3), ahora), "t1")).rejects.toBeInstanceOf(DatoIlegible);
    expect(await db.claves.get("t1")).toBeUndefined();

    await almacenDexie(db).completarBorrados();
    expect(await db.levantamientos.toCollection().primaryKeys()).toEqual([id(2)]);
  });

  it("borrar a un técnico no le quita a un borrador sin responsable una foto que ambos usan (regla 5)", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const compartida = foto("la misma foto");
    await repo.crear(crearLevantamiento(formato, id(1), ahora), "t1");
    await repo.agregarFoto(id(1), "s", "fotos", compartida, ahora);
    await db.levantamientos.add({ ...crearLevantamiento(formato, id(2), ahora), respuestas: { s: { fotos: [compartida.id] } } });
    expect((await db.archivos.get(compartida.id))?.tecnicoId).toBe("t1");

    await almacenDexie(db).borrarDatosDe("t1", ahora.toISOString());
    const [delBorrador] = await repo.obtenerArchivos([compartida.id]);
    expect(new TextDecoder().decode(delBorrador!.datos)).toBe("la misma foto");

    // Cuando alguien recibe el borrador, la foto se cifra con su clave.
    await repo.asignarSinResponsable("t2");
    await sellarPendientes(db);
    expect((await db.archivos.get(compartida.id))?.tecnicoId).toBe("t2");
  });

  it("el borrado olvida lo que el revocado descartó en el teléfono, no lo de los demás", async () => {
    const guardado = new Map([
      ["teins-avisos-descartados:t1", "2026-09-25"],
      ["teins-llave-descartada:t1", "2026-09-25"],
      ["teins-llave-descartada:t2", "2026-09-25"],
    ]);
    vi.stubGlobal("localStorage", {
      get length() {
        return guardado.size;
      },
      key: (i: number) => [...guardado.keys()][i] ?? null,
      removeItem: (llave: string) => void guardado.delete(llave),
    });
    const db = nuevaBase();
    await repositorioDexie(db).crear(crearLevantamiento(formato, id(1), ahora), "t1");

    await almacenDexie(db).borrarDatosDe("t1", ahora.toISOString());
    expect([...guardado.keys()]).toEqual(["teins-llave-descartada:t2"]);
  });
});
