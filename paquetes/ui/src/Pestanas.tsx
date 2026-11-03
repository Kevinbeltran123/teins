import { useId, useRef, type KeyboardEvent } from "react";
import { conTransicion, nombreDeTransicion } from "./transicion";

export interface Pestana<T extends string> {
  valor: T;
  etiqueta: string;
  /** Conteo opcional junto a la etiqueta; `null` mientras llega: guarda su lugar para que las pestañas no se corran. */
  cantidad?: number | null | undefined;
}

/**
 * Pestañas subrayadas de oficina (patrón WAI-ARIA tabs: flechas para moverse). La activa lleva el subrayado, que se
 * desliza hasta la elegida (iteración 27); van en la barra de la lista, con el buscador a la derecha (prototipos/oficina).
 */
export function Pestanas<T extends string>({
  pestanas,
  activa,
  onCambio,
  etiqueta,
  amplio = false,
}: {
  pestanas: readonly Pestana<T>[];
  activa: T;
  onCambio: (valor: T) => void;
  etiqueta: string;
  /** Más grandes y con su línea de abajo, para el portal en el teléfono (ADR-0053); oficina las pone en su barra. */
  amplio?: boolean;
}) {
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
    <div role="tablist" aria-label={etiqueta} className={amplio ? "subrayado amplio" : "subrayado"}>
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
            {p.cantidad === null ? (
              <span aria-hidden className="num inline-block h-2.5 w-[2ch] rounded-control bg-division motion-safe:animate-pulse" />
            ) : (
              p.cantidad !== undefined && <span className="num">{p.cantidad}</span>
            )}
            {seleccionada && <i aria-hidden className="indicador" style={{ viewTransitionName: indicador }} />}
          </button>
        );
      })}
    </div>
  );
}
