import { useRef, useState, type PointerEvent as EventoPuntero } from "react";
import { bocetoVacio, LIENZO, LIMITES_BOCETO, type DocumentoBoceto, type ElementoBoceto, type Punto, type PuntoConPresion } from "@teins/dominio";
import { Aviso, Boton, BotonIcono, CampoTexto, ElementoDeBoceto, Firma, MensajeError, X } from "@teins/ui";
import { contornoDe } from "../dibujo/trazo";

const GROSOR = 9;
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Constancia de visita para firmar (ADR-0024). La lee y la firma quien recibió la visita, no el técnico: por eso
 * trata de usted. Pantalla completa, como el editor de bocetos, para que la firma tenga espacio. Se carga aparte.
 */
export default function HojaDeFirma({
  declaracion,
  guardar,
  cerrar,
}: {
  declaracion: string;
  guardar: (documento: DocumentoBoceto, datos: { nombre: string; cargo: string }) => Promise<void>;
  cerrar: () => void;
}) {
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
      cerrar();
    } catch {
      setEstado("error");
    }
  }

  const enProceso: ElementoBoceto | null = enCurso ? { tipo: "trazo", grosor: GROSOR, puntos: enCurso.puntos, contorno: contornoDe(enCurso.puntos, enCurso.lapiz, GROSOR) } : null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="titulo-constancia" className="fixed inset-0 z-50 flex flex-col bg-panel">
      <div className="flex items-center gap-1 py-1.5 pr-3 pl-1">
        <BotonIcono icono={X} etiqueta="Cancelar y volver al levantamiento" onClick={cerrar} />
        <h2 id="titulo-constancia" className="text-subtitulo font-extrabold">
          Constancia de visita
        </h2>
      </div>
      <div className="flex grow flex-col gap-4 overflow-y-auto px-4 pt-2 pb-4">
        <p className="text-subtitulo leading-snug">{declaracion}</p>
        <CampoTexto etiqueta="Nombre de quien firma" autoComplete="name" valorInicial="" onCambio={setNombre} error={errores.nombre} />
        <CampoTexto etiqueta="Cargo (opcional)" autoComplete="organization-title" valorInicial="" onCambio={setCargo} />
        <div className="flex flex-col gap-2">
          <span className="text-cuerpo font-bold">Firma</span>
          <div
            aria-label="Espacio para firmar con el dedo"
            className={`relative touch-none overflow-hidden rounded-panel border-[1.5px] bg-panel select-none ${errores.firma ? "border-error" : "border-borde-control"}`}
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSubir}
            onPointerCancel={alSubir}
          >
            <Firma ref={lienzo} ancho={LIENZO.ancho} alto={LIENZO.alto} recortar={false} elementos={trazos} etiqueta={trazos.length > 0 ? "Su firma" : "Recuadro para firmar, vacío"}>
              {/* Línea guía: dónde va la firma. */}
              <line x1={60} x2={940} y1={560} y2={560} className="stroke-borde-suave" strokeWidth={4} strokeDasharray="16 12" />
              {enProceso && <ElementoDeBoceto elemento={enProceso} />}
            </Firma>
            <span className="pointer-events-none absolute bottom-3 left-4 text-ayuda text-texto-secundario">Firme con el dedo sobre la línea</span>
          </div>
          {errores.firma && <MensajeError id="error-firma">{errores.firma}</MensajeError>}
        </div>
        {estado === "error" && <Aviso tono="error">No se pudo guardar la firma en el teléfono. Intente de nuevo.</Aviso>}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-division px-4 pt-3 pb-4">
        <Boton disabled={trazos.length === 0 || estado === "guardando"} onClick={() => setTrazos([])}>
          Borrar
        </Boton>
        <Boton variante="principal" cargando={estado === "guardando"} onClick={() => void firmar()}>
          Firmar
        </Boton>
      </div>
    </div>
  );
}
