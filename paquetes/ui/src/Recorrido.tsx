import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Camera, Check, ChevronLeft, ChevronRight, Circle, CircleAlert, CircleCheck, type LucideIcon } from "./iconos";

/**
 * Piezas de la dirección Recorrido (DESIGN.md, campo): la captura sigue el orden de la visita y cada paso
 * ocupa la pantalla. El lenguaje es el del croquis: controles redondos, contenido grande, un trabajo a la vez.
 */

export type EstadoDePaso = "hecho" | "actual" | "pendiente" | "falta";

/** Arriba de cada paso: volver y dónde se está, con la barra de cuánto va. */
export function EncabezadoDePaso({
  contexto,
  avance,
  volver,
  etiquetaVolver,
  transicion,
}: {
  contexto: string;
  /** De 0 a 1. */
  avance: number;
  volver: () => void;
  etiquetaVolver: string;
  /**
   * Nombre de transición (iteración 27): el mismo que la tarjeta de la visita en el inicio, para que la tarjeta se
   * convierta en esta cabecera. Entre pasos, la cabecera se queda y solo crece la barra de avance.
   */
  transicion?: string | undefined;
}) {
  return (
    <header className="sticky top-0 z-20 bg-fondo/95 pt-[env(safe-area-inset-top)] backdrop-blur" style={transicion ? { viewTransitionName: transicion } : undefined}>
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2.5">
        <BotonRedondo icono={ChevronLeft} etiqueta={etiquetaVolver} onClick={volver} />
        <div className="flex min-w-0 grow flex-col gap-1.5">
          <span className="truncate text-ayuda font-bold text-texto-secundario">{contexto}</span>
          <div className="h-[3px] overflow-hidden rounded-full bg-superficie-pista" role="progressbar" aria-label="Avance del levantamiento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance * 100)}>
            <div className="h-full rounded-full bg-superficie transition-[width] duration-500 ease-t motion-reduce:transition-none" style={{ width: `${Math.round(avance * 100)}%`, viewTransitionName: "progreso" }} />
          </div>
        </div>
      </div>
    </header>
  );
}

/** Botón redondo de icono, como los del croquis. */
export function BotonRedondo({ icono: Icono, etiqueta, onClick }: { icono: LucideIcon; etiqueta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      title={etiqueta}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-panel shadow-[inset_0_0_0_1px_var(--t-borde-suave)] active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco [&_svg]:size-6"
    >
      <Icono aria-hidden />
    </button>
  );
}

/**
 * La acción del paso, abajo y al alcance del pulgar. El degradado deja ver que el contenido sigue. Entre pasos no se
 * desliza: se queda en su lugar (iteración 27).
 */
export function BarraDePaso({ children }: { children: ReactNode }) {
  return (
    <div data-barra-inferior className="fixed inset-x-0 bottom-0 z-20 bg-linear-to-t from-fondo from-70% to-transparent" style={{ viewTransitionName: "barra-paso" }}>
      <div className="mx-auto flex max-w-xl gap-3 px-4 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}

/** El botón que avanza: grande, con la flecha que dice hacia dónde va. */
export function BotonSiguiente({ children, onClick, icono: Icono = ArrowRight, cargando, type = "button", disabled }: { children: ReactNode; onClick?: () => void; icono?: LucideIcon; cargando?: boolean; type?: "button" | "submit"; disabled?: boolean }) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-busy={cargando || undefined}
      className="inline-flex min-h-[50px] grow items-center justify-center gap-2.5 rounded-control bg-superficie px-5 text-cuerpo font-medium text-sobre-superficie shadow-[inset_0_1px_0_rgb(255_255_255/0.18),var(--t-sombra-boton)] transition-transform active:scale-[0.97] disabled:opacity-50 aria-busy:opacity-80 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco [&_svg]:size-[1.2em]"
    >
      {children}
      <Icono aria-hidden />
    </button>
  );
}

/** Los pasos de la visita unidos por una línea: hechos en verde, el actual resaltado, los demás en espera. */
export function ListaRecorrido({ children }: { children: ReactNode }) {
  return <ol className="flex flex-col">{children}</ol>;
}

