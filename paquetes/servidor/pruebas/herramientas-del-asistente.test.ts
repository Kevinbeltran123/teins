import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { VersionFormato } from "@teins/dominio";
import { FuentesDelAsistente, SerieDelAsistente, TablaDelAsistente } from "@teins/protocolo";
import { enOrganizacion, type TxOrganizacion } from "../src/plataforma/base-de-datos";
import { problema } from "../src/plataforma/errores";
import type { Archivos } from "../src/modulos/archivos";
import { crearHerramientasDelAsistente } from "../src/modulos/asistente/herramientas";
import type { ResultadoHerramienta } from "../src/modulos/asistente/tipos";
import { crearCatalogo } from "../src/modulos/catalogo";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearFormatos } from "../src/modulos/formatos";
import { crearLevantamientos } from "../src/modulos/levantamientos";
import { crearVisitas } from "../src/modulos/visitas";
import { conexionesDePrueba, nuevaOrganizacion } from "./ayudas";

/**
 * Las herramientas del asistente (iteración 53, parte B) con datos ficticios (R5): las cifras del prototipo, exactas,
 * nada de otra organización y nada que no deba salir de un levantamiento.
 */
const { app, propietario } = conexionesDePrueba();
const bd = app.bd;
const formatos = crearFormatos();
const visitas = crearVisitas(clientesYSitios, formatos);
const sinNombres = { nombres: async () => new Map<string, string>(), buscarPorNombre: async () => [] };
const catalogo = crearCatalogo(bd, sinNombres);
const levantamientos = crearLevantamientos({ bd, formatos, archivos: {} as Archivos, visitas, identidad: sinNombres, catalogo });
const deps = { visitas, clientesYSitios, levantamientos, catalogo, formatos };
const herramientas = crearHerramientasDelAsistente(deps);

const HUELLA_FOTO = "a".repeat(64);
const HUELLA_BOCETO = "b".repeat(64);
const HUELLA_FIRMA = "c".repeat(64);

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
        { clave: "tipo", etiqueta: "Tipo de obra", tipo: "opcion", opciones: ["Interior", "Exterior"], otro: true },
        { clave: "sistemas", etiqueta: "Sistemas", tipo: "opciones", opciones: ["Datos", "Voz", "Video"] },
        { clave: "altura", etiqueta: "Altura del techo", tipo: "medida", unidades: ["m"] },
        { clave: "materiales", etiqueta: "Materiales", tipo: "cantidades", unidades: ["m", "und"] },
      ],
    },
    {
      clave: "cierre",
      titulo: "Cierre",
      campos: [
        { clave: "observaciones", etiqueta: "Observaciones", tipo: "texto", largo: true },
        { clave: "recibe", etiqueta: "¿Quién te recibe?", tipo: "texto" },
        { clave: "contacto", etiqueta: "Nombre del contacto", tipo: "texto" },
        { clave: "atiende", etiqueta: "Persona que atiende", tipo: "texto" },
        { clave: "tablero", etiqueta: "Nombre del tablero", tipo: "texto" },
        { clave: "quien", etiqueta: "¿Quién recibe?", tipo: "opcion", opciones: ["Vigilante", "Administrador"], otro: true },
        { clave: "quienes", etiqueta: "¿Quiénes reciben?", tipo: "opciones", opciones: ["Vigilante", "Administrador"], otro: true },
        { clave: "fotos", etiqueta: "Fotos de llegada", tipo: "foto", sello: { ubicacion: true, mapa: true } },
        { clave: "croquis", etiqueta: "Croquis", tipo: "boceto" },
        { clave: "firma", etiqueta: "Firma de quien recibe", tipo: "firma", documento: "opcional" },
      ],
    },
  ],
};

const en = <T>(organizacionId: string, fn: (tx: TxOrganizacion) => Promise<T>) => enOrganizacion(bd, organizacionId, fn);
const hoy = "2026-11-20";

async function ejecutar(organizacionId: string, nombre: string, entrada: unknown): Promise<ResultadoHerramienta> {
  const herramienta = herramientas.find((h) => h.nombre === nombre)!;
  const datos = herramienta.entrada.parse(entrada);
  return en(organizacionId, (tx) => herramienta.ejecutar(tx, datos, { organizacionId, usuarioId: "oficina-ficticia", hoy }));
}
const valida = (nombre: string, entrada: unknown) => herramientas.find((h) => h.nombre === nombre)!.entrada.safeParse(entrada).success;

async function programar(organizacionId: string, sitio: { clienteId: string; sitioId: string }, programadaPara: string, formato: string | null, motivo: string, solicitanteContactoId?: string) {
  return en(organizacionId, (tx) => visitas.crear(tx, { organizacionId, autorId: "prueba", correlacion: "prueba", ...sitio, motivo, formato, programadaPara, tecnicos: [], solicitanteContactoId }));
}

async function item(organizacionId: string, codigo: string, descripcion: string, unidad: string, precio?: number) {
  const id = randomUUID();
  await propietario.pool.query("insert into catalogo.items (id, organizacion_id, codigo, descripcion, unidad) values ($1, $2, $3, $4, $5)", [id, organizacionId, codigo, descripcion, unidad]);
  if (precio !== undefined) {
    await propietario.pool.query("insert into catalogo.precios (id, organizacion_id, item_id, valor, desde, por, origen) values ($1, $2, $3, $4, '2026-09-01T12:00:00Z', 'prueba', 'manual')", [randomUUID(), organizacionId, id, precio]);
  }
  return id;
}

interface Linea {
  descripcion: string;
  cantidad: string;
  unidad: string;
  itemId?: string;
}

