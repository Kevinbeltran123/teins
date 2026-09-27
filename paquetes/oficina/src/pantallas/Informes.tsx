import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Aviso, Boton, CeldaTabla, EncabezadoPagina, EsqueletoTabla, EstadoVacio, FilaTabla, FileText, Insignia, RefreshCw, Tabla } from "@teins/ui";
import { consultas } from "../api";

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));

export function Informes() {
  const consulta = useQuery(consultas.informes());

  return (
    <>
      <EncabezadoPagina titulo="Informes" />
      {consulta.isPending ? (
        <EsqueletoTabla etiqueta="Cargando informes" columnas={4} />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <p>No se pudieron cargar los informes.</p>
          <Boton className="mt-3" icono={RefreshCw} onClick={() => void consulta.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      ) : consulta.data.elementos.length === 0 ? (
        <EstadoVacio icono={FileText} titulo="Todavía no hay informes">
          Se abren desde una visita con levantamientos revisados: en Visitas, con "Abrir el informe", o desde el levantamiento revisado.
        </EstadoVacio>
      ) : (
        <Tabla etiqueta="Informes por visita" columnas={[{ titulo: "Cliente" }, { titulo: "Sitio" }, { titulo: "Visita" }, { titulo: "Estado" }]}>
          {consulta.data.elementos.map((i) => (
            <FilaTabla key={i.id} abrir>
              <CeldaTabla>
                <Link
                  to="/informes/$id"
                  params={{ id: i.id }}
                  className="font-bold text-superficie underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
                >
                  {i.visita.cliente}
                </Link>
              </CeldaTabla>
              <CeldaTabla>{i.visita.sitio}</CeldaTabla>
              <CeldaTabla>{dia(i.visita.programadaPara)}</CeldaTabla>
              <CeldaTabla>
                <span className="flex flex-wrap gap-1.5">
                  {i.vigente ? <Insignia tono="publicado">{`Versión ${i.vigente}`}</Insignia> : <Insignia tono="borrador">Borrador</Insignia>}
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
