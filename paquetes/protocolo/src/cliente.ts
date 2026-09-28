import { CABECERA_VERSION, VERSION_PROTOCOLO } from "./version";
import { operaciones, type ConsultaEntrada, type CuerpoEntrada, type NombreOperacion, type Operacion, type ParametrosEntrada, type Respuesta } from "./operaciones";
import { Problema, REINTENTABLE, TIPO_PROBLEMA, tipoDeProblema, type CodigoProblema } from "./problemas";

/** El servidor respondió con un error del contrato (Problem Details). */
export class ErrorApi extends Error {
  constructor(readonly problema: Problema) {
    super(problema.detail ?? problema.title);
    this.name = "ErrorApi";
  }
  get codigo(): CodigoProblema {
    return this.problema.codigo;
  }
  get reintentable(): boolean {
    return REINTENTABLE[this.problema.codigo];
  }
}

/** No hubo respuesta: sin señal, servidor inalcanzable o conexión cortada. Siempre se puede reintentar. */
export class ErrorDeRed extends Error {
  constructor(causa: unknown) {
    super("Sin conexión con el servidor", { cause: causa });
    this.name = "ErrorDeRed";
  }
}

/** Sin esquema, la clave no va; con esquema, es obligatoria salvo que todos sus campos sean opcionales. */
type Si<K extends string, T> = [T] extends [undefined] ? { [P in K]?: never } : {} extends T ? { [P in K]?: T } : { [P in K]: T };
export type EntradaCliente<N extends NombreOperacion> = Si<"cuerpo", CuerpoEntrada<N>> &
  Si<"parametros", ParametrosEntrada<N>> & Si<"consulta", ConsultaEntrada<N>>;
/** La entrada se puede omitir solo si nada en ella es obligatorio. */
type ArgumentosCliente<N extends NombreOperacion> = {} extends EntradaCliente<N> ? [entrada?: EntradaCliente<N>] : [entrada: EntradaCliente<N>];

const problemaSintetico = (estado: number, codigo: CodigoProblema, titulo: string): Problema => ({
  type: tipoDeProblema(codigo),
  title: titulo,
  status: estado,
  codigo,
});

/** Código para un error sin código conocido: un 4xx no se arregla reintentando; un 5xx o un 408, quizá sí. */
function codigoPorEstado(estado: number): CodigoProblema {
  switch (estado) {
    case 401:
      return "no_autenticado";
    case 403:
      return "sin_permiso";
    case 404:
      return "no_encontrado";
    case 409:
      return "conflicto";
    case 413:
      return "archivo_demasiado_grande";
    case 415:
      return "tipo_de_archivo_no_permitido";
    case 429:
      return "demasiadas_solicitudes";
  }
  return estado >= 400 && estado < 500 && estado !== 408 ? "entrada_invalida" : "error_interno";
}

const TITULO_POR_ESTADO: Partial<Record<number, string>> = {
  400: "Solicitud rechazada",
  401: "Se requiere iniciar sesión",
  403: "No tiene permiso",
  429: "Demasiados intentos",
};

async function leerProblema(respuesta: Response): Promise<Problema> {
  if (respuesta.headers.get("content-type")?.includes(TIPO_PROBLEMA)) {
    const cuerpo: unknown = await respuesta.json().catch(() => null);
    const leido = Problema.safeParse(cuerpo);
    if (leido.success) return leido.data;
    // Un servidor más nuevo puede traer un código que esta versión no conoce (N-1): se conserva el resto.
    if (cuerpo && typeof cuerpo === "object") {
      const conCodigoConocido = Problema.safeParse({ ...cuerpo, codigo: codigoPorEstado(respuesta.status) });
      if (conCodigoConocido.success) return conCodigoConocido.data;
    }
  }
  // Respuestas que no vienen de la aplicación (proxy, plataforma, biblioteca de autenticación).
  const codigo = codigoPorEstado(respuesta.status);
  return problemaSintetico(respuesta.status, codigo, TITULO_POR_ESTADO[respuesta.status] ?? `Error ${respuesta.status}`);
}

/** Leer el cuerpo también usa la red: si la conexión se corta a mitad, es ErrorDeRed y no un error de programa. */
async function leerJson(respuesta: Response): Promise<unknown> {
  try {
    return await respuesta.json();
  } catch (error) {
    throw new ErrorDeRed(error);
  }
}

export interface LlaveDeAcceso {
  id: string;
  nombre: string | null;
  creadaEn: string;
  /** Se sincroniza entre los dispositivos de la persona (llavero de iCloud, gestor de Google). */
  sincronizada: boolean;
}

/** ¿Este dispositivo tiene Face ID, huella o PIN para una llave de acceso? */
export async function admiteLlaves(): Promise<boolean> {
  // Por `globalThis`: este archivo también compila en el servidor, sin los tipos del navegador.
  const credencial = (globalThis as { PublicKeyCredential?: { isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean> } }).PublicKeyCredential;
  return credencial ? credencial.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false) : false;
}

/** La persona cerró el diálogo del sistema o no se verificó: no es un error que haya que explicar. */
export const esLlaveCancelada = (error: unknown) => error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError");