/** Un levantamiento con sus respuestas y las líneas proyectadas, como quedan al recibirlo. */
async function levantamiento(organizacionId: string, visitaId: string, estado: string, recibidoEn: string, lineas: Linea[], obra: Record<string, unknown> = {}, cierre: Record<string, unknown> = {}) {
  const id = randomUUID();
  const materiales = lineas.map((l, i) => ({ id: `lin${String(i).padStart(5, "0")}`, descripcion: l.descripcion, cantidad: l.cantidad, unidad: l.unidad, ...(l.itemId ? { item: l.itemId } : {}) }));
  await propietario.pool.query(
    `insert into levantamientos.levantamientos (id, organizacion_id, tecnico_id, formato, version_formato, visita_id, estado, respuestas, repeticiones, creado_en_dispositivo, enviado_en_dispositivo, recibido_en)
     values ($1, $2, 'tecnico-ficticio', 'prueba-cableado', 1, $3, $4, $5, '{}', $6, $6, $6)`,
    [id, organizacionId, visitaId, estado, JSON.stringify({ obra: { ...obra, materiales }, cierre }), recibidoEn],
  );
  for (const [i, l] of lineas.entries()) {
    await propietario.pool.query(
      `insert into levantamientos.lineas_cantidad (organizacion_id, levantamiento_id, seccion, campo, linea, orden, descripcion, cantidad, unidad, item_catalogo_id)
       values ($1, $2, 'obra', 'materiales', $3, $4, $5, $6, $7, $8)`,
      [organizacionId, id, materiales[i]!.id, i, l.descripcion, l.cantidad, l.unidad, l.itemId ?? null],
    );
  }
  return id;
}

// Organización A: los datos del prototipo.
const orgA = await nuevaOrganizacion(propietario, "Organización A");
const s = await en(orgA, async (tx) => {
  await formatos.publicar(tx, orgA, cableado);
  await formatos.publicar(tx, orgA, { formato: "prueba-ups", version: 1, nombre: "Mantenimiento de UPS", appMinima: 16, secciones: [{ clave: "s", titulo: "S", campos: [{ clave: "t", etiqueta: "T", tipo: "texto" }] }] });
  const crear = (nombre: string, sitio: string, ciudad: string) => clientesYSitios.crear(tx, { organizacionId: orgA, nombre, sitio: { nombre: sitio, direccion: "Calle [N]", ciudad } });
  return {
    clinica: await crear("Clínica de ejemplo", "Sede principal", "Ibagué"),
    hotel: await crear("Hotel de ejemplo", "Edificio principal", "Ibagué"),
    colegio: await crear("Colegio de ejemplo", "Sede campestre", "IBAGUE "),
    bodega: await crear("Distribuidora de ejemplo", "Bodega", "Espinal"),
    centro: await crear("Centro médico de ejemplo", "Sede Melgar", "Melgar"),
    ups: await crear("Supermercado de ejemplo", "Local", "Neiva"),
  };
});

// Quien pidió la primera visita (ADR-0051): nada de esta persona debe salir de ninguna herramienta.
const SOLICITANTE = { nombre: "Solicitante Ficticia", correo: "solicitante.ficticia@ejemplo.com", celular: "+573109876543" };
const solicitante = randomUUID();
await propietario.pool.query("insert into clientes.contactos (id, organizacion_id, cliente_id, nombre, cargo, correo, celular) values ($1, $2, $3, $4, 'Administradora', $5, $6)", [
  solicitante,
  orgA,
  s.clinica.clienteId,
  SOLICITANTE.nombre,
  SOLICITANTE.correo,
  SOLICITANTE.celular,
]);

const utp = await item(orgA, "CAB-UTP6", "Cable UTP categoría 6", "m", 2900);
const punto = await item(orgA, "PTO-RED", "Punto de red", "und");
const fibra = await item(orgA, "CAB-FO12", "Cable de fibra óptica 12 hilos", "m");
const encauchetado = await item(orgA, "CAB-ENC312", "Cable encauchetado 3x12 AWG", "m");

const fechas = ["2026-02-14", "2026-03-09", "2026-04-22", "2026-06-18", "2026-08-05"];
const sitiosCableado = [s.clinica, s.hotel, s.colegio, s.bodega, s.centro];
const metros = ["1020", "610", "1390", "560", "905"];
const puntos = ["36", "24", "48", "18", "30"];
const cableadas: string[] = [];
const revisados: string[] = [];
for (const [i, fecha] of fechas.entries()) {
  const v = await programar(orgA, sitiosCableado[i]!, fecha, null, "Cableado estructurado", i === 0 ? solicitante : undefined);
  cableadas.push(v);
  const lineas: Linea[] = [
    { descripcion: "UTP cat 6", cantidad: metros[i]!, unidad: "m", itemId: utp },
    { descripcion: "Punto de red", cantidad: puntos[i]!, unidad: "und", itemId: punto },
  ];
  if (i === 0 || i === 2) {
    lineas.push({ descripcion: "Fibra 12 hilos", cantidad: i === 0 ? "180" : "130", unidad: "m", itemId: fibra });
    lineas.push({ descripcion: "Encauchetado", cantidad: i === 0 ? "35" : "50", unidad: "m", itemId: encauchetado });
  }
  if (i === 3) lineas.push({ descripcion: "cable utp cat6 azul", cantidad: "45", unidad: "m" });
  revisados.push(await levantamiento(orgA, v, "revisado", `${fecha}T20:00:00Z`, lineas, { tipo: i === 1 ? "Patio trasero" : "Interior", sistemas: { elegidas: i < 2 ? ["Datos", "Voz"] : ["Datos"] }, altura: { valor: ["2.5", "3", "2.8", "4", "3.2"][i], unidad: "m" } }, i === 0 ? { quien: "Vigilante" } : {}));
}
const sexta = await programar(orgA, s.hotel, "2026-11-02", null, "Cableado estructurado");
const sinRevisar = await levantamiento(orgA, sexta, "en_revision", "2026-11-03T20:00:00Z", [{ descripcion: "UTP cat 6", cantidad: "700", unidad: "m", itemId: utp }], { tipo: "Exterior" });
const cancelada = await programar(orgA, s.clinica, "2026-10-01", null, "Cableado estructurado");
await levantamiento(orgA, cancelada, "revisado", "2026-10-02T20:00:00Z", [
  { descripcion: "UTP cat 6", cantidad: "100", unidad: "m", itemId: utp },
  { descripcion: "Punto de red", cantidad: "10", unidad: "und", itemId: punto },
]);
await en(orgA, (tx) => visitas.cancelar(tx, { organizacionId: orgA, autorId: "prueba", correlacion: "prueba", visitaId: cancelada, version: 1, motivo: "Ya no" }));

