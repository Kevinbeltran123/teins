import { useId, useRef, useState } from "react";
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
  /** Un nombre propuesto ("Hoja 3"): al enfocarlo queda seleccionado, y lo que se escribe lo reemplaza. */
  seleccionarAlEnfocar?: boolean;
  /** Varias líneas (el formato lo pide con `largo`). */
  largo?: boolean | undefined;
  /** Respuestas frecuentes que se eligen con un toque (el formato las declara). */
  valoresComunes?: readonly string[] | undefined;
}

export const claseControl =
  "min-h-control w-full rounded-control border-[1.5px] border-[var(--t-control-borde)] bg-[var(--t-control-fondo)] px-3 text-cuerpo text-texto transition-shadow placeholder:text-texto-secundario focus:border-[var(--t-control-borde-foco)] focus:shadow-[0_0_0_3px_var(--t-control-halo)] focus:outline-none disabled:bg-fondo disabled:text-texto-secundario";

export const claseConError = "animate-[sacudida_var(--t-duracion-estandar)_var(--t-curva)] border-2 border-error";

/** No controlado: cada tecla se guarda sin volver a leer de la base, así el cursor no salta. */
export function CampoTexto({ etiqueta, valorInicial, onCambio, obligatorio, error, deshabilitado, tipo = "text", autoComplete = "off", nombre, modoEntrada, seleccionarAlEnfocar, largo, valoresComunes }: Props) {
  const id = useId();
  const campo = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  // Solo para marcar el valor común elegido; el campo sigue sin controlarse (el cursor no salta).
  const [actual, setActual] = useState(valorInicial);
  const cambiar = (valor: string) => {
    setActual(valor);
    onCambio(valor);
  };
  const comunes = valoresComunes && valoresComunes.length > 0 && (
    <div role="group" aria-label={`Valores comunes de ${etiqueta}`} className="flex flex-wrap gap-2">
      {valoresComunes.map((v) => (
        <button
          key={v}
          type="button"
          disabled={deshabilitado}
          aria-pressed={actual === v}
          onClick={() => {
            if (campo.current) campo.current.value = v;
            cambiar(v);
          }}
          className="h-11 rounded-full border-[1.5px] border-borde-suave px-4 text-cuerpo font-extrabold transition-colors aria-pressed:border-texto aria-pressed:bg-texto aria-pressed:text-fondo disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          {v}
        </button>
      ))}
    </div>
  );
  return (
    <div className="flex flex-col gap-1.5">
      <EtiquetaCampo htmlFor={id} obligatorio={obligatorio}>
        {etiqueta}
      </EtiquetaCampo>
      {comunes}
      {largo ? (
        <textarea
          ref={campo}
          id={id}
          name={nombre}
          rows={3}
          className={`${claseControl} min-h-24 resize-none py-3 ${error ? claseConError : ""}`}
          defaultValue={valorInicial}
          disabled={deshabilitado}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => cambiar(e.target.value)}
        />
      ) : (
        <input
          ref={campo}
          id={id}
          name={nombre}
          type={tipo}
          autoComplete={autoComplete}
          inputMode={modoEntrada}
          className={`${claseControl} ${error ? claseConError : ""}`}
          defaultValue={valorInicial}
          disabled={deshabilitado}
          placeholder={comunes ? "Otro: escríbelo aquí" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => cambiar(e.target.value)}
          onFocus={seleccionarAlEnfocar ? (e) => e.target.select() : undefined}
        />
      )}
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
    </div>
  );
}
