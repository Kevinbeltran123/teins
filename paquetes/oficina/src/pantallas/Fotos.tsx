import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { ErrorDeCarga, VisorFotos } from "@teins/ui";
import { consultas } from "../api";

export function Fotos({ etiqueta, huellas, puestos }: { etiqueta: string; huellas: readonly string[]; puestos?: readonly string[] | undefined }) {
  const urls = useQueries({ queries: huellas.map((h) => consultas.urlDeArchivo(h)) });
  const [viendo, setViendo] = useState<number | null>(null);
  if (urls.some((u) => u.isPending)) return <p className="ayuda">Cargando fotos…</p>;
  if (urls.some((u) => u.isError)) return <ErrorDeCarga texto={`No se pudieron cargar las fotos de ${etiqueta.toLowerCase()}.`} reintentar={() => urls.forEach((u) => void u.refetch())} />;
  const fotos = urls.map((u, i) => ({ id: huellas[i]!, url: u.data!.url }));
  return (
    <>
      <div className="fotos">
        {fotos.map((f, i) => (
          <figure key={f.id} className="foto" style={{ margin: 0 }}>
            <img src={f.url} alt={`Foto ${i + 1} de ${etiqueta}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <figcaption>{puestos?.[i] ?? `Foto ${i + 1}`}</figcaption>
            <button type="button" className="ver-foto" aria-label={`Ver ${puestos?.[i] ?? `la foto ${i + 1}`} de ${etiqueta.toLowerCase()}`} onClick={() => setViendo(i)} />
          </figure>
        ))}
      </div>
      {viendo !== null && <VisorFotos etiqueta={etiqueta} fotos={fotos} inicial={viendo} alCerrar={() => setViendo(null)} />}
    </>
  );
}
