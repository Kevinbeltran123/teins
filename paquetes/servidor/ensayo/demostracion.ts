import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { chromium, type Page } from "playwright-core";
import {
  campoVisible,
  llenarDeclaracion,
  seccionVisible,
  serializarBoceto,
  TIPO_ARCHIVO_BOCETO,
  validarRespuestas,
  type DefinicionCampo,
  type DocumentoBoceto,
  type ElementoBoceto,
  type Valor,
  type VersionFormato,
} from "@teins/dominio";
import { crearClienteApi, ErrorApi, llaveDeEnvio, type ClienteApi, type CuerpoEntrada } from "@teins/protocolo";

/*
  Datos de demostración (iteración 53, entrega a TEINS): llena una organización con clientes, visitas, levantamientos,
  revisiones, informes y cotizaciones inventados (R5), todo por el contrato de `@teins/protocolo`, como lo harían un
  técnico desde campo y una persona de oficina. No crea organizaciones ni usuarios: usa dos que ya existen.

  Nada sale hacia nadie: los contactos no reciben por ningún canal, no tienen acceso al portal, y los informes y las
  cotizaciones se publican sin destinatarios.

  Se puede repetir: reconoce lo suyo por el nombre del cliente, del sitio y del contacto, por la referencia de cada visita
  y por el id del levantamiento, que se deriva de la visita. Una corrida que siga a un fallo termina lo que faltó.

    DEMO_TECNICO=... DEMO_TECNICO_CONTRASENA=... DEMO_OFICINA=... DEMO_OFICINA_CONTRASENA=... pnpm demostracion
  Contra un entorno desplegado: DEMO_CAMPO_URL y DEMO_OFICINA_URL. Con segundo factor, DEMO_OFICINA_CODIGO (o lo pide
  en la terminal). Las sesiones se guardan fuera del repositorio: el inicio de sesión tiene límite por minuto.
*/

function salirCon(mensaje: string): never {
  console.error(mensaje);
  process.exit(2);
}
const requerida = (nombre: string) => process.env[nombre]?.trim() || salirCon(`Falta ${nombre}`);

const CREDENCIALES = {
  tecnico: { usuario: requerida("DEMO_TECNICO"), contrasena: requerida("DEMO_TECNICO_CONTRASENA"), codigo: process.env.DEMO_TECNICO_CODIGO?.trim() },
  oficina: { usuario: requerida("DEMO_OFICINA"), contrasena: requerida("DEMO_OFICINA_CONTRASENA"), codigo: process.env.DEMO_OFICINA_CODIGO?.trim() },
};
type Rol = keyof typeof CREDENCIALES;

const REMOTO = Boolean(process.env.DEMO_CAMPO_URL);
if (REMOTO !== Boolean(process.env.DEMO_OFICINA_URL)) salirCon("DEMO_CAMPO_URL y DEMO_OFICINA_URL van juntas");
const SUPERFICIES: Record<Rol, { base: string; origen: string }> = REMOTO
  ? { tecnico: { base: process.env.DEMO_CAMPO_URL!, origen: process.env.DEMO_CAMPO_URL! }, oficina: { base: process.env.DEMO_OFICINA_URL!, origen: process.env.DEMO_OFICINA_URL! } }
  : { tecnico: { base: "http://localhost:3000", origen: "http://localhost:5173" }, oficina: { base: "http://localhost:3000", origen: "http://localhost:5174" } };
/** La versión de campo que declara al bajar (paquetes/campo/src/version.ts): los formatos v2 piden la 17. */
const VERSION_APP = 17;

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));

// Resumen ------------------------------------------------------------------------------------------

const cuenta = new Map<string, { creados: number; existian: number }>();
function contar(que: string, creado: boolean) {
  const c = cuenta.get(que) ?? { creados: 0, existian: 0 };
  if (creado) c.creados++;
  else c.existian++;
  cuenta.set(que, c);
}
const errores: string[] = [];
const avisos: string[] = [];
const describirError = (error: unknown) =>
  error instanceof ErrorApi ? `${error.codigo}: ${error.message}${error.problema.errores ? ` ${JSON.stringify(error.problema.errores)}` : ""}` : error instanceof Error ? error.message : String(error);
async function intentar<T>(que: string, accion: () => Promise<T>): Promise<T | undefined> {
  try {
    return await accion();
  } catch (error) {
    errores.push(`${que}: ${describirError(error)}`);
    return undefined;
  }
}

// Sesiones (como el ensayo de carga) ---------------------------------------------------------------

interface Persona {
  id: string;
  nombre: string;
  administra: boolean;
  organizacion: string;
  api: ClienteApi;
}

function fetchConCookies(origen: string, cookies: Map<string, string>): typeof fetch {
  return async (url, init) => {
    const cabeceras = new Headers(init?.headers);
    cabeceras.set("origin", origen);
    if (cookies.size > 0) cabeceras.set("cookie", [...cookies].map(([nombre, valor]) => `${nombre}=${valor}`).join("; "));
    const respuesta = await fetch(url, { ...init, headers: cabeceras });
    for (const cookie of respuesta.headers.getSetCookie()) {
      const [par = ""] = cookie.split(";");
      const nombre = par.slice(0, par.indexOf("=")).trim();
      const valor = par.slice(par.indexOf("=") + 1);
      if (/max-age=0/i.test(cookie) || valor === "") cookies.delete(nombre);
      else cookies.set(nombre, valor);
    }
    return respuesta;
  };
}

// Las sesiones valen como contraseñas: en la carpeta del usuario, nunca en un /tmp compartido.
const CARPETA = join(homedir(), ".cache", "teins-demostracion");
const ARCHIVO_DE_SESIONES = join(CARPETA, `sesiones-${createHash("sha256").update(JSON.stringify(SUPERFICIES)).digest("hex").slice(0, 12)}.json`);
function leerSesiones(): Record<string, Record<string, string>> {
  try {
    return JSON.parse(readFileSync(ARCHIVO_DE_SESIONES, "utf8"));
  } catch {
    return {};
  }
}

async function codigoDeSegundoFactor(rol: Rol, usuario: string): Promise<string> {
  const dado = CREDENCIALES[rol].codigo;
  if (dado) return dado;
  const variable = rol === "tecnico" ? "DEMO_TECNICO_CODIGO" : "DEMO_OFICINA_CODIGO";
  if (!process.stdin.isTTY) salirCon(`${usuario} tiene segundo factor: pase ${variable} con el código de 6 dígitos de su app autenticadora (o uno de respaldo)`);
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await terminal.question(`Código del segundo factor de ${usuario}: `)).trim();
  } finally {
    terminal.close();
  }
}

async function conSesion(rol: Rol, guardadas: Record<string, Record<string, string>>, guardar: (usuario: string, cookies: Map<string, string>) => void): Promise<Persona> {
  const { usuario, contrasena } = CREDENCIALES[rol];
  const cookies = new Map(Object.entries(guardadas[usuario] ?? {}));
  const { base, origen } = SUPERFICIES[rol];
  const api = crearClienteApi({ base, fetch: fetchConCookies(origen, cookies) });
  for (;;) {
    try {
      const sesion = await api.llamar("obtenerSesion");
      const u = sesion.usuario;
      if (u.rol !== rol) salirCon(`${usuario} es de ${u.rol === "tecnico" ? "campo" : "oficina"}: ${rol === "tecnico" ? "DEMO_TECNICO" : "DEMO_OFICINA"} debe ser ${rol === "tecnico" ? "un técnico" : "una persona de oficina"}`);
      if (u.debeCambiarContrasena) salirCon(`${usuario} tiene una contraseña temporal: entre una vez a la app, cree su contraseña y vuelva a correr esto con la nueva`);
      guardar(usuario, cookies);
      return { id: u.id, nombre: u.nombre, administra: u.administrador && u.segundoFactor, organizacion: sesion.organizacion.nombre, api };
    } catch (error) {
      if (!(error instanceof ErrorApi) || error.codigo !== "no_autenticado") throw error;
    }
    try {
      const { pideCodigo } = await api.iniciarSesion(usuario, contrasena);
      if (pideCodigo) await api.verificarSegundoFactor(await codigoDeSegundoFactor(rol, usuario));
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") {
        console.log("  Límite de inicios de sesión (5 por minuto, QA-7): espero un minuto.");
        await esperar(61_000);
      } else if (error instanceof ErrorApi && (error.problema.status === 401 || error.problema.status === 403)) {
        salirCon(`${usuario} no entra (${error.message}): revise el usuario, la contraseña y, si lo tiene, el código del segundo factor`);
      } else throw error;
    }
  }
}

// Ids estables -------------------------------------------------------------------------------------

