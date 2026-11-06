import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";
import { bocetoVacio, claveDeRepeticion, crearLevantamiento, LIMITES_BOCETO, type VersionFormato } from "@teins/dominio";
import { almacenDexie } from "../sincronizacion/almacen";
import { abrirBase, nuevoIdDeRepeticion, repositorioDexie } from "./dexie";
import { sellarVisita } from "./registros";
import { VisitaConOtroBorrador, type ArchivoNuevo } from "./repositorio";

// Formato ficticio (R5).
const formato: VersionFormato = {
  formato: "prueba",
  version: 1,
  secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto", obligatorio: true }, { clave: "fotos", etiqueta: "F", tipo: "foto" }] }],
};
const ahora = new Date("2026-09-24T10:00:00.000Z");
const despues = new Date("2026-09-24T10:05:00.000Z");
const h = (c: string) => c.repeat(64);

function archivo(id: string): ArchivoNuevo {
  return { id, datos: new Uint8Array([1, 2, 3]).buffer, tipo: "image/jpeg", creadoEn: ahora.toISOString() };
}

let n = 0;
const bases: Dexie[] = [];
function nombreNuevo() {
  return `prueba-${n++}-${Math.random()}`;
}
function nuevaBase() {
  const db = abrirBase(nombreNuevo());
  bases.push(db);
  return db;
}
afterEach(async () => {
  for (const db of bases.splice(0)) await db.delete();
});

