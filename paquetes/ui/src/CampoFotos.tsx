import { useId, useState } from "react";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";
import { Camera } from "./iconos";
import { VisorFotos, type FotoVisible } from "./VisorFotos";

interface Props {
  etiqueta: string;
  fotos: readonly FotoVisible[];
  procesando: boolean;
  onAgregar: (archivos: File[]) => void;
  /** Quitar una foto desde el visor. Sin él, las fotos solo se ven. */
  onQuitar?: ((id: string) => void) | undefined;
  obligatorio?: boolean | undefined;
  error?: string | undefined;
  /** Solo lectura: muestra las fotos sin el botón de captura. */
  soloLectura?: boolean;
}

/** Fotos de un dato: miniaturas que se abren a pantalla completa, y la captura con la cámara trasera. */
export function CampoFotos({ etiqueta, fotos, procesando, onAgregar, onQuitar, obligatorio, error, soloLectura }: Props) {
  const id = useId();
  const [abierta, setAbierta] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <EtiquetaCampo id={`${id}-etiqueta`} obligatorio={obligatorio && !soloLectura}>
          {etiqueta}
        </EtiquetaCampo>
        {fotos.length > 0 && <span className="text-ayuda text-texto-secundario">{fotos.length === 1 ? "1 foto" : `${fotos.length} fotos`}</span>}
      </div>
      {fotos.length === 0 ? (
        <p className="text-ayuda text-texto-secundario">{soloLectura ? "Sin fotos." : "Todavía no hay fotos."}</p>
      ) : (
        <ul aria-labelledby={`${id}-etiqueta`} className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((f, i) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => setAbierta(i)}
                className="block w-full overflow-hidden rounded-control focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
              >
                <img src={f.url} alt={`Foto ${i + 1} de ${etiqueta}`} className="aspect-square w-full object-cover transition-transform hover:scale-[1.03]" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!soloLectura && (
        <label
          className={`inline-flex min-h-control items-center justify-center gap-2 rounded-control border bg-panel px-4 text-cuerpo font-bold hover:bg-panel-hundido has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-superficie has-disabled:opacity-60 [&_svg]:size-5 ${error ? "border-2 border-error" : "border-borde-suave"}`}
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
          <Camera aria-hidden />
          {procesando ? "Guardando foto…" : fotos.length === 0 ? "Tomar foto" : "Tomar otra foto"}
        </label>
      )}
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
      {abierta !== null && fotos.length > 0 && <VisorFotos etiqueta={etiqueta} fotos={fotos} inicial={abierta} alCerrar={() => setAbierta(null)} alQuitar={onQuitar} />}
    </div>
  );
}
