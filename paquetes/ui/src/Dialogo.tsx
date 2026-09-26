import { useEffect, useId, useRef, type MouseEvent, type PointerEvent, type ReactNode, type SyntheticEvent } from "react";
import { BotonIcono } from "./Boton";
import { X, type LucideIcon } from "./iconos";

const formas = {
  /** Confirmaciones y lo que se entrega una sola vez: interrumpe a propósito. */
  centrado: "m-auto max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] rounded-capa open:animate-aparecer",
  /** Crear o editar en oficina: la lista sigue a la vista detrás del velo (hoja lateral de 480 px). */
  lateral: "my-0 mr-0 ml-auto h-dvh max-h-dvh w-[min(480px,100vw)] rounded-l-capa open:animate-entrar-lateral",
  /** Confirmaciones en el teléfono: abajo, al alcance del pulgar. */
  inferior: "mx-auto mt-auto mb-0 max-h-[90dvh] w-full max-w-xl rounded-t-capa open:animate-subir",
};

interface Props {
  titulo: string;
  /** A qué o a quién se refiere, cuando el título no lo dice (el cliente, el usuario). */
  subtitulo?: string | undefined;
  icono?: LucideIcon | undefined;
  children: ReactNode;
  /** Botones del pie, de menor a mayor: la acción principal va al final (a la derecha). */
  pie?: ReactNode;
  alCerrar: () => void;
  /** false: ni Esc, ni un clic fuera, ni una equis lo cierran (lo que se muestra una sola vez, o mientras trabaja). */
  cerrable?: boolean;
  forma?: keyof typeof formas;
  /** Amplio: contenido en dos columnas, como el QR con sus pasos. */
  amplio?: boolean;
}

/**
 * Abre un <dialog> como modal al montarse y lo cierra al desmontarse. Esc y un clic en el velo llaman a
 * `alCerrar` solo si `cerrable`; el foco vuelve a lo que lo abrió.
 */
export function useModal(cerrable: boolean, alCerrar: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const presionEnVelo = useRef(false);
  // Los manejadores leen siempre el valor vigente, aunque el efecto de apertura corra una sola vez.
  const vigente = useRef({ cerrable, alCerrar });
  vigente.current = { cerrable, alCerrar };

  useEffect(() => {
    const elemento = ref.current!;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let desmontando = false;
    elemento.showModal();
    // El navegador puede cerrarlo por su cuenta (Esc repetido): si no se podía cerrar, vuelve a abrirse.
    const alCerrarse = () => {
      if (desmontando) return;
      if (vigente.current.cerrable) vigente.current.alCerrar();
      else elemento.showModal();
    };
    elemento.addEventListener("close", alCerrarse);
    return () => {
      desmontando = true;
      elemento.removeEventListener("close", alCerrarse);
      elemento.close();
      // El foco vuelve a lo que abrió el diálogo, si sigue en la pantalla.
      if (anterior?.isConnected) anterior.focus();
    };
  }, []);

  return {
    ref,
    onCancel: (evento: SyntheticEvent) => {
      evento.preventDefault();
      if (cerrable) alCerrar();
    },
    onPointerDown: (evento: PointerEvent<HTMLDialogElement>) => {
      presionEnVelo.current = evento.target === evento.currentTarget;
    },
    onClick: (evento: MouseEvent<HTMLDialogElement>) => {
      // Solo un clic que empieza y termina en el velo cierra: arrastrar al seleccionar texto no.
      if (cerrable && presionEnVelo.current && evento.target === evento.currentTarget) alCerrar();
    },
  };
}

/**
 * Diálogo modal sobre el elemento <dialog> del navegador: el foco queda dentro, lo de atrás queda inerte y
 * Esc funciona sin JavaScript de animación (el movimiento es CSS, DESIGN.md). Se abre al montarse: quien lo
 * usa lo muestra u oculta con una condición, y cada apertura empieza limpia.
 */
export function Dialogo({ titulo, subtitulo, icono: Icono, children, pie, alCerrar, cerrable = true, forma = "centrado", amplio = false }: Props) {
  const modal = useModal(cerrable, alCerrar);
  const tituloId = useId();

  return (
    <dialog
      {...modal}
      aria-labelledby={tituloId}
      className={`bg-panel p-0 text-texto shadow-capa backdrop:bg-velo ${amplio && forma === "centrado" ? "w-[min(820px,calc(100vw-32px))]" : ""} ${formas[forma]}`}
    >
      <div className={`flex flex-col ${forma === "lateral" ? "h-full" : "max-h-[inherit]"}`}>
        <header className="flex items-start gap-3 px-6 pt-6 pb-4">
          {Icono && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-superficie-suave text-superficie [&_svg]:size-5">
              <Icono aria-hidden />
            </span>
          )}
          <div className={`flex min-w-0 grow flex-col ${cerrable ? "pr-8" : ""}`}>
            <h2 id={tituloId} className="text-subtitulo leading-snug font-extrabold">
              {titulo}
            </h2>
            {subtitulo && <p className="text-ayuda text-texto-secundario">{subtitulo}</p>}
          </div>
        </header>
        <div className="flex grow flex-col gap-4 overflow-y-auto px-6 pb-6">{children}</div>
        {pie && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-division bg-panel-hundido px-6 py-4">{pie}</footer>}
      </div>
      {/* Al final del documento: el foco inicial cae en el primer campo o en "Cancelar", no en la equis. */}
      {cerrable && <BotonIcono icono={X} etiqueta="Cerrar" tamano="pequeno" className="absolute top-5 right-4" onClick={alCerrar} />}
    </dialog>
  );
}
