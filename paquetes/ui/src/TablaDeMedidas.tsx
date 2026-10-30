import { useId, useState } from "react";
import { claseConError, claseControl } from "./CampoTexto";
import { MensajeError } from "./Etiqueta";

export interface FilaDeTabla {
  etiqueta: string;
  /** La unidad de toda la fila: se muestra una sola vez. */
  unidad: string;
  /** Una celda por campo: la clave del campo y lo que ya tenía escrito. */
  celdas: readonly { clave: string; valorInicial: string }[];
}

interface Props {
  titulo?: string | undefined;
  columnas: readonly string[];
  filas: readonly FilaDeTabla[];
  /** Se llama también con texto vacío (borrar). Devuelve false si el valor no es válido. */
  onCambio: (clave: string, texto: string) => boolean;
  deshabilitado?: boolean | undefined;
}

/**
 * Mediciones por fase en filas y columnas (ADR-0050; Mobbin: Bevel). La tabla es presentación: cada casilla sigue
 * siendo un campo `medida`, con su validación, su corrección en oficina y su historial. En 360 px la etiqueta va arriba y
 * las casillas en una fila; el encabezado dice a qué columna pertenece cada una.
 */
export function TablaDeMedidas({ titulo, columnas, filas, onCambio, deshabilitado }: Props) {
  const id = useId();
  const [textos, setTextos] = useState<ReadonlyMap<string, string>>(() => new Map(filas.flatMap((f) => f.celdas.map((c) => [c.clave, c.valorInicial] as const))));
  const [invalidas, setInvalidas] = useState<ReadonlySet<string>>(new Set());
  const rejilla = { gridTemplateColumns: `repeat(${columnas.length}, minmax(0, 1fr))` };

  const cambiar = (clave: string, texto: string) => {
    setTextos((t) => new Map(t).set(clave, texto));
    const valida = onCambio(clave, texto);
    setInvalidas((i) => {
      const nuevas = new Set(i);
      if (valida) nuevas.delete(clave);
      else nuevas.add(clave);
      return nuevas;
    });
  };

  return (
    <section aria-label={titulo ?? "Mediciones"} className="flex flex-col gap-3">
      {titulo && <h3 className="text-cuerpo font-semibold">{titulo}</h3>}
      <div aria-hidden className="grid gap-2 text-center text-ayuda font-medium text-texto-secundario" style={rejilla}>
        {columnas.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      {filas.map((fila, i) => {
        const hayError = fila.celdas.some((c) => invalidas.has(c.clave));
        return (
          <div key={fila.etiqueta} {...(fila.celdas.length > 1 ? { role: "group", "aria-label": fila.etiqueta } : {})} className="flex flex-col gap-1.5">
            <p className="text-cuerpo font-medium">
              {fila.etiqueta}
              <span className="ml-2 text-ayuda font-normal text-texto-secundario">{fila.unidad}</span>
            </p>
            <div className="grid gap-2" style={rejilla}>
              {fila.celdas.map((celda, j) => (
                <input
                  key={celda.clave}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  disabled={deshabilitado}
                  // Una fila de un solo campo no repite la columna; si no, la columna dice cuál es.
                  aria-label={fila.celdas.length > 1 ? `${fila.etiqueta}, ${columnas[j]}` : fila.etiqueta}
                  aria-invalid={invalidas.has(celda.clave) ? true : undefined}
                  aria-describedby={hayError ? `${id}-error-${i}` : undefined}
                  className={`${claseControl} min-w-0 px-2 text-center tabular-nums placeholder:text-texto-secundario/50 ${invalidas.has(celda.clave) ? claseConError : ""}`}
                  value={textos.get(celda.clave) ?? ""}
                  onChange={(e) => cambiar(celda.clave, e.target.value)}
                />
              ))}
            </div>
            {hayError && <MensajeError id={`${id}-error-${i}`}>Escribe solo el número, por ejemplo 12,5</MensajeError>}
          </div>
        );
      })}
    </section>
  );
}
