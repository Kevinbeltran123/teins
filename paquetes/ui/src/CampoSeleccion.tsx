import { useId } from "react";
import { claseConError, claseControl } from "./CampoTexto";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";

/** Una opción de una lista larga (clientes, sitios): el control nativo, accesible y con el teclado del sistema. */
export function CampoSeleccion({
  etiqueta,
  opciones,
  valor,
  onCambio,
  vacio,
  deshabilitado,
  etiquetaOculta,
  error,
}: {
  etiqueta: string;
  opciones: readonly { valor: string; texto: string }[];
  valor: string;
  onCambio: (valor: string) => void;
  /** Texto de la opción vacía, cuando todavía no se ha elegido nada. */
  vacio?: string;
  deshabilitado?: boolean;
  /** Dentro de una tabla, donde el encabezado de la columna ya dice qué es: la etiqueta queda para el lector de pantalla. */
  etiquetaOculta?: boolean;
  /** Mensaje del campo al validar (se valida al enviar). */
  error?: string | undefined;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      {etiquetaOculta ? (
        <label htmlFor={id} className="sr-only">
          {etiqueta}
        </label>
      ) : (
        <EtiquetaCampo htmlFor={id}>{etiqueta}</EtiquetaCampo>
      )}
      <select
        id={id}
        className={`${claseControl} ${error ? claseConError : ""}`}
        value={valor}
        disabled={deshabilitado}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onCambio(e.target.value)}
      >
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
    </div>
  );
}
