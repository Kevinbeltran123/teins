import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { conTransicion } from "@teins/ui";
import { cliente } from "./api";

export const consultasDeCatalogo = {
  items: () => queryOptions({ queryKey: ["catalogo"], queryFn: () => cliente.llamar("listarCatalogo"), staleTime: 60_000 }),
};

/** Toda acción del catálogo vuelve a leerlo (el servidor es la fuente de verdad), en una transición. */
export function useAccionDeCatalogo<E, R>(accion: (entrada: E) => Promise<R>) {
  const consultas = useQueryClient();
  return useMutation({ mutationFn: accion, onSettled: () => conTransicion(() => consultas.invalidateQueries({ queryKey: ["catalogo"] })) });
}

/** Vincular una línea cambia la versión del levantamiento: el detalle y el historial se vuelven a leer. */
export function useVincular(id: string) {
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: (cuerpo: { version: number; seccion: string; campo: string; linea: string; itemId: string | null }) =>
      cliente.llamar("vincularLinea", { parametros: { id }, cuerpo }),
    onSettled: () => consultas.invalidateQueries({ queryKey: ["levantamiento", id] }),
  });
}
