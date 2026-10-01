import { MutationCache, QueryCache, QueryClient, queryOptions } from "@tanstack/react-query";
import { crearClienteApi, ErrorApi } from "@teins/protocolo";

export const cliente = crearClienteApi();

export const esSesionVencida = (error: unknown) => error instanceof ErrorApi && error.codigo === "no_autenticado";

/**
 * Un 401 en cualquier consulta o acción vuelve a leer la sesión: si venció, la raíz pide ingresar de nuevo encima
 * de la pantalla, sin desmontarla, y lo que la persona escribía sigue ahí.
 */
const siVencio = (error: unknown, clave?: readonly unknown[]) => {
  if (esSesionVencida(error) && clave?.[0] !== "sesion") void clienteDeConsultas.invalidateQueries({ queryKey: ["sesion"] });
};

export const clienteDeConsultas: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error, consulta) => siVencio(error, consulta.queryKey) }),
  mutationCache: new MutationCache({ onError: (error) => siVencio(error) }),
  defaultOptions: {
    queries: {
      // Un error del contrato (401, 403, 404) no se arregla reintentando; un fallo de red sí.
      retry: (intentos, error) => !(error instanceof ErrorApi && !error.reintentable) && intentos < 3,
      refetchOnWindowFocus: true,
    },
  },
});

export const consultas = {
  sesion: () => queryOptions({ queryKey: ["sesion"], queryFn: () => cliente.llamar("obtenerSesion"), staleTime: 60_000 }),
  levantamiento: (id: string) => queryOptions({ queryKey: ["levantamiento", id], queryFn: () => cliente.llamar("obtenerLevantamiento", { parametros: { id } }) }),
  historial: (id: string) => queryOptions({ queryKey: ["levantamiento", id, "historial"], queryFn: () => cliente.llamar("historialLevantamiento", { parametros: { id } }) }),
  informes: () => queryOptions({ queryKey: ["informes"], queryFn: () => cliente.llamar("listarInformes") }),
  informe: (id: string) => queryOptions({ queryKey: ["informes", id], queryFn: () => cliente.llamar("obtenerInforme", { parametros: { id } }) }),
  // La URL firmada dura 5 minutos: se renueva antes de que venza.
  // Un boceto es inmutable (su huella es su contenido): no se vuelve a pedir.
  boceto: (huella: string) => queryOptions({ queryKey: ["boceto", huella], queryFn: () => cliente.llamar("bocetoDeArchivo", { parametros: { huella } }), staleTime: Infinity }),
  urlDeArchivo: (huella: string) =>
    queryOptions({ queryKey: ["archivo", huella], queryFn: () => cliente.llamar("urlDeArchivo", { parametros: { huella } }), staleTime: 4 * 60_000 }),
};

/** Frescura de la bandeja (ADR-0014): consulta periódica y al volver a la pestaña. */
export const REFRESCO_BANDEJA_MS = 60_000;

/**
 * La contraseña con la que se acaba de entrar, solo en memoria y solo hasta leer la sesión: si es temporal, la
 * pantalla obligatoria la manda como la actual y la persona escribe solo la nueva (ADR-0033). Si la página se
 * recarga antes, se pierde y esa pantalla la pide.
 */
let contrasenaDeIngreso: string | null = null;
export const recordarContrasenaDeIngreso = (contrasena: string) => void (contrasenaDeIngreso = contrasena);
export const leerContrasenaDeIngreso = () => contrasenaDeIngreso;
export const olvidarContrasenaDeIngreso = () => void (contrasenaDeIngreso = null);
