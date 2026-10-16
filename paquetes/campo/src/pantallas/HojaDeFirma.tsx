import { useEffect, useRef, useState, type PointerEvent as EventoPuntero } from "react";
import { bocetoVacio, LIENZO, LIMITES_BOCETO, type DocumentoBoceto, type ElementoBoceto, type Punto, type PuntoConPresion } from "@teins/dominio";
import { Aviso, Boton, BotonIcono, CampoTexto, ElementoDeBoceto, Firma, Logo, MensajeError, useCapaQueSale, useSinRepetir, X } from "@teins/ui";
import { contornoDe } from "../dibujo/trazo";

const GROSOR = 9;
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Constancia de visita para firmar (ADR-0024). La lee y la firma quien recibió la visita, no el técnico: por eso
 * trata de usted. Pantalla completa, como el editor de bocetos, para que la firma tenga espacio. Se carga aparte.
 *
 * Una sola pantalla (iteración 34, prototipos/informe-y-firma): le habla a quien recibe el teléfono, le muestra la
 * declaración exacta que firma, su nombre y cargo en una fila y el recuadro para firmar (Fresha y Liven en Mobbin).
 */
export default function HojaDeFirma({
  declaracion,
  recibe,
  guardar,
  cerrar,
}: {
  declaracion: string;
  /** A quién se le habla: el técnico y, si hay visita, el cliente. */
  recibe: { tecnico: string; cliente?: string | undefined };
  guardar: (documento: DocumentoBoceto, datos: { nombre: string; cargo: string }) => Promise<void>;
  cerrar: () => void;
}) {
  // Sube al abrirse y baja al cerrarse (iteración 27).
  const [saliendo, salir] = useCapaQueSale(cerrar);
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [trazos, setTrazos] = useState<readonly ElementoBoceto[]>([]);
  const [enCurso, setEnCurso] = useState<{ puntero: number; puntos: PuntoConPresion[]; lapiz: boolean } | null>(null);
  const [errores, setErrores] = useState<{ nombre?: string | undefined; firma?: string | undefined }>({});
  const [estado, setEstado] = useState<"firmando" | "guardando" | "error">("firmando");
  const lienzo = useRef<SVGSVGElement>(null);
  const lapizVisto = useRef(false);

  function aLienzo(e: { clientX: number; clientY: number }): Punto {
    const rect = lienzo.current!.getBoundingClientRect();
    return [r1(((e.clientX - rect.left) / rect.width) * LIENZO.ancho), r1(((e.clientY - rect.top) / rect.height) * LIENZO.alto)];
  }

  function alBajar(e: EventoPuntero<HTMLDivElement>) {
    if (e.pointerType === "pen") lapizVisto.current = true;
    // Rechazo de la palma: con un lápiz en uso, el dedo no firma.
    if (enCurso || (lapizVisto.current && e.pointerType === "touch")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = aLienzo(e);
    setEnCurso({ puntero: e.pointerId, puntos: [[x, y, e.pointerType === "pen" ? e.pressure : 0.5]], lapiz: e.pointerType === "pen" });
  }

  function alMover(e: EventoPuntero<HTMLDivElement>) {
    if (!enCurso || enCurso.puntero !== e.pointerId || enCurso.puntos.length >= LIMITES_BOCETO.puntosPorTrazo) return;
    const [x, y] = aLienzo(e);
    setEnCurso({ ...enCurso, puntos: [...enCurso.puntos, [x, y, e.pointerType === "pen" ? e.pressure : 0.5]] });
  }

  function alSubir(e: EventoPuntero<HTMLDivElement>) {
    if (!enCurso || enCurso.puntero !== e.pointerId) return;
    setEnCurso(null);
    if (e.type !== "pointerup" || trazos.length >= LIMITES_BOCETO.elementos) return;
    setTrazos([...trazos, { tipo: "trazo", grosor: GROSOR, puntos: enCurso.puntos, contorno: contornoDe(enCurso.puntos, enCurso.lapiz, GROSOR) }]);
    setErrores((actuales) => ({ ...actuales, firma: undefined }));
  }

  async function firmar() {
    const faltan = { nombre: nombre.trim() ? undefined : "Escriba su nombre.", firma: trazos.length > 0 ? undefined : "Firme en el recuadro." };
    setErrores(faltan);
    if (faltan.nombre || faltan.firma) return;
    setEstado("guardando");
    try {
      await guardar({ ...bocetoVacio(), elementos: trazos }, { nombre, cargo });
      salir();
    } catch {
      setEstado("error");
    }
  }

  // Un doble toque en "Firmar" guarda una sola vez (iteración 24c): el segundo llega antes de que se pinte "guardando".
  const [firmarUnaVez] = useSinRepetir(firmar);

  // Esc cierra como la equis, salvo mientras guarda (iteración 24c; con teclado, en una tableta).
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === "Escape" && estado !== "guardando") salir();
    };
    window.addEventListener("keydown", alTeclado);
    return () => window.removeEventListener("keydown", alTeclado);
  }, [estado, salir]);

  const enProceso: ElementoBoceto | null = enCurso ? { tipo: "trazo", grosor: GROSOR, puntos: enCurso.puntos, contorno: contornoDe(enCurso.puntos, enCurso.lapiz, GROSOR) } : null;

  const falta = !nombre.trim() && trazos.length === 0 ? "Faltan su nombre y su firma." : !nombre.trim() ? "Falta su nombre." : trazos.length === 0 ? "Falta la firma." : "Su firma solo confirma que la visita ocurrió.";

  return (
    <div role="dialog" aria-modal="true" aria-label="Constancia de visita" data-tema="claro" className={`fixed inset-0 z-50 flex flex-col bg-fondo pt-[env(safe-area-inset-top)] ${saliendo ? "animate-hoja-baja" : "motion-safe:animate-hoja-sube"}`}>
      <div className="flex min-h-13 shrink-0 items-center justify-between pt-1 pr-2 pl-5">
        <Logo alto={24} />
        <Boton variante="fantasma" onClick={salir} disabled={estado === "guardando"}>
          Cancelar
        </Boton>
      </div>
      <div className="flex grow flex-col gap-3.5 overflow-y-auto px-5 pt-1.5 pb-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-ayuda text-texto-secundario">{recibe.cliente ? `Constancia de visita · ${recibe.cliente}` : "Constancia de visita"}</p>
          <h2 className="text-[23px] leading-tight font-semibold tracking-tight">{`Confirme la visita de ${recibe.tecnico}`}</h2>
        </div>
        <p className="text-[15px] leading-relaxed text-texto-secundario">{declaracion}</p>
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
          <CampoTexto etiqueta="Su nombre" autoComplete="name" valorInicial="" onCambio={setNombre} error={errores.nombre} />
          <CampoTexto etiqueta="Cargo (opcional)" autoComplete="organization-title" valorInicial="" onCambio={setCargo} />
        </div>
        <div className="flex flex-col gap-2">
          <div
            aria-label="Espacio para firmar con el dedo"
            className={`relative touch-none overflow-hidden rounded-[16px] bg-panel shadow-[inset_0_0_0_1px_var(--t-borde-suave)] select-none ${errores.firma ? "outline-2 outline-error" : ""}`}
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSubir}
            onPointerCancel={alSubir}
          >
            <Firma ref={lienzo} ancho={LIENZO.ancho} alto={LIENZO.alto} recortar={false} elementos={trazos} etiqueta={trazos.length > 0 ? "Su firma" : "Recuadro para firmar, vacío"}>
              {/* Línea base: dónde va la firma (Acorns, en Mobbin). */}
              <line x1={60} x2={940} y1={580} y2={580} className="stroke-borde-control" strokeWidth={4} />
              {enProceso && <ElementoDeBoceto elemento={enProceso} />}
            </Firma>
            {trazos.length === 0 ? (
              <>
                <span aria-hidden className="pointer-events-none absolute bottom-[25%] left-6 text-[18px] text-texto-terciario">×</span>
                <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-ayuda text-texto-terciario">Firme aquí con el dedo</span>
              </>
            ) : (
              <button
                type="button"
                disabled={estado === "guardando"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setTrazos([])}
                className="absolute top-1.5 right-1.5 min-h-11 px-3 text-cuerpo text-superficie"
              >
                Borrar
              </button>
            )}
          </div>
          {errores.firma && <MensajeError id="error-firma">{errores.firma}</MensajeError>}
        </div>
        {estado === "error" && <Aviso tono="error">No se pudo guardar la firma en el teléfono. Intente de nuevo.</Aviso>}
      </div>
      <div className="flex shrink-0 flex-col gap-2 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          aria-busy={estado === "guardando" || undefined}
          onClick={() => void firmarUnaVez()}
          className="h-control w-full rounded-control bg-superficie text-cuerpo font-semibold text-sobre-superficie active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          Firmar
        </button>
        <p className="text-center text-ayuda text-texto-secundario" aria-live="polite">
          {falta}
        </p>
      </div>
    </div>
  );
}
