import type { ReactNode } from "react";
import { Boton } from "./Boton";
import { CampoSeleccion } from "./CampoSeleccion";
import { CampoTexto } from "./CampoTexto";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";

/**
 * Tabla de cantidades (F9): materiales y trabajos con descripción, cantidad, unidad y observación, sin
 * precio. La edita el técnico en campo y la corrige oficina; la cantidad se escribe como la ve una
 * persona ("12,5") y quien la usa la convierte al decimal canónico.
 */
export interface LineaEditable {
  id: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  observacion: string;
}

export function EditorCantidades({
  etiqueta,
  lineas,
  unidades,
  onCambio,
  nuevoId,
  obligatorio,
  error,
}: {
  etiqueta: string;
  lineas: readonly LineaEditable[];
  unidades: readonly string[];
  onCambio: (lineas: LineaEditable[]) => void;
  /** Id estable para una línea nueva. */
  nuevoId: () => string;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
}) {
  const cambiar = (i: number, cambio: Partial<LineaEditable>) => onCambio(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  const errorId = `error-cantidades-${etiqueta}`;
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5">
        <EtiquetaCampo obligatorio={obligatorio}>{etiqueta}</EtiquetaCampo>
      </legend>
      {lineas.length === 0 && <p className="text-ayuda text-texto-secundario">Todavía no hay líneas.</p>}
      {lineas.map((l, i) => (
        <div key={l.id} role="group" aria-label={`Línea ${i + 1}`} className="flex flex-col gap-3 rounded-control border border-division p-3">
          <CampoTexto etiqueta={`Descripción de la línea ${i + 1}`} valorInicial={l.descripcion} onCambio={(descripcion) => cambiar(i, { descripcion })} />
          <div className="grid grid-cols-2 gap-3">
            <CampoTexto etiqueta={`Cantidad de la línea ${i + 1}`} modoEntrada="decimal" valorInicial={l.cantidad} onCambio={(cantidad) => cambiar(i, { cantidad })} />
            <CampoSeleccion etiqueta={`Unidad de la línea ${i + 1}`} valor={l.unidad} onCambio={(unidad) => cambiar(i, { unidad })} opciones={unidades.map((u) => ({ valor: u, texto: u }))} />
          </div>
          <CampoTexto etiqueta={`Observación de la línea ${i + 1} (opcional)`} valorInicial={l.observacion} onCambio={(observacion) => cambiar(i, { observacion })} />
          <div>
            <Boton onClick={() => onCambio(lineas.filter((_, j) => j !== i))}>{`Quitar la línea ${i + 1}`}</Boton>
          </div>
        </div>
      ))}
      {error && <MensajeError id={errorId}>{error}</MensajeError>}
      <div>
        <Boton onClick={() => onCambio([...lineas, { id: nuevoId(), descripcion: "", cantidad: "", unidad: unidades[0] ?? "", observacion: "" }])}>Agregar línea</Boton>
      </div>
    </fieldset>
  );
}

/** La tabla para leer, con una columna extra opcional (en oficina, el vínculo al catálogo). */
export function TablaCantidades({
  etiqueta,
  lineas,
  extra,
}: {
  etiqueta: string;
  lineas: readonly { id: string; descripcion: string; cantidad: string; unidad: string; observacion?: string | undefined }[];
  extra?: { titulo: string; celda: (id: string) => ReactNode } | undefined;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-cuerpo font-bold">{etiqueta}</span>
      {lineas.length === 0 ? (
        <p className="text-ayuda text-texto-secundario">Sin líneas.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-cuerpo">
            <caption className="sr-only">{etiqueta}</caption>
            <thead className="text-ayuda text-texto-secundario">
              <tr className="border-b border-division">
                <th scope="col" className="py-2 pr-3 font-normal">Descripción</th>
                <th scope="col" className="py-2 pr-3 text-right font-normal">Cantidad</th>
                <th scope="col" className="py-2 pr-3 font-normal">Unidad</th>
                <th scope="col" className="py-2 pr-3 font-normal">Observación</th>
                {extra && <th scope="col" className="py-2 font-normal">{extra.titulo}</th>}
              </tr>
            </thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.id} className="border-b border-division align-top last:border-0">
                  <td className="py-2 pr-3">{l.descripcion}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{l.cantidad.replace(".", ",")}</td>
                  <td className="py-2 pr-3">{l.unidad}</td>
                  <td className="py-2 pr-3 text-texto-secundario">{l.observacion ?? ""}</td>
                  {extra && <td className="py-2">{extra.celda(l.id)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