const UPS_POR_MES = [2, 3, 2, 4, 3, 5, 6, 4, 3, 5, 4];
for (const [m, n] of UPS_POR_MES.entries()) {
  for (let k = 0; k < n; k++) await programar(orgA, s.ups, `2026-${String(m + 1).padStart(2, "0")}-${String(1 + k * 3).padStart(2, "0")}`, "prueba-ups", "Mantenimiento de UPS");
}

// El levantamiento con todo lo que nunca debe salir.
const conSecretos = await levantamiento(orgA, cableadas[4]!, "revisado", "2026-08-06T20:00:00Z", [], { tipo: "Interior" }, {
  recibe: "Persona Que Recibe",
  contacto: "Persona Del Contacto",
  atiende: "Persona Que Atiende",
  tablero: "Tablero general TG-1",
  quien: "Juan Pérez",
  quienes: { elegidas: ["Vigilante"], otro: "Juan Pérez" },
  observaciones: "Llamar a la administradora al +57 300 123 4567 o escribir a admin.ejemplo@correo.com; fijo (608) 123 4567. Quedaron 36 puntos.",
  fotos: [HUELLA_FOTO],
  croquis: { boceto: HUELLA_BOCETO },
  firma: { firma: HUELLA_FIRMA, nombre: "Persona Ficticia", documento: "1234567890", firmadoEn: "2026-08-05T15:00:00Z", declaracion: "Confirmo la visita." },
});

// Organización B: lo que podría confundirse con lo de A y nunca debe aparecer.
const orgB = await nuevaOrganizacion(propietario, "Organización B");
const sitioB = await en(orgB, async (tx) => {
  await formatos.publicar(tx, orgB, cableado);
  return clientesYSitios.crear(tx, { organizacionId: orgB, nombre: "Cliente B", sitio: { nombre: "Sede B", direccion: "Calle [N]", ciudad: "Ibagué" } });
});
const utpB = await item(orgB, "CAB-UTP6", "Cable UTP categoría 6 de B", "m", 9999);
const visitaB = await programar(orgB, sitioB, "2026-05-05", null, "Cableado");
await levantamiento(orgB, visitaB, "revisado", "2026-05-06T20:00:00Z", [{ descripcion: "UTP", cantidad: "999", unidad: "m", itemId: utpB }], { tipo: "Interior" });
// Más de 12 meses antes de `hoy`: `valores_de_campo` sin lista de visitas no la lee.
const antiguaB = await programar(orgB, sitioB, "2025-10-01", null, "Cableado");
await levantamiento(orgB, antiguaB, "revisado", "2025-10-02T20:00:00Z", [], { tipo: "Exterior" });

describe("buscar_en_catalogo", () => {
  it("da los ítems con su precio vigente y sus etiquetas", async () => {
    const r = await ejecutar(orgA, "buscar_en_catalogo", { texto: "cable" });
    expect(r.resumen).toBe("3 ítems");
    expect(r.datos).toEqual({
      items: [
        { id: encauchetado, codigo: "CAB-ENC312", descripcion: "Cable encauchetado 3x12 AWG", unidad: "m", precio: null, precioDesde: null },
        { id: fibra, codigo: "CAB-FO12", descripcion: "Cable de fibra óptica 12 hilos", unidad: "m", precio: null, precioDesde: null },
        { id: utp, codigo: "CAB-UTP6", descripcion: "Cable UTP categoría 6", unidad: "m", precio: "2900", precioDesde: "2026-09-01" },
      ],
    });
    expect(herramientas.find((h) => h.nombre === "buscar_en_catalogo")!.etiquetas({ texto: "cable" })).toEqual({ enCurso: "Buscando «cable» en el catálogo", hecha: "Buscó «cable» en el catálogo" });
  });
});

describe("ciudades", () => {
  it("agrupa sin mayúsculas ni tildes y no cuenta las canceladas", async () => {
    const r = await ejecutar(orgA, "ciudades", {});
    expect(r.datos).toEqual({
      ciudades: [
        { ciudad: "Neiva", visitas: 41 },
        { ciudad: "Ibagué", visitas: 4 },
        { ciudad: "Espinal", visitas: 1 },
        { ciudad: "Melgar", visitas: 1 },
      ],
      visitasSinCiudad: 0,
    });
    expect(r.resumen).toBe("4 ciudades");
  });

  it("con demasiados datos, falla con un mensaje para acotar", async () => {
    const [ciudades] = crearHerramientasDelAsistente({
      ...deps,
      visitas: { ...visitas, conteos: async () => Promise.reject(problema("entrada_invalida", "Hasta 5000 grupos")) },
    }).filter((h) => h.nombre === "ciudades");
    await expect(en(orgA, (tx) => ciudades!.ejecutar(tx, {}, { organizacionId: orgA, usuarioId: "x", hoy }))).rejects.toMatchObject({ codigo: "entrada_invalida", message: expect.stringMatching(/^Demasiados datos: acote/) });
  });
});

