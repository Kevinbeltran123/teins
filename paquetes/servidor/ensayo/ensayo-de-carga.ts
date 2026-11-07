import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";
import { fotosReferenciadas } from "@teins/dominio";
import { crearClienteApi, ErrorApi, llaveDeEnvio, type ClienteApi } from "@teins/protocolo";
import { usuarioDelEnsayo, type RolDelEnsayo } from "../src/ensayo";

/*
  Ensayo de carga (iteración 51, QA-14): la temporada alta contra un sistema que corre de verdad, el local o el entorno
  de pruebas. Habla con el servidor solo por el contrato (`@teins/protocolo`), como las apps, y hace lo que ellas:
   - técnicos con señal: bajan, suben sus fotos de a una y envían;
   - técnicos sin señal: capturan sin tocar la red y la recuperan todos a la vez (la ráfaga de reconexión);
   - oficina: toma de la bandeja compartida, revisa, corrige, marca revisado y publica el informe (cada uno, un PDF).
  Mide cada operación, cuándo queda recibido cada envío y cuándo está listo cada PDF, y compara con las metas.

  Para repetirlo sin costo: corre en la organización del ensayo (`preparar-ensayo`, una vez por entorno), reusa las
  sesiones de la corrida anterior (no vuelve a iniciar sesión, que tiene límite de 5 por minuto), genera una sola foto
  con Chromium y saca las demás de ella, y cancela las visitas de hoy de la corrida anterior antes de programar las suyas.

    TEINS_CONTRASENA=... pnpm ensayo-de-carga [--con-senal 10] [--sin-senal 10] [--oficina 5] [--fotos 10]
                                              [--vuelven-a-los 20] [--limite-minutos 15] [--json ~/ensayo.json]
  Contra el entorno de pruebas: E2E_CAMPO_URL y E2E_OFICINA_URL, las mismas del extremo a extremo; con la CLI de
  Railway enlazada a ese entorno, además lee de sus registros el tiempo dentro del servidor.
*/

const { values } = parseArgs({
  options: {
    "con-senal": { type: "string", default: "10" },
    "sin-senal": { type: "string", default: "10" },
    oficina: { type: "string", default: "5" },
    fotos: { type: "string", default: "10" },
    "vuelven-a-los": { type: "string", default: "20" },
    "limite-minutos": { type: "string", default: "15" },
    json: { type: "string" },
  },
});
/** Un error de uso o de preparación se dice en una línea, como en los comandos del servidor: quien corre el ensayo sabe qué arreglar. */
function salirCon(mensaje: string): never {
  console.error(mensaje);
  process.exit(2);
}
const numero = (nombre: keyof typeof values, minimo: number) => {
  const n = Number(values[nombre]);
  if (!Number.isInteger(n) || n < minimo) salirCon(`--${nombre} debe ser un entero desde ${minimo}`);
  return n;
};
const ESCENARIO = {
  conSenal: numero("con-senal", 0),
  sinSenal: numero("sin-senal", 0),
  oficina: numero("oficina", 0),
  fotos: numero("fotos", 1),
  vuelvenALosSegundos: numero("vuelven-a-los", 0),
};
const LIMITE_MS = numero("limite-minutos", 1) * 60_000;
const CONTRASENA = process.env.TEINS_CONTRASENA;
if (!CONTRASENA) salirCon("Falta TEINS_CONTRASENA: la de los usuarios del ensayo (preparar-ensayo)");
if (ESCENARIO.oficina > ESCENARIO.conSenal + ESCENARIO.sinSenal) salirCon("Cada persona de oficina revisa un levantamiento: no puede haber más que técnicos");

/** Local (por defecto: el servidor en el puerto 3000 con el origen de cada superficie) o un entorno desplegado. */
const REMOTO = Boolean(process.env.E2E_CAMPO_URL);
if (REMOTO && !process.env.E2E_OFICINA_URL) salirCon("Con E2E_CAMPO_URL falta E2E_OFICINA_URL");
const SUPERFICIES: Record<RolDelEnsayo, { base: string; origen: string }> = REMOTO
  ? { tecnico: { base: process.env.E2E_CAMPO_URL!, origen: process.env.E2E_CAMPO_URL! }, oficina: { base: process.env.E2E_OFICINA_URL!, origen: process.env.E2E_OFICINA_URL! } }
  : { tecnico: { base: "http://localhost:3000", origen: "http://localhost:5173" }, oficina: { base: "http://localhost:3000", origen: "http://localhost:5174" } };
