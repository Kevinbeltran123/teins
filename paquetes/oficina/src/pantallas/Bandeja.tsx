import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Aviso, BarraLista, Boton, Buscador, CeldaTabla, ChevronRight, EncabezadoPagina, EsqueletoLista, EstadoVacio, FilaTabla, Inbox, Marcado, nombreDeTransicion, Pestanas, PieLista, RefreshCw, SinResultados, Tabla } from "@teins/ui";
import { consultas } from "../api";
import { aFechaCorta, aHora, cuantoLleva, iniciales } from "../formato";
import { mensajeDeError } from "../mensajes";
import { useBandeja, useTomar, type Estado } from "../revision";
import { useRetrasado } from "../usarRetraso";
import { esTexto, unoDe, useBusquedaRecordada, usePreferencia } from "../preferencias";
import { useTeclaSuelta } from "../atajos";


const PESTANAS: Record<Estado, { etiqueta: string; vacio: string; orden: string }> = {
  enviado: { etiqueta: "Esperando revisión", vacio: "Aparecen aquí cuando un técnico envía un levantamiento.", orden: "Del que más lleva esperando al más reciente" },
  en_revision: { etiqueta: "En revisión", vacio: "Nadie está revisando un levantamiento en este momento.", orden: "Con quién tiene cada revisión" },
  revisado: { etiqueta: "Revisados", vacio: "Todavía no hay levantamientos revisados.", orden: "Del más reciente al más antiguo" },
};
const ESTADOS = ["enviado", "en_revision", "revisado"] as const;

/**
 * Levantamientos (prototipos/oficina): el resumen y "Tomar el más antiguo" en el encabezado; las pestañas con su
 * conteo y el buscador en una barra; la tabla sobre el fondo. La búsqueda la hace el servidor (la bandeja llega por
 * páginas) y dice cuántos coinciden en las otras pestañas.
 */
