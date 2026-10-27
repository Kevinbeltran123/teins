import { useState } from "react";
import { normalizarDecimal, type LineaCantidad, type Valor } from "@teins/dominio";
import { EditorCantidades, type LineaEditable } from "@teins/ui";

/** Id de una línea nueva: 8 caracteres en base 36, como los que genera campo. */
const nuevoIdDeLinea = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => (b % 36).toString(36)).join("");

/**
 * Las líneas de cantidad corregidas: la cantidad se escribe como la lee una persona ("12,5") y se guarda
 * como decimal canónico; si no se puede leer, va tal cual y el servidor la marca.
 */
export function CorregirCantidades({
  etiqueta,
  inicial,
  unidades,
  deshabilitado,
  error,
  onCambio,
}: {
  etiqueta: string;
  inicial: readonly LineaCantidad[];
  unidades: readonly string[];
  deshabilitado: boolean;
  error: string | undefined;
  onCambio: (valor: Valor | undefined) => void;
}) {
  const [lineas, setLineas] = useState<LineaEditable[]>(() => inicial.map((l) => ({ ...l, cantidad: l.cantidad.replace(".", ","), observacion: l.observacion ?? "" })));
  if (deshabilitado) return null;
  // El ítem que eligió el técnico viaja con su línea (ADR-0025): corregir la cantidad no lo borra del documento.
  const itemDe = new Map(inicial.flatMap((l) => (l.item ? [[l.id, l.item] as const] : [])));
  function cambiar(nuevas: LineaEditable[]) {
    setLineas(nuevas);
    onCambio(
      nuevas.length === 0
        ? undefined
        : nuevas.map((l) => ({
            id: l.id,
            descripcion: l.descripcion,
            cantidad: normalizarDecimal(l.cantidad) ?? l.cantidad,
            unidad: l.unidad,
            ...(l.observacion.trim() ? { observacion: l.observacion.trim() } : {}),
            ...(itemDe.has(l.id) ? { item: itemDe.get(l.id)! } : {}),
          })),
    );
  }
  return <EditorCantidades etiqueta={etiqueta} lineas={lineas} unidades={unidades} onCambio={cambiar} nuevoId={nuevoIdDeLinea} error={error} disposicion="tabla" />;
}
