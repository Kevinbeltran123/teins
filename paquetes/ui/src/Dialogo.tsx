import { useEffect, useId, useLayoutEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { BotonIcono } from "./Boton";
import { ChevronLeft, X, type LucideIcon } from "./iconos";
import { sinMovimiento } from "./transicion";

const formas = {
  /** Confirmaciones y lo que se entrega una sola vez: interrumpe a propósito. */
  centrado: "m-auto max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] rounded-capa open:animate-aparecer",
  /** Crear o editar algo corto en oficina (iteración 29): centrado, del alto de su contenido, con su equis. */
  formulario: "m-auto max-h-[calc(100dvh-32px)] rounded-capa open:animate-aparecer",
  /** Crear o editar algo largo en oficina: la lista sigue a la vista detrás del velo (hoja lateral de 480 px). */
  lateral: "my-0 mr-0 ml-auto h-dvh max-h-dvh w-[min(480px,100vw)] rounded-l-capa open:animate-entrar-lateral",
  /** Confirmaciones en el teléfono: abajo, al alcance del pulgar. */
  inferior: "mx-auto mt-auto mb-0 max-h-[90dvh] w-full max-w-xl rounded-t-capa open:animate-hoja-entra",
  /** Hoja alta de campo (catálogo): casi toda la pantalla, para que el teclado no tape los resultados. */
  hoja: "mx-auto mt-auto mb-0 h-[86dvh] max-h-[86dvh] w-full max-w-xl rounded-t-capa open:animate-hoja-entra",
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
  /** Amplio: contenido en dos columnas, como el QR con sus pasos; en una hoja lateral, 680 px para un documento en vivo. */
  amplio?: boolean;
  /**
   * Una lista para elegir con un toque (la biblioteca de símbolos): el foco queda en el diálogo y no en su primer
   * campo, para que el teléfono no abra el teclado encima de la lista.
   */
  focoEnElDialogo?: boolean;
  /** Ancho de un diálogo centrado o de formulario (oficina): 480, 560, 880 (dos columnas) o 1040 (con vista previa). */
  ancho?: "medio" | "ancho" | "doble" | "previa" | undefined;
  /** Lo que va junto a la equis, arriba a la derecha (un interruptor de la vista previa). */
  cabeceraExtra?: ReactNode;
  /** Tono del icono del encabezado (oficina): la consecuencia se reconoce antes de leer. */
  tono?: "" | "peligro" | "exito";
  /**
   * Una página abierta dentro de la hoja (campo, iteración 32): "‹ Cuenta" a la izquierda del título vuelve a la
   * página anterior sin cerrar la hoja.
   */
  volver?: { etiqueta: string; alVolver: () => void } | undefined;
}

/**
 * Abre un <dialog> como modal al montarse y lo cierra al desmontarse. Esc y un clic en el velo llaman a
 * `alCerrar` solo si `cerrable`; el foco vuelve a lo que lo abrió.
 */
export function useModal(cerrable: boolean, alCerrar: () => void, focoEnElDialogo = false) {
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
    if (focoEnElDialogo) elemento.focus();
    // El navegador puede cerrarlo por su cuenta (Esc repetido): si no se podía cerrar, vuelve a abrirse.
    const alCerrarse = () => {
      // Un "close" que quedó en cola de un montaje anterior (StrictMode en desarrollo) llega con el diálogo ya abierto de nuevo.
      if (desmontando || elemento.open) return;
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
 * El diálogo también sale (iteración 27): quien lo usa lo quita con una condición, así que al desmontarse se deja
 * una copia inerte, con lo que mostraba, que sale en 200 ms y se borra. Se copia antes de que React lo quite
 * (efecto de diseño) y se muestra solo si de verdad se quitó: StrictMode desmonta y vuelve a montar sin quitarlo.
 */
function useSalida(ref: RefObject<HTMLDialogElement | null>, forma: string) {
  useLayoutEffect(() => {
    const elemento = ref.current!;
    return () => {
      if (sinMovimiento() || !elemento.open) return;
      const copia = elemento.cloneNode(true) as HTMLDialogElement;
      // Lo escrito no está en los atributos: se copia para que no se vea vacío mientras sale.
      const campos = elemento.querySelectorAll("input, textarea, select");
      copia.querySelectorAll<HTMLInputElement>("input, textarea, select").forEach((campo, i) => {
        const original = campos[i] as HTMLInputElement | undefined;
        if (!original) return;
        if (campo.type === "checkbox" || campo.type === "radio") campo.checked = original.checked;
        else if (campo.type !== "file") campo.value = original.value;
      });
      copia.querySelectorAll("[id]").forEach((conId) => conId.removeAttribute("id"));
      copia.removeAttribute("aria-labelledby");
      copia.setAttribute("aria-hidden", "true");
      copia.inert = true;
      copia.classList.add("capa-saliendo");
      copia.dataset.forma = forma;
      const velo = document.createElement("div");
      velo.className = "velo-saliendo";
      queueMicrotask(() => {
        if (elemento.isConnected) return;
        document.body.append(velo, copia);
        setTimeout(() => {
          velo.remove();
          copia.remove();
        }, 200);
      });
    };
  }, []);
}

/**
 * Diálogo modal sobre el elemento <dialog> del navegador: el foco queda dentro, lo de atrás queda inerte y
 * Esc funciona sin JavaScript de animación (el movimiento es CSS, DESIGN.md; al quitarse, sale con useSalida). Se abre al montarse: quien lo
 * usa lo muestra u oculta con una condición, y cada apertura empieza limpia.
 */
export function Dialogo({ titulo, subtitulo, icono: Icono, children, pie, alCerrar, cerrable = true, forma = "centrado", amplio = false, focoEnElDialogo = false, tono = "", ancho, cabeceraExtra, volver }: Props) {
  const modal = useModal(cerrable, alCerrar, focoEnElDialogo);
  useSalida(modal.ref, forma);
  const tituloId = useId();

  return (
    <dialog
      {...modal}
      aria-labelledby={tituloId}
      tabIndex={focoEnElDialogo ? -1 : undefined}
      className={`capa-${forma} bg-panel p-0 text-texto shadow-capa backdrop:bg-velo ${amplio && forma === "centrado" ? "w-[min(820px,calc(100vw-32px))]" : ""} ${amplio && forma === "lateral" ? "amplio" : ""} ${ancho ?? ""} ${focoEnElDialogo ? "outline-none" : ""} ${formas[forma]}`}
    >
      <div className={`flex flex-col ${forma === "lateral" || forma === "hoja" ? "h-full" : "max-h-[inherit]"}`}>
        {forma === "hoja" && <span aria-hidden className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-borde-suave" />}
        <header className="capa-cabeza flex items-start gap-3 px-6 pt-6 pb-4">
          {Icono && (
            <span className={`ic-capa ${tono} flex size-10 shrink-0 items-center justify-center rounded-control bg-superficie-suave text-superficie [&_svg]:size-5`}>
              <Icono aria-hidden />
            </span>
          )}
          {volver && (
            <button
              type="button"
              onClick={volver.alVolver}
              className="-my-2 -ml-2 flex min-h-tactil shrink-0 items-center gap-0.5 rounded-control pr-2 text-cuerpo text-superficie focus-visible:outline-3 focus-visible:outline-foco [&_svg]:size-5"
            >
              <ChevronLeft aria-hidden />
              {volver.etiqueta}
            </button>
          )}
          <div className={`flex min-w-0 grow flex-col ${cerrable ? "pr-8" : ""} ${cabeceraExtra ? "pr-44" : ""}`}>
            <h2 id={tituloId} className="text-subtitulo leading-snug font-extrabold">
              {titulo}
            </h2>
            {subtitulo && <p className="text-ayuda text-texto-secundario">{subtitulo}</p>}
          </div>
        </header>
        <div className="capa-cuerpo flex min-h-0 grow flex-col gap-4 overflow-y-auto px-6 pb-6">{children}</div>
        {pie && (
          <footer
            className={`capa-pie ${
              forma === "inferior"
                ? // Abajo, en el teléfono: los dos botones en fila y del mismo ancho, "Cancelar" a la izquierda y la acción a
                  // la derecha, al alcance del pulgar (como las alertas de iOS).
                  "grid auto-cols-fr grid-flow-col gap-2.5 px-6 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] [&>*]:min-h-14 [&>*]:w-full [&>*]:whitespace-normal"
                : "flex flex-wrap items-center justify-end gap-2 border-t border-division bg-panel-hundido px-6 py-4"
            }`}
          >
            {pie}
          </footer>
        )}
      </div>
      {/* Al final del documento: el foco inicial cae en el primer campo o en "Cancelar", no en la equis. */}
      {cabeceraExtra && <div className="capa-extra absolute top-[14px] right-12 flex items-center gap-2">{cabeceraExtra}</div>}
      {cerrable && <BotonIcono icono={X} etiqueta="Cerrar" tamano="pequeno" className="capa-cerrar absolute top-5 right-4" onClick={alCerrar} />}
    </dialog>
  );
}
