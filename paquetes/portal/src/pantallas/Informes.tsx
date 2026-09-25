import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Aviso, Boton, Marquilla } from "@teins/ui";
import { cliente, consultas } from "../api";

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));
const fecha = (iso: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(iso));

export function Informes({ cliente: nombre }: { cliente: string }) {
  const informes = useQuery(consultas.informes());
  const consultasCliente = useQueryClient();
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorDescarga, setErrorDescarga] = useState(false);

  async function descargar(id: string) {
    setDescargando(id);
    setErrorDescarga(false);
    try {
      const { url } = await cliente.llamar("pdfDelPortal", { parametros: { id } });
      window.location.assign(url);
    } catch {
      setErrorDescarga(true);
    } finally {
      setDescargando(null);
    }
  }

  async function salir() {
    await cliente.llamar("salirDelPortal").catch(() => undefined);
    await consultasCliente.resetQueries();
  }

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="mx-3 mt-3 rounded-panel bg-superficie px-5 pt-4 pb-5 text-sobre-superficie">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-ayuda text-sobre-superficie-suave">TEINS · [LOGO]</p>
          <button
            type="button"
            onClick={() => void salir()}
            className="min-h-tactil rounded-control px-2 text-ayuda font-bold text-sobre-superficie-suave underline focus-visible:outline-3 focus-visible:outline-acento"
          >
            Salir
          </button>
        </div>
        <h1 className="mt-1 text-titulo leading-tight font-extrabold tracking-tight">Informes de {nombre}</h1>
      </header>

      <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6">
        {informes.isPending ? (
          <div aria-busy="true" aria-label="Cargando sus informes" className="flex flex-col gap-3">
            <div className="h-[140px] animate-pulse rounded-panel bg-panel" />
            <div className="h-[140px] animate-pulse rounded-panel bg-panel" />
          </div>
        ) : informes.isError ? (
          <Aviso tono="error">
            <p>No se pudieron cargar sus informes.</p>
            <Boton className="mt-3" onClick={() => void informes.refetch()}>
              Reintentar
            </Boton>
          </Aviso>
        ) : informes.data.informes.length === 0 ? (
          <p className="text-cuerpo text-texto-secundario">Todavía no hay informes publicados. Cuando TEINS publique uno, aparece aquí.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {informes.data.informes.map((i, n) => (
              <li key={i.id}>
                <article className="flex flex-col gap-2 rounded-panel bg-panel p-5">
                  <div>
                    <Marquilla tono="superficie">{`Versión ${i.numero}`}</Marquilla>
                  </div>
                  <h2 className="text-subtitulo font-extrabold">{i.sitio}</h2>
                  <p className="text-ayuda text-texto-secundario">
                    {i.direccion} · {i.motivo} · visita del {dia(i.programadaPara)}
                  </p>
                  <p className="text-ayuda text-texto-secundario">Publicado el {fecha(i.publicadaEn)}</p>
                  {/* Una sola acción amarilla: el informe más reciente. */}
                  <Boton variante={n === 0 ? "principal" : "secundaria"} className="mt-2" disabled={descargando === i.id} onClick={() => void descargar(i.id)}>
                    {descargando === i.id ? "Preparando…" : `Descargar el informe de ${i.sitio}`}
                  </Boton>
                </article>
              </li>
            ))}
          </ul>
        )}
        {errorDescarga && <Aviso tono="error">No se pudo preparar la descarga. Intente de nuevo; si sigue fallando, avísele a TEINS.</Aviso>}
      </main>
    </div>
  );
}
