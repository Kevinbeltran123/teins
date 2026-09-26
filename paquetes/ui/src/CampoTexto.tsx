import { useId } from "react";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";

interface Props {
  etiqueta: string;
  valorInicial: string;
  onCambio: (valor: string) => void;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
  deshabilitado?: boolean;
  tipo?: "text" | "password" | "date";
  autoComplete?: string;
  nombre?: string;
  /** Teclado del celular: "numeric" para códigos de verificación. */
  modoEntrada?: "text" | "numeric" | "decimal";
}

export const claseControl =
  "min-h-control w-full rounded-control border-[1.5px] border-borde-control bg-panel px-3 text-cuerpo text-texto transition-shadow placeholder:text-texto-secundario focus:border-borde-activo focus:shadow-[0_0_0_3px_var(--t-foco)] focus:outline-none disabled:bg-fondo disabled:text-texto-secundario";

export const claseConError = "animate-[sacudida_var(--t-duracion-estandar)_var(--t-curva)] border-2 border-error";

/** No controlado: cada tecla se guarda sin volver a leer de la base, así el cursor no salta. */
export function CampoTexto({ etiqueta, valorInicial, onCambio, obligatorio, error, deshabilitado, tipo = "text", autoComplete = "off", nombre, modoEntrada }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <EtiquetaCampo htmlFor={id} obligatorio={obligatorio}>
        {etiqueta}
      </EtiquetaCampo>
      <input
        id={id}
        name={nombre}
        type={tipo}
        autoComplete={autoComplete}
        inputMode={modoEntrada}
        className={`${claseControl} ${error ? claseConError : ""}`}
        defaultValue={valorInicial}
        disabled={deshabilitado}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onCambio(e.target.value)}
      />
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
    </div>
  );
}
