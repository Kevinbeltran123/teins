import { useId, useState, type ReactNode } from "react";
import { EtiquetaCampo, MensajeError } from "./Etiqueta";
import { Camera } from "./iconos";
import { VisorFotos, type FotoVisible } from "./VisorFotos";
import { useLoNuevo } from "./transicion";

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
  /** Las tomas que se esperan, con su nombre: cada una es un lugar en la cuadrícula (el formato las declara). */
  puestos?: readonly string[] | undefined;
  /** Una línea sobre las tomas, antes de tomar la foto: el estado de lo que la foto necesita (la ubicación, ADR-0052). */
  estado?: ReactNode;
}

/** Fotos de un dato: miniaturas que se abren a pantalla completa, y la captura con la cámara trasera. */
export function CampoFotos({ etiqueta, fotos, procesando, onAgregar, onQuitar, obligatorio, error, soloLectura, puestos = [], estado }: Props) {
  const id = useId();
  const [abierta, setAbierta] = useState<number | null>(null);
  // Solo la foto recién tomada entra animada; las que ya estaban no se animan otra vez al volver al paso.
  const esNueva = useLoNuevo(fotos.map((f) => f.id));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <EtiquetaCampo id={`${id}-etiqueta`} obligatorio={obligatorio && !soloLectura}>
          {etiqueta}
        </EtiquetaCampo>
        {puestos.length > 0 && !soloLectura ? (
          <span className="text-ayuda font-bold text-texto-secundario">{`${Math.min(fotos.length, puestos.length)} de ${puestos.length}`}</span>
        ) : (
          fotos.length > 0 && <span className="text-ayuda text-texto-secundario">{fotos.length === 1 ? "1 foto" : `${fotos.length} fotos`}</span>
        )}
      </div>
      {estado && !soloLectura && (
        <p role="status" className="text-ayuda text-texto-secundario">
          {estado}
        </p>
      )}
      {soloLectura && fotos.length === 0 ? (
        <p className="text-ayuda text-texto-secundario">Sin fotos.</p>
      ) : (
        // Las fotos y el lugar para la siguiente van en la misma cuadrícula: se ve cuántas hay y dónde va la otra.
        <ul aria-labelledby={`${id}-etiqueta`} className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {fotos.map((f, i) => (
            <li key={f.id} className={esNueva(f.id) ? "motion-safe:animate-subir" : undefined}>
              <button
                type="button"
                onClick={() => setAbierta(i)}
                className="relative block w-full overflow-hidden rounded-control focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
              >
                <img src={f.url} alt={`Foto ${i + 1} de ${etiqueta}`} className="aspect-[3/4] w-full object-cover transition-transform hover:scale-[1.03]" />
                {puestos[i] && (
                  <span aria-hidden className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 pt-6 pb-2 text-ayuda font-extrabold text-white">
                    {puestos[i]}
                  </span>
                )}
              </button>
            </li>
          ))}
          {!soloLectura &&
            [...puestos.slice(fotos.length), ...(fotos.length >= puestos.length ? [null] : [])].map((nombre, j) => (
              <li key={nombre ?? "otra"}>
                <label
                  className={`flex aspect-[3/4] w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-control border-2 border-dashed p-2 text-center text-ayuda font-extrabold text-texto-secundario hover:bg-panel-hundido has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-foco has-disabled:opacity-60 [&_svg]:size-7 ${error && j === 0 ? "border-error" : "border-borde-suave"}`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    disabled={procesando}
                    aria-label={nombre ? `Tomar foto: ${nombre}` : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className="sr-only"
                    onChange={(e) => {
                      const archivos = Array.from(e.target.files ?? []);
                      e.target.value = "";
                      if (archivos.length > 0) onAgregar(archivos);
                    }}
                  />
                  <Camera aria-hidden />
                  {procesando && j === 0 ? "Guardando foto…" : (nombre ?? (fotos.length === 0 ? "Tomar foto" : "Tomar otra foto"))}
                </label>
              </li>
            ))}
        </ul>
      )}
      {error && <MensajeError id={`${id}-error`}>{error}</MensajeError>}
      {abierta !== null && fotos.length > 0 && <VisorFotos etiqueta={etiqueta} fotos={fotos} inicial={abierta} alCerrar={() => setAbierta(null)} alQuitar={onQuitar} />}
    </div>
  );
}
