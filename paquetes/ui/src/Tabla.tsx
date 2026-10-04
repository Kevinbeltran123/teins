import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { nombreDeTransicion, sinMovimiento, useNombreEnPantalla } from "./transicion";

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
  marcada = false,
  abrir = false,
  clase = "",
  id,
  clave,
}: {
  children: ReactNode;
  /** Recién creada o cambiada en esta pantalla: se resalta, el resaltado se desvanece y queda a la vista. */
  resaltada?: boolean;
  /** La que se abrió por última vez: al volver a la lista queda marcada y a la vista. */
  marcada?: boolean;
  abrir?: boolean;
  clase?: string;
  id?: string;
  /**
   * Lo que la fila representa (su id): con él, al crear, cancelar o cambiar de pestaña dentro de una transición
   * (conTransicion), la fila entra, sale o se mueve a su nuevo lugar y las demás se corren. Lo de adentro con
   * `data-transicion` (el título que se convierte en el del detalle) lleva ese nombre. Los dos, solo mientras la fila
   * está en pantalla (useNombreEnPantalla).
   */
  clave?: string;
}) {
  const fila = useRef<HTMLTableRowElement>(null);
  const enPantalla = useNombreEnPantalla<HTMLTableRowElement>(clave ? nombreDeTransicion("fila", clave) : undefined);
  // Estable: una ref nueva en cada dibujo le quitaría el nombre a la fila justo en medio de una transición.
  const ref = useCallback(
    (elemento: HTMLTableRowElement | null) => {
      fila.current = elemento;
      return enPantalla(elemento);
    },
    [enPantalla],
  );
  useEffect(() => {
    if (resaltada) fila.current?.scrollIntoView({ block: "nearest", behavior: sinMovimiento() ? "auto" : "smooth" });
  }, [resaltada]);
  useEffect(() => {
    if (marcada) fila.current?.scrollIntoView({ block: "nearest" });
  }, [marcada]);
  return (
    <tr
      ref={ref}
      id={id}
      className={`${resaltada ? "resaltada" : ""} ${marcada ? "marcada" : ""} ${abrir ? "clic" : ""} ${clase}`} onClick={abrir ? abrirPrimerEnlace : undefined}>
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
