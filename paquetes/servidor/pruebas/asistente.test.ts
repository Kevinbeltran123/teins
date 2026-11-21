import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { definicionDeEntregar, mensajeDeSistema } from "../src/modulos/asistente/bucle";
import { esquemaEstricto, esquemaNormal } from "../src/modulos/asistente/modelo";
import { purgarConversacionesDelAsistente } from "../src/modulos/mantenimiento";
import { costoDe, ErrorDelModelo, modeloAnthropic, modeloSimulado, type Herramienta, type MensajeDelModelo, type ModeloAsistente, type VueltaDelModelo } from "../src/modulos/asistente";
import { sembrarDatosDelAsistente } from "../src/cli/sembrar-asistente";
import type { Archivos } from "../src/modulos/archivos";
import { crearHerramientasDelAsistente } from "../src/modulos/asistente/herramientas";
import { crearCatalogo } from "../src/modulos/catalogo";
import { clientesYSitios } from "../src/modulos/clientes";
import { crearFormatos } from "../src/modulos/formatos";
import { crearLevantamientos } from "../src/modulos/levantamientos";
import { crearVisitas } from "../src/modulos/visitas";
import { enOrganizacion } from "../src/plataforma/base-de-datos";
import { problema } from "../src/plataforma/errores";
import { conexionesDePrueba, formatoDePrueba, iniciarSesion, ORIGEN, servidorDePrueba } from "./ayudas";

/*
  El asistente de datos (ADR-0060) con un modelo falso: cada prueba le da su guion por la pregunta. Las preguntas que
  empiezan con «[simulado]» van al modelo simulado, que pide las herramientas por nombre.
*/

type Guion = (mensajes: MensajeDelModelo[], vuelta: number) => Promise<VueltaDelModelo> | VueltaDelModelo;
const guiones = new Map<string, { guion: Guion; vueltas: number; mensajes: MensajeDelModelo[][] }>();
const simulado = modeloSimulado();
const sinUso = { entrada: 0, salida: 0, cacheLeida: 0, cacheEscrita: 0 };

const modeloFalso: ModeloAsistente = {
  nombre: "claude-haiku-5-5",
  async responder(pedido) {
    const ultima = pedido.mensajes.findLast((m) => m.tipo === "texto" && m.rol === "user") as Extract<MensajeDelModelo, { tipo: "texto" }>;
    const pregunta = ultima.texto.replace(/^Hoy es \d{4}-\d{2}-\d{2}\.\n\n/, "");
    if (pregunta.startsWith("[simulado]")) return simulado.responder(pedido);
    const entrada = guiones.get(pregunta);
    if (!entrada) throw new Error(`Sin guion para la pregunta: ${pregunta}`);
    entrada.mensajes.push(structuredClone(pedido.mensajes));
    return entrada.guion(pedido.mensajes, ++entrada.vueltas);
  },
};

let llamadaId = 0;
const vuelta = (llamadas: { nombre: string; entrada: unknown }[], extra: Partial<VueltaDelModelo> = {}): VueltaDelModelo => ({
  motivo: "tool_use",
  texto: "",
  llamadas: llamadas.map((l) => ({ id: `llamada_${++llamadaId}`, ...l })),
  contenido: { prueba: true },
  uso: sinUso,
  ...extra,
});
const entregar = (entrada: Partial<{ texto: string; destacado: { paso: number; cifras: string[] } | null; tablas: number[]; fuentes: number | null; serie: number | null }> = {}) =>
  vuelta([{ nombre: "entregar_respuesta", entrada: { texto: "Listo.", destacado: null, tablas: [], fuentes: null, serie: null, ...entrada } }]);

// Herramientas falsas: cada una deja ver con qué conexión y en qué organización corrió.
const VISITA = randomUUID();
const ejecuciones: { herramienta: string; organizacion: string; usuario: string; inicio: number; fin: number }[] = [];
async function anotar(tx: Parameters<Herramienta["ejecutar"]>[0], herramienta: string, inicio: number) {
  const { rows } = await tx.execute<{ organizacion: string; usuario: string }>(sql`select current_setting('app.organizacion', true) as organizacion, current_user as usuario`);
  ejecuciones.push({ herramienta, ...rows[0]!, inicio, fin: Date.now() });
}
let noEstrictaEjecutada = false;
const espera = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

const herramientas: Herramienta[] = [
  {
    nombre: "ciudades",
    descripcion: "Ciudades con visitas",
    entrada: z.object({}).strict(),
    etiquetas: () => ({ enCurso: "Buscando ciudades", hecha: "Buscó ciudades" }),
    async ejecutar(tx) {
      const inicio = Date.now();
      await espera(150);
      await anotar(tx, "ciudades", inicio);
      return { resumen: "3 ciudades", datos: { ciudades: [{ ciudad: "Ibagué", visitas: 3 }] } };
    },
  } satisfies Herramienta<Record<string, never>>,
  {
    nombre: "buscar_en_catalogo",
    descripcion: "Busca en el catálogo",
    entrada: z.object({ texto: z.string() }).strict(),
    etiquetas: (e) => ({ enCurso: `Buscando «${e.texto}» en el catálogo`, hecha: `Buscó «${e.texto}» en el catálogo` }),
    async ejecutar(tx, e) {
      const inicio = Date.now();
      await espera(150);
      await anotar(tx, "buscar_en_catalogo", inicio);
      return { resumen: "1 ítem", datos: { items: [{ id: randomUUID(), codigo: "C-1", descripcion: `Ítem ${e.texto}`, unidad: "m", precio: null, precioDesde: null }] } };
    },
  } satisfies Herramienta<{ texto: string }>,
  {
    nombre: "buscar_visitas",
    descripcion: "Busca visitas",
    entrada: z.object({ desde: z.string().optional(), ciudades: z.array(z.string()).optional() }).strict(),
    etiquetas: () => ({ enCurso: "Buscando visitas", hecha: "Buscó visitas" }),
    async ejecutar() {
      return { resumen: "1 visita", datos: { total: 1, revisadas: 1, sinRevisar: 0, visitas: [{ visitaId: VISITA, orden: "0001", fecha: "2026-10-01", cliente: "Cliente", sitio: "Sitio", ciudad: "Ibagué", servicio: "Cableado", revisado: true }] } };
    },
  } satisfies Herramienta<{ desde?: string | undefined; ciudades?: string[] | undefined }>,
  {
    nombre: "sumar_materiales",
    descripcion: "Suma materiales",
    entrada: z.object({ visitas: z.union([z.array(z.string()), z.object({ desde: z.string(), ciudades: z.array(z.string()).optional() }).strict()]), texto: z.string().optional() }).strict(),
    etiquetas: () => ({ enCurso: "Sumando materiales", hecha: "Sumó materiales" }),
    async ejecutar() {
      return {
        resumen: "1 material",
        datos: { filas: [{ descripcion: "UTP", unidad: "m", cantidad: "4485" }], incluidas: 5, excluidas: 1 },
        cifras: [
          { id: "total", valor: "4485", unidad: "m", descripcion: "UTP categoría 6 en 5 visitas" },
          { id: "costo", valor: "$ 13.006.500", unidad: null, descripcion: "al precio vigente" },
          { id: "tercera", valor: "5", unidad: "visitas", descripcion: "incluidas" },
        ],
        tabla: { titulo: "Materiales", columnas: [{ titulo: "Material", numerica: false }, { titulo: "Cantidad", numerica: true }], filas: [[{ texto: "UTP" }, { texto: "4.485 m" }]] },
        fuentes: { titulo: "Visitas", visitas: [{ visitaId: VISITA, levantamientoId: null, orden: "0001", fecha: "2026-10-01", cliente: "Cliente", sitio: "Sitio", ciudad: "Ibagué", revisado: true }] },
        serie: { titulo: "Por mes", puntos: [{ etiqueta: "oct", valor: 4485 }] },
      };
    },
  } satisfies Herramienta<{ visitas: string[] | { desde: string; ciudades?: string[] | undefined }; texto?: string | undefined }>,
  {
    nombre: "con_detalle",
    descripcion: "Falla con un problema que le sirve al modelo",
    entrada: z.object({ codigo: z.enum(["entrada_invalida", "no_encontrado", "conflicto"]) }).strict(),
    etiquetas: () => ({ enCurso: "Probando", hecha: "Probó" }),
    async ejecutar(_tx, e) {
      throw problema(e.codigo, "Demasiados datos: acote el periodo");
    },
  } satisfies Herramienta<{ codigo: "entrada_invalida" | "no_encontrado" | "conflicto" }>,
  {
    nombre: "con_etiqueta",
    descripcion: "Dice su propia etiqueta",
    entrada: z.object({ sitioId: z.string() }).strict(),
    etiquetas: () => ({ enCurso: "Buscando el sitio", hecha: "Buscó el sitio" }),
    async ejecutar() {
      return { resumen: "1 sitio", etiqueta: "Buscó el sitio Sede principal", datos: {} };
    },
  } satisfies Herramienta<{ sitioId: string }>,
  {
    nombre: "no_estricta",
    descripcion: "Va sin strict a la API",
    estricta: false,
    entrada: z.object({ n: z.int() }).strict(),
    etiquetas: () => ({ enCurso: "Probando", hecha: "Probó" }),
    async ejecutar() {
      noEstrictaEjecutada = true;
      return { resumen: "ok", datos: {} };
    },
  } satisfies Herramienta<{ n: number }>,
  {
    nombre: "vacia",
    descripcion: "Una tabla sin filas",
    entrada: z.object({}).strict(),
    etiquetas: () => ({ enCurso: "Contando", hecha: "Contó" }),
    async ejecutar() {
      return { resumen: "0 visitas", datos: { total: 0 }, tabla: { titulo: "Visitas de 2019", columnas: [{ titulo: "Mes", numerica: false }], filas: [] } };
    },
  } satisfies Herramienta<Record<string, never>>,
  {
    nombre: "grande",
    descripcion: "Devuelve un resultado del tamaño pedido",
    entrada: z.object({ kb: z.int() }).strict(),
    etiquetas: () => ({ enCurso: "Leyendo mucho", hecha: "Leyó mucho" }),
    async ejecutar(_tx, e) {
      return { resumen: `${e.kb} KB`, datos: { relleno: "x".repeat(e.kb * 1000) } };
    },
  } satisfies Herramienta<{ kb: number }>,
  {
    nombre: "falla",
    descripcion: "Siempre falla",
    entrada: z.object({}).strict(),
    etiquetas: () => ({ enCurso: "Fallando", hecha: "Falló" }),
    async ejecutar() {
      throw new Error("dato secreto que no debe registrarse");
    },
  } satisfies Herramienta<Record<string, never>>,
];

