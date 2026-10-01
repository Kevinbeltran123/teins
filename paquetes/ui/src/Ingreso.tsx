import { useId, useState, type ReactNode } from "react";
import { MensajeError } from "./Etiqueta";
import { Eye, EyeOff } from "./iconos";
import { Logo } from "./Logo";

/**
 * Inicio de sesión de Precisión (DESIGN.md, prototipos/base-visual): el logo arriba, una tarjeta de borde fino con
 * el título y el formulario, una línea de ayuda debajo y, al fondo, un degradado quieto con los azules de TEINS.
 */
export function MarcoDeIngreso({ titulo, debajo, children }: { titulo: string; debajo: ReactNode; children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-[26px] overflow-hidden bg-fondo px-4 pt-[max(40px,env(safe-area-inset-top))] pb-[max(72px,env(safe-area-inset-bottom))]">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_40%_at_50%_105%,var(--t-resplandor-2),transparent_72%),linear-gradient(to_bottom,transparent_28%,var(--t-resplandor-1)_100%)]" />
      <Logo alto={46} />
      <main className="flex w-full max-w-[400px] flex-col gap-[22px] rounded-2xl border border-division bg-panel px-6 pt-[34px] pb-[30px] shadow-[0_1px_2px_rgb(17_19_23/0.04),0_12px_32px_rgb(17_19_23/0.06)] sm:px-[34px]">
        <h1 className="text-center text-[24px] leading-tight font-semibold tracking-[-0.02em]">{titulo}</h1>
        {children}
      </main>
      <p className="text-center text-[14px] text-texto-secundario">{debajo}</p>
    </div>
  );
}

/**
 * Campo de la tarjeta de ingreso: etiqueta encima, 46 px de alto; la contraseña empieza oculta y el ojo la muestra.
 * `olvido` pone junto a la etiqueta un "¿La olvidó?" que al tocarlo dice qué hacer. `mensajeError` lo dice debajo
 * del campo y lo marca, para formularios con un error por campo (cambiar la contraseña).
 */
export function CampoDeIngreso({
  etiqueta,
  tipo = "text",
  autoComplete,
  nombre,
  valor,
  onCambio,
  error,
  mensajeError,
  olvido,
}: {
  etiqueta: string;
  tipo?: "text" | "password";
  autoComplete: string;
  nombre: string;
  valor: string;
  onCambio: (v: string) => void;
  error?: boolean;
  mensajeError?: string | undefined;
  olvido?: { pregunta: string; respuesta: string };
}) {
  const id = useId();
  const idRespuesta = useId();
  const idError = useId();
  const [visible, setVisible] = useState(false);
  const [explicando, setExplicando] = useState(false);
  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[14px] font-medium">
          {etiqueta}
        </label>
        {olvido && (
          <button type="button" aria-expanded={explicando} aria-controls={idRespuesta} onClick={() => setExplicando((e) => !e)} className="rounded text-[13.5px] text-texto-secundario hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco">
            {olvido.pregunta}
          </button>
        )}
      </div>
      <div className="relative">
        <input
          id={id}
          name={nombre}
          type={tipo === "password" && !visible ? "password" : "text"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          aria-invalid={error || Boolean(mensajeError) || undefined}
          aria-describedby={mensajeError ? idError : undefined}
          className={`h-[46px] w-full rounded-[10px] bg-panel px-3.5 text-[16px] text-texto shadow-[inset_0_0_0_1px_var(--t-borde-suave)] outline-none focus:shadow-[inset_0_0_0_1.5px_var(--t-superficie),0_0_0_4px_var(--t-superficie-suave)] aria-invalid:shadow-[inset_0_0_0_1.5px_var(--t-error)] ${tipo === "password" ? "pr-12" : ""}`}
        />
        {tipo === "password" && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar lo escrito" : "Mostrar lo escrito"}
            aria-pressed={visible}
            className="absolute top-1.5 right-1.5 grid size-[34px] place-items-center rounded-lg text-texto-terciario hover:bg-panel-hundido hover:text-texto focus-visible:outline-2 focus-visible:outline-foco [&_svg]:size-[18px]"
          >
            {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
          </button>
        )}
      </div>
      {mensajeError && <MensajeError id={idError}>{mensajeError}</MensajeError>}
      {olvido && explicando && (
        <p id={idRespuesta} className="text-[13px] text-texto-secundario">
          {olvido.respuesta}
        </p>
      )}
    </div>
  );
}

/** Botones de la tarjeta de ingreso, a lo ancho y de 46 px: el principal en la marca, el otro con borde fino. */
export const claseBotonIngreso = (principal: boolean) =>
  `flex h-[46px] w-full items-center justify-center gap-[7px] rounded-[10px] text-[15px] font-medium whitespace-nowrap transition-[background-color,filter,transform] duration-150 active:translate-y-px disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco [&_svg]:size-[18px] ${
    principal
      ? "bg-superficie text-sobre-superficie shadow-[inset_0_1px_0_rgb(255_255_255/0.18),var(--t-sombra-boton)] hover:brightness-106"
      : "bg-panel text-texto shadow-[inset_0_0_0_1px_var(--t-borde-suave),var(--t-sombra-boton)] hover:bg-panel-hundido"
  }`;

/** La línea con "o" entre la contraseña y la llave de acceso. */
export function SeparadorIngreso() {
  return (
    <div aria-hidden className="flex items-center gap-3.5 text-[13px] text-texto-terciario before:h-px before:flex-1 before:bg-division after:h-px after:flex-1 after:bg-division">
      o
    </div>
  );
}