export function Bandeja() {
  // Dónde quedó la persona (prototipos/usabilidad-oficina): la pestaña, en el equipo; la búsqueda y la fila que abrió,
  // mientras dure la pestaña del navegador.
  const [estado, setEstado] = usePreferencia<Estado>("bandeja-pestana", "enviado", unoDe(...ESTADOS));
  const [busqueda, setBusqueda] = useBusquedaRecordada("bandeja");
  const [ultima, setUltima] = usePreferencia("bandeja-ultima", "", esTexto, "pestana");
  const navegar = useNavigate();
  const buscar = useRetrasado(busqueda);
  const bandejas = { enviado: useBandeja("enviado", buscar), en_revision: useBandeja("en_revision", buscar), revisado: useBandeja("revisado", buscar) };
  // El resumen del encabezado es de toda la bandeja, no de lo buscado.
  const esperando = useBandeja("enviado");
  const sesion = useQuery(consultas.sesion());
  const activa = bandejas[estado];

  const total = esperando.data?.pages[0]?.total ?? 0;
  const masAntiguo = esperando.data?.pages[0]?.elementos[0];
  const cantidad = (e: Estado) => bandejas[e].data?.pages[0]?.total;
  const otras = ESTADOS.filter((e) => e !== estado && (cantidad(e) ?? 0) > 0);

  const meta = esperando.isPending ? undefined : total === 0 ? (
    <span>Nada por revisar.</span>
  ) : (
    <>
      <span>
        <b>{total}</b> {total === 1 ? "espera revisión" : "esperan revisión"}
      </span>
      {masAntiguo && (
        <span>
          El más antiguo lleva <b>{cuantoLleva(masAntiguo.recibidoEn).dias === 0 ? "menos de un día" : cuantoLleva(masAntiguo.recibidoEn).dias === 1 ? "1 día" : cuantoLleva(masAntiguo.recibidoEn).texto}</b>: {masAntiguo.visita ? `${masAntiguo.visita.cliente}, ` : ""}de {masAntiguo.tecnico.nombre}
        </span>
      )}
    </>
  );

  const enOtras = (clase?: string) =>
    otras.length > 0 && (
      <>
        {otras.map((e, i) => (
          <span key={e}>
            {i > 0 && " y "}
            <button type="button" className={clase ?? "enlace"} onClick={() => setEstado(e)}>
              {cantidad(e)} en {PESTANAS[e].etiqueta}
            </button>
          </span>
        ))}
      </>
    );

  const elementos = activa.data?.pages.flatMap((p) => p.elementos) ?? [];
  // Revisar con el teclado (iteración 37): J y K (o ↓ y ↑) mueven la fila marcada, Enter la abre y «/» va a la búsqueda.
  const marcada = elementos.findIndex((e) => e.id === ultima);
  const mover = (paso: 1 | -1) => {
    const destino = elementos[marcada < 0 ? 0 : Math.min(Math.max(marcada + paso, 0), elementos.length - 1)];
    if (destino) setUltima(destino.id);
  };
  useTeclaSuelta(["j", "ArrowDown"], () => mover(1));
  useTeclaSuelta(["k", "ArrowUp"], () => mover(-1));
  useTeclaSuelta("Enter", () => void navegar({ to: "/levantamientos/$id", params: { id: ultima } }), marcada >= 0);
  useTeclaSuelta("/", () => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus());
  const conRevision = estado !== "enviado";

  return (
    <>
      <EncabezadoPagina titulo="Levantamientos" descripcion={meta} acciones={masAntiguo && <TomarElMasAntiguo masAntiguo={masAntiguo} />} />

      <BarraLista buscador={<Buscador etiqueta="Buscar levantamientos" ejemplo="Buscar por cliente, sitio, técnico o formato" valor={busqueda} onCambio={setBusqueda} />}>
        <Pestanas etiqueta="Estado de los levantamientos" activa={estado} onCambio={setEstado} pestanas={ESTADOS.map((e) => ({ valor: e, etiqueta: PESTANAS[e].etiqueta, cantidad: cantidad(e) }))} />
      </BarraLista>

      <div role="tabpanel" aria-label={PESTANAS[estado].etiqueta}>
        {activa.isPending ? (
          <EsqueletoLista etiqueta="Cargando la bandeja" />
        ) : activa.isError ? (
          <Aviso tono="error">
            <b>No se pudo cargar la bandeja.</b>
            <span className="sec">Puede ser la conexión o el servidor. Lo que ya estaba guardado no se perdió.</span>
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void activa.refetch()}>
                Reintentar
              </Boton>
            </div>
          </Aviso>
        ) : elementos.length === 0 ? (
          buscar.trim() ? (
            <SinResultados texto={buscar.trim()} onQuitar={() => setBusqueda("")}>
              {otras.length > 0 && <p className="resumen-busqueda" style={{ textAlign: "center" }}>Sí hay {enOtras("")}.</p>}
            </SinResultados>
          ) : (
            <EstadoVacio icono={Inbox} titulo={`Sin levantamientos ${PESTANAS[estado].etiqueta.toLowerCase()}`}>
              {PESTANAS[estado].vacio}
            </EstadoVacio>
          )
        ) : (
          <div>
            <Tabla
              etiqueta={PESTANAS[estado].etiqueta}
              columnas={[
                { titulo: "Cliente y sitio" },
                { titulo: "Formato" },
                { titulo: "Técnico" },
                ...(conRevision ? [{ titulo: "Revisión" }] : []),
                ...(estado === "enviado" ? [{ titulo: "Recibido" }, { titulo: "Lleva esperando", derecha: true }] : [{ titulo: "Recibido", derecha: true }]),
              ]}
            >
              {elementos.map((e) => {
                const lleva = cuantoLleva(e.recibidoEn);
                return (
                  <FilaTabla key={e.id} abrir clave={e.id} marcada={e.id === ultima}>
                    {/* De qué cliente es: lo primero que oficina busca para saber qué revisar (iteración 14). */}
                    <CeldaTabla>
                      {/* Al abrirlo, este título se convierte en el del detalle (iteración 27). */}
                      {/* El técnico respondió y esta persona no lo ha leído (ADR-0040): punto y quién, debajo. */}
                      <span className="cli-b">
                        {e.conversacion?.sinLeer ? <i className="punto" aria-label="Respuesta sin leer" /> : <span />}
                        <span data-transicion={nombreDeTransicion("lev", e.id)}>
                          <Link to="/levantamientos/$id" params={{ id: e.id }} className="enlace">
                            {e.visita ? <Marcado texto={e.visita.cliente} busqueda={buscar} /> : "Sin visita"}
                          </Link>
                          {e.visita && (
                            <span className="sec">
                              {" · "}
                              <Marcado texto={e.visita.sitio} busqueda={buscar} />
                            </span>
                          )}
                          {e.conversacion?.sinLeer && <span className="nuevo-b">{`${e.conversacion.ultima.autor} respondió · ${aHora(Date.parse(e.conversacion.ultima.en))}`}</span>}
                        </span>
                      </span>
                    </CeldaTabla>
                    <CeldaTabla>
                      <span className="sec">
                        <Marcado texto={e.nombreFormato ?? e.formato} busqueda={buscar} />
                      </span>
                    </CeldaTabla>
                    <CeldaTabla>
                      <span className="persona">
                        <span className="avatar" aria-hidden>
                          {iniciales(e.tecnico.nombre)}
                        </span>
                        <Marcado texto={e.tecnico.nombre} busqueda={buscar} />
                      </span>
                    </CeldaTabla>
                    {conRevision && (
                      <CeldaTabla>{e.revisor ? e.revisor.id === sesion.data?.usuario.id ? <span className="fuerte">Usted</span> : e.revisor.nombre : <span className="sec">[Sin responsable]</span>}</CeldaTabla>
                    )}
                    {estado === "enviado" ? (
                      <>
                        <CeldaTabla>
                          <span className="sec">{aFechaCorta(e.recibidoEn)}</span>
                        </CeldaTabla>
                        <CeldaTabla derecha>
                          <span className={`espera ${lleva.dias >= 2 ? "larga" : ""}`}>{lleva.texto}</span>
                        </CeldaTabla>
                      </>
                    ) : (
                      <CeldaTabla derecha>
                        <span className="sec">{aFechaCorta(e.recibidoEn)}</span>
                      </CeldaTabla>
                    )}
                  </FilaTabla>
                );
              })}
            </Tabla>
            <PieLista derecha={`Actualizado a las ${aHora(activa.dataUpdatedAt)}`}>
              {buscar.trim() ? (
                <>
                  {elementos.length} de {cantidad(estado)} coinciden{otras.length > 0 && <> · también {enOtras()}</>}
                </>
              ) : (
                PESTANAS[estado].orden
              )}
            </PieLista>
            {activa.hasNextPage && (
              <Boton tamano="pequeno" className="mt-3" cargando={activa.isFetchingNextPage} onClick={() => void activa.fetchNextPage()}>
                Cargar más
              </Boton>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/** "Tomar el más antiguo": toma el que más lleva esperando y abre su detalle. */
function TomarElMasAntiguo({ masAntiguo }: { masAntiguo: { id: string; version: number } }) {
  const tomar = useTomar();
  const navegar = useNavigate();

  async function tomarlo() {
    try {
      await tomar.mutateAsync({ id: masAntiguo.id, version: masAntiguo.version });
      await navegar({ to: "/levantamientos/$id", params: { id: masAntiguo.id } });
    } catch {
      // El error queda a la vista; la bandeja se vuelve a leer sola.
    }
  }

  return (
    <>
      {tomar.isError && <Aviso tono="error">{mensajeDeError(tomar.error)}</Aviso>}
      <Boton variante="principal" cargando={tomar.isPending} onClick={() => void tomarlo()}>
        Tomar el más antiguo
        <ChevronRight aria-hidden size={18} />
      </Boton>
    </>
  );
}