describe("buscar_visitas", () => {
  it("las visitas del Tolima: 5 revisadas y 1 sin revisar, con sus fuentes", async () => {
    const entrada = { desde: "2026-01-01", ciudades: ["Ibagué", "espinal", "MELGAR"] };
    const r = await ejecutar(orgA, "buscar_visitas", entrada);
    expect(r.resumen).toBe("5 revisadas, 1 sin revisar");
    const datos = r.datos as { total: number; revisadas: number; sinRevisar: number; visitas: { visitaId: string; ciudad: string; revisado: boolean; orden: string }[] };
    expect({ total: datos.total, revisadas: datos.revisadas, sinRevisar: datos.sinRevisar }).toEqual({ total: 6, revisadas: 5, sinRevisar: 1 });
    // Las más recientes primero.
    expect(datos.visitas.map((v) => v.visitaId)).toEqual([sexta, ...[...cableadas].reverse()]);
    expect(datos.visitas.find((v) => v.visitaId === cableadas[0])).toEqual({ visitaId: cableadas[0], orden: "0001", fecha: "2026-02-14", cliente: "Clínica de ejemplo", sitio: "Sede principal", ciudad: "Ibagué", servicio: null, servicioClave: null, revisado: true });
    expect(FuentesDelAsistente.parse(r.fuentes).visitas[0]).toMatchObject({ visitaId: sexta, levantamientoId: sinRevisar, revisado: false });
    expect(herramientas.find((h) => h.nombre === "buscar_visitas")!.etiquetas(entrada).hecha).toBe("Buscó las visitas de 2026 en Ibagué, espinal y MELGAR");
  });

  it("filtra por servicio, por cliente y por fechas", async () => {
    expect(((await ejecutar(orgA, "buscar_visitas", { servicios: ["UPS"] })).datos as { total: number }).total).toBe(41);
    expect(((await ejecutar(orgA, "buscar_visitas", { cliente: "hotel" })).datos as { total: number }).total).toBe(2);
    expect(((await ejecutar(orgA, "buscar_visitas", { desde: "2026-04-01", hasta: "2026-06-30", ciudades: ["Ibagué", "Espinal"] })).datos as { total: number }).total).toBe(2);
  });

  it("rechaza fechas que no existen e ids que no son uuid", () => {
    expect(valida("buscar_visitas", { desde: "2026-02-30" })).toBe(false);
    expect(valida("buscar_visitas", { desde: "2026-2-3" })).toBe(false);
    expect(valida("sumar_materiales", { visitas: ["no-es-un-id"] })).toBe(false);
    expect(valida("estimar_materiales", { visitas: [cableadas[0]], item: "x", porItem: punto })).toBe(false);
  });
});

describe("sumar_materiales", () => {
  it("suma 4.485 m de UTP en 5 visitas; la sin revisar queda fuera", async () => {
    const r = await ejecutar(orgA, "sumar_materiales", { visitas: [...cableadas, sexta], texto: "cable" });
    expect(r.resumen).toBe("4 filas");
    const datos = r.datos as { filas: unknown[]; incluidas: { visitaId: string }[]; excluidas: { visitaId: string; orden: string }[] };
    expect(datos.filas).toEqual([
      { itemId: utp, codigo: "CAB-UTP6", descripcion: "Cable UTP categoría 6", unidad: "m", cantidad: "4485", visitas: 5 },
      { itemId: fibra, codigo: "CAB-FO12", descripcion: "Cable de fibra óptica 12 hilos", unidad: "m", cantidad: "310", visitas: 2 },
      { itemId: encauchetado, codigo: "CAB-ENC312", descripcion: "Cable encauchetado 3x12 AWG", unidad: "m", cantidad: "85", visitas: 2 },
      { itemId: null, codigo: null, descripcion: "cable utp cat6 azul", unidad: "m", cantidad: "45", visitas: 1 },
    ]);
    expect(datos.incluidas.map((v) => v.visitaId)).toEqual([...cableadas].reverse());
    expect(datos.excluidas).toEqual([{ visitaId: sexta, orden: "0006", motivo: "sin_revisar" }]);
    const tabla = TablaDelAsistente.parse(r.tabla);
    expect(tabla.columnas.map((c) => c.titulo)).toEqual(["Material", "Cantidad", "Visitas"]);
    expect(tabla.filas[0]).toEqual([{ texto: "Cable UTP categoría 6", detalle: "CAB-UTP6" }, { texto: "4.485 m" }, { texto: "5" }]);
    expect(tabla.filas[3]).toEqual([{ texto: "«cable utp cat6 azul»", marca: "sin_vincular" }, { texto: "45 m" }, { texto: "1" }]);
    expect(r.cifras?.[0]).toEqual({ id: "fila-1", valor: "4.485", unidad: "m", descripcion: "Cable UTP categoría 6 en 5 visitas" });
    const fuentes = FuentesDelAsistente.parse(r.fuentes);
    expect(fuentes.visitas.map((v) => v.revisado)).toEqual([true, true, true, true, true, false]);
    expect(fuentes.titulo).toBe("De 5 visitas revisadas y 1 sin revisar");
    expect(r.etiqueta).toBe("Sumó el cable de 5 visitas revisadas");
  });

  it("ignora las canceladas: no suman, quedan como excluidas y no van en las fuentes", async () => {
    const r = await ejecutar(orgA, "sumar_materiales", { visitas: [...cableadas, cancelada] });
    const datos = r.datos as { filas: { codigo: string | null; cantidad: string }[]; excluidas: unknown[] };
    expect(datos.filas.find((f) => f.codigo === "CAB-UTP6")!.cantidad).toBe("4485");
    expect(datos.excluidas).toEqual([{ visitaId: cancelada, orden: "0007", motivo: "cancelada" }]);
    expect(r.fuentes!.visitas.map((v) => v.visitaId)).toEqual([...cableadas].reverse());
    expect(r.etiqueta).toBe("Sumó los materiales de 5 visitas revisadas");
    const estimado = await ejecutar(orgA, "estimar_materiales", { visitas: [...cableadas, cancelada], item: utp, porItem: punto });
    expect((estimado.datos as { n: number; canceladas: unknown[] }).n).toBe(5);
    expect((estimado.datos as { canceladas: unknown[] }).canceladas).toEqual([{ visitaId: cancelada, orden: "0007" }]);
    expect(estimado.fuentes!.visitas.map((v) => v.visitaId)).toEqual([...cableadas].reverse());
  });

  it("con un filtro cubre todas las visitas que cumplen, y las fuentes son solo las que aportaron", async () => {
    const tolima = { ciudades: ["Ibagué", "Espinal", "Melgar"] };
    const r = await ejecutar(orgA, "sumar_materiales", { visitas: tolima, texto: "cable" });
    expect((r.datos as { filas: { cantidad: string }[] }).filas[0]!.cantidad).toBe("4485");
    expect(r.tabla?.nota).toBe("1 visita sin revisar no entró en la suma.");
    const fibra = await ejecutar(orgA, "sumar_materiales", { visitas: tolima, texto: "fibra" });
    // Solo la primera y la tercera llevan fibra; la sin revisar no tiene, así que no va ni se nombra.
    expect(fibra.fuentes!.visitas.map((v) => v.visitaId)).toEqual([cableadas[2], cableadas[0]]);
    expect(fibra.tabla?.nota).toBeUndefined();
    expect(fibra.fuentes!.titulo).toBe("De 2 visitas revisadas");
    expect(herramientas.find((h) => h.nombre === "sumar_materiales")!.etiquetas({ visitas: { desde: "2026-01-01", ...tolima } }).enCurso).toBe("Sumando los materiales de las visitas de 2026 en Ibagué, Espinal y Melgar");
    expect(valida("sumar_materiales", { texto: "cable" })).toBe(false);
    expect(valida("sumar_materiales", { visitas: cableadas, filtro: tolima })).toBe(false);
    expect(valida("sumar_materiales", { visitas: { ciudad: "Ibagué" } })).toBe(false);
    expect(valida("sumar_materiales", { visitas: { desde: "2026-02-30" } })).toBe(false);
    expect(valida("sumar_materiales", { visitas: [] })).toBe(false);
    expect(valida("sumar_materiales", { visitas: ["no-es-un-id"] })).toBe(false);
    // Sin el modo estricto de la API: Zod es la única barrera.
    expect(herramientas.filter((h) => h.estricta === false).map((h) => h.nombre).sort()).toEqual(["buscar_visitas", "estimar_materiales", "sumar_materiales"]);
  });

  it("nunca suma unidades distintas y filtra por ítem", async () => {
    const todo = (await ejecutar(orgA, "sumar_materiales", { visitas: cableadas })).datos as { filas: { codigo: string; unidad: string; cantidad: string }[] };
    expect(todo.filas.find((f) => f.codigo === "PTO-RED")).toMatchObject({ unidad: "und", cantidad: "156" });
    const soloPunto = (await ejecutar(orgA, "sumar_materiales", { visitas: cableadas, items: [punto] })).datos as { filas: unknown[] };
    expect(soloPunto.filas).toHaveLength(1);
  });
});

