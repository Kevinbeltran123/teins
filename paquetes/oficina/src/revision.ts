import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { leerClave, nombreDeDato } from "@teins/dominio";
import type { CuerpoEntrada, Respuesta } from "@teins/protocolo";
import { conTransicion, MessageSquare, TriangleAlert, type LucideIcon } from "@teins/ui";
import { cliente, REFRESCO_BANDEJA_MS } from "./api";
import { enLista } from "./formato";

export type Levantamiento = Respuesta<"obtenerLevantamiento">;
export type Historial = Respuesta<"historialLevantamiento">;

export type Estado = "enviado" | "en_revision" | "revisado";

/**
 * Lo escrito en la revisión que todavía no se guarda ni se envía: una corrección abierta, un comentario sobre un dato o
 * general, una respuesta en una conversación, o la edición de un comentario.
 */
export type Escrito =
  | { tipo: "correccion" | "comentario"; seccion: string; campo: string }
  | { tipo: "general" }
  | { tipo: "respuesta"; comentarioId: string }
  | { tipo: "edicion" };

/** Lo escrito sin enviar en un destino, con su valor. */
export type Pendiente = { que: Escrito; valor: unknown };

/** Hay algo: un texto con letras, una corrección escrita, un comentario en edición. */
const hayAlgo = (valor: unknown) => (typeof valor === "string" ? valor.trim() !== "" : Boolean(valor));

/**
 * Qué pasa con lo escrito al marcar revisado: las correcciones ya no se guardan, y las respuestas y la edición de un
 * comentario tampoco, porque las conversaciones se cierran (ADR-0040). Un comentario nuevo todavía se envía, pero el
 * técnico ya no lo puede responder.
 */
export function alMarcarRevisado<E extends { que: Escrito; valor: unknown }>(escritos: Iterable<E>): { sePierden: E[]; sinRespuesta: E[] } {
  const vivos = [...escritos].filter((e) => hayAlgo(e.valor));
  return {
    sePierden: vivos.filter((e) => e.que.tipo === "correccion" || e.que.tipo === "respuesta" || e.que.tipo === "edicion"),
    sinRespuesta: vivos.filter((e) => e.que.tipo === "comentario" || e.que.tipo === "general"),
  };
}

export const claveDato = (seccion: string, campo: string) => `${seccion}|${campo}`;

/** La última corrección de cada dato y su valor original, para mostrar antes y después en la fila. */
export function correccionesDe(historial: Historial | undefined) {
  const porDato = new Map<string, { original: unknown; autor: string; motivo: string | undefined }>();
  for (const e of historial?.eventos ?? []) {
    if (e.tipo !== "campo_corregido" || !e.seccion || !e.campo) continue;
    const clave = claveDato(e.seccion, e.campo);
    const previa = porDato.get(clave);
    porDato.set(clave, { original: previa ? previa.original : e.anterior, autor: e.autor.nombre, motivo: e.motivo ?? undefined });
  }
  return porDato;
}

export type Consecuencia = { icono: LucideIcon; texto: string; detalle?: string };

/**
 * Lo escrito que «Marcar revisado» deja atrás, como consecuencias de su confirmación (DESIGN.md, tabla de confirmar o
 * deshacer): lo que se pierde, y los comentarios sin enviar, que el técnico ya no podrá responder.
 */
export function loEscritoAlMarcar(l: Levantamiento, pendientes: Iterable<Pendiente>): Consecuencia[] {
  const { sePierden, sinRespuesta } = alMarcarRevisado(pendientes);
  const dato = (seccion: string, campo: string) => `«${nombreDeDato(l.formatoDefinicion, l.repeticiones, seccion, campo)}»`;
  const enConversacion = (id: string | undefined) => {
    const raiz = l.comentarios.find((c) => c.id === id);
    return raiz?.seccion && raiz.campo ? `sobre ${dato(raiz.seccion, raiz.campo)}` : "en la conversación general";
  };
  const describir = ({ que, valor }: Pendiente): string => {
    switch (que.tipo) {
      case "correccion":
        return `la corrección sin guardar de ${dato(que.seccion, que.campo)}`;
      case "respuesta":
        return `la respuesta sin enviar ${enConversacion(que.comentarioId)}`;
      case "edicion":
        return `la edición sin guardar de su comentario ${enConversacion((valor as { id?: string }).id)}`;
      case "comentario":
        return `el comentario sin enviar sobre ${dato(que.seccion, que.campo)}`;
      case "general":
        return "el comentario general sin enviar";
    }
  };
  const corrige = sePierden.some((e) => e.que.tipo === "correccion");
  const conversa = sePierden.some((e) => e.que.tipo !== "correccion");
  return [
    ...(sePierden.length > 0
      ? [
          {
            icono: TriangleAlert,
            texto: `Se ${sePierden.length === 1 ? "pierde" : "pierden"} ${enLista(sePierden.map(describir))}`,
            detalle: corrige && conversa ? "Ya no se corrige y las conversaciones se cierran" : corrige ? "Después ya no se corrige: guarde antes lo que necesite" : "Las conversaciones se cierran: envíe antes lo que necesite",
          },
        ]
      : []),
    ...(sinRespuesta.length > 0
      ? [{ icono: MessageSquare, texto: `${l.tecnico.nombre} no podrá responder ${enLista(sinRespuesta.map(describir))}`, detalle: sinRespuesta.length === 1 ? "Envíelo antes si espera respuesta" : "Envíelos antes si espera respuesta" }]
      : []),
  ];
}

/** La sección tiene correcciones: en ella o en sus repeticiones («tableros~id»), no en otra que empieza igual. */
export const seccionCorregida = (claves: Iterable<string>, seccion: string) => [...claves].some((k) => leerClave(k).seccion === seccion);

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

/**
 * Quien tiene la conversación a la vista la leyó (ADR-0040): se apaga su punto en la bandeja, la pestaña y el botón del
 * panel, y el técnico ve «Leído». Sin transición: no cambia nada en pantalla.
 */
export function useLeerConversacion(id: string) {
  const consultas = useQueryClient();
  return useMutation({
    mutationFn: () => cliente.llamar("marcarConversacionLeida", { parametros: { id } }),
    onSuccess: () => {
      void consultas.invalidateQueries({ queryKey: ["levantamiento", id], exact: true });
      void consultas.invalidateQueries({ queryKey: ["bandeja"] });
    },
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
