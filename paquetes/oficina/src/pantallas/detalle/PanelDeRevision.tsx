import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { bloques, describirValor, type ContenidoVersion, type Valor } from "@teins/dominio";
import { FileText, History, MessageSquare, type AnclaDeHoja, type LucideIcon } from "@teins/ui";
import { correccionesDe, type Historial, type Levantamiento } from "../../revision";
import { capituloDe, useRecursosDelInforme } from "../../vistaInforme";
import { Lienzo, VistaDeDocumento } from "../Lienzo";
import type { Plantillas } from "../../documentos";
import { vigentes, type EnCurso, type Pestana } from "./contexto";
import { Comentarios } from "./Comentarios";
import { HistorialDeCambios } from "./HistorialDeCambios";

/** El panel de la derecha (iteración 38): sus pestañas son la cabecera del lienzo, con «Ampliar» solo sobre la hoja. */
export function PanelDeRevision({
  l,
  titulo,
  pestana,
  alCambiar,
  historial,
  correcciones,
  enCurso,
  organizacion,
  usuarioId,
  enfocado,
}: {
  l: Levantamiento;
  titulo: string;
  pestana: Pestana;
  alCambiar: (p: Pestana) => void;
  historial: ReturnType<typeof useQuery<Historial>>;
  correcciones: ReturnType<typeof correccionesDe>;
  enCurso: EnCurso | null;
  organizacion: string;
  usuarioId: string | undefined;
  enfocado: { id: string; vez: number } | null;
}) {
  const n = vigentes(l).length;
  const boton = (valor: Pestana, texto: string, Icono: LucideIcon, cuantos = 0, punto = false) => (
    <button type="button" role="tab" aria-selected={pestana === valor} onClick={() => alCambiar(valor)}>
      <Icono aria-hidden size={14} strokeWidth={1.6} />
      {texto}
      {cuantos > 0 && <span className="num-p"> {cuantos}</span>}
      {punto && <i className="punto" aria-label="Respuesta sin leer" />}
    </button>
  );
  return (
    <Lienzo
      clase="panel-revision"
      nota=""
      cabecera={
        <span className="pest-p" role="tablist" aria-label="El informe, los comentarios y el historial">
          {boton("informe", "En el informe", FileText)}
          {boton("comentarios", "Comentarios", MessageSquare, n, l.conversacion?.sinLeer ?? false)}
          {boton("historial", "Historial", History)}
        </span>
      }
      panel={{
        etiqueta: "El informe, los comentarios y el historial",
        ampliable: pestana === "informe",
        cabeceraAmpliada: (
          <span className="titulo-ampliado">
            <b>{titulo}</b> · el capítulo como saldrá en el informe
          </span>
        ),
        volver: "Volver a la revisión",
      }}
    >
      {pestana === "informe" ? (
        <CapituloEnVivo l={l} correcciones={correcciones} enCurso={enCurso} organizacion={organizacion} />
      ) : pestana === "comentarios" ? (
        <Comentarios l={l} usuarioId={usuarioId} enfocado={enfocado} />
      ) : (
        <HistorialDeCambios l={l} historial={historial} />
      )}
    </Lienzo>
  );
}

/**
 * El capítulo del levantamiento como saldrá en el informe (ADR-0031), con la plantilla del PDF: lo corregido
 * resaltado con el valor anterior debajo y, mientras se escribe una corrección, el valor nuevo enmarcado. Lo azul es
 * de la pantalla: el PDF muestra el valor y nada más; el valor anterior queda en el historial.
 */
function CapituloEnVivo({ l, correcciones, enCurso, organizacion }: { l: Levantamiento; correcciones: ReturnType<typeof correccionesDe>; enCurso: EnCurso | null; organizacion: string }) {
  const editado: Levantamiento = enCurso ? { ...l, respuestas: { ...l.respuestas, [enCurso.seccion]: conValor(l.respuestas[enCurso.seccion] ?? {}, enCurso.campo, enCurso.valor) } } : l;
  const recursos = useRecursosDelInforme([editado]);
  const contenido: ContenidoVersion = {
    formatoContenido: 1,
    numero: 1,
    publicadaEn: new Date().toISOString(),
    publicadaPor: "",
    organizacion: { nombre: organizacion },
    visita: l.visita ?? { cliente: "[Cliente]", sitio: "[Sitio]", direccion: "", motivo: "", programadaPara: l.recibidoEn.slice(0, 10) },
    introduccion: "",
    conclusiones: "",
    levantamientos: [capituloDe(editado)],
    planos: [],
  };
  const definiciones = bloques(l.formatoDefinicion, l.repeticiones);
  const describir = (seccion: string, campo: string, valor: unknown) => {
    const definicion = definiciones.find((b) => b.clave === seccion)?.seccion.campos.find((c) => c.clave === campo);
    return definicion ? describirValor(definicion, valor as Valor | undefined) : "";
  };
  const claveEnCurso = enCurso ? `${enCurso.seccion}/${enCurso.campo}` : null;
  const huellaMarcas = `${[...correcciones.keys()].join()}|${claveEnCurso ?? ""}`;
  const marcar = useCallback(
    (doc: Document) => {
      doc.documentElement.classList.add("vista-capitulo");
      const poner = (clave: string, antes: string, clase: string) => {
        const fila = doc.querySelector(`tr[data-dato="${CSS.escape(clave)}"]`);
        const celda = fila?.querySelector<HTMLElement>("td");
        if (!fila || !celda) return;
        fila.classList.add(clase);
        celda.dataset.antes = antes;
      };
      for (const [k, c] of correcciones) {
        const [seccion = "", campo = ""] = k.split("|");
        poner(`${seccion}/${campo}`, `Antes: ${describir(seccion, campo, c.original)}`, "vista-corregido");
      }
      if (enCurso) poner(`${enCurso.seccion}/${enCurso.campo}`, `Antes: ${describir(enCurso.seccion, enCurso.campo, l.respuestas[enCurso.seccion]?.[enCurso.campo])} · sin guardar`, "vista-editando");
    },
    [huellaMarcas, l.version],
  );
  // Al empezar a corregir un dato, la hoja va hasta su fila.
  const [ancla, setAncla] = useState<AnclaDeHoja | null>(null);
  useEffect(() => {
    if (claveEnCurso) setAncla((a) => ({ selector: `tr[data-dato="${CSS.escape(claveEnCurso)}"]`, vez: (a?.vez ?? 0) + 1 }));
  }, [claveEnCurso]);
  const generar = (p: Plantillas) => p.plantillaInforme(contenido, { salida: { tipo: "vista" }, ...recursos });
  // Del ancho del panel (iteración 38); «Ampliar» la muestra a tamaño real.
  return (
    <>
      <p className="nota-panel">El capítulo como saldrá en el informe. Lo azul es lo corregido y no sale en el PDF.</p>
      <VistaDeDocumento titulo="Capítulo del informe" generar={generar} alPintar={marcar} ancla={ancla} />
    </>
  );
}

/** Las respuestas de una sección con un dato cambiado; sin valor, el dato sale. */
function conValor(seccion: Record<string, Valor>, campo: string, valor: Valor | undefined): Record<string, Valor> {
  const copia = { ...seccion };
  if (valor === undefined) delete copia[campo];
  else copia[campo] = valor;
  return copia;
}
