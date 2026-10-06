import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Aviso, BarraLista, Boton, Buscador, CeldaTabla, coincide, EncabezadoPagina, EsqueletoLista, EstadoVacio, FilaTabla, FileText, Insignia, Marcado, RefreshCw, SinResultados, Tabla } from "@teins/ui";
import { consultas } from "../api";
import { aDiaCorto } from "../formato";
import { useBusquedaRecordada } from "../preferencias";

/**
 * Informes (prototipos/oficina): una lista corta con el estado como insignia y un buscador por cliente o sitio,
 * porque crece con cada visita. El servidor la entrega completa: se busca aquí.
 */
export function Informes() {
  const consulta = useQuery(consultas.informes());
  const [busqueda, setBusqueda] = useBusquedaRecordada("informes");
  const elementos = consulta.data?.elementos ?? [];
  const lista = elementos.filter((i) => coincide(busqueda, i.visita.cliente, i.visita.sitio));
  const borradores = elementos.filter((i) => !i.vigente && !i.todasRetiradas).length;
  const sinEntregar = elementos.filter((i) => i.envioSinEntregar).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Informes"
        descripcion={
          consulta.data && elementos.length > 0 ? (
            <>
              <span>
                <b>{borradores}</b> {borradores === 1 ? "borrador" : "borradores"}
              </span>
              {sinEntregar > 0 && (
                <span>
                  <b>{sinEntregar}</b> {sinEntregar === 1 ? "envío sin entregar" : "envíos sin entregar"}
                </span>
              )}
            </>
          ) : undefined
        }
      />
      <BarraLista buscador={<Buscador etiqueta="Buscar informes" ejemplo="Buscar por cliente o sitio" valor={busqueda} onCambio={setBusqueda} />} />
      {consulta.isPending ? (
        <EsqueletoLista etiqueta="Cargando informes" />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <b>No se pudieron cargar los informes.</b>
          <div>
            <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          </div>
        </Aviso>
      ) : elementos.length === 0 ? (
        <EstadoVacio icono={FileText} titulo="Todavía no hay informes">
          Se abren desde una visita con levantamientos revisados: en Visitas, con "Abrir el informe", o desde el levantamiento revisado.
        </EstadoVacio>
      ) : lista.length === 0 ? (
        <SinResultados texto={busqueda.trim()} onQuitar={() => setBusqueda("")} />
      ) : (
        <Tabla etiqueta="Informes por visita" columnas={[{ titulo: "Cliente y sitio" }, { titulo: "Visita" }, { titulo: "Estado" }]}>
          {lista.map((i, k) => (
            <FilaTabla key={i.id} abrir clave={i.id}>
              <CeldaTabla>
                <Link to="/informes/$id" params={{ id: i.id }} className="enlace">
                  <Marcado texto={i.visita.cliente} busqueda={busqueda} />
                </Link>
                <span className="sub">
                  <Marcado texto={i.visita.sitio} busqueda={busqueda} />
                </span>
              </CeldaTabla>
              <CeldaTabla>{aDiaCorto(`${i.visita.programadaPara}T12:00:00-05:00`)}</CeldaTabla>
              <CeldaTabla>
                <span className="fila-flex" style={{ gap: 6 }}>
                  {i.vigente ? <Insignia tono="publicado">{`Versión ${i.vigente}`}</Insignia> : i.todasRetiradas ? <Insignia tono="anulado">Retirado del portal</Insignia> : <Insignia tono="borrador">Borrador</Insignia>}
                  {/* Hasta que se vuelva a enviar (ADR-0028): lo que no llegó no se pierde de vista. */}
                  {i.envioSinEntregar && <Insignia tono="peligro">Envío sin entregar</Insignia>}
                </span>
              </CeldaTabla>
            </FilaTabla>
          ))}
        </Tabla>
      )}
    </>
  );
}