/** La versión de campo que declara el ensayo al bajar (paquetes/campo/src/version.ts). */
const VERSION_APP = 16;

const esperar = (ms: number) => new Promise((listo) => setTimeout(listo, ms));
const ahora = () => performance.now();

// Mediciones ---------------------------------------------------------------------------------------

interface Medicion {
  operacion: string;
  ms: number;
  /** Estado HTTP del error; 0 si no hubo respuesta. Sin valor, salió bien. */
  estado?: number;
  codigo?: string;
}
const mediciones: Medicion[] = [];

async function medir<T>(operacion: string, llamada: () => Promise<T>): Promise<T> {
  const inicio = ahora();
  try {
    const r = await llamada();
    mediciones.push({ operacion, ms: ahora() - inicio });
    return r;
  } catch (error) {
    mediciones.push({ operacion, ms: ahora() - inicio, estado: error instanceof ErrorApi ? error.problema.status : 0, ...(error instanceof ErrorApi ? { codigo: error.codigo } : {}) });
    throw error;
  }
}

/** Respuestas que son parte del protocolo y no fallas: esperar la verificación y la bandeja compartida (QA-25). */
const ESPERADAS = new Set(["archivos_en_verificacion", "tomado_por_otro", "conflicto_de_version"]);

// Sesiones -----------------------------------------------------------------------------------------

interface Persona {
  usuario: string;
  rol: RolDelEnsayo;
  id: string;
  api: ClienteApi;
  cookies: Map<string, string>;
}

/** Como el navegador: manda el origen de su superficie y guarda las cookies que fija el servidor. */
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

/** Las sesiones duran 30 días: se guardan fuera del repositorio y la siguiente corrida no vuelve a iniciarlas. */
const CARPETA = join(tmpdir(), "teins-ensayo");
const ARCHIVO_DE_SESIONES = join(CARPETA, `sesiones-${createHash("sha256").update(JSON.stringify(SUPERFICIES)).digest("hex").slice(0, 12)}.json`);
const leerSesiones = (): Record<string, Record<string, string>> => {
  try {
    return JSON.parse(readFileSync(ARCHIVO_DE_SESIONES, "utf8"));
  } catch {
    return {};
  }
};

async function conSesion(usuario: string, rol: RolDelEnsayo, guardadas: Record<string, Record<string, string>>): Promise<Persona> {
  const cookies = new Map(Object.entries(guardadas[usuario] ?? {}));
  const { base, origen } = SUPERFICIES[rol];
  const api = crearClienteApi({ base, fetch: fetchConCookies(origen, cookies) });
  for (;;) {
    try {
      const { usuario: datos } = await api.llamar("obtenerSesion");
      return { usuario, rol, id: datos.id, api, cookies };
    } catch (error) {
      if (!(error instanceof ErrorApi) || error.codigo !== "no_autenticado") throw error;
    }
    try {
      await api.iniciarSesion(usuario, CONTRASENA!);
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === "demasiadas_solicitudes") {
        console.log("  Límite de inicios de sesión (5 por minuto por dirección, QA-7): espero un minuto. Solo pasa la primera vez.");
        await esperar(61_000);
      } else if (error instanceof ErrorApi && error.problema.status === 401) {
        salirCon(`${usuario} no entra: corre preparar-ensayo con suficientes usuarios (y --restablecer si cambió la contraseña)`);
      } else throw error;
    }
  }
}

// Fotos --------------------------------------------------------------------------------------------

/**
 * Una escena de 1600 × 1200 con bordes, colores y grano, como una foto de un tablero: comprime como una foto real
 * (cientos de KB), con el mismo lado y la misma calidad que la cámara de campo (paquetes/campo/src/fotos/procesar.ts).
 */
