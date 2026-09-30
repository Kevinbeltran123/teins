import { useId, useState } from "react";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";
import { Search } from "./iconos";
import type { LineaEditable } from "./Cantidades";
import { useNotificar } from "./Notificaciones";
import { BotonAgregar } from "./Recorrido";

/** Lee una cantidad escrita en campo ("12,5") como número; lo que no se lee cuenta como 0. */
const numero = (texto: string) => {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const escribir = (n: number) => String(n).replace(".", ",");

/**
 * Materiales como en el prototipo aprobado (Gojek, Keeta en Mobbin): una fila por material con − cantidad +,
 * el catálogo como entrada principal y la línea libre como enlace. Bajar a 0 quita la línea (se deshace desde
 * la notificación de quien la use).
 */
export function EditorMateriales({
  etiqueta,
  lineas,
  unidades,
  onCambio,
  nuevoId,
  obligatorio,
  error,
  buscar,
}: {
  etiqueta: string;
  lineas: readonly LineaEditable[];
  unidades: readonly string[];
  onCambio: (lineas: LineaEditable[]) => void;
  nuevoId: () => string;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
  /** Abre el catálogo; sin él, solo hay líneas libres. */
  buscar?: (() => void) | undefined;
}) {
  const id = useId();
  // Las líneas con la nota abierta; una nota escrita siempre se ve.
  const [conNota, setConNota] = useState<ReadonlySet<string>>(new Set());
  const cambiar = (i: number, cambio: Partial<LineaEditable>) => onCambio(lineas.map((l, j) => (j === i ? { ...l, ...cambio } : l)));
  const notificar = useNotificar();
  // Bajar a cero quita la línea al instante; "Deshacer" la devuelve (DESIGN.md, iteración 24c).
  const quitar = (i: number) => {
    const antes = [...lineas];
    onCambio(lineas.filter((_, j) => j !== i));
    notificar({ texto: `${lineas[i]!.descripcion.trim() || "Material"} quitado`, accion: { texto: "Deshacer", alHacer: () => onCambio(antes) } });
  };
  const sumar = (i: number, delta: number) => {
    const siguiente = Math.max(0, numero(lineas[i]!.cantidad) + delta);
    if (siguiente === 0) quitar(i);
    else cambiar(i, { cantidad: escribir(siguiente) });
  };
  const libre = () => onCambio([...lineas, { id: nuevoId(), descripcion: "", cantidad: "1", unidad: unidades[0] ?? "", observacion: "" }]);

  return (
    <section aria-labelledby={`${id}-etiqueta`} className="flex flex-col gap-3">
      <span className="sr-only">
        <EtiquetaCampo id={`${id}-etiqueta`} obligatorio={obligatorio}>
          {etiqueta}
        </EtiquetaCampo>
      </span>
      {lineas.length === 0 && <p className="text-cuerpo text-texto-secundario">Busca en el catálogo lo que vas a usar. Si no está, agrégalo como línea libre.</p>}
      {lineas.map((l, i) => (
        <div key={l.id} role="group" aria-label={`Línea ${i + 1}`} className="flex flex-col gap-3 rounded-panel border border-division bg-panel py-3.5 pr-3.5 pl-4.5 motion-safe:animate-subir">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 grow flex-col">
              {l.catalogo ? (
                <>
                  <strong className="text-cuerpo leading-snug">{l.descripcion}</strong>
                  <span className="text-ayuda text-texto-secundario">{`${l.catalogo.codigo || "Catálogo"} · ${l.unidad}`}</span>
                </>
              ) : (
                <input
                  aria-label={`Descripción de la línea ${i + 1}`}
                  value={l.descripcion}
                  placeholder="Qué material"
                  onChange={(e) => cambiar(i, { descripcion: e.target.value })}
                  className="w-full rounded-control border-b-2 border-borde-suave bg-transparent py-1 text-cuerpo font-bold outline-none placeholder:font-normal placeholder:text-texto-secundario focus:border-foco"
                />
              )}
            </div>
            <div className="flex shrink-0 items-center rounded-control bg-panel-hundido">
              <button type="button" aria-label={`Menos de la línea ${i + 1}`} onClick={() => sumar(i, -1)} className="grid h-12 w-11 place-items-center text-subtitulo font-extrabold active:scale-90">
                −
              </button>
              <input
                aria-label={`Cantidad de la línea ${i + 1}`}
                inputMode="decimal"
                value={l.cantidad}
                onChange={(e) => cambiar(i, { cantidad: e.target.value })}
                className="w-12 bg-transparent text-center text-cuerpo font-extrabold tabular-nums outline-none focus:text-acento"
              />
              <button type="button" aria-label={`Más de la línea ${i + 1}`} onClick={() => sumar(i, 1)} className="grid h-12 w-11 place-items-center text-subtitulo font-extrabold active:scale-90">
                +
              </button>
            </div>
          </div>
          {conNota.has(l.id) || l.observacion ? (
            <input
              aria-label={`Observación de la línea ${i + 1} (opcional)`}
              value={l.observacion}
              placeholder="Nota para oficina"
              onChange={(e) => cambiar(i, { observacion: e.target.value })}
              className="w-full rounded-control bg-panel-hundido px-3 py-2.5 text-ayuda outline-none placeholder:text-texto-secundario focus:outline-2 focus:outline-foco"
            />
          ) : (
            <button type="button" onClick={() => setConNota((n) => new Set(n).add(l.id))} className="self-start text-ayuda font-bold text-texto-secundario underline underline-offset-3">
              Agregar nota
            </button>
          )}
          {!l.catalogo && unidades.length > 1 && (
            <div role="radiogroup" aria-label={`Unidad de la línea ${i + 1}`} className="flex gap-1.5">
              {unidades.map((u) => (
                <label key={u} className="flex h-9 cursor-pointer items-center rounded-full border-[1.5px] border-borde-suave px-3.5 text-ayuda font-extrabold text-texto-secundario has-checked:border-texto has-checked:bg-texto has-checked:text-fondo has-focus-visible:outline-3 has-focus-visible:outline-foco">
                  <input type="radio" className="sr-only" name={`${id}-unidad-${l.id}`} checked={l.unidad === u} onChange={() => cambiar(i, { unidad: u })} />
                  {u}
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      {buscar && (
        <BotonAgregar icono={Search} onClick={buscar}>
          Buscar en el catálogo
        </BotonAgregar>
      )}
      <button type="button" onClick={libre} className="self-center py-2 text-ayuda font-bold text-texto-secundario underline underline-offset-3 focus-visible:outline-3 focus-visible:outline-foco">
        {buscar ? "No está en el catálogo: agregar línea libre" : "Agregar línea libre"}
      </button>
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
      {lineas.length > 0 && (
        <span
          aria-live="polite"
          className="fixed bottom-[calc(max(1.25rem,env(safe-area-inset-bottom))+76px)] left-1/2 z-20 -translate-x-1/2 rounded-full bg-texto px-4.5 py-2.5 text-ayuda font-extrabold text-fondo shadow-menu"
        >
          {lineas.length === 1 ? "1 material" : `${lineas.length} materiales`}
        </span>
      )}
    </section>
  );
}
