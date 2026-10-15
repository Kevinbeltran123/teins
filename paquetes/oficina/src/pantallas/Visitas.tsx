import { useEffect, useId, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ErrorApi, type Respuesta } from "@teins/protocolo";
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
  Insignia,
  Confirmacion,
  conTransicion,
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
  useMinuto,
} from "@teins/ui";
import { cliente } from "../api";
import { csvDetalle, csvResumen, descargar } from "../csv";
import { aFechaHora } from "../formato";
import { useAbrirInformeDeVisita } from "../informes";
import { sinError } from "../mensajes";
import { cambiosAlReasignar, consultasDeProgramacion, hoyLocal, mensajeDeProgramacion, useAccionDeProgramacion, type Vista } from "../programacion";
import { enCurso, hora12, horarioTexto, ordenDelDia, type Horario } from "../horario";
import { unoDe, useBusquedaRecordada, usePreferencia } from "../preferencias";
import { enLista } from "./Envios";
import { CuandoVisita, resumenDeHorario, TecnicosDisponibles } from "./HorarioDeVisita";

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
  // Abierta toda la noche, «Hoy» y «En curso» siguen al reloj (iteración 41).
  useMinuto();
  // Dónde quedó la persona (prototipos/usabilidad-oficina): la pestaña, en el equipo; la búsqueda, mientras dure la pestaña.
  const [vista, setVista] = usePreferencia<Vista>("visitas-pestana", "proximas", unoDe("proximas", "anteriores", "canceladas"));
  const [busqueda, setBusqueda] = useBusquedaRecordada("visitas");
  const [programando, setProgramando] = useState(false);
  // «Programar visita» desde la búsqueda (⌘K / Ctrl + K) llega con el formulario abierto.
  const pedido = useLocation({ select: (l) => l.state.abrir });
  useEffect(() => {
    if (pedido === "programar") setProgramando(true);
  }, [pedido]);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [recientes, setRecientes] = useState<string[]>([]);
  const notificar = useNotificar();
  const hoy = hoyLocal();
  const consulta = useQuery(consultasDeProgramacion.visitas(vista, hoy));
  const proximas = useQuery(consultasDeProgramacion.visitas("proximas", hoy));
  // Los técnicos activos: un asignado que ya no lo está se marca en la fila (nadie más la ve en su teléfono).
  const tecnicos = useQuery(consultasDeProgramacion.tecnicos());
  const activos = tecnicos.data && new Set(tecnicos.data.tecnicos.map((t) => t.id));
  const consultas = useQueryClient();
  const destacar = (id: string) => setRecientes((r) => [id, ...r.filter((x) => x !== id)]);
  const cerrarEdicion = () => setEdicion(null);
  /** Lo destacado queda en la pestaña donde quedó la visita: si es otra, se cambia a ella (con lo nuevo ya leído). */
  const mostrarEn = (destino: Vista, id: string) =>
    void conTransicion(async () => {
      if (destino !== vista) await consultas.fetchQuery(consultasDeProgramacion.visitas(destino, hoy)).catch(() => undefined);
      setVista(destino);
      setBusqueda("");
      destacar(id);
    });

  const todas = consulta.data?.visitas ?? [];
  const filtradas = todas.filter((v) => coincide(busqueda, v.cliente.nombre, v.sitio.nombre, v.sitio.direccion, ...v.tecnicos.map((t) => t.nombre)));
  // Por día, en el orden en que llegan (el servidor ya las ordena).
  const dias: { fecha: string; visitas: Visita[] }[] = [];
  // Dentro de cada día, por hora de inicio; las de todo el día al final (ADR-0037). El orden de los días lo da el servidor.
  const enOrden = vista === "canceladas" ? filtradas : [...filtradas].sort((a, b) => (a.programadaPara === b.programadaPara ? ordenDelDia(a, b) : 0));
  for (const v of enOrden) {
    const clave = vista === "canceladas" ? "canceladas" : v.programadaPara;
    const grupo = dias.at(-1);
    if (grupo?.fecha === clave) grupo.visitas.push(v);
    else dias.push({ fecha: clave, visitas: [v] });
  }
  const deHoy = proximas.data?.visitas.filter((v) => v.programadaPara === hoy).length;
  const cantidadProximas = proximas.data?.visitas.length;
  /**
   * Tras un conflicto la lista ya se volvió a leer: el diálogo sigue abierto con la visita vigente y el reintento va sobre
   * su versión nueva (la persona ya vio el aviso). Antes, sigue con la que abrió: un cambio ajeno no se pisa sin avisar.
   */
  const releer = () =>
    setEdicion((e) => {
      if (!e) return e;
      const leidas = consultas.getQueriesData<Respuesta<"listarVisitas">>({ queryKey: ["programacion", "visitas"] }).flatMap(([, d]) => d?.visitas ?? []);
      const vigente = leidas.filter((x) => x.id === e.v.id).sort((a, b) => b.version - a.version)[0];
      return vigente && vigente.version > e.v.version ? { ...e, v: vigente } : e;
    });

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
              { titulo: "Hora" },
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
                  <td colSpan={6} className={`dia ${d.fecha === hoy ? "hoy" : ""}`}>
                    {vista === "canceladas" ? "Canceladas" : tituloDia(d.fecha, hoy)}
                  </td>
                </tr>
                {d.visitas.map((v) => (
                  <FilaVisita key={v.id} visita={v} hoy={hoy} busqueda={busqueda} resaltada={recientes.includes(v.id)} activos={activos} editar={(tipo) => setEdicion({ tipo, v })} />
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
            if (vista === "proximas") destacar(v.id);
            else mostrarEn("proximas", v.id);
            notificar({ texto: `Visita programada: ${v.cliente}, ${dia(v.programadaPara)}${v.horaInicio ? `, ${hora12(v.horaInicio)}` : ""}`, accion: { texto: "Programar otra", alHacer: () => setProgramando(true) } });
          }}
        />
      )}
      {edicion?.tipo === "reasignar" && (
        <Reasignar
          v={edicion.v}
          releer={releer}
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
          releer={releer}
          alCerrar={cerrarEdicion}
          alGuardar={(fecha) => {
            cerrarEdicion();
            destacar(edicion.v.id);
            notificar({ texto: `Visita reprogramada: ${edicion.v.cliente.nombre}, ${dia(fecha)}` });
          }}
        />
      )}
      {edicion?.tipo === "cancelar" && (
        <Cancelar
          v={edicion.v}
          releer={releer}
          alCerrar={cerrarEdicion}
          alCancelar={() => {
            const id = edicion.v.id;
            notificar({ texto: `Visita cancelada: ${edicion.v.cliente.nombre}`, accion: { texto: "Ver en Canceladas", alHacer: () => mostrarEn("canceladas", id) } });
          }}
        />
      )}
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

