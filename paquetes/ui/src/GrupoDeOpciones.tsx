import { useId } from "react";

/** Una sola opción entre pocas, todas a la vista (botones de radio con su texto). */
export function GrupoDeOpciones<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
}: {
  etiqueta: string;
  opciones: readonly { valor: T; texto: string }[];
  valor: T;
  onCambio: (valor: T) => void;
}) {
  const nombre = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-cuerpo font-medium">{etiqueta}</legend>
      <div className="flex flex-wrap gap-x-6">
        {opciones.map((o) => (
          <label
            key={o.valor}
            className="flex min-h-tactil cursor-pointer items-center gap-3 text-cuerpo has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-superficie"
          >
            <input type="radio" name={nombre} className="size-5 shrink-0 accent-superficie" checked={valor === o.valor} onChange={() => onCambio(o.valor)} />
            <span>{o.texto}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
