import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Aviso, Boton, claseBoton } from "@teins/ui";
import { cliente, REFRESCO_BANDEJA_MS } from "../api";
import { aFechaHora, aHora, haceCuanto } from "../formato";

const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

export function Bandeja() {
  const consulta = useInfiniteQuery({
    queryKey: ["bandeja"],
    queryFn: ({ pageParam }) => cliente.llamar("listarLevantamientos", { consulta: pageParam ? { cursor: pageParam } : {} }),
    initialPageParam: null as string | null,
    getNextPageParam: (ultima) => ultima.siguienteCursor,
    refetchInterval: REFRESCO_BANDEJA_MS,
  });

  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando la bandeja" className="flex flex-col gap-6">
        <div className="h-[220px] animate-pulse rounded-panel bg-panel" />
        <div className="h-[240px] animate-pulse rounded-panel bg-panel" />
      </div>
    );
  }
  if (consulta.isError) {
    return (
      <Aviso tono="error">
        <p>No se pudo cargar la bandeja.</p>
        <Boton className="mt-3" onClick={() => void consulta.refetch()}>
          Reintentar
        </Boton>
      </Aviso>
    );
  }

  const elementos = consulta.data.pages.flatMap((p) => p.elementos);
  const total = consulta.data.pages[0]?.total ?? 0;
  const masAntiguo = elementos[0];

  return (
    <>
      {/* Punto focal (DESIGN.md): lo que espera revisión y el que más lleva esperando. */}
      <section aria-labelledby="titulo-espera" className="flex flex-col gap-4 rounded-panel bg-panel p-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 id="titulo-espera" className="text-subtitulo font-extrabold">
            Esperando revisión
          </h1>
          <p className="text-cifra-focal leading-none font-extrabold text-superficie">{total}</p>
          <p className="text-cuerpo text-texto-secundario">
            {total === 0
              ? "No hay levantamientos esperando. Aparecen aquí cuando un técnico los envía."
              : total === 1
                ? "levantamiento enviado por un técnico"
                : "levantamientos enviados por técnicos"}
          </p>
        </div>
        {masAntiguo && (
          <div className="flex flex-col gap-2 md:items-end">
            <p className="text-cuerpo">
              El más antiguo llegó <strong>{haceCuanto(masAntiguo.recibidoEn)}</strong>, de {masAntiguo.tecnico.nombre}.
            </p>
            <Link to="/levantamientos/$id" params={{ id: masAntiguo.id }} className={claseBoton("principal")}>
              Ver el más antiguo
            </Link>
          </div>
        )}
      </section>

      {elementos.length > 0 && (
        <section aria-labelledby="titulo-lista" className="flex flex-col gap-3 rounded-panel bg-panel p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="titulo-lista" className="text-subtitulo font-extrabold">
              Enviados, del más antiguo al más reciente
            </h2>
            <p className="text-ayuda text-texto-secundario" aria-live="polite">
              Actualizado a las {aHora(consulta.dataUpdatedAt)}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-cuerpo">
              <thead className="text-ayuda text-texto-secundario">
                <tr className="border-b border-division">
                  <th scope="col" className="py-2 pr-4 font-normal">Recibido</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Técnico</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Formato</th>
                  <th scope="col" className="py-2 font-normal">Fotos</th>
                </tr>
              </thead>
              <tbody>
                {elementos.map((e) => (
                  <tr key={e.id} className="border-b border-division last:border-0">
                    <td className="py-1 pr-4">
                      <Link
                        to="/levantamientos/$id"
                        params={{ id: e.id }}
                        className="inline-flex min-h-tactil items-center font-bold text-superficie underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
                      >
                        {aFechaHora(e.recibidoEn)}
                      </Link>
                    </td>
                    <td className="py-1 pr-4">{e.tecnico.nombre}</td>
                    <td className="py-1 pr-4">
                      {e.formato} v{e.versionFormato}
                    </td>
                    <td className="py-1">{fotos(e.fotos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {consulta.hasNextPage && (
            <Boton onClick={() => void consulta.fetchNextPage()} disabled={consulta.isFetchingNextPage}>
              {consulta.isFetchingNextPage ? "Cargando…" : "Cargar más"}
            </Boton>
          )}
        </section>
      )}
    </>
  );
}
