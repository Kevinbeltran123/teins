import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Respuesta } from "@teins/protocolo";
import { Building, CalendarDays, ClipboardCheck, Clock, etiquetaEnter, FileText, Keyboard, Package, Receipt, Search, useModal, useNotificar, UserRound, type LucideIcon } from "@teins/ui";
import { cliente, consultas, REFRESCO_BANDEJA_MS } from "../api";
import { resultadosDeBusqueda, type Resultado } from "../busqueda";
import { consultasDeCotizaciones } from "../cotizaciones";
import { useIrConPedido } from "../pedido";
import { esTexto, unoDe, usePreferencia } from "../preferencias";
import { consultasDeProgramacion, hoyLocal } from "../programacion";
import { mensajeDeError } from "../mensajes";
import { useBandeja, useTomar, type Estado } from "../revision";
import { useRetrasado } from "../usarRetraso";

/*
  Buscar en todo (iteración 37, prototipos/usabilidad-oficina): ⌘K en Mac, Ctrl + K en Windows, o «Buscar» en el menú.
  Vacía, lo último que se abrió y las acciones; al escribir, por grupos y hasta cuatro por grupo. ↑ ↓ para moverse,
  Enter para abrir y Esc para cerrar.
*/

const ESTADOS: readonly Estado[] = ["enviado", "en_revision", "revisado"];
const ESTADO_TEXTO: Record<Estado, string> = { enviado: "esperando revisión", en_revision: "en revisión", revisado: "revisado" };
const fechaCorta = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" });
const dia = (aaaaMmDd: string) => fechaCorta.format(new Date(`${aaaaMmDd}T00:00:00Z`));

const ACCIONES: Resultado[] = [
  { tipo: "accion", id: "programar", titulo: "Programar visita" },
  { tipo: "accion", id: "nuevo-cliente", titulo: "Nuevo cliente" },
  { tipo: "accion", id: "nueva-cotizacion", titulo: "Nueva cotización" },
];
const TOMAR: Resultado = { tipo: "accion", id: "tomar", titulo: "Tomar el más antiguo" };
// La lista de atajos también se abre desde aquí: no ocupa una fila del menú.
const ATAJOS: Resultado = { tipo: "accion", id: "atajos", titulo: "Atajos del teclado" };
const SECCIONES: [string, "/" | "/visitas" | "/clientes" | "/catalogo" | "/informes" | "/cotizaciones" | "/cuenta"][] = [
  ["Levantamientos", "/"],
  ["Visitas", "/visitas"],
  ["Clientes", "/clientes"],
  ["Catálogo", "/catalogo"],
  ["Informes", "/informes"],
  ["Cotizaciones", "/cotizaciones"],
  ["Mi cuenta", "/cuenta"],
];

const ICONO: Record<Resultado["tipo"], LucideIcon> = { accion: Clock, ir: Package, cliente: Building, visita: CalendarDays, levantamiento: ClipboardCheck, informe: FileText, cotizacion: Receipt };
const iconoDe = (r: Resultado): LucideIcon =>
  r.tipo === "accion" ? ({ programar: CalendarDays, "nuevo-cliente": Building, "nueva-cotizacion": Receipt, tomar: ClipboardCheck, atajos: Keyboard } as Record<string, LucideIcon>)[r.id] ?? Clock : r.tipo === "ir" ? ({ "/": ClipboardCheck, "/visitas": CalendarDays, "/clientes": Building, "/catalogo": Package, "/informes": FileText, "/cotizaciones": Receipt, "/cuenta": UserRound } as Record<string, LucideIcon>)[r.id] ?? Package : ICONO[r.tipo];

/** Un levantamiento, como se ve entre lo reciente: dónde, quién y en qué estado está. */
export const recienteDeLevantamiento = (l: Respuesta<"obtenerLevantamiento">): Resultado => ({
  tipo: "levantamiento",
  id: l.id,
  titulo: l.visita ? `${l.visita.cliente} · ${l.visita.sitio}` : `Levantamiento de ${l.tecnico.nombre}`,
  detalle: `${l.tecnico.nombre} · ${ESTADO_TEXTO[l.estado]}`,
});

const esResultado = (v: unknown): v is Resultado => typeof v === "object" && v !== null && typeof (v as Resultado).id === "string" && typeof (v as Resultado).titulo === "string";
const esRecientes = (v: unknown): v is Resultado[] => Array.isArray(v) && v.every(esResultado);

/** Lo último que la persona abrió (en este equipo), para la búsqueda vacía. */
export function useRecientes() {
  const [recientes, setRecientes] = usePreferencia<Resultado[]>("recientes", [], esRecientes);
  return {
    recientes,
    anotar: (r: Resultado) => setRecientes([r, ...recientes.filter((x) => !(x.tipo === r.tipo && x.id === r.id))].slice(0, 6)),
  };
}

