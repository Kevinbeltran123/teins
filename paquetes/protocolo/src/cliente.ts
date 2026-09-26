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

type Si<K extends string, T> = [T] extends [undefined] ? { [P in K]?: never } : { [P in K]: T };
export type EntradaCliente<N extends NombreOperacion> = Si<"cuerpo", CuerpoEntrada<N>> &
  Si<"parametros", ParametrosEntrada<N>> & { consulta?: ConsultaEntrada<N> };

const problemaSintetico = (estado: number, codigo: CodigoProblema, titulo: string): Problema => ({
  type: tipoDeProblema(codigo),
  title: titulo,
  status: estado,
  codigo,
});

async function leerProblema(respuesta: Response): Promise<Problema> {
  if (respuesta.headers.get("content-type")?.includes(TIPO_PROBLEMA)) {
    const leido = Problema.safeParse(await respuesta.json().catch(() => null));
    if (leido.success) return leido.data;
  }
  // Respuestas que no vienen de la aplicación (proxy, plataforma, biblioteca de autenticación).
  if (respuesta.status === 400) return problemaSintetico(400, "entrada_invalida", "Solicitud rechazada");
  if (respuesta.status === 401) return problemaSintetico(401, "no_autenticado", "Se requiere iniciar sesión");
  if (respuesta.status === 403) return problemaSintetico(403, "sin_permiso", "No tiene permiso");
  if (respuesta.status === 429) return problemaSintetico(429, "demasiadas_solicitudes", "Demasiados intentos");
  return problemaSintetico(respuesta.status, "error_interno", `Error ${respuesta.status}`);
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

  async function llamar<N extends NombreOperacion>(nombre: N, entrada: EntradaCliente<N> = {} as EntradaCliente<N>): Promise<Respuesta<N>> {
    const op: Operacion = operaciones[nombre];
    const { cuerpo, parametros, consulta } = entrada as { cuerpo?: unknown; parametros?: Record<string, string>; consulta?: Record<string, unknown> };
    let ruta = op.ruta.replace(/\{(\w+)\}/g, (_, clave: string) => encodeURIComponent(String(parametros?.[clave] ?? "")));
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
    return op.respuesta.parse(await respuesta.json()) as Respuesta<N>;
  }

  async function consultaDeAutenticacion(ruta: string): Promise<unknown> {
    const respuesta = await solicitar(`${base}/api/auth${ruta}`, { method: "GET" });
    if (!respuesta.ok) throw new ErrorApi(await leerProblema(respuesta));
    return respuesta.json();
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