describe("estimar_materiales", () => {
  it("UTP por punto de red: percentil 80 de 30,36 m, 1.215 m y $3.523.500 para 40 puntos", async () => {
    const r = await ejecutar(orgA, "estimar_materiales", { visitas: [...cableadas, sexta], item: utp, porItem: punto, cantidad: 40 });
    const datos = r.datos as { n: number; minimo: number; mediana: number; percentil80: number; maximo: number; proyeccion: unknown; sinRevisar: unknown[] };
    expect(datos.n).toBe(5);
    expect(datos.mediana).toBeCloseTo(28.9583, 4);
    expect(datos.percentil80).toBeCloseTo(30.3556, 4);
    expect(datos.minimo).toBeCloseTo(25.4167, 4);
    expect(datos.maximo).toBeCloseTo(31.1111, 4);
    expect(datos.proyeccion).toEqual({ cantidad: 40, mediana: 1159, percentil80: 1215, costoMediana: 3361100, costoPercentil80: 3523500 });
    expect(datos.sinRevisar).toEqual([{ visitaId: sexta, orden: "0006" }]);
    expect(r.etiqueta).toBe("Calculó el cable UTP categoría 6 por punto de red con 5 visitas revisadas");
    expect(r.cifras).toEqual([
      { id: "proyeccion-p80", valor: "1.215", unidad: "m", descripcion: "de Cable UTP categoría 6 para 40 puntos de red, con el percentil 80" },
      { id: "costo-p80", valor: "$ 3.523.500", unidad: null, descripcion: "al precio vigente" },
    ]);
    const tabla = TablaDelAsistente.parse(r.tabla);
    expect(tabla.titulo).toBe("Cable UTP categoría 6 por punto de red");
    expect(tabla.columnas.map((c) => c.titulo)).toEqual(["Base", "Por punto de red", "40 puntos de red", "Al precio vigente"]);
    expect(tabla.filas.map((f) => f.map((c) => c.texto))).toEqual([
      ["Mediana", "29,0 m", "1.159 m", "$ 3.361.100"],
      ["Percentil 80", "30,4 m", "1.215 m", "$ 3.523.500"],
    ]);
    expect(r.resumen).toBe("156 puntos de red");
    expect(FuentesDelAsistente.parse(r.fuentes).visitas).toHaveLength(5);
  });

  it("también con un filtro", async () => {
    const r = await ejecutar(orgA, "estimar_materiales", { visitas: { ciudades: ["Ibagué", "Espinal", "Melgar"] }, item: utp, porItem: punto, cantidad: 40 });
    expect((r.datos as { proyeccion: { percentil80: number } }).proyeccion.percentil80).toBe(1215);
    expect(r.fuentes!.visitas.map((v) => v.visitaId)).toEqual([...cableadas].reverse());
    expect(valida("estimar_materiales", { item: utp, porItem: punto })).toBe(false);
    expect(valida("estimar_materiales", { visitas: { desde: "2026-13-01" }, item: utp, porItem: punto })).toBe(false);
  });

  it("sin precio, el costo es null; con una unidad que no es suelta, los títulos la usan", async () => {
    const r = await ejecutar(orgA, "estimar_materiales", { visitas: cableadas, item: fibra, porItem: utp, cantidad: 1000 });
    expect((r.datos as { n: number; proyeccion: { costoPercentil80: unknown } }).proyeccion.costoPercentil80).toBeNull();
    const tabla = TablaDelAsistente.parse(r.tabla);
    expect(tabla.columnas.map((c) => c.titulo)).toEqual(["Base", "Por m", "1.000 m", "Al precio vigente"]);
    expect(tabla.filas[0]![3]!.texto).toBe("Sin precio");
  });
});

