import { useId } from "react";

interface Foto {
  id: string;
  url: string;
}

interface Props {
  etiqueta: string;
  fotos: readonly Foto[];
  procesando: boolean;
  onAgregar: (archivos: File[]) => void;
}

export function CampoFotos({ etiqueta, fotos, procesando, onAgregar }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-etiqueta`} className="text-campo font-bold">
        {etiqueta}
      </span>
      {fotos.length === 0 ? (
        <p className="text-ayuda text-texto-secundario">Todavía no hay fotos.</p>
      ) : (
        <ul aria-labelledby={`${id}-etiqueta`} className="grid grid-cols-3 gap-2">
          {fotos.map((f, i) => (
            <li key={f.id}>
              <img src={f.url} alt={`Foto ${i + 1} de ${etiqueta}`} className="aspect-square w-full rounded-control object-cover" />
            </li>
          ))}
        </ul>
      )}
      <label className="inline-flex min-h-tactil-campo cursor-pointer items-center justify-center rounded-control border-[1.5px] border-borde-control bg-panel px-5 text-campo font-bold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-superficie has-disabled:opacity-60">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          disabled={procesando}
          className="sr-only"
          onChange={(e) => {
            const archivos = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (archivos.length > 0) onAgregar(archivos);
          }}
        />
        {procesando ? "Guardando foto…" : fotos.length === 0 ? "Tomar foto" : "Tomar otra foto"}
      </label>
    </div>
  );
}
