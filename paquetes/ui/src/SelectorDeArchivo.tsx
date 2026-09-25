import { useId, useRef } from "react";
import { claseBoton } from "./Boton";

/** Botón que abre el selector de archivos del sistema; el input real queda oculto pero accesible. */
export function SelectorDeArchivo({ etiqueta, aceptar, onElegir, deshabilitado }: { etiqueta: string; aceptar: string; onElegir: (archivos: File[]) => void; deshabilitado?: boolean }) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={entrada}
        id={id}
        type="file"
        accept={aceptar}
        multiple
        className="sr-only"
        disabled={deshabilitado}
        onChange={(e) => {
          const archivos = [...(e.target.files ?? [])];
          e.target.value = "";
          if (archivos.length > 0) onElegir(archivos);
        }}
      />
      <label htmlFor={id} className={`${claseBoton()} cursor-pointer self-start ${deshabilitado ? "pointer-events-none opacity-60" : ""}`}>
        {etiqueta}
      </label>
    </>
  );
}