describe("contar_visitas", () => {
  it("las de UPS por mes, con la serie para el gráfico", async () => {
    const r = await ejecutar(orgA, "contar_visitas", { servicios: ["UPS"], agruparPor: "mes" });
    expect((r.datos as { total: number }).total).toBe(41);
    const serie = SerieDelAsistente.parse(r.serie);
    expect(serie.puntos).toEqual(["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov"].map((etiqueta, i) => ({ etiqueta, valor: UPS_POR_MES[i] })));
    expect(r.cifras?.[0]).toMatchObject({ id: "total", valor: "41" });
    expect(TablaDelAsistente.parse(r.tabla).filas[0]).toEqual([{ texto: "ene 2026" }, { texto: "2" }]);
    expect(herramientas.find((h) => h.nombre === "contar_visitas")!.etiquetas({ servicios: ["UPS"], desde: "2026-01-01", agruparPor: "mes" }).enCurso).toBe("Contando las visitas de UPS de 2026 por mes");
  });

  it("por ciudad, por servicio y por cliente", async () => {
    expect((await ejecutar(orgA, "contar_visitas", { agruparPor: "ciudad" })).datos).toEqual({
      grupos: [
        { grupo: "Neiva", visitas: 41 },
        { grupo: "Ibagué", visitas: 4 },
        { grupo: "Espinal", visitas: 1 },
        { grupo: "Melgar", visitas: 1 },
      ],
      total: 47,
    });
    expect((await ejecutar(orgA, "contar_visitas", { agruparPor: "servicio" })).datos).toEqual({
      grupos: [
        { grupo: "Mantenimiento de UPS", visitas: 41 },
        { grupo: "Sin servicio", visitas: 6 },
      ],
      total: 47,
    });
    expect(((await ejecutar(orgA, "contar_visitas", { agruparPor: "cliente" })).datos as { grupos: unknown[] }).grupos[1]).toEqual({ grupo: "Hotel de ejemplo", visitas: 2 });
  });
});

describe("valores_de_campo", () => {
  it("cuenta las opciones de los levantamientos revisados", async () => {
    const tipo = await ejecutar(orgA, "valores_de_campo", { formato: "prueba-cableado", campo: "Tipo de obra" });
    expect(tipo.datos).toEqual({
      campo: "Tipo de obra",
      tipo: "opcion",
      levantamientos: 6,
      conteos: [
        { opcion: "Interior", veces: 5 },
        { opcion: "Otro", veces: 1 },
      ],
    });
    const sistemas = await ejecutar(orgA, "valores_de_campo", { formato: "Cableado de prueba", campo: "sistemas", visitas: cableadas.slice(0, 3) });
    expect((sistemas.datos as { conteos: unknown }).conteos).toEqual([
      { opcion: "Datos", veces: 3 },
      { opcion: "Voz", veces: 2 },
    ]);
  });

  it("da n, mínimo, mediana y máximo de un campo numérico", async () => {
    const r = await ejecutar(orgA, "valores_de_campo", { formato: "prueba-cableado", campo: "altura" });
    expect(r.datos).toEqual({ campo: "Altura del techo", tipo: "numero", levantamientos: 6, porUnidad: [{ unidad: "m", n: 5, minimo: 2.5, mediana: 3, maximo: 4 }] });
    TablaDelAsistente.parse(r.tabla);
  });

  it("sin lista de visitas, lee solo los últimos 12 meses", async () => {
    expect(((await ejecutar(orgB, "valores_de_campo", { formato: "prueba-cableado", campo: "tipo" })).datos as { conteos: unknown }).conteos).toEqual([{ opcion: "Interior", veces: 1 }]);
  });

  it("con demasiadas visitas en el periodo, pide acotarlo", async () => {
    const [valores] = crearHerramientasDelAsistente({ ...deps, visitas: { ...visitas, porFiltro: async () => ({ visitas: [], hayMas: true }) } }).filter((h) => h.nombre === "valores_de_campo");
    await expect(en(orgA, (tx) => valores!.ejecutar(tx, { formato: "prueba-cableado", campo: "tipo" }, { organizacionId: orgA, usuarioId: "x", hoy }))).rejects.toMatchObject({
      codigo: "entrada_invalida",
      message: "Demasiadas visitas: acote el periodo",
    });
  });

  it("rechaza un campo que no es de opción ni número", async () => {
    await expect(ejecutar(orgA, "valores_de_campo", { formato: "prueba-cableado", campo: "Observaciones" })).rejects.toMatchObject({ codigo: "entrada_invalida" });
  });
});

