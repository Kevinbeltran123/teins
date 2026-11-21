import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { VersionFormato } from "@teins/dominio";
import { enOrganizacion, type TxOrganizacion } from "../src/plataforma/base-de-datos";
import type { Archivos } from "../src/modulos/archivos";
import { crearCatalogo } from "../src/modulos/catalogo";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearFormatos } from "../src/modulos/formatos";
import { crearLevantamientos } from "../src/modulos/levantamientos";
import { crearVisitas } from "../src/modulos/visitas";
import { conexionesDePrueba, nuevaOrganizacion } from "./ayudas";

/**
 * Lecturas de solo lectura que usan las herramientas del asistente (iteración 53, parte A): cifras exactas con datos
 * ficticios (R5) y nada de otra organización.
 */
const { app, propietario } = conexionesDePrueba();
const bd = app.bd;
const formatos = crearFormatos();
const visitas = crearVisitas(clientesYSitios, formatos);
const sinNombres = { nombres: async () => new Map<string, string>(), buscarPorNombre: async () => [] };
const catalogo = crearCatalogo(bd, sinNombres);
const levantamientos = crearLevantamientos({ bd, formatos, archivos: {} as Archivos, visitas, identidad: sinNombres, catalogo });

const cableado: VersionFormato = {
  formato: "prueba-cableado",
  version: 1,
  nombre: "Cableado de prueba",
  appMinima: 16,
  secciones: [
    {
      clave: "obra",
      titulo: "Obra",
      campos: [
        { clave: "tipo", etiqueta: "Tipo de obra", tipo: "opcion", opciones: ["Interior", "Exterior"], obligatorio: true },
        { clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["m", "und"], obligatorio: true },
      ],
    },
  ],
};

const en = <T>(organizacionId: string, fn: (tx: TxOrganizacion) => Promise<T>) => enOrganizacion(bd, organizacionId, fn);

async function programar(organizacionId: string, clienteId: string, sitioId: string, programadaPara: string, formato: string | null) {
  return en(organizacionId, (tx) =>
    visitas.crear(tx, { organizacionId, autorId: "prueba", correlacion: "prueba", clienteId, sitioId, motivo: formato ? "Cableado de prueba" : "Revisión", formato, programadaPara, tecnicos: [] }),
  );
}

async function levantamiento(organizacionId: string, visitaId: string | null, estado: string, recibidoEn: string) {
  const id = randomUUID();
  await propietario.pool.query(
    `insert into levantamientos.levantamientos (id, organizacion_id, tecnico_id, formato, version_formato, visita_id, estado, respuestas, repeticiones, creado_en_dispositivo, enviado_en_dispositivo, recibido_en)
     values ($1, $2, 'tecnico-ficticio', 'prueba-cableado', 1, $3, $4, $5, '{}', $6, $6, $6)`,
    [id, organizacionId, visitaId, estado, JSON.stringify({ obra: { tipo: "Interior" } }), recibidoEn],
  );
  return id;
}

async function linea(organizacionId: string, levantamientoId: string, datos: { linea: string; orden: number; descripcion: string; cantidad: string; unidad: string; itemId?: string; quitada?: boolean }) {
  await propietario.pool.query(
    `insert into levantamientos.lineas_cantidad (organizacion_id, levantamiento_id, seccion, campo, linea, orden, descripcion, cantidad, unidad, item_catalogo_id, quitada_en)
     values ($1, $2, 'obra', 'materiales', $3, $4, $5, $6, $7, $8, $9)`,
    [organizacionId, levantamientoId, datos.linea, datos.orden, datos.descripcion, datos.cantidad, datos.unidad, datos.itemId ?? null, datos.quitada ? new Date() : null],
  );
}

async function item(organizacionId: string, codigo: string, descripcion: string, unidad: string, precios: { valor: number; desde: string }[] = []) {
  const id = randomUUID();
  await propietario.pool.query("insert into catalogo.items (id, organizacion_id, codigo, descripcion, unidad) values ($1, $2, $3, $4, $5)", [id, organizacionId, codigo, descripcion, unidad]);
  for (const p of precios) {
    await propietario.pool.query("insert into catalogo.precios (id, organizacion_id, item_id, valor, desde, por, origen) values ($1, $2, $3, $4, $5, 'prueba', 'manual')", [randomUUID(), organizacionId, id, p.valor, p.desde]);
  }
  return id;
}

