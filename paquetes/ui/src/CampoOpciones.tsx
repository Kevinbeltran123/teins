import { useId, useState } from "react";
import { claseConError, claseControl } from "./CampoTexto";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";
import { Check } from "./iconos";

export interface SeleccionMultiple {
  elegidas: readonly string[];
  otro?: string | undefined;
}

interface Props {
  etiqueta: string;
  opciones: readonly string[];
  /** El campo admite además un texto libre ("Otro"). */
  otro?: boolean | undefined;
  valorInicial: SeleccionMultiple | undefined;
  /** `undefined` quita la respuesta (nada elegido). */
  onCambio: (valor: SeleccionMultiple | undefined) => void;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
  deshabilitado?: boolean | undefined;
}

/**
 * Lo que se guarda: las elegidas en el orden de la lista (para que el mismo conjunto sea siempre el mismo dato) y el
 * texto de «Otro» solo si tiene algo escrito. Sin nada elegido, no hay respuesta.
 */
export function armarSeleccion(opciones: readonly string[], elegidas: ReadonlySet<string>, otro: string): SeleccionMultiple | undefined {
  const ordenadas = opciones.filter((o) => elegidas.has(o));
  const libre = otro.trim();
  if (ordenadas.length === 0 && libre === "") return undefined;
  return libre === "" ? { elegidas: ordenadas } : { elegidas: ordenadas, otro: libre };
}

const claseFoco = "has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco";

/** Varias opciones a la vez, en filas con casilla: toda la fila se toca (Mobbin: Polarsteps). */
export function CampoOpciones({ etiqueta, opciones, otro, valorInicial, onCambio, obligatorio, error, deshabilitado }: Props) {
  const id = useId();
  const [elegidas, setElegidas] = useState<ReadonlySet<string>>(() => new Set(valorInicial?.elegidas));
  const [otroMarcado, setOtroMarcado] = useState(Boolean(valorInicial?.otro));
  const [texto, setTexto] = useState(valorInicial?.otro ?? "");

  const cambiar = (nuevas: ReadonlySet<string>, marcado: boolean, escrito: string) => {
    setElegidas(nuevas);
    setOtroMarcado(marcado);
    setTexto(escrito);
    // Desmarcar «Otro» no borra lo escrito de la pantalla, pero sí de la respuesta.
    onCambio(armarSeleccion(opciones, nuevas, marcado ? escrito : ""));
  };
  const alternar = (opcion: string) => {
    const nuevas = new Set(elegidas);
    if (nuevas.has(opcion)) nuevas.delete(opcion);
    else nuevas.add(opcion);
    cambiar(nuevas, otroMarcado, texto);
  };

  const fila = (clave: string, texto: string, marcada: boolean, alCambiar: () => void) => (
    <label
      key={clave}
      className={`flex min-h-tactil cursor-pointer items-center gap-3 rounded-panel border-[1.5px] border-borde-suave bg-panel px-4 py-2 text-cuerpo transition-colors has-checked:border-texto has-disabled:cursor-default has-disabled:opacity-50 ${claseFoco} ${error ? "border-error" : ""}`}
    >
      <input type="checkbox" checked={marcada} onChange={alCambiar} className="peer sr-only" />
      <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] border-borde-control text-sobre-superficie peer-checked:border-superficie peer-checked:bg-superficie [&_svg]:size-3.5 [&_svg]:opacity-0 peer-checked:[&_svg]:opacity-100">
        <Check />
      </span>
      <span className="min-w-0">{texto}</span>
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-2" disabled={deshabilitado}>
      <legend className="mb-1.5">
        <EtiquetaCampo id={`${id}-etiqueta`} obligatorio={obligatorio}>
          {etiqueta}
        </EtiquetaCampo>
        <span className="ml-2 text-ayuda font-normal text-texto-secundario">elige todas las que apliquen</span>
      </legend>
      <div role="group" aria-labelledby={`${id}-etiqueta`} aria-describedby={error ? `${id}-error` : undefined} className="flex flex-col gap-2">
        {opciones.map((o) => fila(o, o, elegidas.has(o), () => alternar(o)))}
        {otro && fila("\u0000otro", "Otro", otroMarcado, () => cambiar(elegidas, !otroMarcado, texto))}
      </div>
      {otro && otroMarcado && (
        <input
          type="text"
          aria-label={`${etiqueta}: escribe cuál`}
          placeholder="Escribe cuál"
          autoComplete="off"
          maxLength={120}
          className={`${claseControl} ${error ? claseConError : ""}`}
          value={texto}
          disabled={deshabilitado}
          onChange={(e) => cambiar(elegidas, true, e.target.value)}
        />
      )}
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
    </fieldset>
  );
}
