import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Aviso, Boton, Marquilla } from "@teins/ui";
import { consultas } from "../api";

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));

export function Informes() {
  const consulta = useQuery(consultas.informes());

  if (consulta.isPending) {
    return <div aria-busy="true" aria-label="Cargando informes" className="h-[240px] animate-pulse rounded-panel bg-panel" />;
  }
  if (consulta.isError) {
    return (
      <Aviso tono="error">
        <p>No se pudieron cargar los informes.</p>
        <Boton className="mt-3" onClick={() => void consulta.refetch()}>
          Reintentar
        </Boton>
      </Aviso>
    );
  }

  const informes = consulta.data.elementos;
  return (
    <section aria-labelledby="titulo-informes" className="flex flex-col gap-4 rounded-panel bg-panel p-6">
      <h1 id="titulo-informes" className="text-subtitulo font-extrabold">
        Informes
      </h1>
      {informes.length === 0 ? (
        <p className="text-cuerpo text-texto-secundario">
          Todavía no hay informes. Se abren desde un levantamiento revisado que pertenece a una visita: "Abrir el informe de esta visita".
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-cuerpo">
            <thead className="text-ayuda text-texto-secundario">
              <tr className="border-b border-division">
                <th scope="col" className="py-2 pr-4 font-normal">Cliente</th>
                <th scope="col" className="py-2 pr-4 font-normal">Sitio</th>
                <th scope="col" className="py-2 pr-4 font-normal">Visita</th>
                <th scope="col" className="py-2 font-normal">Estado</th>
              </tr>
            </thead>
            <tbody>
              {informes.map((i) => (
                <tr key={i.id} className="border-b border-division last:border-0">
                  <td className="py-1 pr-4">
                    <Link
                      to="/informes/$id"
                      params={{ id: i.id }}
                      className="inline-flex min-h-tactil items-center font-bold text-superficie underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
                    >
                      {i.visita.cliente}
                    </Link>
                  </td>
                  <td className="py-1 pr-4">{i.visita.sitio}</td>
                  <td className="py-1 pr-4">{dia(i.visita.programadaPara)}</td>
                  <td className="py-1">
                    {i.vigente ? <Marquilla tono="superficie">{`Versión ${i.vigente}`}</Marquilla> : <Marquilla tono="borrador">Borrador</Marquilla>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
