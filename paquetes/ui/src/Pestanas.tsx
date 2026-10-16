import { useId, useRef, type KeyboardEvent } from "react";
import { conTransicion, nombreDeTransicion } from "./transicion";

export interface Pestana<T extends string> {
  valor: T;
  etiqueta: string;
  /** Conteo opcional junto a la etiqueta. */
  cantidad?: number | undefined;
}

/**
 * Pestañas subrayadas de oficina (patrón WAI-ARIA tabs: flechas para moverse). La activa lleva el subrayado, que se
 * desliza hasta la elegida (iteración 27); van en la barra de la lista, con el buscador a la derecha (prototipos/oficina).
 */
export function Pestanas<T extends string>({ pestanas, activa, onCambio, etiqueta }: { pestanas: readonly Pestana<T>[]; activa: T; onCambio: (valor: T) => void; etiqueta: string }) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const indicador = nombreDeTransicion("indicador", useId());
  const cambiar = (valor: T) => void conTransicion(() => onCambio(valor));

  function teclado(evento: KeyboardEvent, indice: number) {
    const paso = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (!paso) return;
    evento.preventDefault();
    const siguiente = (indice + paso + pestanas.length) % pestanas.length;
    cambiar(pestanas[siguiente]!.valor);
    botones.current[siguiente]?.focus();
  }

  return (
    <div role="tablist" aria-label={etiqueta} className="subrayado">
      {pestanas.map((p, i) => {
        const seleccionada = p.valor === activa;
        return (
          <button
            key={p.valor}
            ref={(b) => {
              botones.current[i] = b;
            }}
            type="button"
            role="tab"
            aria-selected={seleccionada}
            tabIndex={seleccionada ? 0 : -1}
            onClick={() => cambiar(p.valor)}
            onKeyDown={(e) => teclado(e, i)}
          >
            {p.etiqueta}
            {p.cantidad !== undefined && <span className="num">{p.cantidad}</span>}
            {seleccionada && <i aria-hidden className="indicador" style={{ viewTransitionName: indicador }} />}
          </button>
        );
      })}
    </div>
  );
}