const registros: unknown[] = [];
const registro = { info: (d: Record<string, unknown>) => void registros.push(d), error: (d: Record<string, unknown>) => void registros.push(d) };
const s = await servidorDePrueba({ config: { ASISTENTE_ACTIVO: "true" }, asistente: { modelo: modeloFalso, herramientas, registro } });
const { app } = s;

const pedir = (cookie: string, method: "GET" | "POST", url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });

const org = await s.nuevaOrganizacionConUsuarios();
const oficina = org.oficina.cookie;

async function otraPersonaDeOficina(organizacionId: string) {
  const usuario = `oficina.${randomBytes(4).toString("hex")}`;
  await s.identidad.crearUsuario({ organizacionId, usuario, nombre: "Otra persona de oficina", rol: "oficina", contrasena: "contrasena-de-prueba" });
  return iniciarSesion(app, usuario, "contrasena-de-prueba");
}

/** Pregunta con un guion, procesa la cola y devuelve el intercambio terminado. */
async function preguntar(texto: string, guion: Guion, { cookie = oficina, conversacionId = null as string | null } = {}) {
  guiones.set(texto, { guion, vueltas: 0, mensajes: [] });
  const r = await pedir(cookie, "POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId, texto });
  expect(r.statusCode, r.body).toBe(202);
  await s.procesarCola();
  const { conversacionId: id, intercambioId } = r.json();
  const conversacion = (await pedir(cookie, "GET", `/api/asistente/conversaciones/${id}`)).json();
  return { conversacionId: id as string, intercambio: conversacion.intercambios.find((i: { id: string }) => i.id === intercambioId), guion: guiones.get(texto)! };
}

describe("operaciones del asistente", () => {
  it("el estado dice si está disponible, su nombre, la cobertura y el tope", async () => {
    const r = await pedir(oficina, "GET", "/api/asistente");
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ disponible: true, nombre: "Chispa", cobertura: { revisados: 0, desde: null, hasta: null }, topeAgotado: false });
  });

  it("solo oficina: un técnico no ve nada del asistente", async () => {
    for (const [method, url] of [["GET", "/api/asistente"], ["GET", "/api/asistente/conversaciones"], ["POST", "/api/asistente/preguntas"]] as const) {
      const r = await pedir(org.tecnico.cookie, method, url, method === "POST" ? { llave: randomUUID(), conversacionId: null, texto: "hola" } : undefined);
      expect(r.statusCode, url).toBe(403);
    }
    expect((await app.inject({ method: "GET", url: "/api/asistente" })).statusCode).toBe(401);
  });

  it("el título es la primera pregunta recortada y la conversación aparece en la lista", async () => {
    const larga = `¿Cuánto cable ${"muy ".repeat(40)}largo se usó?`;
    const { conversacionId } = await preguntar(larga, () => entregar());
    const lista = (await pedir(oficina, "GET", "/api/asistente/conversaciones")).json().conversaciones;
    const fila = lista.find((c: { id: string }) => c.id === conversacionId);
    expect(fila.titulo.length).toBeLessThanOrEqual(80);
    expect(fila.titulo.endsWith("…")).toBe(true);
    expect(fila.preguntas).toBe(1);
  });

  it("la misma llave devuelve el mismo intercambio y no encola otro (regla 4)", async () => {
    guiones.set("idempotente", { guion: () => entregar(), vueltas: 0, mensajes: [] });
    const cuerpo = { llave: randomUUID(), conversacionId: null, texto: "idempotente" };
    const [a, b] = await Promise.all([pedir(oficina, "POST", "/api/asistente/preguntas", cuerpo), pedir(oficina, "POST", "/api/asistente/preguntas", cuerpo)]);
    expect([a.statusCode, b.statusCode]).toEqual([202, 202]);
    expect(b.json()).toEqual(a.json());
    const c = await pedir(oficina, "POST", "/api/asistente/preguntas", cuerpo);
    expect(c.json()).toEqual(a.json());
    await s.procesarCola();
    expect(guiones.get("idempotente")!.vueltas).toBe(1);
    const conversacion = (await pedir(oficina, "GET", `/api/asistente/conversaciones/${a.json().conversacionId}`)).json();
    expect(conversacion.intercambios).toHaveLength(1);
  });

  it("estado_invalido si ya hay una respuesta en curso en esa conversación", async () => {
    guiones.set("primera en curso", { guion: () => entregar(), vueltas: 0, mensajes: [] });
    const primera = await pedir(oficina, "POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId: null, texto: "primera en curso" });
    const segunda = await pedir(oficina, "POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId: primera.json().conversacionId, texto: "segunda" });
    expect(segunda.statusCode).toBe(409);
    expect(segunda.json().codigo).toBe("estado_invalido");
    await s.procesarCola();
  });

  it("cada persona ve solo sus conversaciones; la ajena es no_encontrado, también en otra organización", async () => {
    const { conversacionId, intercambio } = await preguntar("mía", () => entregar());
    const otra = await otraPersonaDeOficina(org.organizacionId);
    const otraOrg = await s.nuevaOrganizacionConUsuarios();
    for (const cookie of [otra, otraOrg.oficina.cookie]) {
      expect((await pedir(cookie, "GET", `/api/asistente/conversaciones/${conversacionId}`)).statusCode).toBe(404);
      expect((await pedir(cookie, "POST", `/api/asistente/conversaciones/${conversacionId}/eliminar`)).statusCode).toBe(404);
      expect((await pedir(cookie, "POST", `/api/asistente/conversaciones/${conversacionId}/restaurar`)).statusCode).toBe(404);
      expect((await pedir(cookie, "POST", `/api/asistente/intercambios/${intercambio.id}/detener`)).statusCode).toBe(404);
      const seguir = await pedir(cookie, "POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId, texto: "me cuelo" });
      expect(seguir.statusCode).toBe(404);
      const lista = (await pedir(cookie, "GET", "/api/asistente/conversaciones")).json().conversaciones;
      expect(lista.map((c: { id: string }) => c.id)).not.toContain(conversacionId);
    }
  });

  it("eliminar es lógico y restaurar la devuelve", async () => {
    const { conversacionId } = await preguntar("para eliminar", () => entregar());
    const ids = async () => (await pedir(oficina, "GET", "/api/asistente/conversaciones")).json().conversaciones.map((c: { id: string }) => c.id);
    expect((await pedir(oficina, "POST", `/api/asistente/conversaciones/${conversacionId}/eliminar`)).statusCode).toBe(200);
    expect((await pedir(oficina, "POST", `/api/asistente/conversaciones/${conversacionId}/eliminar`)).statusCode).toBe(200);
    expect(await ids()).not.toContain(conversacionId);
    expect((await pedir(oficina, "GET", `/api/asistente/conversaciones/${conversacionId}`)).statusCode).toBe(404);
    const seguir = await pedir(oficina, "POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId, texto: "en una eliminada" });
    expect(seguir.statusCode).toBe(404);
    expect((await pedir(oficina, "POST", `/api/asistente/conversaciones/${conversacionId}/restaurar`)).statusCode).toBe(200);
    expect(await ids()).toContain(conversacionId);
  });

  it("uso y tope: solo administración; el uso es del mes con el nombre de cada persona; el tope agotado detiene las preguntas", async () => {
    const o = await s.nuevaOrganizacionConUsuarios();
    const admin = await s.nuevoAdministrador(o.organizacionId);
    expect((await pedir(o.oficina.cookie, "GET", "/api/asistente/uso")).statusCode).toBe(403);
    expect((await pedir(o.oficina.cookie, "POST", "/api/asistente/tope", { topeUsd: "10" })).statusCode).toBe(403);

    guiones.set("cuesta", {
      guion: () => ({ ...entregar(), uso: { entrada: 10_000, salida: 2_000, cacheLeida: 0, cacheEscrita: 0 } }),
      vueltas: 0,
      mensajes: [],
    });
    expect((await pedir(o.oficina.cookie, "POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId: null, texto: "cuesta" })).statusCode).toBe(202);
    await s.procesarCola();

    const uso = await pedir(admin.cookie, "GET", "/api/asistente/uso");
    expect(uso.statusCode, uso.body).toBe(200);
    const mes = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7);
    // 10 000 × 0,10 + 2 000 × 0,50 por millón = US$0,002.
    expect(uso.json()).toEqual({ mes, gastoUsd: "0.002", topeUsd: "5", preguntas: 1, porPersona: [{ usuarioId: o.oficina.id, nombre: "Oficina de prueba", preguntas: 1, gastoUsd: "0.002" }] });

    expect((await pedir(admin.cookie, "POST", "/api/asistente/tope", { topeUsd: "1001" })).statusCode).toBe(400);
    expect((await pedir(admin.cookie, "POST", "/api/asistente/tope", { topeUsd: "0.002" })).statusCode).toBe(400);
    expect((await pedir(admin.cookie, "POST", "/api/asistente/tope", { topeUsd: "0" })).statusCode).toBe(200);
    // Cambiar el tope queda en la cadena de la organización: quién, y el valor anterior y el nuevo.
    const { rows: auditados } = await s.propietario.pool.query(
      "select autor_id, agregado_tipo, agregado_id, valor_anterior, valor_nuevo from auditoria.registros where organizacion_id = $1 and tipo_evento = 'tope_del_asistente_cambiado'",
      [o.organizacionId],
    );
    expect(auditados).toEqual([{ autor_id: admin.id, agregado_tipo: "organizacion", agregado_id: o.organizacionId, valor_anterior: { topeUsd: "5" }, valor_nuevo: { topeUsd: "0" } }]);
    expect((await pedir(admin.cookie, "GET", "/api/asistente/uso")).json().topeUsd).toBe("0");
    expect((await pedir(o.oficina.cookie, "GET", "/api/asistente")).json().topeAgotado).toBe(true);
    const negada = await pedir(o.oficina.cookie, "POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId: null, texto: "otra" });
    expect(negada.statusCode).toBe(429);
    expect(negada.json().codigo).toBe("tope_agotado");
    // El tope de una organización no toca a otra.
    expect((await pedir(oficina, "GET", "/api/asistente")).json().topeAgotado).toBe(false);
  });

  it("el tope se revisa antes de cada llamada al modelo: una respuesta que lo agota termina en error", async () => {
    const o = await s.nuevaOrganizacionConUsuarios();
    const admin = await s.nuevoAdministrador(o.organizacionId);
    await pedir(admin.cookie, "POST", "/api/asistente/tope", { topeUsd: "0.01" });
    // 100 000 de salida a 0,50 por millón = US$0,05: pasa el tope en la primera vuelta.
    const { intercambio, guion } = await preguntar("cara", () => vuelta([{ nombre: "ciudades", entrada: {} }], { uso: { entrada: 1000, salida: 100_000, cacheLeida: 0, cacheEscrita: 0 } }), { cookie: o.oficina.cookie });
    expect(guion.vueltas).toBe(1);
    expect(intercambio.estado).toBe("error");
    expect(intercambio.error).toMatch(/tope/);
  });
});

const sinModelo = await servidorDePrueba();
describe("no disponible", () => {
  it("sin modelo configurado, el estado lo dice y preguntar responde no_disponible", async () => {
    const o = await sinModelo.nuevaOrganizacionConUsuarios();
    const pedirSin = (method: "GET" | "POST", url: string, payload?: object) =>
      sinModelo.app.inject({ method, url, headers: { cookie: o.oficina.cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });
    expect((await pedirSin("GET", "/api/asistente")).json().disponible).toBe(false);
    const r = await pedirSin("POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId: null, texto: "hola" });
    expect(r.statusCode).toBe(503);
    expect(r.json().codigo).toBe("no_disponible");
  });
});

describe("el bucle con el modelo", () => {
  it("ejecuta en paralelo, guarda los pasos y arma la respuesta solo con referencias que existen", async () => {
    ejecuciones.length = 0;
    const { intercambio, guion } = await preguntar("¿Cuánto cable?", (_m, n) => {
      if (n === 1) return vuelta([{ nombre: "ciudades", entrada: {} }, { nombre: "buscar_en_catalogo", entrada: { texto: "cable" } }]);
      if (n === 2) return vuelta([{ nombre: "sumar_materiales", entrada: { visitas: [VISITA] } }]);
      // Referencias buenas al paso 3 y malas: un paso que no existe, uno sin tabla y una cifra que no hay.
      return entregar({ texto: "Se usaron 4.485 m.", destacado: { paso: 3, cifras: ["total", "total", "no-existe"] }, tablas: [3, 3, 1, 9], fuentes: 3, serie: 7 });
    });
    expect(intercambio.estado, intercambio.error).toBe("lista");
    expect(intercambio.duracionSegundos).toBeGreaterThanOrEqual(0);
    expect(intercambio.pasos).toEqual([
      { herramienta: "ciudades", etiqueta: "Buscó ciudades", resultado: "3 ciudades", estado: "hecho" },
      { herramienta: "buscar_en_catalogo", etiqueta: "Buscó «cable» en el catálogo", resultado: "1 ítem", estado: "hecho" },
      { herramienta: "sumar_materiales", etiqueta: "Sumó materiales", resultado: "1 material", estado: "hecho" },
    ]);
    expect(intercambio.respuesta.destacado).toEqual({ cifras: [{ valor: "4485", unidad: "m" }], descripcion: "UTP categoría 6 en 5 visitas" });
    expect(intercambio.respuesta.tablas).toHaveLength(1);
    expect(intercambio.respuesta.fuentes.visitas[0].visitaId).toBe(VISITA);
    expect(intercambio.respuesta.serie).toBeNull();

    // Las dos primeras corrieron a la vez, con la conexión de negocio y la organización fijada.
    const [a, b] = ejecuciones;
    expect(a!.inicio < b!.fin && b!.inicio < a!.fin).toBe(true);
    for (const e of ejecuciones) expect(e).toMatchObject({ organizacion: org.organizacionId, usuario: "teins_app" });

    // Lo que ve el modelo de cada herramienta.
    const resultados = guion.mensajes[2]!.filter((m) => m.tipo === "resultados").at(-1) as Extract<MensajeDelModelo, { tipo: "resultados" }>;
    expect(JSON.parse(resultados.resultados[0]!.contenido)).toEqual({
      paso: 3,
      datos: { filas: [{ descripcion: "UTP", unidad: "m", cantidad: "4485" }], incluidas: 5, excluidas: 1 },
      cifras: [
        { id: "total", valor: "4485", unidad: "m", descripcion: "UTP categoría 6 en 5 visitas" },
        { id: "costo", valor: "$ 13.006.500", unidad: null, descripcion: "al precio vigente" },
        { id: "tercera", valor: "5", unidad: "visitas", descripcion: "incluidas" },
      ],
      tieneTabla: true,
      tieneFuentes: true,
      tieneSerie: true,
    });
  });

  it("una tabla sin filas no se muestra", async () => {
    const { intercambio } = await preguntar("tabla vacía", (_m, n) => (n === 1 ? vuelta([{ nombre: "vacia", entrada: {} }]) : entregar({ tablas: [1] })));
    expect(intercambio.estado).toBe("lista");
    expect(intercambio.respuesta.tablas).toEqual([]);
  });

  it("una cifra que no está en el paso no se destaca", async () => {
    const { intercambio } = await preguntar("cifra inventada", (_m, n) =>
      n === 1 ? vuelta([{ nombre: "sumar_materiales", entrada: { visitas: [] } }]) : entregar({ destacado: { paso: 1, cifras: ["inventada"] } }),
    );
    expect(intercambio.respuesta.destacado).toBeNull();
  });

  it("el destacado lleva hasta dos cifras, sin repetidas ni inventadas", async () => {
    const dos = await preguntar("dos cifras", (_m, n) =>
      n === 1 ? vuelta([{ nombre: "sumar_materiales", entrada: { visitas: [] } }]) : entregar({ destacado: { paso: 1, cifras: ["costo", "inventada", "costo", "total", "tercera"] } }),
    );
    expect(dos.intercambio.respuesta.destacado).toEqual({
      cifras: [
        { valor: "$ 13.006.500", unidad: null },
        { valor: "4485", unidad: "m" },
      ],
      descripcion: "al precio vigente · UTP categoría 6 en 5 visitas",
    });
  });

  it("la raya larga del modelo se vuelve viñeta o coma; el mensaje de sistema la nombra sin escribirla en el código", async () => {
    const { intercambio, guion } = await preguntar("raya", () => entregar({ texto: "\u2014 Primero\n  \u2014 Segundo\nUno \u2014 dos\u2014tres" }));
    expect(intercambio.respuesta.texto).toBe("- Primero\n  - Segundo\nUno, dos, tres");
    expect(guion.mensajes).toHaveLength(1);
    expect(mensajeDeSistema({ asistente: "Chispa", organizacion: "Org" })).toContain("raya larga (\u2014)");
  });

  it("al modelo le llegan los errores útiles: el detalle de entrada_invalida y no_encontrado, y los problemas de su entrada; lo demás, genérico", async () => {
    const { guion } = await preguntar("errores útiles", (_m, n) =>
      n === 1
        ? vuelta([
            { nombre: "con_detalle", entrada: { codigo: "entrada_invalida" } },
            { nombre: "con_detalle", entrada: { codigo: "no_encontrado" } },
            { nombre: "con_detalle", entrada: { codigo: "conflicto" } },
            { nombre: "buscar_en_catalogo", entrada: { texto: 5 } },
          ])
        : entregar(),
    );
    const resultados = (guion.mensajes[1]!.at(-1) as Extract<MensajeDelModelo, { tipo: "resultados" }>).resultados;
    expect(resultados.map((r) => r.esError)).toEqual([true, true, true, true]);
    expect(resultados[0]!.contenido).toBe("Demasiados datos: acote el periodo");
    expect(resultados[1]!.contenido).toBe("Demasiados datos: acote el periodo");
    expect(resultados[2]!.contenido).toBe("La consulta falló.");
    expect(resultados[3]!.contenido).toMatch(/^La entrada no es válida: texto: /);
  });

  it("una herramienta no estricta con entrada inválida recibe el error de Zod y no se ejecuta", async () => {
    const { intercambio, guion } = await preguntar("no estricta inválida", (_m, n) => (n === 1 ? vuelta([{ nombre: "no_estricta", entrada: { n: "cinco" } }]) : entregar()));
    expect(noEstrictaEjecutada).toBe(false);
    expect(intercambio.pasos).toEqual([]);
    const [resultado] = (guion.mensajes[1]!.at(-1) as Extract<MensajeDelModelo, { tipo: "resultados" }>).resultados;
    expect(resultado).toMatchObject({ esError: true });
    expect(resultado!.contenido).toMatch(/^La entrada no es válida: n: /);
  });

  it("la etiqueta que trae el resultado reemplaza la hecha", async () => {
    const { intercambio } = await preguntar("etiqueta propia", (_m, n) => (n === 1 ? vuelta([{ nombre: "con_etiqueta", entrada: { sitioId: "x" } }]) : entregar()));
    expect(intercambio.pasos).toEqual([{ herramienta: "con_etiqueta", etiqueta: "Buscó el sitio Sede principal", resultado: "1 sitio", estado: "hecho" }]);
  });

  it("el historial va compacto: preguntas y respuestas en texto, sin bloques de herramientas", async () => {
    const primera = await preguntar("historial uno", (_m, n) => (n === 1 ? vuelta([{ nombre: "sumar_materiales", entrada: { visitas: [] } }]) : entregar({ texto: "Fueron 4.485 m.", tablas: [1] })));
    const segunda = await preguntar("historial dos", () => entregar(), { conversacionId: primera.conversacionId });
    expect(segunda.intercambio.estado).toBe("lista");
    const [enviados] = segunda.guion.mensajes;
    expect(enviados!.map((m) => m.tipo)).toEqual(["texto", "texto", "texto"]);
    expect(enviados![0]).toEqual({ tipo: "texto", rol: "user", texto: "historial uno" });
    const anterior = enviados![1] as Extract<MensajeDelModelo, { tipo: "texto" }>;
    expect(anterior.rol).toBe("assistant");
    expect(anterior.texto).toContain("Fueron 4.485 m.");
    expect(anterior.texto).toContain("UTP | 4.485 m");
  });

  it("end_turn sin entregar_respuesta: el texto queda como respuesta, sin referencias", async () => {
    const { intercambio } = await preguntar("solo texto", () => ({ ...vuelta([]), motivo: "end_turn", texto: "No tengo ese dato." }));
    expect(intercambio.estado).toBe("lista");
    expect(intercambio.respuesta).toEqual({ texto: "No tengo ese dato.", destacado: null, tablas: [], fuentes: null, serie: null });
  });

  it("pause_turn termina en error: sin herramientas del servidor no hay cómo seguir", async () => {
    const { intercambio, guion } = await preguntar("pausa", () => ({ ...vuelta([]), motivo: "pause_turn" }));
    expect(intercambio).toMatchObject({ estado: "error", error: "La respuesta quedó en pausa y no se pudo terminar. Vuelva a preguntar." });
    expect(guion.vueltas).toBe(1);
  });

  it("end_turn sin texto (solo pensó) termina en error", async () => {
    const { intercambio } = await preguntar("solo pensó", () => ({ ...vuelta([]), motivo: "end_turn", texto: "  " }));
    expect(intercambio).toMatchObject({ estado: "error", error: "El asistente terminó sin escribir una respuesta. Vuelva a preguntar." });
  });

  it("la conversación que no cabe en el contexto termina en error", async () => {
    const { intercambio } = await preguntar("muy larga", () => ({ ...vuelta([]), motivo: "contexto" }));
    expect(intercambio).toMatchObject({ estado: "error", error: "La conversación es demasiado larga: empiece una nueva." });
  });

  it("entregar_respuesta junto con otras: se ejecutan las otras y la entrega se rechaza", async () => {
    const { intercambio, guion } = await preguntar("entrega acompañada", (_m, n) =>
      n === 1 ? vuelta([{ nombre: "ciudades", entrada: {} }, { nombre: "entregar_respuesta", entrada: { texto: "Antes de tiempo.", destacado: null, tablas: [], fuentes: null, serie: null } }]) : entregar({ texto: "Ahora sí." }),
    );
    expect(intercambio.respuesta.texto).toBe("Ahora sí.");
    expect(intercambio.pasos.map((p: { herramienta: string }) => p.herramienta)).toEqual(["ciudades"]);
    const resultados = (guion.mensajes[1]!.at(-1) as Extract<MensajeDelModelo, { tipo: "resultados" }>).resultados;
    expect(resultados.map((r) => [r.esError, r.esError ? r.contenido : "ok"])).toEqual([
      [false, "ok"],
      [true, "Llame a entregar_respuesta sola, después de ver los resultados."],
    ]);
  });

  it("dos entregas en una vuelta: las dos reciben su resultado de error, aunque la primera no pase la validación", async () => {
    const { intercambio, guion } = await preguntar("dos entregas", (_m, n) =>
      n === 1 ? vuelta([{ nombre: "entregar_respuesta", entrada: { texto: 5 } }, { nombre: "entregar_respuesta", entrada: { texto: "Hola.", destacado: null, tablas: [], fuentes: null, serie: null } }]) : entregar({ texto: "Una sola." }),
    );
    expect(intercambio.respuesta.texto).toBe("Una sola.");
    const resultados = (guion.mensajes[1]!.at(-1) as Extract<MensajeDelModelo, { tipo: "resultados" }>).resultados;
    expect(resultados).toHaveLength(2);
    for (const r of resultados) expect(r).toMatchObject({ esError: true, contenido: "Llame a entregar_respuesta sola, después de ver los resultados." });
  });

  it("como mucho 5 consultas por vuelta; un resultado muy grande o lo que pasa el total de la vuelta va como error", async () => {
    const seis = await preguntar("seis consultas", (_m, n) => (n === 1 ? vuelta(Array.from({ length: 6 }, () => ({ nombre: "buscar_visitas", entrada: {} }))) : entregar()));
    expect(seis.intercambio.pasos).toHaveLength(5);
    const r1 = (seis.guion.mensajes[1]!.at(-1) as Extract<MensajeDelModelo, { tipo: "resultados" }>).resultados;
    expect(r1.map((r) => r.esError)).toEqual([false, false, false, false, false, true]);
    expect(r1[5]!.contenido).toBe("No se ejecutó: pida como máximo 5 consultas por vuelta.");

    const grandes = await preguntar("resultados grandes", (_m, n) =>
      n === 1 ? vuelta([{ nombre: "grande", entrada: { kb: 70 } }, ...Array.from({ length: 4 }, () => ({ nombre: "grande", entrada: { kb: 55 } }))]) : entregar(),
    );
    const r2 = (grandes.guion.mensajes[1]!.at(-1) as Extract<MensajeDelModelo, { tipo: "resultados" }>).resultados;
    expect(r2.map((r) => (r.esError ? r.contenido : "ok"))).toEqual([
      "El resultado es demasiado grande: acote la consulta.",
      "ok",
      "ok",
      "ok",
      "Los resultados de esta vuelta son demasiado grandes: pida menos consultas a la vez o acótelas.",
    ]);
    expect(grandes.intercambio.pasos.map((p: { estado: string }) => p.estado)).toEqual(["fallo", "hecho", "hecho", "hecho", "fallo"]);
  });

  it("refusal y max_tokens terminan en error con un mensaje claro", async () => {
    const rechazo = await preguntar("rechazo", () => ({ ...vuelta([]), motivo: "refusal" }));
    expect(rechazo.intercambio).toMatchObject({ estado: "error", respuesta: null });
    expect(rechazo.intercambio.error).toMatch(/no puede responder/);
    const cortada = await preguntar("cortada", () => ({ ...vuelta([]), motivo: "max_tokens" }));
    expect(cortada.intercambio.estado).toBe("error");
    expect(cortada.intercambio.error).toMatch(/cortada/);
  });

  it("para en 8 vueltas", async () => {
    const { intercambio, guion } = await preguntar("sin fin", () => vuelta([{ nombre: "buscar_visitas", entrada: {} }]));
    expect(guion.vueltas).toBe(8);
    expect(intercambio.estado).toBe("error");
    expect(intercambio.pasos).toHaveLength(8);
  });

  it("detener: el worker para antes de la siguiente llamada al modelo", async () => {
    const { intercambio, guion } = await preguntar("detener", async (_m, n) => {
      if (n === 1) {
        const conversaciones = (await pedir(oficina, "GET", "/api/asistente/conversaciones")).json().conversaciones;
        const conversacion = (await pedir(oficina, "GET", `/api/asistente/conversaciones/${conversaciones[0].id}`)).json();
        const id = conversacion.intercambios.at(-1).id;
        expect((await pedir(oficina, "POST", `/api/asistente/intercambios/${id}/detener`)).statusCode).toBe(200);
        expect((await pedir(oficina, "POST", `/api/asistente/intercambios/${id}/detener`)).statusCode).toBe(200);
      }
      return vuelta([{ nombre: "ciudades", entrada: {} }]);
    });
    expect(guion.vueltas).toBe(1);
    expect(intercambio).toMatchObject({ estado: "detenida", error: null });
    // Ya terminada, detener no hace nada.
    expect((await pedir(oficina, "POST", `/api/asistente/intercambios/${intercambio.id}/detener`)).statusCode).toBe(200);
  });

  it("una herramienta que falla queda como paso fallido y el modelo sigue; una desconocida no rompe", async () => {
    const { intercambio, guion } = await preguntar("con fallas", (_m, n) => (n === 1 ? vuelta([{ nombre: "falla", entrada: {} }, { nombre: "no_existe", entrada: {} }, { nombre: "ciudades", entrada: { sobra: 1 } }]) : entregar()));
    expect(intercambio.estado).toBe("lista");
    expect(intercambio.pasos).toEqual([{ herramienta: "falla", etiqueta: "Falló", resultado: null, estado: "fallo" }]);
    const resultados = guion.mensajes[1]!.at(-1) as Extract<MensajeDelModelo, { tipo: "resultados" }>;
    expect(resultados.resultados.map((r) => r.esError)).toEqual([true, true, true]);
  });

  it("una excepción del modelo deja el intercambio en error, nunca en curso", async () => {
    const { intercambio } = await preguntar("explota", () => {
      throw new Error("falla inesperada");
    });
    expect(intercambio.estado).toBe("error");
    expect(intercambio.error).toMatch(/Vuelva a preguntar/);
  });

  it("los registros nunca llevan la pregunta ni los resultados", async () => {
    const texto = JSON.stringify(registros);
    expect(registros.length).toBeGreaterThan(0);
    expect(texto).not.toContain("¿Cuánto cable?");
    expect(texto).not.toContain("4485");
    expect(texto).not.toContain("dato secreto");
    expect(texto).toContain("intercambioId");
  });

  it("guarda tokens y costo de cada vuelta", async () => {
    const { intercambio } = await preguntar("tokens", (_m, n) =>
      n === 1 ? vuelta([{ nombre: "ciudades", entrada: {} }], { uso: { entrada: 1000, salida: 100, cacheLeida: 2000, cacheEscrita: 400 } }) : { ...entregar(), uso: { entrada: 500, salida: 50, cacheLeida: 0, cacheEscrita: 0 } },
    );
    const { rows } = await s.propietario.pool.query("select tokens_entrada, tokens_salida, tokens_cache_leida, tokens_cache_escrita, costo_usd::text as costo, modelo from asistente.intercambios where id = $1", [intercambio.id]);
    expect(rows[0]).toEqual({
      tokens_entrada: 1500,
      tokens_salida: 150,
      tokens_cache_leida: 2000,
      tokens_cache_escrita: 400,
      costo: costoSumado(),
      modelo: "claude-haiku-5-5",
    });
    function costoSumado() {
      const a = Number(costoDe("claude-haiku-5-5", { entrada: 1000, salida: 100, cacheLeida: 2000, cacheEscrita: 400 }));
      const b = Number(costoDe("claude-haiku-5-5", { entrada: 500, salida: 50, cacheLeida: 0, cacheEscrita: 0 }));
      return (a + b).toFixed(9);
    }
  });
});

describe("límites y conservación", () => {
  const pendiente = (cookie: string, texto: string, conversacionId: string | null = null) => {
    guiones.set(texto, { guion: () => entregar(), vueltas: 0, mensajes: [] });
    return pedir(cookie, "POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId, texto });
  };

  it("como mucho dos respuestas en curso por persona, sin contar las vencidas; cada una en la cola de su organización", async () => {
    const o = await s.nuevaOrganizacionConUsuarios();
    const a = await pendiente(o.oficina.cookie, "en curso a");
    const b = await pendiente(o.oficina.cookie, "en curso b");
    expect([a.statusCode, b.statusCode]).toEqual([202, 202]);
    const { rows: colas } = await s.propietario.pool.query("select queue_name from graphile_worker.jobs where key = $1", [`asistente.responder:${a.json().intercambioId}`]);
    expect(colas).toEqual([{ queue_name: `asistente:${o.organizacionId}` }]);

    const tercera = await pendiente(o.oficina.cookie, "en curso c");
    expect(tercera.statusCode).toBe(429);
    expect(tercera.json()).toMatchObject({ codigo: "demasiadas_solicitudes", detail: "Tiene dos respuestas en curso: espere a que termine una" });
    // Otra persona de la misma organización no se ve afectada.
    expect((await pendiente(await otraPersonaDeOficina(o.organizacionId), "de otra persona")).statusCode).toBe(202);

    // Una que nunca arrancó en 30 minutos venció: ya no cuenta, y queda en error.
    await s.propietario.pool.query("update asistente.intercambios set creado_en = now() - interval '31 minutes' where id = $1", [a.json().intercambioId]);
    expect((await pendiente(o.oficina.cookie, "en curso c")).statusCode).toBe(202);
    const { rows } = await s.propietario.pool.query("select estado from asistente.intercambios where id = $1", [a.json().intercambioId]);
    expect(rows[0].estado).toBe("error");
    await s.procesarCola();
  });

  it("detener lo que espera turno lo deja detenido de una vez; el worker ya no lo toma", async () => {
    const o = await s.nuevaOrganizacionConUsuarios();
    const r = await pendiente(o.oficina.cookie, "espera turno");
    expect((await pedir(o.oficina.cookie, "POST", `/api/asistente/intercambios/${r.json().intercambioId}/detener`)).statusCode).toBe(200);
    const { rows } = await s.propietario.pool.query("select estado, terminado_en from asistente.intercambios where id = $1", [r.json().intercambioId]);
    expect(rows[0].estado).toBe("detenida");
    expect(rows[0].terminado_en).not.toBeNull();
    await s.procesarCola();
    expect(guiones.get("espera turno")!.vueltas).toBe(0);
  });

  it("eliminar una conversación detiene sus respuestas en curso: la que espera, de una vez; la que ya arrancó, en la vuelta siguiente", async () => {
    const o = await s.nuevaOrganizacionConUsuarios();
    const r = await pendiente(o.oficina.cookie, "eliminada en espera");
    expect((await pedir(o.oficina.cookie, "POST", `/api/asistente/conversaciones/${r.json().conversacionId}/eliminar`)).statusCode).toBe(200);
    const { rows } = await s.propietario.pool.query("select estado from asistente.intercambios where id = $1", [r.json().intercambioId]);
    expect(rows[0].estado).toBe("detenida");
    await s.procesarCola();
    expect(guiones.get("eliminada en espera")!.vueltas).toBe(0);

    // Ya arrancó: eliminar desde el modelo, a mitad de la respuesta. La conversación borrada ya no se lee por la API.
    let conversacionId = "";
    guiones.set("eliminada respondiendo", {
      guion: async (_m, n) => {
        if (n === 1) expect((await pedir(o.oficina.cookie, "POST", `/api/asistente/conversaciones/${conversacionId}/eliminar`)).statusCode).toBe(200);
        return vuelta([{ nombre: "ciudades", entrada: {} }]);
      },
      vueltas: 0,
      mensajes: [],
    });
    const otra = await pedir(o.oficina.cookie, "POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId: null, texto: "eliminada respondiendo" });
    conversacionId = otra.json().conversacionId;
    await s.procesarCola();
    expect(guiones.get("eliminada respondiendo")!.vueltas).toBe(1);
    const { rows: despues } = await s.propietario.pool.query("select estado from asistente.intercambios where conversacion_id = $1", [conversacionId]);
    expect(despues).toEqual([{ estado: "detenida" }]);
  });

  it("el límite aguanta pedidos a la vez: con una en curso, de cinco simultáneos entra exactamente uno", async () => {
    const o = await s.nuevaOrganizacionConUsuarios();
    expect((await pendiente(o.oficina.cookie, "ya en curso")).statusCode).toBe(202);
    const respuestas = await Promise.all(Array.from({ length: 5 }, (_, i) => pendiente(o.oficina.cookie, `a la vez ${i}`)));
    const estados = respuestas.map((r) => r.statusCode).sort();
    expect(estados).toEqual([202, 429, 429, 429, 429]);
    for (const r of respuestas.filter((x) => x.statusCode === 429)) expect(r.json().codigo).toBe("demasiadas_solicitudes");
    await s.procesarCola();
  });

  it("a mitad de una respuesta, la base guarda solo lo visible; la purga cierra las vencidas aunque nadie las abra", async () => {
    let guardadoAMitad: unknown;
    await preguntar("a mitad", async (_m, n) => {
      if (n === 1) return vuelta([{ nombre: "sumar_materiales", entrada: { visitas: [] } }]);
      guardadoAMitad = (await s.propietario.pool.query("select pasos from asistente.intercambios where pregunta = 'a mitad'")).rows[0].pasos;
      return entregar({ tablas: [1], destacado: { paso: 1, cifras: ["total"] } });
    });
    expect(guardadoAMitad).toEqual([{ herramienta: "sumar_materiales", etiquetaEnCurso: "Sumando materiales", etiquetaHecha: "Sumó materiales", estado: "hecho", resumen: "1 material" }]);

    const o = await s.nuevaOrganizacionConUsuarios();
    const r = await pendiente(o.oficina.cookie, "sin dueño que vuelva");
    await s.propietario.pool.query("update asistente.intercambios set creado_en = now() - interval '31 minutes' where id = $1", [r.json().intercambioId]);
    await purgarConversacionesDelAsistente(s.conexionApp.bd);
    const { rows } = await s.propietario.pool.query("select estado, error from asistente.intercambios where id = $1", [r.json().intercambioId]);
    expect(rows[0]).toEqual({ estado: "error", error: "La respuesta se interrumpió. Vuelva a preguntar." });
    await s.procesarCola();
  });

  it("vence a los 5 minutos de arrancar, o a los 30 de creado si nunca arrancó; el bucle para si ya no está en curso", async () => {
    const o = await s.nuevaOrganizacionConUsuarios();
    const r = await pendiente(o.oficina.cookie, "vencerá");
    const { intercambioId, conversacionId } = r.json();
    const leer = async () => (await pedir(o.oficina.cookie, "GET", `/api/asistente/conversaciones/${conversacionId}`)).json().intercambios[0];
    // Diez minutos en la cola sin arrancar todavía no vence.
    await s.propietario.pool.query("update asistente.intercambios set creado_en = now() - interval '10 minutes' where id = $1", [intercambioId]);
    expect((await leer()).estado).toBe("en_curso");
    // Arrancó hace 6 minutos: venció.
    await s.propietario.pool.query("update asistente.intercambios set iniciado_en = now() - interval '6 minutes', pasos = $2::jsonb where id = $1", [
      intercambioId,
      JSON.stringify([{ herramienta: "ciudades", etiquetaEnCurso: "Buscando", etiquetaHecha: "Buscó", estado: "hecho", resumen: "3", resultado: { resumen: "3", datos: { secreto: 1 } } }]),
    ]);
    expect(await leer()).toMatchObject({ estado: "error", error: "La respuesta se interrumpió. Vuelva a preguntar." });
    const { rows } = await s.propietario.pool.query("select pasos from asistente.intercambios where id = $1", [intercambioId]);
    expect(rows[0].pasos).toEqual([{ herramienta: "ciudades", etiquetaEnCurso: "Buscando", etiquetaHecha: "Buscó", estado: "hecho", resumen: "3" }]);
    // El trabajo que llega tarde no lo toca.
    await s.procesarCola();
    expect(guiones.get("vencerá")!.vueltas).toBe(0);

    // Si se cierra por fuera mientras responde, el bucle para en la vuelta siguiente sin escribir nada.
    const { intercambio, guion } = await preguntar(
      "cerrada por fuera",
      async (_m, n) => {
        if (n === 1) await s.propietario.pool.query("update asistente.intercambios set estado = 'error', error = 'cerrada' where pregunta = 'cerrada por fuera'");
        return vuelta([{ nombre: "ciudades", entrada: {} }]);
      },
      { cookie: o.oficina.cookie },
    );
    expect(guion.vueltas).toBe(1);
    expect(intercambio).toMatchObject({ estado: "error", error: "cerrada" });
  });

  it("al terminar, los pasos guardan solo lo visible; el resultado completo no queda", async () => {
    const { intercambio } = await preguntar("sin rastro", (_m, n) => (n === 1 ? vuelta([{ nombre: "sumar_materiales", entrada: { visitas: [] } }]) : entregar({ tablas: [1] })));
    expect(intercambio.respuesta.tablas).toHaveLength(1);
    expect(intercambio.pasos[0].resultado).toBe("1 material");
    const { rows } = await s.propietario.pool.query("select pasos, iniciado_en from asistente.intercambios where id = $1", [intercambio.id]);
    expect(rows[0].iniciado_en).not.toBeNull();
    expect(rows[0].pasos).toEqual([{ herramienta: "sumar_materiales", etiquetaEnCurso: "Sumando materiales", etiquetaHecha: "Sumó materiales", estado: "hecho", resumen: "1 material" }]);
    expect(JSON.stringify(rows[0].pasos)).not.toMatch(/datos|incluidas/);
  });

  it("la purga borra las eliminadas hace más de un día y las inactivas de un año, con sus intercambios; el gasto del mes no baja", async () => {
    const o = await s.nuevaOrganizacionConUsuarios();
    const admin = await s.nuevoAdministrador(o.organizacionId);
    const conCosto = (texto: string) => preguntar(texto, () => ({ ...entregar(), uso: { entrada: 10_000, salida: 0, cacheLeida: 0, cacheEscrita: 0 } }), { cookie: o.oficina.cookie });
    const vieja = await conCosto("eliminada hace dos días");
    const reciente = await conCosto("eliminada hace una hora");
    const inactiva = await conCosto("inactiva hace 13 meses");
    const activa = await conCosto("activa");
    const gastoAntes = (await pedir(admin.cookie, "GET", "/api/asistente/uso")).json();
    expect(gastoAntes).toMatchObject({ gastoUsd: "0.004", preguntas: 4 });

    await s.propietario.pool.query("update asistente.conversaciones set eliminada_en = now() - interval '2 days' where id = $1", [vieja.conversacionId]);
    await s.propietario.pool.query("update asistente.conversaciones set eliminada_en = now() - interval '1 hour' where id = $1", [reciente.conversacionId]);
    await s.propietario.pool.query("update asistente.conversaciones set actualizada_en = now() - interval '13 months' where id = $1", [inactiva.conversacionId]);
    expect(await purgarConversacionesDelAsistente(s.conexionApp.bd)).toBeGreaterThanOrEqual(2);

    const { rows } = await s.propietario.pool.query("select c.id, (select count(*)::int from asistente.intercambios i where i.conversacion_id = c.id) as n from asistente.conversaciones c where c.organizacion_id = $1 order by c.creada_en", [o.organizacionId]);
    expect(rows).toEqual([
      { id: reciente.conversacionId, n: 1 },
      { id: activa.conversacionId, n: 1 },
    ]);
    const { rows: huerfanos } = await s.propietario.pool.query("select count(*)::int as n from asistente.intercambios where conversacion_id = any($1)", [[vieja.conversacionId, inactiva.conversacionId]]);
    expect(huerfanos[0].n).toBe(0);
    expect((await pedir(admin.cookie, "GET", "/api/asistente/uso")).json()).toEqual(gastoAntes);
  });
});

describe("el modelo de Anthropic por la SDK, sin salir a la red", () => {
  const mensaje = (extra: object = {}) => ({
    id: "msg_prueba",
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text: "Hola." }],
    stop_reason: "end_turn",
    stop_sequence: null,
    stop_details: null,
    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: 3 },
    ...extra,
  });
  function conRespuesta(estado: number, cuerpo: object) {
    const pedidos: Record<string, unknown>[] = [];
    const fetch = (async (_url: string, init: RequestInit) => {
      pedidos.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(cuerpo), { status: estado, headers: { "content-type": "application/json", "request-id": "req_prueba", "x-should-retry": "false" } });
    }) as unknown as typeof globalThis.fetch;
    return { modelo: modeloAnthropic({ llave: "sk-ant-prueba", modelo: "claude-haiku-5-5", fetch }), pedidos };
  }
  const pedido = {
    sistema: "Sistema",
    herramientas: [
      { nombre: "buscar", descripcion: "Busca", entrada: z.object({ texto: z.string(), n: z.int().nullable() }).strict() },
      { nombre: "filtrar", descripcion: "Filtra", estricta: false, entrada: z.object({ desde: z.string().optional().describe("AAAA-MM-DD") }).strict() },
    ],
    mensajes: [
      { tipo: "texto", rol: "user", texto: "¿Cuánto?" },
      { tipo: "turno", contenido: [{ type: "tool_use", id: "tu_1", name: "buscar", input: { texto: "x", n: null } }] },
      { tipo: "resultados", resultados: [{ id: "tu_1", contenido: "{}", esError: false }] },
    ] satisfies MensajeDelModelo[],
  };

  it("arma el pedido: herramientas estrictas, caché, esfuerzo medio y sin temperatura; lee el uso y el id de la solicitud", async () => {
    const { modelo, pedidos } = conRespuesta(200, mensaje());
    const vueltaReal = await modelo.responder(pedido);
    expect(vueltaReal).toMatchObject({ motivo: "end_turn", texto: "Hola.", llamadas: [], uso: { entrada: 10, salida: 5, cacheLeida: 2, cacheEscrita: 3 }, diagnostico: { solicitud: "req_prueba" } });
    const enviado = pedidos[0]!;
    expect(enviado).toMatchObject({
      model: "claude-haiku-5-5",
      max_tokens: 16000,
      tool_choice: { type: "auto" },
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      system: [{ type: "text", text: "Sistema", cache_control: { type: "ephemeral" } }],
    });
    expect(enviado).not.toHaveProperty("temperature");
    expect(enviado).not.toHaveProperty("thinking");
    const [estricta, libre] = enviado.tools as Record<string, unknown>[];
    expect(estricta).toMatchObject({ name: "buscar", strict: true, input_schema: { additionalProperties: false } });
    expect(libre).toEqual({ name: "filtrar", description: "Filtra", input_schema: { type: "object", properties: { desde: { type: "string", description: "AAAA-MM-DD" } }, additionalProperties: false } });
    expect(enviado.messages).toEqual([
      { role: "user", content: "¿Cuánto?" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu_1", name: "buscar", input: { texto: "x", n: null } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu_1", content: "{}", is_error: false }] },
    ]);
  });

  it("traduce los motivos de parada y los errores de la SDK a mensajes claros", async () => {
    expect((await conRespuesta(200, mensaje({ stop_reason: "model_context_window_exceeded" })).modelo.responder(pedido)).motivo).toBe("contexto");
    const rechazo = await conRespuesta(200, mensaje({ stop_reason: "refusal", stop_details: { type: "refusal", category: "cyber", explanation: null } })).modelo.responder(pedido);
    expect(rechazo).toMatchObject({ motivo: "refusal", diagnostico: { categoria: "cyber" } });

    const error = (tipo: string, extra: object = {}) => ({ type: "error", error: { type: tipo, message: "detalle que no sale", ...extra } });
    const falla = async (estado: number, cuerpo: object) => {
      try {
        await conRespuesta(estado, cuerpo).modelo.responder(pedido);
      } catch (e) {
        return e as ErrorDelModelo;
      }
      throw new Error("no falló");
    };
    const saturado = await falla(529, error("overloaded_error"));
    expect(saturado).toBeInstanceOf(ErrorDelModelo);
    expect(saturado).toMatchObject({ message: "El servicio está saturado: intente en unos minutos.", codigo: "api_529", solicitud: "req_prueba" });
    const sinGasto = await falla(429, error("rate_limit_error", { details: { error_code: "enforced_spend_limit_reached" } }));
    expect(sinGasto.message).toBe("Se alcanzó el límite de gasto de la cuenta del asistente: avise a administración.");
    expect((await falla(429, error("rate_limit_error"))).message).toMatch(/saturado/);
    expect((await falla(401, error("authentication_error"))).message).toMatch(/configurado/);
    expect(JSON.stringify([saturado, sinGasto])).not.toContain("detalle que no sale");
  });

  it("los esquemas de todas las herramientas son estrictos y caben en los límites de complejidad de la API", () => {
    const todas = [...crearHerramientasDelAsistente({ visitas: visitasReales, clientesYSitios, levantamientos: levantamientosReales, catalogo: catalogoReal, formatos: formatosReales }), definicionDeEntregar];
    // Solo las estrictas cuentan para los límites; las demás van con su esquema de Zod, cerrado igual.
    const estrictas = todas.filter((h) => h.estricta !== false);
    for (const h of todas.filter((x) => x.estricta === false)) {
      const normal = esquemaNormal(h.entrada) as Record<string, unknown>;
      expect(normal.additionalProperties, h.nombre).toBe(false);
      expect(normal, h.nombre).not.toHaveProperty("$schema");
      expect(JSON.stringify(normal), h.nombre).not.toContain("9007199254740991");
    }
    const esquemas = estrictas.map((h) => ({ nombre: h.nombre, esquema: esquemaEstricto(h.entrada) as Record<string, unknown> }));
    let opcionales = 0;
    let uniones = 0;
    const recorrer = (nodo: unknown, donde: string): void => {
      if (Array.isArray(nodo)) return nodo.forEach((n, i) => recorrer(n, `${donde}[${i}]`));
      if (!nodo || typeof nodo !== "object") return;
      const o = nodo as Record<string, unknown>;
      if (o.type === "object") {
        expect(o.additionalProperties, donde).toBe(false);
        const propiedades = (o.properties ?? {}) as Record<string, Record<string, unknown>>;
        const requeridas = new Set((o.required as string[] | undefined) ?? []);
        for (const [clave, p] of Object.entries(propiedades)) {
          if (!requeridas.has(clave)) opcionales++;
          if (p.anyOf || Array.isArray(p.type)) uniones++;
        }
      }
      for (const [clave, valor] of Object.entries(o)) recorrer(valor, `${donde}.${clave}`);
    };
    for (const { nombre, esquema } of esquemas) {
      recorrer(esquema, nombre);
      expect(JSON.stringify(esquema), nombre).not.toContain("9007199254740991");
    }
    // Límites de strict (Structured Outputs, «Schema complexity limits»): 20 herramientas, 24 opcionales y 16 uniones en total,
    // contando solo las estrictas. Se exige margen para que la próxima herramienta avise antes de llegar al borde.
    expect(esquemas.length).toBeLessThanOrEqual(15);
    expect(opcionales).toBeLessThanOrEqual(18);
    expect(uniones).toBeLessThanOrEqual(12);
  });
});

describe("costo", () => {
  it("entrada, salida y caché por modelo, en decimal exacto", () => {
    // 1M de entrada a 0,10; 1M de salida a 0,50; 1M de caché escrita a 0,125; 1M de caché leída a 0,01. Un pedido de más
    // de 100 000 de entrada cobra todo a 0,50 y 2,50.
    expect(costoDe("claude-haiku-5-5", { entrada: 50_000, salida: 10_000, cacheLeida: 40_000, cacheEscrita: 8_000 })).toBe("0.0114");
    expect(costoDe("claude-haiku-5-5", { entrada: 1_000_000, salida: 1_000_000, cacheLeida: 0, cacheEscrita: 0 })).toBe("3");
    expect(costoDe("claude-haiku-5-5", { entrada: 100_000, salida: 0, cacheLeida: 0, cacheEscrita: 0 })).toBe("0.01");
    expect(costoDe("claude-sonnet-5-5", { entrada: 1_000_000, salida: 1_000_000, cacheLeida: 1_000_000, cacheEscrita: 1_000_000 })).toBe("14.6");
    expect(costoDe("claude-opus-5-5", { entrada: 1, salida: 1, cacheLeida: 0, cacheEscrita: 0 })).toBe("0.000024");
    expect(() => costoDe("otro-modelo", { entrada: 1, salida: 0, cacheLeida: 0, cacheEscrita: 0 })).toThrow();
  });
});

describe("modelo simulado", () => {
  it("con la señal ya cortada, falla como el modelo real: por tiempo, no con una excepción cualquiera", async () => {
    const error = await modeloSimulado()
      .responder({ sistema: "", herramientas: [], mensajes: [{ tipo: "texto", rol: "user", texto: "cable" }], senal: AbortSignal.abort() })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDelModelo);
    expect(error).toMatchObject({ message: "La respuesta tardó demasiado. Vuelva a preguntar.", codigo: "tiempo_agotado" });
  });

  it("sin «tolima», «cable» busca las visitas del último año sin pedir las ciudades", async () => {
    const { intercambio } = await preguntar("[simulado] ¿Cuánto cable se gastó en los últimos 12 meses?", () => entregar());
    expect(intercambio.pasos.map((p: { herramienta: string }) => p.herramienta)).toEqual(["buscar_en_catalogo", "sumar_materiales"]);
    expect(intercambio.respuesta.tablas).toHaveLength(1);
  });

  it("«cable» encadena las herramientas reales por nombre y termina con entregar_respuesta", async () => {
    const { intercambio } = await preguntar("[simulado] ¿Cuánto cable se gastó en el Tolima?", () => entregar());
    expect(intercambio.estado, intercambio.error).toBe("lista");
    expect(intercambio.pasos.map((p: { herramienta: string }) => p.herramienta)).toEqual(["buscar_en_catalogo", "ciudades", "sumar_materiales"]);
    expect(intercambio.respuesta.destacado.cifras[0]).toEqual({ valor: "4485", unidad: "m" });
    expect(intercambio.respuesta.tablas).toHaveLength(1);
    expect(intercambio.respuesta.fuentes).not.toBeNull();
  });

  it("si falta una herramienta lo dice sin romperse; lo que no conoce no lo responde", async () => {
    const presupuesto = await preguntar("[simulado] ¿Cuánto presupuestar para 40 puntos?", () => entregar());
    expect(presupuesto.intercambio.estado, JSON.stringify(presupuesto.intercambio)).toBe("lista");
    expect(presupuesto.intercambio.respuesta.texto).toMatch(/No encontré/);
    for (const pregunta of ["[simulado] ¿Cuántas visitas hubo cada mes este año?", "[simulado] Resuma el último levantamiento revisado"]) {
      const r = await preguntar(pregunta, () => entregar());
      expect(r.intercambio.estado, pregunta).toBe("lista");
      expect(r.intercambio.respuesta.texto, pregunta).toMatch(/No encontré/);
    }
    const otra = await preguntar("[simulado] ¿Qué día es hoy?", () => entregar());
    expect(otra.intercambio.respuesta.texto).toBe("No puedo responder eso con los datos del sistema.");
  });
});

// Un servidor aparte con un límite de tiempo muy corto y un modelo lento. Comparte la cola con el de arriba: sus pruebas
// corren en orden, así que cada una procesa solo lo que encoló.
const lento: ModeloAsistente = {
  nombre: "claude-haiku-5-5",
  async responder() {
    await espera(400);
    return vuelta([{ nombre: "ciudades", entrada: {} }]);
  },
};
const conPrisa = await servidorDePrueba({ config: { ASISTENTE_ACTIVO: "true" }, asistente: { modelo: lento, herramientas: [], limites: { duracionMs: 200 } } });

describe("límite de tiempo", () => {
  it("una respuesta que pasa el límite termina en error con el mensaje de tiempo; nada queda en curso", async () => {
    const o = await conPrisa.nuevaOrganizacionConUsuarios();
    const enviar = (method: "GET" | "POST", url: string, payload?: object) =>
      conPrisa.app.inject({ method, url, headers: { cookie: o.oficina.cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });
    const r = await enviar("POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId: null, texto: "lenta" });
    expect(r.statusCode).toBe(202);
    await conPrisa.procesarCola();
    const intercambio = (await enviar("GET", `/api/asistente/conversaciones/${r.json().conversacionId}`)).json().intercambios[0];
    expect(intercambio).toMatchObject({ estado: "error", respuesta: null });
    expect(intercambio.error).toMatch(/tardó demasiado/);
    const { rows } = await conPrisa.propietario.pool.query("select count(*)::int as n from asistente.intercambios where organizacion_id = $1 and estado = 'en_curso'", [o.organizacionId]);
    expect(rows[0].n).toBe(0);
  });
});

// De punta a punta: los datos de ejemplo, el modelo simulado y las herramientas reales, por la API.
const { app: conexionDeHerramientas } = conexionesDePrueba();
const formatosReales = crearFormatos();
const visitasReales = crearVisitas(clientesYSitios, formatosReales);
const sinNombres = { nombres: async () => new Map<string, string>(), buscarPorNombre: async () => [] };
const catalogoReal = crearCatalogo(conexionDeHerramientas.bd, sinNombres);
const levantamientosReales = crearLevantamientos({ bd: conexionDeHerramientas.bd, formatos: formatosReales, archivos: {} as Archivos, visitas: visitasReales, identidad: sinNombres, catalogo: catalogoReal });
const conDatos = await servidorDePrueba({
  config: { ASISTENTE_ACTIVO: "true" },
  asistente: {
    modelo: modeloSimulado(),
    herramientas: crearHerramientasDelAsistente({ visitas: visitasReales, clientesYSitios, levantamientos: levantamientosReales, catalogo: catalogoReal, formatos: formatosReales }),
  },
});

const sembrada = await conDatos.nuevaOrganizacionConUsuarios();
await enOrganizacion(conDatos.conexionApp.bd, sembrada.organizacionId, (tx) => formatosReales.publicar(tx, sembrada.organizacionId, formatoDePrueba(10)));
await sembrarDatosDelAsistente(conDatos.conexionApp.bd, sembrada.organizacionId, { tecnicoId: sembrada.tecnico.id, revisorId: sembrada.oficina.id });

describe("de punta a punta con los datos de ejemplo y las herramientas reales", () => {
  const o = sembrada;
  async function preguntarA(texto: string) {
    const enviar = (method: "GET" | "POST", url: string, payload?: object) =>
      conDatos.app.inject({ method, url, headers: { cookie: o.oficina.cookie, origin: ORIGEN }, ...(payload ? { payload } : {}) });
    const r = await enviar("POST", "/api/asistente/preguntas", { llave: randomUUID(), conversacionId: null, texto });
    expect(r.statusCode, r.body).toBe(202);
    await conDatos.procesarCola();
    const intercambio = (await enviar("GET", `/api/asistente/conversaciones/${r.json().conversacionId}`)).json().intercambios[0];
    expect(intercambio.estado, JSON.stringify(intercambio)).toBe("lista");
    return intercambio;
  }

  it("«¿Cuánto cable se gastó en los últimos 12 meses?»: la tabla con el UTP, las fuentes y el destacado", async () => {
    const i = await preguntarA("¿Cuánto cable se gastó en los últimos 12 meses?");
    expect(i.pasos.map((p: { herramienta: string }) => p.herramienta)).toEqual(["buscar_en_catalogo", "sumar_materiales"]);
    const [tabla] = i.respuesta.tablas;
    expect(tabla.filas[0].map((c: { texto: string }) => c.texto)).toEqual(["Cable UTP categoría 6", "4.485 m", "5"]);
    expect(i.respuesta.destacado).toEqual({ cifras: [{ valor: "4.485", unidad: "m" }], descripcion: "Cable UTP categoría 6 en 5 visitas" });
    const fuentes: { cliente: string; fecha: string; revisado: boolean; levantamientoId: string | null }[] = i.respuesta.fuentes.visitas;
    expect(fuentes.filter((f) => f.revisado)).toHaveLength(5);
    // La sexta visita de cableado tiene levantamiento sin revisar: queda fuera de la suma.
    const sinRevisar = fuentes.filter((f) => !f.revisado && f.levantamientoId !== null);
    expect(sinRevisar.map((f) => f.cliente)).toEqual(["Hotel Mirador del Combeima"]);
  });

  it("«¿Cuánto UTP presupuesto para un cableado de 40 puntos?»: el destacado con los metros y el costo", async () => {
    const i = await preguntarA("¿Cuánto UTP presupuesto para un cableado de 40 puntos?");
    expect(i.pasos.at(-1).herramienta).toBe("estimar_materiales");
    const [metros, costo] = i.respuesta.destacado.cifras;
    expect(metros).toEqual({ valor: "1.215", unidad: "m" });
    // Sin depender del espacio después del signo.
    expect(costo.valor.replace(/\s/g, "")).toContain("3.523.500");
    expect(i.respuesta.texto).toMatch(/orientativo/);
  });

  it("«¿Cuántas visitas hubo cada mes este año?»: la serie por mes", async () => {
    const i = await preguntarA("¿Cuántas visitas hubo cada mes este año?");
    expect(i.pasos.map((p: { herramienta: string }) => p.herramienta)).toEqual(["contar_visitas"]);
    const puntos: { valor: number }[] = i.respuesta.serie.puntos;
    expect(puntos.length).toBeGreaterThan(1);
    expect(puntos.reduce((t, p) => t + p.valor, 0)).toBe(47);
  });

  it("«Resuma el último levantamiento revisado»: el contenido, sin firmas ni fotos", async () => {
    const i = await preguntarA("Resuma el último levantamiento revisado");
    expect(i.pasos.map((p: { herramienta: string }) => p.herramienta)).toEqual(["buscar_visitas", "leer_levantamiento"]);
    expect(i.respuesta.fuentes.visitas).toHaveLength(1);
    expect(i.respuesta.tablas[0].filas.length).toBeGreaterThan(0);
    const { rows } = await conDatos.propietario.pool.query("select pasos, respuesta from asistente.intercambios where id = $1", [i.id]);
    const guardado = JSON.stringify(rows[0]);
    for (const prohibido of [/firma/i, /foto/i, /data:image/, /"lat"/, /@/]) expect(guardado).not.toMatch(prohibido);
  });
});