// Organización A: dos clientes, tres sitios, cuatro visitas (una cancelada) y tres levantamientos.
const orgA = await nuevaOrganizacion(propietario, "Organización A");
const a = await en(orgA, async (tx) => {
  await formatos.publicar(tx, orgA, cableado);
  const uno = await clientesYSitios.crear(tx, { organizacionId: orgA, nombre: "Cliente Uno", sitio: { nombre: "Sede Norte", direccion: "Calle [N]", ciudad: "Ibagué" } });
  const sur = await clientesYSitios.agregarSitio(tx, { organizacionId: orgA, clienteId: uno.clienteId, nombre: "Sede Sur", direccion: "Carrera [N]", ciudad: "Espinal" });
  const dos = await clientesYSitios.crear(tx, { organizacionId: orgA, nombre: "Cliente Dos", sitio: { nombre: "Bodega", direccion: "Avenida [N]" } });
  return { clienteUno: uno.clienteId, norte: uno.sitioId, sur, clienteDos: dos.clienteId, bodega: dos.sitioId };
});
const v1 = await programar(orgA, a.clienteUno, a.norte, "2026-09-10", "prueba-cableado");
const v2 = await programar(orgA, a.clienteUno, a.sur, "2026-09-20", "prueba-cableado");
const v3 = await programar(orgA, a.clienteDos, a.bodega, "2026-10-05", null);
const v4 = await programar(orgA, a.clienteUno, a.norte, "2026-10-15", "prueba-cableado");
await en(orgA, (tx) => visitas.cancelar(tx, { organizacionId: orgA, autorId: "prueba", correlacion: "prueba", visitaId: v4, version: 1, motivo: "Ya no se necesita" }));

const utp = await item(orgA, "UTP-6", "Cable UTP categoría 6", "m", [
  { valor: 1000, desde: "2026-01-01T00:00:00Z" },
  { valor: 1200, desde: "2026-06-01T00:00:00Z" },
]);
const rj45 = await item(orgA, "RJ45", "Conector RJ45", "und");

const l1 = await levantamiento(orgA, v1, "revisado", "2026-09-11T15:00:00.000Z");
const l2 = await levantamiento(orgA, v2, "en_revision", "2026-09-21T15:00:00.000Z");
const l3 = await levantamiento(orgA, v1, "revisado", "2026-09-12T15:00:00.000Z");
// Revisado y sin visita (cortes 0 y 1): el asistente no lo puede consultar, así que no entra en la cobertura.
await levantamiento(orgA, null, "revisado", "2026-01-01T15:00:00.000Z");
await linea(orgA, l1, { linea: "a1", orden: 0, descripcion: "Cable UTP cat 6", cantidad: "120.5", unidad: "m", itemId: utp });
await linea(orgA, l1, { linea: "a2", orden: 1, descripcion: "Conector RJ45", cantidad: "24", unidad: "und", itemId: rj45 });
await linea(orgA, l1, { linea: "a3", orden: 2, descripcion: "Línea quitada", cantidad: "7", unidad: "m", quitada: true });
await linea(orgA, l2, { linea: "b1", orden: 0, descripcion: "Canaleta", cantidad: "10", unidad: "m" });

// Organización B: lo mismo que podría confundirse con lo de A, y nunca debe aparecer.
const orgB = await nuevaOrganizacion(propietario, "Organización B");
const b = await en(orgB, async (tx) => {
  await formatos.publicar(tx, orgB, cableado);
  return clientesYSitios.crear(tx, { organizacionId: orgB, nombre: "Cliente B", sitio: { nombre: "Sede Norte B", direccion: "Calle [N]", ciudad: "Ibagué" } });
});
const vB = await programar(orgB, b.clienteId, b.sitioId, "2026-09-15", "prueba-cableado");
const utpB = await item(orgB, "UTP-6B", "Cable UTP categoría 6 de B", "m", [{ valor: 9999, desde: "2026-02-01T00:00:00Z" }]);
const lB = await levantamiento(orgB, vB, "revisado", "2026-08-01T15:00:00.000Z");
await linea(orgB, lB, { linea: "z1", orden: 0, descripcion: "Cable de B", cantidad: "999", unidad: "m", itemId: utpB });