/** Al abrir un detalle, queda entre lo reciente. */
export function useAnotarReciente(r: Resultado | null) {
  const { anotar } = useRecientes();
  const vigente = useRef(anotar);
  vigente.current = anotar;
  const clave = r ? `${r.tipo}:${r.id}:${r.titulo}:${r.detalle ?? ""}` : "";
  useEffect(() => {
    if (r) vigente.current(r);
    // Solo cuando cambia lo abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
}

export function Paleta({ alCerrar, alVerAtajos }: { alCerrar: () => void; alVerAtajos: () => void }) {
  const modal = useModal(true, alCerrar);
  const navegar = useNavigate();
  const irConPedido = useIrConPedido();
  const idLista = useId();
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const buscar = useRetrasado(texto.trim(), 150);
  const { recientes, anotar } = useRecientes();
  const [, setBusquedaVisitas] = usePreferencia("buscar-visitas", "", esTexto, "pestana");
  const [, setPestanaVisitas] = usePreferencia("visitas-pestana", "proximas", unoDe("proximas", "anteriores", "canceladas"));
  const tomar = useTomar();
  const notificar = useNotificar();
  const masAntiguo = useBandeja("enviado").data?.pages[0]?.elementos[0];

  const informes = useQuery(consultas.informes());
  const cotizaciones = useQuery(consultasDeCotizaciones.lista());
  const clientes = useQuery(consultasDeProgramacion.clientes("activos"));
  const visitas = useQuery(consultasDeProgramacion.visitas("proximas", hoyLocal()));
  // Los levantamientos llegan por páginas: los busca el servidor, cuatro de cada estado.
  const levantamientos = useQuery({
    queryKey: ["busqueda", "levantamientos", buscar],
    queryFn: () => Promise.all(ESTADOS.map((estado) => cliente.llamar("listarLevantamientos", { consulta: { estado, buscar, limite: 4 } }))),
    enabled: buscar.length > 0,
    staleTime: 15_000,
  });

  const deClientes = (clientes.data?.clientes ?? []).map((c): Resultado => ({ tipo: "cliente", id: c.id, titulo: c.nombre, detalle: c.sitios.length === 1 ? "1 sitio" : `${c.sitios.length} sitios` }));
  const deVisitas = (visitas.data?.visitas ?? []).map((v): Resultado => ({ tipo: "visita", id: v.id, titulo: `${v.cliente.nombre} · ${v.sitio.nombre}`, detalle: `${dia(v.programadaPara)} · ${v.motivo} · ${v.tecnicos.map((t) => t.nombre).join(", ")}` }));
  const deInformes = (informes.data?.elementos ?? []).map((i): Resultado => ({ tipo: "informe", id: i.id, titulo: `Informe de ${i.visita.cliente}`, detalle: `${i.visita.sitio} · ${i.vigente ? `versión ${i.vigente} vigente` : "sin publicar"}` }));
  const deCotizaciones = (cotizaciones.data?.cotizaciones ?? []).map((c): Resultado => ({ tipo: "cotizacion", id: c.id, titulo: c.numero, detalle: `${c.visita.cliente} · ${c.visita.sitio}` }));
  // Lo reciente se ve como está ahora, con el nombre corregido o el estado de hoy (iteración 42): de las mismas listas, y
  // cada levantamiento con su detalle. Lo que ya no está en ellas (un cliente archivado) queda como se anotó.
  const levantamientosRecientes = useQueries({
    queries: recientes.filter((r) => r.tipo === "levantamiento").map((r) => ({ ...consultas.levantamiento(r.id), staleTime: REFRESCO_BANDEJA_MS })),
  });
  const vigentes = new Map(
    [...deClientes, ...deVisitas, ...deInformes, ...deCotizaciones, ...levantamientosRecientes.flatMap((q) => (q.data ? [recienteDeLevantamiento(q.data)] : []))].map((r) => [`${r.tipo}:${r.id}`, r]),
  );

  const grupos = resultadosDeBusqueda(texto, {
    recientes: recientes.map((r) => vigentes.get(`${r.tipo}:${r.id}`) ?? r),
    acciones: [...ACCIONES, ...(masAntiguo ? [TOMAR] : []), ATAJOS],
    secciones: SECCIONES.map(([titulo, a]) => ({ tipo: "ir", id: a, titulo })),
    clientes: deClientes,
    visitas: deVisitas,
    // Mientras llega la búsqueda nueva, nada: los de la anterior no coinciden con lo escrito.
    levantamientos:
      buscar && buscar === texto.trim()
        ? (levantamientos.data ?? []).flatMap((p, i) =>
            p.elementos.map((l) => ({ tipo: "levantamiento" as const, id: l.id, titulo: l.visita ? `${l.visita.cliente} · ${l.visita.sitio}` : `Levantamiento de ${l.tecnico.nombre}`, detalle: `${l.nombreFormato ?? l.formato} · ${l.tecnico.nombre} · ${ESTADO_TEXTO[ESTADOS[i]!]}` })),
          )
        : [],
    informes: deInformes,
    cotizaciones: deCotizaciones,
  });
  const planos = grupos.flatMap((g) => g.resultados);
  const actual = Math.min(activo, Math.max(planos.length - 1, 0));
  const cargando = [informes, cotizaciones, clientes, visitas].some((q) => q.isPending) || (buscar.length > 0 && levantamientos.isPending);

  // El elegido queda a la vista al moverse con las flechas.
  useEffect(() => {
    document.getElementById(`${idLista}-${actual}`)?.scrollIntoView({ block: "nearest" });
  }, [actual, idLista]);

  async function abrir(r: Resultado) {
    if (r.tipo !== "accion" && r.tipo !== "ir") anotar(r);
    alCerrar();
    switch (r.tipo) {
      case "cliente":
        return navegar({ to: "/clientes/$id", params: { id: r.id } });
      case "levantamiento":
        return navegar({ to: "/levantamientos/$id", params: { id: r.id } });
      case "informe":
        return navegar({ to: "/informes/$id", params: { id: r.id } });
      case "cotizacion":
        return navegar({ to: "/cotizaciones/$id", params: { id: r.id } });
      case "visita":
        // Visitas no tiene página propia: la lista abre buscando esa visita.
        setPestanaVisitas("proximas");
        setBusquedaVisitas(r.titulo.split(" · ")[0]!);
        return navegar({ to: "/visitas" });
      case "ir":
        return navegar({ to: SECCIONES.find(([, a]) => a === r.id)?.[1] ?? "/" });
      case "accion":
        if (r.id === "programar") return irConPedido("/visitas", { abrir: "programar" });
        if (r.id === "nuevo-cliente") return irConPedido("/clientes", { abrir: "nuevo" });
        if (r.id === "nueva-cotizacion") return irConPedido("/cotizaciones", { abrir: "nueva" });
        if (r.id === "atajos") return alVerAtajos();
        if (r.id === "tomar" && masAntiguo) {
          // Si otra persona lo tomó un instante antes, se dice y no se abre como si fuera propio.
          try {
            await tomar.mutateAsync({ id: masAntiguo.id, version: masAntiguo.version });
          } catch (error) {
            return notificar({ texto: `No se pudo tomar: ${mensajeDeError(error)}` });
          }
          return navegar({ to: "/levantamientos/$id", params: { id: masAntiguo.id } });
        }
    }
  }

  function teclear(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (planos.length) setActivo((actual + (e.key === "ArrowDown" ? 1 : -1) + planos.length) % planos.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = planos[actual];
      if (r) void abrir(r);
    }
  }

  let k = -1;
  return (
    <dialog ref={modal.ref} className="paleta" aria-label="Buscar en oficina" onCancel={modal.onCancel} onPointerDown={modal.onPointerDown} onClick={modal.onClick}>
      <div className="entrada-p">
        <Search aria-hidden size={18} strokeWidth={1.6} />
        <input
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={idLista}
          aria-activedescendant={planos.length ? `${idLista}-${actual}` : undefined}
          aria-label="Buscar clientes, visitas, levantamientos, informes y cotizaciones"
          placeholder="Buscar clientes, visitas, levantamientos, informes…"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setActivo(0);
          }}
          onKeyDown={teclear}
        />
        <span className="kbd" aria-hidden>
          Esc
        </span>
      </div>
      <div className="resultados-p" id={idLista} role="listbox" aria-label="Resultados">
        {grupos.map((g) => (
          <div key={g.grupo} role="group" aria-label={g.grupo}>
            <div className="grupo-p" aria-hidden>
              {g.grupo}
            </div>
            {g.resultados.map((r) => {
              k++;
              const i = k;
              const Icono = g.grupo === "Recientes" ? Clock : iconoDe(r);
              return (
                <div key={`${r.tipo}:${r.id}`} id={`${idLista}-${i}`} role="option" aria-selected={i === actual} className="item-p" onPointerMove={() => i !== actual && setActivo(i)} onClick={() => void abrir(r)}>
                  <Icono aria-hidden size={16} strokeWidth={1.6} />
                  <span className="t">{r.titulo}</span>
                  {r.detalle && <span className="d">{r.detalle}</span>}
                  {i === actual && (
                    <span className="kbd" aria-hidden>
                      {etiquetaEnter()}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {grupos.length === 0 && (cargando ? <p className="nada-p">Buscando…</p> : <p className="nada-p">Nada con «{texto.trim()}» en clientes, visitas, levantamientos, informes ni cotizaciones.</p>)}
      </div>
      <div className="pie-p" aria-hidden>
        <span>
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> moverse
        </span>
        <span>
          <span className="kbd">{etiquetaEnter()}</span> abrir
        </span>
        <span>
          <span className="kbd">Esc</span> cerrar
        </span>
      </div>
    </dialog>
  );
}