const ESCENA = `(() => {
  const lienzo = document.createElement("canvas");
  lienzo.width = 1600;
  lienzo.height = 1200;
  const c = lienzo.getContext("2d");
  const azar = (n) => Math.floor(Math.random() * n);
  const fondo = c.createLinearGradient(0, 0, 1600, 1200);
  fondo.addColorStop(0, "#5b6670");
  fondo.addColorStop(1, "#c9c2b5");
  c.fillStyle = fondo;
  c.fillRect(0, 0, 1600, 1200);
  for (let i = 0; i < 400; i++) {
    c.fillStyle = "hsl(" + azar(360) + " " + azar(40) + "% " + (20 + azar(60)) + "%)";
    c.fillRect(azar(1600), azar(1200), 10 + azar(200), 10 + azar(200));
  }
  for (let i = 0; i < 300; i++) {
    c.strokeStyle = "hsl(" + azar(360) + " 30% " + azar(80) + "%)";
    c.lineWidth = 1 + azar(6);
    c.beginPath();
    c.moveTo(azar(1600), azar(1200));
    c.bezierCurveTo(azar(1600), azar(1200), azar(1600), azar(1200), azar(1600), azar(1200));
    c.stroke();
  }
  const imagen = c.getImageData(0, 0, 1600, 1200);
  for (let i = 0; i < imagen.data.length; i += 4) {
    const grano = (Math.random() - 0.5) * GRANO;
    imagen.data[i] += grano;
    imagen.data[i + 1] += grano;
    imagen.data[i + 2] += grano;
  }
  c.putImageData(imagen, 0, 0);
  return lienzo.toDataURL("image/jpeg", 0.8);
})()`;
const GRANO = 14;

async function fotoBase(): Promise<Buffer> {
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage();
    const url = (await pagina.evaluate(ESCENA.replace("GRANO", String(GRANO)))) as string;
    return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
  } finally {
    await navegador.close();
  }
}

/** Los mismos píxeles con otra huella: un segmento de comentario (COM) justo después del inicio de la imagen (SOI). */
function variante(base: Buffer): { datos: Buffer; huella: string } {
  const texto = Buffer.from(randomBytes(16).toString("hex"));
  const longitud = Buffer.alloc(2);
  longitud.writeUInt16BE(texto.length + 2);
  const datos = Buffer.concat([base.subarray(0, 2), Buffer.from([0xff, 0xfe]), longitud, texto, base.subarray(2)]);
  return { datos, huella: createHash("sha256").update(datos).digest("hex") };
}

// Lo que hace cada persona --------------------------------------------------------------------------

const puntoDeControl = new Map<string, number>();
/** Los levantamientos que el servidor aceptó: al final, cada uno debe abrirse desde oficina. */
const aceptados = new Set<string>();

async function bajar(t: Persona) {
  for (let pagina = 0; pagina < 20; pagina++) {
    const bajada = await medir("obtenerCambios", () => t.api.llamar("obtenerCambios", { consulta: { desde: puntoDeControl.get(t.usuario) ?? 0, app: VERSION_APP } }));
    puntoDeControl.set(t.usuario, bajada.puntoDeControl);
    if (!bajada.hayMas) return;
  }
}

/** Como el teléfono: pide la URL firmada, sube directo al almacenamiento y confirma (ADR-0007). */
async function subir(t: Persona, foto: { datos: Buffer; huella: string }) {
  const autorizacion = await medir("autorizarSubida", () => t.api.llamar("autorizarSubida", { cuerpo: { huella: foto.huella, bytes: foto.datos.length, tipo: "image/jpeg" } }));
  if (autorizacion.estado !== "autorizada") return;
  await medir("subirAlAlmacenamiento", async () => {
    const r = await fetch(autorizacion.url, { method: "PUT", headers: autorizacion.cabeceras, body: new Uint8Array(foto.datos) });
    if (!r.ok) throw new Error(`El almacenamiento respondió ${r.status}`);
  });
  await medir("confirmarSubida", () => t.api.llamar("confirmarSubida", { parametros: { huella: foto.huella } }));
}