describe("visitas para el asistente", () => {
  it("filtra por fechas, servicios y sitios, con el número de orden escrito como en la app", async () => {
    const todas = await en(orgA, (tx) => visitas.porFiltro(tx, {}));
    expect(todas).toEqual({
      hayMas: false,
      visitas: [
        { id: v1, ordenDeServicio: "0001", programadaPara: "2026-09-10", sitioId: a.norte, clienteId: a.clienteUno, formato: { clave: "prueba-cableado", nombre: "Cableado de prueba" }, cancelada: false },
        { id: v2, ordenDeServicio: "0002", programadaPara: "2026-09-20", sitioId: a.sur, clienteId: a.clienteUno, formato: { clave: "prueba-cableado", nombre: "Cableado de prueba" }, cancelada: false },
        { id: v3, ordenDeServicio: "0003", programadaPara: "2026-10-05", sitioId: a.bodega, clienteId: a.clienteDos, formato: null, cancelada: false },
        { id: v4, ordenDeServicio: "0004", programadaPara: "2026-10-15", sitioId: a.norte, clienteId: a.clienteUno, formato: { clave: "prueba-cableado", nombre: "Cableado de prueba" }, cancelada: true },
      ],
    });
    const ids = async (filtro: Parameters<typeof visitas.porFiltro>[1]) => (await en(orgA, (tx) => visitas.porFiltro(tx, filtro))).visitas.map((v) => v.id);
    expect(await ids({ desde: "2026-09-15", hasta: "2026-10-05" })).toEqual([v2, v3]);
    expect(await ids({ formatos: ["prueba-cableado"] })).toEqual([v1, v2, v4]);
    expect(await ids({ sitioIds: [a.norte] })).toEqual([v1, v4]);
    expect(await ids({ formatos: [] })).toEqual([]);
    const limitada = await en(orgA, (tx) => visitas.porFiltro(tx, { limite: 2 }));
    expect({ ids: limitada.visitas.map((v) => v.id), hayMas: limitada.hayMas }).toEqual({ ids: [v1, v2], hayMas: true });
  });

  it("rechaza una fecha mal escrita o un día que no existe", async () => {
    await expect(en(orgA, (tx) => visitas.porFiltro(tx, { desde: "15/09/2026" }))).rejects.toMatchObject({ codigo: "entrada_invalida" });
    await expect(en(orgA, (tx) => visitas.porFiltro(tx, { desde: "2026-02-30" }))).rejects.toMatchObject({ codigo: "entrada_invalida" });
    await expect(en(orgA, (tx) => visitas.conteos(tx, { hasta: "2026-11-31" }))).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });

  it("con un límite que no es número, usa el de por omisión", async () => {
    expect((await en(orgA, (tx) => visitas.porFiltro(tx, { limite: Number.NaN }))).visitas.map((v) => v.id)).toEqual([v1, v2, v3, v4]);
  });

  it("cuenta las visitas sin cancelar por mes, servicio y sitio", async () => {
    const conteos = await en(orgA, (tx) => visitas.conteos(tx, {}));
    expect(conteos).toEqual([
      { mes: "2026-09", formato: "prueba-cableado", sitioId: a.norte, visitas: 1 },
      { mes: "2026-09", formato: "prueba-cableado", sitioId: a.sur, visitas: 1 },
      { mes: "2026-10", formato: null, sitioId: a.bodega, visitas: 1 },
    ].sort((x, y) => `${x.mes}${x.formato ?? "~"}${x.sitioId}`.localeCompare(`${y.mes}${y.formato ?? "~"}${y.sitioId}`)));
    expect(await en(orgA, (tx) => visitas.conteos(tx, { desde: "2026-10-01" }))).toEqual([{ mes: "2026-10", formato: null, sitioId: a.bodega, visitas: 1 }]);
  });

  it("agrupa en la base solo por lo que se pide; lo demás sale null", async () => {
    expect(await en(orgA, (tx) => visitas.conteos(tx, {}, ["mes"]))).toEqual([
      { mes: "2026-09", formato: null, sitioId: null, visitas: 2 },
      { mes: "2026-10", formato: null, sitioId: null, visitas: 1 },
    ]);
    expect(await en(orgA, (tx) => visitas.conteos(tx, {}, ["formato"]))).toEqual([
      { mes: null, formato: "prueba-cableado", sitioId: null, visitas: 2 },
      { mes: null, formato: null, sitioId: null, visitas: 1 },
    ]);
    const porSitio = await en(orgA, (tx) => visitas.conteos(tx, {}, ["sitio"]));
    expect(porSitio.map((c) => [c.sitioId, c.visitas]).sort()).toEqual([[a.norte, 1], [a.sur, 1], [a.bodega, 1]].sort());
    expect(await en(orgA, (tx) => visitas.conteos(tx, {}, []))).toEqual([{ mes: null, formato: null, sitioId: null, visitas: 3 }]);
    expect(await en(orgB, (tx) => visitas.conteos(tx, {}, ["mes"]))).toEqual([{ mes: "2026-09", formato: null, sitioId: null, visitas: 1 }]);
    expect(await en(orgB, (tx) => visitas.conteos(tx, {}, ["sitio"]))).toEqual([{ mes: null, formato: null, sitioId: b.sitioId, visitas: 1 }]);
  });

  it("encuentra una visita por su número de orden", async () => {
    expect(await en(orgA, (tx) => visitas.porOrden(tx, 2))).toBe(v2);
    expect(await en(orgA, (tx) => visitas.porOrden(tx, 99))).toBeUndefined();
    expect(await en(orgA, (tx) => visitas.porOrden(tx, 0))).toBeUndefined();
    expect(await en(orgA, (tx) => visitas.porOrden(tx, 2_147_483_648))).toBeUndefined();
    expect(await en(orgB, (tx) => visitas.porOrden(tx, 1))).toBe(vB);
  });
});

