import { useState, type KeyboardEvent } from "react";
import { BotonIcono } from "./Boton";
import { useModal } from "./Dialogo";
import { ChevronLeft, ChevronRight, Trash, X } from "./iconos";

export interface FotoVisible {
  id: string;
  url: string;
}

/**
 * Una foto a pantalla completa, con las demás a un toque (Google Fotos, Fulcrum). En campo trae "Eliminar": la
 * foto se quita al instante y quien lo usa ofrece deshacer, sin preguntar antes (DESIGN.md: qué se confirma).
 */
export function VisorFotos({
  etiqueta,
  fotos,
  inicial,
  alCerrar,
  alQuitar,
}: {
  /** El dato al que pertenecen: "Fotos del tablero". */
  etiqueta: string;
  fotos: readonly FotoVisible[];
  inicial: number;
  alCerrar: () => void;
  alQuitar?: ((id: string) => void) | undefined;
}) {
  const modal = useModal(true, alCerrar);
  const [indice, setIndice] = useState(inicial);
  const actual = Math.min(indice, fotos.length - 1);
  const foto = fotos[actual];
  const mover = (paso: number) => setIndice((actual + paso + fotos.length) % fotos.length);

  function teclado(evento: KeyboardEvent<HTMLDialogElement>) {
    if (evento.key === "ArrowRight") mover(1);
    if (evento.key === "ArrowLeft") mover(-1);
  }

  return (
    <dialog
      {...modal}
      onKeyDown={teclado}
      aria-label={`${etiqueta}: foto ${actual + 1} de ${fotos.length}`}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-visor p-0 text-sobre-superficie backdrop:bg-visor"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between gap-3 px-2 py-2">
          <p className="px-3 text-cuerpo">
            <span className="font-bold">{`${actual + 1} de ${fotos.length}`}</span> · {etiqueta}
          </p>
          <BotonIcono icono={X} etiqueta="Cerrar" className="text-sobre-superficie not-disabled:hover:bg-sobre-superficie/15 not-disabled:hover:text-sobre-superficie" onClick={alCerrar} />
        </header>
        <div className="flex min-h-0 grow items-center justify-center px-2">
          {foto && <img src={foto.url} alt={`Foto ${actual + 1} de ${etiqueta}`} className="max-h-full max-w-full object-contain" />}
        </div>
        <footer className="flex items-center justify-between gap-3 px-2 py-3">
          <div className="flex gap-2">
            <BotonIcono icono={ChevronLeft} etiqueta="Foto anterior" disabled={fotos.length < 2} className="text-sobre-superficie not-disabled:hover:bg-sobre-superficie/15 not-disabled:hover:text-sobre-superficie" onClick={() => mover(-1)} />
            <BotonIcono icono={ChevronRight} etiqueta="Foto siguiente" disabled={fotos.length < 2} className="text-sobre-superficie not-disabled:hover:bg-sobre-superficie/15 not-disabled:hover:text-sobre-superficie" onClick={() => mover(1)} />
          </div>
          {alQuitar && foto && (
            <button
              type="button"
              onClick={() => {
                alQuitar(foto.id);
                if (fotos.length === 1) alCerrar();
              }}
              className="inline-flex min-h-control items-center gap-2 rounded-control px-4 text-cuerpo font-bold text-sobre-superficie hover:bg-sobre-superficie/15 focus-visible:outline-3 focus-visible:outline-acento [&_svg]:size-5"
            >
              <Trash aria-hidden />
              Eliminar foto
            </button>
          )}
        </footer>
      </div>
    </dialog>
  );
}