describe("repositorio de levantamientos en Dexie", () => {
  it("el comando de envío lleva la visita del levantamiento (corte 2)", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const [id, visitaId] = ["0192f0e0-0000-7000-8000-000000000322", "0192f0e0-0000-7000-8000-000000000321"];
    const sinObligatorios: VersionFormato = { ...formato, secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto" }] }] };
    await repo.crear(crearLevantamiento(sinObligatorios, id, ahora, visitaId), "t1");
    expect((await repo.enviar(id, sinObligatorios, despues)).ok).toBe(true);
    const [envio] = await almacenDexie(db).enviosListos(Number.MAX_SAFE_INTEGER, "t1");
    expect(envio?.comando.levantamiento.visitaId).toBe(visitaId);
  });

  it("agrega, renombra y quita repeticiones, y el envío las lleva (iteración 9)", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const conTableros: VersionFormato = {
      ...formato,
      appMinima: 4,
      secciones: [{ clave: "tableros", titulo: "Tableros", repetible: { etiqueta: "Tablero", min: 1, max: 3 }, campos: [{ clave: "t", etiqueta: "T", tipo: "texto", obligatorio: true }] }],
    };
    const id = "0192f0e0-0000-7000-8000-000000000400";
    await repo.crear(crearLevantamiento(conTableros, id, ahora, undefined, nuevoIdDeRepeticion), "t1");
    await repo.agregarRepeticion(id, conTableros, "tableros", despues);
    const [primera, segunda] = (await repo.obtener(id))!.repeticiones!.tableros!;
    expect([primera?.nombre, segunda?.nombre]).toEqual(["Tablero 1", "Tablero 2"]);
    expect(segunda?.id).toMatch(/^[a-z0-9]{8}$/);

    await repo.renombrarRepeticion(id, "tableros", segunda!.id, "Tablero del sótano", despues);
    await repo.guardarRespuesta(id, `tableros~${primera!.id}`, "t", "Piso 1", despues);
    await repo.guardarRespuesta(id, `tableros~${segunda!.id}`, "t", "Sótano", despues);
    await repo.quitarRepeticion(id, "tableros", primera!.id, despues);

    expect((await repo.enviar(id, conTableros, despues)).ok).toBe(true);
    const enviado = (await almacenDexie(db).enviosListos(Number.MAX_SAFE_INTEGER, "t1"))[0]!.comando.levantamiento;
    expect(enviado.repeticiones).toEqual({ tableros: [{ id: segunda!.id, nombre: "Tablero del sótano" }] });
    expect(enviado.respuestas).toEqual({ [`tableros~${segunda!.id}`]: { t: "Sótano" } });
  });

  it("guarda el boceto como archivo por huella, reemplaza el anterior y no lo sube hasta enviar (iteración 10)", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const almacen = almacenDexie(db);
    const conCroquis: VersionFormato = { ...formato, appMinima: 5, secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "croquis", etiqueta: "Croquis", tipo: "boceto", obligatorio: true }] }] };
    const id = "0192f0e0-0000-7000-8000-000000000500";
    await repo.crear(crearLevantamiento(conCroquis, id, ahora), "t1");
    const linea = (x: number) => ({ ...bocetoVacio(), elementos: [{ tipo: "linea" as const, grosor: 3, desde: [0, 0] as const, hasta: [x, 0] as const }] });

    await repo.guardarBoceto(id, "s", "croquis", linea(100), despues);
    const primero = ((await repo.obtener(id))!.respuestas.s!.croquis as { boceto: string }).boceto;
    expect(await repo.obtenerBoceto(primero)).toEqual(linea(100));
    await repo.guardarBoceto(id, "s", "croquis", linea(200), despues);
    const segundo = ((await repo.obtener(id))!.respuestas.s!.croquis as { boceto: string }).boceto;
    expect(segundo).not.toBe(primero);
    // La versión anterior no la usa nadie: no queda en el teléfono.
    expect(await db.archivos.get(primero)).toBeUndefined();
    expect((await db.archivos.get(segundo))?.tipo).toBe("application/vnd.teins.boceto+json");

    // Borrador: no sube. Enviado: sube (ADR-0019, parte 3).
    expect(await almacen.huellasPorSubir("t1")).not.toContain(segundo);
    expect((await repo.enviar(id, conCroquis, despues)).ok).toBe(true);
    expect(await almacen.huellasPorSubir("t1")).toContain(segundo);
  });

  it("guarda la firma con quién, cuándo y qué leyó; volver a firmar reemplaza los trazos, que suben al enviar (iteración 16)", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const almacen = almacenDexie(db);
    const conFirma: VersionFormato = { ...formato, appMinima: 7, secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "firma", etiqueta: "Firma", tipo: "firma", obligatorio: true }] }] };
    const id = "0192f0e0-0000-7000-8000-000000000600";
    await repo.crear(crearLevantamiento(conFirma, id, ahora), "t1");
    const trazo = (x: number) => ({ ...bocetoVacio(), elementos: [{ tipo: "trazo" as const, grosor: 6, puntos: [[x, 300, 0.5]] as const, contorno: [[x, 290], [x + 50, 310], [x, 320]] as const }] });
    const declaracion = "Confirmo que Técnico de prueba visitó Cliente · Sede el viernes, 26 de septiembre de 2026.";

    await repo.guardarFirma(id, "s", "firma", trazo(100), { nombre: "  Martha Gómez ", cargo: " ", declaracion }, despues);
    const primera = (await repo.obtener(id))!.respuestas.s!.firma as { firma: string };
    // El cargo vacío no se guarda; el nombre, sin espacios de sobra.
    expect(primera).toEqual({ firma: primera.firma, nombre: "Martha Gómez", firmadoEn: despues.toISOString(), declaracion });
    expect(await repo.obtenerBoceto(primera.firma)).toEqual(trazo(100));

    await repo.guardarFirma(id, "s", "firma", trazo(200), { nombre: "Martha Gómez", cargo: "Jefe de mantenimiento", declaracion }, despues);
    const segunda = (await repo.obtener(id))!.respuestas.s!.firma as { firma: string; cargo: string };
    expect(segunda.cargo).toBe("Jefe de mantenimiento");
    expect(await db.archivos.get(primera.firma)).toBeUndefined();

    expect(await almacen.huellasPorSubir("t1")).not.toContain(segunda.firma);
    expect((await repo.enviar(id, conFirma, despues)).ok).toBe(true);
    expect(await almacen.huellasPorSubir("t1")).toContain(segunda.firma);
  });

  it("guarda el catálogo que llega en la bajada, sin sellar, y un ítem desactivado lo reemplaza (iteración 17)", async () => {
    const db = nuevaBase();
    const almacen = almacenDexie(db);
    const item = { id: "0192f0e0-0000-7000-8000-000000000017", codigo: "CAB-6A", descripcion: "Cable UTP categoría 6A", unidad: "m", activo: true };
    const bajada = (activo: boolean, puntoDeControl: number) => ({ cambios: [{ tipo: "item_catalogo" as const, item: { ...item, activo } }], puntoDeControl, hayMas: false, permisoLocalHasta: despues.toISOString() });
    await almacen.aplicarBajada("t1", bajada(true, 1), 8, ahora.toISOString());
    expect(await db.catalogo.get(item.id)).toEqual(item);
    await almacen.aplicarBajada("t1", bajada(false, 2), 8, despues.toISOString());
    expect(await db.catalogo.toArray()).toEqual([{ ...item, activo: false }]);
  });

  it("guarda la biblioteca de símbolos que llega en la bajada, sin sellar; uno retirado queda inactivo (iteración 19)", async () => {
    const db = nuevaBase();
    const almacen = almacenDexie(db);
    const ups = { id: "0192f0e0-0000-7000-8000-000000000019", nombre: "UPS", categoria: "Energía", trazado: "M10 25H90V75H10Z", texto: "UPS", orden: 0, activo: true };
    const bajada = (activo: boolean, puntoDeControl: number) => ({ cambios: [{ tipo: "simbolo" as const, simbolo: { ...ups, activo } }], puntoDeControl, hayMas: false, permisoLocalHasta: despues.toISOString() });
    await almacen.aplicarBajada("t1", bajada(true, 1), 10, ahora.toISOString());
    expect(await db.simbolos.get(ups.id)).toEqual(ups);
    await almacen.aplicarBajada("t1", bajada(false, 2), 10, despues.toISOString());
    expect(await db.simbolos.toArray()).toEqual([{ ...ups, activo: false }]);
  });

  it("guarda y borra respuestas, y actualiza la hora de modificación", async () => {
    const repo = repositorioDexie(nuevaBase());
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.guardarRespuesta("l1", "s", "potencia", { valor: "12.5", unidad: "kVA" }, despues);
    expect((await repo.obtener("l1"))?.respuestas).toEqual({ s: { potencia: { valor: "12.5", unidad: "kVA" } } });
    expect((await repo.obtener("l1"))?.actualizadoEn).toBe(despues.toISOString());
    await repo.guardarRespuesta("l1", "s", "potencia", undefined, despues);
    expect((await repo.obtener("l1"))?.respuestas).toEqual({ s: {} });
  });

  it("guarda la foto y su referencia juntas, sin duplicar la huella ni perder su estado de subida", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.agregarFoto("l1", "s", "fotos", archivo(h("a")), despues);
    await db.archivos.update(h("a"), { subida: "subida" });
    await repo.agregarFoto("l1", "s", "fotos", archivo(h("a")), despues);
    await repo.agregarFoto("l1", "s", "fotos", archivo(h("b")), despues);

    expect((await repo.obtener("l1"))?.respuestas["s"]?.["fotos"]).toEqual([h("a"), h("b")]);
    expect((await repo.todosLosArchivos()).map((a) => [a.id, a.subida])).toEqual([
      [h("a"), "subida"],
      [h("b"), "pendiente"],
    ]);
  });

  it("quita la foto del campo y borra su archivo si nada más lo usa (iteración 14)", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.agregarFoto("l1", "s", "fotos", archivo(h("a")), despues);
    await repo.agregarFoto("l1", "s", "fotos", archivo(h("b")), despues);

    await repo.quitarFoto("l1", "s", "fotos", h("a"), despues);
    expect((await repo.obtener("l1"))?.respuestas["s"]?.["fotos"]).toEqual([h("b")]);
    expect(await db.archivos.get(h("a"))).toBeUndefined();
    expect(await db.archivos.get(h("b"))).toBeDefined();

    // La última foto deja el campo vacío, no una lista vacía.
    await repo.quitarFoto("l1", "s", "fotos", h("b"), despues);
    expect((await repo.obtener("l1"))?.respuestas["s"]).toEqual({});
    expect(await repo.todosLosArchivos()).toEqual([]);
  });

  it("al quitar una foto conserva el archivo que usa otro campo u otro levantamiento", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const dosCampos: VersionFormato = { ...formato, secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "fotos", etiqueta: "F", tipo: "foto" }, { clave: "otras", etiqueta: "O", tipo: "foto" }] }] };
    await repo.crear(crearLevantamiento(dosCampos, "l1", ahora), "t1");
    await repo.crear(crearLevantamiento(dosCampos, "l2", ahora), "t1");
    await repo.agregarFoto("l1", "s", "fotos", archivo(h("a")), despues);
    await repo.agregarFoto("l1", "s", "otras", archivo(h("a")), despues);
    await repo.agregarFoto("l2", "s", "fotos", archivo(h("b")), despues);
    await repo.agregarFoto("l1", "s", "fotos", archivo(h("b")), despues);

    await repo.quitarFoto("l1", "s", "fotos", h("a"), despues);
    await repo.quitarFoto("l1", "s", "fotos", h("b"), despues);
    expect(await db.archivos.get(h("a"))).toBeDefined();
    expect(await db.archivos.get(h("b"))).toBeDefined();
    expect((await repo.obtener("l1"))?.respuestas["s"]).toEqual({ otras: [h("a")] });
  });

  it("una foto quitada deja de subir, y una subida que ya iba termina sin efecto", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const almacen = almacenDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.agregarFoto("l1", "s", "fotos", archivo(h("a")), despues);
    expect(await almacen.huellasPorSubir("t1")).toEqual([h("a")]);

    await repo.quitarFoto("l1", "s", "fotos", h("a"), despues);
    await almacen.marcarSubida(h("a"));
    expect(await almacen.huellasPorSubir("t1")).toEqual([]);
    expect(await db.archivos.get(h("a"))).toBeUndefined();
  });

  it("deshacer vuelve a guardar la misma foto con sus bytes", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.agregarFoto("l1", "s", "fotos", archivo(h("a")), despues);
    const [antes] = await repo.obtenerArchivos([h("a")]);
    await repo.quitarFoto("l1", "s", "fotos", h("a"), despues);

    const { subida: _s, ultimoErrorDeSubida: _e, ...deVuelta } = antes!;
    await repo.agregarFoto("l1", "s", "fotos", deVuelta, despues);
    expect((await repo.obtener("l1"))?.respuestas["s"]?.["fotos"]).toEqual([h("a")]);
    expect(new Uint8Array((await repo.obtenerArchivos([h("a")]))[0]!.datos)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("no guarda el archivo si el levantamiento no existe", async () => {
    const repo = repositorioDexie(nuevaBase());
    await expect(repo.agregarFoto("no-existe", "s", "fotos", archivo(h("a")), despues)).rejects.toThrow();
    expect(await repo.todosLosArchivos()).toEqual([]);
  });

  it("conserva los datos al cerrar y volver a abrir la base", async () => {
    const db = nuevaBase();
    await repositorioDexie(db).crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repositorioDexie(db).agregarFoto("l1", "s", "fotos", archivo(h("a")), despues);
    db.close();
    const reabierta = abrirBase(db.name);
    bases.push(reabierta);
    const repo = repositorioDexie(reabierta);
    expect(await repo.obtener("l1")).toBeDefined();
    expect(await repo.obtenerArchivos([h("a")])).toHaveLength(1);
  });
});

