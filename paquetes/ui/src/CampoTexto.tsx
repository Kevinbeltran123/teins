import { useId } from "react";

interface Props {
  etiqueta: string;
  valorInicial: string;
  onCambio: (valor: string) => void;
}

export const claseControl =
  "min-h-tactil-campo w-full rounded-control border-[1.5px] border-borde-control bg-panel px-3 text-campo text-texto focus:border-2 focus:border-borde-activo focus:shadow-[0_0_0_4px_var(--t-foco)] focus:outline-none";

/** No controlado: cada tecla se guarda sin volver a leer de la base, así el cursor no salta. */
export function CampoTexto({ etiqueta, valorInicial, onCambio }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-campo font-bold">
        {etiqueta}
      </label>
      <input
        id={id}
        className={claseControl}
        defaultValue={valorInicial}
        onChange={(e) => onCambio(e.target.value)}
      />
    </div>
  );
}
