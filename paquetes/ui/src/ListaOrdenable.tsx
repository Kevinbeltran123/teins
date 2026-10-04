import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { GripVertical } from "./iconos";
import { destinoAlArrastrar } from "./orden";

/*
  Una lista que se ordena arrastrando (prototipos/usabilidad-oficina, «Arrastrar para ordenar»): cada fila lleva un asa
  a la izquierda. Con el puntero, la fila se levanta y las demás se corren; al soltarla, la pantalla recibe de dónde a
  dónde. Con el teclado: Espacio o Enter la toma, las flechas la mueven, Espacio o Enter la suelta y Esc la devuelve.
  Un lector de pantalla escucha la posición. Sin bibliotecas: eventos de puntero y transformaciones.
*/

interface Props<T> {
  elementos: readonly T[];
  clave: (x: T) => string;
  /** Cómo se nombra cada elemento en el asa y en lo que se anuncia. */
  nombre: (x: T) => string;
  alMover: (de: number, a: number) => void;
  /** La fila; `asa` va donde la fila la quiera, casi siempre primero. */
  children: (x: T, i: number, asa: ReactNode) => ReactNode;
}

interface Arrastre {
  de: number;
  a: number;
  y0: number;
  filas: HTMLElement[];
  rects: DOMRect[];
}

export function ListaOrdenable<T>({ elementos, clave, nombre, alMover, children }: Props<T>) {
  const lista = useRef<HTMLDivElement>(null);
  const arrastre = useRef<Arrastre | null>(null);
  const [tomada, setTomada] = useState<{ clave: string; desde: number } | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const enfocar = useRef<string | null>(null);

  // Al mover con el teclado, la fila cambia de lugar en el documento: el foco vuelve a su asa.
  useEffect(() => {
    if (!enfocar.current) return;
    lista.current?.querySelector<HTMLButtonElement>(`[data-asa="${CSS.escape(enfocar.current)}"]`)?.focus();
    enfocar.current = null;
  });

  const filasDelDom = () => [...(lista.current?.children ?? [])].filter((n): n is HTMLElement => n instanceof HTMLElement && n.dataset.fila !== undefined);
  const limpiar = (filas: HTMLElement[]) =>
    filas.forEach((f) => {
      f.style.transform = "";
      f.classList.remove("levantada", "desliza");
    });

  function empezar(e: PointerEvent<HTMLButtonElement>, i: number) {
    if (e.button !== 0 || elementos.length < 2) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const filas = filasDelDom();
    arrastre.current = { de: i, a: i, y0: e.clientY, filas, rects: filas.map((f) => f.getBoundingClientRect()) };
    filas.forEach((f, k) => f.classList.add(k === i ? "levantada" : "desliza"));
  }

  function mover(e: PointerEvent<HTMLButtonElement>) {
    const a = arrastre.current;
    if (!a) return;
    const { rects, de, filas } = a;
    // La fila no sale de la lista.
    const dy = Math.min(Math.max(e.clientY - a.y0, rects[0]!.top - rects[de]!.top), rects[rects.length - 1]!.bottom - rects[de]!.bottom);
    filas[de]!.style.transform = `translateY(${dy}px)`;
    a.a = destinoAlArrastrar(rects, de, rects[de]!.top + rects[de]!.height / 2 + dy);
    const alto = rects[de]!.height;
    filas.forEach((f, k) => {
      if (k === de) return;
      const corrida = de < k && k <= a.a ? -alto : a.a <= k && k < de ? alto : 0;
      f.style.transform = corrida ? `translateY(${corrida}px)` : "";
    });
  }

  function soltar() {
    const a = arrastre.current;
    if (!a) return;
    arrastre.current = null;
    limpiar(a.filas);
    if (a.a !== a.de) {
      const x = elementos[a.de]!;
      alMover(a.de, a.a);
      setAnuncio(`${nombre(x)}, posición ${a.a + 1} de ${elementos.length}`);
    }
  }

  function teclado(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const x = elementos[i]!;
    const k = clave(x);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (tomada?.clave === k) {
        setTomada(null);
        setAnuncio(`${nombre(x)} quedó en la posición ${i + 1} de ${elementos.length}`);
      } else {
        setTomada({ clave: k, desde: i });
        setAnuncio(`${nombre(x)} tomado, posición ${i + 1} de ${elementos.length}. Flechas para moverlo, Espacio para soltarlo, Esc para devolverlo.`);
      }
      return;
    }
    if (tomada?.clave !== k) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const a = i + (e.key === "ArrowUp" ? -1 : 1);
      if (a < 0 || a >= elementos.length) return;
      enfocar.current = k;
      alMover(i, a);
      setAnuncio(`${nombre(x)}, posición ${a + 1} de ${elementos.length}`);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setTomada(null);
      if (i !== tomada.desde) {
        enfocar.current = k;
        alMover(i, tomada.desde);
      }
      setAnuncio(`${nombre(x)} volvió a la posición ${tomada.desde + 1}`);
    }
  }

  return (
    <div ref={lista} className="lista-ordenable">
      {elementos.map((x, i) => {
        const k = clave(x);
        const asa =
          elementos.length > 1 ? (
            <button
              type="button"
              className="asa"
              data-asa={k}
              aria-label={`Mover ${nombre(x)}`}
              aria-pressed={tomada?.clave === k}
              title="Arrastre para ordenar"
              onPointerDown={(e) => empezar(e, i)}
              onPointerMove={mover}
              onPointerUp={soltar}
              onPointerCancel={soltar}
              onKeyDown={(e) => teclado(e, i)}
              // Al moverla con el teclado, la fila cambia de lugar y el asa pierde el foco un momento: no la suelta.
              onBlur={() => tomada?.clave === k && enfocar.current !== k && setTomada(null)}
            >
              <GripVertical aria-hidden size={16} strokeWidth={1.6} />
            </button>
          ) : (
            <span className="asa vacia" aria-hidden />
          );
        return (
          <div key={k} data-fila={k} className={`fila-ordenable ${tomada?.clave === k ? "tomada" : ""}`}>
            {children(x, i, asa)}
          </div>
        );
      })}
      <span className="sr-only" aria-live="assertive">
        {anuncio}
      </span>
    </div>
  );
}