describe("enviar", () => {
  it("pasa a enviado y encola el comando en la misma transacción", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "0192f0e0-0000-7000-8000-000000000001", ahora), "t1");
    await repo.guardarRespuesta("0192f0e0-0000-7000-8000-000000000001", "s", "t", "listo", ahora);

    const r = await repo.enviar("0192f0e0-0000-7000-8000-000000000001", formato, despues);
    expect(r.ok).toBe(true);
    expect((await repo.obtener("0192f0e0-0000-7000-8000-000000000001"))?.estado).toBe("enviado");
    const [envio] = await almacenDexie(db).enviosListos(Number.MAX_SAFE_INTEGER, "t1");
    expect(envio).toMatchObject({
      estado: "pendiente",
      intentos: 0,
      comando: { tipo: "EnviarLevantamiento", llave: "enviar:0192f0e0-0000-7000-8000-000000000001", levantamiento: { enviadoEn: despues.toISOString() } },
    });
    // Después del envío no se puede editar (regla 4).
    await expect(repo.guardarRespuesta("0192f0e0-0000-7000-8000-000000000001", "s", "t", "otro", despues)).rejects.toThrow();
  });

  it("si faltan obligatorios, no envía ni encola nada", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    expect(await repo.enviar("l1", formato, despues)).toMatchObject({ ok: false, motivo: "respuestas_invalidas" });
    expect((await repo.obtener("l1"))?.estado).toBe("borrador");
    expect(await db.envios.count()).toBe(0);
  });

  it("si encolar falla, el levantamiento sigue en borrador: nunca queda enviado sin su comando", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.guardarRespuesta("l1", "s", "t", "listo", ahora);
    // Un envío previo con la misma llave hace fallar el `add` del outbox dentro de la transacción.
    await db.envios.add({ levantamientoId: "l1", tecnicoId: "t1", comando: {} as never, estado: "error", intentos: 0, proximoIntentoEn: 0, creadoEn: "" });

    await expect(repo.enviar("l1", formato, despues)).rejects.toThrow();
    expect((await repo.obtener("l1"))?.estado).toBe("borrador");
  });
});

