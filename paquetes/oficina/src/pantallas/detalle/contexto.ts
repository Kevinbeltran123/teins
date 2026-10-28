import { createContext } from "react";
import type { Valor } from "@teins/dominio";
import { aDiaCorto, aFechaCorta, aHora } from "../../formato";
import type { Levantamiento } from "../../revision";

export const idDato = (seccion: string, campo: string) => `dato-${seccion}-${campo}`.replace(/[^a-zA-Z0-9_-]/g, "");

/** La corrección que se está escribiendo: el capítulo del informe la muestra antes de guardarla (iteración 26). */
export type EnCurso = { seccion: string; campo: string; valor: Valor | undefined };
export const CorreccionEnCurso = createContext<{ avisar: (c: EnCurso | null) => void; verCapitulo: (() => void) | null } | null>(null);

export type Pestana = "informe" | "comentarios" | "historial";

/** Abre la pestaña «Comentarios» en una conversación (ADR-0040). */
export const VerConversacion = createContext<((comentarioId: string) => void) | null>(null);

/** "8:41 p. m." si fue hoy; si no, con el día. */
export const cuandoCorto = (iso: string) => (aDiaCorto(iso) === "hoy" ? aHora(Date.parse(iso)) : aFechaCorta(iso));

/** Las conversaciones que ve el técnico: los comentarios de oficina que no están retirados (ADR-0035, ADR-0040). */
export const vigentes = (l: Levantamiento) => l.comentarios.filter((c) => !c.retirado && !c.enRespuestaA);
/** Las respuestas de una conversación, en orden. */
export const respuestasDe = (l: Levantamiento, comentarioId: string) => l.comentarios.filter((c) => c.enRespuestaA === comentarioId);
