import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { cliente } from "./api";
import { errorComun, textoDelServidor } from "./mensajes";

export const consultasDeCotizaciones = {
  lista: () => queryOptions({ queryKey: ["cotizaciones"], queryFn: () => cliente.llamar("listarCotizaciones") }),
  visitas: () => queryOptions({ queryKey: ["cotizaciones", "visitas"], queryFn: () => cliente.llamar("visitasParaCotizar") }),
  detalle: (id: string) => queryOptions({ queryKey: ["cotizaciones", id], queryFn: () => cliente.llamar("obtenerCotizacion", { parametros: { id } }) }),
};

/** Toda acción vuelve a leer las cotizaciones: el servidor es la fuente de verdad. */
export function useAccionDeCotizacion<E, R>(accion: (entrada: E) => Promise<R>) {
  const consultas = useQueryClient();
  return useMutation({ mutationFn: accion, onSettled: () => consultas.invalidateQueries({ queryKey: ["cotizaciones"] }) });
}

/** «Deshacer» al quitar una línea: vuelve a su lugar, sobre las líneas de ahora, y una sola vez (si ya volvió, no se duplica). */
export function devolverLinea<T extends { id: string }>(lineas: T[], linea: T, posicion: number): T[] {
  return lineas.some((l) => l.id === linea.id) ? lineas : [...lineas.slice(0, posicion), linea, ...lineas.slice(posicion)];
}

const EXPLICACION: Record<string, (e: { lineas?: string[] | undefined; campo?: string | undefined }) => string> = {
  sin_lineas: () => "La cotización no tiene líneas.",
  sin_precio: (e) => `${e.lineas?.length === 1 ? "Una línea no tiene" : `${e.lineas?.length ?? "Algunas"} líneas no tienen`} precio.`,
  porcentaje_invalido: (e) => `El porcentaje de ${e.campo === "administracion" ? "administración" : e.campo === "imprevistos" ? "imprevistos" : "utilidad"} debe estar entre 0 y 100.`,
};

/** Qué decirle a oficina sobre un error de la cotización. */
export function mensajeDeCotizacion(problema: unknown): string {
  const error = errorComun(problema, "No se guardó nada", "No se pudo completar la acción. Intente de nuevo.");
  if (typeof error === "string") return error;
  switch (error.codigo) {
    case "conflicto_de_version":
      return "Otra persona cambió esta cotización mientras usted la tenía abierta. Recargue para ver lo último.";
    case "cotizacion_invalida":
      return (error.problema.erroresCotizacion ?? []).map((e) => EXPLICACION[e.codigo]?.(e) ?? e.codigo).join(" ") || "A la cotización le falta algo para publicarse.";
    case "estado_invalido":
      return textoDelServidor(error, "La cotización no se puede cambiar así.");
    default:
      return textoDelServidor(error, "No se pudo completar la acción. Intente de nuevo.");
  }
}