const huellaDe = (texto: string) => createHash("sha256").update(texto).digest("hex");
/** Un UUID v4 que sale siempre igual del mismo texto: así una corrida reconoce el levantamiento de la anterior. */
function uuidEstable(texto: string): string {
  const h = huellaDe(texto);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((Number.parseInt(h[16]!, 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
/** Id corto de una línea de cantidades: ocho caracteres en minúsculas y dígitos. */
const idCorto = (texto: string) => BigInt(`0x${huellaDe(texto).slice(0, 16)}`).toString(36).padStart(8, "0").slice(-8);

/** Azar con semilla: los mismos valores en cada corrida para la misma visita. */
function azarDe(semilla: string) {
  let a = Number.parseInt(huellaDe(semilla).slice(0, 8), 16);
  const siguiente = () => {
    // mulberry32: la suma va en 32 bits sin signo, como en el original.
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    entre: (min: number, max: number) => min + siguiente() * (max - min),
    entero: (min: number, max: number) => Math.floor(min + siguiente() * (max - min + 1)),
    uno: <T>(lista: readonly T[]): T => lista[Math.floor(siguiente() * lista.length)]!,
    prob: (p: number) => siguiente() < p,
  };
}
type Azar = ReturnType<typeof azarDe>;

/** Decimal canónico (punto, sin ceros de más): lo que acepta una medida o una cantidad. */
function decimal(n: number, decimales = 1): string {
  const s = n.toFixed(decimales);
  return s.includes(".") ? s.replace(/(?<!0)0+$/, "").replace(/\.$/, "") : s;
}

// Datos inventados ---------------------------------------------------------------------------------

/** Precios en pesos sin IVA, inventados pero del orden de los del mercado. */
const CATALOGO = [
  { codigo: "UTP-C6", descripcion: "Cable UTP categoría 6, 4 pares, LSZH", unidad: "m", precio: 2_950 },
  { codigo: "FO-OM3-6", descripcion: "Fibra óptica multimodo OM3 de 6 hilos, interior y exterior", unidad: "m", precio: 7_400 },
  { codigo: "CAN-60X40", descripcion: "Canaleta plástica 60x40 mm con división", unidad: "m", precio: 13_800 },
  { codigo: "TUB-PVC34", descripcion: "Tubería PVC conduit de 3/4 pulgada", unidad: "m", precio: 3_600 },
  { codigo: "PTO-RED", descripcion: "Punto de red categoría 6 instalado y certificado", unidad: "und", precio: 78_000 },
  { codigo: "JCK-C6", descripcion: "Jack RJ45 categoría 6", unidad: "und", precio: 11_900 },
  { codigo: "PP-24C6", descripcion: "Patch panel de 24 puertos categoría 6", unidad: "und", precio: 238_000 },
  { codigo: "PC-C6-15", descripcion: "Patch cord categoría 6 de 1,5 m", unidad: "und", precio: 8_700 },
  { codigo: "BAT-12V9", descripcion: "Batería sellada 12 V 9 Ah", unidad: "und", precio: 98_000 },
  { codigo: "CAB-3X12", descripcion: "Cable encauchetado 3x12 AWG", unidad: "m", precio: 9_800 },
  { codigo: "BRK-1X20", descripcion: "Breaker 1x20 A", unidad: "und", precio: 21_900 },
] as const;
type CodigoCatalogo = (typeof CATALOGO)[number]["codigo"];
/** Lo que no está en el catálogo y oficina cotiza a mano. */
const PRECIOS_LIBRES: Record<string, number> = { "Soporte en L galvanizado para canaleta": 4_500, "Marquillas de identificación (rollo)": 32_000, "Organizador horizontal de 2U": 46_000 };

type Ciudad = "Ibagué" | "Espinal" | "Melgar";
/** Cerca del centro de cada ciudad: la foto de llegada sale con una ubicación creíble. */
const CENTROS: Record<Ciudad, { lat: number; lon: number }> = {
  Ibagué: { lat: 4.4389, lon: -75.2322 },
  Espinal: { lat: 4.1492, lon: -74.8843 },
  Melgar: { lat: 4.204, lon: -74.6407 },
};

interface SitioDemo {
  clave: string;
  nombre: string;
  direccion: string;
  ciudad: Ciudad;
  /** Dónde queda, respecto del centro de la ciudad, en milésimas de grado. */
  corrimiento: [number, number];
}
interface ContactoDemo {
  nombre: string;
  cargo: string;
  correo: string;
  celular: string;
}
interface ClienteDemo {
  nombre: string;
  nit: string;
  sitios: SitioDemo[];
  contactos: ContactoDemo[];
  /** Quien recibe la visita y firma la constancia, además del contacto principal. */
  firman: { nombre: string; cargo: string }[];
}

/** Nombres del manual (e2e/capturas/comun.ts) y otros del mismo estilo; correos solo de example.com, celulares 300 555 01xx. */
const CLIENTES = {
  clinica: {
    nombre: "Clínica Santa Lucía del Tolima",
    nit: "900.481.276-3",
    sitios: [
      { clave: "principal", nombre: "Sede principal", direccion: "Calle 37 # 5-24", ciudad: "Ibagué", corrimiento: [4, 6] },
      { clave: "norte", nombre: "Sede norte", direccion: "Carrera 5 # 60-15", ciudad: "Ibagué", corrimiento: [14, 9] },
    ],
    contactos: [
      { nombre: "Laura Gómez Arango", cargo: "Jefe de mantenimiento", correo: "laura.gomez@example.com", celular: "+573005550101" },
      { nombre: "Hernán Darío Lozano", cargo: "Director administrativo", correo: "hernan.lozano@example.com", celular: "+573005550102" },
    ],
    firman: [{ nombre: "Wilson Ferney Cruz", cargo: "Técnico de mantenimiento" }],
  },
  colegio: {
    nombre: "Colegio Bilingüe Los Ocobos",
    nit: "890.702.115-9",
    sitios: [{ clave: "campestre", nombre: "Sede campestre", direccion: "Vereda Llanitos, km 5 vía Rovira", ciudad: "Ibagué", corrimiento: [-12, -21] }],
    contactos: [{ nombre: "Diana Marcela Ortiz", cargo: "Administradora", correo: "diana.ortiz@example.com", celular: "+573005550103" }],
    firman: [{ nombre: "Jhon Fredy Sanabria", cargo: "Auxiliar de sistemas" }],
  },
  hotel: {
    nombre: "Hotel Mirador del Combeima",
    nit: "900.917.364-1",
    sitios: [{ clave: "principal", nombre: "Edificio principal", direccion: "Carrera 4 # 12-60", ciudad: "Ibagué", corrimiento: [-2, -3] }],
    contactos: [{ nombre: "Óscar Mauricio Téllez", cargo: "Jefe de operaciones", correo: "oscar.tellez@example.com", celular: "+573005550104" }],
    firman: [{ nombre: "Yuli Andrea Prada", cargo: "Recepción" }],
  },
  bodegas: {
    nombre: "Bodegas El Totumo S.A.S.",
    nit: "901.233.518-0",
    sitios: [{ clave: "distribucion", nombre: "Centro de distribución", direccion: "Km 2 vía Espinal-Ibagué, bodega 7", ciudad: "Espinal", corrimiento: [8, -10] }],
    contactos: [{ nombre: "Jorge Iván Peña", cargo: "Coordinador de planta", correo: "jorge.pena@example.com", celular: "+573005550105" }],
    firman: [{ nombre: "Edinson Barrios Lugo", cargo: "Supervisor de bodega" }],
  },
  ferretera: {
    nombre: "Distribuidora Ferretera El Tamarindo",
    nit: "900.655.902-7",
    sitios: [
      { clave: "centro", nombre: "Almacén centro", direccion: "Calle 15 # 3-41", ciudad: "Ibagué", corrimiento: [1, 2] },
      { clave: "salado", nombre: "Bodega El Salado", direccion: "Carrera 14 # 145-30", ciudad: "Ibagué", corrimiento: [33, 21] },
    ],
    contactos: [
      { nombre: "Ricardo Andrés Bonilla", cargo: "Gerente", correo: "ricardo.bonilla@example.com", celular: "+573005550106" },
      { nombre: "Compras", cargo: "Área de compras", correo: "compras.tamarindo@example.com", celular: "+573005550107" },
    ],
    firman: [{ nombre: "Luz Dary Montealegre", cargo: "Jefe de almacén" }],
  },
  torre: {
    nombre: "Edificio Empresarial Torre Pijao",
    nit: "901.118.447-2",
    sitios: [{ clave: "torre", nombre: "Torre principal", direccion: "Carrera 5 # 41-16", ciudad: "Ibagué", corrimiento: [7, 5] }],
    contactos: [{ nombre: "Natalia Cifuentes Rojas", cargo: "Administradora de la copropiedad", correo: "natalia.cifuentes@example.com", celular: "+573005550108" }],
    firman: [{ nombre: "Arley Mendoza Ríos", cargo: "Jefe de seguridad" }],
  },
  arrocera: {
    nombre: "Arrocera Los Guaduales S.A.S.",
    nit: "900.739.260-5",
    sitios: [{ clave: "planta", nombre: "Planta de secado", direccion: "Km 4 vía Espinal-Guamo", ciudad: "Espinal", corrimiento: [-18, 12] }],
    contactos: [{ nombre: "Fabián Ernesto Lozada", cargo: "Jefe de planta", correo: "fabian.lozada@example.com", celular: "+573005550109" }],
    firman: [{ nombre: "Nelson Javier Ospina", cargo: "Electricista de planta" }],
  },
  vacacional: {
    nombre: "Centro Vacacional Los Cámbulos",
    nit: "890.704.381-6",
    sitios: [{ clave: "melgar", nombre: "Sede Melgar", direccion: "Calle 7 # 24-50", ciudad: "Melgar", corrimiento: [3, -6] }],
    contactos: [{ nombre: "Martha Lucía Barragán", cargo: "Coordinadora administrativa", correo: "martha.barragan@example.com", celular: "+573005550110" }],
    firman: [{ nombre: "Camilo Andrés Vera", cargo: "Mantenimiento" }],
  },
} satisfies Record<string, ClienteDemo>;
type ClaveCliente = keyof typeof CLIENTES;

type TipoUps = "Preventivo" | "Correctivo" | "Cambio de baterías" | "Instalación";
interface Ups {
  tipo: TipoUps;
  clasificacion: "Contrato" | "Garantía" | "Facturar" | "Cotizar";
  kva: number;
  marca: string;
  modelo: string;
  baterias: { marca: string; referencia: string; cantidad: number; bancos: number; ah: number };
  causas?: string[];
}
type Sistema = "Red de datos" | "CCTV" | "Red de energía";
interface Visita {
  sistema: Sistema;
  /** Puntos de red, cámaras o tomas. */
  puntos: number;
  /** Metros de cable por punto. */
  metrosPorPunto: [number, number];
  fibra?: number;
  rackNuevo?: boolean;
  solucionado?: "Totalmente" | "Parcialmente";
  area: string;
}
interface VisitaDemo {
  referencia: string;
  cliente: ClaveCliente;
  sitio: string;
  formato: "servicio-ups" | "visita-tecnica";
  dias: number;
  hora: [string, string];
  revisar?: boolean;
  informe?: boolean;
  cotizar?: boolean;
  ups?: Ups;
  visita?: Visita;
}

const BAT_CSB = { marca: "CSB", referencia: "HR1290W", ah: 9 };
const BAT_RITAR = { marca: "Ritar", referencia: "RT1290", ah: 9 };
const BAT_YUASA = { marca: "Yuasa", referencia: "NP7-12", ah: 7 };

/**
 * Las visitas, de la más antigua a la más reciente. Las de días negativos ya pasaron y llevan levantamiento; las otras
 * quedan programadas. La referencia (el «Ticket No.» del cliente) es la marca con que la siguiente corrida las reconoce.
 */
const VISITAS: VisitaDemo[] = [
  { referencia: "TK-4812", cliente: "clinica", sitio: "principal", formato: "servicio-ups", dias: -148, hora: ["08:00", "10:30"], revisar: true, informe: true, ups: { tipo: "Preventivo", clasificacion: "Contrato", kva: 10, marca: "APC", modelo: "Smart-UPS SRT 10000", baterias: { ...BAT_CSB, cantidad: 16, bancos: 1 } } },
  { referencia: "TK-4826", cliente: "ferretera", sitio: "centro", formato: "visita-tecnica", dias: -141, hora: ["14:00", "17:30"], revisar: true, informe: true, visita: { sistema: "Red de datos", puntos: 12, metrosPorPunto: [26, 38], rackNuevo: true, area: "área de ventas y caja" } },
  { referencia: "TK-4839", cliente: "hotel", sitio: "principal", formato: "servicio-ups", dias: -133, hora: ["09:00", "11:00"], revisar: true, ups: { tipo: "Preventivo", clasificacion: "Contrato", kva: 6, marca: "Eaton", modelo: "9SX 6000i", baterias: { ...BAT_RITAR, cantidad: 20, bancos: 1 } } },
  { referencia: "TK-4851", cliente: "colegio", sitio: "campestre", formato: "visita-tecnica", dias: -125, hora: ["07:30", "12:00"], revisar: true, informe: true, cotizar: true, visita: { sistema: "Red de datos", puntos: 18, metrosPorPunto: [34, 52], fibra: 95, rackNuevo: true, area: "bloque de aulas y sala de sistemas" } },
  { referencia: "TK-4867", cliente: "bodegas", sitio: "distribucion", formato: "servicio-ups", dias: -117, hora: ["10:00", "12:30"], revisar: true, ups: { tipo: "Cambio de baterías", clasificacion: "Facturar", kva: 3, marca: "Vertiv", modelo: "Liebert GXT5-3000", baterias: { ...BAT_YUASA, cantidad: 6, bancos: 1 } } },
  { referencia: "TK-4873", cliente: "torre", sitio: "torre", formato: "visita-tecnica", dias: -108, hora: ["08:00", "16:00"], revisar: true, informe: true, cotizar: true, visita: { sistema: "Red de datos", puntos: 24, metrosPorPunto: [30, 44], fibra: 120, rackNuevo: true, area: "pisos 3 y 4" } },
  { referencia: "TK-4888", cliente: "clinica", sitio: "norte", formato: "servicio-ups", dias: -99, hora: ["13:30", "16:30"], revisar: true, informe: true, ups: { tipo: "Correctivo", clasificacion: "Garantía", kva: 6, marca: "APC", modelo: "Smart-UPS SRT 6000", baterias: { ...BAT_CSB, cantidad: 16, bancos: 1 }, causas: ["Baterías", "Ventiladores"] } },
  { referencia: "TK-4894", cliente: "bodegas", sitio: "distribucion", formato: "visita-tecnica", dias: -92, hora: ["08:30", "13:00"], revisar: true, visita: { sistema: "Red de datos", puntos: 10, metrosPorPunto: [40, 65], fibra: 80, area: "oficinas de despacho" } },
  { referencia: "TK-4907", cliente: "vacacional", sitio: "melgar", formato: "visita-tecnica", dias: -84, hora: ["09:00", "14:00"], revisar: true, informe: true, visita: { sistema: "Red de energía", puntos: 8, metrosPorPunto: [12, 22], area: "recepción y oficina administrativa" } },
  { referencia: "TK-4915", cliente: "arrocera", sitio: "planta", formato: "servicio-ups", dias: -76, hora: ["14:00", "17:00"], revisar: true, ups: { tipo: "Correctivo", clasificacion: "Facturar", kva: 10, marca: "Eaton", modelo: "9PX 11000i", baterias: { ...BAT_RITAR, cantidad: 20, bancos: 1 }, causas: ["Cargador (control)"] } },
  { referencia: "TK-4928", cliente: "clinica", sitio: "norte", formato: "visita-tecnica", dias: -67, hora: ["07:00", "11:30"], revisar: true, visita: { sistema: "Red de datos", puntos: 8, metrosPorPunto: [22, 34], area: "consultorios del segundo piso" } },
  { referencia: "TK-4936", cliente: "torre", sitio: "torre", formato: "servicio-ups", dias: -58, hora: ["08:00", "10:00"], revisar: true, informe: true, ups: { tipo: "Preventivo", clasificacion: "Contrato", kva: 20, marca: "Vertiv", modelo: "Liebert ITA2 20kVA", baterias: { ...BAT_CSB, cantidad: 32, bancos: 2 } } },
  { referencia: "TK-4949", cliente: "hotel", sitio: "principal", formato: "visita-tecnica", dias: -50, hora: ["10:00", "15:30"], revisar: true, visita: { sistema: "CCTV", puntos: 8, metrosPorPunto: [28, 46], area: "parqueadero y lobby" } },
  { referencia: "TK-4955", cliente: "arrocera", sitio: "planta", formato: "visita-tecnica", dias: -41, hora: ["08:00", "12:00"], revisar: true, visita: { sistema: "Red de datos", puntos: 6, metrosPorPunto: [45, 70], solucionado: "Parcialmente", area: "báscula y oficina de recibo" } },
  { referencia: "TK-4968", cliente: "colegio", sitio: "campestre", formato: "servicio-ups", dias: -33, hora: ["13:00", "15:00"], revisar: true, informe: true, ups: { tipo: "Preventivo", clasificacion: "Contrato", kva: 10, marca: "APC", modelo: "Smart-UPS SRT 10000", baterias: { ...BAT_CSB, cantidad: 16, bancos: 1 } } },
  { referencia: "TK-4974", cliente: "ferretera", sitio: "salado", formato: "visita-tecnica", dias: -24, hora: ["07:30", "13:30"], revisar: true, visita: { sistema: "Red de datos", puntos: 16, metrosPorPunto: [35, 58], rackNuevo: true, area: "bodega y muelle de cargue" } },
  // Las dos más recientes se envían y quedan en la bandeja, sin revisar.
  { referencia: "TK-4983", cliente: "vacacional", sitio: "melgar", formato: "servicio-ups", dias: -9, hora: ["09:00", "11:30"], ups: { tipo: "Instalación", clasificacion: "Facturar", kva: 3, marca: "Eaton", modelo: "5PX 3000i", baterias: { ...BAT_YUASA, cantidad: 8, bancos: 1 } } },
  { referencia: "TK-4991", cliente: "hotel", sitio: "principal", formato: "visita-tecnica", dias: -3, hora: ["14:00", "17:00"], visita: { sistema: "Red de datos", puntos: 9, metrosPorPunto: [24, 40], area: "segundo piso de habitaciones" } },
  { referencia: "TK-5002", cliente: "clinica", sitio: "principal", formato: "servicio-ups", dias: 1, hora: ["08:00", "10:30"] },
  { referencia: "TK-5008", cliente: "torre", sitio: "torre", formato: "visita-tecnica", dias: 2, hora: ["09:00", "13:00"] },
  { referencia: "TK-5013", cliente: "arrocera", sitio: "planta", formato: "servicio-ups", dias: 3, hora: ["14:00", "16:30"] },
  { referencia: "TK-5019", cliente: "ferretera", sitio: "centro", formato: "visita-tecnica", dias: 5, hora: ["08:00", "11:00"] },
  { referencia: "TK-5024", cliente: "vacacional", sitio: "melgar", formato: "servicio-ups", dias: 6, hora: ["10:00", "12:00"] },
];

/**
 * Hoy en Colombia (AAAA-MM-DD), con `dias` de diferencia. Un domingo, o un día que ya tiene otra visita de la
 * demostración, pasa al día antes (o al siguiente, si es futuro): el técnico no queda con dos visitas a la misma hora.
 */
const diasUsados = new Set<string>();
function diaDeVisita(dias: number): string {
  const texto = new Date(Date.now() + dias * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  if (new Date(`${texto}T12:00:00Z`).getUTCDay() === 0 || diasUsados.has(texto)) return diaDeVisita(dias + (dias < 0 ? -1 : 1));
  diasUsados.add(texto);
  return texto;
}
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const enBogota = (fecha: string, hora: string, segundos = 0) => new Date(new Date(`${fecha}T${hora}:00-05:00`).getTime() + segundos * 1000);
const diaLargo = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" });
const sumarMinutos = (hora: string, minutos: number) => {
  const [h, m] = hora.split(":").map(Number) as [number, number];
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + minutos));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// Fotos, bocetos y firmas ---------------------------------------------------------------------------

/**
 * Dibuja en el navegador una foto de 1600 × 1200 como las de campo (paquetes/campo/src/fotos/procesar.ts): una escena
 * (fachada, acceso, equipo, tablero, baterías o rack), un rótulo abajo y, en la foto de llegada, la franja de hora y
 * ubicación arriba (ADR-0052, como paquetes/campo/src/fotos/sello.ts), con el mapa si el servidor lo dio.
 */
const DIBUJAR = `async ({ escena, rotulo, sello, mapa }) => {
  const c = document.createElement("canvas");
  c.width = 1600;
  c.height = 1200;
  const g = c.getContext("2d");
  g.save();
  g.scale(1600 / 1024, 1200 / 768);
  const rect = (x, y, w, h, color) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
  const degradado = (y0, y1, a, b) => { const d = g.createLinearGradient(0, y0, 0, y1); d.addColorStop(0, a); d.addColorStop(1, b); return d; };
  if (escena === "fachada") {
    g.fillStyle = degradado(0, 420, "#8fbbe3", "#d9e9f5"); g.fillRect(0, 0, 1024, 768);
    rect(120, 150, 780, 470, "#e8e1d3"); rect(120, 130, 780, 30, "#9b3d2f");
    for (let f = 0; f < 3; f++) for (let k = 0; k < 6; k++) rect(160 + k * 122, 190 + f * 120, 80, 80, "#5d7a92");
    rect(440, 470, 140, 150, "#4a3a2c"); rect(120, 600, 780, 20, "#b9b0a0"); rect(0, 620, 1024, 148, "#7f7f7a"); rect(0, 690, 1024, 8, "#e6e6e0");
    g.fillStyle = "#1f3b2b";
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(60 + k * 300, 600, 55, 0, Math.PI * 2); g.fill(); }
  } else if (escena === "acceso") {
    rect(0, 0, 1024, 768, "#d8d4cb");
    g.fillStyle = degradado(0, 768, "#cfc9bd", "#a49d90");
    g.beginPath(); g.moveTo(0, 768); g.lineTo(380, 420); g.lineTo(640, 420); g.lineTo(1024, 768); g.fill();
    rect(380, 120, 260, 300, "#efece6"); rect(450, 170, 120, 250, "#6b5038"); rect(545, 290, 12, 12, "#d6b45a");
    rect(0, 0, 380, 768, "#c4bfb4"); rect(640, 0, 384, 768, "#c4bfb4"); rect(80, 200, 140, 90, "#2f7a4a");
    g.fillStyle = "#ffffff"; g.font = "bold 36px sans-serif"; g.fillText("SALIDA", 92, 258);
  } else if (escena === "tablero") {
    rect(0, 0, 1024, 768, "#bfc3c7"); rect(220, 60, 584, 660, "#8e959c"); rect(250, 90, 524, 600, "#e4e6e8");
    for (let f = 0; f < 6; f++) for (let k = 0; k < 2; k++) { rect(290 + k * 240, 130 + f * 90, 200, 60, "#2d3238"); rect(370 + k * 240, 145 + f * 90, 40, 30, f % 3 === 0 ? "#c2402f" : "#f2f2f2"); }
  } else if (escena === "baterias") {
    rect(0, 0, 1024, 768, "#5a5f66");
    for (let f = 0; f < 2; f++) for (let k = 0; k < 4; k++) {
      rect(120 + k * 200, 140 + f * 280, 170, 220, "#1f2226"); rect(140 + k * 200, 150 + f * 280, 30, 20, "#c2402f"); rect(240 + k * 200, 150 + f * 280, 30, 20, "#2b2f35");
      g.fillStyle = "#d7d9dc"; g.font = "22px sans-serif"; g.fillText("12 V", 175 + k * 200, 260 + f * 280);
    }
  } else if (escena === "rack") {
    rect(0, 0, 1024, 768, "#cfd3d6"); rect(300, 40, 420, 700, "#1d2024"); rect(320, 60, 380, 660, "#2a2e33");
    for (let u = 0; u < 9; u++) {
      rect(340, 80 + u * 68, 340, 50, u % 3 === 0 ? "#3a4047" : "#444b53");
      for (let p = 0; p < 12; p++) rect(352 + p * 27, 98 + u * 68, 18, 14, ["#2f7fd1", "#e2e5e8", "#3aa35b", "#e0b23a"][(u + p) % 4]);
    }
  } else {
    g.fillStyle = degradado(0, 768, "#e9e7e2", "#c9c5bd"); g.fillRect(0, 0, 1024, 768);
    rect(0, 600, 1024, 168, "#9c968b"); rect(330, 110, 360, 560, "#2a2e33"); rect(350, 140, 320, 120, "#3a4047"); rect(380, 170, 160, 60, "#6fbf73");
    for (let k = 0; k < 9; k++) rect(360, 300 + k * 36, 300, 14, "#1d2024");
    rect(720, 380, 180, 290, "#3b4148");
  }
  const img = g.getImageData(0, 0, 1600, 1200);
  for (let i = 0; i < img.data.length; i += 4) { const r = (Math.random() - 0.5) * 14; for (let k = i; k < i + 3; k++) img.data[k] = img.data[k] + r; }
  g.putImageData(img, 0, 0);
  g.restore();
  const t = 38;
  g.font = "600 " + t + "px sans-serif";
  const ancho = g.measureText(rotulo).width;
  g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(32, 1200 - 32 - t * 1.8, ancho + t * 1.2, t * 1.8);
  g.fillStyle = "#ffffff"; g.fillText(rotulo, 32 + t * 0.6, 1200 - 32 - t * 0.55);
  if (sello) {
    const s = Math.round(1600 * 0.032);
    const margen = Math.round(s * 0.8);
    const sombra = g.createLinearGradient(0, 0, 0, s * 1.35 * sello.length + margen * 3);
    sombra.addColorStop(0, "rgba(0,0,0,0.6)"); sombra.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = sombra; g.fillRect(0, 0, 1600, s * 1.35 * sello.length + margen * 3);
    g.font = "500 " + s + "px sans-serif"; g.textAlign = "right"; g.fillStyle = "#ffffff";
    g.shadowColor = "rgba(0,0,0,0.8)"; g.shadowBlur = 6;
    sello.forEach((linea, i) => g.fillText(linea, 1600 - margen, margen + s * (i + 1) * 1.3));
    g.shadowBlur = 0; g.textAlign = "left";
    // Si el mapa no se puede leer, la foto sale sin él, como en campo sin señal.
    const imagen = new Image();
    imagen.src = mapa ? mapa.imagen : "";
    if (mapa && (await imagen.decode().then(() => true, () => false))) {
      const lado = Math.round(1600 * 0.28);
      const alto = Math.round((lado * imagen.height) / imagen.width);
      g.drawImage(imagen, margen, margen, lado, alto);
      g.fillStyle = "#e5484d"; g.beginPath(); g.arc(margen + lado / 2, margen + alto / 2, 12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#ffffff"; g.lineWidth = 4; g.stroke();
      g.font = "14px sans-serif"; g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(margen, margen + alto - 22, g.measureText(mapa.atribucion).width + 12, 22);
      g.fillStyle = "#1d2228"; g.fillText(mapa.atribucion, margen + 6, margen + alto - 6);
    }
  }
  return c.toDataURL("image/jpeg", 0.82).split(",")[1];
}`;

interface Archivo {
  datos: Buffer;
  huella: string;
  tipo: "image/jpeg" | typeof TIPO_ARCHIVO_BOCETO;
}
const comoArchivo = (datos: Buffer, tipo: Archivo["tipo"]): Archivo => ({ datos, huella: createHash("sha256").update(datos).digest("hex"), tipo });

type Mapa = { imagen: string; atribucion: string };
async function foto(pagina: Page, escena: string, rotulo: string, sello?: string[], mapa?: Mapa | null): Promise<Archivo> {
  const base64 = (await pagina.evaluate(`(${DIBUJAR})(${JSON.stringify({ escena, rotulo, sello: sello ?? null, mapa: mapa ?? null })})`)) as string;
  return comoArchivo(Buffer.from(base64, "base64"), "image/jpeg");
}
const escenaDe = (texto: string) =>
  /fachada/i.test(texto) ? "fachada" : /acceso|entrada|puerta/i.test(texto) ? "acceso" : /tablero|breaker|barraje/i.test(texto) ? "tablero" : /bater/i.test(texto) ? "baterias" : /rack|red|datos/i.test(texto) ? "rack" : "equipo";

/** Como `formatoDeMomento` de campo: «27 oct 2026 12:31:07 p. m. GMT-05:00». */
function momento(fecha: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZoneName: "longOffset", timeZone: "America/Bogota" })
      .formatToParts(fecha)
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return `${p.day} ${p.month!.replace(".", "")} ${p.year} ${p.hour}:${p.minute}:${p.second} ${(p.dayPeriod ?? "").replace(/\s/g, " ").toLowerCase()} ${p.timeZoneName}`;
}
function grados(lat: number, lon: number): string {
  const parte = (g: number, mas: string, menos: string) => {
    const abs = Math.abs(g);
    const e = Math.floor(abs);
    const mf = (abs - e) * 60;
    const m = Math.floor(mf);
    return `${e}°${m}'${((mf - m) * 60).toFixed(3)}"${g >= 0 ? mas : menos}`;
  };
  return `${parte(lat, "N", "S")} ${parte(lon, "E", "W")}`;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Un croquis sencillo (versión 2): el cuarto con su puerta, la cota, el equipo y el recorrido. */
function croquis(ctx: Contexto): DocumentoBoceto {
  const { azar } = ctx;
  const ancho = azar.entero(5, 9);
  const etiqueta = ctx.visita?.sistema === "Red de energía" ? "Tablero regulado" : ctx.visita?.sistema === "CCTV" ? "DVR y switch PoE" : ctx.ups ? `UPS ${ctx.ups.kva} kVA` : "Rack de comunicaciones";
  const elementos: ElementoBoceto[] = [
    { tipo: "polilinea", grosor: 4, puntos: [[100, 160], [650, 160], [650, 720], [100, 720]], cerrada: true },
    { tipo: "linea", grosor: 4, desde: [300, 720], hasta: [300, 800] },
    { tipo: "linea", grosor: 2, desde: [300, 800], hasta: [400, 720] },
    { tipo: "cota", grosor: 2, desde: [100, 120], hasta: [650, 120], texto: `${ancho},${azar.entero(0, 9)}0 m` },
    { tipo: "polilinea", grosor: 3, puntos: [[540, 200], [620, 200], [620, 320], [540, 320]], cerrada: true },
    { tipo: "texto", en: [450, 360], texto: etiqueta, tamano: 26 },
    { tipo: "polilinea", grosor: 2, puntos: [[580, 320], [580, 640], [140, 640], [140, 260]], cerrada: false },
    { tipo: "texto", en: [160, 620], texto: ctx.visita ? "Ruta de canaleta" : "Acometida desde tablero", tamano: 22 },
    { tipo: "texto", en: [310, 860], texto: "Acceso", tamano: 22 },
  ];
  return { formato: "teins-boceto", version: 2, cuadricula: 25, hojas: [{ nombre: "Hoja 1", ancho: 750, alto: 1000, elementos }] };
}

/** Trazos de una firma a mano (versión 1, como las de campo): una curva por palabra, con su contorno. */
function firma(nombre: string, azar: Azar): DocumentoBoceto {
  const palabras = nombre.split(" ").slice(0, 2);
  const elementos: ElementoBoceto[] = palabras.map((_, i) => {
    const x0 = 180 + i * 330;
    const y0 = 380 + azar.entre(-25, 25);
    const puntos = Array.from({ length: 60 }, (__, k) => {
      const t = k / 59;
      return [r1(x0 + t * 280), r1(y0 + Math.sin(t * Math.PI * azar.entre(5, 7)) * 45 * (1 - t * 0.5) - t * 30), r1(0.4 + 0.4 * Math.sin(t * Math.PI))] as const;
    });
    const arriba = puntos.map(([x, y]) => [x, r1(y - 3)] as const);
    const abajo = puntos.map(([x, y]) => [x, r1(y + 3)] as const).reverse();
    return { tipo: "trazo", grosor: 4, puntos, contorno: [...arriba, ...abajo] };
  });
  return { formato: "teins-boceto", version: 1, ancho: 1000, alto: 750, cuadricula: 25, elementos };
}

// Respuestas a partir del formato -------------------------------------------------------------------

interface Contexto {
  spec: VisitaDemo;
  azar: Azar;
  fecha: string;
  horario: { desde: string; hasta: string };
  cliente: ClienteDemo;
  sitio: SitioDemo;
  organizacion: string;
  tecnico: string;
  ups?: Ups;
  visita?: Visita;
  medidas: Map<string, number>;
  catalogo: Map<string, { id: string; descripcion: string; unidad: string }>;
  pagina: Page;
  mapa: () => Promise<Mapa | null>;
  archivos: Archivo[];
}

/** Las mediciones de una UPS, coherentes entre sí: la corriente sale de la capacidad y la carga. */
function medicionesDeUps(u: Ups, azar: Azar): Map<string, number> {
  const fases = u.kva >= 10 ? 3 : 1;
  const carga = azar.entero(28, 68);
  const m = new Map<string, number>([
    ["fases", fases],
    ["carga", carga],
    ["vnt", r1(azar.entre(0.3, 1.4))],
    ["vff", r1(azar.entre(206.8, 209.6))],
    ["frecuencia", azar.prob(0.8) ? 60 : 59.9],
    ["vflot", r1(u.baterias.cantidad * azar.entre(13.55, 13.7))],
    ["iflot", r1(azar.entre(0.3, 1.6))],
    ["vigual", r1(u.baterias.cantidad * azar.entre(12.0, 12.3))],
    ["idc", r1(azar.entre(2.2, 8.5))],
    ["vsalidaff", r1(azar.entre(207.5, 208.6))],
  ]);
  for (let f = 1; f <= 3; f++) {
    m.set(`vin${f}`, r1(azar.entre(118.6, 122.4)));
    m.set(`vout${f}`, r1(azar.entre(119.6, 120.6)));
    const corriente = (u.kva * 1000 * (carga / 100)) / (fases * 120);
    m.set(`iin${f}`, r1(corriente * azar.entre(1.02, 1.1)));
    m.set(`iout${f}`, r1(corriente * azar.entre(0.94, 1.02)));
  }
  return m;
}

function medida(campo: Extract<DefinicionCampo, { tipo: "medida" }>, ctx: Contexto): Valor | undefined {
  const e = campo.etiqueta;
  const m = ctx.medidas;
  const fase = Number(/F(\d)\s*$/.exec(e)?.[1] ?? 1);
  const fases = m.get("fases") ?? 1;
  const unidad = campo.unidades[0]!;
  const salida = /salida/i.test(e);
  let n: number | undefined;
  if (unidad === "V") {
    if (/N-T/.test(e)) n = m.get("vnt");
    else if (/F-F/.test(e)) n = fases === 3 ? m.get(salida ? "vsalidaff" : "vff") : undefined;
    else if (/flotaci/i.test(e)) n = m.get("vflot");
    else if (/igualaci/i.test(e)) n = m.get("vigual");
    else if (/F\d\s*$/.test(e)) n = fase > fases ? undefined : m.get(`${salida ? "vout" : "vin"}${fase}`);
    else if (ctx.ups && /^voltaje$/i.test(e.trim())) n = 12;
    else n = r1(ctx.azar.entre(119.5, 121.5));
  } else if (unidad === "A") {
    if (/flotaci/i.test(e)) n = m.get("iflot");
    else if (/DC|igualaci/i.test(e)) n = m.get("idc");
    else if (/F\d\s*$/.test(e)) n = fase > fases ? undefined : m.get(`${salida ? "iout" : "iin"}${fase}`);
    else n = r1(ctx.azar.entre(5, 30));
  } else if (unidad === "Hz") n = salida ? 60 : (m.get("frecuencia") ?? 60);
  else if (unidad === "%") n = m.get("carga") ?? ctx.azar.entero(20, 70);
  else if (["kVA", "kW", "VA"].includes(unidad)) n = ctx.ups?.kva ?? 10;
  else if (unidad === "Ah") n = ctx.ups?.baterias.ah ?? 9;
  else if (unidad === "und") n = /banco/i.test(e) ? (ctx.ups?.baterias.bancos ?? 1) : /cantidad/i.test(e) ? (ctx.ups?.baterias.cantidad ?? 1) : ctx.azar.entero(1, 12);
  else if (unidad === "m") n = r1(ctx.azar.entre(2, 30));
  else if (unidad === "cm") n = ctx.azar.entero(20, 120);
  else n = ctx.azar.entero(1, 50);
  // Sin valor: una fase que el equipo monofásico no tiene, que en campo también queda vacía.
  return n === undefined ? undefined : { valor: decimal(n), unidad };
}

const SISTEMAS: Record<Sistema, { equipo: string; unidad: string }> = {
  "Red de datos": { equipo: "puntos de red", unidad: "puntos" },
  CCTV: { equipo: "cámaras", unidad: "cámaras" },
  "Red de energía": { equipo: "tomas reguladas", unidad: "tomas" },
};

function textoLargo(clave: string, ctx: Contexto): string | undefined {
  const { ups, visita, azar } = ctx;
  if (ups) {
    const equipo = `UPS ${ups.marca} ${ups.modelo} de ${ups.kva} kVA`;
    const bat = `${ups.baterias.cantidad} baterías ${ups.baterias.marca} ${ups.baterias.referencia}`;
    switch (clave) {
      case "dano":
        return ups.tipo === "Correctivo"
          ? azar.uno([`El equipo pita y pasa a batería varias veces al día; la última vez se apagó con la carga del ${ctx.sitio.nombre.toLowerCase()}.`, "El equipo muestra alarma de falla y no sostiene la carga cuando se va la energía."])
          : ups.tipo === "Cambio de baterías"
            ? "La autonomía bajó a menos de 3 minutos y el equipo muestra alarma de cambio de baterías."
            : ups.tipo === "Instalación"
              ? "Equipo nuevo para respaldar el rack de comunicaciones y la recepción."
              : "Sin daño reportado: mantenimiento preventivo programado por contrato.";
      case "estado_inicial":
        return ups.tipo === "Instalación"
          ? "Equipo en caja, sin instalar. Circuito dedicado disponible en el tablero de la recepción."
          : ups.tipo === "Correctivo"
            ? `${equipo} encendida en bypass, con alarma activa y ventiladores con ruido.`
            : `${equipo} encendida en línea, con ${bat} y carga al ${ctx.medidas.get("carga")} %.`;
      case "estado_final":
        return `${equipo} queda en línea, sin alarmas, con transferencia a batería probada y carga al ${ctx.medidas.get("carga")} %.`;
      case "trabajo":
        return ups.tipo === "Preventivo"
          ? "Mantenimiento preventivo: limpieza interna con aire seco, ajuste de borneras, revisión de ventiladores, prueba de transferencia a batería y medición de entrada y salida."
          : ups.tipo === "Correctivo"
            ? `Diagnóstico de la falla: ${(ups.causas ?? ["Baterías"]).join(" y ").toLowerCase()}. Se cambiaron los ventiladores, se ajustaron conexiones y se probó el equipo con carga durante 20 minutos.`
            : ups.tipo === "Cambio de baterías"
              ? `Cambio del banco completo: se retiraron ${ups.baterias.cantidad} baterías con más de cuatro años de uso y se instalaron nuevas de ${ups.baterias.ah} Ah. Prueba de autonomía con carga: 14 minutos.`
              : `Instalación de ${equipo}: montaje en rack, conexión al circuito dedicado, configuración de alarmas y prueba de transferencia.`;
      case "observaciones":
        return azar.uno([
          "Se recomienda cambiar el banco de baterías en el próximo mantenimiento: la autonomía está en el límite.",
          "El cuarto técnico tiene temperatura alta en la tarde: se recomienda revisar el aire acondicionado.",
          "Equipo en buen estado. Próximo preventivo en seis meses.",
          "Se recomienda instalar un bypass externo para no apagar la carga en los mantenimientos.",
        ]);
    }
  }
  if (visita) {
    const { equipo } = SISTEMAS[visita.sistema];
    const n = visita.puntos;
    switch (clave) {
      case "estado_inicial":
        return visita.sistema === "Red de datos"
          ? `En ${visita.area} funcionan pocos puntos y varios equipos se conectan por un switch de escritorio. Cableado antiguo sin marcar, en categoría 5e.`
          : visita.sistema === "CCTV"
            ? `En ${visita.area} hay cámaras análogas fuera de servicio y el DVR no graba desde hace dos semanas.`
            : `En ${visita.area} los equipos de cómputo están conectados a tomas normales y regletas, sin circuito regulado.`;
      case "diagnostico":
        return visita.sistema === "Red de datos"
          ? `Se requieren ${n} ${equipo} nuevos en categoría 6 hasta el rack, con recorrido promedio de ${Math.round((visita.metrosPorPunto[0] + visita.metrosPorPunto[1]) / 2)} m por punto, por canaleta sobre muro${visita.fibra ? ` y un enlace de fibra de ${visita.fibra} m entre gabinetes` : ""}.`
          : visita.sistema === "CCTV"
            ? `Se requieren ${n} cámaras IP con cableado UTP categoría 6 hasta el switch PoE del cuarto técnico.`
            : `Se requiere un circuito regulado de ${n} tomas desde la UPS, con cable encauchetado y canaleta.`;
      case "correccion":
        return visita.sistema === "Red de datos"
          ? `Se instalaron y certificaron ${n} ${equipo} categoría 6, con canaleta de 60x40 mm y marcación en ambos extremos.${visita.rackNuevo ? " Se organizó el rack y se dejó patch panel nuevo." : ""}${visita.solucionado === "Parcialmente" ? " Quedan dos puntos pendientes por falta de acceso al techo." : ""}`
          : visita.sistema === "CCTV"
            ? `Se cablearon ${n} puntos para cámaras con UTP categoría 6 y se probaron con el switch PoE.`
            : `Se instaló el circuito regulado con ${n} tomas, breaker de 20 A y marcación en el tablero.`;
      case "notas":
        return azar.uno([
          "El cliente pide cotizar la ampliación al tercer piso.",
          "Se deja copia del plano de puntos en el rack.",
          "Se recomienda reemplazar el switch de escritorio por uno administrable.",
          "Trabajo realizado en horario de baja operación, coordinado con el cliente.",
        ]);
    }
  }
  return undefined;
}

const LARGOS: [RegExp, string][] = [
  [/daño/i, "dano"],
  [/estado inicial/i, "estado_inicial"],
  [/estado final/i, "estado_final"],
  [/diagn/i, "diagnostico"],
  [/correcci/i, "correccion"],
  [/trabajo/i, "trabajo"],
  [/observaci.*(técnica|recomend)/i, "observaciones"],
  [/observaci/i, ""],
];

function texto(campo: Extract<DefinicionCampo, { tipo: "texto" }>, ctx: Contexto): string {
  const e = campo.etiqueta;
  const { ups, azar } = ctx;
  if (/recibe|contacto/i.test(e)) return ctx.cliente.contactos[0]!.nombre;
  if (ups) {
    if (/marca.*bater/i.test(e)) return ups.baterias.marca;
    if (/^marca/i.test(e)) return ups.marca;
    if (/modelo/i.test(e)) return ups.modelo;
    if (/serial/i.test(e)) return `${ups.marca.slice(0, 2).toUpperCase()}${ups.kva}K${huellaDe(ctx.spec.referencia).slice(0, 6).toUpperCase()}`;
    if (/referencia/i.test(e)) return ups.baterias.referencia;
  }
  if (/sim/i.test(e)) return "No aplica";
  if (/polaridad/i.test(e)) return "Correctas";
  for (const [patron, clave] of LARGOS) {
    if (!patron.test(e)) continue;
    const t = textoLargo(clave || (ups ? "observaciones" : "notas"), ctx);
    if (t) return t;
  }
  if (campo.valoresComunes?.length) {
    const comunes = campo.valoresComunes;
    const bueno = comunes[0]!;
    if (ups?.tipo === "Correctivo" && /bater|ventil|cargador/i.test(e)) return comunes.includes("Regular") ? "Regular" : bueno;
    if (/bypass externo/i.test(e) && azar.prob(0.5)) return comunes.includes("No aplica") ? "No aplica" : bueno;
    return azar.prob(0.85) ? bueno : (comunes[1] ?? bueno);
  }
  return campo.largo ? "Sin novedades adicionales." : "Sin novedad";
}

function elegir(opciones: readonly string[], deseadas: readonly string[]): string[] {
  return deseadas.filter((d) => opciones.includes(d));
}

function opcion(campo: Extract<DefinicionCampo, { tipo: "opcion" }>, ctx: Contexto): string {
  const e = campo.etiqueta;
  const preferida = /neutro/i.test(e)
    ? "No"
    : /funcionando/i.test(e)
      ? "Sí"
      : /^tipo$/i.test(e.trim())
        ? "Selladas"
        : /solucionado/i.test(e)
          ? (ctx.visita?.solucionado ?? "Totalmente")
          : "Sí";
  return campo.opciones.includes(preferida) ? preferida : campo.opciones[0]!;
}

function opciones(campo: Extract<DefinicionCampo, { tipo: "opciones" }>, ctx: Contexto): Valor {
  const e = campo.etiqueta;
  const deseadas = /tipo de servicio/i.test(e)
    ? [ctx.ups?.tipo ?? "Preventivo"]
    : /clasificaci/i.test(e)
      ? [ctx.ups?.clasificacion ?? "Contrato"]
      : /sistema/i.test(e)
        ? [ctx.visita?.sistema ?? "UPS"]
        : /causa/i.test(e)
          ? (ctx.ups?.causas ?? ["Baterías"])
          : [];
  const elegidas = elegir(campo.opciones, deseadas);
  if (elegidas.length > 0) return { elegidas };
  const otro = deseadas[0];
  if (otro && campo.otro) return { elegidas: [], otro };
  return { elegidas: [campo.opciones[0]!] };
}

/** Las líneas de materiales de una visita técnica, del catálogo (con su ítem, como las elige el técnico) o libres. */
function materiales(campo: Extract<DefinicionCampo, { tipo: "cantidades" }>, ctx: Contexto, semilla: string): Valor {
  const v = ctx.visita;
  const { azar } = ctx;
  const lineas: { codigo?: CodigoCatalogo; descripcion?: string; cantidad: number; unidad?: string; observacion?: string }[] = [];
  if (v) {
    const metros = Math.round(v.puntos * azar.entre(v.metrosPorPunto[0], v.metrosPorPunto[1]));
    if (v.sistema === "Red de energía") {
      lineas.push({ codigo: "CAB-3X12", cantidad: metros }, { codigo: "CAN-60X40", cantidad: Math.round(metros * azar.entre(0.55, 0.75)) }, { codigo: "BRK-1X20", cantidad: Math.ceil(v.puntos / 4) });
    } else {
      lineas.push({ codigo: "UTP-C6", cantidad: metros });
      if (v.sistema === "Red de datos") lineas.push({ codigo: "PTO-RED", cantidad: v.puntos }, { codigo: "JCK-C6", cantidad: v.puntos }, { codigo: "PC-C6-15", cantidad: v.puntos });
      lineas.push({ codigo: "CAN-60X40", cantidad: Math.round(v.puntos * azar.entre(4, 7.5)) });
      if (azar.prob(0.6)) lineas.push({ codigo: "TUB-PVC34", cantidad: azar.entero(6, 30), observacion: "Tramo por el cielo raso" });
      if (v.rackNuevo) lineas.push({ codigo: "PP-24C6", cantidad: Math.ceil(v.puntos / 24) }, { descripcion: "Organizador horizontal de 2U", cantidad: Math.ceil(v.puntos / 24), unidad: "und" });
      if (v.fibra) lineas.push({ codigo: "FO-OM3-6", cantidad: v.fibra, observacion: "Enlace entre gabinetes" });
      if (azar.prob(0.5)) lineas.push({ descripcion: "Soporte en L galvanizado para canaleta", cantidad: azar.entero(8, 24), unidad: "und" });
      if (azar.prob(0.4)) lineas.push({ descripcion: "Marquillas de identificación (rollo)", cantidad: 1, unidad: "und" });
    }
  }
  return lineas.map((l, i) => {
    const item = l.codigo ? ctx.catalogo.get(l.codigo) : undefined;
    const unidad = [item?.unidad, l.unidad, campo.unidades[0]].find((u): u is string => !!u && campo.unidades.includes(u))!;
    return {
      id: idCorto(`${semilla}:${i}`),
      descripcion: item?.descripcion ?? l.descripcion ?? CATALOGO.find((c) => c.codigo === l.codigo)!.descripcion,
      cantidad: decimal(l.cantidad, 2),
      unidad,
      ...(l.observacion ? { observacion: l.observacion } : {}),
      ...(item ? { item: item.id } : {}),
    };
  });
}

async function valorDe(campo: DefinicionCampo, ctx: Contexto, bloque: string): Promise<Valor | undefined> {
  switch (campo.tipo) {
    case "texto":
      return texto(campo, ctx);
    case "medida":
      return medida(campo, ctx);
    case "opcion":
      return opcion(campo, ctx);
    case "opciones":
      return opciones(campo, ctx);
    case "horario":
      return ctx.horario;
    case "cantidades":
      return materiales(campo, ctx, `${ctx.spec.referencia}:${bloque}:${campo.clave}`);
    case "foto": {
      const puestos = campo.puestos?.length ? campo.puestos : Array.from({ length: Math.max(campo.min ?? 0, 1) }, (_, i) => `${campo.etiqueta}${i > 0 ? ` ${i + 1}` : ""}`);
      const fotos: string[] = [];
      for (const [i, puesto] of puestos.entries()) {
        const tomada = enBogota(ctx.fecha, ctx.horario.desde, 40 + i * 75);
        const centro = CENTROS[ctx.sitio.ciudad];
        const lat = centro.lat + ctx.sitio.corrimiento[0] / 1000 + ctx.azar.entre(-0.0002, 0.0002);
        const lon = centro.lon + ctx.sitio.corrimiento[1] / 1000 + ctx.azar.entre(-0.0002, 0.0002);
        const sello = campo.sello
          ? [
              `Red: ${momento(new Date(tomada.getTime() + 2000))}`,
              `Teléfono: ${momento(tomada)}`,
              ...(campo.sello.ubicacion ? [`${grados(lat, lon)} · ±${ctx.azar.entero(4, 14)} m`] : []),
              `${ctx.sitio.direccion}, ${ctx.sitio.ciudad}`,
              [ctx.organizacion, ctx.cliente.nombre, ctx.sitio.nombre].join(" · "),
            ]
          : undefined;
        const archivo = await foto(ctx.pagina, escenaDe(`${campo.etiqueta} ${puesto} ${ctx.visita?.sistema ?? ""}`), puesto, sello, campo.sello?.mapa ? await ctx.mapa() : null);
        ctx.archivos.push(archivo);
        fotos.push(archivo.huella);
      }
      return fotos;
    }
    case "boceto": {
      const archivo = comoArchivo(Buffer.from(serializarBoceto(croquis(ctx))), TIPO_ARCHIVO_BOCETO);
      ctx.archivos.push(archivo);
      return { boceto: archivo.huella };
    }
    case "firma": {
      const quien = ctx.azar.prob(0.5) ? ctx.cliente.contactos[0]! : ctx.azar.uno(ctx.cliente.firman);
      const archivo = comoArchivo(Buffer.from(serializarBoceto(firma(quien.nombre, ctx.azar))), TIPO_ARCHIVO_BOCETO);
      ctx.archivos.push(archivo);
      const documento = campo.documento === "obligatorio" || (campo.documento === "opcional" && ctx.azar.prob(0.6)) ? String(ctx.azar.entero(10_000_000, 1_199_999_999)) : undefined;
      return {
        firma: archivo.huella,
        nombre: quien.nombre,
        cargo: quien.cargo,
        firmadoEn: enBogota(ctx.fecha, ctx.horario.hasta, -120).toISOString(),
        declaracion: llenarDeclaracion(campo.declaracion, { tecnico: ctx.tecnico, sitio: `${ctx.cliente.nombre} · ${ctx.sitio.nombre}`, fecha: diaLargo.format(enBogota(ctx.fecha, "12:00")) }),
        ...(documento ? { documento } : {}),
      };
    }
  }
}

/** Recorre el formato como el técnico, sección por sección: lo oculto (ADR-0058) no se llena. */
async function responder(formato: VersionFormato, ctx: Contexto) {
  const respuestas: Record<string, Record<string, Valor>> = {};
  const repeticiones: Record<string, { id: string; nombre: string }[]> = {};
  for (const seccion of formato.secciones) {
    if (!seccionVisible(seccion, respuestas)) continue;
    const claves = seccion.repetible
      ? Array.from({ length: Math.max(seccion.repetible.min ?? 0, 1) }, (_, i) => {
          const id = idCorto(`${ctx.spec.referencia}:${seccion.clave}:${i}`);
          (repeticiones[seccion.clave] ??= []).push({ id, nombre: `${seccion.repetible!.etiqueta} ${i + 1}` });
          return `${seccion.clave}~${id}`;
        })
      : [seccion.clave];
    for (const bloque of claves) {
      const valores: Record<string, Valor> = {};
      respuestas[bloque] = valores;
      for (const campo of seccion.campos) {
        if (!campoVisible(campo, bloque, respuestas)) continue;
        const valor = await valorDe(campo, ctx, bloque);
        if (valor !== undefined) valores[campo.clave] = valor;
      }
    }
  }
  return { respuestas, repeticiones };
}

// Lo que hace el técnico ---------------------------------------------------------------------------

async function subir(t: Persona, archivo: Archivo) {
  const autorizacion = await t.api.llamar("autorizarSubida", { cuerpo: { huella: archivo.huella, bytes: archivo.datos.length, tipo: archivo.tipo } });
  if (autorizacion.estado === "existente" && autorizacion.archivo !== "pendiente") return;
  if (autorizacion.estado === "autorizada") {
    const r = await fetch(autorizacion.url, { method: "PUT", headers: autorizacion.cabeceras, body: new Uint8Array(archivo.datos) });
    if (!r.ok) throw new Error(`El almacenamiento respondió ${r.status}`);
  }
  await t.api.llamar("confirmarSubida", { parametros: { huella: archivo.huella } });
}

/** Como el teléfono: mientras el worker verifica los archivos, espera y reintenta con la misma llave. */
async function enviar(t: Persona, cuerpo: CuerpoEntrada<"enviarComando">) {
  for (let intento = 1; intento <= 40; intento++) {
    try {
      return await t.api.llamar("enviarComando", { cuerpo });
    } catch (error) {
      if (!(error instanceof ErrorApi) || error.codigo !== "archivos_en_verificacion") throw error;
      await esperar((error.problema.reintentarEnSegundos ?? 3) * 1000);
    }
  }
  throw new Error("Los archivos siguen en verificación: ¿el worker está corriendo?");
}

/** La bajada del técnico: los formatos y el catálogo, como los recibe el teléfono. */
async function bajar(t: Persona) {
  const formatos = new Map<string, VersionFormato>();
  const items = new Map<string, { id: string; descripcion: string; unidad: string }>();
  let desde = 0;
  for (let pagina = 0; pagina < 200; pagina++) {
    const bajada = await t.api.llamar("obtenerCambios", { consulta: { desde, app: VERSION_APP } });
    for (const c of bajada.cambios) {
      if (c.tipo === "formato" && (formatos.get(c.definicion.formato)?.version ?? 0) < c.definicion.version) formatos.set(c.definicion.formato, c.definicion as VersionFormato);
      if (c.tipo === "item_catalogo") {
        if (c.item.activo) items.set(c.item.codigo, { id: c.item.id, descripcion: c.item.descripcion, unidad: c.item.unidad });
        else items.delete(c.item.codigo);
      }
    }
    desde = bajada.puntoDeControl;
    if (!bajada.hayMas) break;
  }
  return { formatos, items };
}

// Lo que hace oficina ------------------------------------------------------------------------------

async function asegurarCatalogo(o: Persona) {
  const { items } = await o.api.llamar("listarCatalogo");
  const porCodigo = new Map(items.map((i) => [i.codigo, i]));
  const sinPrecio: string[] = [];
  for (const c of CATALOGO) {
    let item = porCodigo.get(c.codigo);
    if (!item) {
      item = await intentar(`Catálogo ${c.codigo}`, () => o.api.llamar("crearItemCatalogo", { cuerpo: { codigo: c.codigo, descripcion: c.descripcion, unidad: c.unidad } }));
      if (!item) continue;
      contar("Ítems del catálogo", true);
    } else contar("Ítems del catálogo", false);
    // Solo se pone el precio que falta: el que ya tenga la organización no se toca.
    if (item.precio) contar("Precios del catálogo", false);
    else if (!o.administra) sinPrecio.push(c.codigo);
    else if (await intentar(`Precio de ${c.codigo}`, () => o.api.llamar("cambiarPrecio", { parametros: { id: item.id }, cuerpo: { precio: c.precio } }))) contar("Precios del catálogo", true);
  }
  if (sinPrecio.length > 0) avisos.push(`Sin precio en el catálogo (${sinPrecio.join(", ")}): ponerlo es de administración con segundo factor. Las cotizaciones los llevan igual, escritos por oficina; Chispa estima sin costo`);
}

interface ClienteListo {
  id: string;
  sitios: Map<string, string>;
  contacto: string | null;
}

async function asegurarClientes(o: Persona): Promise<Map<ClaveCliente, ClienteListo>> {
  const listos = new Map<ClaveCliente, ClienteListo>();
  const [activos, archivados] = await Promise.all([o.api.llamar("listarClientes", { consulta: { vista: "activos" } }), o.api.llamar("listarClientes", { consulta: { vista: "archivados" } })]);
  for (const [clave, c] of Object.entries(CLIENTES) as [ClaveCliente, ClienteDemo][]) {
    await intentar(`Cliente ${c.nombre}`, async () => {
      if (archivados.clientes.some((x) => x.nombre === c.nombre)) throw new Error("está archivado: recupérelo en oficina para volver a usarlo");
      const contacto = (d: ContactoDemo) => ({ nombre: d.nombre, cargo: d.cargo, correo: d.correo, celular: d.celular, recibeCorreo: false, recibeWhatsapp: false, recibeInformes: true, recibeCotizaciones: true });
      const primero = c.sitios[0]!;
      let id = activos.clientes.find((x) => x.nombre === c.nombre)?.id;
      // Al crearlo nacen su primer sitio y su primer contacto: no cuentan como existentes.
      const nuevo = !id;
      if (!id) {
        id = (await o.api.llamar("crearCliente", { cuerpo: { nombre: c.nombre, nit: c.nit, sitio: { nombre: primero.nombre, direccion: primero.direccion, ciudad: primero.ciudad }, contacto: contacto(c.contactos[0]!) } })).id;
      }
      contar("Clientes", nuevo);
      const clienteId = id;
      let detalle = await o.api.llamar("obtenerCliente", { parametros: { id: clienteId } });
      for (const s of c.sitios) {
        const existe = detalle.sitios.some((x) => x.nombre === s.nombre);
        if (!existe) {
          await o.api.llamar("agregarSitio", { parametros: { id: clienteId }, cuerpo: { nombre: s.nombre, direccion: s.direccion, ciudad: s.ciudad } });
          detalle = await o.api.llamar("obtenerCliente", { parametros: { id: clienteId } });
        }
        contar("Sitios", !existe || (nuevo && s === primero));
      }
      for (const d of c.contactos) {
        const existe = detalle.contactos.some((x) => x.nombre === d.nombre);
        if (!existe) detalle = await o.api.llamar("crearContacto", { parametros: { id: clienteId }, cuerpo: contacto(d) });
        contar("Contactos", !existe || (nuevo && d === c.contactos[0]));
      }
      const sitios = new Map(c.sitios.flatMap((s) => {
        const encontrado = detalle.sitios.find((x) => x.nombre === s.nombre && !x.archivado);
        return encontrado ? [[s.clave, encontrado.id] as const] : [];
      }));
      listos.set(clave, { id: clienteId, sitios, contacto: detalle.contactos.find((x) => x.nombre === c.contactos[0]!.nombre)?.id ?? null });
    });
  }
  return listos;
}

interface VisitaLista {
  spec: VisitaDemo;
  id: string;
  fecha: string;
}

async function asegurarVisitas(o: Persona, t: Persona, clientes: Map<ClaveCliente, ClienteListo>): Promise<VisitaLista[]> {
  const { servicios } = await o.api.llamar("serviciosParaProgramar");
  const claves = new Set(servicios.map((s) => s.clave));
  for (const f of new Set(VISITAS.map((v) => v.formato))) {
    if (!claves.has(f)) salirCon(`La organización no tiene el formato «${f}». Tiene: ${[...claves].join(", ") || "ninguno"}`);
  }
  const dia = hoy();
  const vistas = await Promise.all((["proximas", "anteriores", "canceladas"] as const).map((vista) => o.api.llamar("listarVisitas", { consulta: { vista, hoy: dia } })));
  const existentes = vistas.flatMap((v) => v.visitas);
  const previaDe = (spec: VisitaDemo) => existentes.find((v) => v.cliente.id === clientes.get(spec.cliente)?.id && v.referencia === spec.referencia);
  // Los días de las que ya existen quedan tomados antes de fechar las que faltan.
  for (const spec of VISITAS) {
    const previa = previaDe(spec);
    if (previa) diasUsados.add(previa.programadaPara);
  }
  const listas: VisitaLista[] = [];
  for (const spec of VISITAS) {
    const cliente = clientes.get(spec.cliente);
    if (!cliente) continue;
    const previa = previaDe(spec);
    if (previa) {
      contar("Visitas", false);
      if (previa.cancelada) avisos.push(`La visita ${spec.referencia} está cancelada: se deja así`);
      else listas.push({ spec, id: previa.id, fecha: previa.programadaPara });
      continue;
    }
    const sitioId = cliente.sitios.get(spec.sitio);
    if (!sitioId) continue;
    const fecha = diaDeVisita(spec.dias);
    const creada = await intentar(`Visita ${spec.referencia}`, () =>
      o.api.llamar("programarVisita", {
        cuerpo: { clienteId: cliente.id, sitioId, formato: spec.formato, programadaPara: fecha, horaInicio: spec.hora[0], horaFin: spec.hora[1], tecnicos: [t.id], referencia: spec.referencia, ...(cliente.contacto ? { solicitanteId: cliente.contacto } : {}) },
      }),
    );
    if (!creada) continue;
    contar("Visitas", true);
    listas.push({ spec, id: creada.id, fecha: creada.programadaPara });
  }
  return listas;
}

async function asegurarLevantamiento(
  o: Persona,
  t: Persona,
  v: VisitaLista,
  formatos: Map<string, VersionFormato>,
  catalogo: Map<string, { id: string; descripcion: string; unidad: string }>,
  pagina: Page,
  mapas: Map<string, Promise<Mapa | null>>,
): Promise<string | undefined> {
  const id = uuidEstable(`demostracion:levantamiento:${v.id}`);
  try {
    await o.api.llamar("obtenerLevantamiento", { parametros: { id } });
    contar("Levantamientos enviados", false);
    return id;
  } catch (error) {
    if (!(error instanceof ErrorApi) || error.codigo !== "no_encontrado") throw error;
  }
  const formato = formatos.get(v.spec.formato);
  if (!formato) throw new Error(`La bajada del técnico no trae el formato ${v.spec.formato}`);
  const cliente = CLIENTES[v.spec.cliente];
  const sitio = cliente.sitios.find((s) => s.clave === v.spec.sitio)!;
  const azar = azarDe(v.spec.referencia);
  const horario = { desde: sumarMinutos(v.spec.hora[0], azar.entero(-5, 15)), hasta: sumarMinutos(v.spec.hora[1], azar.entero(-20, 10)) };
  const ctx: Contexto = {
    spec: v.spec,
    azar,
    fecha: v.fecha,
    horario,
    cliente,
    sitio,
    organizacion: t.organizacion,
    tecnico: t.nombre,
    ...(v.spec.ups ? { ups: v.spec.ups } : {}),
    ...(v.spec.visita ? { visita: v.spec.visita } : {}),
    medidas: v.spec.ups ? medicionesDeUps(v.spec.ups, azar) : new Map(),
    catalogo,
    pagina,
    // Un mapa por sitio, como pediría el teléfono; si el entorno no tiene mapas, la foto sale sin él (ADR-0052).
    mapa: () => {
      const clave = `${v.spec.cliente}:${v.spec.sitio}`;
      if (!mapas.has(clave)) {
        const centro = CENTROS[sitio.ciudad];
        mapas.set(
          clave,
          t.api
            .llamar("mapaDeLlegada", { consulta: { lat: Math.round((centro.lat + sitio.corrimiento[0] / 1000) * 1000) / 1000, lon: Math.round((centro.lon + sitio.corrimiento[1] / 1000) * 1000) / 1000 } })
            .then((m) => ({ imagen: m.imagen, atribucion: m.atribucion }))
            .catch(() => null),
        );
      }
      return mapas.get(clave)!;
    },
    archivos: [],
  };
  const { respuestas, repeticiones } = await responder(formato, ctx);
  const invalidas = validarRespuestas(formato, respuestas, repeticiones);
  if (invalidas.length > 0) throw new Error(`las respuestas generadas no pasan la validación: ${JSON.stringify(invalidas)}`);
  for (const archivo of ctx.archivos) await subir(t, archivo);
  const creadoEn = enBogota(v.fecha, horario.desde, 20).toISOString();
  const enviadoEn = enBogota(v.fecha, horario.hasta, 300).toISOString();
  try {
    await enviar(t, {
      tipo: "EnviarLevantamiento",
      llave: llaveDeEnvio(id),
      levantamiento: { id, formato: formato.formato, versionFormato: formato.version, visitaId: v.id, respuestas, ...(Object.keys(repeticiones).length ? { repeticiones } : {}), creadoEn, enviadoEn },
    });
  } catch (error) {
    // El técnico ya envió otro de esta visita (desde su teléfono, por ejemplo): se respeta el suyo.
    if (error instanceof ErrorApi && error.codigo === "estado_invalido") {
      avisos.push(`La visita ${v.spec.referencia} ya tenía otro levantamiento del técnico: no se revisa ni se publica desde aquí`);
      return undefined;
    }
    throw error;
  }
  contar("Levantamientos enviados", true);
  for (let i = 0; i < ctx.archivos.length; i++) contar("Archivos (fotos, croquis y firmas)", true);
  return id;
}

async function revisar(o: Persona, id: string, referencia: string) {
  let detalle = await o.api.llamar("obtenerLevantamiento", { parametros: { id } });
  if (detalle.estado === "revisado") return contar("Levantamientos revisados", false);
  if (detalle.revisor && detalle.revisor.id !== o.id) {
    avisos.push(`${referencia}: ${detalle.revisor.nombre} lo tiene en revisión; no se le quita`);
    return;
  }
  if (detalle.estado === "enviado") {
    await o.api.llamar("tomarLevantamiento", { parametros: { id }, cuerpo: { version: detalle.version } });
    detalle = await o.api.llamar("obtenerLevantamiento", { parametros: { id } });
  }
  await o.api.llamar("marcarRevisado", { parametros: { id }, cuerpo: { version: detalle.version } });
  contar("Levantamientos revisados", true);
}

const TEXTOS_DE_INFORME = {
  "servicio-ups": {
    introduccion: (v: VisitaLista) => `Presentamos el informe del servicio a la UPS realizado el ${diaLargo.format(enBogota(v.fecha, "12:00"))}, con las mediciones de entrada, salida y baterías.`,
    conclusiones: "El equipo queda operando en línea y sin alarmas. Las recomendaciones del técnico están en la sección de trabajo realizado.",
  },
  "visita-tecnica": {
    introduccion: (v: VisitaLista) => `Presentamos el informe de la visita técnica del ${diaLargo.format(enBogota(v.fecha, "12:00"))}, con el diagnóstico, la corrección y los materiales empleados.`,
    conclusiones: "El trabajo queda terminado y probado con el cliente. Cualquier ampliación se cotiza por aparte.",
  },
};

async function publicarInforme(o: Persona, v: VisitaLista, levantamientoId: string): Promise<{ id: string; numero: number } | undefined> {
  const { id } = await o.api.llamar("abrirInformeDeVisita", { cuerpo: { visitaId: v.id } });
  const informe = await o.api.llamar("obtenerInforme", { parametros: { id } });
  const vigente = informe.versiones.find((x) => !x.retirada);
  if (vigente) {
    contar("Informes publicados", false);
    return { id, numero: vigente.numero };
  }
  if (informe.versiones.length > 0) return undefined;
  const textos = TEXTOS_DE_INFORME[v.spec.formato];
  const guardado = await o.api.llamar("guardarInforme", {
    parametros: { id },
    cuerpo: { version: informe.version, introduccion: textos.introduccion(v), conclusiones: textos.conclusiones, levantamientos: [levantamientoId], planos: [] },
  });
  // Sin destinatarios: el PDF queda en oficina y no le llega a nadie.
  const version = await o.api.llamar("publicarInforme", { parametros: { id }, cuerpo: { version: guardado.version, destinatarios: [] } });
  contar("Informes publicados", true);
  return { id, numero: version.numero };
}

async function publicarCotizacion(o: Persona, v: VisitaLista, catalogo: Map<string, { precio: number }>) {
  const { visitas } = await o.api.llamar("visitasParaCotizar");
  const paraCotizar = visitas.find((x) => x.visitaId === v.id);
  if (!paraCotizar) throw new Error("la visita no tiene cantidades revisadas para cotizar");
  const { cotizaciones } = await o.api.llamar("listarCotizaciones");
  const previa = cotizaciones.find((c) => paraCotizar.cotizaciones.includes(c.numero));
  if (previa && (previa.vigente !== null || previa.todasRetiradas)) return contar("Cotizaciones publicadas", false);
  const id = previa?.id ?? (await o.api.llamar("crearCotizacion", { cuerpo: { visitaId: v.id } })).id;
  const cotizacion = await o.api.llamar("obtenerCotizacion", { parametros: { id } });
  // Oficina escribe el precio de lo que no lo trae del catálogo.
  const lineas = cotizacion.lineas.map((l) => ({ ...l, precio: l.precio ?? (l.codigo ? catalogo.get(l.codigo)?.precio : undefined) ?? PRECIOS_LIBRES[l.descripcion] ?? 10_000 }));
  const guardada = await o.api.llamar("guardarCotizacion", {
    parametros: { id },
    cuerpo: { version: cotizacion.version, lineas, impuestos: { tipo: "iva" }, condiciones: { validezDias: 30, formaPago: "50 % de anticipo y saldo contra entrega", notas: "Incluye mano de obra, certificación de los puntos y marcación." } },
  });
  await o.api.llamar("publicarCotizacion", { parametros: { id }, cuerpo: { version: guardada.version, destinatarios: [] } });
  contar("Cotizaciones publicadas", true);
}

// Corrida ------------------------------------------------------------------------------------------

console.log(`Datos de demostración contra ${REMOTO ? `${SUPERFICIES.tecnico.base} y ${SUPERFICIES.oficina.base}` : "el sistema local"}`);
const guardadas = leerSesiones();
mkdirSync(CARPETA, { recursive: true, mode: 0o700 });
chmodSync(CARPETA, 0o700);
const guardar = (usuario: string, cookies: Map<string, string>) => {
  guardadas[usuario] = Object.fromEntries(cookies);
  writeFileSync(ARCHIVO_DE_SESIONES, JSON.stringify(guardadas), { mode: 0o600 });
  // `mode` solo aplica al crear el archivo: uno que ya existía queda igual de cerrado.
  chmodSync(ARCHIVO_DE_SESIONES, 0o600);
};
const tecnico = await conSesion("tecnico", guardadas, guardar);
const oficina = await conSesion("oficina", guardadas, guardar);
if (tecnico.organizacion !== oficina.organizacion) salirCon(`El técnico es de «${tecnico.organizacion}» y oficina de «${oficina.organizacion}»: deben ser de la misma organización`);
console.log(`Organización: ${oficina.organizacion}. Técnico: ${tecnico.nombre}. Oficina: ${oficina.nombre}${oficina.administra ? " (administra)" : ""}.`);

console.log("Catálogo, clientes y visitas…");
await asegurarCatalogo(oficina);
const clientes = await asegurarClientes(oficina);
const visitas = await asegurarVisitas(oficina, tecnico, clientes);
const { formatos, items } = await bajar(tecnico);
const precios = new Map((await oficina.api.llamar("listarCatalogo")).items.map((i) => [i.codigo, { precio: i.precio?.valor ?? CATALOGO.find((c) => c.codigo === i.codigo)?.precio ?? 0 }]));
for (const [clave, f] of formatos) if (VISITAS.some((v) => v.formato === clave)) console.log(`Formato ${clave} v${f.version}`);

const pasadas = visitas.filter((v) => v.spec.dias < 0);
console.log(`Levantamientos de ${pasadas.length} visitas pasadas…`);
const navegador = await chromium.launch();
const pagina = await navegador.newPage();
const mapas = new Map<string, Promise<Mapa | null>>();
const levantamientos = new Map<string, string>();
try {
  for (const v of pasadas) {
    const id = await intentar(`Levantamiento ${v.spec.referencia}`, () => asegurarLevantamiento(oficina, tecnico, v, formatos, items, pagina, mapas));
    if (id) levantamientos.set(v.id, id);
    process.stdout.write(".");
  }
  process.stdout.write("\n");
} finally {
  await navegador.close();
}
if ([...mapas.values()].length > 0 && (await Promise.all(mapas.values())).every((m) => m === null)) avisos.push("El entorno no dio mapas (Geoapify): las fotos de llegada salen con la franja, sin el mapa");

console.log("Revisión, informes y cotizaciones…");
const publicados: { id: string; numero: number; referencia: string }[] = [];
for (const v of pasadas) {
  const id = levantamientos.get(v.id);
  if (!id || !v.spec.revisar) continue;
  await intentar(`Revisión ${v.spec.referencia}`, () => revisar(oficina, id, v.spec.referencia));
}
for (const v of pasadas) {
  const id = levantamientos.get(v.id);
  if (!id || !v.spec.informe) continue;
  const p = await intentar(`Informe ${v.spec.referencia}`, () => publicarInforme(oficina, v, id));
  if (p) publicados.push({ ...p, referencia: v.spec.referencia });
}
for (const v of pasadas) {
  if (!levantamientos.has(v.id) || !v.spec.cotizar) continue;
  await intentar(`Cotización ${v.spec.referencia}`, () => publicarCotizacion(oficina, v, precios));
}

// Como oficina: vuelve a mirar cada informe hasta que su PDF está listo.
const pdf = { listos: 0, fallidos: [] as string[], pendientes: [] as string[] };
const limite = Date.now() + 5 * 60_000;
for (const p of publicados) {
  for (;;) {
    const estado = (await oficina.api.llamar("obtenerInforme", { parametros: { id: p.id } })).versiones.find((x) => x.numero === p.numero)?.pdf;
    if (estado === "listo") pdf.listos++;
    else if (estado === "fallido") pdf.fallidos.push(p.referencia);
    else if (Date.now() > limite) pdf.pendientes.push(p.referencia);
    else {
      await esperar(2_000);
      continue;
    }
    break;
  }
}

console.log("\nResumen");
for (const [que, c] of cuenta) console.log(`  ${que.padEnd(34)} ${String(c.creados).padStart(3)} creados   ${String(c.existian).padStart(3)} ya existían`);
console.log(`  ${"PDF de informes".padEnd(34)} ${String(pdf.listos).padStart(3)} listos     ${String(pdf.fallidos.length).padStart(3)} fallidos ${pdf.pendientes.length ? `  ${pdf.pendientes.length} sin terminar: ${pdf.pendientes.join(", ")}` : ""}`);
const bandeja = await oficina.api.llamar("listarLevantamientos", { consulta: { estado: "enviado" } });
console.log(`  En la bandeja sin revisar: ${bandeja.elementos.filter((e) => [...levantamientos.values()].includes(e.id)).length} de la demostración`);
for (const a of avisos) console.log(`Aviso: ${a}`);
for (const f of pdf.fallidos) errores.push(`PDF del informe ${f}: falló`);
for (const e of errores) console.log(`Error: ${e}`);
process.exit(errores.length > 0 ? 1 : 0);
