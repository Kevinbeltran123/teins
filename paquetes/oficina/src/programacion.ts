import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorApi, ErrorDeRed } from "@teins/protocolo";
import { conTransicion } from "@teins/ui";
import { cliente } from "./api";
import { textoDelServidor } from "./mensajes";

export type Vista = "proximas" | "anteriores" | "canceladas";

/** Hoy en la zona del navegador (AAAA-MM-DD): oficina y sus técnicos están en Colombia. */
export const hoyLocal = () => new Date().toLocaleDateString("en-CA");

export const consultasDeProgramacion = {
  /** Los activos (para programar y la lista) o los archivados (ADR-0035). */
  clientes: (vista: "activos" | "archivados" = "activos") =>
    queryOptions({ queryKey: ["programacion", "clientes", vista], queryFn: () => cliente.llamar("listarClientes", { consulta: { vista } }) }),
  cliente: (id: string) => queryOptions({ queryKey: ["programacion", "cliente", id], queryFn: () => cliente.llamar("obtenerCliente", { parametros: { id } }) }),
  tecnicos: () => queryOptions({ queryKey: ["programacion", "tecnicos"], queryFn: () => cliente.llamar("listarTecnicos"), staleTime: 5 * 60_000 }),
  visitas: (vista: Vista, hoy: string) =>
    queryOptions({ queryKey: ["programacion", "visitas", vista, hoy], queryFn: () => cliente.llamar("listarVisitas", { consulta: { vista, hoy } }), refetchInterval: 60_000 }),
};

/**
 * Toda acción vuelve a leer clientes y visitas: el servidor es la fuente de verdad. Dentro de una transición: la
 * fila nueva entra, la que se va sale y las demás se corren (iteración 27).
 */
export function useAccionDeProgramacion<E, R>(accion: (entrada: E) => Promise<R>) {
  const consultas = useQueryClient();
  return useMutation({ mutationFn: accion, onSettled: () => conTransicion(() => consultas.invalidateQueries({ queryKey: ["programacion"] })) });
}

/** Corregir un cliente o un sitio (ADR-0035): el servidor dice por qué no se pudo (visitas por hacer, el único sitio, archivado). */
export function mensajeDeCliente(error: unknown): string {
  if (error instanceof ErrorApi && error.codigo === "estado_invalido") return textoDelServidor(error, "El cliente cambió mientras tanto. Recargue la página y vuelva a intentar.");
  return mensajeDeProgramacion(error);
}

export function mensajeDeProgramacion(error: unknown): string {
  if (error instanceof ErrorDeRed) return "Sin conexión con el servidor. No se guardó nada; intente de nuevo al recuperar la conexión.";
  if (!(error instanceof ErrorApi)) return "No se pudo guardar. Intente de nuevo.";
  switch (error.codigo) {
    case "conflicto_de_version":
      return "Otra persona cambió esta visita mientras usted la tenía abierta. La lista ya muestra lo último: revise y vuelva a intentar.";
    case "estado_invalido":
      return "La visita ya está cancelada.";
    case "no_autenticado":
      return "Su sesión venció. Inicie sesión de nuevo.";
    case "entrada_invalida":
      return textoDelServidor(error, "Revise los datos.");
    default:
      return textoDelServidor(error, "No se pudo guardar. Intente de nuevo.");
  }
}
