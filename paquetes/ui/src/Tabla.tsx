import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

export interface Columna {
  titulo: string;
  /** Sin título visible (la columna de acciones): el lector de pantalla lo anuncia igual. */
  oculto?: boolean;
  /** Cifras y acciones van a la derecha. */
  derecha?: boolean;
}

/** Tabla de oficina: encabezado un escalón más bajo, filas que reaccionan al cursor, desplazamiento propio si no cabe. */
export function Tabla({ etiqueta, columnas, children }: { etiqueta: string; columnas: readonly Columna[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-panel border border-division bg-panel">
      <table className="w-full border-collapse text-left text-cuerpo">
        <caption className="sr-only">{etiqueta}</caption>
        <thead className="bg-panel-hundido">
          <tr className="border-b border-division">
            {columnas.map((c) => (
              <th key={c.titulo} scope="col" className={`px-5 py-3 text-ayuda font-bold whitespace-nowrap text-texto-secundario ${c.derecha ? "text-right" : ""}`}>
                {c.oculto ? <span className="sr-only">{c.titulo}</span> : c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  );
}

/** Con `abrir`, un clic en cualquier parte de la fila sigue su primer enlace (el teclado usa ese enlace). */
function abrirPrimerEnlace(evento: MouseEvent<HTMLTableRowElement>) {
  if ((evento.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
  evento.currentTarget.querySelector("a")?.click();
}

export function FilaTabla({ children, resaltada = false, abrir = false }: { children: ReactNode; /** Recién creada o cambiada en esta pantalla: se resalta y queda a la vista. */ resaltada?: boolean; abrir?: boolean }) {
  const fila = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (resaltada) fila.current?.scrollIntoView({ block: "nearest" });
  }, [resaltada]);
  return (
    <tr
      ref={fila}
      className={`border-b border-division align-middle transition-colors hover:bg-encima ${resaltada ? "animate-resaltar" : ""} ${abrir ? "cursor-pointer" : ""}`}
      onClick={abrir ? abrirPrimerEnlace : undefined}
    >
      {children}
    </tr>
  );
}

export function CeldaTabla({ children, derecha = false, principal = false }: { children?: ReactNode; derecha?: boolean; /** El nombre de lo que la fila representa. */ principal?: boolean }) {
  return <td className={`px-5 py-3 ${derecha ? "text-right whitespace-nowrap" : ""} ${principal ? "font-bold" : ""}`}>{children}</td>;
}