/** Como el teléfono (paquetes/campo/src/sincronizacion/motor.ts): mientras se verifican las fotos espera y reintenta con la misma llave. */
async function enviar(t: Persona, id: string, visitaId: string, huellas: string[]) {
  const comando = {
    tipo: "EnviarLevantamiento" as const,
    llave: llaveDeEnvio(id),
    levantamiento: {
      id,
      formato: "prueba-ups",
      versionFormato: 1,
      visitaId,
      respuestas: { cuarto_tecnico: { descripcion: "Levantamiento del ensayo de carga", potencia_nominal: { valor: "12.5", unidad: "kVA" }, fotos_equipo: huellas } },
      creadoEn: new Date().toISOString(),
      enviadoEn: new Date().toISOString(),
    },
  };
  for (let intentos = 1; ; intentos++) {
    try {
      await medir("enviarComando", () => t.api.llamar("enviarComando", { cuerpo: comando }));
      aceptados.add(id);
      return;
    } catch (error) {
      if (!(error instanceof ErrorApi) || error.codigo !== "archivos_en_verificacion") throw error;
      const pedida = (error.problema.reintentarEnSegundos ?? 5) * 1000;
      await esperar(Math.max(pedida, Math.min(300_000, 2000 * 2 ** intentos) * (0.5 + Math.random() * 0.5)));
    }
  }
}

const tiempos = { conSenal: [] as number[], sinSenal: [] as number[], pdf: [] as number[] };
type Trabajo = { id: string; visitaId: string; fotos: { datos: Buffer; huella: string }[] };

async function tecnicoConSenal(t: Persona, { id, visitaId, fotos }: Trabajo) {
  // Nadie empieza en el mismo milisegundo.
  await esperar(Math.random() * 5_000);
  await bajar(t);
  for (const foto of fotos) await subir(t, foto);
  const ultimaFoto = ahora();
  await enviar(t, id, visitaId, fotos.map((f) => f.huella));
  tiempos.conSenal.push(ahora() - ultimaFoto);
  await bajar(t);
}

/** Capturó sin señal, así que no tocó la red; la recupera a la vez que los demás y hace lo del teléfono: sube, envía y baja. */
async function tecnicoSinSenal(t: Persona, { id, visitaId, fotos }: Trabajo, vuelveLaSenal: number) {
  await esperar(vuelveLaSenal - ahora());
  const volvio = ahora();
  for (const foto of fotos) await subir(t, foto);
  await enviar(t, id, visitaId, fotos.map((f) => f.huella));
  tiempos.sinSenal.push(ahora() - volvio);
  await bajar(t);
}

/** Toma uno de la bandeja compartida (si otra persona lo tomó primero, sigue con otro), lo revisa y publica su informe. */
async function revisora(o: Persona, turno: number, deEsteEnsayo: ReadonlySet<string>) {
  let elegido: { id: string; visitaId: string } | undefined;
  while (!elegido) {
    const bandeja = await medir("listarLevantamientos", () => o.api.llamar("listarLevantamientos", { consulta: { estado: "enviado" } }));
    const libres = bandeja.elementos.filter((e) => !e.revisor && e.visita && deEsteEnsayo.has(e.id));
    const candidato = libres[turno % Math.max(libres.length, 1)];
    if (!candidato) {
      await esperar(5_000);
      continue;
    }
    try {
      await medir("tomarLevantamiento", () => o.api.llamar("tomarLevantamiento", { parametros: { id: candidato.id }, cuerpo: { version: candidato.version } }));
      elegido = { id: candidato.id, visitaId: candidato.visita!.id };
    } catch (error) {
      if (!(error instanceof ErrorApi) || !ESPERADAS.has(error.codigo)) throw error;
    }
  }
  const tomado = elegido;
  const detalle = await medir("obtenerLevantamiento", () => o.api.llamar("obtenerLevantamiento", { parametros: { id: tomado.id } }));
  // Como la pantalla: la URL de cada foto a la vez, y cada foto se descarga del almacenamiento.
  await Promise.all(
    fotosReferenciadas(detalle.respuestas).map(async (huella) => {
      const { url } = await medir("urlDeArchivo", () => o.api.llamar("urlDeArchivo", { parametros: { huella } }));
      await medir("descargarDelAlmacenamiento", async () => {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`El almacenamiento respondió ${r.status}`);
        await r.arrayBuffer();
      });
    }),
  );
  const corregido = await medir("corregirLevantamiento", () =>
    o.api.llamar("corregirLevantamiento", { parametros: { id: tomado.id }, cuerpo: { version: detalle.version, correcciones: [{ seccion: "cuarto_tecnico", campo: "descripcion", valor: "Revisado en el ensayo de carga" }] } }),
  );
  await medir("marcarRevisado", () => o.api.llamar("marcarRevisado", { parametros: { id: tomado.id }, cuerpo: { version: corregido.version } }));

  const { id: informeId } = await medir("abrirInformeDeVisita", () => o.api.llamar("abrirInformeDeVisita", { cuerpo: { visitaId: tomado.visitaId } }));
  const informe = await medir("obtenerInforme", () => o.api.llamar("obtenerInforme", { parametros: { id: informeId } }));
  const guardado = await medir("guardarInforme", () =>
    o.api.llamar("guardarInforme", { parametros: { id: informeId }, cuerpo: { version: informe.version, introduccion: "", conclusiones: "", levantamientos: [tomado.id], planos: [] } }),
  );
  const version = await medir("publicarInforme", () => o.api.llamar("publicarInforme", { parametros: { id: informeId }, cuerpo: { version: guardado.version } }));
  const publicado = ahora();
  // Como oficina: vuelve a mirar el informe hasta que su PDF está listo.
  for (;;) {
    await esperar(2_000);
    const actual = await medir("obtenerInforme", () => o.api.llamar("obtenerInforme", { parametros: { id: informeId } }));
    const pdf = actual.versiones.find((v) => v.numero === version.numero)?.pdf;
    if (pdf === "fallido") throw new Error(`El PDF de la versión ${version.numero} falló`);
    if (pdf === "listo") break;
  }
  tiempos.pdf.push(ahora() - publicado);
}