function FilaVisita({
  visita: v,
  hoy,
  busqueda,
  resaltada,
  activos,
  editar,
}: {
  visita: Visita;
  hoy: string;
  busqueda: string;
  resaltada: boolean;
  activos: ReadonlySet<string> | undefined;
  editar: (tipo: Edicion["tipo"]) => void;
}) {
  const { hora, detalle } = horarioTexto(v);
  // Un técnico desactivado ya no la ve en su teléfono: en una visita por hacer se dice, y si no queda nadie, nadie la hará.
  const inactivos = activos && !v.cancelada && v.programadaPara >= hoy ? v.tecnicos.filter((t) => !activos.has(t.id)) : [];
  return (
    <FilaTabla resaltada={resaltada} clave={v.id}>
      <CeldaTabla>
        <span className="hora-visita">
          {hora}
          {!v.cancelada && enCurso(v, hoy) ? (
            <span className="en-curso">
              <i aria-hidden />
              En curso
            </span>
          ) : (
            detalle && <small>{detalle}</small>
          )}
        </span>
      </CeldaTabla>
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
        {inactivos.length > 0 && (
          <span className="sub">
            {inactivos.length === v.tecnicos.length && <Insignia tono="alerta">Nadie la hará</Insignia>}{" "}
            {`${enLista(inactivos.map((t) => t.nombre))} ya no ${inactivos.length === 1 ? "está activo" : "están activos"}`}
          </span>
        )}
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

function ProgramarVisita({ hoy, alCerrar, alProgramar }: { hoy: string; alCerrar: () => void; alProgramar: (v: { id: string; cliente: string; programadaPara: string; horaInicio: string | null }) => void }) {
  const formulario = useId();
  const clientes = useQuery(consultasDeProgramacion.clientes());
  const tecnicos = useQuery(consultasDeProgramacion.tecnicos());
  const [clienteId, setClienteId] = useState("");
  const [sitioId, setSitioId] = useState("");
  const [motivo, setMotivo] = useState<Motivo>("Mantenimiento");
  const [fecha, setFecha] = useState(hoy);
  // Por omisión, de 9 a 11: lo más común; "Todo el día" y "No sé cuánto dura" están a un toque.
  const [horario, setHorario] = useState<Horario>({ horaInicio: "09:00", horaFin: "11:00" });
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [errores, setErrores] = useState<{ cliente?: string; sitio?: string; tecnicos?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const programar = useAccionDeProgramacion(() => cliente.llamar("programarVisita", { cuerpo: { clienteId, sitioId, motivo, programadaPara: fecha, ...horario, tecnicos: elegidos } }));

  const lista = clientes.data?.clientes ?? [];
  const sitios = lista.find((c) => c.id === clienteId)?.sitios ?? [];
  const nombres = (tecnicos.data?.tecnicos ?? []).filter((t) => elegidos.includes(t.id)).map((t) => t.nombre);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const faltan = {
      ...(!clienteId ? { cliente: "Elija el cliente." } : {}),
      ...(clienteId && !sitioId ? { sitio: "Elija el sitio." } : {}),
      ...(elegidos.length === 0 ? { tecnicos: "Elija al menos un técnico libre." } : {}),
    };
    setErrores(faltan);
    if (Object.keys(faltan).length > 0) enfocarPrimerError(formulario);
    if (Object.keys(faltan).length > 0) return;
    setError(null);
    try {
      const v = await programar.mutateAsync(undefined);
      alProgramar({ id: v.id, cliente: lista.find((c) => c.id === clienteId)?.nombre ?? "", programadaPara: fecha, horaInicio: horario.horaInicio });
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
      <form id={formulario} onSubmit={enviar} noValidate className="dos-col">
        <div className="col-f">
          <div className="fila-campos">
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
                // El sitio era del cliente anterior: su error tampoco describe lo que hay.
                setErrores((e) => sinError(e, "cliente", "sitio"));
              }}
              opciones={lista.map((c) => ({ valor: c.id, texto: c.nombre }))}
            />
            <CampoSeleccion
              etiqueta="Sitio"
              vacio={clienteId ? "Elija un sitio" : "Primero el cliente"}
              valor={sitioId}
              error={errores.sitio}
              onCambio={(id) => (setSitioId(id), setErrores((e) => sinError(e, "sitio")))}
              deshabilitado={!clienteId}
              opciones={sitios.map((x) => ({ valor: x.id, texto: x.nombre }))}
            />
          </div>
          <div className="opciones-pastilla">
            <GrupoDeOpciones etiqueta="Motivo" valor={motivo} onCambio={setMotivo} opciones={MOTIVOS} />
          </div>
          <CuandoVisita fecha={fecha} horario={horario} hoy={hoy} alCambiar={(f, h) => (setFecha(f), setHorario(h))} />
          {nombres.length > 0 && (
            <p className="nota-capa">
              <Smartphone aria-hidden />
              {`${nombres.join(" y ")} ${nombres.length > 1 ? "la ven" : "la ve"} en su teléfono al sincronizar.`}
            </p>
          )}
          {error && <Aviso tono="error">{error}</Aviso>}
        </div>
        <div className="col-f">
          <TecnicosDisponibles tecnicos={tecnicos.data.tecnicos} fecha={fecha} horario={horario} elegidos={elegidos} alCambiar={(ids) => (setElegidos(ids), setErrores((e) => sinError(e, "tecnicos")))} error={errores.tecnicos} />
        </div>
      </form>
    );
  }

  return (
    <Dialogo
      forma="formulario"
      ancho="doble"
      titulo="Programar visita"
      cerrable={!programar.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={programar.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={programar.isPending} disabled={lista.length === 0}>
            {nombres.length === 1 ? `Programar con ${nombres[0]!.split(" ")[0]}` : "Programar la visita"}
          </Boton>
        </>
      }
    >
      {contenido}
    </Dialogo>
  );
}

// Una visita -------------------------------------------------------------------------------------

const deLaVisita = (v: Visita) => `${v.cliente.nombre} · ${dia(v.programadaPara)} · ${resumenDeHorario(v)}`;
const esConflicto = (e: unknown) => e instanceof ErrorApi && e.codigo === "conflicto_de_version";

function Reasignar({ v, releer, alCerrar, alGuardar }: { v: Visita; releer: () => void; alCerrar: () => void; alGuardar: () => void }) {
  const formulario = useId();
  const tecnicos = useQuery(consultasDeProgramacion.tecnicos());
  const [elegidos, setElegidos] = useState(v.tecnicos.map((t) => t.id));
  const [errorCampo, setErrorCampo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  // Lo que cambia, antes de guardarlo (iteración 24c): quién deja de ver la visita, quién la recibe y quién sale por no
  // estar activo (no se puede quitar desde la lista, que solo trae a los activos).
  const cambios = cambiosAlReasignar(v.tecnicos, elegidos, tecnicos.data && new Set(tecnicos.data.tecnicos.map((t) => t.id)));
  const accion = useAccionDeProgramacion(() => cliente.llamar("reasignarVisita", { parametros: { id: v.id }, cuerpo: { version: v.version, tecnicos: cambios.finales } }));

  const nombreDe = (id: string) => tecnicos.data?.tecnicos.find((t) => t.id === id)?.nombre ?? v.tecnicos.find((t) => t.id === id)?.nombre ?? "Un técnico";
  const [salen, entran, inactivos] = [cambios.salen.map(nombreDe), cambios.entran.map(nombreDe), cambios.inactivos.map(nombreDe)];
  const verbo = entran.length > 0 ? `Reasignar a ${enLista(entran)}` : salen.length + inactivos.length > 0 ? `Quitar a ${enLista([...salen, ...inactivos])}` : "Guardar técnicos";

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (cambios.finales.length === 0) return setErrorCampo("Asigne al menos un técnico.");
    setErrorCampo(undefined);
    setError(null);
    try {
      await accion.mutateAsync(undefined);
      alGuardar();
    } catch (e) {
      // Tras un conflicto la lista ya se volvió a leer: el diálogo sigue abierto y reintenta con la versión nueva.
      if (esConflicto(e)) releer();
      setError(mensajeDeProgramacion(e));
    }
  }

  return (
    <Dialogo
      forma="formulario"
      ancho="ancho"
      titulo="Reasignar técnicos"
      subtitulo={deLaVisita(v)}
      cerrable={!accion.isPending}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton onClick={alCerrar} disabled={accion.isPending}>
            Cancelar
          </Boton>
          <Boton type="submit" form={formulario} variante="principal" cargando={accion.isPending} disabled={salen.length + entran.length + inactivos.length === 0}>
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
          <TecnicosDisponibles tecnicos={tecnicos.data.tecnicos} fecha={v.programadaPara} horario={v} elegidos={elegidos} alCambiar={(ids) => (setElegidos(ids), setErrorCampo(undefined))} excluir={v.id} error={errorCampo} />
        )}
        {(inactivos.length > 0 || (cambios.finales.length > 0 && salen.length + entran.length > 0)) && (
          <ul aria-label="Lo que cambia" className="flex flex-col gap-1.5 rounded-control bg-panel-hundido px-3 py-2.5 text-ayuda">
            {inactivos.map((n) => (
              <li key={`inactivo-${n}`}>
                <b className="font-medium">{n}</b> ya no está activo y sale de la visita.
              </li>
            ))}
            {cambios.finales.length > 0 &&
              salen.map((n) => (
                <li key={`sale-${n}`}>
                  <b className="font-medium">{n}</b> deja de verla en su teléfono. Lo que ya empezó se conserva y lo puede enviar.
                </li>
              ))}
            {cambios.finales.length > 0 &&
              entran.map((n) => (
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

function Reprogramar({ v, releer, alCerrar, alGuardar }: { v: Visita; releer: () => void; alCerrar: () => void; alGuardar: (fecha: string) => void }) {
  const formulario = useId();
  const hoy = hoyLocal();
  const [fecha, setFecha] = useState(v.programadaPara < hoy ? hoy : v.programadaPara);
  const [horario, setHorario] = useState<Horario>({ horaInicio: v.horaInicio, horaFin: v.horaFin });
  const [motivo, setMotivo] = useState<Motivo>(motivoConocido(v.motivo));
  const [error, setError] = useState<string | null>(null);
  const accion = useAccionDeProgramacion(() => cliente.llamar("reprogramarVisita", { parametros: { id: v.id }, cuerpo: { version: v.version, programadaPara: fecha, ...horario, motivo } }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError(null);
    try {
      await accion.mutateAsync(undefined);
      alGuardar(fecha);
    } catch (e) {
      if (esConflicto(e)) releer();
      setError(mensajeDeProgramacion(e));
    }
  }

  return (
    <Dialogo
      forma="formulario"
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
        <CuandoVisita fecha={fecha} horario={horario} hoy={hoy} alCambiar={(f, h) => (setFecha(f), setHorario(h))} />
        {v.tecnicos.length > 0 && <p className="nota-capa">{`${v.tecnicos.map((t) => t.nombre).join(" y ")} ${v.tecnicos.length > 1 ? "reciben" : "recibe"} el cambio en su teléfono. Si a esa hora tienen otra visita, no se guarda.`}</p>}
        <div className="opciones-pastilla">
          <GrupoDeOpciones etiqueta="Motivo" valor={motivo} onCambio={setMotivo} opciones={MOTIVOS} />
        </div>
        {error && <Aviso tono="error">{error}</Aviso>}
      </form>
    </Dialogo>
  );
}

function Cancelar({ v, releer, alCerrar, alCancelar }: { v: Visita; releer: () => void; alCerrar: () => void; alCancelar: () => void }) {
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
      accion={async () => {
        try {
          await accion.mutateAsync(undefined);
        } catch (e) {
          // El diálogo sigue abierto con el aviso: el reintento va sobre la versión que dejó la otra persona.
          if (esConflicto(e)) releer();
          throw e;
        }
      }}
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
