import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Capturas de pantalla de los manuales (docs/manual). No es una prueba: recorre el sistema con datos inventados que
 * parecen reales (R5: ningún cliente ni persona real) y guarda las imágenes en el orden del manual.
 *
 * Dos modos, con CAPTURAS_FORMATOS:
 * - «prueba» (por omisión): los formatos ficticios de `paquetes/dominio/formatos-de-prueba`; las imágenes van a
 *   `docs/manual/capturas`, que se versiona.
 * - «reales»: los formatos de TEINS de `datos-reales/formatos` (confidenciales, fuera de git); las imágenes van a
 *   `privado/manual-capturas`, también fuera de git. Nunca a docs/.
 *
 * Todo vive en una organización propia de cada modo, que se vacía al empezar: la de desarrollo la usan `sembrar` y el
 * extremo a extremo, y los formatos reales ahí los romperían.
 */
export const MODO: "prueba" | "reales" = process.env.CAPTURAS_FORMATOS === "reales" ? "reales" : "prueba";

const raiz = new URL("../../", import.meta.url).pathname;
export const SALIDA = MODO === "reales" ? `${raiz}privado/manual-capturas` : `${raiz}docs/manual/capturas`;
export const ORGANIZACION = MODO === "reales" ? "00000000-0000-4000-8000-0000000000c2" : "00000000-0000-4000-8000-0000000000c1";

/** Los dos formatos vigentes de la organización, como en TEINS: el de servicio (A) y el general de visita (B). */
export const FORMATOS =
  MODO === "reales"
    ? [`${raiz}datos-reales/formatos/servicio-ups.v1.json`, `${raiz}datos-reales/formatos/visita-tecnica.v1.json`]
    : [`${raiz}paquetes/dominio/formatos-de-prueba/prueba-ups.v10.json`, `${raiz}paquetes/dominio/formatos-de-prueba/prueba-visita.v1.json`];
export const SIMBOLOS = `${raiz}paquetes/dominio/formatos-de-prueba/simbolos-prueba.json`;

// Definición mínima de un formato, para recorrerlo sin saber cuál es.
export interface CampoDeFormato {
  clave: string;
  etiqueta: string;
  tipo: string;
  obligatorio?: boolean;
  unidades?: string[];
  opciones?: string[];
  otro?: boolean;
  puestos?: string[];
  sello?: unknown;
  valoresComunes?: string[];
  largo?: boolean;
}
export interface SeccionDeFormato {
  clave: string;
  titulo: string;
  repetible?: { etiqueta: string; min?: number; max?: number };
  tablas?: { titulo?: string; columnas: string[]; filas: { etiqueta: string; campos: string[] }[] }[];
  campos: CampoDeFormato[];
}
export interface Formato {
  formato: string;
  version: number;
  nombre: string;
  secciones: SeccionDeFormato[];
}
export const leerFormato = (ruta: string): Formato => JSON.parse(readFileSync(ruta, "utf8")) as Formato;

/** Usuarios: distintos por modo porque el usuario es único en toda la base. */
const u = (usuario: string) => (MODO === "reales" ? `${usuario}.r` : usuario);
export const PERSONAS = {
  tecnico: { usuario: u("andres.ruiz"), nombre: "Andrés Ruiz Cárdenas" },
  tecnico2: { usuario: u("sebastian.moreno"), nombre: "Sebastián Moreno Quintero" },
  tecnico3: { usuario: u("yeison.castano"), nombre: "Yeison Castaño Rojas" },
  /** Administra, con el segundo factor activado por la API al preparar los datos. */
  admin: { usuario: u("paula.restrepo"), nombre: "Paula Andrea Restrepo" },
  /** Administra y activa su segundo factor en pantalla (las capturas de esa sección). */
  admin2: { usuario: u("juliana.vargas"), nombre: "Juliana Vargas Ospina" },
  /** Oficina, con contraseña temporal: la captura de «Cree su contraseña». */
  oficina: { usuario: u("camilo.herrera"), nombre: "Camilo Herrera Díaz" },
};
/** Contraseña de quienes se crean por comando: local, de una base de desarrollo. */
export const CONTRASENA = "Capturas-del-manual-2026";
/** La que elige quien entra con una temporal. */
export const CONTRASENA_NUEVA = "Mi-clave-de-campo-26";