describe("rango de fechas de unas visitas", () => {
  it("da la primera y la última fecha programada, sin las de otra organización", async () => {
    expect(await en(orgA, (tx) => visitas.rangoDeFechas(tx, [v1, v3, vB]))).toEqual({ desde: "2026-09-10", hasta: "2026-10-05" });
    expect(await en(orgA, (tx) => visitas.rangoDeFechas(tx, []))).toEqual({ desde: null, hasta: null });
    expect(await en(orgB, (tx) => visitas.rangoDeFechas(tx, [v1, v2]))).toEqual({ desde: null, hasta: null });
  });

  it("con muchos ids consulta en lotes y no se pierde ninguno", async () => {
    const muchos = [...Array.from({ length: 2500 }, () => randomUUID()), v2];
    expect(await en(orgA, (tx) => visitas.rangoDeFechas(tx, muchos))).toEqual({ desde: "2026-09-20", hasta: "2026-09-20" });
  });
});

describe("sitios para el asistente", () => {
  it("lista los sitios con su ciudad y su cliente, todos o por ids, sin contactos", async () => {
    const todos = await en(orgA, (tx) => clientesYSitios.sitiosConCliente(tx));
    expect(todos).toEqual([
      { id: a.bodega, nombre: "Bodega", ciudad: null, clienteId: a.clienteDos, cliente: "Cliente Dos" },
      { id: a.norte, nombre: "Sede Norte", ciudad: "Ibagué", clienteId: a.clienteUno, cliente: "Cliente Uno" },
      { id: a.sur, nombre: "Sede Sur", ciudad: "Espinal", clienteId: a.clienteUno, cliente: "Cliente Uno" },
    ]);
    expect(await en(orgA, (tx) => clientesYSitios.sitiosConCliente(tx, [a.sur, b.sitioId]))).toEqual([{ id: a.sur, nombre: "Sede Sur", ciudad: "Espinal", clienteId: a.clienteUno, cliente: "Cliente Uno" }]);
  });
});

describe("levantamientos para el asistente", () => {
  it("respeta el orden de las visitas pedidas", async () => {
    expect((await en(orgA, (tx) => levantamientos.deVisitas(tx, [v2, v1]))).map((l) => l.id)).toEqual([l2, l1, l3]);
  });

  it("da los levantamientos de unas visitas", async () => {
    expect(await en(orgA, (tx) => levantamientos.deVisitas(tx, [v1, v2, vB]))).toEqual([
      { id: l1, visitaId: v1, estado: "revisado", formato: "prueba-cableado", versionFormato: 1, recibidoEn: new Date("2026-09-11T15:00:00.000Z") },
      { id: l3, visitaId: v1, estado: "revisado", formato: "prueba-cableado", versionFormato: 1, recibidoEn: new Date("2026-09-12T15:00:00.000Z") },
      { id: l2, visitaId: v2, estado: "en_revision", formato: "prueba-cableado", versionFormato: 1, recibidoEn: new Date("2026-09-21T15:00:00.000Z") },
    ]);
  });

  it("da las líneas vigentes de unos levantamientos, sin las quitadas", async () => {
    expect(await en(orgA, (tx) => levantamientos.lineasVigentes(tx, [l1, l2, lB]))).toEqual([
      { levantamientoId: l1, descripcion: "Cable UTP cat 6", cantidad: "120.5", unidad: "m", itemId: utp },
      { levantamientoId: l1, descripcion: "Conector RJ45", cantidad: "24", unidad: "und", itemId: rj45 },
      { levantamientoId: l2, descripcion: "Canaleta", cantidad: "10", unidad: "m", itemId: null },
    ]);
  });

  it("da el contenido de un levantamiento con la definición de su formato", async () => {
    const contenido = await en(orgA, (tx) => levantamientos.contenido(tx, l1));
    expect(contenido).toEqual({
      id: l1,
      visitaId: v1,
      estado: "revisado",
      formato: "prueba-cableado",
      versionFormato: 1,
      recibidoEn: new Date("2026-09-11T15:00:00.000Z"),
      definicion: cableado,
      respuestas: { obra: { tipo: "Interior" } },
      repeticiones: {},
    });
    expect(await en(orgA, (tx) => levantamientos.contenido(tx, lB))).toBeUndefined();
  });

  it("da la cobertura: cuántos revisados con visita y los ids de esas visitas, sin repetir", async () => {
    expect(await en(orgA, (tx) => levantamientos.cobertura(tx))).toEqual({ revisados: 2, visitaIds: [v1] });
    const vacia = await nuevaOrganizacion(propietario, "Organización vacía");
    expect(await en(vacia, (tx) => levantamientos.cobertura(tx))).toEqual({ revisados: 0, visitaIds: [] });
  });

  it("rechaza demasiados ids de una vez", async () => {
    const muchos = Array.from({ length: 1001 }, () => randomUUID());
    await expect(en(orgA, (tx) => levantamientos.deVisitas(tx, muchos))).rejects.toMatchObject({ codigo: "entrada_invalida" });
    await expect(en(orgA, (tx) => levantamientos.lineasVigentes(tx, muchos))).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });
});

