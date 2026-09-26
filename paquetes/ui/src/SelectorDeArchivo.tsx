import { useId, useRef } from "react";
import { claseBoton } from "./Boton";
import { Upload } from "./iconos";

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
        className="peer sr-only"
        disabled={deshabilitado}
        onChange={(e) => {
          const archivos = [...(e.target.files ?? [])];
          e.target.value = "";
          if (archivos.length > 0) onElegir(archivos);
        }}
      />
      <label htmlFor={id} className={`${claseBoton()} cursor-pointer self-start peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-superficie ${deshabilitado ? "pointer-events-none opacity-60" : ""}`}>
        <Upload aria-hidden />
        {etiqueta}
      </label>
    </>
  );
}
