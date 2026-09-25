import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { Respuesta } from "@teins/protocolo";
import { Aviso, Boton, CampoSeleccion, CampoTexto, CampoTextoLargo, Casilla, GrupoDeOpciones, Marquilla, Pestanas } from "@teins/ui";
import { cliente } from "../api";
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
const motivoConocido = (m: string): Motivo => (MOTIVOS.find((x) => x.valor === m)?.valor ?? "Mantenimiento");

const dia = (aaaaMmDd: string) => new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${aaaaMmDd}T00:00:00Z`));

function avance(v: Visita): string {
  const { enviados, enRevision, revisados } = v.levantamientos;
  const partes = [enviados && `${enviados} por revisar`, enRevision && `${enRevision} en revisión`, revisados && `${revisados} revisado${revisados === 1 ? "" : "s"}`].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "Sin levantamientos recibidos";
}

export function Visitas() {
  const [vista, setVista] = useState<Vista>("proximas");
  const [programando, setProgramando] = useState(false);
  const hoy = hoyLocal();
  const consulta = useQuery(consultasDeProgramacion.visitas(vista, hoy));

  return (
    <section aria-labelledby="titulo-visitas" className="flex flex-col gap-4 rounded-panel bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="titulo-visitas" className="text-subtitulo font-extrabold">
          Visitas
        </h1>
        {!programando && (
          <Boton variante="principal" onClick={() => setProgramando(true)}>
            Programar visita
          </Boton>
        )}
      </div>
      {programando && <ProgramarVisita hoy={hoy} alTerminar={() => setProgramando(false)} />}
      <Pestanas
        etiqueta="Qué visitas ver"
        activa={vista}
        onCambio={setVista}
        pestanas={[
          { valor: "proximas", etiqueta: "Próximas", cantidad: vista === "proximas" ? consulta.data?.visitas.length : undefined },
          { valor: "anteriores", etiqueta: "Anteriores" },
          { valor: "canceladas", etiqueta: "Canceladas" },
        ]}
      />
      <div role="tabpanel">
        {consulta.isPending ? (
          <div aria-busy="true" aria-label="Cargando visitas" className="h-[240px] animate-pulse rounded-panel bg-fondo" />
        ) : consulta.isError ? (
          <Aviso tono="error">
            <p>No se pudieron cargar las visitas.</p>
            <Boton className="mt-3" onClick={() => void consulta.refetch()}>
              Reintentar
            </Boton>
          </Aviso>
        ) : consulta.data.visitas.length === 0 ? (
          <p className="py-4 text-cuerpo text-texto-secundario">
            {vista === "proximas" ? "No hay visitas programadas desde hoy. Use \"Programar visita\"." : vista === "anteriores" ? "Todavía no hay visitas anteriores." : "No hay visitas canceladas."}
          </p>
        ) : (
          <ul aria-label="Visitas" className="flex flex-col divide-y divide-division">
            {consulta.data.visitas.map((v) => (
              <FilaVisita key={v.id} visita={v} hoy={hoy} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// Programar -------------------------------------------------------------------------------------

function ProgramarVisita({ hoy, alTerminar }: { hoy: string; alTerminar: () => void }) {
  const clientes = useQuery(consultasDeProgramacion.clientes());
  const tecnicos = useQuery(consultasDeProgramacion.tecnicos());
  const [clienteId, setClienteId] = useState("");
  const [sitioId, setSitioId] = useState("");
  const [motivo, setMotivo] = useState<Motivo>("Mantenimiento");
  const [fecha, setFecha] = useState(hoy);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const programar = useAccionDeProgramacion(() => cliente.llamar("programarVisita", { cuerpo: { clienteId, sitioId, motivo, programadaPara: fecha, tecnicos: elegidos } }));

  if (clientes.isPending || tecnicos.isPending) return <div aria-busy="true" aria-label="Preparando el formulario" className="h-[200px] animate-pulse rounded-panel bg-fondo" />;
  if (clientes.isError || tecnicos.isError) {
    return (
      <Aviso tono="error">
        <p>No se pudieron cargar los clientes o los técnicos.</p>
        <Boton className="mt-3" onClick={() => void Promise.all([clientes.refetch(), tecnicos.refetch()])}>
          Reintentar
        </Boton>
      </Aviso>
    );
  }
  const lista = clientes.data.clientes;
  if (lista.length === 0) {
    return (
      <Aviso tono="info">
        Todavía no hay clientes.{" "}
        <Link to="/clientes" className="font-bold underline">
          Cree el cliente con su sitio
        </Link>{" "}
        y vuelva a programar.
      </Aviso>
    );
  }
  const sitios = lista.find((c) => c.id === clienteId)?.sitios ?? [];

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!clienteId || !sitioId) return setError("Elija el cliente y el sitio.");
    if (!fecha) return setError("Elija la fecha.");
    if (elegidos.length === 0) return setError("Asigne al menos un técnico.");
    setError(null);
    try {
      await programar.mutateAsync(undefined);
      alTerminar();
    } catch (e) {
      setError(mensajeDeProgramacion(e));
    }
  }

  return (
    <form onSubmit={enviar} noValidate aria-labelledby="titulo-programar" className="flex flex-col gap-4 rounded-panel border border-division p-5">
      <h2 id="titulo-programar" className="text-cuerpo font-extrabold">
        Programar visita
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <CampoSeleccion
          etiqueta="Cliente"
          vacio="Elija un cliente"
          valor={clienteId}
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
          onCambio={setSitioId}
          deshabilitado={!clienteId}
          opciones={sitios.map((s) => ({ valor: s.id, texto: `${s.nombre} · ${s.direccion}` }))}
        />
        <CampoTexto etiqueta="Fecha" tipo="date" nombre="fecha" valorInicial={hoy} onCambio={setFecha} />
      </div>
      <GrupoDeOpciones etiqueta="Motivo" valor={motivo} onCambio={setMotivo} opciones={MOTIVOS} />
      <ElegirTecnicos tecnicos={tecnicos.data.tecnicos} elegidos={elegidos} onCambio={setElegidos} />
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" variante="principal" disabled={programar.isPending}>
          {programar.isPending ? "Programando…" : "Programar la visita"}
        </Boton>
        <Boton onClick={alTerminar}>Cancelar</Boton>
      </div>
    </form>
  );
}

function ElegirTecnicos({ tecnicos, elegidos, onCambio }: { tecnicos: Tecnico[]; elegidos: string[]; onCambio: (ids: string[]) => void }) {
  if (tecnicos.length === 0) return <Aviso tono="alerta">No hay técnicos activos. Quien administra los crea en Administración.</Aviso>;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1.5 text-cuerpo font-bold">Técnicos</legend>
      <div className="grid gap-x-6 md:grid-cols-3">
        {tecnicos.map((t) => (
          <Casilla key={t.id} marcada={elegidos.includes(t.id)} onCambio={(m) => onCambio(m ? [...elegidos, t.id] : elegidos.filter((x) => x !== t.id))}>
            {t.nombre}
          </Casilla>
        ))}
      </div>
    </fieldset>
  );
}

// Una visita -------------------------------------------------------------------------------------

type Edicion = null | "reasignar" | "reprogramar" | "cancelar";

function FilaVisita({ visita: v, hoy }: { visita: Visita; hoy: string }) {
  const [edicion, setEdicion] = useState<Edicion>(null);
  const esHoy = v.programadaPara === hoy;
  const botonEnlace =
    "min-h-tactil rounded-control px-2 text-ayuda font-bold text-superficie underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-superficie";

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-ayuda font-bold text-texto-secundario">
            {esHoy ? `Hoy, ${dia(v.programadaPara)}` : dia(v.programadaPara)}
          </p>
          <h2 className="text-cuerpo font-extrabold">
            {v.cliente.nombre} <span className="font-normal">· {v.sitio.nombre}</span>
          </h2>
          <p className="text-ayuda text-texto-secundario">{v.sitio.direccion}</p>
          <p className="text-ayuda">{`Técnicos: ${v.tecnicos.map((t) => t.nombre).join(", ")}`}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Marquilla tono={v.cancelada ? "borrador" : "superficie"}>{v.motivo}</Marquilla>
          <span className="text-ayuda text-texto-secundario">{avance(v)}</span>
        </div>
      </div>
      {v.cancelada ? (
        <p className="text-ayuda text-texto-secundario">{`Cancelada el ${aFechaHora(v.cancelada.en)} por ${v.cancelada.por.nombre}: ${v.cancelada.motivo}`}</p>
      ) : edicion === null ? (
        <div className="flex flex-wrap gap-1">
          <button type="button" className={botonEnlace} onClick={() => setEdicion("reasignar")}>{`Reasignar la visita de ${v.cliente.nombre}`}</button>
          <button type="button" className={botonEnlace} onClick={() => setEdicion("reprogramar")}>{`Reprogramar la visita de ${v.cliente.nombre}`}</button>
          <button type="button" className={botonEnlace} onClick={() => setEdicion("cancelar")}>{`Cancelar la visita de ${v.cliente.nombre}`}</button>
          {v.levantamientos.revisados > 0 && <AbrirInforme visitaId={v.id} />}
        </div>
      ) : (
        <Editar visita={v} edicion={edicion} alTerminar={() => setEdicion(null)} />
      )}
    </li>
  );
}

function AbrirInforme({ visitaId }: { visitaId: string }) {
  const abrir = useAbrirInformeDeVisita();
  const navegar = useNavigate();
  return (
    <Boton disabled={abrir.isPending} onClick={() => abrir.mutate(visitaId, { onSuccess: ({ id }) => void navegar({ to: "/informes/$id", params: { id } }) })}>
      {abrir.isPending ? "Abriendo…" : "Abrir el informe"}
    </Boton>
  );
}

function Editar({ visita: v, edicion, alTerminar }: { visita: Visita; edicion: Exclude<Edicion, null>; alTerminar: () => void }) {
  const tecnicos = useQuery({ ...consultasDeProgramacion.tecnicos(), enabled: edicion === "reasignar" });
  const [elegidos, setElegidos] = useState(v.tecnicos.map((t) => t.id));
  const [fecha, setFecha] = useState(v.programadaPara);
  const [motivo, setMotivo] = useState<Motivo>(motivoConocido(v.motivo));
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const accion = useAccionDeProgramacion(async () => {
    const parametros = { id: v.id };
    if (edicion === "reasignar") return cliente.llamar("reasignarVisita", { parametros, cuerpo: { version: v.version, tecnicos: elegidos } });
    if (edicion === "reprogramar") return cliente.llamar("reprogramarVisita", { parametros, cuerpo: { version: v.version, programadaPara: fecha, motivo } });
    return cliente.llamar("cancelarVisita", { parametros, cuerpo: { version: v.version, motivo: motivoCancelacion } });
  });

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (edicion === "reasignar" && elegidos.length === 0) return setError("Asigne al menos un técnico.");
    if (edicion === "reprogramar" && !fecha) return setError("Elija la fecha.");
    if (edicion === "cancelar" && motivoCancelacion.trim() === "") return setError("Escriba por qué se cancela: queda en el registro.");
    setError(null);
    try {
      await accion.mutateAsync(undefined);
      alTerminar();
    } catch (e) {
      // Tras un conflicto la lista ya se volvió a leer: el formulario sigue abierto y reintenta con la versión nueva.
      setError(mensajeDeProgramacion(e));
    }
  }

  const titulo = { reasignar: "Reasignar", reprogramar: "Reprogramar", cancelar: "Cancelar" }[edicion];
  return (
    <form onSubmit={enviar} noValidate aria-label={`${titulo} la visita de ${v.cliente.nombre}`} className="flex max-w-3xl flex-col gap-4 rounded-panel border border-division p-4">
      {edicion === "reasignar" &&
        (tecnicos.isPending ? (
          <div aria-busy="true" aria-label="Cargando técnicos" className="h-[80px] animate-pulse rounded-panel bg-fondo" />
        ) : tecnicos.isError ? (
          <Aviso tono="error">No se pudieron cargar los técnicos.</Aviso>
        ) : (
          <>
            <ElegirTecnicos tecnicos={tecnicos.data.tecnicos} elegidos={elegidos} onCambio={setElegidos} />
            <p className="text-ayuda text-texto-secundario">Quien deja la visita la pierde de su teléfono; lo que ya empezó se conserva y lo puede enviar.</p>
          </>
        ))}
      {edicion === "reprogramar" && (
        <>
          <div className="max-w-xs">
            <CampoTexto etiqueta="Fecha nueva" tipo="date" valorInicial={v.programadaPara} onCambio={setFecha} />
          </div>
          <GrupoDeOpciones etiqueta="Motivo" valor={motivo} onCambio={setMotivo} opciones={MOTIVOS} />
        </>
      )}
      {edicion === "cancelar" && (
        <>
          <p className="text-ayuda">Sale de los teléfonos de sus técnicos; lo que ya empezaron se conserva y lo pueden enviar. No se puede deshacer: si se necesita, programe otra.</p>
          <CampoTextoLargo etiqueta="Motivo de la cancelación" valor={motivoCancelacion} onCambio={setMotivoCancelacion} maximo={500} />
        </>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <Boton type="submit" variante="principal" disabled={accion.isPending}>
          {accion.isPending ? "Guardando…" : edicion === "cancelar" ? "Sí, cancelar la visita" : `${titulo} la visita`}
        </Boton>
        <Boton onClick={alTerminar}>Volver</Boton>
      </div>
    </form>
  );
}