describe("catálogo para el asistente", () => {
  it("busca por código o descripción sin distinguir mayúsculas ni tildes, con el precio vigente", async () => {
    const porTexto = await en(orgA, (tx) => catalogo.buscar(tx, { texto: "CATEGORIA" }));
    expect(porTexto).toEqual([{ id: utp, codigo: "UTP-6", descripcion: "Cable UTP categoría 6", unidad: "m", activo: true, precio: { valor: 1200, desde: new Date("2026-06-01T00:00:00Z") } }]);
    expect((await en(orgA, (tx) => catalogo.buscar(tx, { texto: "rj45" }))).map((i) => i.id)).toEqual([rj45]);
    expect(await en(orgA, (tx) => catalogo.buscar(tx, { ids: [rj45, utpB] }))).toEqual([{ id: rj45, codigo: "RJ45", descripcion: "Conector RJ45", unidad: "und", activo: true, precio: null }]);
    expect((await en(orgA, (tx) => catalogo.buscar(tx, { texto: "cable" }))).map((i) => i.id)).toEqual([utp]);
    expect(await en(orgA, (tx) => catalogo.buscar(tx, { texto: "  " }))).toEqual([]);
    // Los comodines de SQL se buscan tal cual: no encuentran todo.
    expect(await en(orgA, (tx) => catalogo.buscar(tx, { texto: "_" }))).toEqual([]);
    expect(await en(orgA, (tx) => catalogo.buscar(tx, { texto: "%" }))).toEqual([]);
  });
});

// Una organización con más grupos y sitios que el tope: 5001 meses de visitas en 5001 sitios.
const grande = await nuevaOrganizacion(propietario, "Organización grande");
const clienteId = randomUUID();
await propietario.pool.query("insert into clientes.clientes (id, organizacion_id, nombre) values ($1, $2, 'Cliente grande')", [clienteId, grande]);
await propietario.pool.query(
  `insert into clientes.sitios (id, organizacion_id, cliente_id, nombre, direccion)
   select gen_random_uuid(), $1, $2, 'Sitio ' || n, 'Calle [N]' from generate_series(1, 5001) as n`,
  [grande, clienteId],
);
await propietario.pool.query(
  `insert into visitas.visitas (id, organizacion_id, cliente_id, sitio_id, motivo, programada_para, tecnicos)
   select gen_random_uuid(), $1, $2, (select id from clientes.sitios where organizacion_id = $1 limit 1), 'Revisión', (date '2000-01-01' + make_interval(months => n))::date, '{}'
   from generate_series(1, 5001) as n`,
  [grande, clienteId],
);

describe("topes sin cortar en silencio", () => {
  it("el conteo con demasiados grupos falla en vez de dar totales menores", async () => {
    await expect(en(grande, (tx) => visitas.conteos(tx, {}))).rejects.toMatchObject({ codigo: "entrada_invalida" });
    expect(await en(grande, (tx) => visitas.conteos(tx, { hasta: "2000-03-31" }))).toHaveLength(2);
    // Por sitio son un solo grupo: agrupar solo por lo que se pide no choca con el tope.
    expect(await en(grande, (tx) => visitas.conteos(tx, {}, ["sitio"]))).toEqual([expect.objectContaining({ mes: null, formato: null, visitas: 5001 })]);
  });

  it("los sitios de toda la organización fallan si pasan del tope", async () => {
    await expect(en(grande, (tx) => clientesYSitios.sitiosConCliente(tx))).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });
});
