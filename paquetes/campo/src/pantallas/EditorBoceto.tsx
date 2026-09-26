import { useRef, useState, type PointerEvent as EventoPuntero } from "react";
import { getStroke } from "perfect-freehand";
import { bocetoVacio, LIENZO, LIMITES_BOCETO, type DocumentoBoceto, type ElementoBoceto, type Punto, type PuntoConPresion } from "@teins/dominio";
import { Aviso, Boceto, Boton, CampoTexto, Check, ElementoDeBoceto, GrupoDeOpciones, Redo2, Undo2 } from "@teins/ui";

/**
 * Editor de bocetos (ADR-0019): trazo libre, línea recta, texto, borrador por trazo, deshacer y rehacer,
 * sobre cuadrícula. Lápiz con presión y rechazo de la palma; dos dedos acercan y mueven la hoja.
 * Cada cambio se guarda al instante en el teléfono (ADR-0004). Se carga aparte, solo al dibujar: no pesa
 * en el arranque de campo (ADR-0011).
 */
type Herramienta = "trazo" | "linea" | "texto" | "borrador";
const HERRAMIENTAS = [
  { valor: "trazo", texto: "Trazo" },
  { valor: "linea", texto: "Línea" },
  { valor: "texto", texto: "Texto" },
  { valor: "borrador", texto: "Borrador" },
] as const;
const GROSOR_TRAZO = 7;
const GROSOR_LINEA = 4;
const TAMANO_TEXTO = 28;
/** Tolerancia del borrador, en unidades del lienzo a escala 1. */
const TOLERANCIA = 16;
const ESCALA_MAXIMA = 4;

type EnCurso =
  | { tipo: "trazo"; puntero: number; puntos: PuntoConPresion[]; lapiz: boolean }
  | { tipo: "linea"; puntero: number; desde: Punto; hasta: Punto };

interface Vista {
  escala: number;
  x: number;
  y: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Contorno del trazo con perfect-freehand; con lápiz usa su presión, con el dedo la simula. */
function contornoDe(puntos: readonly PuntoConPresion[], lapiz: boolean): Punto[] {
  const contorno = getStroke(puntos.map(([x, y, presion]) => [x, y, presion]), { size: GROSOR_TRAZO, thinning: 0.55, smoothing: 0.5, streamline: 0.45, simulatePressure: !lapiz });
  const redondeado = contorno.map(([x, y]) => [r1(x!), r1(y!)] as const);
  // Un toque es un punto: el contorno necesita al menos tres vértices.
  return redondeado.length >= 3 ? redondeado : [[puntos[0]![0] - 2, puntos[0]![1] - 2], [puntos[0]![0] + 2, puntos[0]![1] - 2], [puntos[0]![0], puntos[0]![1] + 2]];
}

function distanciaASegmento(p: Punto, a: Punto, b: Punto): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const largo = dx * dx + dy * dy;
  const t = largo === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** El elemento bajo el dedo, del más reciente al más antiguo. */
function elementoEn(elementos: readonly ElementoBoceto[], p: Punto, tolerancia: number): number {
  for (let i = elementos.length - 1; i >= 0; i--) {
    const e = elementos[i]!;
    if (e.tipo === "trazo") {
      const tramo = (j: number): Punto => [e.puntos[j]![0], e.puntos[j]![1]];
      if (e.puntos.some((_, j) => distanciaASegmento(p, tramo(j), tramo(Math.min(j + 1, e.puntos.length - 1))) <= tolerancia + e.grosor / 2)) return i;
    }
    if (e.tipo === "linea" && distanciaASegmento(p, e.desde, e.hasta) <= tolerancia + e.grosor / 2) return i;
    if (e.tipo === "texto" && p[0] >= e.en[0] - tolerancia && p[0] <= e.en[0] + e.texto.length * e.tamano * 0.6 + tolerancia && p[1] >= e.en[1] - e.tamano - tolerancia && p[1] <= e.en[1] + tolerancia) return i;
  }
  return -1;
}

export default function EditorBoceto({
  etiqueta,
  inicial,
  guardar,
  cerrar,
}: {
  etiqueta: string;
  inicial: DocumentoBoceto | null;
  guardar: (documento: DocumentoBoceto) => Promise<void>;
  cerrar: () => void;
}) {
  const [elementos, setElementos] = useState<readonly ElementoBoceto[]>(inicial?.elementos ?? []);
  const [deshacer, setDeshacer] = useState<(readonly ElementoBoceto[])[]>([]);
  const [rehacer, setRehacer] = useState<(readonly ElementoBoceto[])[]>([]);
  const [herramienta, setHerramienta] = useState<Herramienta>("trazo");
  const [enCurso, setEnCurso] = useState<EnCurso | null>(null);
  const [vista, setVista] = useState<Vista>({ escala: 1, x: 0, y: 0 });
  const [textoEn, setTextoEn] = useState<Punto | null>(null);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"guardado" | "guardando" | "error">("guardado");

  const lienzo = useRef<SVGSVGElement>(null);
  const marco = useRef<HTMLDivElement>(null);
  const punteros = useRef(new Map<number, { x: number; y: number; tipo: string }>());
  const lapizVisto = useRef(false);
  const gesto = useRef<{ distancia: number; medio: Punto; vista: Vista } | null>(null);
  const cadena = useRef(Promise.resolve());

  function persistir(nuevos: readonly ElementoBoceto[]) {
    setEstado("guardando");
    // En orden: cada guardado espera al anterior, así el último cambio siempre gana.
    cadena.current = cadena.current.then(() =>
      guardar({ ...bocetoVacio(), elementos: nuevos }).then(
        () => setEstado("guardado"),
        () => setEstado("error"),
      ),
    );
  }

  function cambiar(nuevos: readonly ElementoBoceto[]) {
    setDeshacer((d) => [...d, elementos]);
    setRehacer([]);
    setElementos(nuevos);
    persistir(nuevos);
  }

  function deshacerUno() {
    const anterior = deshacer.at(-1);
    if (!anterior) return;
    setDeshacer((d) => d.slice(0, -1));
    setRehacer((r) => [...r, elementos]);
    setElementos(anterior);
    persistir(anterior);
  }

  function rehacerUno() {
    const siguiente = rehacer.at(-1);
    if (!siguiente) return;
    setRehacer((r) => r.slice(0, -1));
    setDeshacer((d) => [...d, elementos]);
    setElementos(siguiente);
    persistir(siguiente);
  }

  /** Del puntero al lienzo lógico: el rectángulo ya incluye el zoom y el desplazamiento. */
  function aLienzo(e: { clientX: number; clientY: number }): Punto {
    const rect = lienzo.current!.getBoundingClientRect();
    return [r1(((e.clientX - rect.left) / rect.width) * LIENZO.ancho), r1(((e.clientY - rect.top) / rect.height) * LIENZO.alto)];
  }

  function borrarEn(p: Punto) {
    const i = elementoEn(elementos, p, TOLERANCIA / vista.escala);
    if (i >= 0) cambiar(elementos.filter((_, j) => j !== i));
  }

  function alBajar(e: EventoPuntero<HTMLDivElement>) {
    if (e.pointerType === "pen") lapizVisto.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY, tipo: e.pointerType });
    const dedos = [...punteros.current.values()].filter((p) => p.tipo === "touch");

