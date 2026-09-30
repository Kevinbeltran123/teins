import { useId, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Respuesta } from "@teins/protocolo";
import {
  Aviso,
  BarraLista,
  Boton,
  Buscador,
  coincide,
  CuerpoTabla,
  EsqueletoLista,
  Marcado,
  SinResultados,
  CalendarDays,
  CampoSeleccion,
  CampoTexto,
  CampoTextoLargo,
  Casilla,
  CeldaTabla,
  Confirmacion,
  Dialogo,
  Download,
  EncabezadoPagina,
  EstadoVacio,
  FilaTabla,
  FileText,
  GrupoDeOpciones,
  MenuAcciones,
  Pencil,
  Pestanas,
  Plus,
  RefreshCw,
  Tabla,
  Users,
  useNotificar,
  enfocarPrimerError,
  Smartphone,
  TriangleAlert,
} from "@teins/ui";
import { cliente } from "../api";
import { csvDetalle, csvResumen, descargar } from "../csv";
import { aFechaHora } from "../formato";
import { useAbrirInformeDeVisita } from "../informes";
import { consultasDeProgramacion, hoyLocal, mensajeDeProgramacion, useAccionDeProgramacion, type Vista } from "../programacion";

type Visita = Respuesta<"listarVisitas">["visitas"][number];
type Tecnico = Respuesta<"listarTecnicos">["tecnicos"][number];

/** Motivos del lenguaje común (modelo de dominio): cotización, mantenimiento, modificación. */
const MOTIVOS = [
  { valor: "Mantenimiento", texto: "Mantenimiento" },
  { valor: "Cotización", texto: "Cotización" },
  { valor: "Modificación", texto: "Modificación" },
] as const;
type Motivo = (typeof MOTIVOS)[number]["valor"];
const motivoConocido = (m: string): Motivo => MOTIVOS.find((x) => x.valor === m)?.valor ?? "Mantenimiento";

/** "sáb, 26 sept"; con el año solo si no es el actual: en una agenda, el año casi nunca decide nada. */
const dia = (aaaaMmDd: string) =>
  new Intl.DateTimeFormat("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(aaaaMmDd.slice(0, 4) === hoyLocal().slice(0, 4) ? {} : { year: "numeric" }),
    timeZone: "UTC",
  }).format(new Date(`${aaaaMmDd}T00:00:00Z`));

/** Lo que oficina tiene que hacer con la visita: revisar lo recibido o armar el informe. */
function avance(v: Visita): string {
  const { enviados, enRevision, revisados } = v.levantamientos;
  const partes = [enviados && `${enviados} por revisar`, enRevision && `${enRevision} en revisión`, revisados && `${revisados} revisado${revisados === 1 ? "" : "s"}`].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "Sin levantamientos recibidos";
}

const VACIO: Record<Vista, { titulo: string; texto: string }> = {
  proximas: { titulo: "No hay visitas programadas desde hoy", texto: 'Programe la siguiente con "Programar visita".' },
  anteriores: { titulo: "Todavía no hay visitas anteriores", texto: "Aquí quedan las visitas cuya fecha ya pasó." },
  canceladas: { titulo: "No hay visitas canceladas", texto: "Aquí quedan las visitas canceladas, con quién y por qué." },
};

type Edicion = { tipo: "reasignar" | "reprogramar" | "cancelar" | "exportar"; v: Visita };

