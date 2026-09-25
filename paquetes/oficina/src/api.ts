import { QueryClient, queryOptions } from "@tanstack/react-query";
import { crearClienteApi, ErrorApi } from "@teins/protocolo";

export const cliente = crearClienteApi();

export const clienteDeConsultas = new QueryClient({
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
  // La URL firmada dura 5 minutos: se renueva antes de que venza.
  urlDeArchivo: (huella: string) =>
    queryOptions({ queryKey: ["archivo", huella], queryFn: () => cliente.llamar("urlDeArchivo", { parametros: { huella } }), staleTime: 4 * 60_000 }),
};

/** Frescura de la bandeja (ADR-0014): consulta periódica y al volver a la pestaña. */
export const REFRESCO_BANDEJA_MS = 60_000;
