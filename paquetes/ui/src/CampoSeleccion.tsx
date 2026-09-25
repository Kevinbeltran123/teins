import { useId } from "react";
import { claseControl } from "./CampoTexto";
import { EtiquetaCampo } from "./Etiqueta";

/** Una opción de una lista larga (clientes, sitios): el control nativo, accesible y con el teclado del sistema. */
export function CampoSeleccion({
  etiqueta,
  opciones,
  valor,
  onCambio,
  vacio,
  deshabilitado,
}: {
  etiqueta: string;
  opciones: readonly { valor: string; texto: string }[];
  valor: string;
  onCambio: (valor: string) => void;
  /** Texto de la opción vacía, cuando todavía no se ha elegido nada. */
  vacio?: string;
  deshabilitado?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <EtiquetaCampo htmlFor={id}>{etiqueta}</EtiquetaCampo>
      <select id={id} className={claseControl} value={valor} disabled={deshabilitado} onChange={(e) => onCambio(e.target.value)}>
        {vacio !== undefined && <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