/** Encabezado de un día: "Hoy · sábado 27 de septiembre", "Lunes 29 de septiembre". */
function tituloDia(aaaaMmDd: string, hoy: string) {
  const largo = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", ...(aaaaMmDd.slice(0, 4) === hoy.slice(0, 4) ? {} : { year: "numeric" }), timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));
  const texto = largo.replace(",", "");
  return aaaaMmDd === hoy ? `Hoy · ${texto}` : texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Visitas (prototipos/oficina): agrupadas por día sobre el fondo, "Hoy" en amarillo, con buscador por cliente,
 * sitio o técnico (la lista llega completa, se busca aquí) y el avance de los levantamientos en una barra.
 */
export function Visitas() {
  const [vista, setVista] = useState<Vista>("proximas");
  const [busqueda, setBusqueda] = useState("");
  const [programando, setProgramando] = useState(false);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [recientes, setRecientes] = useState<string[]>([]);
  const notificar = useNotificar();
  const hoy = hoyLocal();
  const consulta = useQuery(consultasDeProgramacion.visitas(vista, hoy));
  const proximas = useQuery(consultasDeProgramacion.visitas("proximas", hoy));
  const destacar = (id: string) => setRecientes((r) => [id, ...r.filter((x) => x !== id)]);
  const cerrarEdicion = () => setEdicion(null);

  const todas = consulta.data?.visitas ?? [];
  const filtradas = todas.filter((v) => coincide(busqueda, v.cliente.nombre, v.sitio.nombre, v.sitio.direccion, ...v.tecnicos.map((t) => t.nombre)));
  // Por día, en el orden en que llegan (el servidor ya las ordena).
  const dias: { fecha: string; visitas: Visita[] }[] = [];
  for (const v of filtradas) {
    const clave = vista === "canceladas" ? "canceladas" : v.programadaPara;
    const grupo = dias.at(-1);
    if (grupo?.fecha === clave) grupo.visitas.push(v);
    else dias.push({ fecha: clave, visitas: [v] });
  }
  const deHoy = proximas.data?.visitas.filter((v) => v.programadaPara === hoy).length;
  const cantidadProximas = proximas.data?.visitas.length;
  let k = 0;

  return (
    <>
      <EncabezadoPagina
        titulo="Visitas"
        descripcion={
          cantidadProximas !== undefined && (
            <>
              <span>
                <b>{deHoy}</b> hoy
              </span>
              <span>
                <b>{cantidadProximas}</b> programadas desde hoy
              </span>
            </>
          )
        }
        acciones={
          <Boton variante="principal" icono={Plus} onClick={() => setProgramando(true)}>
            Programar visita
          </Boton>
        }
      />
      <BarraLista buscador={<Buscador etiqueta="Buscar visitas" ejemplo="Buscar por cliente, sitio o técnico" valor={busqueda} onCambio={setBusqueda} />}>
        <Pestanas
          etiqueta="Qué visitas ver"
          activa={vista}
          onCambio={setVista}
          pestanas={[
            { valor: "proximas", etiqueta: "Próximas", cantidad: cantidadProximas },
            { valor: "anteriores", etiqueta: "Anteriores" },
            { valor: "canceladas", etiqueta: "Canceladas" },
          ]}
        />
      </BarraLista>
      <div role="tabpanel" aria-label={{ proximas: "Próximas", anteriores: "Anteriores", canceladas: "Canceladas" }[vista]}>
        {consulta.isPending ? (
          <EsqueletoLista etiqueta="Cargando visitas" />
        ) : consulta.isError ? (
          <Aviso tono="error">
            <b>No se pudieron cargar las visitas.</b>
            <span className="sec">Puede ser la conexión o el servidor. Lo que ya estaba guardado no se perdió.</span>
            <div>
              <Boton tamano="pequeno" icono={RefreshCw} onClick={() => void consulta.refetch()}>
                Reintentar
              </Boton>
            </div>
          </Aviso>
        ) : todas.length === 0 ? (
          <EstadoVacio icono={CalendarDays} titulo={VACIO[vista].titulo}>
            {VACIO[vista].texto}
          </EstadoVacio>
        ) : filtradas.length === 0 ? (
          <SinResultados texto={busqueda.trim()} onQuitar={() => setBusqueda("")} />
        ) : (
          <Tabla
            etiqueta="Visitas"
            agrupada
            columnas={[
              { titulo: "Cliente y sitio" },
              { titulo: "Técnicos" },
              { titulo: "Motivo" },
              { titulo: vista === "canceladas" ? "Cancelación" : "Levantamientos" },
              { titulo: "Acciones", oculto: true, derecha: true },
            ]}
          >
            {dias.map((d) => (
              <CuerpoTabla key={d.fecha}>
                <tr>
                  <td colSpan={5} className={`dia ${d.fecha === hoy ? "hoy" : ""}`}>
                    {vista === "canceladas" ? "Canceladas" : tituloDia(d.fecha, hoy)}
                  </td>
                </tr>
                {d.visitas.map((v) => (
                  <FilaVisita key={v.id} visita={v} indice={k++} busqueda={busqueda} resaltada={recientes.includes(v.id)} editar={(tipo) => setEdicion({ tipo, v })} />
                ))}
              </CuerpoTabla>
            ))}
          </Tabla>
        )}
      </div>

      {programando && (
        <ProgramarVisita
          hoy={hoy}
          alCerrar={() => setProgramando(false)}
          alProgramar={(v) => {
            setProgramando(false);
            destacar(v.id);
            notificar({ texto: `Visita programada: ${v.cliente}, ${dia(v.programadaPara)}` });
          }}
        />
      )}
      {edicion?.tipo === "reasignar" && (
        <Reasignar
          v={edicion.v}
          alCerrar={cerrarEdicion}
          alGuardar={() => {
            cerrarEdicion();
            destacar(edicion.v.id);
            notificar({ texto: `Técnicos reasignados: ${edicion.v.cliente.nombre}` });
          }}
        />
      )}
      {edicion?.tipo === "reprogramar" && (
        <Reprogramar
          v={edicion.v}
          alCerrar={cerrarEdicion}
          alGuardar={(fecha) => {
            cerrarEdicion();
            destacar(edicion.v.id);
            notificar({ texto: `Visita reprogramada: ${edicion.v.cliente.nombre}, ${dia(fecha)}` });
          }}
        />
      )}
      {edicion?.tipo === "cancelar" && <Cancelar v={edicion.v} alCerrar={cerrarEdicion} alCancelar={() => notificar({ texto: `Visita cancelada: ${edicion.v.cliente.nombre}` })} />}
      {edicion?.tipo === "exportar" && <ExportarCantidades v={edicion.v} alCerrar={cerrarEdicion} />}
    </>
  );
}

/** El avance de los levantamientos: una barra con el color de cada estado y el texto. */
function Avance({ v }: { v: Visita }) {
  const { enviados, enRevision, revisados } = v.levantamientos;
  if (enviados + enRevision + revisados === 0) return <span className="sec">Sin levantamientos recibidos</span>;
  return (
    <div className="col" style={{ gap: 6 }}>
      <span className="avance" aria-hidden>
        {enviados > 0 && <i className="a1" style={{ flex: enviados }} />}
        {enRevision > 0 && <i className="a2" style={{ flex: enRevision }} />}
        {revisados > 0 && <i className="a3" style={{ flex: revisados }} />}
      </span>
      <span style={{ fontSize: 13 }}>{avance(v)}</span>
    </div>
  );
}

function FilaVisita({ visita: v, indice, busqueda, resaltada, editar }: { visita: Visita; indice: number; busqueda: string; resaltada: boolean; editar: (tipo: Edicion["tipo"]) => void }) {
  return (
    <FilaTabla resaltada={resaltada} indice={indice}>
      <CeldaTabla>
        <span className="fuerte">
          <Marcado texto={v.cliente.nombre} busqueda={busqueda} />
        </span>
        <span className="sub">
          <Marcado texto={`${v.sitio.nombre} · ${v.sitio.direccion}`} busqueda={busqueda} />
        </span>
      </CeldaTabla>
      <CeldaTabla>
        <Marcado texto={v.tecnicos.map((t) => t.nombre).join(", ")} busqueda={busqueda} />
      </CeldaTabla>
      <CeldaTabla clase="sec">{v.motivo}</CeldaTabla>
      <CeldaTabla>
        {v.cancelada ? (
          <span style={{ fontSize: 13 }}>
            {`${aFechaHora(v.cancelada.en)} por ${v.cancelada.por.nombre}: `}
            <span className="sec">{v.cancelada.motivo}</span>
          </span>
        ) : (
          <Avance v={v} />
        )}
      </CeldaTabla>
      <CeldaTabla derecha>
        {!v.cancelada && (
          <div className="fila-flex" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
            {v.levantamientos.revisados > 0 && <AbrirInforme visitaId={v.id} cliente={v.cliente.nombre} />}
            <MenuAcciones
              etiqueta={`Más acciones para la visita de ${v.cliente.nombre}`}
              opciones={[
                { texto: "Reasignar técnicos", icono: Users, alElegir: () => editar("reasignar") },
                { texto: "Reprogramar", icono: Pencil, alElegir: () => editar("reprogramar") },
                { texto: "Exportar cantidades", icono: Download, alElegir: () => editar("exportar") },
                { texto: "Cancelar visita", peligro: true, alElegir: () => editar("cancelar") },
              ]}
            />
          </div>
        )}
      </CeldaTabla>
    </FilaTabla>
  );
}

function AbrirInforme({ visitaId, cliente: nombre }: { visitaId: string; cliente: string }) {
  const abrir = useAbrirInformeDeVisita();
  const navegar = useNavigate();
  return (
    <Boton
      variante="fantasma"
      tamano="pequeno"
      icono={FileText}
      aria-label={`Abrir el informe de ${nombre}`}
      cargando={abrir.isPending}
      onClick={() => abrir.mutate(visitaId, { onSuccess: ({ id }) => void navegar({ to: "/informes/$id", params: { id } }) })}
    >
      Abrir el informe
    </Boton>
  );
}

// Programar -------------------------------------------------------------------------------------

function ElegirTecnicos({ tecnicos, elegidos, onCambio, error }: { tecnicos: Tecnico[]; elegidos: string[]; onCambio: (ids: string[]) => void; error?: string | undefined }) {
  if (tecnicos.length === 0) return <Aviso tono="alerta">No hay técnicos activos. Quien administra los crea en Administración.</Aviso>;
  return (
    <fieldset className="casillas-filas flex flex-col gap-1">
      <legend className="mb-1.5 text-cuerpo font-medium">Técnicos</legend>
      <div className="flex flex-col">
        {tecnicos.map((t) => (
          <Casilla key={t.id} marcada={elegidos.includes(t.id)} onCambio={(m) => onCambio(m ? [...elegidos, t.id] : elegidos.filter((x) => x !== t.id))}>
            {t.nombre}
          </Casilla>
        ))}
      </div>
      {error && <p className="text-ayuda font-bold text-error">{error}</p>}
    </fieldset>
  );
}

function ProgramarVisita({ hoy, alCerrar, alProgramar }: { hoy: string; alCerrar: () => void; alProgramar: (v: { id: string; cliente: string; programadaPara: string }) => void }) {
  const formulario = useId();
  const clientes = useQuery(consultasDeProgramacion.clientes());
  const tecnicos = useQuery(consultasDeProgramacion.tecnicos());
  const [clienteId, setClienteId] = useState("");
  const [sitioId, setSitioId] = useState("");
  const [motivo, setMotivo] = useState<Motivo>("Mantenimiento");
  const [fecha, setFecha] = useState(hoy);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [errores, setErrores] = useState<{ cliente?: string; sitio?: string; fecha?: string; tecnicos?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const programar = useAccionDeProgramacion(() => cliente.llamar("programarVisita", { cuerpo: { clienteId, sitioId, motivo, programadaPara: fecha, tecnicos: elegidos } }));

  const lista = clientes.data?.clientes ?? [];
  const sitios = lista.find((c) => c.id === clienteId)?.sitios ?? [];

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const faltan = {
      ...(!clienteId ? { cliente: "Elija el cliente." } : {}),
      ...(clienteId && !sitioId ? { sitio: "Elija el sitio." } : {}),
      ...(!fecha ? { fecha: "Elija la fecha." } : fecha < hoy ? { fecha: "Elija hoy o una fecha próxima." } : {}),
      ...(elegidos.length === 0 ? { tecnicos: "Asigne al menos un técnico." } : {}),
    };
    setErrores(faltan);
    if (Object.keys(faltan).length > 0) enfocarPrimerError(formulario);
    if (Object.keys(faltan).length > 0) return;
    setError(null);
    try {
      const v = await programar.mutateAsync(undefined);
      alProgramar({ id: v.id, cliente: lista.find((c) => c.id === clienteId)?.nombre ?? "", programadaPara: fecha });
    } catch (e) {
      setError(mensajeDeProgramacion(e));
    }
  }

  let contenido;
  if (clientes.isPending || tecnicos.isPending) contenido = <div aria-busy="true" aria-label="Preparando el formulario" className="h-64 rounded-panel bg-fondo motion-safe:animate-pulse" />;
  else if (clientes.isError || tecnicos.isError) {
    contenido = (
      <Aviso tono="error">
        <p>No se pudieron cargar los clientes o los técnicos.</p>
        <Boton className="mt-3" icono={RefreshCw} onClick={() => void Promise.all([clientes.refetch(), tecnicos.refetch()])}>
          Reintentar
        </Boton>
      </Aviso>
    );
  } else if (lista.length === 0) {
    contenido = (
      <Aviso tono="info">
        Todavía no hay clientes.{" "}
        <Link to="/clientes" className="font-bold text-superficie underline">
          Cree el cliente con su sitio
        </Link>{" "}
        y vuelva a programar.
      </Aviso>
    );
  } else {
    contenido = (
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <CampoSeleccion
          etiqueta="Cliente"
          vacio="Elija un cliente"
          valor={clienteId}
          error={errores.cliente}
          onCambio={(id) => {
            setClienteId(id);
            // Con un solo sitio, queda elegido.
            const deEse = lista.find((c) => c.id === id)?.sitios ?? [];
            setSitioId(deEse.length === 1 ? deEse[0]!.id : "");
          }}
          opciones={lista.map((c) => ({ valor: c.id, texto: c.nombre }))}
        />
        <CampoSeleccion
          etiqueta="Sitio"
          vacio={clienteId ? "Elija un sitio" : "Primero elija el cliente"}
          valor={sitioId}
          error={errores.sitio}
          onCambio={setSitioId}
          deshabilitado={!clienteId}
          opciones={sitios.map((s) => ({ valor: s.id, texto: `${s.nombre} · ${s.direccion}` }))}
        />
        <CampoTexto etiqueta="Fecha" tipo="date" minimo={hoy} nombre="fecha" valorInicial={hoy} onCambio={setFecha} error={errores.fecha} />
        <div className="opciones-pastilla">
          <GrupoDeOpciones etiqueta="Motivo" valor={motivo} onCambio={setMotivo} opciones={MOTIVOS} />
        </div>
        <ElegirTecnicos tecnicos={tecnicos.data.tecnicos} elegidos={elegidos} onCambio={setElegidos} error={errores.tecnicos} />
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    );
  }

  return (
    <Dialogo
      forma="lateral"
      titulo="Programar visita"
      cerrable={!programar.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={programar.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={programar.isPending} disabled={lista.length === 0}>
            Programar la visita
          </Boton>
        </>
      }
    >
      {contenido}
    </Dialogo>
  );
}

// Una visita -------------------------------------------------------------------------------------

const deLaVisita = (v: Visita) => `${v.cliente.nombre} · ${dia(v.programadaPara)}`;

function Reasignar({ v, alCerrar, alGuardar }: { v: Visita; alCerrar: () => void; alGuardar: () => void }) {
  const formulario = useId();
  const tecnicos = useQuery(consultasDeProgramacion.tecnicos());
  const [elegidos, setElegidos] = useState(v.tecnicos.map((t) => t.id));
  const [errorCampo, setErrorCampo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const accion = useAccionDeProgramacion(() => cliente.llamar("reasignarVisita", { parametros: { id: v.id }, cuerpo: { version: v.version, tecnicos: elegidos } }));

  // Lo que cambia, antes de guardarlo (iteración 24c): quién deja de ver la visita y quién la recibe.
  const nombreDe = (id: string) => tecnicos.data?.tecnicos.find((t) => t.id === id)?.nombre ?? v.tecnicos.find((t) => t.id === id)?.nombre ?? "Un técnico";
  const antes = v.tecnicos.map((t) => t.id);
  const salen = antes.filter((id) => !elegidos.includes(id)).map(nombreDe);
  const entran = elegidos.filter((id) => !antes.includes(id)).map(nombreDe);
  const lista = (nombres: string[]) => (nombres.length === 1 ? nombres[0]! : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`);
  const verbo = entran.length > 0 ? `Reasignar a ${lista(entran)}` : salen.length > 0 ? `Quitar a ${lista(salen)}` : "Guardar técnicos";

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (elegidos.length === 0) return setErrorCampo("Asigne al menos un técnico.");
    setErrorCampo(undefined);
    setError(null);
    try {
      await accion.mutateAsync(undefined);
      alGuardar();
    } catch (e) {
      // Tras un conflicto la lista ya se volvió a leer: el diálogo sigue abierto y reintenta con la versión nueva.
      setError(mensajeDeProgramacion(e));
    }
  }

  return (
    <Dialogo
      titulo="Reasignar técnicos"
      subtitulo={deLaVisita(v)}
      cerrable={!accion.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={accion.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={accion.isPending} disabled={salen.length + entran.length === 0}>
            {verbo}
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4">
        {tecnicos.isPending ? (
          <div aria-busy="true" aria-label="Cargando técnicos" className="h-24 rounded-panel bg-fondo motion-safe:animate-pulse" />
        ) : tecnicos.isError ? (
          <Aviso tono="error">No se pudieron cargar los técnicos.</Aviso>
        ) : (
          <ElegirTecnicos tecnicos={tecnicos.data.tecnicos} elegidos={elegidos} onCambio={setElegidos} error={errorCampo} />
        )}
        {elegidos.length > 0 && salen.length + entran.length > 0 && (
          <ul aria-label="Lo que cambia" className="flex flex-col gap-1.5 rounded-control bg-panel-hundido px-3 py-2.5 text-ayuda">
            {salen.map((n) => (
              <li key={`sale-${n}`}>
                <b className="font-medium">{n}</b> deja de verla en su teléfono. Lo que ya empezó se conserva y lo puede enviar.
              </li>
            ))}
            {entran.map((n) => (
              <li key={`entra-${n}`}>
                <b className="font-medium">{n}</b> la recibe en su teléfono.
              </li>
            ))}
          </ul>
        )}
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Dialogo>
  );
}

function Reprogramar({ v, alCerrar, alGuardar }: { v: Visita; alCerrar: () => void; alGuardar: (fecha: string) => void }) {
  const formulario = useId();
  const [fecha, setFecha] = useState(v.programadaPara);
  const [motivo, setMotivo] = useState<Motivo>(motivoConocido(v.motivo));
  const [errorFecha, setErrorFecha] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const accion = useAccionDeProgramacion(() => cliente.llamar("reprogramarVisita", { parametros: { id: v.id }, cuerpo: { version: v.version, programadaPara: fecha, motivo } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!fecha) return setErrorFecha("Elija la fecha.");
    if (fecha < hoyLocal()) return setErrorFecha("Elija hoy o una fecha próxima.");
    setErrorFecha(undefined);
    setError(null);
    try {
      await accion.mutateAsync(undefined);
      alGuardar(fecha);
    } catch (e) {
      setError(mensajeDeProgramacion(e));
    }
  }

  return (
    <Dialogo
      titulo="Reprogramar visita"
      subtitulo={deLaVisita(v)}
      cerrable={!accion.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={accion.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={accion.isPending}>
            Reprogramar la visita
          </Boton>
        </>
      }
    >
      <form id={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <div className="max-w-xs">
          <CampoTexto etiqueta="Fecha nueva" tipo="date" minimo={hoyLocal()} valorInicial={v.programadaPara} onCambio={setFecha} error={errorFecha} />
        </div>
        <div className="opciones-pastilla">
          <GrupoDeOpciones etiqueta="Motivo" valor={motivo} onCambio={setMotivo} opciones={MOTIVOS} />
        </div>
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Dialogo>
  );
}

function Cancelar({ v, alCerrar, alCancelar }: { v: Visita; alCerrar: () => void; alCancelar: () => void }) {
  const [motivo, setMotivo] = useState("");
  const accion = useAccionDeProgramacion(() => cliente.llamar("cancelarVisita", { parametros: { id: v.id }, cuerpo: { version: v.version, motivo: motivo.trim() } }));
  return (
    <Confirmacion
      titulo={`¿Cancelar la visita a ${v.cliente.nombre}?`}
      confirmar="Cancelar visita"
      descartar="Volver"
      nivel="irreversible"
      validar={() => (motivo.trim() === "" ? "Escriba por qué se cancela: queda en el registro." : null)}
      mensajeDeError={mensajeDeProgramacion}
      accion={() => accion.mutateAsync(undefined)}
      alCerrar={alCerrar}
      alTerminar={alCancelar}
      consecuencias={[
        {
          icono: Smartphone,
          texto: `La visita del ${dia(v.programadaPara)} sale del teléfono de ${v.tecnicos.map((t) => t.nombre).join(" y ") || "sus técnicos"}`,
          detalle: "Lo que ya empezaron se conserva y lo pueden enviar",
        },
        { icono: TriangleAlert, texto: "No se puede deshacer", detalle: "Si hace falta, programe otra visita" },
      ]}
    >
      <CampoTextoLargo etiqueta="Motivo de la cancelación" valor={motivo} onCambio={setMotivo} maximo={500} />
    </Confirmacion>
  );
}

const paraArchivo = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Cantidades de la visita en CSV para Excel (iteración 11): el detalle de cada línea y el resumen sumado
 * por ítem del catálogo. Se leen al abrir, así el archivo trae lo último que corrigió oficina.
 */
function ExportarCantidades({ v, alCerrar }: { v: Visita; alCerrar: () => void }) {
  const consulta = useQuery({ queryKey: ["cantidades", v.id], queryFn: () => cliente.llamar("cantidadesDeVisita", { parametros: { id: v.id } }), staleTime: 0 });
  const nombre = `cantidades-${paraArchivo(v.cliente.nombre)}-${v.programadaPara}`;

  let contenido;
  if (consulta.isPending) contenido = <div aria-busy="true" aria-label="Cargando las cantidades" className="h-16 rounded-panel bg-fondo motion-safe:animate-pulse" />;
  else if (consulta.isError) {
    contenido = (
      <Aviso tono="error">
        <p>No se pudieron cargar las cantidades de la visita.</p>
        <Boton className="mt-3" icono={RefreshCw} onClick={() => void consulta.refetch()}>
          Reintentar
        </Boton>
      </Aviso>
    );
  } else if (consulta.data.lineas.length === 0) {
    contenido = <p className="text-cuerpo text-texto-secundario">Los levantamientos recibidos de esta visita no tienen líneas de cantidad.</p>;
  } else {
    const { lineas } = consulta.data;
    const levantamientos = new Set(lineas.map((l) => l.levantamientoId)).size;
    const sinVincular = lineas.filter((l) => !l.item).length;
    const porRevisar = lineas.some((l) => l.estado !== "revisado");
    contenido = (
      <>
        <p className="text-cuerpo">
          {`${lineas.length} ${lineas.length === 1 ? "línea" : "líneas"} de ${levantamientos} ${levantamientos === 1 ? "levantamiento" : "levantamientos"}`}
          {sinVincular > 0 && ` · ${sinVincular} sin vincular al catálogo`}
        </p>
        {porRevisar && <Aviso tono="alerta">Hay levantamientos sin revisar: sus cantidades todavía pueden cambiar.</Aviso>}
        <div className="flex flex-wrap gap-2">
          <Boton variante="principal" icono={Download} onClick={() => descargar(`${nombre}-detalle.csv`, csvDetalle(consulta.data))}>
            Descargar el detalle (CSV)
          </Boton>
          <Boton icono={Download} onClick={() => descargar(`${nombre}-resumen.csv`, csvResumen(consulta.data))}>
            Descargar el resumen (CSV)
          </Boton>
        </div>
      </>
    );
  }

  return (
    <Dialogo titulo="Exportar cantidades" subtitulo={deLaVisita(v)} alCerrar={alCerrar}>
      {contenido}
    </Dialogo>
  );
}