/** Cliente del contrato para las superficies. Mismo origen: la cookie de sesión viaja sola (ADR-0016). */
export function crearClienteApi({ base = "", fetch: f = globalThis.fetch.bind(globalThis) }: { base?: string; fetch?: typeof fetch } = {}) {
  async function solicitar(url: string, init: RequestInit): Promise<Response> {
    try {
      return await f(url, { credentials: "same-origin", ...init });
    } catch (error) {
      throw new ErrorDeRed(error);
    }
  }

  async function llamar<N extends NombreOperacion>(nombre: N, ...[entrada = {} as EntradaCliente<N>]: ArgumentosCliente<N>): Promise<Respuesta<N>> {
    const op: Operacion = operaciones[nombre];
    const { cuerpo, parametros, consulta } = entrada as { cuerpo?: unknown; parametros?: Record<string, string>; consulta?: Record<string, unknown> };
    let ruta = op.ruta.replace(/\{(\w+)\}/g, (_, clave: string) => {
      const valor = parametros?.[clave];
      if (valor === undefined || valor === null || valor === "") throw new Error(`${nombre}: falta el parámetro de ruta «${clave}»`);
      return encodeURIComponent(String(valor));
    });
    if (consulta) {
      const busqueda = new URLSearchParams(Object.entries(consulta).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]));
      if (busqueda.size > 0) ruta += `?${busqueda}`;
    }
    const cabeceras: Record<string, string> = {};
    if (op.sincronizacion) cabeceras[CABECERA_VERSION] = String(VERSION_PROTOCOLO);
    if (cuerpo !== undefined) cabeceras["content-type"] = "application/json";

    const respuesta = await solicitar(`${base}${ruta}`, {
      method: op.metodo,
      headers: cabeceras,
      ...(cuerpo !== undefined ? { body: JSON.stringify(cuerpo) } : {}),
    });
    if (!respuesta.ok) throw new ErrorApi(await leerProblema(respuesta));
    // La respuesta también se valida: una diferencia de contrato se detecta aquí y no más adelante.
    return op.respuesta.parse(await leerJson(respuesta)) as Respuesta<N>;
  }

  async function consultaDeAutenticacion(ruta: string): Promise<unknown> {
    const respuesta = await solicitar(`${base}/api/auth${ruta}`, { method: "GET" });
    if (!respuesta.ok) throw new ErrorApi(await leerProblema(respuesta));
    return leerJson(respuesta);
  }

  async function autenticacion(ruta: string, cuerpo: unknown): Promise<unknown> {
    const respuesta = await solicitar(`${base}/api/auth${ruta}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!respuesta.ok) throw new ErrorApi(await leerProblema(respuesta));
    return respuesta.json().catch(() => null);
  }

  return {
    llamar,
    /** Con el segundo factor activo no hay sesión todavía: `pideCodigo` indica que falta `verificarSegundoFactor`. */
    async iniciarSesion(usuario: string, contrasena: string): Promise<{ pideCodigo: boolean }> {
      const r = await autenticacion("/sign-in/username", { username: usuario.trim().toLowerCase(), password: contrasena });
      return { pideCodigo: (r as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect === true };
    },
    /** Seis dígitos de la app autenticadora, o uno de los códigos de respaldo. */
    async verificarSegundoFactor(codigo: string): Promise<void> {
      const limpio = codigo.replace(/\s/g, "");
      await autenticacion(/^\d{6}$/.test(limpio) ? "/two-factor/verify-totp" : "/two-factor/verify-backup-code", { code: limpio });
    },
    /** Primer paso de la activación: el URI para la app autenticadora y los códigos de respaldo. No cuenta hasta verificar un código. */
    async activarSegundoFactor(contrasena: string): Promise<{ uri: string; codigosDeRespaldo: string[] }> {
      const r = (await autenticacion("/two-factor/enable", { password: contrasena })) as { totpURI: string; backupCodes: string[] };
      return { uri: r.totpURI, codigosDeRespaldo: r.backupCodes };
    },
    cerrarSesion: async () => void (await autenticacion("/sign-out", {})),

    // Llaves de acceso (iteración 13, ADR-0009). La biblioteca del navegador se carga solo al usarlas:
    // el JavaScript inicial de campo no la paga (ADR-0011).
    /** Entra sin usuario ni contraseña: el teléfono ofrece sus llaves de TEINS y pide Face ID, huella o PIN. */
    async iniciarSesionConLlave(): Promise<void> {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const opciones = (await consultaDeAutenticacion("/passkey/generate-authenticate-options")) as Parameters<typeof startAuthentication>[0]["optionsJSON"];
      await autenticacion("/passkey/verify-authentication", { response: await startAuthentication({ optionsJSON: opciones }) });
    },
    /** Crea una llave para quien tiene la sesión abierta, en este dispositivo. */
    async crearLlave(): Promise<void> {
      const { startRegistration } = await import("@simplewebauthn/browser");
      const opciones = (await consultaDeAutenticacion("/passkey/generate-register-options")) as Parameters<typeof startRegistration>[0]["optionsJSON"];
      await autenticacion("/passkey/verify-registration", { response: await startRegistration({ optionsJSON: opciones }) });
    },
    async llaves(): Promise<LlaveDeAcceso[]> {
      const filas = (await consultaDeAutenticacion("/passkey/list-user-passkeys")) as { id: string; name?: string | null; createdAt: string; deviceType: string; aaguid?: string | null }[];
      return filas.map((f) => ({ id: f.id, nombre: f.name ?? null, creadaEn: f.createdAt, sincronizada: f.deviceType === "multiDevice" }));
    },
    quitarLlave: async (id: string) => void (await autenticacion("/passkey/delete-passkey", { id })),
  };
}

export type ClienteApi = ReturnType<typeof crearClienteApi>;
