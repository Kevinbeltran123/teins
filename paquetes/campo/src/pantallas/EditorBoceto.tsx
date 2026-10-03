import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as EventoPuntero } from "react";
import {
  altoDeHoja,
  aVersion2,
  elementoDeSimbolo,
  hojaNueva,
  LIENZO,
  LIMITES_BOCETO,
  LIMITES_SIMBOLO,
  type DocumentoBoceto,
  type ElementoBoceto,
  type HojaBoceto,
  type Punto,
  type PuntoConPresion,
} from "@teins/dominio";
import {
  Aviso,
  Boceto,
  Boton,
  BotonHerramienta,
  CampoTexto,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  Dialogo,
  ElementoDeBoceto,
  Eraser,
  Move,
  Pastilla,
  Pencil,
  PenLine,
  Plus,
  Redo2,
  Ruler,
  Shapes,
  Trash,
  Type,
  Undo2,
  useCapaQueSale,
} from "@teins/ui";
import { ajustarAngulo, enderezar, pegarA, type Forma } from "../dibujo/enderezar";
import { cajaDe, centroDe, duplicar, elementoEn, escalar, girar, mover } from "../dibujo/transformar";
import { contornoDe as contornoDelTrazo } from "../dibujo/trazo";
import { acercar, aPantalla, encajar, VISTA_COMPLETA, type Encaje, type Tamano, type Vista } from "../dibujo/vista";
import type { SimboloLocal } from "../datos/modelo";
import { recordarReciente } from "../simbolos";
// La biblioteca de símbolos (ADR-0027) va con el editor: no pesa en el arranque de campo.
import HojaSimbolos from "./HojaSimbolos";

/**
 * Editor de bocetos a pantalla completa (ADR-0019, ADR-0026), como GoodNotes: una sola barra de iconos arriba y
 * la hoja en todo lo demás. Trazo (que se endereza si el dedo se queda quieto al terminar), cota, texto, mover
 * y borrador; varias hojas con nombre, que se pasan con dos dedos. Cada cambio se guarda al instante en el
 * teléfono (ADR-0004). Se carga aparte, solo al dibujar: no pesa en el arranque de campo (ADR-0011).
 */
type Herramienta = "trazo" | "cota" | "texto" | "mover" | "borrador";
const HERRAMIENTAS = [
  { valor: "trazo", etiqueta: "Trazo", icono: PenLine },
  { valor: "cota", etiqueta: "Cota", icono: Ruler },
  { valor: "texto", etiqueta: "Texto", icono: Type },
  { valor: "mover", etiqueta: "Mover", icono: Move },
  { valor: "borrador", etiqueta: "Borrador", icono: Eraser },
] as const;

const GROSOR_TRAZO = 7;
const GROSOR_FORMA = 5;
const GROSOR_COTA = 3;
const TAMANO_TEXTO = 28;
/** Distancias en píxeles de la pantalla; se pasan a unidades de la hoja según el acercamiento. */
const TOLERANCIA_PX = 16;
const PEGAR_PX = 18;
const MANIJA_PX = 24;
/** El dedo "quieto" puede temblar esto sin que cuente como movimiento. */
const QUIETO_PX = 5;
const ANILLO_MS = 150;
const ENDEREZAR_MS = 500;
const SEPARACION_PX = 16;

type EnCurso =
  | { tipo: "trazo"; puntero: number; puntos: PuntoConPresion[]; lapiz: boolean; forma: Forma | null }
  | { tipo: "cota"; puntero: number; desde: Punto; hasta: Punto }
  | { tipo: "arrastre"; puntero: number; modo: "mover" | "girar" | "escalar"; indice: number; original: ElementoBoceto; inicio: Punto; centro: Punto; elemento: ElementoBoceto | null };

type Pedido = { tipo: "texto"; en: Punto } | { tipo: "cota"; desde: Punto; hasta: Punto } | { tipo: "nombre"; indice: number; nueva: boolean };

/** Un paso del historial: las hojas y en cuál se estaba, para que deshacer vuelva a donde ocurrió el cambio. */
interface Paso {
  hojas: readonly HojaBoceto[];
  actual: number;
}

