import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Aviso, Boton, ChevronLeft, ChevronRight, ChevronDown, Clock, RefreshCw, Search } from "@teins/ui";
import { cruceDe, duracionTexto, hora12, aHora, aMinutos, libreTexto, ocupadoTexto, DIA_COMPLETO, type Horario, type Ocupacion } from "../horario";
import { consultasDeProgramacion } from "../programacion";
import { formatearDia } from "@teins/dominio";

/*
  Cuándo es una visita y quién está libre (ADR-0037, prototipos/ajustes-oficina): fecha, hora y duración en tres
  selectores propios (no el reloj del navegador), y los técnicos libres a esa hora. Todo cabe sin bajar: la lista
  muestra a lo sumo seis; los demás se encuentran escribiendo el nombre.
*/

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const SEMANA = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const DURACIONES = [30, 60, 90, 120, 180, 240, 360, 480];
const MAXIMO_A_LA_VISTA = 6;

/** "vie 2 oct · hoy" */
export function fechaCorta(aaaaMmDd: string, hoy: string): string {
  const texto = formatearDia(aaaaMmDd, { weekday: "short", day: "numeric", month: "short" }).replace(",", "").replace(/\./g, "").replace(/ de /g, " ");
  return aaaaMmDd === hoy ? `${texto} · hoy` : texto;
}

/** Lo que dice el horario elegido, debajo de los selectores. */
export function resumenDeHorario(h: Horario): string {
  if (!h.horaInicio) return "Todo el día";
  if (!h.horaFin) return `Desde ${hora12(h.horaInicio)}, hasta que el técnico la termine`;
  return `De ${hora12(h.horaInicio)} a ${hora12(h.horaFin)}`;
}

type Abierto = "fecha" | "hora" | "duracion" | null;

function Selector({ id, abierto, valor, etiqueta, alAbrir }: { id: Exclude<Abierto, null>; abierto: Abierto; valor: string; etiqueta: string; alAbrir: (id: Abierto) => void }) {
  return (
    <button type="button" className="selector" aria-haspopup="listbox" aria-expanded={abierto === id} aria-label={`${etiqueta}: ${valor}`} onClick={() => alAbrir(abierto === id ? null : id)}>
      <span>{valor}</span>
      <ChevronDown aria-hidden size={14} />
    </button>
  );
}

/** Fecha, hora y duración. `alCambiar` recibe la fecha y el horario completos. */
export function CuandoVisita({ fecha, horario, hoy, alCambiar }: { fecha: string; horario: Horario; hoy: string; alCambiar: (fecha: string, horario: Horario) => void }) {
  const [abierto, setAbierto] = useState<Abierto>(null);
  const caja = useRef<HTMLDivElement>(null);
  // Un clic fuera cierra la lista abierta; Esc también, sin cerrar el diálogo.
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => !caja.current?.contains(e.target as Node) && setAbierto(null);
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);
  const conEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape" && abierto) {
      e.preventDefault();
      e.stopPropagation();
      setAbierto(null);
    }
  };
  const duracion = horario.horaInicio && horario.horaFin ? aMinutos(horario.horaFin) - aMinutos(horario.horaInicio) : null;
  const elegirHora = (inicio: string | null) => {
    setAbierto(null);
    if (!inicio) return alCambiar(fecha, { horaInicio: null, horaFin: null });
    // La misma duración desde la hora nueva, si cabe en el día; si no, hasta que la terminen.
    const fin = duracion !== null && aMinutos(inicio) + duracion <= DIA_COMPLETO - 1 ? aHora(aMinutos(inicio) + duracion) : horario.horaInicio && !horario.horaFin ? null : duracion === null && !horario.horaInicio ? aHora(Math.min(aMinutos(inicio) + 120, DIA_COMPLETO - 1)) : null;
    alCambiar(fecha, { horaInicio: inicio, horaFin: fin });
  };
  const elegirDuracion = (minutos: number | null) => {
    setAbierto(null);
    alCambiar(fecha, { horaInicio: horario.horaInicio, horaFin: minutos === null ? null : aHora(aMinutos(horario.horaInicio!) + minutos) });
  };

  let lista: ReactNode = null;
  if (abierto === "fecha") lista = <Calendario fecha={fecha} hoy={hoy} alElegir={(f) => (setAbierto(null), alCambiar(f, horario))} />;
  if (abierto === "hora") {
    const rejilla = (desde: number, hasta: number) => (
      <div className="rejilla-h">
        {Array.from({ length: (hasta - desde) * 2 }, (_, i) => aHora((desde + i / 2) * 60)).map((h) => (
          <button key={h} type="button" role="option" aria-selected={horario.horaInicio === h} onClick={() => elegirHora(h)}>
            {hora12(h)}
          </button>
        ))}
      </div>
    );
    lista = (
      <div className="pop pop-hora" role="listbox" aria-label="Hora de inicio">
        <button type="button" role="option" aria-selected={!horario.horaInicio} className="todo-dia" onClick={() => elegirHora(null)}>
          Todo el día<small>Ocupa al técnico ese día entero</small>
        </button>
        <span className="grupo-p">Mañana</span>
        {rejilla(6, 12)}
        <span className="grupo-p">Tarde</span>
        {rejilla(12, 19)}
      </div>
    );
  }
  if (abierto === "duracion" && horario.horaInicio) {
    const inicio = aMinutos(horario.horaInicio);
    const opciones = [...new Set([...DURACIONES, ...(duracion !== null ? [duracion] : [])])].sort((a, b) => a - b);
    lista = (
      <div className="pop pop-hora" role="listbox" aria-label="Duración">
        <div className="rejilla-h">
          {opciones.map((d) => (
            <button key={d} type="button" role="option" aria-selected={duracion === d} disabled={inicio + d > DIA_COMPLETO - 1} onClick={() => elegirDuracion(d)}>
              {duracionTexto(d)}
            </button>
          ))}
        </div>
        <button type="button" role="option" aria-selected={duracion === null} className="todo-dia" onClick={() => elegirDuracion(null)}>
          No sé cuánto dura<small>Queda ocupado hasta que el técnico la termine</small>
        </button>
      </div>
    );
  }

  return (
    <div className="campo">
      <span className="etq">Cuándo</span>
      <div className="cuando" ref={caja} onKeyDown={conEsc}>
        <Selector id="fecha" abierto={abierto} valor={fechaCorta(fecha, hoy)} etiqueta="Fecha" alAbrir={setAbierto} />
        <Selector id="hora" abierto={abierto} valor={horario.horaInicio ? hora12(horario.horaInicio) : "Todo el día"} etiqueta="Hora" alAbrir={setAbierto} />
        {horario.horaInicio && <Selector id="duracion" abierto={abierto} valor={duracion === null ? "Sin definir" : duracionTexto(duracion)} etiqueta="Duración" alAbrir={setAbierto} />}
        {lista}
      </div>
      <p className="ayuda resumen-h">
        <Clock aria-hidden size={14} />
        {resumenDeHorario(horario)}
      </p>
    </div>
  );
}

