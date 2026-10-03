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
 * Primero, la pantalla que ve quien recibe el teléfono (iteración 32): le habla a esa persona y le muestra qué va a
 * confirmar antes de pedirle nada (DoorDash Dasher y Jobber en Mobbin).
 */
export default function HojaDeFirma({
  declaracion,
  recibe,
  guardar,
  cerrar,
}: {
  declaracion: string;
  /** Lo que se confirma, para la pantalla de entrega. Sin visita (levantamiento suelto), solo el técnico. */
  recibe: { tecnico: string; cliente?: string | undefined; datos: readonly (readonly [string, string])[] };
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
  const [entregado, setEntregado] = useState(false);
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

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-constancia" data-tema="claro" className={`fixed inset-0 z-50 flex flex-col bg-panel pt-[env(safe-area-inset-top)] ${saliendo ? "animate-hoja-baja" : "motion-safe:animate-hoja-sube"}`}>
      <div className="flex items-center gap-1 py-1.5 pr-3 pl-1">
        <BotonIcono icono={X} etiqueta="Cancelar y volver al levantamiento" onClick={salir} />
        <h2 id="titulo-constancia" className="text-subtitulo font-extrabold">
          Constancia de visita
        </h2>
      </div>
      <div className={`flex grow flex-col gap-4 overflow-y-auto px-5 pt-1 pb-4 ${entregado ? "motion-safe:animate-fundir" : ""}`}>
        <p className="text-cuerpo leading-relaxed">{declaracion}</p>
        <CampoTexto etiqueta="Nombre de quien firma" autoComplete="name" valorInicial="" onCambio={setNombre} error={errores.nombre} />
        <CampoTexto etiqueta="Cargo (opcional)" autoComplete="organization-title" valorInicial="" onCambio={setCargo} />
        <div className="flex flex-col gap-2">
          <div
            aria-label="Espacio para firmar con el dedo"
            className={`relative touch-none overflow-hidden rounded-[20px] bg-fondo select-none ${errores.firma ? "outline-2 outline-error" : ""}`}
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSubir}
            onPointerCancel={alSubir}
          >
            <Firma ref={lienzo} ancho={LIENZO.ancho} alto={LIENZO.alto} recortar={false} elementos={trazos} etiqueta={trazos.length > 0 ? "Su firma" : "Recuadro para firmar, vacío"}>
              {/* Línea base: dónde va la firma (Acorns, en Mobbin). */}
              <line x1={60} x2={940} y1={560} y2={560} className="stroke-borde-control" strokeWidth={4} />
              {enProceso && <ElementoDeBoceto elemento={enProceso} />}
            </Firma>
            <span className="pointer-events-none absolute bottom-3 left-6 text-ayuda text-texto-secundario">Firme sobre la línea</span>
          </div>
          {errores.firma && <MensajeError id="error-firma">{errores.firma}</MensajeError>}
        </div>
        {estado === "error" && <Aviso tono="error">No se pudo guardar la firma en el teléfono. Intente de nuevo.</Aviso>}
      </div>
      <div className="flex items-center gap-2 px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={trazos.length === 0 || estado === "guardando"}
          onClick={() => setTrazos([])}
          className="h-15 px-4 text-cuerpo font-extrabold text-texto-secundario underline underline-offset-3 disabled:no-underline disabled:opacity-40"
        >
          Borrar
        </button>
        <button
          type="button"
          aria-busy={estado === "guardando" || undefined}
          onClick={() => void firmarUnaVez()}
          className="h-15 grow rounded-control bg-superficie text-subtitulo font-extrabold text-sobre-superficie active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
        >
          Firmar
        </button>
      </div>
      {!entregado && (
        <div className="absolute inset-0 flex flex-col bg-fondo pt-[env(safe-area-inset-top)]">
          <div className="flex min-h-13 items-center justify-between pt-1 pr-2 pl-5">
            <Logo alto={26} />
            <Boton variante="fantasma" onClick={salir}>
              Cancelar
            </Boton>
          </div>
          <div className="flex grow flex-col gap-5 overflow-y-auto px-5 pt-6">
            <p className="text-ayuda font-medium text-texto-secundario">Constancia de visita</p>
            <h2 className="text-[30px] leading-[1.12] font-semibold tracking-tight">{recibe.cliente ? `${recibe.cliente}, confirme la visita de ${recibe.tecnico}` : `Confirme la visita de ${recibe.tecnico}`}</h2>
            {recibe.datos.length > 0 && (
              <dl className="flex flex-col border-t border-division">
                {recibe.datos.map(([dato, valor]) => (
                  <div key={dato} className="flex justify-between gap-4 border-b border-division py-3 text-cuerpo">
                    <dt className="text-texto-secundario">{dato}</dt>
                    <dd className="text-right font-medium">{valor}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
          <div className="flex flex-col gap-2.5 px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setEntregado(true)}
              className="h-control w-full rounded-control bg-superficie text-cuerpo font-semibold text-sobre-superficie active:scale-[0.98] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              Revisar y firmar
            </button>
            <p className="text-center text-ayuda text-texto-secundario">Su firma solo confirma que la visita ocurrió.</p>
          </div>
        </div>
      )}
    </div>
  );
}
