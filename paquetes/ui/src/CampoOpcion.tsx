import { useId, useState } from "react";
import { claseConError, claseControl } from "./CampoTexto";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";

/**
 * Pocas opciones y cortas (Sí/No, Bueno/Regular/Malo) caben en una fila de botones; si no, una lista vertical en la
 * que toda la fila se toca (ADR-0050; referencias de Mobbin: Tripadvisor para la fila, Cash App para la lista).
 */
export const formaDeOpciones = (opciones: readonly string[], otro = false): "fila" | "lista" =>
  opciones.length + (otro ? 1 : 0) <= 4 && opciones.every((o) => o.length <= 14) ? "fila" : "lista";

interface Props {
  etiqueta: string;
  opciones: readonly string[];
  /** El campo admite además un texto libre ("Otro"). */
  otro?: boolean | undefined;
  /** Lo guardado: una de las opciones o, si el campo admite «Otro», el texto escrito. */
  valorInicial: string | undefined;
  /** `undefined` quita la respuesta. */
  onCambio: (valor: string | undefined) => void;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
  deshabilitado?: boolean | undefined;
}

const OTRO = "\u0000otro";

const claseFoco = "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco";

/**
 * Una opción entre varias. Nada viene elegido: elegir es una decisión del técnico. Tocar la elegida la quita en los
 * campos opcionales; en los obligatorios se cambia, o se marca «No se pudo obtener» (regla 3).
 */
export function CampoOpcion({ etiqueta, opciones, otro, valorInicial, onCambio, obligatorio, error, deshabilitado }: Props) {
  const id = useId();
  const esLibre = valorInicial !== undefined && !opciones.includes(valorInicial);
  // La opción marcada: una de la lista, "Otro" (con o sin texto todavía) o ninguna.
  const [marcada, setMarcada] = useState<string | undefined>(esLibre ? OTRO : valorInicial);
  const [texto, setTexto] = useState(esLibre ? valorInicial : "");
  const forma = formaDeOpciones(opciones, otro);

  const elegir = (opcion: string) => {
    if (marcada === opcion && !obligatorio) {
      setMarcada(undefined);
      setTexto("");
      onCambio(undefined);
      return;
    }
    setMarcada(opcion);
    if (opcion === OTRO) onCambio(texto.trim() === "" ? undefined : texto);
    else onCambio(opcion);
  };

  const todas = [...opciones, ...(otro ? [OTRO] : [])];
  const textoDe = (o: string) => (o === OTRO ? "Otro" : o);

  return (
    <fieldset className="flex flex-col gap-2" disabled={deshabilitado}>
      <legend className="mb-1.5">
        <EtiquetaCampo id={`${id}-etiqueta`} obligatorio={obligatorio}>
          {etiqueta}
        </EtiquetaCampo>
      </legend>
      <div role="radiogroup" aria-labelledby={`${id}-etiqueta`} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className={forma === "fila" ? "flex flex-wrap gap-2" : "flex flex-col gap-2"}>
        {todas.map((o) =>
          forma === "fila" ? (
            <label
              key={o}
              className={`relative flex h-11 min-w-16 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-borde-suave px-4 text-cuerpo font-extrabold transition-colors has-checked:border-texto has-checked:bg-texto has-checked:text-fondo has-disabled:cursor-default has-disabled:opacity-50 ${claseFoco} ${error ? "border-error" : ""}`}
            >
              <input type="radio" name={id} checked={marcada === o} onChange={() => undefined} onClick={() => elegir(o)} className="sr-only" />
              {textoDe(o)}
            </label>
          ) : (
            <label
              key={o}
              className={`flex min-h-tactil cursor-pointer items-center justify-between gap-3 rounded-panel border-[1.5px] border-borde-suave bg-panel px-4 py-2 text-cuerpo transition-colors has-checked:border-texto has-checked:font-medium has-disabled:cursor-default has-disabled:opacity-50 ${claseFoco} ${error ? "border-error" : ""}`}
            >
              <span className="min-w-0">{textoDe(o)}</span>
              <input type="radio" name={id} checked={marcada === o} onChange={() => undefined} onClick={() => elegir(o)} className="peer sr-only" />
              <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-borde-control peer-checked:border-superficie peer-checked:after:size-2.5 peer-checked:after:rounded-full peer-checked:after:bg-superficie" />
            </label>
          ),
        )}
      </div>
      {marcada === OTRO && (
        <input
          type="text"
          aria-label={`${etiqueta}: escribe cuál`}
          placeholder="Escribe cuál"
          autoComplete="off"
          maxLength={120}
          className={`${claseControl} ${error ? claseConError : ""}`}
          value={texto}
          disabled={deshabilitado}
          onChange={(e) => {
            setTexto(e.target.value);
            onCambio(e.target.value.trim() === "" ? undefined : e.target.value);
          }}
        />
      )}
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
    </fieldset>
  );
}
