import { useId, useState } from "react";
import { Boton } from "./Boton";
import { claseConError, claseControl } from "./CampoTexto";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";

export interface Horario {
  desde: string;
  hasta?: string | undefined;
}

interface Props {
  etiqueta: string;
  valorInicial: Horario | undefined;
  /** `undefined` quita la respuesta. La salida no se guarda sin la llegada. */
  onCambio: (valor: Horario | undefined) => void;
  /** El total entre las dos horas, como lo escribe el dominio ("3 h 16 min"): `ui` no depende de otros paquetes. */
  total: (desde: string, hasta: string) => string | null;
  /** La llegada se sugiere, nunca se llena sola: la hora y el texto del botón ("Usar 8:14 a. m. (foto de llegada)"). */
  sugerenciaDeLlegada?: { hora: string; texto: string } | undefined;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
  deshabilitado?: boolean | undefined;
}

/** La hora del teléfono como "HH:MM", lo que entiende `<input type="time">`. */
export const horaDelTelefono = (ahora = new Date()) => `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

/**
 * Llegada y salida lado a lado (Mobbin: LinkedIn, Mindtrip), cada una con «Ahora», y el total debajo. La salida espera a
 * la llegada: una salida sin llegada no es un dato (ADR-0050).
 */
export function CampoHorario({ etiqueta, valorInicial, onCambio, total, sugerenciaDeLlegada, obligatorio, error, deshabilitado }: Props) {
  const id = useId();
  const [desde, setDesde] = useState(valorInicial?.desde ?? "");
  const [hasta, setHasta] = useState(valorInicial?.hasta ?? "");

  const cambiar = (nuevaDesde: string, nuevaHasta: string) => {
    // Sin llegada no hay salida: quitar la llegada borra el horario.
    const salida = nuevaDesde === "" ? "" : nuevaHasta;
    setDesde(nuevaDesde);
    setHasta(salida);
    onCambio(nuevaDesde === "" ? undefined : { desde: nuevaDesde, ...(salida === "" ? {} : { hasta: salida }) });
  };

  const duracion = desde !== "" && hasta !== "" ? total(desde, hasta) : null;
  const alDiaSiguiente = desde !== "" && hasta !== "" && hasta < desde;

  const hora = (clave: "desde" | "hasta", rotulo: string, valor: string, bloqueada: boolean) => (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`${id}-${clave}`} className="text-ayuda font-medium text-texto-secundario">
          {rotulo}
        </label>
        <Boton
          variante="fantasma"
          tamano="pequeno"
          disabled={deshabilitado || bloqueada}
          aria-label={`Poner la hora actual en ${rotulo.toLowerCase()}`}
          onClick={() => cambiar(clave === "desde" ? horaDelTelefono() : desde, clave === "hasta" ? horaDelTelefono() : hasta)}
        >
          Ahora
        </Boton>
      </div>
      <input
        id={`${id}-${clave}`}
        type="time"
        value={valor}
        disabled={deshabilitado || bloqueada}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`${claseControl} tabular-nums ${error ? claseConError : ""}`}
        onChange={(e) => cambiar(clave === "desde" ? e.target.value : desde, clave === "hasta" ? e.target.value : hasta)}
      />
    </div>
  );

  return (
    <fieldset className="flex flex-col gap-2" disabled={deshabilitado}>
      <legend className="mb-1.5">
        <EtiquetaCampo obligatorio={obligatorio}>{etiqueta}</EtiquetaCampo>
      </legend>
      <div className="flex gap-3">
        {hora("desde", "Llegada", desde, false)}
        {hora("hasta", "Salida", hasta, desde === "")}
      </div>
      {desde === "" && sugerenciaDeLlegada && (
        <Boton variante="secundaria" tamano="pequeno" disabled={deshabilitado} className="self-start" onClick={() => cambiar(sugerenciaDeLlegada.hora, hasta)}>
          {sugerenciaDeLlegada.texto}
        </Boton>
      )}
      {duracion && (
        <p aria-live="polite" className="text-cuerpo tabular-nums">
          <span className="text-texto-secundario">Total </span>
          <strong className="font-semibold">{duracion}</strong>
          {alDiaSiguiente && <span className="text-ayuda text-texto-secundario"> · la salida es al día siguiente</span>}
        </p>
      )}
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
    </fieldset>
  );
}
