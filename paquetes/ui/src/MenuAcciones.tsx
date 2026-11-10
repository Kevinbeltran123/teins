import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { BotonIcono } from "./Boton";
import { Ellipsis, type LucideIcon } from "./iconos";

export interface OpcionMenu {
  texto: string;
  icono?: LucideIcon;
  alElegir: () => void;
  /** Lo que corta un acceso o no se deshace: va en rojo y al final (Polaris: lo genérico y lo destructivo abajo). */
  peligro?: boolean;
}

/**
 * "Más acciones" de una fila: una acción principal queda a la vista y las demás van aquí (Primer). Usa el
 * popover del navegador: queda encima de todo, ninguna tabla con desplazamiento lo recorta, y Esc o un clic
 * fuera lo cierran.
 */
export function MenuAcciones({ etiqueta, opciones }: { etiqueta: string; opciones: readonly (OpcionMenu | false | null | undefined)[] }) {
  const id = useId();
  const ancla = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const visibles = opciones.filter((o): o is OpcionMenu => Boolean(o));

  useEffect(() => {
    const elemento = menu.current;
    if (!elemento) return;
    const cerrar = () => elemento.hidePopover();
    const alAlternar = (evento: Event) => {
      const ahora = (evento as ToggleEvent).newState === "open";
      setAbierto(ahora);
      if (ahora) {
        posicionar(ancla.current!, elemento);
        elemento.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        // Fijo en la pantalla: si la página se desplaza, el menú se cierra en vez de quedar suelto.
        window.addEventListener("scroll", cerrar, { capture: true, once: true });
      } else window.removeEventListener("scroll", cerrar, { capture: true });
    };
    elemento.addEventListener("toggle", alAlternar);
    return () => {
      elemento.removeEventListener("toggle", alAlternar);
      window.removeEventListener("scroll", cerrar, { capture: true });
    };
  }, [visibles.length > 0]);

  if (visibles.length === 0) return null;

  function teclado(evento: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const actual = items.indexOf(document.activeElement as HTMLElement);
    const destino = { ArrowDown: actual + 1, ArrowUp: actual - 1, Home: 0, End: items.length - 1 }[evento.key];
    if (evento.key === "Tab") menu.current?.hidePopover();
    if (destino === undefined) return;
    evento.preventDefault();
    items[(destino + items.length) % items.length]?.focus();
  }

  return (
    <>
      <span ref={ancla} className="inline-flex">
        <BotonIcono icono={Ellipsis} etiqueta={etiqueta} tamano="pequeno" popoverTarget={id} aria-haspopup="menu" aria-expanded={abierto} />
      </span>
      <div ref={menu} id={id} popover="auto" role="menu" aria-label={etiqueta} tabIndex={-1} onKeyDown={teclado} className="menu-acc inset-auto m-0 min-w-52 rounded-control border border-division bg-panel p-1 text-texto shadow-menu">
        {visibles.map((o) => (
          <button
            key={o.texto}
            type="button"
            role="menuitem"
            onClick={() => {
              menu.current?.hidePopover();
              o.alElegir();
            }}
            className={`flex min-h-control-sm w-full items-center gap-2.5 rounded-control px-3 text-left text-cuerpo hover:bg-encima focus:bg-encima focus:outline-none [&_svg]:size-4 [&_svg]:shrink-0 ${o.peligro ? "text-error peligro" : ""}`}
          >
            {o.icono && <o.icono aria-hidden />}
            {o.texto}
          </button>
        ))}
      </div>
    </>
  );
}

/** Debajo del botón y alineado a su derecha; si no cabe abajo, arriba. Nunca fuera de la ventana. */
function posicionar(ancla: HTMLElement, menu: HTMLElement) {
  const r = ancla.getBoundingClientRect();
  const margen = 8;
  const izquierda = Math.max(margen, Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - margen));
  const abajo = r.bottom + 4;
  const arriba = abajo + menu.offsetHeight > window.innerHeight - margen ? r.top - 4 - menu.offsetHeight : abajo;
  menu.style.left = `${izquierda}px`;
  menu.style.top = `${Math.max(margen, arriba)}px`;
}
