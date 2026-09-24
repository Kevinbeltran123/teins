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
}

/** Número con unidad: la unidad se elige, no se escribe (QA-15, regla 5). */
export function CampoMedida({ etiqueta, unidades, valorInicial, unidadInicial, onCambio, obligatorio, error, deshabilitado }: Props) {
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
      <div className="flex gap-2">
        <input
          aria-labelledby={`${id}-etiqueta`}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={mensaje ? true : undefined}
          aria-describedby={mensaje ? `${id}-error` : undefined}
          className={`${claseControl} min-w-0 flex-1 ${mensaje ? claseConError : ""}`}
          value={texto}
          onChange={(e) => cambiar(e.target.value, unidad)}
        />
        <div role="radiogroup" aria-label={`Unidad de ${etiqueta}`} className="flex gap-1">
          {unidades.map((u) => (
            <label
              key={u}
              className="relative flex min-h-tactil-campo min-w-tactil-campo cursor-pointer items-center justify-center rounded-control border-[1.5px] border-borde-control px-2 text-campo font-bold has-checked:border-superficie has-checked:bg-superficie has-checked:text-sobre-superficie has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-superficie has-disabled:cursor-default has-disabled:opacity-60"
            >
              <input type="radio" name={id} value={u} checked={unidad === u} onChange={() => cambiar(texto, u)} className="sr-only" />
              {u}
            </label>
          ))}
        </div>
      </div>
      {mensaje && <MensajeError id={`${id}-error`}>{mensaje}</MensajeError>}
    </fieldset>
  );
}