/** Un mes, desde hoy: los días pasados no se eligen. */
function Calendario({ fecha, hoy, alElegir }: { fecha: string; hoy: string; alElegir: (f: string) => void }) {
  const [mes, setMes] = useState(() => fecha.slice(0, 7));
  const [a, m] = mes.split("-").map(Number) as [number, number];
  const primero = new Date(Date.UTC(a, m - 1, 1));
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const hueco = (primero.getUTCDay() + 6) % 7;
  const mover = (n: number) => {
    const d = new Date(Date.UTC(a, m - 1 + n, 1));
    setMes(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <div className="pop pop-fecha" role="dialog" aria-label="Elegir la fecha">
      <div className="mes">
        <button type="button" className="icono-btn limpio chico" aria-label="Mes anterior" disabled={mes <= hoy.slice(0, 7)} onClick={() => mover(-1)}>
          <ChevronLeft aria-hidden size={16} />
        </button>
        <b>{`${MESES[m - 1]} ${a}`}</b>
        <button type="button" className="icono-btn limpio chico" aria-label="Mes siguiente" onClick={() => mover(1)}>
          <ChevronRight aria-hidden size={16} />
        </button>
      </div>
      <div className="rejilla-f" role="listbox" aria-label={`Días de ${MESES[m - 1]}`}>
        {SEMANA.map((d) => (
          <span key={d} className="dsem" aria-hidden>
            {d}
          </span>
        ))}
        {Array.from({ length: hueco }, (_, i) => (
          <span key={`h${i}`} />
        ))}
        {Array.from({ length: dias }, (_, i) => {
          const f = `${mes}-${String(i + 1).padStart(2, "0")}`;
          return (
            <button key={f} type="button" role="option" aria-selected={f === fecha} disabled={f < hoy} className={f === hoy ? "hoy" : ""} onClick={() => alElegir(f)}>
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Tecnico = { id: string; nombre: string };
const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();

/**
 * Los técnicos libres a esa hora, con buscador; los ocupados aparte, con lo que los ocupa, para que se sepa por qué
 * falta alguien. A lo sumo seis a la vista: el formulario se ve entero sin bajar.
 */
export function TecnicosDisponibles({
  tecnicos,
  fecha,
  horario,
  elegidos,
  alCambiar,
  excluir,
  error,
}: {
  tecnicos: readonly Tecnico[];
  fecha: string;
  horario: Horario;
  elegidos: readonly string[];
  alCambiar: (ids: string[]) => void;
  /** La visita que se está cambiando: no se cuenta como ocupación. */
  excluir?: string;
  error?: string | undefined;
}) {
  const ocupacion = useQuery(consultasDeProgramacion.ocupacion(fecha));
  const [buscar, setBuscar] = useState("");
  const [verOcupados, setVerOcupados] = useState(false);
  const ocupaciones: readonly Ocupacion[] = ocupacion.data?.ocupaciones ?? [];
  const coincide = (t: Tecnico) => t.nombre.toLocaleLowerCase("es").includes(buscar.trim().toLocaleLowerCase("es"));
  const cruce = (t: Tecnico) => cruceDe(t.id, fecha, horario, ocupaciones, excluir);
  // Los que se han elegido en este diálogo van primero y ahí se quedan: al desmarcar uno no desaparece de la vista.
  const arriba = useRef(new Set(elegidos));
  for (const id of elegidos) arriba.current.add(id);
  const libres = tecnicos.filter((t) => !cruce(t) && coincide(t)).sort((a, b) => Number(arriba.current.has(b.id)) - Number(arriba.current.has(a.id)));
  const ocupados = tecnicos.filter((t) => cruce(t) && coincide(t));
  const lista = verOcupados ? ocupados : libres;
  const quedan = lista.length - MAXIMO_A_LA_VISTA;
  // Un elegido que quedó ocupado al cambiar la hora deja de estar elegido: no se puede programar con él.
  useEffect(() => {
    if (!ocupacion.data) return;
    const siguen = elegidos.filter((id) => !cruceDe(id, fecha, horario, ocupaciones, excluir));
    if (siguen.length !== elegidos.length) alCambiar(siguen);
  }, [ocupacion.data, fecha, horario.horaInicio, horario.horaFin]);

  return (
    <fieldset className="campo" style={{ minWidth: 0 }}>
      <legend className="etq">Técnicos</legend>
      {tecnicos.length === 0 ? (
        <Aviso tono="alerta">No hay técnicos activos. Quien administra los crea en Administración.</Aviso>
      ) : (
        <div className="tecnicos-v">
          <label className="buscar">
            <Search aria-hidden size={15} />
            <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar técnico" aria-label="Buscar técnico" autoComplete="off" />
          </label>
          <div className="seg-tec" role="tablist" aria-label="Técnicos">
            <button type="button" role="tab" aria-selected={!verOcupados} onClick={() => setVerOcupados(false)}>
              {`Libres a esa hora · ${libres.length}`}
            </button>
            <button type="button" role="tab" aria-selected={verOcupados} onClick={() => setVerOcupados(true)}>
              {`Ocupados · ${ocupados.length}`}
            </button>
          </div>
          <div className="lista-tec">
            {/* Sin la ocupación los técnicos se siguen viendo (todos como libres): sin ellos no se podría elegir a nadie. */}
            {ocupacion.isError && (
              <div className="ayuda vacia-tec">
                No se pudo revisar quién está libre. El servidor igual rechaza un cruce al guardar.{" "}
                <Boton variante="fantasma" tamano="pequeno" icono={RefreshCw} onClick={() => void ocupacion.refetch()}>
                  Reintentar
                </Boton>
              </div>
            )}
            {ocupacion.isPending ? (
              <p className="ayuda vacia-tec">Revisando quién está libre…</p>
            ) : lista.length === 0 ? (
              <p className="ayuda vacia-tec">{verOcupados ? "Nadie está ocupado a esa hora." : buscar.trim() ? "Nadie libre con ese nombre." : "Nadie está libre a esa hora: elija otra."}</p>
            ) : (
              lista.slice(0, MAXIMO_A_LA_VISTA).map((t) =>
                verOcupados ? (
                  <div key={t.id} className="fila-tec ocupado">
                    <span />
                    <span className="av" aria-hidden>
                      {iniciales(t.nombre)}
                    </span>
                    <span>
                      {t.nombre}
                      <small>{ocupadoTexto(cruce(t)!)}</small>
                    </span>
                  </div>
                ) : (
                  <label key={t.id} className="fila-tec">
                    <input type="checkbox" checked={elegidos.includes(t.id)} onChange={(e) => alCambiar(e.target.checked ? [...elegidos, t.id] : elegidos.filter((x) => x !== t.id))} />
                    <span className="av" aria-hidden>
                      {iniciales(t.nombre)}
                    </span>
                    <span>
                      {t.nombre}
                      <small className="libre">{libreTexto(t.id, fecha, horario, ocupaciones, excluir)}</small>
                    </span>
                  </label>
                ),
              )
            )}
          </div>
          {quedan > 0 && <div className="mas-tec">{`y ${quedan} más: escriba el nombre para encontrarlos`}</div>}
        </div>
      )}
      {error && <p className="msj-error">{error}</p>}
    </fieldset>
  );
}
