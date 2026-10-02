import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CuerpoEntrada } from "@teins/protocolo";
import { conTransicion } from "@teins/ui";
import { cliente, REFRESCO_BANDEJA_MS } from "./api";

export type Estado = "enviado" | "en_revision" | "revisado";

/** Una pestaña de la bandeja: levantamientos de un estado, del que más lleva esperando al más reciente. */
/** `buscar`: cliente, sitio, técnico o formato; la busca el servidor, porque la bandeja llega por páginas. */
export function useBandeja(estado: Estado, buscar = "") {
  const texto = buscar.trim();
  return useInfiniteQuery({
    queryKey: ["bandeja", estado, texto],
    queryFn: ({ pageParam }) => cliente.llamar("listarLevantamientos", { consulta: { estado, ...(texto ? { buscar: texto } : {}), ...(pageParam ? { cursor: pageParam } : {}) } }),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.siguienteCursor,
    refetchInterval: REFRESCO_BANDEJA_MS,
  });
}

/**
 * Después de cualquier acción de revisión, el detalle, el historial y la bandeja se vuelven a leer, en una
 * transición: el estado cambia en su lugar y lo corregido destella (iteración 27).
 */
function useRefrescar() {
  const consultas = useQueryClient();
  return (id: string) =>
    conTransicion(() => Promise.all([consultas.invalidateQueries({ queryKey: ["levantamiento", id] }), consultas.invalidateQueries({ queryKey: ["bandeja"] })]));
}

export function useTomar() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ id, version, reasignar = false }: { id: string; version: number; reasignar?: boolean }) =>
      cliente.llamar("tomarLevantamiento", { parametros: { id }, cuerpo: { version, reasignar } }),
    onSettled: (_r, _e, { id }) => refrescar(id),
  });
}

export function useCorregir(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (cuerpo: CuerpoEntrada<"corregirLevantamiento">) => cliente.llamar("corregirLevantamiento", { parametros: { id }, cuerpo }),
    onSettled: () => refrescar(id),
  });
}

export function useMarcarRevisado(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (version: number) => cliente.llamar("marcarRevisado", { parametros: { id }, cuerpo: { version } }),
    onSettled: () => refrescar(id),
  });
}

export function useComentar(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (cuerpo: CuerpoEntrada<"comentarLevantamiento">) => cliente.llamar("comentarLevantamiento", { parametros: { id }, cuerpo }),
    onSuccess: () => refrescar(id),
  });
}

/** Su autor corrige un comentario (ADR-0035): lo edita, lo retira o lo restaura con "Deshacer". */
export function useCorregirComentario(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ comentarioId, accion }: { comentarioId: string; accion: { tipo: "editar"; texto: string } | { tipo: "retirar" | "restaurar" } }) =>
      accion.tipo === "editar"
        ? cliente.llamar("editarComentario", { parametros: { id, comentarioId }, cuerpo: { texto: accion.texto } })
        : cliente.llamar(accion.tipo === "retirar" ? "retirarComentario" : "restaurarComentario", { parametros: { id, comentarioId } }),
    onSuccess: () => refrescar(id),
  });
}