// Preparación de la corrida ------------------------------------------------------------------------

/** Hoy en Colombia (AAAA-MM-DD), como lo programa oficina. */
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

async function programarVisitas(o: Persona, tecnicos: Persona[]): Promise<Map<string, string>> {
  const clientes = await o.api.llamar("listarClientes");
  const existente = clientes.clientes.find((c) => c.nombre === "Cliente del ensayo");
  const { clienteId, sitioId } = existente
    ? { clienteId: existente.id, sitioId: existente.sitios[0]!.id }
    : await o.api.llamar("crearCliente", { cuerpo: { nombre: "Cliente del ensayo", sitio: { nombre: "Sede del ensayo", direccion: "Calle [N] # [N]-[N]" } } }).then((c) => ({ clienteId: c.id, sitioId: c.sitios[0]!.id }));
  // Un técnico no puede tener dos visitas a la misma hora: las de hoy de la corrida anterior se cancelan.
  const { visitas } = await o.api.llamar("listarVisitas", { consulta: { vista: "proximas", hoy: hoy() } });
  for (const v of visitas.filter((v) => v.programadaPara === hoy() && !v.cancelada)) {
    await o.api.llamar("cancelarVisita", { parametros: { id: v.id }, cuerpo: { version: v.version, motivo: "Corrida anterior del ensayo de carga" } });
  }
  const porTecnico = new Map<string, string>();
  // El servicio es el formato que llena el ensayo (ADR-0057).
  const { servicios } = await o.api.llamar("serviciosParaProgramar");
  const formato = servicios.find((s) => s.clave === "prueba-ups")?.clave ?? servicios[0]!.clave;
  for (const t of tecnicos) {
    const visita = await o.api.llamar("programarVisita", { cuerpo: { clienteId, sitioId, formato, programadaPara: hoy(), tecnicos: [t.id] } });
    porTecnico.set(t.usuario, visita.id);
  }
  return porTecnico;
}

// Informe ------------------------------------------------------------------------------------------

const percentil = (valores: number[], p: number) => {
  const orden = [...valores].sort((a, b) => a - b);
  return orden.length === 0 ? Number.NaN : orden[Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1))]!;
};
/** Sin valores (un escenario sin técnicos sin señal, por ejemplo) no hay máximo: se lee «sin datos». */
const maximo = (valores: number[]) => (valores.length === 0 ? Number.NaN : Math.max(...valores));
const duracion = (ms: number) => (Number.isNaN(ms) ? "sin datos" : ms < 1_000 ? `${Math.round(ms)} ms` : ms < 60_000 ? `${(ms / 1_000).toFixed(1).replace(".", ",")} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1_000)} s`);
const horaColombia = (fecha: Date) => fecha.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour12: false });

