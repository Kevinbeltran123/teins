import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Aviso, BarraLista, Boton, Buscador, CeldaTabla, coincide, Dialogo, EncabezadoPagina, EsqueletoLista, EstadoVacio, FilaTabla, Insignia, Marcado, PieLista, Plus, Receipt, RefreshCw, SinResultados, Tabla } from "@teins/ui";
import { cliente } from "../api";
import { consultasDeCotizaciones, mensajeDeCotizacion, useAccionDeCotizacion } from "../cotizaciones";
import { aDiaCorto, pesos } from "../formato";

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`)).replace(",", "");

/** Cotizaciones (iteración 21, ADR-0029; prototipos/oficina): número, cliente, estado y total publicado, con buscador. */
export function Cotizaciones() {
  const consulta = useQuery(consultasDeCotizaciones.lista());
  const [creando, setCreando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const todas = consulta.data?.cotizaciones ?? [];
  const lista = todas.filter((c) => coincide(busqueda, c.numero, c.visita.cliente, c.visita.sitio));

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
      <BarraLista buscador={<Buscador etiqueta="Buscar cotizaciones" ejemplo="Buscar por número, cliente o sitio" valor={busqueda} onCambio={setBusqueda} />} />
      {consulta.isPending ? (
        <EsqueletoLista etiqueta="Cargando las cotizaciones" />
      ) : consulta.isError ? (
        <Aviso tono="error">
          <b>No se pudieron cargar las cotizaciones.</b>
          <div>
            <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          </div>
        </Aviso>
      ) : todas.length === 0 ? (
        <EstadoVacio icono={Receipt} titulo="Todavía no hay cotizaciones">
          Se crean con "Nueva cotización", desde una visita con levantamientos revisados: las líneas salen de sus cantidades.
        </EstadoVacio>
      ) : lista.length === 0 ? (
        <SinResultados texto={busqueda.trim()} onQuitar={() => setBusqueda("")} />
      ) : (
        <div>
          <Tabla etiqueta="Cotizaciones" columnas={[{ titulo: "Número" }, { titulo: "Cliente y visita" }, { titulo: "Estado" }, { titulo: "Total", derecha: true }]}>
            {lista.map((c, k) => (
              <FilaTabla key={c.id} abrir indice={k}>
                <CeldaTabla>
                  <Link to="/cotizaciones/$id" params={{ id: c.id }} className="enlace" style={{ whiteSpace: "nowrap" }}>
                    <Marcado texto={c.numero} busqueda={busqueda} />
                  </Link>
                </CeldaTabla>
                <CeldaTabla>
                  <span className="fuerte">
                    <Marcado texto={c.visita.cliente} busqueda={busqueda} />
                  </span>
                  <span className="sub">
                    <Marcado texto={c.visita.sitio} busqueda={busqueda} /> · {aDiaCorto(`${c.visita.programadaPara}T12:00:00-05:00`)}
                  </span>
                </CeldaTabla>
                <CeldaTabla>
                  <span className="fila-flex" style={{ gap: 6 }}>
                    {c.vigente ? <Insignia tono="publicado">{`Versión ${c.vigente}`}</Insignia> : <Insignia tono="borrador">Borrador</Insignia>}
                    {c.envioSinEntregar && <Insignia tono="peligro">Envío sin entregar</Insignia>}
                  </span>
                </CeldaTabla>
                <CeldaTabla derecha>{c.total === null ? <span className="sec fuerte" style={{ fontWeight: 700 }}>Borrador</span> : <span className="fuerte">{pesos(c.total)}</span>}</CeldaTabla>
              </FilaTabla>
            ))}
          </Tabla>
          <PieLista>El total de un borrador se ve al abrirlo: todavía puede cambiar.</PieLista>
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
      <form id={formulario} onSubmit={enviar} noValidate className="col" style={{ gap: 18 }}>
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
          <fieldset className="col" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
            <legend className="etq" style={{ marginBottom: 8 }}>
              Visita
            </legend>
            {visitas.data.visitas.map((v) => (
              <label key={v.visitaId} className="casilla" style={falta ? { boxShadow: "inset 0 0 0 2px var(--peligro)" } : undefined}>
                <input
                  type="radio"
                  name={`${formulario}-visita`}
                  checked={elegida === v.visitaId}
                  onChange={() => {
                    setElegida(v.visitaId);
                    setFalta(false);
                  }}
                />
                <span>
                  <b>{v.cliente}</b> · {v.sitio}
                  <span style={{ display: "block", color: "var(--sec)", fontSize: 13 }}>
                    {`Visita del ${dia(v.programadaPara)} · ${v.materiales} ${v.materiales === 1 ? "material" : "materiales"} de ${v.levantamientosRevisados} ${v.levantamientosRevisados === 1 ? "levantamiento revisado" : "levantamientos revisados"}`}
                    {v.cotizaciones.length > 0 ? ` · ya tiene la ${v.cotizaciones.join(", la ")}` : ""}
                  </span>
                  {v.sinPrecio > 0 && (
                    <span style={{ display: "inline-flex", marginTop: 6 }}>
                      <Insignia tono="alerta">{`${v.sinPrecio} sin precio en el catálogo`}</Insignia>
                    </span>
                  )}
                </span>
              </label>
            ))}
            {falta && <p className="msj-error">Elija la visita que va a cotizar.</p>}
          </fieldset>
        )}
        <p className="ayuda">Solo aparecen visitas con levantamientos revisados. Un levantamiento que falta revisar no entra: sus cantidades todavía pueden cambiar.</p>
        {crear.isError && <Aviso tono="error">{mensajeDeCotizacion(crear.error)}</Aviso>}
      </form>
    </Dialogo>
  );
}
