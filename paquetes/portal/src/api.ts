import { QueryClient, queryOptions } from "@tanstack/react-query";
import { crearClienteApi, ErrorApi } from "@teins/protocolo";

export const cliente = crearClienteApi();

export const clienteDeConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (intentos, error) => !(error instanceof ErrorApi && !error.reintentable) && intentos < 3,
      refetchOnWindowFocus: true,
    },
  },
});

export const consultas = {
  sesion: () => queryOptions({ queryKey: ["sesion"], queryFn: () => cliente.llamar("sesionDelPortal"), staleTime: 60_000 }),
  informes: () => queryOptions({ queryKey: ["informes"], queryFn: () => cliente.llamar("informesDelPortal") }),
};