    // Dos dedos: acercar y mover la hoja; lo que se estaba dibujando se descarta.
    if (dedos.length === 2) {
      setEnCurso(null);
      const [a, b] = [dedos[0]!, dedos[1]!];
      gesto.current = { distancia: Math.hypot(a.x - b.x, a.y - b.y), medio: [(a.x + b.x) / 2, (a.y + b.y) / 2], vista };
      return;
    }
    // Rechazo de la palma: con un lápiz en uso, el dedo no dibuja.
    if (lapizVisto.current && e.pointerType === "touch") return;
    if (punteros.current.size > 1) return;

    const p = aLienzo(e);
    if (herramienta === "trazo") setEnCurso({ tipo: "trazo", puntero: e.pointerId, puntos: [[p[0], p[1], e.pointerType === "pen" ? e.pressure : 0.5]], lapiz: e.pointerType === "pen" });
    else if (herramienta === "linea") setEnCurso({ tipo: "linea", puntero: e.pointerId, desde: p, hasta: p });
    else if (herramienta === "borrador") borrarEn(p);
  }

  function alMover(e: EventoPuntero<HTMLDivElement>) {
    if (!punteros.current.has(e.pointerId)) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY, tipo: e.pointerType });
    if (gesto.current) {
      const dedos = [...punteros.current.values()].filter((p) => p.tipo === "touch");
      if (dedos.length < 2) return;
      const [a, b] = [dedos[0]!, dedos[1]!];
      const medio: Punto = [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const inicio = gesto.current;
      const escala = Math.min(ESCALA_MAXIMA, Math.max(1, inicio.vista.escala * (Math.hypot(a.x - b.x, a.y - b.y) / inicio.distancia)));
      const caja = marco.current!.getBoundingClientRect();
      // El punto de la hoja que estaba bajo el centro de los dedos sigue bajo él.
      const [mx0, my0] = [inicio.medio[0] - caja.left, inicio.medio[1] - caja.top];
      const [mx, my] = [medio[0] - caja.left, medio[1] - caja.top];
      const x = mx - ((mx0 - inicio.vista.x) * escala) / inicio.vista.escala;
      const y = my - ((my0 - inicio.vista.y) * escala) / inicio.vista.escala;
      // Sin salirse de la hoja.
      const limite = (valor: number, tamano: number) => Math.min(0, Math.max(tamano - tamano * escala, valor));
      setVista({ escala, x: limite(x, caja.width), y: limite(y, caja.height) });
      return;
    }
    if (!enCurso || enCurso.puntero !== e.pointerId) {
      if (herramienta === "borrador" && e.buttons > 0 && !(lapizVisto.current && e.pointerType === "touch")) borrarEn(aLienzo(e));
      return;
    }
    const p = aLienzo(e);
    if (enCurso.tipo === "trazo") {
      if (enCurso.puntos.length >= LIMITES_BOCETO.puntosPorTrazo) return;
      setEnCurso({ ...enCurso, puntos: [...enCurso.puntos, [p[0], p[1], e.pointerType === "pen" ? e.pressure : 0.5]] });
    } else {
      setEnCurso({ ...enCurso, hasta: p });
    }
  }

  function alSubir(e: EventoPuntero<HTMLDivElement>) {
    punteros.current.delete(e.pointerId);
    if (gesto.current) {
      if ([...punteros.current.values()].filter((p) => p.tipo === "touch").length < 2) gesto.current = null;
      return;
    }
    if (herramienta === "texto" && !(lapizVisto.current && e.pointerType === "touch") && e.type === "pointerup") {
      setTextoEn(aLienzo(e));
      return;
    }
    if (!enCurso || enCurso.puntero !== e.pointerId) return;
    setEnCurso(null);
    if (e.type !== "pointerup" || elementos.length >= LIMITES_BOCETO.elementos) return;
    if (enCurso.tipo === "trazo") {
      cambiar([...elementos, { tipo: "trazo", grosor: GROSOR_TRAZO, puntos: enCurso.puntos, contorno: contornoDe(enCurso.puntos, enCurso.lapiz) }]);
    } else if (Math.hypot(enCurso.hasta[0] - enCurso.desde[0], enCurso.hasta[1] - enCurso.desde[1]) > 3) {
      cambiar([...elementos, { tipo: "linea", grosor: GROSOR_LINEA, desde: enCurso.desde, hasta: enCurso.hasta }]);
    }
  }

  function ponerTexto() {
    const limpio = texto.trim().slice(0, LIMITES_BOCETO.texto);
    if (textoEn && limpio) cambiar([...elementos, { tipo: "texto", en: textoEn, texto: limpio, tamano: TAMANO_TEXTO }]);
    setTextoEn(null);
    setTexto("");
  }

  const vistaPrevia: ElementoBoceto | null =
    enCurso?.tipo === "trazo"
      ? { tipo: "trazo", grosor: GROSOR_TRAZO, puntos: enCurso.puntos, contorno: contornoDe(enCurso.puntos, enCurso.lapiz) }
      : enCurso?.tipo === "linea"
        ? { tipo: "linea", grosor: GROSOR_LINEA, desde: enCurso.desde, hasta: enCurso.hasta }
        : null;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Boceto: ${etiqueta}`} className="fixed inset-0 z-50 flex flex-col gap-3 overflow-y-auto bg-fondo p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-subtitulo font-extrabold">{etiqueta}</h2>
        <Boton variante="principal" icono={Check} onClick={cerrar}>
          Listo
        </Boton>
      </div>
      <div
        ref={marco}
        aria-label="Lienzo del boceto"
        className="relative w-full touch-none overflow-hidden rounded-panel border border-division bg-panel select-none"
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSubir}
        onPointerCancel={alSubir}
      >
        <div style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})`, transformOrigin: "0 0" }}>
          <Boceto ref={lienzo} ancho={LIENZO.ancho} alto={LIENZO.alto} cuadricula={LIENZO.cuadricula} elementos={elementos} etiqueta={etiqueta}>
            {vistaPrevia && <ElementoDeBoceto elemento={vistaPrevia} />}
          </Boceto>
        </div>
      </div>
      {textoEn ? (
        <div className="flex flex-col gap-3 rounded-panel border border-division bg-panel p-3">
          <CampoTexto etiqueta="Texto del boceto" valorInicial="" onCambio={setTexto} />
          <div className="flex gap-2">
            <Boton onClick={ponerTexto}>Poner texto</Boton>
            <Boton onClick={() => setTextoEn(null)}>Cancelar</Boton>
          </div>
        </div>
      ) : (
        <GrupoDeOpciones etiqueta="Herramienta" valor={herramienta} onCambio={setHerramienta} opciones={HERRAMIENTAS} />
      )}
      <div className="flex flex-wrap gap-2">
        <Boton icono={Undo2} disabled={deshacer.length === 0} onClick={deshacerUno}>
          Deshacer
        </Boton>
        <Boton icono={Redo2} disabled={rehacer.length === 0} onClick={rehacerUno}>
          Rehacer
        </Boton>
        <Boton disabled={vista.escala === 1} onClick={() => setVista({ escala: 1, x: 0, y: 0 })}>
          Ver la hoja completa
        </Boton>
      </div>
      <p className="text-ayuda text-texto-secundario">
        {herramienta === "texto" ? "Toca la hoja donde va el texto." : herramienta === "borrador" ? "Toca un trazo para quitarlo." : "Dibuja con el dedo o el lápiz."} Con dos dedos,
        acerca y mueve la hoja.
      </p>
      {estado === "error" ? (
        <Aviso tono="error">No se pudo guardar el último cambio en el teléfono. Intenta de nuevo.</Aviso>
      ) : (
        <p className="text-ayuda text-texto-secundario" aria-live="polite">
          {estado === "guardando" ? "Guardando…" : "Guardado en este teléfono"}
        </p>
      )}
    </div>
  );
}
