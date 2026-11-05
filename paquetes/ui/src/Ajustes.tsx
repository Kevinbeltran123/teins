import type { ReactNode } from "react";
import { ChevronRight, Monitor, Moon, Sun, type LucideIcon } from "./iconos";
import { OPCIONES_DE_TEMA, useTema, type Tema } from "./tema";

/**
 * Ajustes del teléfono como una sola lista con líneas (iteración 32, prototipos/ajustes-campo; Luma, Shop y Lifesum en
 * Mobbin): cada fila es una cosa, sin una caja por fila.
 */
export function GrupoDeAjustes({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-panel border border-division bg-panel [&>*+*]:border-t [&>*+*]:border-division">{children}</div>;
}

interface PropsFila {
  icono?: LucideIcon;
  texto: string;
  /** Lo que aclara la fila ("Necesita señal"). */
  detalle?: string | undefined;
  /** Lo que vale a la derecha, antes de la flecha (cuántos descartados). */
  valor?: ReactNode;
  /** Lo que va a la derecha en vez de la flecha (el selector del tema). */
  control?: ReactNode;
  onClick?: (() => void) | undefined;
  /** No se puede usar ahora (sin señal): se ve apagada y dice por qué en `detalle`. */
  apagada?: boolean;
  /** Cerrar sesión: sola, centrada y en rojo. */
  peligro?: boolean;
}

/** Una fila de la lista. Con `onClick` es un botón con su flecha; con `control`, una fila que lo lleva a la derecha. */
export function FilaDeAjuste({ icono: Icono, texto, detalle, valor, control, onClick, apagada = false, peligro = false }: PropsFila) {
  const clase = `flex min-h-13 w-full items-center gap-3 px-4 py-2 text-left text-cuerpo ${peligro ? "justify-center font-medium text-error" : ""} ${apagada ? "text-texto-terciario" : ""}`;
  const contenido = (
    <>
      {Icono && <Icono aria-hidden className={`size-5 shrink-0 ${apagada ? "" : "text-texto-secundario"}`} />}
      <span className={`flex min-w-0 flex-col ${peligro ? "" : "grow"}`}>
        <span className="truncate">{texto}</span>
        {detalle && <span className="text-ayuda text-texto-secundario">{detalle}</span>}
      </span>
      {control}
      {onClick && !peligro && (
        <span className="flex shrink-0 items-center gap-1 text-texto-secundario">
          {valor}
          <ChevronRight aria-hidden className="size-[18px] text-texto-terciario" />
        </span>
      )}
    </>
  );
  if (!onClick) return <div className={clase}>{contenido}</div>;
  return (
    <button
      type="button"
      aria-disabled={apagada || undefined}
      onClick={() => !apagada && onClick()}
      className={`${clase} focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-foco active:bg-encima`}
    >
      {contenido}
    </button>
  );
}

const ICONO_DE_TEMA = { sistema: Monitor, claro: Sun, oscuro: Moon } as const;

/**
 * El tema en tres iconos (del sistema, claro, oscuro), en un segmento que no se parte en dos líneas (DESIGN.md, "Tema").
 * Se recuerda en el equipo. Va en la cuenta de campo y, sin cuenta, en el encabezado del portal.
 */
export function SelectorDeTema({ tema, alCambiar }: { tema: Tema; alCambiar: (tema: Tema) => void }) {
  return (
    <span role="radiogroup" aria-label="Tema" className="flex shrink-0 gap-0.5 rounded-control bg-panel-hundido p-[3px]">
      {OPCIONES_DE_TEMA.map((o) => {
        const Icono = ICONO_DE_TEMA[o.valor];
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={tema === o.valor}
            aria-label={o.texto}
            title={o.texto}
            onClick={() => alCambiar(o.valor)}
            className="flex h-11 w-11 items-center justify-center rounded-[9px] text-texto-secundario focus-visible:outline-3 focus-visible:outline-foco aria-checked:bg-panel aria-checked:text-texto aria-checked:shadow-boton [&_svg]:size-[18px]"
          >
            <Icono aria-hidden />
          </button>
        );
      })}
    </span>
  );
}

/** El tema en una fila de los ajustes de campo. */
export function FilaDeTema() {
  const [tema, setTema] = useTema();
  const elegido = OPCIONES_DE_TEMA.find((o) => o.valor === tema)!;
  return <FilaDeAjuste icono={ICONO_DE_TEMA[tema]} texto="Tema" detalle={elegido.texto} control={<SelectorDeTema tema={tema} alCambiar={setTema} />} />;
}
