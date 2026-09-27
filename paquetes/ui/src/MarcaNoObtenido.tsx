import { useEffect, useId, useState } from "react";
import { claseConError, claseControl } from "./CampoTexto";
import { MensajeError } from "./Etiqueta";

interface Props {
  /** Nombre del dato, para que el lector de pantalla diga a qué se refiere. */
  dato: string;
  marcado: boolean;
  motivoInicial: string;
  onCambio: (marcado: boolean, motivo: string) => void;
  error?: string | undefined;
}

/** Regla 3: un dato obligatorio que no se pudo obtener se marca, con su motivo escrito. */
export function MarcaNoObtenido({ dato, marcado: guardado, motivoInicial, onCambio, error }: Props) {
  const id = useId();
  const [motivo, setMotivo] = useState(motivoInicial);
  // Responde al toque de inmediato; el valor guardado llega un instante después y manda.
  const [marcado, setMarcado] = useState(guardado);
  useEffect(() => setMarcado(guardado), [guardado]);
  return (
    <div className="flex flex-col gap-2">
      {/* Discreto, como un enlace: la excepción no ocupa lo mismo que el dato (rediseño Recorrido). Sigue siendo una casilla. */}
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 self-start text-ayuda font-bold text-texto-secundario underline underline-offset-3 has-checked:text-alerta-texto has-checked:no-underline has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco">
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => {
            setMarcado(e.target.checked);
            onCambio(e.target.checked, motivo);
          }}
          aria-label={`${dato}: no se pudo obtener`}
          className="peer sr-only"
        />
        <span aria-hidden className="hidden rounded-full bg-alerta-fondo px-2 peer-checked:inline">✓</span>
        No se pudo obtener
      </label>
      {marcado && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-cuerpo font-bold">
            Motivo
          </label>
          <input
            id={id}
            className={`${claseControl} ${error ? claseConError : ""}`}
            value={motivo}
            placeholder="Por ejemplo: tablero cerrado con llave"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => {
              setMotivo(e.target.value);
              onCambio(true, e.target.value);
            }}
          />
          {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
        </div>
      )}
    </div>
  );
}
