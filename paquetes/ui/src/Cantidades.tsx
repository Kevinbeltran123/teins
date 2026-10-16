import { useEffect, useRef, type ReactNode } from "react";
import { Boton, BotonIcono } from "./Boton";
import { CampoSeleccion } from "./CampoSeleccion";
import { CampoTexto } from "./CampoTexto";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";
import { Plus, Search, Trash } from "./iconos";
import { useNotificar, useRetirarNotificacion } from "./Notificaciones";

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
  /**
   * Elegida del catálogo en campo (iteración 17, ADR-0025): la descripción y la unidad vienen del ítem y no se
   * editan; si el ítem no sirve, se quita la línea.
   */
  catalogo?: { id: string; codigo: string } | undefined;
}

const lineaLibre = (id: string, unidades: readonly string[]): LineaEditable => ({ id, descripcion: "", cantidad: "", unidad: unidades[0] ?? "", observacion: "" });

export function EditorCantidades({
  etiqueta,
  lineas,
  unidades,
  onCambio,
  nuevoId,
  obligatorio,
  error,
  agregarDelCatalogo,
  disposicion = "tarjetas",
}: {
  etiqueta: string;
  lineas: readonly LineaEditable[];
  unidades: readonly string[];
  onCambio: (lineas: LineaEditable[]) => void;
  /** Id estable para una línea nueva. */
  nuevoId: () => string;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
  /** Abre la búsqueda en el catálogo; sin ella (no hay catálogo, o es oficina) solo se agregan líneas libres. */
  agregarDelCatalogo?: (() => void) | undefined;
  /**
   * "tabla" en oficina (iteración 29): una fila por línea con un solo encabezado, en lugar de una tarjeta con cuatro
   * campos que repiten "de la línea N". En el teléfono siguen las tarjetas.
   */
  disposicion?: "tarjetas" | "tabla";
}) {
  const notificar = useNotificar();
  const retirar = useRetirarNotificacion();
  // Al cerrarse el editor (se guardó la corrección, «No se pudo obtener»), sus «Deshacer» se retiran: ya no tienen
  // dónde devolver la línea y quedarían ofreciéndose sin hacer nada (iteración 42).
  const avisos = useRef(new Set<number>());
  useEffect(() => {
    const deEsteEditor = avisos.current;
    return () => deEsteEditor.forEach(retirar);
  }, [retirar]);
  // Las líneas de ahora, para «Deshacer»: la notificación vive más que el pintado en que se quitó la línea.
  const vigente = useRef({ lineas, onCambio });
  vigente.current = { lineas, onCambio };
  const cambiar = (i: number, cambio: Partial<LineaEditable>) => onCambio(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  // Quitar es inmediato y se puede deshacer: preguntar antes solo entrenaría a aceptar sin leer (DESIGN.md). «Deshacer»
  // devuelve solo esa línea, a su lugar y sobre las líneas de ahora: volver a la lista de antes borraría lo escrito
  // después en las demás (sus celdas no se controlan). Una sola vez: si ya volvió, no se duplica.
  function quitar(i: number) {
    const quitada = lineas[i]!;
    onCambio(lineas.filter((_, j) => j !== i));
    avisos.current.add(notificar({
      texto: `Línea ${i + 1} quitada`,
      accion: {
        texto: "Deshacer",
        alHacer: () => {
          const { lineas: ahora, onCambio: devolver } = vigente.current;
          if (!ahora.some((l) => l.id === quitada.id)) devolver([...ahora.slice(0, i), quitada, ...ahora.slice(i)]);
        },
      },
    }));
  }
  const errorId = `error-cantidades-${etiqueta}`;
  const agregarLibre = () => onCambio([...lineas, lineaLibre(nuevoId(), unidades)]);
  if (disposicion === "tabla") {
    return (
      <fieldset className="flex flex-col gap-3" aria-describedby={error ? errorId : undefined}>
        <legend className="mb-1.5">
          <EtiquetaCampo obligatorio={obligatorio}>{etiqueta}</EtiquetaCampo>
        </legend>
        <div className="mat-tabla">
          <div className="fila-m cab-m" aria-hidden>
            <span>Descripción</span>
            <span className="num">Cantidad</span>
            <span>Unidad</span>
            <span>Observación</span>
            <span />
          </div>
          {lineas.length === 0 && <p className="vacia-m">Todavía no hay líneas.</p>}
          {lineas.map((l, i) => (
            <div key={l.id} role="group" aria-label={`Línea ${i + 1}`} className="fila-m">
              {l.catalogo ? (
                <span className="del-catalogo" title={`Del catálogo${l.catalogo.codigo ? ` · ${l.catalogo.codigo}` : ""}`}>
                  {l.descripcion}
                </span>
              ) : (
                <input className="control-m" aria-label={`Descripción de la línea ${i + 1}`} defaultValue={l.descripcion} onChange={(e) => cambiar(i, { descripcion: e.target.value })} />
              )}
              <input className="control-m num" aria-label={`Cantidad de la línea ${i + 1}`} inputMode="decimal" defaultValue={l.cantidad} onChange={(e) => cambiar(i, { cantidad: e.target.value })} />
              {l.catalogo ? (
                <span className="del-catalogo">{l.unidad}</span>
              ) : (
                <select className="control-m" aria-label={`Unidad de la línea ${i + 1}`} value={l.unidad} onChange={(e) => cambiar(i, { unidad: e.target.value })}>
                  {unidades.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              )}
              <input className="control-m" aria-label={`Observación de la línea ${i + 1} (opcional)`} placeholder="Opcional" defaultValue={l.observacion} onChange={(e) => cambiar(i, { observacion: e.target.value })} />
              <BotonIcono icono={Trash} etiqueta={`Quitar la línea ${i + 1}`} tamano="pequeno" onClick={() => quitar(i)} />
            </div>
          ))}
          <div className="nueva-m">
            <Boton variante="fantasma" tamano="pequeno" icono={Plus} onClick={agregarLibre}>
              Agregar línea
            </Boton>
          </div>
        </div>
        {error && <MensajeError id={errorId}>{error}</MensajeError>}
      </fieldset>
    );
  }
  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1.5">
        <EtiquetaCampo obligatorio={obligatorio}>{etiqueta}</EtiquetaCampo>
      </legend>
      {lineas.length === 0 && <p className="text-ayuda text-texto-secundario">Todavía no hay líneas.</p>}
      {lineas.map((l, i) => (
        <div key={l.id} role="group" aria-label={`Línea ${i + 1}`} className="flex flex-col gap-3 rounded-panel border border-division p-3">
          <div className="-mb-1 flex items-center justify-between">
            <span className="text-ayuda font-bold text-texto-secundario">{`Línea ${i + 1}`}</span>
            <BotonIcono icono={Trash} etiqueta={`Quitar la línea ${i + 1}`} tamano="pequeno" onClick={() => quitar(i)} />
          </div>
          {l.catalogo ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-cuerpo font-bold">{l.descripcion}</span>
              <span className="text-ayuda text-texto-secundario">Del catálogo{l.catalogo.codigo ? ` · ${l.catalogo.codigo}` : ""}</span>
            </div>
          ) : (
            <CampoTexto etiqueta={`Descripción de la línea ${i + 1}`} valorInicial={l.descripcion} onCambio={(descripcion) => cambiar(i, { descripcion })} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <CampoTexto etiqueta={`Cantidad de la línea ${i + 1}`} modoEntrada="decimal" valorInicial={l.cantidad} onCambio={(cantidad) => cambiar(i, { cantidad })} />
            {l.catalogo ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-cuerpo font-bold">Unidad</span>
                <span className="flex min-h-control items-center text-cuerpo font-bold">{l.unidad}</span>
              </div>
            ) : (
              <CampoSeleccion etiqueta={`Unidad de la línea ${i + 1}`} valor={l.unidad} onCambio={(unidad) => cambiar(i, { unidad })} opciones={unidades.map((u) => ({ valor: u, texto: u }))} />
            )}
          </div>
          <CampoTexto etiqueta={`Observación de la línea ${i + 1} (opcional)`} valorInicial={l.observacion} onCambio={(observacion) => cambiar(i, { observacion })} />
        </div>
      ))}
      {error && <MensajeError id={errorId}>{error}</MensajeError>}
      {agregarDelCatalogo ? (
        <div className="grid grid-cols-2 gap-2">
          <Boton icono={Search} onClick={agregarDelCatalogo}>
            Del catálogo
          </Boton>
          <Boton icono={Plus} onClick={() => onCambio([...lineas, lineaLibre(nuevoId(), unidades)])}>
            Línea libre
          </Boton>
        </div>
      ) : (
        <div>
          <Boton icono={Plus} onClick={() => onCambio([...lineas, lineaLibre(nuevoId(), unidades)])}>
            Agregar línea
          </Boton>
        </div>
      )}
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
