import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { campoDeRuta, describirValor, esCantidades, nombreDeDato, type DefinicionCampo, type Valor } from "@teins/dominio";
import { Check, ErrorDeCarga, EsqueletoLista, Insignia, Link2, MessageSquare, Pencil, Send, Smartphone, UserRound, type LucideIcon } from "@teins/ui";
import { consultasDeCatalogo } from "../catalogo";
import { aFechaCorta } from "../formato";
import type { Historial, Levantamiento } from "../revision";

type Evento = Historial["eventos"][number];

const QUE_PASO: Record<string, { texto: string; icono: LucideIcon }> = {
  levantamiento_creado: { texto: "Creó el levantamiento en el teléfono", icono: Smartphone },
  levantamiento_enviado: { texto: "Envió el levantamiento", icono: Send },
  revision_tomada: { texto: "Tomó la revisión", icono: UserRound },
  revision_reasignada: { texto: "Tomó la revisión", icono: UserRound },
  revision_liberada: { texto: "Dejó la revisión sin tomar", icono: UserRound },
  campo_corregido: { texto: "Corrigió", icono: Pencil },
  levantamiento_revisado: { texto: "Marcó el levantamiento revisado", icono: Check },
  comentario_agregado: { texto: "Comentó", icono: MessageSquare },
  comentario_respondido: { texto: "Respondió", icono: MessageSquare },
  comentario_editado: { texto: "Editó su comentario", icono: Pencil },
  comentario_retirado: { texto: "Retiró su comentario", icono: MessageSquare },
  comentario_restaurado: { texto: "Restauró su comentario", icono: MessageSquare },
  linea_vinculada: { texto: "Vinculó al catálogo", icono: Link2 },
};

/** Historial legible por campo (ADR-0008), con la verificación de la cadena. */
export function HistorialDeCambios({ l, historial }: { l: Levantamiento; historial: ReturnType<typeof useQuery<Historial>> }) {
  const { formatoDefinicion: formato, repeticiones } = l;
  const vinculadas = historial.data?.eventos.some((e) => e.tipo === "linea_vinculada") ?? false;
  const catalogo = useQuery({ ...consultasDeCatalogo.items(), enabled: vinculadas });
  const codigoDe = (itemId: string | null | undefined) => (itemId ? (catalogo.data?.items.find((i) => i.id === itemId)?.codigo ?? "un ítem") : "sin vincular");
  const descripcionDeLinea = (seccion: string | undefined, clave: string | undefined, linea: string | undefined) => {
    const valor = seccion && clave ? l.respuestas[seccion]?.[clave] : undefined;
    return (esCantidades(valor) ? valor.find((x) => x.id === linea)?.descripcion : undefined) ?? "una línea quitada";
  };
  const campo = (seccion?: string, clave?: string) => (seccion && clave ? campoDeRuta(formato, repeticiones, seccion, clave) : undefined);
  const nombreDe = (seccion: string | undefined, definicion: DefinicionCampo) => (seccion ? nombreDeDato(formato, repeticiones, seccion, definicion.clave, true) : definicion.etiqueta.toLowerCase());

  function detalle(e: Evento): ReactNode {
    const definicion = campo(e.seccion, e.campo);
    const revisorAnterior = (e.anterior as { revisor?: string } | undefined)?.revisor;
    if (e.tipo === "campo_corregido" && definicion) {
      return (
        <>
          <br />
          <span className="cambio">
            {nombreDe(e.seccion, definicion)}: <del>{describirValor(definicion, e.anterior as Valor | undefined)}</del> → <ins>{describirValor(definicion, e.nuevo as Valor | undefined)}</ins>
          </span>
        </>
      );
    }
    if (e.tipo === "revision_reasignada" && revisorAnterior) return ` que tenía ${revisorAnterior}`;
    if (e.tipo === "revision_liberada" && revisorAnterior) return ` al desactivar a ${revisorAnterior}`;
    if (e.tipo === "linea_vinculada") {
      const antes = e.anterior as { linea?: string; item?: string | null } | undefined;
      const despues = e.nuevo as { linea?: string; item?: string | null } | undefined;
      return ` “${descripcionDeLinea(e.seccion, e.campo, despues?.linea)}”: ${codigoDe(antes?.item)} → ${codigoDe(despues?.item)}`;
    }
    if (e.tipo === "comentario_editado") return `: “${(e.anterior as { texto?: string } | undefined)?.texto ?? ""}” → “${(e.nuevo as { texto?: string } | undefined)?.texto ?? ""}”`;
    if (e.tipo === "comentario_agregado" || e.tipo === "comentario_respondido") return ` ${definicion ? `sobre ${nombreDe(e.seccion, definicion)}: ` : ""}“${(e.nuevo as { texto?: string } | undefined)?.texto ?? ""}”`;
    return null;
  }

  return (
    <section aria-label="Historial de cambios" className="col" style={{ gap: 10 }}>
      <div className="fila-flex entre">
        <span className="ayuda">Todo cambio queda con autor y fecha.</span>
        {historial.data && <Insignia tono={historial.data.integra ? "exito" : "peligro"}>{historial.data.integra ? "Historial íntegro" : "El historial fue alterado fuera del sistema"}</Insignia>}
      </div>
      {historial.isPending ? (
        <EsqueletoLista etiqueta="Cargando el historial" filas={3} />
      ) : historial.isError ? (
        <ErrorDeCarga texto="No se pudo cargar el historial." reintentar={() => void historial.refetch()} />
      ) : (
        <ul className="historial">
          {[...historial.data.eventos].reverse().map((e) => {
            const que = QUE_PASO[e.tipo];
            const Icono = que?.icono ?? Pencil;
            return (
              <li key={e.secuencia}>
                <span className="ico">
                  <Icono aria-hidden size={15} />
                </span>
                <div className="que">
                  <b>{e.autor.nombre}</b> {que?.texto.toLowerCase() ?? e.tipo}
                  {detalle(e)}
                  <div className="cuando">
                    {aFechaCorta(e.hora)}
                    {e.motivo && ` · Motivo: ${e.motivo}`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
