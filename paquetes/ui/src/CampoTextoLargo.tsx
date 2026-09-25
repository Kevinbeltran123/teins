import { useId, type Ref } from "react";
import { claseConError, claseControl } from "./CampoTexto";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";

interface Props {
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
  ayuda?: string | undefined;
  filas?: number;
  maximo?: number;
  ref?: Ref<HTMLTextAreaElement>;
}

/** Texto de varias líneas (comentarios, motivos). Controlado: el formulario decide cuándo guardar. */
export function CampoTextoLargo({ etiqueta, valor, onCambio, obligatorio, error, ayuda, filas = 3, maximo, ref }: Props) {
  const id = useId();
  const descripciones = [ayuda ? `${id}-ayuda` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <EtiquetaCampo htmlFor={id} obligatorio={obligatorio}>
        {etiqueta}
      </EtiquetaCampo>
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-ayuda text-texto-secundario">
          {ayuda}
        </p>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={filas}
        maxLength={maximo}
        className={`${claseControl} py-2 ${error ? claseConError : ""}`}
        value={valor}
        aria-invalid={error ? true : undefined}
        aria-describedby={descripciones || undefined}
        onChange={(e) => onCambio(e.target.value)}
      />
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
    </div>
  );
}
