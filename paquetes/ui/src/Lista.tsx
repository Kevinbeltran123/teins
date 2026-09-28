import { useId, type ReactNode } from "react";
import { Search } from "./iconos";

/**
 * Piezas de las listas de oficina (prototipos/oficina): la barra con las pestañas a la izquierda y el buscador a
 * la derecha, el pie con el orden y la hora, lo que se muestra cuando la búsqueda no encuentra nada y el texto
 * que coincide resaltado.
 */
export function BarraLista({ children, buscador }: { children?: ReactNode; buscador?: ReactNode }) {
  return (
    <div className="barra-lista">
      {children ?? <span />}
      {buscador}
    </div>
  );
}

/** Busca al escribir. La etiqueta es para el lector de pantalla; el ejemplo dice qué se puede buscar. */
export function Buscador({ etiqueta, ejemplo, valor, onCambio }: { etiqueta: string; ejemplo: string; valor: string; onCambio: (valor: string) => void }) {
  const id = useId();
  return (
    <div className="buscar">
      <Search aria-hidden size={18} />
      <label className="sr-only" htmlFor={id}>
        {etiqueta}
      </label>
      <input id={id} className="control" type="search" placeholder={ejemplo} value={valor} onChange={(e) => onCambio(e.target.value)} />
    </div>
  );
}

export function PieLista({ children, derecha }: { children: ReactNode; derecha?: ReactNode }) {
  return (
    <div className="pie-lista">
      <span>{children}</span>
      {derecha && <span aria-live="polite">{derecha}</span>}
    </div>
  );
}

export function SinResultados({ texto, onQuitar, children }: { texto: string; onQuitar: () => void; children?: ReactNode }) {
  return (
    <>
      <div className="vacio">
        <div className="ic">
          <Search aria-hidden size={26} />
        </div>
        <b>Nada coincide con "{texto}"</b>
        <p>Revise cómo lo escribió, o busque por cliente, sitio o técnico.</p>
        <button type="button" className="btn chico" onClick={onQuitar}>
          Quitar la búsqueda
        </button>
      </div>
      {children}
    </>
  );
}

/** Sin mayúsculas ni tildes, para comparar lo que se busca con lo que se muestra. */
export const normalizarTexto = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const coincide = (texto: string, ...campos: (string | null | undefined)[]) => !texto.trim() || campos.some((c) => c != null && normalizarTexto(c).includes(normalizarTexto(texto.trim())));

/** Resalta la primera coincidencia del texto buscado. */
export function Marcado({ texto, busqueda }: { texto: string; busqueda: string }) {
  const q = busqueda.trim();
  if (!q) return <>{texto}</>;
  const i = normalizarTexto(texto).indexOf(normalizarTexto(q));
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <mark>{texto.slice(i, i + q.length)}</mark>
      {texto.slice(i + q.length)}
    </>
  );
}

/** Cargando una lista: filas con la forma de lo que viene. */
export function EsqueletoLista({ etiqueta, filas = 6 }: { etiqueta: string; filas?: number }) {
  return (
    <div aria-busy="true" aria-label={etiqueta}>
      {Array.from({ length: filas }, (_, k) => (
        <div key={k} className="esq-fila" style={{ paddingInline: 0 }}>
          {[1, 2, 3, 4, 5].map((c) => (
            <span key={c} className="esq" style={{ width: `${50 + ((k * 17) % 45)}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
