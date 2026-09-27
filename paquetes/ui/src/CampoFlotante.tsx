import { useId, useState } from "react";
import { Eye, EyeOff, type LucideIcon } from "./iconos";

/**
 * Campo con la etiqueta dentro, que sube al escribir (Rocket Money y Remote, en Mobbin). Relleno, sin borde;
 * al enfocarlo, borde amarillo. La contraseña trae el ojo para verla. Para pantallas de entrada.
 */
export function CampoFlotante({
  etiqueta,
  onCambio,
  tipo = "text",
  autoComplete,
  nombre,
  icono: Icono,
}: {
  etiqueta: string;
  onCambio: (valor: string) => void;
  tipo?: "text" | "password";
  autoComplete?: string;
  nombre?: string;
  icono?: LucideIcon;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="group relative flex min-h-16 items-center gap-3 rounded-control border-2 border-transparent bg-panel px-4 transition-colors focus-within:border-foco">
      {Icono && <Icono aria-hidden className="size-5 shrink-0 text-texto-secundario" />}
      <div className="relative flex min-w-0 grow flex-col justify-center self-stretch">
        <input
          id={id}
          name={nombre}
          type={tipo === "password" && !visible ? "password" : "text"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder=" "
          onChange={(e) => onCambio(e.target.value)}
          className="peer w-full bg-transparent pt-5 pb-1.5 text-cuerpo text-texto outline-none"
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 text-cuerpo text-texto-secundario transition-all duration-200 ease-t peer-focus:top-3.5 peer-focus:text-[13px] peer-focus:font-bold peer-[:not(:placeholder-shown)]:top-3.5 peer-[:not(:placeholder-shown)]:text-[13px] peer-[:not(:placeholder-shown)]:font-bold"
        >
          {etiqueta}
        </label>
      </div>
      {tipo === "password" && (
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar lo escrito" : "Mostrar lo escrito"}
          className="grid size-11 shrink-0 place-items-center rounded-full text-texto-secundario focus-visible:outline-3 focus-visible:outline-foco [&_svg]:size-5"
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </button>
      )}
    </div>
  );
}
