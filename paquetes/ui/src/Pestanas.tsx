import { useRef, type KeyboardEvent } from "react";

export interface Pestana<T extends string> {
  valor: T;
  etiqueta: string;
  /** Conteo opcional junto a la etiqueta. */
  cantidad?: number | undefined;
}

/**
 * Pestañas accesibles (patrón WAI-ARIA tabs): flechas para moverse entre ellas. El indicador de la
 * activa se desliza con CSS (DESIGN.md, "Cambio de pestaña").
 */
export function Pestanas<T extends string>({ pestanas, activa, onCambio, etiqueta }: { pestanas: readonly Pestana<T>[]; activa: T; onCambio: (valor: T) => void; etiqueta: string }) {
  const botones = useRef<(HTMLButtonElement | null)[]>([]);

  function teclado(evento: KeyboardEvent, indice: number) {
    const paso = evento.key === "ArrowRight" ? 1 : evento.key === "ArrowLeft" ? -1 : 0;
    if (!paso) return;
    evento.preventDefault();
    const siguiente = (indice + paso + pestanas.length) % pestanas.length;
    onCambio(pestanas[siguiente]!.valor);
    botones.current[siguiente]?.focus();
  }

  return (
    <div role="tablist" aria-label={etiqueta} className="flex flex-wrap gap-1 border-b border-division">
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
            onClick={() => onCambio(p.valor)}
            onKeyDown={(e) => teclado(e, i)}
            className={`-mb-px min-h-tactil border-b-[3px] px-4 text-cuerpo font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie ${
              seleccionada ? "border-superficie text-superficie" : "border-transparent text-texto-secundario"
            }`}
          >
            {p.etiqueta}
            {p.cantidad !== undefined && <span className="ml-2 text-ayuda">{p.cantidad}</span>}
          </button>
        );
      })}
    </div>
  );
}
