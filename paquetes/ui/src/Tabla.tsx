import { useEffect, useRef, type CSSProperties, type MouseEvent, type ReactNode } from "react";

export interface Columna {
  titulo: string;
  /** Sin título visible (la columna de acciones): el lector de pantalla lo anuncia igual. */
  oculto?: boolean;
  /** Cifras y acciones van a la derecha. */
  derecha?: boolean;
}

/** Tabla de oficina, sobre el fondo y sin caja (prototipos/oficina): líneas finas entre filas, desplazamiento propio si no cabe. */
export function Tabla({ etiqueta, columnas, children, clase = "", agrupada = false }: { etiqueta: string; columnas: readonly Columna[]; children: ReactNode; /** Variante (lineas-doc). */ clase?: string; /** Los hijos traen sus propios `CuerpoTabla`. */ agrupada?: boolean }) {
  return (
    <div className="tabla-caja">
      <table className={`tabla ${clase}`} aria-label={etiqueta}>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.titulo} scope="col" className={c.derecha ? "num" : undefined}>
                {c.oculto ? <span className="sr-only">{c.titulo}</span> : c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        {agrupada ? children : <tbody>{children}</tbody>}
      </table>
    </div>
  );
}

/** Cuerpo de la tabla. Varias en una tabla agrupan filas (las visitas por día). */
export function CuerpoTabla({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

/** Con `abrir`, un clic en cualquier parte de la fila sigue su primer enlace (el teclado usa ese enlace). */
function abrirPrimerEnlace(evento: MouseEvent<HTMLTableRowElement>) {
  if ((evento.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
  evento.currentTarget.querySelector("a")?.click();
}

export function FilaTabla({
  children,
  resaltada = false,
  abrir = false,
  indice = 0,
  clase = "",
  id,
}: {
  children: ReactNode;
  /** Recién creada o cambiada en esta pantalla: se resalta y queda a la vista. */
  resaltada?: boolean;
  abrir?: boolean;
  /** Orden de aparición: las filas suben una tras otra. */
  indice?: number;
  clase?: string;
  id?: string;
}) {
  const fila = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (resaltada) fila.current?.scrollIntoView({ block: "nearest" });
  }, [resaltada]);
  return (
    <tr ref={fila} id={id} style={{ "--i": indice } as CSSProperties} className={`${resaltada ? "resaltada" : ""} ${abrir ? "clic" : ""} ${clase}`} onClick={abrir ? abrirPrimerEnlace : undefined}>
      {children}
    </tr>
  );
}

export function CeldaTabla({ children, derecha = false, principal = false, clase = "", colSpan }: { children?: ReactNode; derecha?: boolean; /** El nombre de lo que la fila representa. */ principal?: boolean; clase?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`${derecha ? "num" : ""} ${principal ? "fuerte" : ""} ${clase}`}>
      {children}
    </td>
  );
}
