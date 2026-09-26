import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Aviso, Boton, CeldaTabla, EncabezadoPagina, EsqueletoBloques, EsqueletoTabla, EstadoVacio, FilaTabla, Inbox, Insignia, Pestanas, RefreshCw, Tabla } from "@teins/ui";
import { consultas } from "../api";
import { aFechaHora, aHora, haceCuanto } from "../formato";
import { mensajeDeError } from "../mensajes";
import { useBandeja, useTomar, type Estado } from "../revision";

const fotos = (n: number) => (n === 1 ? "1 foto" : `${n} fotos`);

const PESTANAS: Record<Estado, { etiqueta: string; vacio: string; orden: string }> = {
  enviado: { etiqueta: "Esperando revisión", vacio: "Aparecen aquí cuando un técnico envía un levantamiento.", orden: "Del que más lleva esperando al más reciente" },
  en_revision: { etiqueta: "En revisión", vacio: "Nadie está revisando un levantamiento en este momento.", orden: "Con quién tiene cada revisión" },
  revisado: { etiqueta: "Revisados", vacio: "Todavía no hay levantamientos revisados.", orden: "Del más reciente al más antiguo" },
};

export function Bandeja() {
  const [estado, setEstado] = useState<Estado>("enviado");
  const bandejas = { enviado: useBandeja("enviado"), en_revision: useBandeja("en_revision"), revisado: useBandeja("revisado") };
  const sesion = useQuery(consultas.sesion());
  const activa = bandejas[estado];
  const esperando = bandejas.enviado;

  if (esperando.isPending) {
    return (
      <>
        <EncabezadoPagina titulo="Levantamientos" />
        <EsqueletoBloques etiqueta="Cargando la bandeja" altos={["medio", "alto"]} />
      </>
    );
  }
  if (esperando.isError) {
    return (
      <>
        <EncabezadoPagina titulo="Levantamientos" />
        <Aviso tono="error">
          <p>No se pudo cargar la bandeja.</p>
          <Boton className="mt-3" icono={RefreshCw} onClick={() => void esperando.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      </>
    );
  }

  const total = esperando.data.pages[0]?.total ?? 0;
  const masAntiguo = esperando.data.pages[0]?.elementos[0];
  const cantidad = (e: Estado) => bandejas[e].data?.pages[0]?.total;

  return (
    <>
      <EncabezadoPagina titulo="Levantamientos" />
      <PuntoFocal total={total} masAntiguo={masAntiguo} />

      <section aria-labelledby="titulo-lista" className="flex flex-col gap-4">
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
            <EsqueletoTabla etiqueta="Cargando" columnas={4} />
          ) : activa.isError ? (
            <Aviso tono="error">
              <p>No se pudo cargar esta lista.</p>
              <Boton className="mt-3" icono={RefreshCw} onClick={() => void activa.refetch()}>
                Reintentar
              </Boton>
            </Aviso>
          ) : (activa.data.pages[0]?.total ?? 0) === 0 ? (
            <EstadoVacio icono={Inbox} titulo={`Sin levantamientos ${PESTANAS[estado].etiqueta.toLowerCase()}`}>
              {PESTANAS[estado].vacio}
            </EstadoVacio>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-ayuda text-texto-secundario">
                <p>{PESTANAS[estado].orden}</p>
                <p aria-live="polite">Actualizado a las {aHora(activa.dataUpdatedAt)}</p>
              </div>
              <Tabla
                etiqueta={PESTANAS[estado].etiqueta}
                columnas={[{ titulo: "Recibido" }, { titulo: "Técnico" }, { titulo: "Formato" }, { titulo: "Fotos" }, ...(estado !== "enviado" ? [{ titulo: "Revisión" }] : [])]}
              >
                {activa.data.pages
                  .flatMap((p) => p.elementos)
                  .map((e) => (
                    <FilaTabla key={e.id} abrir>
                      <CeldaTabla>
                        <Link
                          to="/levantamientos/$id"
                          params={{ id: e.id }}
                          className="font-bold text-superficie underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
                        >
                          {aFechaHora(e.recibidoEn)}
                        </Link>
                      </CeldaTabla>
                      <CeldaTabla>{e.tecnico.nombre}</CeldaTabla>
                      <CeldaTabla>{e.formato}</CeldaTabla>
                      <CeldaTabla>{fotos(e.fotos)}</CeldaTabla>
                      {estado !== "enviado" && (
                        <CeldaTabla>{e.revisor ? (e.revisor.id === sesion.data?.usuario.id ? "Usted" : e.revisor.nombre) : <span className="text-texto-secundario">[Sin responsable]</span>}</CeldaTabla>
                      )}
                    </FilaTabla>
                  ))}
              </Tabla>
              {activa.hasNextPage && (
                <Boton className="self-start" cargando={activa.isFetchingNextPage} onClick={() => void activa.fetchNextPage()}>
                  Cargar más
                </Boton>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

/** Punto focal (DESIGN.md): cuántos esperan revisión y el que más lleva esperando, con "Tomar para revisar". */
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
    <section aria-labelledby="titulo-espera" className="flex flex-col gap-5 rounded-panel border border-division bg-panel p-6 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h2 id="titulo-espera" className="text-subtitulo font-extrabold">
          Esperando revisión
        </h2>
        <p className="text-cifra-focal leading-none font-extrabold text-superficie">{total}</p>
        <p className="text-cuerpo text-texto-secundario">
          {total === 0 ? "Nada por revisar." : total === 1 ? "levantamiento enviado por un técnico" : "levantamientos enviados por técnicos"}
        </p>
      </div>
      {masAntiguo && (
        <div className="flex flex-col gap-3 md:max-w-sm md:items-end">
          <p className="flex flex-wrap items-center gap-2 text-cuerpo md:justify-end">
            <Insignia tono="enviado">Enviado</Insignia>
            <span>
              El más antiguo llegó <strong>{haceCuanto(masAntiguo.recibidoEn)}</strong>, de {masAntiguo.tecnico.nombre}.
            </span>
          </p>
          <Boton variante="principal" cargando={tomar.isPending} onClick={() => void tomarElMasAntiguo()}>
            Tomar para revisar
          </Boton>
          {tomar.isError && <Aviso tono="error">{mensajeDeError(tomar.error)}</Aviso>}
        </div>
      )}
    </section>
  );
}