export function PasoDelRecorrido({
  numero,
  titulo,
  detalle,
  estado,
  ultimo,
  onClick,
}: {
  numero: number;
  titulo: string;
  detalle: string;
  estado: EstadoDePaso;
  ultimo?: boolean;
  onClick: () => void;
}) {
  const marca = {
    hecho: "bg-sync-ok text-fondo",
    actual: "bg-acento text-sobre-acento ring-6 ring-acento/25",
    falta: "bg-alerta-fondo text-alerta-texto",
    pendiente: "bg-panel-hundido text-texto-secundario",
  }[estado];
  return (
    <li className="relative pl-12">
      {!ultimo && <span aria-hidden className={`absolute top-10 -bottom-1 left-[19px] border-l-2 ${estado === "hecho" ? "border-solid border-sync-ok" : "border-dashed border-borde-suave"}`} />}
      <span aria-hidden className={`absolute top-3.5 left-1 grid size-8 place-items-center rounded-full text-ayuda font-extrabold [&_svg]:size-[18px] ${marca}`}>
        {estado === "hecho" ? <Check strokeWidth={3} /> : numero}
      </span>
      <button
        type="button"
        onClick={onClick}
        aria-current={estado === "actual" ? "step" : undefined}
        className={`flex w-full flex-col gap-1 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco ${
          estado === "actual" ? "my-1 mb-4 -ml-2 w-[calc(100%+0.5rem)] rounded-panel bg-panel px-4 pt-3.5 pb-4 outline-2 outline-acento" : "pt-3 pb-5"
        }`}
      >
        <strong className={`text-subtitulo leading-tight font-extrabold ${estado === "pendiente" ? "text-texto-secundario" : ""}`}>{titulo}</strong>
        <span className={`text-ayuda ${estado === "falta" ? "font-bold text-alerta-texto" : "text-texto-secundario"}`}>{detalle}</span>
        {estado === "actual" && <span className="mt-1.5 self-start rounded-full bg-acento px-3 py-1 text-ayuda font-extrabold text-sobre-acento">Sigue aquí</span>}
      </button>
    </li>
  );
}

/**
 * Un elemento repetido (un tablero) en su lista (iteración 32, prototipos/ajustes-campo): la primera foto, el nombre, lo
 * que lo identifica en una línea y cuánto lleva. Tocarlo lo abre.
 */