describe("leer_levantamiento", () => {
  it("lee secciones y campos sin fotos, croquis, firmas, correos ni celulares", async () => {
    const r = await ejecutar(orgA, "leer_levantamiento", { levantamientoId: conSecretos });
    const todo = JSON.stringify(r);
    for (const secreto of ["Juan Pérez", "Persona Que Recibe", "Persona Del Contacto", "Persona Que Atiende", HUELLA_FOTO, HUELLA_BOCETO, HUELLA_FIRMA, "Persona Ficticia", "1234567890", "admin.ejemplo@correo.com", "300 123 4567", "123 4567", "Fotos de llegada", "Croquis", "Firma de quien recibe"]) {
      expect(todo).not.toContain(secreto);
    }
    const datos = r.datos as { secciones: { titulo: string; campos: { etiqueta: string; valor: string }[] }[]; cliente: string; ciudad: string; estado: string; orden: string };
    expect(datos).toMatchObject({ cliente: "Centro médico de ejemplo", ciudad: "Melgar", estado: "Revisado", orden: "0005" });
    expect(datos.secciones.find((x) => x.titulo === "Cierre")!.campos).toEqual([
      { etiqueta: "Observaciones", valor: "Llamar a la administradora al [celular] o escribir a [correo]; fijo [celular]. Quedaron 36 puntos." },
      { etiqueta: "¿Quién te recibe?", valor: "[dato personal]" },
      { etiqueta: "Nombre del contacto", valor: "[dato personal]" },
      { etiqueta: "Persona que atiende", valor: "[dato personal]" },
      { etiqueta: "Nombre del tablero", valor: "Tablero general TG-1" },
      { etiqueta: "¿Quién recibe?", valor: "[dato personal]" },
      { etiqueta: "¿Quiénes reciben?", valor: "Vigilante, [dato personal]" },
    ]);
    TablaDelAsistente.parse(r.tabla);
  });

  it("por número de orden, con las cantidades legibles", async () => {
    const r = await ejecutar(orgA, "leer_levantamiento", { orden: "0001" });
    const datos = r.datos as { levantamientoId: string; secciones: { titulo: string; campos: { etiqueta: string; valor: string }[] }[] };
    expect(datos.levantamientoId).toBe(revisados[0]);
    expect(datos.secciones[0]!.campos).toContainEqual({ etiqueta: "Materiales", valor: "UTP cat 6: 1.020 m; Punto de red: 36 und; Fibra 12 hilos: 180 m; Encauchetado: 35 m" });
    expect(datos.secciones[1]!.campos).toEqual([{ etiqueta: "¿Quién recibe?", valor: "Vigilante" }]);
    expect(r.resumen).toBe("2 secciones");
    expect(herramientas.find((h) => h.nombre === "leer_levantamiento")!.etiquetas({ orden: "0001" }).enCurso).toBe("Leyendo el levantamiento de la orden 0001");
  });

  it("pide exactamente uno de los dos y responde no_encontrado si no existe", async () => {
    expect(valida("leer_levantamiento", {})).toBe(false);
    expect(valida("leer_levantamiento", { orden: "1", levantamientoId: conSecretos })).toBe(false);
    await expect(ejecutar(orgA, "leer_levantamiento", { orden: "9999" })).rejects.toMatchObject({ codigo: "no_encontrado" });
  });
});

describe("aislamiento entre organizaciones", () => {
  it("lo de A nunca aparece en B", async () => {
    const catalogoB = (await ejecutar(orgB, "buscar_en_catalogo", { texto: "cable" })).datos as { items: { id: string }[] };
    expect(catalogoB.items.map((i) => i.id)).toEqual([utpB]);
    expect((await ejecutar(orgB, "ciudades", {})).datos).toEqual({ ciudades: [{ ciudad: "Ibagué", visitas: 2 }], visitasSinCiudad: 0 });
    expect(((await ejecutar(orgB, "buscar_visitas", { ciudades: ["Ibagué"] })).datos as { visitas: { visitaId: string }[] }).visitas.map((v) => v.visitaId)).toEqual([visitaB, antiguaB]);
    const suma = (await ejecutar(orgB, "sumar_materiales", { visitas: cableadas })).datos as { filas: unknown[]; incluidas: unknown[] };
    expect(suma).toEqual({ filas: [], aportaron: 0, incluidas: [], excluidas: [], sinLevantamiento: 0 });
    await expect(ejecutar(orgB, "estimar_materiales", { visitas: cableadas, item: utp, porItem: punto })).rejects.toMatchObject({ codigo: "no_encontrado" });
    await expect(ejecutar(orgB, "leer_levantamiento", { levantamientoId: revisados[0] })).rejects.toMatchObject({ codigo: "no_encontrado" });
    expect(((await ejecutar(orgB, "contar_visitas", { agruparPor: "mes" })).datos as { total: number }).total).toBe(2);
  });
});

describe("el solicitante de la visita", () => {
  it("nada de quien pidió la visita sale en datos, tablas ni fuentes", async () => {
    const resultados = [
      await ejecutar(orgA, "buscar_visitas", { ciudades: ["Ibagué"] }),
      await ejecutar(orgA, "sumar_materiales", { visitas: cableadas }),
      await ejecutar(orgA, "estimar_materiales", { visitas: cableadas, item: utp, porItem: punto, cantidad: 40 }),
      await ejecutar(orgA, "leer_levantamiento", { orden: "0001" }),
      await ejecutar(orgA, "valores_de_campo", { formato: "prueba-cableado", campo: "tipo", visitas: cableadas }),
      await ejecutar(orgA, "contar_visitas", { agruparPor: "cliente" }),
    ];
    const todo = JSON.stringify(resultados.map((r) => ({ datos: r.datos, tabla: r.tabla, fuentes: r.fuentes, cifras: r.cifras })));
    for (const dato of [SOLICITANTE.nombre, SOLICITANTE.correo, SOLICITANTE.celular, "3109876543", solicitante, "Administradora"]) expect(todo).not.toContain(dato);
  });
});

// Volumen: 5001 sitios, 250 visitas revisadas en 2026 y 1001 sin levantamiento en 2024, creadas en la base de una vez.
const volumen = await nuevaOrganizacion(propietario, "Organización con volumen");
await en(volumen, (tx) => formatos.publicar(tx, volumen, cableado));
const clienteVolumen = randomUUID();
await propietario.pool.query("insert into clientes.clientes (id, organizacion_id, nombre) values ($1, $2, 'Cliente con volumen')", [clienteVolumen, volumen]);
await propietario.pool.query(
  `insert into clientes.sitios (id, organizacion_id, cliente_id, nombre, direccion, ciudad)
   select gen_random_uuid(), $1, $2, 'Sitio ' || n, 'Calle [N]', case when n % 2 = 0 then 'Ibagué' else 'Espinal' end from generate_series(1, 5001) as n`,
  [volumen, clienteVolumen],
);
const utpVolumen = await item(volumen, "CAB-UTP6", "Cable UTP categoría 6", "m", 2900);
const visitasEn = (desde: string, hasta: number) =>
  propietario.pool.query(
    `insert into visitas.visitas (id, organizacion_id, cliente_id, sitio_id, motivo, programada_para, tecnicos)
     select gen_random_uuid(), $1, $2, s.id, 'Cableado', date '${desde}' + (substr(s.nombre, 7)::int % 300), '{}'
     from clientes.sitios s where s.organizacion_id = $1 and substr(s.nombre, 7)::int <= $3`,
    [volumen, clienteVolumen, hasta],
  );