export const CLIENTES = {
  clinica: {
    nombre: "Clínica Santa Lucía del Tolima",
    nit: "900.481.276-3",
    sitio: { nombre: "Sede principal", direccion: "Calle 37 # 5-24", ciudad: "Ibagué" },
    contacto: { nombre: "Laura Gómez Arango", cargo: "Jefe de mantenimiento", correo: "laura.gomez@clinicasantalucia.example", celular: "+573104567821" },
    otros: [
      { nombre: "Hernán Darío Lozano", cargo: "Director administrativo", correo: "hernan.lozano@clinicasantalucia.example", celular: "+573208841190", recibeInformes: true, recibeCotizaciones: true },
      { nombre: "Compras", cargo: "Área de compras", correo: "compras@clinicasantalucia.example", celular: null, recibeInformes: false, recibeCotizaciones: true },
    ],
  },
  bodegas: {
    nombre: "Bodegas El Totumo S.A.S.",
    nit: "901.233.518-0",
    sitio: { nombre: "Planta Mosquera", direccion: "Km 3 vía Funza, bodega 14", ciudad: "Mosquera" },
    contacto: { nombre: "Jorge Iván Peña", cargo: "Coordinador de planta", correo: "jorge.pena@bodegaseltotumo.example", celular: "+573006712244" },
    otros: [],
  },
  colegio: {
    nombre: "Colegio Bilingüe Los Ocobos",
    nit: "890.702.115-9",
    sitio: { nombre: "Sede campestre", direccion: "Vereda Llanitos, km 5 vía Rovira", ciudad: "Ibagué" },
    contacto: { nombre: "Diana Marcela Ortiz", cargo: "Administradora", correo: "diana.ortiz@colegiolosocobos.example", celular: "+573157789032" },
    otros: [],
  },
  hotel: {
    nombre: "Hotel Mirador del Combeima",
    nit: "900.917.364-1",
    sitio: { nombre: "Edificio principal", direccion: "Carrera 4 # 12-60", ciudad: "Ibagué" },
    contacto: { nombre: "Óscar Mauricio Téllez", cargo: "Jefe de operaciones", correo: "oscar.tellez@hotelmirador.example", celular: "+573118870345" },
    otros: [],
  },
} as const;

/** Catálogo de materiales: códigos inventados, precios en pesos sin IVA. */
export const CATALOGO = [
  { codigo: "CAB-3X12", descripcion: "Cable encauchetado 3x12 AWG", unidad: "m", precio: 9_800 },
  { codigo: "CAB-3X10", descripcion: "Cable encauchetado 3x10 AWG", unidad: "m", precio: 14_200 },
  { codigo: "BRK-2X40", descripcion: "Breaker 2x40 A", unidad: "und", precio: 68_500 },
  { codigo: "BRK-1X20", descripcion: "Breaker 1x20 A", unidad: "und", precio: 21_900 },
  { codigo: "CAN-40X25", descripcion: "Canaleta 40x25 mm con adhesivo", unidad: "m", precio: 7_600 },
  { codigo: "BAT-12V9", descripcion: "Batería sellada 12 V 9 Ah", unidad: "und", precio: 98_000 },
  { codigo: "TOM-GRD", descripcion: "Toma doble con polo a tierra grado hospitalario", unidad: "und", precio: 32_400 },
  { codigo: "TER-12", descripcion: "Terminal de ojo para cable 12 AWG", unidad: "und", precio: 650 },
  { codigo: "AMA-PLA", descripcion: "Amarre plástico 20 cm (bolsa x 100)", unidad: "und", precio: 12_300 },
  { codigo: "TUB-EMT34", descripcion: "Tubo EMT 3/4 pulgada", unidad: "und", precio: 18_900 },
  { codigo: "UNI-EMT34", descripcion: "Unión EMT 3/4 pulgada", unidad: "und", precio: 2_100 },
  { codigo: "UPS-10K", descripcion: "UPS en línea 10 kVA 208/120 V", unidad: "und" },
] as const;

/** Lo que se pasa del primer proyecto a los demás (en test-results, fuera de git). */
export interface Estado {
  secretoAdmin: string;
  temporalTecnico: string;
  temporalOficina: string;
  clientes: Record<keyof typeof CLIENTES, { id: string; sitioId: string; contactoId: string }>;
  visitas: { principal: string; segunda: string; manana: string; delSegundo: string; delTercero: string };
}
const archivoDeEstado = `${raiz}e2e/test-results/capturas-estado-${MODO}.json`;
export function guardarEstado(e: Estado) {
  mkdirSync(`${raiz}e2e/test-results`, { recursive: true });
  writeFileSync(archivoDeEstado, JSON.stringify(e, null, 2));
}
export const leerEstado = (): Estado => JSON.parse(readFileSync(archivoDeEstado, "utf8")) as Estado;

