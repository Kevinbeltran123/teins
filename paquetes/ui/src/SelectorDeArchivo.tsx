import { useId, useRef } from "react";
import { claseBoton } from "./Boton";
import { Plus, Upload } from "./iconos";

/** Botón que abre el selector de archivos del sistema; el input real queda oculto pero accesible. */
export function SelectorDeArchivo({ etiqueta, aceptar, onElegir, deshabilitado, fila = false }: { etiqueta: string; aceptar: string; onElegir: (archivos: File[]) => void; deshabilitado?: boolean; /** Como la última fila de una lista ("+ Agregar planos"), en oficina. */ fila?: boolean }) {
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
      <label htmlFor={id} className={`${fila ? "agregar-fila" : claseBoton()} cursor-pointer self-start peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-superficie ${deshabilitado ? "pointer-events-none opacity-60" : ""}`}>
        {fila ? <Plus aria-hidden size={18} /> : <Upload aria-hidden />}
        {etiqueta}
      </label>
    </>
  );
}