await visitasEn("2026-01-01", 250);
await propietario.pool.query(
  `insert into levantamientos.levantamientos (id, organizacion_id, tecnico_id, formato, version_formato, visita_id, estado, respuestas, repeticiones, creado_en_dispositivo, enviado_en_dispositivo, recibido_en)
   select gen_random_uuid(), $1, 'tecnico-ficticio', 'prueba-cableado', 1, v.id, 'revisado', '{}', '{}', now(), now(), now() from visitas.visitas v where v.organizacion_id = $1`,
  [volumen],
);
await propietario.pool.query(
  `insert into levantamientos.lineas_cantidad (organizacion_id, levantamiento_id, seccion, campo, linea, orden, descripcion, cantidad, unidad, item_catalogo_id)
   select $1, l.id, 'obra', 'materiales', 'lin00000', 0, 'UTP', '10', 'm', $2 from levantamientos.levantamientos l where l.organizacion_id = $1`,
  [volumen, utpVolumen],
);
// Tres sin revisar, con UTP, más recientes que todas las revisadas.
await propietario.pool.query(
  `insert into visitas.visitas (id, organizacion_id, cliente_id, sitio_id, motivo, programada_para, tecnicos)
   select gen_random_uuid(), $1, $2, s.id, 'Cableado', date '2026-10-15', '{}' from clientes.sitios s where s.organizacion_id = $1 and substr(s.nombre, 7)::int between 251 and 253`,
  [volumen, clienteVolumen],
);
await propietario.pool.query(
  `insert into levantamientos.levantamientos (id, organizacion_id, tecnico_id, formato, version_formato, visita_id, estado, respuestas, repeticiones, creado_en_dispositivo, enviado_en_dispositivo, recibido_en)
   select gen_random_uuid(), $1, 'tecnico-ficticio', 'prueba-cableado', 1, v.id, 'en_revision', '{}', '{}', now(), now(), now() from visitas.visitas v where v.organizacion_id = $1 and v.programada_para = '2026-10-15'`,
  [volumen],
);
await propietario.pool.query(
  `insert into levantamientos.lineas_cantidad (organizacion_id, levantamiento_id, seccion, campo, linea, orden, descripcion, cantidad, unidad, item_catalogo_id)
   select $1, l.id, 'obra', 'materiales', 'lin00000', 0, 'UTP', '10', 'm', $2 from levantamientos.levantamientos l where l.organizacion_id = $1 and l.estado = 'en_revision'`,
  [volumen, utpVolumen],
);
await visitasEn("2024-01-01", 1001);

describe("con volumen", () => {
  const recientes = (fechas: string[]) => expect(fechas).toEqual([...fechas].sort().reverse());

  it("una suma con filtro cubre las 250 visitas revisadas; las fuentes son 200 en total, las revisadas primero", async () => {
    const r = await ejecutar(volumen, "sumar_materiales", { visitas: { desde: "2026-01-01" }, texto: "utp" });
    expect(r.datos).toMatchObject({ filas: [expect.objectContaining({ codigo: "CAB-UTP6", cantidad: "2500", visitas: 250 })], aportaron: 250 });
    expect(r.fuentes!.titulo).toBe("De 250 visitas revisadas y 3 sin revisar (se muestran 200)");
    expect(r.fuentes!.visitas).toHaveLength(200);
    // Las sin revisar son más recientes, pero las revisadas van primero y llenan el tope.
    expect(r.fuentes!.visitas.every((v) => v.revisado)).toBe(true);
    recientes(r.fuentes!.visitas.map((v) => v.fecha));
    expect(r.fuentes!.visitas[0]!.fecha).toBe("2026-09-08");
    const ibague = await ejecutar(volumen, "sumar_materiales", { visitas: { desde: "2026-01-01", ciudades: ["ibague"] } });
    expect((ibague.datos as { filas: { cantidad: string }[] }).filas[0]!.cantidad).toBe("1250");
  });

  it("con más de 1000 visitas pide acotar", async () => {
    const mucho = { visitas: { desde: "2024-01-01", hasta: "2024-12-31" } };
    for (const [nombre, entrada] of [
      ["sumar_materiales", mucho],
      ["estimar_materiales", { ...mucho, item: utpVolumen, porItem: utpVolumen }],
      ["buscar_visitas", mucho.visitas],
    ] as const) {
      await expect(ejecutar(volumen, nombre, entrada)).rejects.toMatchObject({ codigo: "entrada_invalida", message: "Más de 1000 visitas: acote el periodo o el lugar" });
    }
  });

  it("buscar_visitas trae las 200 más recientes con el total", async () => {
    const r = await ejecutar(volumen, "buscar_visitas", { desde: "2026-01-01" });
    const datos = r.datos as { total: number; hayMas: boolean; visitas: { fecha: string }[] };
    expect({ total: datos.total, hayMas: datos.hayMas, mostradas: datos.visitas.length }).toEqual({ total: 253, hayMas: true, mostradas: 200 });
    recientes(datos.visitas.map((v) => v.fecha));
    expect(datos.visitas[0]!.fecha).toBe("2026-10-15");
  });

  it("contar_visitas y ciudades funcionan con más de 5000 sitios", async () => {
    const porMes = (await ejecutar(volumen, "contar_visitas", { agruparPor: "mes" })).datos as { total: number };
    expect(porMes.total).toBe(1254);
    expect((await ejecutar(volumen, "contar_visitas", { agruparPor: "ciudad" })).datos).toEqual({
      grupos: [
        { grupo: "Espinal", visitas: 628 },
        { grupo: "Ibagué", visitas: 626 },
      ],
      total: 1254,
    });
    expect((await ejecutar(volumen, "ciudades", {})).datos).toEqual({
      ciudades: [
        { ciudad: "Espinal", visitas: 628 },
        { ciudad: "Ibagué", visitas: 626 },
      ],
      visitasSinCiudad: 0,
    });
  });
});
