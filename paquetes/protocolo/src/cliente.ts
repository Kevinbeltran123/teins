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
  if (respuesta.status === 401) return problemaSintetico(401, "no_autenticado", "Se requiere iniciar sesión");
  if (respuesta.status === 403) return problemaSintetico(403, "sin_permiso", "No tiene permiso");
  if (respuesta.status === 429) return problemaSintetico(429, "demasiadas_solicitudes", "Demasiados intentos");
  return problemaSintetico(respuesta.status, "error_interno", `Error ${respuesta.status}`);
}

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

  async function autenticacion(ruta: string, cuerpo: unknown): Promise<void> {
    const respuesta = await solicitar(`${base}/api/auth${ruta}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    if (!respuesta.ok) throw new ErrorApi(await leerProblema(respuesta));
  }

  return {
    llamar,
    iniciarSesion: (usuario: string, contrasena: string) => autenticacion("/sign-in/username", { username: usuario.trim().toLowerCase(), password: contrasena }),
    cerrarSesion: () => autenticacion("/sign-out", {}),
  };
}

export type ClienteApi = ReturnType<typeof crearClienteApi>;
