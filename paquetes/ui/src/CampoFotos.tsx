import { useId } from "react";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";

interface Foto {
  id: string;
  url: string;
}

interface Props {
  etiqueta: string;
  fotos: readonly Foto[];
  procesando: boolean;
  onAgregar: (archivos: File[]) => void;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
  /** Solo lectura: muestra las fotos sin el botón de captura. */
  soloLectura?: boolean;
}

export function CampoFotos({ etiqueta, fotos, procesando, onAgregar, obligatorio, error, soloLectura }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <EtiquetaCampo id={`${id}-etiqueta`} obligatorio={obligatorio && !soloLectura}>
        {etiqueta}
      </EtiquetaCampo>
      {fotos.length === 0 ? (
        <p className="text-ayuda text-texto-secundario">{soloLectura ? "Sin fotos." : "Todavía no hay fotos."}</p>
      ) : (
        <ul aria-labelledby={`${id}-etiqueta`} className="grid grid-cols-3 gap-2">
          {fotos.map((f, i) => (
            <li key={f.id}>
              <img src={f.url} alt={`Foto ${i + 1} de ${etiqueta}`} className="aspect-square w-full rounded-control object-cover" />
            </li>
          ))}
        </ul>
      )}
      {!soloLectura && (
        <label
          className={`inline-flex min-h-tactil cursor-pointer items-center justify-center rounded-control border-[1.5px] bg-panel px-5 text-cuerpo font-bold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-superficie has-disabled:opacity-60 ${error ? "border-2 border-error" : "border-borde-control"}`}
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={procesando}
            aria-describedby={error ? `${id}-error` : undefined}
            className="sr-only"
            onChange={(e) => {
              const archivos = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (archivos.length > 0) onAgregar(archivos);
            }}
          />
          {procesando ? "Guardando foto…" : fotos.length === 0 ? "Tomar foto" : "Tomar otra foto"}
        </label>
      )}
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
    </div>
  );
}
