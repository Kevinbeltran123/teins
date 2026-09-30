import { useId, useState } from "react";
import { claseConError, claseControl } from "./CampoTexto";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";

interface Props {
  etiqueta: string;
  unidades: readonly string[];
  valorInicial: string;
  unidadInicial: string | undefined;
  /** Se llama también con texto vacío (borrar). Devuelve false si el valor no es válido. */
  onCambio: (valor: string, unidad: string) => boolean;
  obligatorio?: boolean | undefined;
  /** Error que viene de validar el levantamiento completo (al enviar). */
  error?: string | undefined;
  deshabilitado?: boolean;
  /** Respuestas frecuentes que se eligen con un toque (el formato las declara). */
  valoresComunes?: readonly string[] | undefined;
}

/** Número con unidad: la unidad se elige, no se escribe (QA-15, regla 5). */
export function CampoMedida({ etiqueta, unidades, valorInicial, unidadInicial, onCambio, obligatorio, error, deshabilitado, valoresComunes }: Props) {
  const id = useId();
  const [texto, setTexto] = useState(valorInicial);
  const [unidad, setUnidad] = useState(unidadInicial ?? unidades[0] ?? "");
  const [valido, setValido] = useState(true);
  const mensaje = !valido ? "Escribe solo el número, por ejemplo 12,5" : error;

  function cambiar(nuevoTexto: string, nuevaUnidad: string) {
    setTexto(nuevoTexto);
    setUnidad(nuevaUnidad);
    setValido(onCambio(nuevoTexto, nuevaUnidad));
  }

  return (
    <fieldset className="flex flex-col gap-1.5" disabled={deshabilitado}>
      <legend className="mb-1.5">
        <EtiquetaCampo id={`${id}-etiqueta`} obligatorio={obligatorio}>
          {etiqueta}
        </EtiquetaCampo>
      </legend>
      {/* En campo, la cifra y su unidad van en una sola caja grande (rediseño Recorrido); en oficina, un campo normal. */}
      <div className={`flex items-center gap-2 rounded-[var(--t-medida-radio)] border-2 border-transparent bg-[var(--t-medida-fondo)] py-[var(--t-medida-margen)] pr-[var(--t-medida-margen)] pl-[calc(var(--t-medida-margen)*2)] transition-colors focus-within:border-[var(--t-medida-foco)] ${mensaje ? "border-error!" : ""}`}>
        <input
          aria-labelledby={`${id}-etiqueta`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          aria-invalid={mensaje ? true : undefined}
          aria-describedby={mensaje ? `${id}-error` : undefined}
          className={`${claseControl} min-w-0 flex-1 border-[var(--t-medida-control-borde)]! bg-[var(--t-medida-control-fondo)]! px-[var(--t-medida-control-margen)]! text-[length:var(--t-texto-valor)]! font-[number:var(--t-peso-valor)]! tabular-nums placeholder:text-texto-secundario/50 ${mensaje ? claseConError : ""}`}
          value={texto}
          onChange={(e) => cambiar(e.target.value, unidad)}
        />
        <div role="radiogroup" aria-label={`Unidad de ${etiqueta}`} className="flex shrink-0 gap-0.5 rounded-[calc(var(--t-radio-control)-2px)] bg-[var(--t-unidades-fondo)] p-[var(--t-unidades-margen)]">
          {unidades.map((u) => (
            <label
              key={u}
              className="relative flex min-h-[var(--t-unidad-alto)] min-w-14 cursor-pointer items-center justify-center rounded-[calc(var(--t-radio-control)-5px)] border-[1.5px] border-[var(--t-unidad-borde)] px-3 text-cuerpo font-extrabold text-texto-secundario transition-colors has-checked:border-texto has-checked:bg-texto has-checked:text-fondo has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco has-disabled:cursor-default has-disabled:opacity-60"
            >
              <input type="radio" name={id} value={u} checked={unidad === u} onChange={() => cambiar(texto, u)} className="sr-only" />
              {u}
            </label>
          ))}
        </div>
      </div>
      {valoresComunes && valoresComunes.length > 0 && (
        <div role="group" aria-label={`Valores comunes de ${etiqueta}`} className="flex flex-wrap gap-2 pt-1.5">
          {valoresComunes.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => cambiar(v, unidad)}
              aria-pressed={texto === v}
              className="h-11 rounded-full border-[1.5px] border-borde-suave px-4 text-cuerpo font-extrabold tabular-nums transition-colors aria-pressed:border-texto aria-pressed:bg-texto aria-pressed:text-fondo focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              {unidades.length === 1 && unidades[0] !== "und" ? `${v} ${unidades[0]}` : v}
            </button>
          ))}
        </div>
      )}
      {mensaje && <MensajeError id={`${id}-error`}>{mensaje}</MensajeError>}
    </fieldset>
  );
}