describe("responsable del levantamiento (regla 1)", () => {
  it("cada técnico ve solo lo suyo y lo de otros se conserva", async () => {
    const repo = repositorioDexie(nuevaBase());
    await repo.crear(crearLevantamiento(formato, "a", ahora), "t1");
    await repo.crear(crearLevantamiento(formato, "b", ahora), "t2");
    expect((await repo.listar("t1")).map((l) => l.id)).toEqual(["a"]);
    expect(await repo.contarDeOtros("t1")).toBe(1);
  });

  it("los borradores sin responsable del corte 0 pasan a quien inicia sesión", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await db.levantamientos.add(crearLevantamiento(formato, "viejo", ahora));
    await repo.crear(crearLevantamiento(formato, "de-otro", ahora), "t2");
    await repo.asignarSinResponsable("t1");
    expect((await repo.listar("t1")).map((l) => l.id)).toEqual(["viejo"]);
    expect((await repo.obtener("de-otro"))?.tecnicoId).toBe("t2");
  });
});

describe("migración del almacenamiento local (ADR-0004, QA-22)", () => {
  it("la versión 2 conserva los borradores y las fotos de la versión 1 y las deja por subir", async () => {
    const nombre = nombreNuevo();
    // Base tal como la dejó el corte 0 en un teléfono.
    const v1 = new Dexie(nombre);
    v1.version(1).stores({ levantamientos: "id, estado, actualizadoEn", archivos: "id" });
    const borrador = { ...crearLevantamiento(formato, "l1", ahora), respuestas: { s: { t: "sin enviar", fotos: [h("a"), h("b")] } } };
    await v1.table("levantamientos").add(borrador);
    await v1.table("archivos").bulkAdd([
      { id: h("a"), datos: new Uint8Array([1]).buffer, tipo: "image/jpeg", creadoEn: ahora.toISOString() },
      { id: h("b"), datos: new Uint8Array([2]).buffer, tipo: "image/jpeg", creadoEn: ahora.toISOString() },
    ]);
    v1.close();

    const v2 = abrirBase(nombre);
    bases.push(v2);
    expect(v2.verno).toBe(7);
    expect(await v2.levantamientos.get("l1")).toEqual(borrador);
    const archivos = await v2.archivos.toArray();
    expect(archivos.map((a) => [a.id, a.subida, new Uint8Array(a.datos)[0]])).toEqual([
      [h("a"), "pendiente", 1],
      [h("b"), "pendiente", 2],
    ]);
    expect(await v2.envios.count()).toBe(0);
  });

  it("la versión 3 conserva borradores y envíos pendientes, trae los formatos que venían en la app y no bloquea a quien ya tenía sesión", async () => {
    const nombre = nombreNuevo();
    // Base tal como la dejó el corte 1: un borrador, un envío pendiente y una sesión.
    const v2 = new Dexie(nombre);
    v2.version(1).stores({ levantamientos: "id, estado, actualizadoEn", archivos: "id" });
    v2.version(2).stores({ levantamientos: "id, estado, actualizadoEn, tecnicoId", archivos: "id, subida", envios: "levantamientoId, estado, tecnicoId", ajustes: "clave" });
    const borrador = { ...crearLevantamiento(formato, "l1", ahora), tecnicoId: "t1" };
    const envio = { levantamientoId: "l2", tecnicoId: "t1", estado: "pendiente", intentos: 3, proximoIntentoEn: 0, creadoEn: ahora.toISOString() };
    await v2.table("levantamientos").add(borrador);
    await v2.table("envios").add(envio);
    await v2.table("ajustes").add({ clave: "usuario", valor: { id: "t1", nombre: "Técnico", rol: "tecnico" } });
    v2.close();

    const v3 = abrirBase(nombre);
    bases.push(v3);
    expect(v3.verno).toBe(7);
    expect(await v3.levantamientos.get("l1")).toEqual(borrador);
    expect(await v3.envios.get("l2")).toEqual(envio);
    expect((await v3.formatos.toArray()).map((f) => `${f.formato}@${f.version}`)).toEqual(["prueba-ups@1", "prueba-ups@2"]);
    const bajada = await v3.bajadas.get("t1");
    expect(bajada).toMatchObject({ puntoDeControl: 0 });
    expect(Date.parse(bajada!.permisoLocalHasta) - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
  });

  it("la versión 7 solo agrega las tablas del chat: lo de la 6 sigue igual (iteración 39)", async () => {
    const nombre = nombreNuevo();
    const borrador = { ...crearLevantamiento(formato, "l1", ahora), tecnicoId: "t1" };
    const envio = { levantamientoId: "l2", tecnicoId: "t1", estado: "pendiente" as const, intentos: 1, proximoIntentoEn: 0, creadoEn: ahora.toISOString() };
    // La base de la app 13: la misma definición sin la versión 7.
    const anterior = new Dexie(nombre);
    anterior.version(6).stores({
      levantamientos: "id, estado, actualizadoEn, tecnicoId",
      archivos: "id, subida, cifrado",
      envios: "levantamientoId, estado, tecnicoId",
      ajustes: "clave",
      formatos: "[formato+version], formato",
      visitas: "[tecnicoId+id], tecnicoId",
      estadosServidor: "id, tecnicoId",
      bajadas: "tecnicoId",
      claves: "tecnicoId",
      catalogo: "id",
      simbolos: "id",
    });
    await anterior.table("levantamientos").add(borrador);
    await anterior.table("envios").add(envio);
    anterior.close();

    const v7 = abrirBase(nombre);
    bases.push(v7);
    expect(v7.verno).toBe(7);
    expect(await v7.levantamientos.get("l1")).toEqual(borrador);
    expect(await v7.envios.get("l2")).toEqual(envio);
    expect(await v7.respuestasPendientes.count()).toBe(0);
    expect(await v7.lecturasDeChat.count()).toBe(0);
  });
});

describe("descartar un borrador (ADR-0035)", () => {
  it("sale de Mis visitas, queda en la papelera y se recupera tal como estaba", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const id = "0192f0e0-0000-7000-8000-000000000500";
    await repo.crear(crearLevantamiento(formato, id, ahora, "0192f0e0-0000-7000-8000-000000000501"), "t1");
    await repo.guardarRespuesta(id, "s", "t", "Cuarto de prueba", ahora);
    await repo.agregarFoto(id, "s", "fotos", archivo(h("a")), ahora);

    await repo.descartar(id, despues);
    expect(await repo.listar("t1")).toEqual([]);
    expect((await repo.descartados("t1")).map((l) => [l.id, l.descartadoEn])).toEqual([[id, despues.toISOString()]]);

    expect(await repo.recuperar(id)).toEqual({ suelto: false });
    const [recuperado] = await repo.listar("t1");
    expect(recuperado).toMatchObject({ id, respuestas: { s: { t: "Cuarto de prueba", fotos: [h("a")] } } });
    expect(recuperado!.descartadoEn).toBeUndefined();
    expect(await repo.descartados("t1")).toEqual([]);
  });

  it("un levantamiento enviado no se descarta", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const id = "0192f0e0-0000-7000-8000-000000000510";
    const sinObligatorios: VersionFormato = { ...formato, secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto" }] }] };
    await repo.crear(crearLevantamiento(sinObligatorios, id, ahora), "t1");
    expect((await repo.enviar(id, sinObligatorios, despues)).ok).toBe(true);
    await expect(repo.descartar(id, despues)).rejects.toThrow();
  });

  it("uno enviado que oficina rechazó para siempre sí se descarta; se recupera con su envío y la papelera se lo lleva con él", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const id = "0192f0e0-0000-7000-8000-000000000515";
    const sinObligatorios: VersionFormato = { ...formato, secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto" }] }] };
    await repo.crear(crearLevantamiento(sinObligatorios, id, ahora), "t1");
    expect((await repo.enviar(id, sinObligatorios, ahora)).ok).toBe(true);
    await db.envios.update(id, { estado: "error", ultimoError: { codigo: "conflicto", mensaje: "Ya lo envió otra persona" } });

    await repo.descartar(id, ahora);
    expect(await repo.listar("t1")).toEqual([]);
    await repo.recuperar(id);
    expect((await db.envios.get(id))?.estado).toBe("error");

    await repo.descartar(id, ahora);
    expect(await repo.vaciarPapelera(new Date("2026-10-25T10:00:00.000Z"))).toBe(1);
    // Sin el levantamiento, su envío no queda huérfano contando como «por enviar».
    expect(await db.envios.get(id)).toBeUndefined();
  });

  it("si la visita ya tiene otro borrador, vuelve como suelto", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const visita = "0192f0e0-0000-7000-8000-000000000521";
    const [primero, segundo] = ["0192f0e0-0000-7000-8000-000000000522", "0192f0e0-0000-7000-8000-000000000523"];
    await repo.crear(crearLevantamiento(formato, primero, ahora, visita), "t1");
    await repo.descartar(primero, ahora);
    await repo.crear(crearLevantamiento(formato, segundo, ahora, visita), "t1");
    expect(await repo.recuperar(primero)).toEqual({ suelto: true });
    expect((await repo.obtener(primero))!.visitaId).toBeUndefined();
    expect((await repo.obtener(segundo))!.visitaId).toBe(visita);
  });

  it("a los 30 días se borra con sus fotos, salvo las que usa otro levantamiento", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const [viejo, reciente, otro] = ["0192f0e0-0000-7000-8000-000000000530", "0192f0e0-0000-7000-8000-000000000531", "0192f0e0-0000-7000-8000-000000000532"];
    for (const id of [viejo, reciente, otro]) await repo.crear(crearLevantamiento(formato, id, ahora), "t1");
    await repo.agregarFoto(viejo, "s", "fotos", archivo(h("b")), ahora);
    await repo.agregarFoto(viejo, "s", "fotos", archivo(h("c")), ahora);
    await repo.agregarFoto(otro, "s", "fotos", archivo(h("c")), ahora);
    await repo.descartar(viejo, ahora);
    await repo.descartar(reciente, new Date("2026-10-20T10:00:00.000Z"));

    expect(await repo.vaciarPapelera(new Date("2026-10-23T10:00:00.000Z"))).toBe(0);
    expect(await repo.vaciarPapelera(new Date("2026-10-25T10:00:00.000Z"))).toBe(1);
    expect(await repo.obtener(viejo)).toBeUndefined();
    expect((await repo.descartados("t1")).map((l) => l.id)).toEqual([reciente]);
    // La foto que solo usaba el viejo se borró; la que también usa otro, no.
    expect((await repo.obtenerArchivos([h("b"), h("c")])).map((a) => a.id)).toEqual([h("c")]);
  });

  it("con poco espacio, el técnico vacía ya su papelera; lo que no descartó y la papelera de otro se quedan (ADR-0035)", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const [suyo, vigente, deOtro] = ["0192f0e0-0000-7000-8000-000000000540", "0192f0e0-0000-7000-8000-000000000541", "0192f0e0-0000-7000-8000-000000000542"];
    await repo.crear(crearLevantamiento(formato, suyo, ahora), "t1");
    await repo.crear(crearLevantamiento(formato, vigente, ahora), "t1");
    await repo.crear(crearLevantamiento(formato, deOtro, ahora), "t2");
    await repo.agregarFoto(suyo, "s", "fotos", archivo(h("d")), ahora);
    await repo.agregarFoto(suyo, "s", "fotos", archivo(h("e")), ahora);
    await repo.agregarFoto(vigente, "s", "fotos", archivo(h("e")), ahora);
    await repo.descartar(suyo, despues);
    await repo.descartar(deOtro, despues);

    expect(await repo.vaciarPapeleraDe("t1")).toBe(1);
    expect(await repo.descartados("t1")).toEqual([]);
    expect((await repo.listar("t1")).map((l) => l.id)).toEqual([vigente]);
    expect((await repo.descartados("t2")).map((l) => l.id)).toEqual([deOtro]);
    expect((await repo.obtenerArchivos([h("d"), h("e")])).map((a) => a.id)).toEqual([h("e")]);
  });
});

