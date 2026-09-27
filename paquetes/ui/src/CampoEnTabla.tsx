import { claseConError, claseControl } from "./CampoTexto";

/**
 * Campo compacto dentro de una fila de tabla (cantidad y precio de una cotización, ADR-0029). La columna
 * da el contexto visual; el nombre accesible dice de qué fila es ("Precio de Cable UTP 6A"). Los números
 * van a la derecha y con cifras tabulares, para leerse en columna.
 */
export function CampoEnTabla({
  etiqueta,
  valor,
  onCambio,
  error,
  numerico = false,
  ancho = "w-28",
  modoEntrada,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  /** Lo que falta, debajo del campo y en su nombre accesible. */
  error?: string | undefined;
  numerico?: boolean;
  ancho?: "w-16" | "w-20" | "w-24" | "w-28" | "w-full";
  modoEntrada?: "numeric" | "decimal" | "text";
}) {
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <input
        aria-label={etiqueta}
        aria-invalid={error ? true : undefined}
        value={valor}
        inputMode={modoEntrada}
        autoComplete="off"
        onChange={(e) => onCambio(e.target.value)}
        className={`${claseControl.replace("min-h-control w-full", `min-h-control-sm ${ancho}`)} ${numerico ? "text-right tabular-nums" : ""} ${error ? claseConError : ""}`}
      />
      {error && <span className="text-ayuda font-bold whitespace-nowrap text-error">{error}</span>}
    </span>
  );
}