/** Hoy en Bogotá (AAAA-MM-DD), con `dias` de diferencia. */
export const dia = (dias = 0) => new Date(Date.now() + dias * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
/** La hora en punto de ahora en Bogotá, entre las 6 y las 19, para que la visita principal parezca la de ahora. */
export function horaDeAhora(): number {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Bogota" }));
  return Math.max(6, Math.min(19, h));
}
export const hhmm = (h: number, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/**
 * Guarda la captura `nombre` (sin extensión). `resaltar` marca con un contorno rojo el botón o el dato del que habla el
 * manual; `elemento` recorta la imagen a ese elemento. No cambia nada de la aplicación: solo el estilo de la captura
 * (el contorno, el cursor de texto y las notificaciones pasajeras, que taparían lo que se explica).
 */
export async function capturar(page: Page, nombre: string, { resaltar = [], elemento, completa = false }: { resaltar?: Locator | Locator[]; elemento?: Locator; completa?: boolean } = {}) {
  const marcas = Array.isArray(resaltar) ? resaltar : [resaltar];
  for (const m of marcas) await m.first().scrollIntoViewIfNeeded();
  for (const m of marcas) await m.first().evaluate((el) => el.setAttribute("data-captura-resaltado", ""));
  const estilo = await page.addStyleTag({ content: "[data-captura-resaltado]{outline:3px solid #e5484d !important;outline-offset:3px !important;border-radius:6px} *,*::before,*::after{caret-color:transparent !important} .bg-notificacion{visibility:hidden !important}" });
  // Sin el campo enfocado de lo último que se escribió (selección resaltada).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // Termina lo que se esté moviendo (transiciones de vista y hojas que suben).
  await page.waitForTimeout(700);
  mkdirSync(SALIDA, { recursive: true });
  const ruta = `${SALIDA}/${nombre}.png`;
  if (elemento) await elemento.screenshot({ path: ruta, animations: "disabled" });
  else await page.screenshot({ path: ruta, animations: "disabled", fullPage: completa });
  for (const m of marcas) await m.first().evaluate((el) => el.removeAttribute("data-captura-resaltado")).catch(() => undefined);
  await estilo.evaluate((el) => (el as Element).remove()).catch(() => undefined);
}

/** Espera a que algo esté a la vista; con un mensaje que dice qué captura no se pudo hacer. */
export async function aLaVista(l: Locator, timeout = 20_000) {
  await expect(l.first()).toBeVisible({ timeout });
}

/**
 * Una foto inventada que parece de una visita, dibujada en el navegador: fachada, acceso, equipo, placa o tablero.
 * Cada una lleva un poco de ruido, así que nunca se repite (los archivos se direccionan por contenido).
 */
export async function fotoInventada(page: Page, que: string): Promise<Buffer> {
  const tipo = /fachada/i.test(que) ? "fachada" : /acceso|entrada|puerta/i.test(que) ? "acceso" : /placa|serial/i.test(que) ? "placa" : /tablero|breaker|barraje/i.test(que) ? "tablero" : /bater/i.test(que) ? "baterias" : "equipo";
  const datos = await page.evaluate((tipo) => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 768;
    const g = c.getContext("2d")!;
    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      g.fillStyle = color;
      g.fillRect(x, y, w, h);
    };
    const degradado = (y0: number, y1: number, a: string, b: string) => {
      const d = g.createLinearGradient(0, y0, 0, y1);
      d.addColorStop(0, a);
      d.addColorStop(1, b);
      return d;
    };
    if (tipo === "fachada") {
      g.fillStyle = degradado(0, 420, "#8fbbe3", "#d9e9f5");
      g.fillRect(0, 0, 1024, 768);
      rect(120, 150, 780, 470, "#e8e1d3");
      rect(120, 130, 780, 30, "#9b3d2f");
      for (let f = 0; f < 3; f++) for (let k = 0; k < 6; k++) rect(160 + k * 122, 190 + f * 120, 80, 80, "#5d7a92");
      rect(440, 470, 140, 150, "#4a3a2c");
      rect(120, 600, 780, 20, "#b9b0a0");
      rect(0, 620, 1024, 148, "#7f7f7a");
      rect(0, 690, 1024, 8, "#e6e6e0");
      g.fillStyle = "#1f3b2b";
      for (let k = 0; k < 4; k++) {
        g.beginPath();
        g.arc(60 + k * 300, 600, 55, 0, Math.PI * 2);
        g.fill();
      }
    } else if (tipo === "acceso") {
      rect(0, 0, 1024, 768, "#d8d4cb");
      g.fillStyle = degradado(0, 768, "#cfc9bd", "#a49d90");
      g.beginPath();
      g.moveTo(0, 768);
      g.lineTo(380, 420);
      g.lineTo(640, 420);
      g.lineTo(1024, 768);
      g.fill();
      rect(380, 120, 260, 300, "#efece6");
      rect(450, 170, 120, 250, "#6b5038");
      rect(545, 290, 12, 12, "#d6b45a");
      rect(0, 0, 380, 768, "#c4bfb4");
      rect(640, 0, 384, 768, "#c4bfb4");
      rect(80, 200, 140, 90, "#2f7a4a");
      g.fillStyle = "#ffffff";
      g.font = "bold 36px sans-serif";
      g.fillText("SALIDA", 92, 258);
    } else if (tipo === "placa") {
      rect(0, 0, 1024, 768, "#3b3f45");
      rect(170, 140, 684, 488, "#c9ccd1");
      g.strokeStyle = "#7d828a";
      g.lineWidth = 6;
      g.strokeRect(190, 160, 644, 448);
      g.fillStyle = "#1d2228";
      g.font = "bold 46px sans-serif";
      g.fillText("UPS ON-LINE  10 kVA", 230, 240);
      g.font = "32px sans-serif";
      const lineas = ["Entrada: 208/120 V  3F + N + T", "Salida: 208/120 V  60 Hz", "Baterías: 12 V 9 Ah x 16", "Serie: VT10K-2025-04187", "Fabricado: 2025-03"];
      lineas.forEach((t, i) => g.fillText(t, 230, 310 + i * 56));
    } else if (tipo === "tablero") {
      rect(0, 0, 1024, 768, "#bfc3c7");
      rect(220, 60, 584, 660, "#8e959c");
      rect(250, 90, 524, 600, "#e4e6e8");
      for (let f = 0; f < 6; f++)
        for (let k = 0; k < 2; k++) {
          rect(290 + k * 240, 130 + f * 90, 200, 60, "#2d3238");
          rect(370 + k * 240, 145 + f * 90, 40, 30, f % 3 === 0 ? "#c2402f" : "#f2f2f2");
        }
      g.strokeStyle = "#c2402f";
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(260, 680);
      g.bezierCurveTo(400, 600, 600, 720, 760, 640);
      g.stroke();
    } else if (tipo === "baterias") {
      rect(0, 0, 1024, 768, "#5a5f66");
      for (let f = 0; f < 2; f++)
        for (let k = 0; k < 4; k++) {
          rect(120 + k * 200, 140 + f * 280, 170, 220, "#1f2226");
          rect(140 + k * 200, 150 + f * 280, 30, 20, "#c2402f");
          rect(240 + k * 200, 150 + f * 280, 30, 20, "#2b2f35");
          g.fillStyle = "#d7d9dc";
          g.font = "22px sans-serif";
          g.fillText("12 V 9 Ah", 150 + k * 200, 260 + f * 280);
        }
    } else {
      g.fillStyle = degradado(0, 768, "#e9e7e2", "#c9c5bd");
      g.fillRect(0, 0, 1024, 768);
      rect(0, 600, 1024, 168, "#9c968b");
      rect(330, 110, 360, 560, "#2a2e33");
      rect(350, 140, 320, 120, "#3a4047");
      rect(380, 170, 160, 60, "#6fbf73");
      g.fillStyle = "#e9ecef";
      g.font = "bold 30px sans-serif";
      g.fillText("10 kVA", 548, 212);
      for (let k = 0; k < 9; k++) rect(360, 300 + k * 36, 300, 14, "#1d2024");
      rect(720, 380, 180, 290, "#3b4148");
      rect(740, 400, 140, 60, "#4c535b");
    }
    // Ruido fino: hace única cada foto.
    const img = g.getImageData(0, 0, 1024, 768);
    for (let i = 0; i < img.data.length; i += 4) {
      const r = (Math.random() - 0.5) * 14;
      for (let k = i; k < i + 3; k++) img.data[k] = img.data[k]! + r;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL("image/jpeg", 0.86).split(",")[1]!;
  }, tipo);
  return Buffer.from(datos, "base64");
}