describe("copias viejas y escrituras tardías (iteración 42)", () => {
  const conTableros: VersionFormato = {
    ...formato,
    appMinima: 4,
    secciones: [{ clave: "tableros", titulo: "Tableros", repetible: { etiqueta: "Tablero", min: 0, max: 3 }, campos: [{ clave: "t", etiqueta: "T", tipo: "texto", obligatorio: true }, { clave: "fotos", etiqueta: "F", tipo: "foto" }] }],
  };

  it("lo que llega tarde a un tablero quitado no lo revive ni deja su foto en el teléfono", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const id = "0192f0e0-0000-7000-8000-000000000901";
    await repo.crear(crearLevantamiento(conTableros, id, ahora, undefined, nuevoIdDeRepeticion), "t1");
    await repo.agregarRepeticion(id, conTableros, "tableros", despues);
    const tablero = (await repo.obtener(id))!.repeticiones!.tableros![0]!;
    await repo.quitarRepeticion(id, "tableros", tablero.id, despues);
    const rev = (await db.levantamientos.get(id))!.rev;

    // Un «Deshacer» de foto o de «No se pudo obtener», o una foto que terminaba de procesarse.
    const clave = claveDeRepeticion("tableros", tablero.id);
    await repo.agregarFoto(id, clave, "fotos", archivo(h("9")), despues);
    await repo.guardarRespuesta(id, clave, "t", "Sótano", despues);
    expect((await repo.obtener(id))!.respuestas).toEqual({});
    expect(await db.archivos.get(h("9"))).toBeUndefined();
    expect((await db.levantamientos.get(id))!.rev).toBe(rev);
    expect((await repo.enviar(id, conTableros, despues)).ok).toBe(true);
  });

  it("al enviar quita las respuestas de tableros que ya no existen: un borrador atascado antes de la iteración 42 sale", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const id = "0192f0e0-0000-7000-8000-000000000902";
    const base = crearLevantamiento(conTableros, id, ahora, undefined, nuevoIdDeRepeticion);
    await repo.crear({ ...base, respuestas: { [claveDeRepeticion("tableros", "quitad01")]: { t: "Piso 2" } } }, "t1");
    expect((await repo.enviar(id, conTableros, despues)).ok).toBe(true);
    const [envio] = await almacenDexie(db).enviosListos(Number.MAX_SAFE_INTEGER, "t1");
    expect(envio?.comando.levantamiento.respuestas).toEqual({});
    expect((await repo.obtener(id))!.respuestas).toEqual({});
  });

  it("al enviar quita los caracteres nulos, que el servidor no guarda", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.guardarRespuesta("l1", "s", "t", "Cuarto\u0000 norte", ahora);
    expect((await repo.enviar("l1", formato, despues)).ok).toBe(true);
    const [envio] = await almacenDexie(db).enviosListos(Number.MAX_SAFE_INTEGER, "t1");
    expect(envio?.comando.levantamiento.respuestas).toEqual({ s: { t: "Cuarto norte" } });
  });

  it("un boceto que pesa más de lo que recibe el servidor no sale: el error dice cuál, y sigue en borrador", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const conCroquis: VersionFormato = { ...formato, appMinima: 5, secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "croquis", etiqueta: "Croquis", tipo: "boceto" }] }] };
    await repo.crear(crearLevantamiento(conCroquis, "l1", ahora), "t1");
    // Un archivo de boceto del tamaño que el servidor rechaza, guardado como lo deja el editor.
    await db.archivos.add({ id: h("8"), datos: new ArrayBuffer(LIMITES_BOCETO.bytes + 1), tipo: "application/vnd.teins.boceto+json", creadoEn: ahora.toISOString(), subida: "pendiente" });
    await repo.guardarRespuesta("l1", "s", "croquis", { boceto: h("8") }, ahora);
    expect(await repo.enviar("l1", conCroquis, despues)).toEqual({ ok: false, motivo: "respuestas_invalidas", errores: [{ seccion: "s", campo: "croquis", codigo: "archivo_muy_grande" }] });
    expect((await repo.obtener("l1"))?.estado).toBe("borrador");
    expect(await db.envios.count()).toBe(0);
  });

  it("un envío que oficina rechazó para siempre vuelve a borrador, sale de la cola y se puede corregir (ADR-0045)", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.guardarRespuesta("l1", "s", "t", "listo", ahora);
    expect((await repo.enviar("l1", formato, despues)).ok).toBe(true);
    // Mientras no está en error (va en camino o llegó), no vuelve.
    await expect(repo.volverABorrador("l1")).rejects.toThrow();
    await db.envios.update("l1", { estado: "error", ultimoError: { codigo: "entrada_invalida", mensaje: "" } });

    await repo.volverABorrador("l1");
    const l = (await repo.obtener("l1"))!;
    expect(l.estado).toBe("borrador");
    expect(l.enviadoEn).toBeUndefined();
    expect(await db.envios.get("l1")).toBeUndefined();
    await repo.guardarRespuesta("l1", "s", "t", "corregido", despues);
    expect((await repo.enviar("l1", formato, despues)).ok).toBe(true);
  });

  it("no vuelve a borrador si su visita ya tiene otro borrador: uno quedaría escondido", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora, "v1"), "t1");
    await repo.guardarRespuesta("l1", "s", "t", "listo", ahora);
    await repo.enviar("l1", formato, despues);
    await db.envios.update("l1", { estado: "error" });
    // La visita quedó atendida y el técnico empezó otro levantamiento en ella.
    await repo.crear(crearLevantamiento(formato, "l2", ahora, "v1"), "t1");
    await expect(repo.volverABorrador("l1")).rejects.toBeInstanceOf(VisitaConOtroBorrador);
    // Descartado el otro, ya puede.
    await repo.descartar("l2", despues);
    await repo.volverABorrador("l1");
    expect((await repo.obtener("l1"))?.estado).toBe("borrador");
  });

  it("reemplazar un boceto no borra el documento que otro campo del mismo levantamiento todavía usa", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const dosCroquis: VersionFormato = {
      ...formato,
      appMinima: 5,
      secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "a", etiqueta: "A", tipo: "boceto" }, { clave: "b", etiqueta: "B", tipo: "boceto" }] }],
    };
    await repo.crear(crearLevantamiento(dosCroquis, "l1", ahora), "t1");
    const linea = (x: number) => ({ ...bocetoVacio(), elementos: [{ tipo: "linea" as const, grosor: 3, desde: [0, 0] as const, hasta: [x, 0] as const }] });
    // El mismo dibujo en los dos campos: el mismo archivo.
    await repo.guardarBoceto("l1", "s", "a", linea(100), ahora);
    await repo.guardarBoceto("l1", "s", "b", linea(100), ahora);
    const compartido = ((await repo.obtener("l1"))!.respuestas.s!.b as { boceto: string }).boceto;
    await repo.guardarBoceto("l1", "s", "a", linea(200), despues);
    expect(await repo.obtenerBoceto(compartido)).toEqual(linea(100));
  });

  it("lo que oficina ya recibió no vuelve a borrador aunque su envío haya quedado en error", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.guardarRespuesta("l1", "s", "t", "listo", ahora);
    await repo.enviar("l1", formato, despues);
    await db.envios.update("l1", { estado: "error" });
    await db.estadosServidor.put({ id: "l1", tecnicoId: "t1", estado: "enviado", recibidoEn: despues.toISOString() });
    await expect(repo.volverABorrador("l1")).rejects.toThrow();
    expect((await repo.obtener("l1"))?.estado).toBe("enviado");
  });

  it("lo que oficina ya recibió no se descarta aunque su envío haya quedado en error (ADR-0046)", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    await repo.crear(crearLevantamiento(formato, "l1", ahora), "t1");
    await repo.guardarRespuesta("l1", "s", "t", "listo", ahora);
    await repo.enviar("l1", formato, despues);
    await db.envios.update("l1", { estado: "error" });
    await db.estadosServidor.put({ id: "l1", tecnicoId: "t1", estado: "enviado", recibidoEn: despues.toISOString() });
    await expect(repo.descartar("l1", despues)).rejects.toThrow();
    expect((await repo.obtener("l1"))?.descartadoEn).toBeUndefined();
  });

  it("al abrir la app borra los archivos que nada usa, de nadie; lo de la papelera y de otras personas se queda", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const id = "0192f0e0-0000-7000-8000-000000000903";
    await repo.crear(crearLevantamiento(conTableros, id, ahora, undefined, nuevoIdDeRepeticion), "t1");
    await repo.agregarRepeticion(id, conTableros, "tableros", despues);
    const tablero = (await repo.obtener(id))!.repeticiones!.tableros![0]!;
    await repo.agregarFoto(id, claveDeRepeticion("tableros", tablero.id), "fotos", archivo(h("1")), despues);
    await repo.quitarRepeticion(id, "tableros", tablero.id, despues);
    await repo.crear(crearLevantamiento(formato, "l2", ahora), "t2");
    await repo.agregarFoto("l2", "s", "fotos", archivo(h("2")), despues);
    await repo.crear(crearLevantamiento(formato, "l3", ahora), "t1");
    await repo.agregarFoto("l3", "s", "fotos", archivo(h("3")), despues);
    await repo.descartar("l3", despues);

    expect(await repo.limpiarArchivosSinUso()).toBe(1);
    expect((await db.archivos.toCollection().primaryKeys()).sort()).toEqual([h("2"), h("3")]);
  });

  it("guarda sellado el cliente y el sitio de su visita; al enviar los copia si el borrador no los traía", async () => {
    const db = nuevaBase();
    const repo = repositorioDexie(db);
    const lugar = { cliente: "Cliente ficticio", sitio: "Sede norte" };
    await repo.crear(crearLevantamiento(formato, "l1", ahora, "v1"), "t1", lugar);
    expect((await repo.obtener("l1"))?.lugar).toEqual(lugar);
    // Va sellado (ADR-0022): a la vista no queda el nombre del cliente.
    expect(JSON.stringify(await db.levantamientos.get("l1"))).not.toContain("Cliente ficticio");

    // Un borrador de antes de la iteración 42, sin lugar: al enviarlo se toma de su visita.
    const visita = { id: "v1", tecnicoId: "t1", cliente: { nombre: "Cliente ficticio" }, sitio: { nombre: "Sede sur", direccion: "Calle [N]" }, motivo: "Mantenimiento", programadaPara: "2026-09-24" };
    await db.visitas.put(await sellarVisita(db, visita));
    await repo.crear(crearLevantamiento(formato, "l2", ahora, "v1"), "t1");
    await repo.guardarRespuesta("l2", "s", "t", "listo", ahora);
    expect((await repo.enviar("l2", formato, despues)).ok).toBe(true);
    expect((await repo.obtener("l2"))?.lugar).toEqual({ cliente: "Cliente ficticio", sitio: "Sede sur" });
  });
});
