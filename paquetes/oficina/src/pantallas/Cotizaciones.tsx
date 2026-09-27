import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Aviso, Boton, CeldaTabla, Dialogo, EncabezadoPagina, EsqueletoTabla, EstadoVacio, FilaTabla, Insignia, Plus, Receipt, RefreshCw, Tabla } from "@teins/ui";
import { cliente } from "../api";
import { consultasDeCotizaciones, mensajeDeCotizacion, useAccionDeCotizacion } from "../cotizaciones";
import { pesos } from "../formato";

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));

/** Cotizaciones (iteración 21, ADR-0029): número, cliente, total de la versión vigente y su estado. */
export function Cotizaciones() {
  const consulta = useQuery(consultasDeCotizaciones.lista());
  const [creando, setCreando] = useState(false);

  return (
    <>
      <EncabezadoPagina
        titulo="Cotizaciones"
        acciones={
          <Boton variante="principal" icono={Plus} onClick={() => setCreando(true)}>
            Nueva cotización
          </Boton>
        }
      />
      {consulta.isPending ? (
        <EsqueletoTabla etiqueta="Cargando las cotizaciones" columnas={5} />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <p>No se pudieron cargar las cotizaciones.</p>
          <Boton className="mt-3" icono={RefreshCw} onClick={() => void consulta.refetch()}>
            Reintentar
          </Boton>
        </Aviso>
      ) : consulta.data.cotizaciones.length === 0 ? (
        <EstadoVacio icono={Receipt} titulo="Todavía no hay cotizaciones">
          Se crean con "Nueva cotización", desde una visita con levantamientos revisados: las líneas salen de sus cantidades.
        </EstadoVacio>
      ) : (
        <div className="flex flex-col gap-2">
          <Tabla etiqueta="Cotizaciones" columnas={[{ titulo: "Número" }, { titulo: "Cliente" }, { titulo: "Sitio y visita" }, { titulo: "Total", derecha: true }, { titulo: "Estado" }]}>
            {consulta.data.cotizaciones.map((c) => (
              <FilaTabla key={c.id} abrir>
                <CeldaTabla>
                  <Link
                    to="/cotizaciones/$id"
                    params={{ id: c.id }}
                    className="font-bold whitespace-nowrap text-superficie underline-offset-2 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie"
                  >
                    {c.numero}
                  </Link>
                </CeldaTabla>
                <CeldaTabla>{c.visita.cliente}</CeldaTabla>
                <CeldaTabla>
                  {c.visita.sitio} <span className="text-ayuda text-texto-secundario">{`· ${dia(c.visita.programadaPara)}`}</span>
                </CeldaTabla>
                <CeldaTabla derecha>{c.total === null ? <span className="text-texto-secundario">Borrador</span> : <strong className="tabular-nums">{pesos(c.total)}</strong>}</CeldaTabla>
                <CeldaTabla>
                  <span className="flex flex-wrap gap-1.5">
                    {c.vigente ? <Insignia tono="publicado">{`Versión ${c.vigente}`}</Insignia> : <Insignia tono="borrador">Borrador</Insignia>}
                    {c.envioSinEntregar && <Insignia tono="peligro">Envío sin entregar</Insignia>}
                  </span>
                </CeldaTabla>
              </FilaTabla>
            ))}
          </Tabla>
          <p className="text-ayuda text-texto-secundario">El total de un borrador se ve al abrirlo: todavía puede cambiar.</p>
        </div>
      )}
      {creando && <NuevaCotizacion alCerrar={() => setCreando(false)} />}
    </>
  );
}

/** Elegir la visita en la hoja lateral: las líneas salen de sus cantidades revisadas (ADR-0029, parte 2). */
function NuevaCotizacion({ alCerrar }: { alCerrar: () => void }) {
  const formulario = useId();
  const navegar = useNavigate();
  const visitas = useQuery(consultasDeCotizaciones.visitas());
  const [elegida, setElegida] = useState<string | null>(null);
  const [falta, setFalta] = useState(false);
  const crear = useAccionDeCotizacion((visitaId: string) => cliente.llamar("crearCotizacion", { cuerpo: { visitaId } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!elegida) return setFalta(true);
    try {
      const { id } = await crear.mutateAsync(elegida);
      alCerrar();
      await navegar({ to: "/cotizaciones/$id", params: { id } });
    } catch {
      // El error queda a la vista, en la hoja.
    }
  }

  return (
    <Dialogo
      forma="lateral"
      titulo="Nueva cotización"
      subtitulo="Desde las cantidades revisadas de una visita"
      cerrable={!crear.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={crear.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={crear.isPending} disabled={!visitas.data || visitas.data.visitas.length === 0}>
            Crear cotización
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {visitas.isPending ? (
          <p className="text-ayuda text-texto-secundario">Buscando las visitas con levantamientos revisados…</p>
        ) : visitas.isError ? (
          <Aviso tono="error">
            <p>No se pudieron cargar las visitas.</p>
            <Boton className="mt-3" icono={RefreshCw} onClick={() => void visitas.refetch()}>
              Reintentar
            </Boton>
          </Aviso>
        ) : visitas.data.visitas.length === 0 ? (
          <EstadoVacio icono={Receipt} titulo="Ninguna visita tiene cantidades revisadas">
            Cuando oficina marque revisado un levantamiento con materiales, su visita aparece aquí.
          </EstadoVacio>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-2 text-cuerpo font-bold">Visita</legend>
            {visitas.data.visitas.map((v) => (
              <label
                key={v.visitaId}
                className={`flex cursor-pointer gap-3 rounded-control border-[1.5px] px-4 py-3 has-checked:border-borde-activo has-checked:bg-superficie-suave has-focus-visible:outline-3 has-focus-visible:outline-superficie ${falta ? "border-error" : "border-borde-suave"}`}
              >
                <input
                  type="radio"
                  name={`${formulario}-visita`}
                  className="mt-1 size-5 shrink-0 accent-superficie"
                  checked={elegida === v.visitaId}
                  onChange={() => {
                    setElegida(v.visitaId);
                    setFalta(false);
                  }}
                />
                <span className="flex flex-col gap-0.5">
                  <strong>{`${v.cliente} · ${v.sitio}`}</strong>
                  <span className="text-ayuda text-texto-secundario">
                    {`Visita del ${dia(v.programadaPara)} · ${v.materiales} ${v.materiales === 1 ? "material" : "materiales"} de ${v.levantamientosRevisados} ${v.levantamientosRevisados === 1 ? "levantamiento revisado" : "levantamientos revisados"}`}
                    {v.cotizaciones.length > 0 ? ` · ya tiene la ${v.cotizaciones.join(", la ")}` : ""}
                  </span>
                  {v.sinPrecio > 0 && <span className="text-ayuda font-bold text-alerta-texto">{`${v.sinPrecio} sin precio en el catálogo`}</span>}
                </span>
              </label>
            ))}
            {falta && <p className="text-ayuda font-bold text-error">Elija la visita que va a cotizar.</p>}
          </fieldset>
        )}
        <p className="text-ayuda text-texto-secundario">Solo aparecen visitas con levantamientos revisados. Un levantamiento que falta revisar no entra: sus cantidades todavía pueden cambiar.</p>
        {crear.isError && <Aviso tono="error">{mensajeDeCotizacion(crear.error)}</Aviso>}
      </form>
    </Dialogo>
  );
}