/** Lo que oficina consulta mientras trabaja: debe responder en menos de un segundo aunque campo esté en ráfaga. */
const CONSULTAS_DE_OFICINA = new Set(["listarLevantamientos", "obtenerLevantamiento", "urlDeArchivo", "obtenerInforme"]);
/** Las mismas consultas, como las registra el servidor (método y ruta, sin ids). */
const RUTAS_DE_OFICINA = new Set(["GET /api/levantamientos", "GET /api/levantamientos/:id", "GET /api/archivos/:huella/url", "GET /api/informes/:id"]);

/**
 * Desde una sola conexión, los tiempos que ve el ensayo incluyen el internet de quien lo corre: los veinte técnicos suben
 * sus fotos por ella, y en la realidad cada uno tiene la suya. Contra Railway, el tiempo dentro del servidor sale de sus
 * registros (el `responseTime` de cada solicitud), con la CLI enlazada al proyecto; las metas de tiempo se evalúan con
 * él. Sin la CLI, o si sus registros son de otro entorno, queda solo lo que se vio desde aquí.
 */
function tiemposDelServidor(desde: Date, hasta: Date): Map<string, number[]> | null {
  const porRuta = new Map<string, number[]>();
  const minutos = Math.ceil((Date.now() - desde.getTime()) / 60_000) + 1;
  for (const [servicio, { base }] of [["campo", SUPERFICIES.tecnico], ["oficina", SUPERFICIES.oficina]] as const) {
    let salida: string;
    try {
      // Railway entrega a lo sumo 5000 líneas, las más recientes: el escenario por defecto deja unas 900 en campo.
      salida = execFileSync("railway", ["logs", "-s", servicio, "--json", "--since", `${minutos}m`, "-n", "5000"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return null;
    }
    const lineas = salida.split("\n").flatMap((l) => {
      try {
        return [JSON.parse(l) as { message?: string; correlacion?: string; time?: number; responseTime?: number; req?: { host?: string; method?: string; url?: string } }];
      } catch {
        return [];
      }
    });
    const host = new URL(base).host;
    const rutas = new Map(
      lineas.flatMap((l) =>
        l.message === "incoming request" && l.req?.host === host && l.correlacion
          ? [[l.correlacion, `${l.req.method} ${(l.req.url ?? "").split("?")[0]!.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id").replace(/[0-9a-f]{64}/g, ":huella")}`] as const]
          : [],
      ),
    );
    for (const l of lineas) {
      const ruta = l.correlacion ? rutas.get(l.correlacion) : undefined;
      if (l.message !== "request completed" || !ruta || typeof l.responseTime !== "number" || !l.time || l.time < desde.getTime() || l.time > hasta.getTime()) continue;
      porRuta.set(ruta, [...(porRuta.get(ruta) ?? []), l.responseTime]);
    }
  }
  return porRuta.size > 0 ? porRuta : null;
}

// Corrida ------------------------------------------------------------------------------------------

const tecnicosPorUsar = ESCENARIO.conSenal + ESCENARIO.sinSenal;
console.log(`Ensayo de carga contra ${REMOTO ? `${SUPERFICIES.tecnico.base} y ${SUPERFICIES.oficina.base}` : "el sistema local"}`);
console.log(`Sesiones: ${tecnicosPorUsar} técnicos y ${ESCENARIO.oficina} personas de oficina…`);
const guardadas = leerSesiones();
const tecnicos: Persona[] = [];
for (let n = 1; n <= tecnicosPorUsar; n++) tecnicos.push(await conSesion(usuarioDelEnsayo("tecnico", n), "tecnico", guardadas));
const oficina: Persona[] = [];
for (let n = 1; n <= Math.max(ESCENARIO.oficina, 1); n++) oficina.push(await conSesion(usuarioDelEnsayo("oficina", n), "oficina", guardadas));
mkdirSync(CARPETA, { recursive: true });
// Se conservan las de quien no participó: una corrida chica no obliga a la siguiente a volver a iniciar sesiones.
const vigentes = { ...guardadas, ...Object.fromEntries([...tecnicos, ...oficina].map((p) => [p.usuario, Object.fromEntries(p.cookies)])) };
writeFileSync(ARCHIVO_DE_SESIONES, JSON.stringify(vigentes), { mode: 0o600 });

console.log("Visitas de hoy y fotos…");
const visitas = await programarVisitas(oficina[0]!, tecnicos);
const base = await fotoBase();
const kb = Math.round(base.length / 1024);
// Cada técnico, su levantamiento con su id desde ya: oficina solo toma los de esta corrida.
const trabajos = new Map<string, Trabajo>(tecnicos.map((t) => [t.usuario, { id: randomUUID(), visitaId: visitas.get(t.usuario)!, fotos: Array.from({ length: ESCENARIO.fotos }, () => variante(base)) }]));
const delEnsayo = new Set([...trabajos.values()].map((t) => t.id));

console.log(
  `Escenario: ${ESCENARIO.conSenal} técnicos con señal, ${ESCENARIO.sinSenal} sin señal que la recuperan a los ${ESCENARIO.vuelvenALosSegundos} s y ${ESCENARIO.oficina} personas de oficina; ${ESCENARIO.fotos} fotos de ${kb} KB por levantamiento.`,
);
const inicioReloj = new Date();
const inicio = ahora();
const vuelveLaSenal = inicio + ESCENARIO.vuelvenALosSegundos * 1000;
const recorridos = [
  ...tecnicos.slice(0, ESCENARIO.conSenal).map((t) => tecnicoConSenal(t, trabajos.get(t.usuario)!)),
  ...tecnicos.slice(ESCENARIO.conSenal).map((t) => tecnicoSinSenal(t, trabajos.get(t.usuario)!, vuelveLaSenal)),
  ...oficina.slice(0, ESCENARIO.oficina).map((o, turno) => revisora(o, turno, delEnsayo)),
];
const limite = esperar(LIMITE_MS).then(() => "limite" as const);
const resultado = await Promise.race([Promise.allSettled(recorridos), limite]);
const finReloj = new Date();
const total = ahora() - inicio;

// Ninguno perdido: cada levantamiento que el servidor aceptó se puede abrir desde oficina.
let perdidos = 0;
for (const id of aceptados) {
  try {
    await oficina[0]!.api.llamar("obtenerLevantamiento", { parametros: { id } });
  } catch {
    perdidos++;
  }
}

const fallas = resultado === "limite" ? [`Se pasó el límite de ${values["limite-minutos"]} minutos sin terminar`] : resultado.flatMap((r) => (r.status === "rejected" ? [String(r.reason instanceof Error ? r.reason.message : r.reason)] : []));
const errores5xx = mediciones.filter((m) => (m.estado ?? 0) >= 500).length;
const inesperadas = mediciones.filter((m) => m.estado !== undefined && m.estado < 500 && !ESPERADAS.has(m.codigo ?? "")).length;
const consultasDeOficina = mediciones.filter((m) => CONSULTAS_DE_OFICINA.has(m.operacion) && m.estado === undefined).map((m) => m.ms);
const delServidor = REMOTO ? tiemposDelServidor(inicioReloj, finReloj) : null;
const oficinaEnServidor = delServidor ? [...delServidor].filter(([ruta]) => RUTAS_DE_OFICINA.has(ruta)).flatMap(([, ms]) => ms) : [];
// La meta de oficina se mide donde no pesa el internet de quien corre el ensayo: en el servidor si hay registros.
const oficinaMedida = oficinaEnServidor.length > 0 ? oficinaEnServidor : consultasDeOficina;
const metas = [
  { meta: "Errores del servidor (5xx)", medido: String(errores5xx), objetivo: "0", cumple: errores5xx === 0 },
  { meta: "Otras respuestas inesperadas", medido: String(inesperadas), objetivo: "0", cumple: inesperadas === 0 },
  { meta: "Recorridos que no terminaron", medido: String(fallas.length), objetivo: "0", cumple: fallas.length === 0 },
  { meta: "Levantamientos perdidos", medido: String(perdidos), objetivo: "0", cumple: perdidos === 0 },
  { meta: "Sin señal: recibido tras recuperarla (máx.)", medido: duracion(maximo(tiempos.sinSenal)), objetivo: "< 5 min", cumple: tiempos.sinSenal.length === ESCENARIO.sinSenal && tiempos.sinSenal.every((t) => t < 300_000) },
  { meta: "PDF listo tras publicar (máx.)", medido: duracion(maximo(tiempos.pdf)), objetivo: "< 3 min", cumple: tiempos.pdf.length === ESCENARIO.oficina && tiempos.pdf.every((t) => t < 180_000) },
  {
    meta: oficinaEnServidor.length > 0 ? "Oficina: consultas, dentro del servidor (p95)" : "Oficina: consultas (p95)",
    medido: duracion(percentil(oficinaMedida, 95)),
    objetivo: "< 1 s",
    cumple: oficinaMedida.length === 0 || percentil(oficinaMedida, 95) < 1_000,
  },
  ...(oficinaEnServidor.length > 0 ? [{ meta: "Oficina: consultas, vistas desde aquí (p95)", medido: duracion(percentil(consultasDeOficina, 95)), objetivo: "con tu internet", cumple: true }] : []),
  { meta: "Con señal: recibido tras la última foto (p95)", medido: duracion(percentil(tiempos.conSenal, 95)), objetivo: "sin meta", cumple: true },
];

const operaciones = [...new Set(mediciones.map((m) => m.operacion))].sort().map((operacion) => {
  const propias = mediciones.filter((m) => m.operacion === operacion);
  const ms = propias.map((m) => m.ms);
  return { operacion, n: propias.length, p50: percentil(ms, 50), p95: percentil(ms, 95), max: Math.max(...ms), fallas: propias.filter((m) => m.estado !== undefined).length };
});

console.log(`\nDe ${horaColombia(inicioReloj)} a ${horaColombia(finReloj)} (hora de Colombia), ${duracion(total)}. ${REMOTO ? "La memoria y la CPU de cada servicio están en las métricas de Railway en esa ventana." : ""}\n`);
for (const m of metas) console.log(`${m.cumple ? "✓" : "✗"} ${m.meta.padEnd(48)} ${m.medido.padEnd(12)} ${m.objetivo}`);
console.log(`\n${"Operación".padEnd(28)}${"n".padStart(6)}${"p50".padStart(10)}${"p95".padStart(10)}${"máx.".padStart(10)}${"fallas".padStart(8)}`);
for (const o of operaciones) console.log(`${o.operacion.padEnd(28)}${String(o.n).padStart(6)}${duracion(o.p50).padStart(10)}${duracion(o.p95).padStart(10)}${duracion(o.max).padStart(10)}${String(o.fallas).padStart(8)}`);
if (delServidor) {
  console.log(`\n${"Dentro del servidor (registros)".padEnd(48)}${"n".padStart(6)}${"p50".padStart(10)}${"p95".padStart(10)}${"máx.".padStart(10)}`);
  for (const [ruta, ms] of [...delServidor].sort((a, b) => b[1].length - a[1].length)) console.log(`${ruta.padEnd(48)}${String(ms.length).padStart(6)}${duracion(percentil(ms, 50)).padStart(10)}${duracion(percentil(ms, 95)).padStart(10)}${duracion(maximo(ms)).padStart(10)}`);
} else if (REMOTO) console.log("\nSin los registros de Railway (¿la CLI está enlazada a este entorno?): los tiempos incluyen tu internet.");
for (const f of fallas) console.log(`\nNo terminó: ${f}`);
for (const [codigo, n] of Object.entries(Object.groupBy(mediciones.filter((m) => m.estado !== undefined), (m) => `${m.operacion} ${m.estado} ${m.codigo ?? ""}`))) console.log(`Respuesta ${codigo}: ${n?.length}`);

if (values.json) {
  const servidor = delServidor ? Object.fromEntries([...delServidor].map(([ruta, ms]) => [ruta, { n: ms.length, p50: percentil(ms, 50), p95: percentil(ms, 95), max: maximo(ms) }])) : null;
  writeFileSync(values.json, JSON.stringify({ destino: REMOTO ? SUPERFICIES : "local", escenario: { ...ESCENARIO, kbPorFoto: kb }, inicio: inicioReloj, fin: finReloj, metas, operaciones, servidor, tiempos }, null, 2));
  console.log(`\nResultado guardado en ${values.json}`);
}
process.exit(metas.every((m) => m.cumple) ? 0 : 1);
