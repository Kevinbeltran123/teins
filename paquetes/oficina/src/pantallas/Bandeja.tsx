import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Aviso, Boton, Marquilla, Pestanas } from "@teins/ui";
import { consultas } from "../api";
import { aFechaHora, aHora, haceCuanto } from "../formato";
import { mensajeDeError } from "../mensajes";
import { useBandeja, useTomar, type Estado } from "../revision";

const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

const PESTANAS: Record<Estado, { etiqueta: string; vacio: string; titulo: string }> = {
  enviado: { etiqueta: "Esperando revisión", vacio: "No hay levantamientos esperando. Aparecen aquí cuando un técnico los envía.", titulo: "Enviados, del más antiguo al más reciente" },
  en_revision: { etiqueta: "En revisión", vacio: "Nadie está revisando un levantamiento en este momento.", titulo: "En revisión, con quién la tiene" },
  revisado: { etiqueta: "Revisados", vacio: "Todavía no hay levantamientos revisados.", titulo: "Revisados" },
};

export function Bandeja() {
  const [estado, setEstado] = useState<Estado>("enviado");
  const bandejas = { enviado: useBandeja("enviado"), en_revision: useBandeja("en_revision"), revisado: useBandeja("revisado") };
  const sesion = useQuery(consultas.sesion());
  const activa = bandejas[estado];
  const esperando = bandejas.enviado;

  if (esperando.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando la bandeja" className="flex flex-col gap-6">
        <div className="h-[220px] animate-pulse rounded-panel bg-panel" />
        <div className="h-[240px] animate-pulse rounded-panel bg-panel" />
      </div>
    );
  }
  if (esperando.isError) {
    return (
      <Aviso tono="error">
        <p>No se pudo cargar la bandeja.</p>
        <Boton className="mt-3" onClick={() => void esperando.refetch()}>
          Reintentar
        </Boton>
      </Aviso>
    );
  }

  const total = esperando.data.pages[0]?.total ?? 0;
  const masAntiguo = esperando.data.pages[0]?.elementos[0];
  const cantidad = (e: Estado) => bandejas[e].data?.pages[0]?.total;

  return (
    <>
      <PuntoFocal total={total} masAntiguo={masAntiguo} />

      <section aria-labelledby="titulo-lista" className="flex flex-col gap-4 rounded-panel bg-panel p-6">
        <h2 id="titulo-lista" className="sr-only">
          Levantamientos por estado
        </h2>
        <Pestanas
          etiqueta="Estado de los levantamientos"
          activa={estado}
          onCambio={setEstado}
          pestanas={(["enviado", "en_revision", "revisado"] as const).map((e) => ({ valor: e, etiqueta: PESTANAS[e].etiqueta, cantidad: cantidad(e) }))}
        />
        <div role="tabpanel" aria-label={PESTANAS[estado].etiqueta} className="flex flex-col gap-3">
          {activa.isPending ? (
            <div aria-busy="true" aria-label="Cargando" className="h-[160px] animate-pulse rounded-panel bg-fondo" />
          ) : activa.isError ? (
            <Aviso tono="error">
              <p>No se pudo cargar esta lista.</p>
              <Boton className="mt-3" onClick={() => void activa.refetch()}>
                Reintentar
              </Boton>
            </Aviso>
          ) : (activa.data.pages[0]?.total ?? 0) === 0 ? (
            <p className="text-cuerpo text-texto-secundario">{PESTANAS[estado].vacio}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-cuerpo font-bold">{PESTANAS[estado].titulo}</p>
                <p className="text-ayuda text-texto-secundario" aria-live="polite">
                  Actualizado a las {aHora(activa.dataUpdatedAt)}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-cuerpo">
                  <thead className="text-ayuda text-texto-secundario">
                    <tr className="border-b border-division">
                      <th scope="col" className="py-2 pr-4 font-normal">Recibido</th>
                      <th scope="col" className="py-2 pr-4 font-normal">Técnico</th>
                      <th scope="col" className="py-2 pr-4 font-normal">Formato</th>
                      <th scope="col" className="py-2 pr-4 font-normal">Fotos</th>
                      {estado !== "enviado" && <th scope="col" className="py-2 font-normal">Revisión</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {activa.data.pages
                      .flatMap((p) => p.elementos)
                      .map((e) => (
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
                          <td className="py-1 pr-4">{fotos(e.fotos)}</td>
                          {estado !== "enviado" && (
                            <td className="py-1">{e.revisor ? (e.revisor.id === sesion.data?.usuario.id ? "Usted" : e.revisor.nombre) : "[Sin responsable]"}</td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {activa.hasNextPage && (
                <Boton onClick={() => void activa.fetchNextPage()} disabled={activa.isFetchingNextPage}>
                  {activa.isFetchingNextPage ? "Cargando…" : "Cargar más"}
                </Boton>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

/** Punto focal (DESIGN.md): lo que espera revisión y el que más lleva esperando, con "Tomar para revisar". */
function PuntoFocal({ total, masAntiguo }: { total: number; masAntiguo: { id: string; recibidoEn: string; tecnico: { nombre: string }; version: number } | undefined }) {
  const tomar = useTomar();
  const navegar = useNavigate();

  async function tomarElMasAntiguo() {
    if (!masAntiguo) return;
    try {
      await tomar.mutateAsync({ id: masAntiguo.id, version: masAntiguo.version });
      await navegar({ to: "/levantamientos/$id", params: { id: masAntiguo.id } });
    } catch {
      // El error queda a la vista; la bandeja se vuelve a leer sola.
    }
  }

  return (
    <section aria-labelledby="titulo-espera" className="flex flex-col gap-4 rounded-panel bg-panel p-6 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 id="titulo-espera" className="text-subtitulo font-extrabold">
          Esperando revisión
        </h1>
        <p className="text-cifra-focal leading-none font-extrabold text-superficie">{total}</p>
        <p className="text-cuerpo text-texto-secundario">
          {total === 0 ? "No hay levantamientos esperando." : total === 1 ? "levantamiento enviado por un técnico" : "levantamientos enviados por técnicos"}
        </p>
      </div>
      {masAntiguo && (
        <div className="flex flex-col gap-2 md:max-w-sm md:items-end">
          <p className="text-cuerpo md:text-right">
            <Marquilla tono="enviado">Enviado</Marquilla> El más antiguo llegó <strong>{haceCuanto(masAntiguo.recibidoEn)}</strong>, de {masAntiguo.tecnico.nombre}.
          </p>
          <Boton variante="principal" onClick={() => void tomarElMasAntiguo()} disabled={tomar.isPending}>
            {tomar.isPending ? "Tomando…" : "Tomar para revisar"}
          </Boton>
          {tomar.isError && <Aviso tono="error">{mensajeDeError(tomar.error)}</Aviso>}
        </div>
      )}
    </section>
  );
}