export function FilaDeRepeticion({
  titulo,
  detalle,
  foto,
  faltan,
  avance,
  onClick,
  nueva = false,
}: {
  titulo: string;
  /** Lo que lo identifica, ya unido: "Sótano · 208 V · 3 fotos". */
  detalle: string;
  /** La primera foto, si tiene. */
  foto?: string | undefined;
  faltan: number;
  /** De 0 a 1: los obligatorios que ya tienen dato. */
  avance: number;
  onClick: () => void;
  /** Recién agregada a la vista: entra animada. Las que ya estaban no se animan otra vez al volver (iteración 27). */
  nueva?: boolean;
}) {
  return (
    <li className={nueva ? "motion-safe:animate-resaltar" : undefined}>
      <button
        type="button"
        onClick={onClick}
        className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 pr-3 pl-2.5 text-left active:bg-encima focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-foco"
      >
        {foto ? (
          <img src={foto} alt="" className="size-13 rounded-control object-cover" />
        ) : (
          <span aria-hidden className="grid size-13 place-items-center rounded-control bg-panel-hundido text-texto-terciario [&_svg]:size-5">
            <Camera />
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <strong className="truncate text-cuerpo font-semibold">{titulo}</strong>
          <span className="truncate text-ayuda text-texto-secundario">{detalle}</span>
          <span aria-hidden className="mt-2 h-1 overflow-hidden rounded-full bg-superficie-pista">
            <span className={`block h-full rounded-full ${faltan > 0 ? "bg-sync-pendiente" : "bg-sync-ok"}`} style={{ width: `${Math.round(avance * 100)}%` }} />
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-ayuda">
          {faltan > 0 ? <span className="font-medium text-alerta-texto">{`Faltan ${faltan}`}</span> : <><Check aria-hidden className="size-5 text-exito-texto" /><span className="sr-only">Completo</span></>}
          <ChevronRight aria-hidden className="size-[18px] text-texto-terciario" />
        </span>
      </button>
    </li>
  );
}

/** La lista de repeticiones: una sola caja con líneas. */
export function ListaDeRepeticiones({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <ul aria-label={etiqueta} className="overflow-hidden rounded-panel border border-division bg-panel [&>li+li]:border-t [&>li+li]:border-division">
      {children}
    </ul>
  );
}

/** Agregar otro elemento repetido: ancho, punteado, como un lugar vacío que se llena. */
export function BotonAgregar({ children, onClick, disabled, icono: Icono }: { children: ReactNode; onClick: () => void; disabled?: boolean; icono: LucideIcon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-panel border border-dashed border-borde-suave text-[14px] font-medium text-texto-secundario disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco [&_svg]:size-5"
    >
      <Icono aria-hidden />
      {children}
    </button>
  );
}

/**
 * Una sección en el repaso antes de enviar (iteración 32): lo que realmente lleva, con un visto o lo que falta en
 * ámbar. Toda la fila se toca para editar (Vestiaire Collective y Airbnb en Mobbin).
 */
export function FilaDeRepaso({ titulo, detalle, falta, vacio = false, onEditar, children }: { titulo: string; detalle: string; falta?: string | undefined; vacio?: boolean; onEditar: () => void; children?: ReactNode }) {
  return (
    <li className="border-t border-division first:border-t-0">
      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${titulo}`}
        className="grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-3 py-3 pr-3 pl-3.5 text-left active:bg-encima focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-foco [&>svg]:mt-px [&>svg]:size-[22px]"
      >
        {/* Sin datos y sin nada obligatorio: ni visto ni alerta, para no decir que está hecho. */}
        {falta ? <CircleAlert aria-hidden className="text-alerta-texto" /> : vacio ? <Circle aria-hidden className="text-texto-terciario" /> : <CircleCheck aria-hidden className="text-exito-texto" />}
        <span className="flex min-w-0 flex-col">
          <strong className="text-cuerpo font-semibold">{titulo}</strong>
          <span className="truncate text-ayuda text-texto-secundario">{detalle}</span>
          {falta && <span className="text-ayuda font-medium text-alerta-texto">{falta}</span>}
          {children}
        </span>
        <ChevronRight aria-hidden className="size-[18px] self-center text-texto-terciario" />
      </button>
    </li>
  );
}

/** Las cifras de lo que se envía, en una fila (fotos, tableros, materiales). */
export function CifrasDeRepaso({ cifras }: { cifras: readonly { valor: number; texto: string }[] }) {
  return (
    <dl className="grid auto-cols-fr grid-flow-col rounded-panel border border-division bg-panel">
      {cifras.map((c) => (
        <div key={c.texto} className="flex flex-col-reverse gap-px border-l border-division px-3 py-3 first:border-l-0">
          <dt className="text-ayuda text-texto-secundario">{c.texto}</dt>
          <dd className="text-[22px] leading-tight font-semibold tracking-tight tabular-nums">{c.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Repaso({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return (
    <ul aria-label={etiqueta} className="overflow-hidden rounded-panel border border-division bg-panel">
      {children}
    </ul>
  );
}

/**
 * Franja de sincronización (VSCO, Mobbin): una línea que dice si todo está a salvo, sin estorbar. Sin señal,
 * el punto late y dice que se puede seguir. Cuando la cola se vacía a la vista, dice «Todo subido» en verde
 * (iteración 27).
 */
export function FranjaSincronizacion({ enLinea, porSubir, guardado }: { enLinea: boolean; porSubir: number; guardado?: string | undefined }) {
  const antes = useRef(porSubir);
  const [recienSubido, setRecienSubido] = useState(false);
  useEffect(() => {
    if (antes.current > 0 && porSubir === 0) setRecienSubido(true);
    if (porSubir > 0) setRecienSubido(false);
    antes.current = porSubir;
  }, [porSubir]);
  const pendiente = porSubir === 1 ? "1 levantamiento espera" : `${porSubir} levantamientos esperan`;
  const texto = enLinea
    ? porSubir > 0
      ? `${guardado ?? "Guardado en el teléfono"} · subiendo ${porSubir === 1 ? "1 levantamiento" : `${porSubir} levantamientos`}`
      : recienSubido
        ? "Todo subido"
        : `${guardado ?? "Guardado en el teléfono"} · todo subido`
    : porSubir > 0
      ? `Sin señal · ${pendiente} para subir. Puedes seguir.`
      : `Sin señal · ${guardado ? guardado.charAt(0).toLowerCase() + guardado.slice(1) : "todo queda en el teléfono"}. Puedes seguir.`;
  return (
    <p role="status" className={`flex items-center gap-2 rounded-control border border-division bg-panel px-3 py-2 text-ayuda font-bold ${enLinea && recienSubido ? "text-exito-texto" : "text-texto-secundario"}`}>
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${enLinea ? "bg-sync-ok" : "bg-sync-pendiente motion-safe:animate-pulse"}`} />
      {texto}
    </p>
  );
}

export interface DatoFaltante {
  clave: string;
  /** El dato: "Ubicación del tablero". */
  titulo: string;
  /** Dónde está: "Tableros · Tablero 1". */
  donde?: string | undefined;
  ir: () => void;
}

/**
 * Lo que falta, como tarjetas que se pueden tocar (Cleo y Tesla en Mobbin: cada dato en rojo, con su lugar).
 * Entran una tras otra; con `sacudir` cambiando, la lista se sacude para llamar la atención.
 */
export function ListaFaltantes({ datos, sacudir = 0, titulo }: { datos: readonly DatoFaltante[]; sacudir?: number; titulo: string }) {
  return (
    <section key={sacudir} aria-label={titulo} className={`flex flex-col gap-2.5 rounded-panel bg-peligro-fondo p-3.5 ${sacudir > 0 ? "motion-safe:animate-[sacudida_420ms_var(--t-curva)]" : ""}`}>
      <p className="flex items-center gap-2.5 px-1 text-cuerpo font-extrabold">
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-error text-ayuda font-extrabold text-fondo motion-safe:animate-[latido_1.6s_ease-in-out_3]">
          {datos.length}
        </span>
        {titulo}
      </p>
      <ul className="flex flex-col gap-2">
        {datos.map((d, i) => (
          <li key={d.clave} className="motion-safe:animate-subir" style={{ animationDelay: `${i * 60}ms` }}>
            <button
              type="button"
              onClick={d.ir}
              className="flex w-full items-center gap-3 rounded-control bg-panel px-3.5 py-3 text-left active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              <CircleAlert aria-hidden className="size-5 shrink-0 text-error" />
              <span className="flex min-w-0 grow flex-col">
                <strong className="text-cuerpo leading-snug">{d.titulo}</strong>
                {d.donde && <span className="text-ayuda text-texto-secundario">{d.donde}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-ayuda font-extrabold text-texto-secundario [&_svg]:size-4">
                Ir
                <ChevronRight aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export type EstadoDeProceso = "enviando" | "esperando" | "listo" | "error";
export interface EtapaDeProceso {
  /** Fija aunque el texto cambie ("1 de 3", "2 de 3"): la etapa no se vuelve a montar ni a animar. */
  clave: string;
  texto: string;
  estado: "hecho" | "en_curso" | "espera" | "error";
}

/**
 * El envío como proceso real (Fiverr y Mindvalley en Mobbin): un anillo que avanza con lo que de verdad subió,
 * las etapas que se van marcando y, solo cuando oficina lo recibe, el chulo. Sin `avance`, el anillo gira.
 */
export function ProcesoDeEnvio({
  estado,
  avance,
  titulo,
  detalle,
  etapas,
}: {
  estado: EstadoDeProceso;
  /** De 0 a 1, o `null` si no se puede medir todavía. */
  avance: number | null;
  titulo: string;
  detalle: string;
  etapas: readonly EtapaDeProceso[];
}) {
  const listo = estado === "listo";
  const color = listo ? "stroke-sync-ok" : estado === "error" ? "stroke-error" : estado === "esperando" ? "stroke-sync-pendiente" : "stroke-superficie";
  const medido = listo ? 1 : avance;
  return (
    <div className="flex flex-col items-center gap-5 pt-2 text-center">
      <div className="relative size-32">
        <svg viewBox="0 0 120 120" className={`size-full -rotate-90 ${medido === null && !listo ? "motion-safe:animate-[giro_1.1s_linear_infinite]" : ""}`} aria-hidden>
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-panel-hundido" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            strokeWidth="8"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            strokeDashoffset={medido === null ? 72 : 100 - Math.max(4, medido * 100)}
            className={`${color} transition-[stroke-dashoffset,stroke] duration-700 ease-t motion-reduce:transition-none`}
          />
        </svg>
        <span aria-hidden className="absolute inset-0 grid place-items-center">
          {listo ? (
            <svg viewBox="0 0 120 120" className="size-20">
              <path d="M36 62l16 16 32-34" pathLength={100} fill="none" className="stroke-sync-ok [stroke-dasharray:100] motion-safe:animate-[trazo_450ms_250ms_var(--t-curva)_both]" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span className="text-titulo font-extrabold tabular-nums">{medido === null ? "…" : `${Math.round(medido * 100)}%`}</span>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-titulo leading-tight font-extrabold">{titulo}</h2>
        <p className="mx-auto max-w-[32ch] text-cuerpo leading-relaxed text-texto-secundario" aria-live="polite">
          {detalle}
        </p>
      </div>
      <ol className="flex w-full flex-col gap-1 rounded-panel border border-division bg-panel p-2 text-left">
        {etapas.map((e) => (
          <li key={e.clave} className="flex items-center gap-3 rounded-control px-3 py-2.5">
            <span
              aria-hidden
              className={`grid size-7 shrink-0 place-items-center rounded-full [&_svg]:size-4 ${
                e.estado === "hecho" ? "bg-sync-ok text-fondo" : e.estado === "error" ? "bg-error text-fondo" : e.estado === "en_curso" ? "border-[3px] border-panel-hundido border-t-superficie motion-safe:animate-[giro_0.9s_linear_infinite]" : "border-2 border-dashed border-borde-suave"
              }`}
            >
              {e.estado === "hecho" && <Check strokeWidth={3} className="motion-safe:animate-aparecer" />}
            </span>
            <span className={`text-cuerpo ${e.estado === "espera" ? "text-texto-secundario" : "font-bold"}`}>{e.texto}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