/** Dos dedos: antes de saber si acercan o pasan de hoja, "pendiente". Posiciones en píxeles del marco. */
interface Gesto {
  tipo: "pendiente" | "acercar" | "pasar";
  distancia: number;
  medio: Punto;
  vista: Vista;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const distancia = (a: Punto, b: Punto) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const contornoDe = (puntos: readonly PuntoConPresion[], lapiz: boolean) => contornoDelTrazo(puntos, lapiz, GROSOR_TRAZO);

function deForma(f: Forma): ElementoBoceto {
  if (f.tipo === "linea") return { tipo: "linea", grosor: GROSOR_FORMA, desde: f.desde, hasta: f.hasta };
  if (f.tipo === "polilinea") return { tipo: "polilinea", grosor: GROSOR_FORMA, puntos: f.puntos, cerrada: f.cerrada };
  return { tipo: "elipse", grosor: GROSOR_FORMA, centro: f.centro, radios: f.radios, giro: f.giro };
}

/** Donde se toman las paredes para pegarles otra: extremos de líneas y vértices de polilíneas. */
const extremosDe = (elementos: readonly ElementoBoceto[]): Punto[] => elementos.flatMap((e) => (e.tipo === "linea" ? [e.desde, e.hasta] : e.tipo === "polilinea" ? e.puntos : []));

export default function EditorBoceto({
  etiqueta,
  inicial,
  hojaInicial = 0,
  simbolos,
  guardar,
  cerrar,
  listo,
  entrar = true,
}: {
  etiqueta: string;
  inicial: DocumentoBoceto | null;
  hojaInicial?: number;
  /** La biblioteca del teléfono (ADR-0027); `undefined` mientras se lee. */
  simbolos: readonly SimboloLocal[] | undefined;
  guardar: (documento: DocumentoBoceto) => Promise<void>;
  cerrar: () => void;
  /** Como paso del recorrido (rediseño): "Listo", abajo a la derecha, sigue al paso siguiente. */
  listo?: (() => void) | undefined;
  /** false: ya subió la capa que lo esperaba (el paso del croquis); no sube otra vez. */
  entrar?: boolean;
}) {
  // Sube al abrirse y baja al cerrarse (iteración 27).
  const [saliendo, salir] = useCapaQueSale(cerrar);
  // Un boceto nuevo espera a medir la pantalla: su primera hoja tiene el alto del espacio libre.
  const [hojas, setHojas] = useState<readonly HojaBoceto[] | null>(() => (inicial ? aVersion2(inicial).hojas : null));
  const [actual, setActual] = useState(() => Math.max(0, Math.min(hojaInicial, (inicial ? aVersion2(inicial).hojas.length : 1) - 1)));
  const [historial, setHistorial] = useState<{ deshacer: Paso[]; rehacer: Paso[] }>({ deshacer: [], rehacer: [] });
  const [herramienta, setHerramienta] = useState<Herramienta>("trazo");
  const [enCurso, setEnCursoEstado] = useState<EnCurso | null>(null);
  const [vista, setVista] = useState<Vista>(VISTA_COMPLETA);
  const [marco, setMarco] = useState<Tamano | null>(null);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [textoPedido, setTextoPedido] = useState("");
  const [menuHojas, setMenuHojas] = useState(false);
  const [biblioteca, setBiblioteca] = useState(false);
  const [deslizar, setDeslizarEstado] = useState(0);
  const [entrada, setEntrada] = useState<"siguiente" | "anterior" | null>(null);
  const [anillo, setAnillo] = useState<Punto | null>(null);
  const [estado, setEstado] = useState<"guardado" | "guardando" | "error">("guardado");

  const marcoRef = useRef<HTMLDivElement>(null);
  const lienzo = useRef<SVGSVGElement>(null);
  const enCursoRef = useRef<EnCurso | null>(null);
  const punteros = useRef(new Map<number, { x: number; y: number; tipo: string }>());
  const lapizVisto = useRef(false);
  const gesto = useRef<Gesto | null>(null);
  const quieto = useRef<{ ancla: Punto; relojes: number[] } | null>(null);
  const cadena = useRef(Promise.resolve());
  const deslizarRef = useRef(0);

  const hoja = hojas?.[actual];
  const encaje: Encaje | null = marco && hoja ? encajar(marco, hoja) : null;
  const pxPorUnidad = encaje ? encaje.escala * vista.escala : 1;
  const unidades = (px: number) => px / pxPorUnidad;

  function setDeslizar(px: number) {
    deslizarRef.current = px;
    setDeslizarEstado(px);
  }

  function setEnCurso(valor: EnCurso | null) {
    enCursoRef.current = valor;
    setEnCursoEstado(valor);
  }

  // El espacio que dejan los controles: con él se encaja la hoja y se crea la primera de un boceto nuevo.
  useLayoutEffect(() => {
    const elemento = marcoRef.current!;
    const medir = () => {
      const tamano = { ancho: elemento.clientWidth, alto: elemento.clientHeight };
      if (tamano.ancho === 0 || tamano.alto === 0) return;
      setMarco(tamano);
      setVista(VISTA_COMPLETA);
      setHojas((h) => h ?? [hojaNueva("Hoja 1", altoDeHoja(tamano.ancho, tamano.alto))]);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  // En el iPhone, deslizar desde el borde de la pantalla vuelve atrás: sobre la hoja, ese borde es para dibujar.
  useEffect(() => {
    const elemento = marcoRef.current!;
    const alTocar = (evento: TouchEvent) => {
      const x = evento.touches[0]?.clientX ?? 0;
      if (x < 24 || x > window.innerWidth - 24) evento.preventDefault();
    };
    elemento.addEventListener("touchstart", alTocar, { passive: false });
    return () => elemento.removeEventListener("touchstart", alTocar);
  }, []);

  useEffect(() => () => quieto.current?.relojes.forEach(clearTimeout), []);

  function persistir(nuevas: readonly HojaBoceto[]) {
    setEstado("guardando");
    // En orden: cada guardado espera al anterior, así el último cambio siempre gana.
    cadena.current = cadena.current.then(() =>
      guardar({ formato: "teins-boceto", version: 2, cuadricula: LIENZO.cuadricula, hojas: nuevas }).then(
        () => setEstado("guardado"),
        () => setEstado("error"),
      ),
    );
  }

  function aplicar(paso: Paso) {
    setHojas(paso.hojas);
    if (paso.actual !== actual) {
      setActual(paso.actual);
      setVista(VISTA_COMPLETA);
    }
    persistir(paso.hojas);
  }

  function cambiar(siguiente: Paso) {
    if (!hojas) return;
    setHistorial((h) => ({ deshacer: [...h.deshacer, { hojas, actual }], rehacer: [] }));
    aplicar(siguiente);
  }

  const cambiarElementos = (elementos: readonly ElementoBoceto[]) => cambiar({ hojas: hojas!.map((h, i) => (i === actual ? { ...h, elementos } : h)), actual });

  function deshacerUno() {
    const anterior = historial.deshacer.at(-1);
    if (!anterior || !hojas) return;
    setHistorial((h) => ({ deshacer: h.deshacer.slice(0, -1), rehacer: [...h.rehacer, { hojas, actual }] }));
    setSeleccion(null);
    aplicar(anterior);
  }

  function rehacerUno() {
    const siguiente = historial.rehacer.at(-1);
    if (!siguiente || !hojas) return;
    setHistorial((h) => ({ rehacer: h.rehacer.slice(0, -1), deshacer: [...h.deshacer, { hojas, actual }] }));
    setSeleccion(null);
    aplicar(siguiente);
  }

  function irA(indice: number, lado: "siguiente" | "anterior") {
    setActual(indice);
    setEntrada(lado);
    setVista(VISTA_COMPLETA);
    setSeleccion(null);
    setMenuHojas(false);
  }

  function agregarHoja() {
    if (!hojas || !marco || hojas.length >= LIMITES_BOCETO.hojas) return;
    const nueva = hojaNueva(`Hoja ${hojas.length + 1}`, altoDeHoja(marco.ancho, marco.alto));
    cambiar({ hojas: [...hojas, nueva], actual: hojas.length });
    irA(hojas.length, "siguiente");
    // El nombre sale en el informe: se pide al crearla, cuando se sabe qué piso o cuarto es.
    setTextoPedido(nueva.nombre);
    setPedido({ tipo: "nombre", indice: hojas.length, nueva: true });
  }

  function quitarHoja() {
    setMenuHojas(false);
    if (!hojas || hojas.length <= 1) return;
    setSeleccion(null);
    cambiar({ hojas: hojas.filter((_, i) => i !== actual), actual: Math.max(0, actual - 1) });
  }

  function elegir(valor: Herramienta) {
    setHerramienta(valor);
    setSeleccion(null);
  }

  /** Del puntero a la hoja: el rectángulo del SVG ya incluye el acercamiento y el corrimiento. */
  function aLienzo(e: { clientX: number; clientY: number }): Punto {
    const rect = lienzo.current!.getBoundingClientRect();
    return [r1(((e.clientX - rect.left) / rect.width) * hoja!.ancho), r1(((e.clientY - rect.top) / rect.height) * hoja!.alto)];
  }

  function enMarco(p: { x: number; y: number }): Punto {
    const rect = marcoRef.current!.getBoundingClientRect();
    return [p.x - rect.left, p.y - rect.top];
  }

  const dedos = () => [...punteros.current.values()].filter((p) => p.tipo === "touch");
  const pegar = (p: Punto) => pegarA(p, extremosDe(hoja!.elementos), unidades(PEGAR_PX));

  function pegarForma(f: Forma): Forma {
    if (f.tipo === "linea") return { ...f, desde: pegar(f.desde), hasta: pegar(f.hasta) };
    if (f.tipo === "polilinea" && !f.cerrada) return { ...f, puntos: f.puntos.map((p, i) => (i === 0 || i === f.puntos.length - 1 ? pegar(p) : p)) };
    return f;
  }

  function pararQuieto() {
    quieto.current?.relojes.forEach(clearTimeout);
    quieto.current = null;
    setAnillo(null);
  }

  /** Enderezar (ADR-0026): si el dedo se queda quieto medio segundo, el trazo se vuelve la forma que parece. */
  function vigilarQuieto(e: { clientX: number; clientY: number }) {
    const aqui: Punto = [e.clientX, e.clientY];
    if (quieto.current && distancia(aqui, quieto.current.ancla) < QUIETO_PX) return;
    pararQuieto();
    const en = aLienzo(e);
    quieto.current = {
      ancla: aqui,
      relojes: [
        window.setTimeout(() => {
          const ec = enCursoRef.current;
          if (ec?.tipo === "trazo" && !ec.forma && ec.puntos.length > 2) setAnillo(en);
        }, ANILLO_MS),
        window.setTimeout(() => {
          setAnillo(null);
          const ec = enCursoRef.current;
          if (ec?.tipo !== "trazo" || ec.forma) return;
          const forma = enderezar(ec.puntos.map(([x, y]) => [x, y] as const));
          if (!forma) return;
          setEnCurso({ ...ec, forma: pegarForma(forma) });
          navigator.vibrate?.(10);
        }, ENDEREZAR_MS),
      ],
    };
  }

  function borrarEn(p: Punto) {
    const i = elementoEn(hoja!.elementos, p, unidades(TOLERANCIA_PX));
    if (i >= 0) cambiarElementos(hoja!.elementos.filter((_, j) => j !== i));
  }

  /** La caja del elemento elegido y sus manijas: el círculo de arriba gira (salvo el texto), la esquina cambia el tamaño. */
  function marcasDe(e: ElementoBoceto) {
    const c = cajaDe(e);
    const margen = unidades(10);
    const caja = { x: c.x - margen, y: c.y - margen, ancho: c.ancho + 2 * margen, alto: c.alto + 2 * margen };
    return {
      caja,
      centro: centroDe(c),
      girar: e.tipo === "texto" ? null : ([caja.x + caja.ancho / 2, caja.y - unidades(36)] as Punto),
      escalar: [caja.x + caja.ancho, caja.y + caja.alto] as Punto,
    };
  }

  function empezarArrastre(puntero: number, p: Punto) {
    const elementos = hoja!.elementos;
    const arrastre = (modo: "mover" | "girar" | "escalar", indice: number) => {
      const original = elementos[indice]!;
      setEnCurso({ tipo: "arrastre", puntero, modo, indice, original, inicio: p, centro: centroDe(cajaDe(original)), elemento: null });
    };
    if (seleccion !== null && elementos[seleccion]) {
      const m = marcasDe(elementos[seleccion]);
      if (m.girar && distancia(p, m.girar) < unidades(MANIJA_PX)) return arrastre("girar", seleccion);
      if (distancia(p, m.escalar) < unidades(MANIJA_PX)) return arrastre("escalar", seleccion);
      if (p[0] >= m.caja.x && p[0] <= m.caja.x + m.caja.ancho && p[1] >= m.caja.y && p[1] <= m.caja.y + m.caja.alto) return arrastre("mover", seleccion);
    }
    const i = elementoEn(elementos, p, unidades(TOLERANCIA_PX));
    setSeleccion(i >= 0 ? i : null);
    if (i >= 0) arrastre("mover", i);
  }

  function arrastrar(ec: Extract<EnCurso, { tipo: "arrastre" }>, p: Punto) {
    let elemento: ElementoBoceto;
    if (ec.modo === "mover") elemento = mover(ec.original, p[0] - ec.inicio[0], p[1] - ec.inicio[1]);
    else if (ec.modo === "girar") {
      const angulo = (q: Punto) => Math.atan2(q[1] - ec.centro[1], q[0] - ec.centro[0]);
      // De a 15°: las paredes y los equipos casi siempre van rectos.
      elemento = girar(ec.original, Math.round(((angulo(p) - angulo(ec.inicio)) * 180) / Math.PI / 15) * 15, ec.centro);
    } else {
      const factor = Math.min(5, Math.max(0.2, distancia(p, ec.centro) / (distancia(ec.inicio, ec.centro) || 1)));
      elemento = escalar(ec.original, factor, ec.centro);
    }
    setEnCurso({ ...ec, elemento });
  }

  function alBajar(e: EventoPuntero<HTMLDivElement>) {
    if (!hoja || !encaje) return;
    if (e.pointerType === "pen") lapizVisto.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY, tipo: e.pointerType });
    const tocando = dedos();

    // Dos dedos: acercan, mueven o pasan de hoja; lo que se estaba dibujando se descarta.
    if (tocando.length === 2) {
      pararQuieto();
      setEnCurso(null);
      const [a, b] = tocando.map(enMarco) as [Punto, Punto];
      gesto.current = { tipo: "pendiente", distancia: distancia(a, b) || 1, medio: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], vista };
      return;
    }
    // Rechazo de la palma: con un lápiz en uso, el dedo no dibuja.
    if (lapizVisto.current && e.pointerType === "touch") return;
    if (punteros.current.size > 1) return;

    const p = aLienzo(e);
    if (herramienta === "trazo") {
      setEnCurso({ tipo: "trazo", puntero: e.pointerId, puntos: [[p[0], p[1], e.pointerType === "pen" ? e.pressure : 0.5]], lapiz: e.pointerType === "pen", forma: null });
      vigilarQuieto(e);
    } else if (herramienta === "cota") {
      const desde = pegar(p);
      setEnCurso({ tipo: "cota", puntero: e.pointerId, desde, hasta: desde });
    } else if (herramienta === "borrador") borrarEn(p);
    else if (herramienta === "mover") empezarArrastre(e.pointerId, p);
  }

  function moverGesto(g: Gesto) {
    const tocando = dedos();
    if (tocando.length < 2 || !marco || !encaje || !hojas) return;
    const [a, b] = tocando.map(enMarco) as [Punto, Punto];
    const medio: Punto = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const factor = distancia(a, b) / g.distancia;
    const [dx, dy] = [medio[0] - g.medio[0], medio[1] - g.medio[1]];
    if (g.tipo === "pendiente") {
      // A lo ancho, sin pellizcar y con la hoja completa: pasar de hoja. Si no, acercar y mover.
      if (g.vista.escala === 1 && Math.abs(dx) > 16 && Math.abs(dx) > 1.5 * Math.abs(dy) && Math.abs(factor - 1) < 0.15) g.tipo = "pasar";
      else if (Math.abs(factor - 1) > 0.08 || Math.hypot(dx, dy) > 16) g.tipo = "acercar";
      else return;
    }
    if (g.tipo === "pasar") {
      const hayAntes = actual > 0;
      const hayDespues = actual < hojas.length - 1 || hojas.length < LIMITES_BOCETO.hojas;
      // Sin hoja de ese lado, la hoja cede poco: se nota que no hay a dónde ir.
      setDeslizar((dx > 0 && !hayAntes) || (dx < 0 && !hayDespues) ? dx / 4 : dx);
      return;
    }
    setVista(acercar(g.vista, factor, g.medio, medio, marco, encaje));
  }

  function alMover(e: EventoPuntero<HTMLDivElement>) {
    if (!punteros.current.has(e.pointerId) || !hoja) return;
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY, tipo: e.pointerType });
    if (gesto.current) return moverGesto(gesto.current);
    const ec = enCursoRef.current;
    if (!ec) {
      if (herramienta === "borrador" && e.buttons > 0 && punteros.current.size === 1 && !(lapizVisto.current && e.pointerType === "touch")) borrarEn(aLienzo(e));
      return;
    }
    if (ec.puntero !== e.pointerId) return;
    const p = aLienzo(e);
    if (ec.tipo === "trazo") {
      // Ya enderezado, el trazo no sigue: al soltar queda la forma.
      if (ec.forma || ec.puntos.length >= LIMITES_BOCETO.puntosPorTrazo) return;
      setEnCurso({ ...ec, puntos: [...ec.puntos, [p[0], p[1], e.pointerType === "pen" ? e.pressure : 0.5]] });
      vigilarQuieto(e);
    } else if (ec.tipo === "cota") setEnCurso({ ...ec, hasta: pegar(ajustarAngulo(ec.desde, p)) });
    else arrastrar(ec, p);
  }

  function terminarGesto(g: Gesto) {
    gesto.current = null;
    if (g.tipo !== "pasar" || !hojas || !marco) return;
    const umbral = Math.min(100, marco.ancho * 0.25);
    const recorrido = deslizarRef.current;
    setDeslizar(0);
    if (recorrido <= -umbral) {
      if (actual < hojas.length - 1) irA(actual + 1, "siguiente");
      else agregarHoja();
    } else if (recorrido >= umbral && actual > 0) irA(actual - 1, "anterior");
  }

  function alSubir(e: EventoPuntero<HTMLDivElement>) {
    if (!punteros.current.delete(e.pointerId) || !hoja) return;
    if (gesto.current) {
      if (dedos().length < 2) terminarGesto(gesto.current);
      return;
    }
    const ec = enCursoRef.current;
    const valido = e.type === "pointerup" && !(lapizVisto.current && e.pointerType === "touch");
    if (!ec) {
      if (herramienta === "texto" && valido && punteros.current.size === 0 && hoja.elementos.length < LIMITES_BOCETO.elementos) {
        setTextoPedido("");
        setPedido({ tipo: "texto", en: aLienzo(e) });
      }
      return;
    }
    if (ec.puntero !== e.pointerId) return;
    pararQuieto();
    setEnCurso(null);
    if (e.type !== "pointerup") return;
    if (ec.tipo === "trazo") {
      if (hoja.elementos.length >= LIMITES_BOCETO.elementos) return;
      cambiarElementos([...hoja.elementos, ec.forma ? deForma(ec.forma) : { tipo: "trazo", grosor: GROSOR_TRAZO, puntos: ec.puntos, contorno: contornoDe(ec.puntos, ec.lapiz) }]);
    } else if (ec.tipo === "cota") {
      if (distancia(ec.desde, ec.hasta) < unidades(24) || hoja.elementos.length >= LIMITES_BOCETO.elementos) return;
      setTextoPedido("");
      setPedido({ tipo: "cota", desde: ec.desde, hasta: ec.hasta });
    } else if (ec.elemento) {
      cambiarElementos(hoja.elementos.map((x, i) => (i === ec.indice ? ec.elemento! : x)));
    }
  }

  function confirmarPedido() {
    if (!pedido || !hoja || !hojas) return;
    const limpio = textoPedido.trim();
    if (pedido.tipo === "texto" && limpio) cambiarElementos([...hoja.elementos, { tipo: "texto", en: pedido.en, texto: limpio.slice(0, LIMITES_BOCETO.texto), tamano: TAMANO_TEXTO }]);
    if (pedido.tipo === "cota" && limpio) cambiarElementos([...hoja.elementos, { tipo: "cota", grosor: GROSOR_COTA, desde: pedido.desde, hasta: pedido.hasta, texto: limpio.slice(0, LIMITES_BOCETO.texto) }]);
    if (pedido.tipo === "nombre" && limpio && limpio !== hojas[pedido.indice]?.nombre) {
      const nombre = limpio.slice(0, LIMITES_BOCETO.nombreDeHoja);
      cambiar({ hojas: hojas.map((h, i) => (i === pedido.indice ? { ...h, nombre } : h)), actual });
    }
    setPedido(null);
  }

  /**
   * Un símbolo de la biblioteca cae en el centro de lo que se ve, elegido y con "Mover", para llevarlo a su sitio.
   * Mide lo mismo en pantalla a cualquier acercamiento.
   */
  function ponerSimbolo(s: SimboloLocal) {
    setBiblioteca(false);
    if (!hoja || !marco || !encaje || hoja.elementos.length >= LIMITES_BOCETO.elementos) return;
    const centro: Punto = [
      r1((marco.ancho / 2 - encaje.x - vista.x) / pxPorUnidad),
      r1((marco.alto / 2 - encaje.y - vista.y) / pxPorUnidad),
    ];
    const tamano = Math.round(Math.min(Math.max(unidades(96), LIMITES_SIMBOLO.tamanoMinimo), LIMITES_SIMBOLO.tamanoMaximo));
    cambiarElementos([...hoja.elementos, elementoDeSimbolo(s, centro, tamano)]);
    setHerramienta("mover");
    setSeleccion(hoja.elementos.length);
    recordarReciente(s.id);
  }

  function duplicarSeleccion() {
    if (seleccion === null || !hoja || hoja.elementos.length >= LIMITES_BOCETO.elementos) return;
    cambiarElementos([...hoja.elementos, duplicar(hoja.elementos[seleccion]!)]);
    setSeleccion(hoja.elementos.length);
  }

  function quitarSeleccion() {
    if (seleccion === null || !hoja) return;
    cambiarElementos(hoja.elementos.filter((_, i) => i !== seleccion));
    setSeleccion(null);
  }

  // Lo que se dibuja encima mientras se traza, se mide la cota o se arrastra.
  const arrastrando = enCurso?.tipo === "arrastre" && enCurso.elemento ? enCurso : null;
  const elementos = hoja ? (arrastrando ? hoja.elementos.map((x, i) => (i === arrastrando.indice ? arrastrando.elemento! : x)) : hoja.elementos) : [];
  const vistaPrevia: ElementoBoceto | null =
    enCurso?.tipo === "trazo"
      ? enCurso.forma
        ? deForma(enCurso.forma)
        : { tipo: "trazo", grosor: GROSOR_TRAZO, puntos: enCurso.puntos, contorno: contornoDe(enCurso.puntos, enCurso.lapiz) }
      : enCurso?.tipo === "cota"
        ? { tipo: "cota", grosor: GROSOR_COTA, desde: enCurso.desde, hasta: enCurso.hasta, texto: "" }
        : pedido?.tipo === "cota"
          ? { tipo: "cota", grosor: GROSOR_COTA, desde: pedido.desde, hasta: pedido.hasta, texto: "" }
          : null;
  const elegido = seleccion !== null ? elementos[seleccion] : undefined;
  const marcas = elegido ? marcasDe(elegido) : null;

  const umbral = marco ? Math.min(100, marco.ancho * 0.25) : 100;
  const vecino = deslizar < 0 ? actual + 1 : deslizar > 0 ? actual - 1 : null;
  const hojaVecina = vecino !== null && hojas ? hojas[vecino] : undefined;
  const nueva = vecino !== null && hojas && vecino === hojas.length && hojas.length < LIMITES_BOCETO.hojas;

  let acciones: { left: number; top: number } | null = null;
  if (marcas && encaje && marco && herramienta === "mover" && !arrastrando) {
    const [x, arriba] = aPantalla([marcas.caja.x + marcas.caja.ancho / 2, (marcas.girar ?? [0, marcas.caja.y])[1]], vista, encaje);
    const abajo = aPantalla([0, marcas.caja.y + marcas.caja.alto], vista, encaje)[1];
    const top = arriba - 20 - 44 > 4 ? arriba - 20 - 44 : Math.min(abajo + 12, marco.alto - 52);
    acciones = { left: Math.min(Math.max(4, x - 100), marco.ancho - 204), top };
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Boceto: ${etiqueta}`}
      data-tema="claro"
      className={`fixed inset-0 z-50 flex flex-col bg-fondo pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] select-none [-webkit-touch-callout:none] ${saliendo ? "animate-hoja-baja" : entrar ? "motion-safe:animate-hoja-sube" : ""}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-1 px-2 py-1.5 max-[383px]:gap-0.5 max-[383px]:px-1.5 max-[383px]:[&_button]:size-10">
        <Pastilla>
          <BotonHerramienta icono={ChevronLeft} etiqueta="Volver a la captura" onClick={salir} />
        </Pastilla>
        <Pastilla role="group" aria-label="Deshacer y rehacer">
          <BotonHerramienta icono={Undo2} etiqueta="Deshacer" disabled={historial.deshacer.length === 0} onClick={deshacerUno} />
          <span aria-hidden className="h-6 w-px bg-division" />
          <BotonHerramienta icono={Redo2} etiqueta="Rehacer" disabled={historial.rehacer.length === 0} onClick={rehacerUno} />
        </Pastilla>
        <Pastilla role="toolbar" aria-label="Herramientas">
          {HERRAMIENTAS.map((h) => (
            <BotonHerramienta key={h.valor} icono={h.icono} etiqueta={h.etiqueta} elegida={herramienta === h.valor} onClick={() => elegir(h.valor)} />
          ))}
        </Pastilla>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={marcoRef}
          aria-label="Lienzo del boceto"
          className="absolute inset-0 touch-none overflow-hidden"
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSubir}
          onPointerCancel={alSubir}
        >
          {hoja && encaje && (
            <div key={actual} className={`absolute inset-0 ${entrada === "siguiente" ? "motion-safe:animate-hoja-siguiente" : entrada === "anterior" ? "motion-safe:animate-hoja-anterior" : ""}`}>
              <div
                className="absolute origin-top-left"
                style={{ left: encaje.x, top: encaje.y, width: encaje.ancho, height: encaje.alto, transform: `translate(${vista.x + deslizar}px, ${vista.y}px) scale(${vista.escala})` }}
              >
                <Boceto ref={lienzo} ancho={hoja.ancho} alto={hoja.alto} cuadricula={LIENZO.cuadricula} elementos={elementos} etiqueta={etiqueta}>
                  {vistaPrevia && <ElementoDeBoceto elemento={vistaPrevia} />}
                  {marcas && herramienta === "mover" && (
                    <g className="pointer-events-none">
                      <rect
                        x={marcas.caja.x}
                        y={marcas.caja.y}
                        width={marcas.caja.ancho}
                        height={marcas.caja.alto}
                        className="fill-none stroke-superficie"
                        strokeWidth={unidades(2)}
                        strokeDasharray={`${unidades(6)} ${unidades(4)}`}
                      />
                      {marcas.girar && (
                        <>
                          <line x1={marcas.girar[0]} y1={marcas.caja.y} x2={marcas.girar[0]} y2={marcas.girar[1]} className="stroke-superficie" strokeWidth={unidades(2)} />
                          <circle cx={marcas.girar[0]} cy={marcas.girar[1]} r={unidades(11)} className="fill-panel stroke-superficie" strokeWidth={unidades(2.5)} />
                        </>
                      )}
                      <rect
                        x={marcas.escalar[0] - unidades(9)}
                        y={marcas.escalar[1] - unidades(9)}
                        width={unidades(18)}
                        height={unidades(18)}
                        rx={unidades(3)}
                        className="fill-panel stroke-superficie"
                        strokeWidth={unidades(2.5)}
                      />
                    </g>
                  )}
                  {anillo && (
                    <g className="pointer-events-none">
                      <circle cx={anillo[0]} cy={anillo[1]} r={unidades(24)} className="fill-superficie/10 stroke-borde-suave" strokeWidth={unidades(4)} />
                      <circle
                        key={`${anillo[0]},${anillo[1]}`}
                        cx={anillo[0]}
                        cy={anillo[1]}
                        r={unidades(24)}
                        pathLength={100}
                        strokeDasharray="100"
                        transform={`rotate(-90 ${anillo[0]} ${anillo[1]})`}
                        className="fill-none stroke-superficie motion-safe:animate-llenar-anillo"
                        strokeWidth={unidades(4)}
                        strokeLinecap="round"
                      />
                    </g>
                  )}
                </Boceto>
              </div>
            </div>
          )}

          {/* Pasar de hoja con dos dedos: la vecina entra desde su lado; después de la última, una nueva. */}
          {marco && deslizar !== 0 && (hojaVecina || nueva) && (
            <div className="absolute inset-0" style={{ transform: `translateX(${deslizar + (deslizar < 0 ? 1 : -1) * (marco.ancho + SEPARACION_PX)}px)` }}>
              {hojaVecina ? (
                <HojaQuieta hoja={hojaVecina} marco={marco} />
              ) : (
                <div className="absolute inset-0 flex flex-col justify-center gap-2.5 rounded-panel border-2 border-dashed border-superficie bg-panel-hundido pl-4 text-superficie">
                  <span className="flex size-11 items-center justify-center rounded-full bg-superficie-suave [&_svg]:size-6">
                    <Plus aria-hidden />
                  </span>
                  <span className="w-28 text-cuerpo leading-snug font-bold">{-deslizar >= umbral ? `Suelta para agregar la hoja ${hojas!.length + 1}` : "Hoja nueva"}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {acciones && (
          <Pastilla role="toolbar" aria-label="Elemento elegido" className="absolute" style={acciones}>
            <Boton variante="fantasma" tamano="pequeno" icono={Copy} onClick={duplicarSeleccion}>
              Duplicar
            </Boton>
            <span aria-hidden className="h-6 w-px bg-division" />
            <Boton variante="fantasma" tamano="pequeno" icono={Trash} onClick={quitarSeleccion}>
              Quitar
            </Boton>
          </Pastilla>
        )}

        {estado === "error" && (
          <div className="absolute inset-x-2 top-2">
            <Aviso tono="error">No se pudo guardar el último cambio en el teléfono. Intenta de nuevo.</Aviso>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {estado === "guardando" ? "Guardando…" : estado === "guardado" ? "Guardado en este teléfono" : ""}
        </p>

        {hojas && hoja && (
          <>
            {menuHojas && <div aria-hidden className="absolute inset-0" onPointerDown={() => setMenuHojas(false)} />}
            {menuHojas && (
              <div role="menu" aria-label="Hojas del boceto" className="absolute bottom-2 left-2 flex w-[min(320px,calc(100%-16px))] -translate-x-1/2 flex-col gap-0.5 rounded-capa bg-panel p-2 shadow-capa motion-safe:animate-aparecer">
                {hojas.map((h, i) => (
                  <button
                    key={i}
                    type="button"
                    role="menuitemradio"
                    aria-checked={i === actual}
                    className="flex min-h-control w-full items-center gap-3 rounded-control px-3 py-2 text-left not-aria-checked:hover:bg-encima aria-checked:bg-superficie-suave"
                    onClick={() => (i === actual ? setMenuHojas(false) : irA(i, i > actual ? "siguiente" : "anterior"))}
                  >
                    <span aria-hidden className="w-10 shrink-0 overflow-hidden rounded-[4px] border border-division">
                      <Boceto ancho={h.ancho} alto={h.alto} cuadricula={LIENZO.cuadricula} elementos={h.elementos} etiqueta={h.nombre} />
                    </span>
                    <span className="flex min-w-0 grow flex-col">
                      <span className="truncate text-cuerpo font-bold">{h.nombre}</span>
                      <span className="text-ayuda text-texto-secundario">Hoja {i + 1}</span>
                    </span>
                    {i === actual && <Check aria-hidden className="size-5 shrink-0 text-superficie" />}
                  </button>
                ))}
                <span aria-hidden className="my-1 h-px bg-division" />
                <OpcionDeMenu icono={Plus} disabled={hojas.length >= LIMITES_BOCETO.hojas} onClick={agregarHoja}>
                  Agregar hoja
                </OpcionDeMenu>
                <OpcionDeMenu
                  icono={Pencil}
                  onClick={() => {
                    setMenuHojas(false);
                    setTextoPedido(hoja.nombre);
                    setPedido({ tipo: "nombre", indice: actual, nueva: false });
                  }}
                >
                  Cambiar nombre
                </OpcionDeMenu>
                {hojas.length > 1 && (
                  <>
                    <span aria-hidden className="my-1 h-px bg-division" />
                    <OpcionDeMenu icono={Trash} peligro onClick={quitarHoja}>
                      Quitar esta hoja
                    </OpcionDeMenu>
                  </>
                )}
              </div>
            )}
            {vista.escala > 1 && (
              <button
                type="button"
                aria-label="Ver la hoja completa"
                className="absolute bottom-2.5 left-2 h-control-sm rounded-panel border border-division bg-panel px-3 text-ayuda font-bold shadow-menu"
                onClick={() => setVista(VISTA_COMPLETA)}
              >
                {Math.round(vista.escala * 100)} %
              </button>
            )}
          </>
        )}
      </div>

      {/*
        La barra de abajo (iteración 32): fija y fuera del lienzo, para no tapar el plano. Hojas y símbolos a la izquierda,
        "Listo" a la derecha, donde termina el pulgar (Pinterest y eBay en Mobbin). Fuera de la captura, sin "Listo".
      */}
      {hojas && hoja && (
        <div className="flex shrink-0 items-center gap-2 border-t border-division bg-panel px-3 pt-2.5 pb-2.5">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuHojas}
            aria-label={`Hojas: ${hoja.nombre}, hoja ${actual + 1} de ${hojas.length}`}
            className="flex h-control-sm max-w-[45%] items-center gap-1.5 rounded-control bg-panel-hundido pr-2.5 pl-3.5 text-[15px] font-medium whitespace-nowrap [&_svg]:size-[17px] [&_svg]:shrink-0 [&_svg]:text-texto-secundario"
            onClick={() => setMenuHojas((abierto) => !abierto)}
          >
            <span className="truncate">{hoja.nombre}</span>
            <span className="font-normal text-texto-secundario">
              {actual + 1}/{hojas.length}
            </span>
            {menuHojas ? <ChevronDown aria-hidden /> : <ChevronUp aria-hidden />}
          </button>
          <button
            type="button"
            aria-label="Símbolos"
            aria-expanded={biblioteca}
            className="flex size-control-sm shrink-0 items-center justify-center rounded-control bg-panel-hundido text-superficie [&_svg]:size-[22px]"
            onClick={() => {
              setMenuHojas(false);
              setBiblioteca(true);
            }}
          >
            <Shapes aria-hidden />
          </button>
          {listo && (
            <button
              type="button"
              onClick={listo}
              className="ml-auto h-control-sm shrink-0 rounded-control bg-superficie px-5 text-cuerpo font-semibold text-sobre-superficie active:scale-95 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foco"
            >
              Listo
            </button>
          )}
        </div>
      )}

      {biblioteca && <HojaSimbolos simbolos={simbolos} elegir={ponerSimbolo} cerrar={() => setBiblioteca(false)} />}

      {pedido && (
        <Dialogo
          forma="inferior"
          titulo={pedido.tipo === "texto" ? "Poner texto" : pedido.tipo === "cota" ? "Medida de la cota" : `Nombre de la hoja ${pedido.indice + 1}`}
          alCerrar={() => setPedido(null)}
          pie={
            <>
              <Boton onClick={() => setPedido(null)}>{pedido.tipo === "nombre" && pedido.nueva ? `Dejar «${hojas?.[pedido.indice]?.nombre}»` : "Cancelar"}</Boton>
              <Boton variante="principal" onClick={confirmarPedido}>
                {pedido.tipo === "texto" ? "Poner texto" : pedido.tipo === "cota" ? "Poner medida" : "Guardar"}
              </Boton>
            </>
          }
        >
          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              confirmarPedido();
            }}
          >
            <CampoTexto
              etiqueta={pedido.tipo === "texto" ? "Texto del boceto" : pedido.tipo === "cota" ? "Medida" : "Nombre"}
              valorInicial={textoPedido}
              onCambio={setTextoPedido}
              seleccionarAlEnfocar={pedido.tipo === "nombre"}
            />
          </form>
        </Dialogo>
      )}
    </div>
  );
}

/** Una hoja vecina mientras se desliza: solo se ve, no se dibuja en ella. */
function HojaQuieta({ hoja, marco }: { hoja: HojaBoceto; marco: Tamano }) {
  const e = encajar(marco, hoja);
  return (
    <div className="absolute" style={{ left: e.x, top: e.y, width: e.ancho, height: e.alto }}>
      <Boceto ancho={hoja.ancho} alto={hoja.alto} cuadricula={LIENZO.cuadricula} elementos={hoja.elementos} etiqueta={hoja.nombre} />
    </div>
  );
}

function OpcionDeMenu({ icono: Icono, peligro, children, ...props }: { icono: typeof Plus; peligro?: boolean; children: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex min-h-control w-full items-center gap-3 rounded-control px-3 text-left text-cuerpo font-bold not-disabled:hover:bg-encima disabled:opacity-50 [&_svg]:size-[22px] ${peligro ? "text-peligro" : "text-texto"}`}
      {...props}
    >
      <Icono aria-hidden />
      {children}
    </button>
  );
}
