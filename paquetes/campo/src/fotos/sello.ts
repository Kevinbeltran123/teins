/*
  La franja de la foto de llegada (ADR-0052): lo que dice y cómo se dibuja. Las funciones puras van aquí, con su prueba;
  el dibujo sobre el lienzo (`dibujarSello`) lo comprueba Kevin en el iPhone, en la fase manual de la iteración 47.
*/

/** La posición que el teléfono dio al acercarse a la foto, con su imprecisión en metros. */
export interface PosicionDeLlegada {
  lat: number;
  lon: number;
  /** Radio de incertidumbre en metros (`coords.accuracy`). */
  precision: number;
  /** Milisegundos desde época: cuándo se leyó. */
  en: number;
}

/** Lo que dice la franja, ya reunido: lo que falta no se inventa, simplemente no sale. */
export interface DatosDelSello {
  /** La hora del teléfono al tomar la foto. */
  ahora: Date;
  /** La hora del servidor («hora de red»); sin señal, nula. */
  horaDeRed: Date | null;
  /** Solo si el formato la pide (`sello.ubicacion`) y el teléfono la dio. */
  ubicacion?: { lat: number; lon: number; precision: number } | undefined;
  /** La dirección registrada del sitio, no la que calcula el GPS (ADR-0052). */
  direccion: string | undefined;
  ciudad?: string | undefined;
  lugar: { organizacion?: string | undefined; cliente: string; sitio: string };
  /** El mapa, solo con señal al tomar la foto (`sello.mapa`). */
  mapa?: { imagen: string; centro: { lat: number; lon: number }; zoom: number; atribucion: string } | undefined;
  /** Zona de las horas: la del teléfono; solo cambia en las pruebas. */
  zona?: string | undefined;
}

/** Cuánto vale una lectura de posición: la mejor de los últimos 2 minutos. */
export const VENTANA_DE_POSICION_MS = 2 * 60_000;

/** De dos lecturas, la de menor imprecisión; una de hace más de 2 minutos ya no vale. */
export function mejorPosicion(actual: PosicionDeLlegada | null, nueva: PosicionDeLlegada, ahora: number = nueva.en): PosicionDeLlegada {
  if (!actual || actual.en < ahora - VENTANA_DE_POSICION_MS) return nueva;
  return nueva.precision < actual.precision ? nueva : actual;
}

export type EstadoDeUbicacion = "buscando" | "lista" | "sin_permiso" | "no_disponible";

/**
 * La línea sobre el botón de la foto: el estado de la ubicación, antes de tomarla. `vigente` es la posición que todavía
 * vale: si caducó, la foto saldría sin coordenadas, así que no se dice «lista».
 */
export function textoDeUbicacion(estado: EstadoDeUbicacion, vigente: PosicionDeLlegada | null): string {
  switch (estado) {
    case "lista":
      if (!vigente) return "Buscando ubicación…";
      return `Ubicación lista (±${Math.round(vigente.precision)} m)`;
    case "sin_permiso":
      return "Sin permiso de ubicación: la foto sale sin coordenadas";
    case "no_disponible":
      return "Este teléfono no da la ubicación: la foto sale sin coordenadas";
    default:
      return "Buscando ubicación…";
  }
}

/** `4°12'4.572"N 74°38'10.059"W`, como en la foto de ejemplo. */
export function aGradosMinutosSegundos(lat: number, lon: number): string {
  const parte = (grados: number, positivo: string, negativo: string) => {
    const abs = Math.abs(grados);
    const g = Math.floor(abs);
    const mFraccion = (abs - g) * 60;
    const m = Math.floor(mFraccion);
    const s = (mFraccion - m) * 60;
    return `${g}°${m}'${s.toFixed(3)}"${grados >= 0 ? positivo : negativo}`;
  };
  return `${parte(lat, "N", "S")} ${parte(lon, "E", "W")}`;
}

/** `27 oct 2026 12:31:07 p. m. GMT-05:00`: con `Intl` en es-CO y la diferencia con GMT. */
export function formatoDeMomento(momento: Date, zona?: string): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZoneName: "longOffset", ...(zona ? { timeZone: zona } : {}) })
      .formatToParts(momento)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // Algunos motores separan «p. m.» con un espacio fino: en la franja, un espacio normal.
  const periodo = (partes.dayPeriod ?? "").replace(/\s/g, " ").toLowerCase();
  return `${partes.day} ${partes.month!.replace(".", "")} ${partes.year} ${partes.hour}:${partes.minute}:${partes.second} ${periodo} ${partes.timeZoneName}`;
}

/** Los textos de la franja, en orden: red, teléfono, coordenadas, dirección registrada y lugar. */
export function lineasDelSello(d: DatosDelSello): string[] {
  const lugar = [d.lugar.organizacion, d.lugar.cliente, d.lugar.sitio].filter(Boolean).join(" · ");
  const direccion = [d.direccion, d.ciudad].filter(Boolean).join(", ");
  return [
    `Red: ${d.horaDeRed ? formatoDeMomento(d.horaDeRed, d.zona) : "sin señal"}`,
    `Teléfono: ${formatoDeMomento(d.ahora, d.zona)}`,
    ...(d.ubicacion ? [`${aGradosMinutosSegundos(d.ubicacion.lat, d.ubicacion.lon)} · ±${Math.round(d.ubicacion.precision)} m`] : []),
    ...(direccion ? [direccion] : []),
    ...(lugar ? [lugar] : []),
  ];
}

/**
 * El pin va en el punto exacto, aunque el mapa se pidió con las coordenadas redondeadas (ADR-0052): dónde cae, en píxeles
 * de la imagen, respecto del centro. Web Mercator; el mapa vectorial de Geoapify usa teselas de 512 px, así que el mundo
 * mide 512 · 2^zoom píxeles de ancho. `escala` es el `scaleFactor` con que se pidió.
 */
const TESELA = 512;
export function desplazamientoEnPixeles(centro: { lat: number; lon: number }, punto: { lat: number; lon: number }, zoom: number, escala: number): { dx: number; dy: number } {
  const mundo = TESELA * 2 ** zoom;
  const x = (lon: number) => ((lon + 180) / 360) * mundo;
  const y = (lat: number) => {
    const r = (lat * Math.PI) / 180;
    return (0.5 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / (2 * Math.PI)) * mundo;
  };
  return { dx: (x(punto.lon) - x(centro.lon)) * escala, dy: (y(punto.lat) - y(centro.lat)) * escala };
}

/** Parte un texto en líneas que caben en `ancho`, por palabras; una palabra más larga se deja entera. */
function envolver(contexto: CanvasRenderingContext2D, texto: string, ancho: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(" ")) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && contexto.measureText(prueba).width > ancho) {
      lineas.push(actual);
      actual = palabra;
    } else actual = prueba;
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Un rectángulo con las esquinas redondeadas, como trazo para recortar o rellenar. */
function rectanguloRedondeado(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/**
 * Dibuja la franja sobre la foto, como la de ejemplo (ADR-0052): un degradado oscuro arriba para que se lea sobre paredes
 * claras, el texto blanco con sombra alineado a la derecha (3,2 % del ancho) y, si hay, el mapa arriba a la izquierda
 * (28 % del ancho) con su pin y su atribución dentro, al tamaño final.
 */
export async function dibujarSello(contexto: CanvasRenderingContext2D, ancho: number, datos: DatosDelSello, mapa: HTMLImageElement | null): Promise<void> {
  const t = Math.max(12, Math.round(ancho * 0.032));
  const margen = Math.round(t * 0.8);
  const fuente = `600 ${t}px Geist, system-ui, sans-serif`;
  // La fuente de la app; si no está cargada o no se deja, la del sistema.
  try {
    await document.fonts.load(fuente);
  } catch {
    // Sin la fuente, la del sistema.
  }
  contexto.font = fuente;
  const lado = mapa ? Math.round(ancho * 0.28) : 0;
  const anchoDeTexto = ancho - margen * 2 - (lado > 0 ? lado + margen : 0);
  const lineas = lineasDelSello(datos).flatMap((l) => envolver(contexto, l, anchoDeTexto));
  const interlineado = t * 1.25;
  const alto = Math.max(lineas.length * interlineado, lado) + margen * 2;

  const degradado = contexto.createLinearGradient(0, 0, 0, alto * 1.15);
  degradado.addColorStop(0, "rgba(0, 0, 0, 0.72)");
  degradado.addColorStop(1, "rgba(0, 0, 0, 0)");
  contexto.fillStyle = degradado;
  contexto.fillRect(0, 0, ancho, alto * 1.15);

  contexto.save();
  contexto.textAlign = "right";
  contexto.textBaseline = "top";
  contexto.fillStyle = "#FFFFFF";
  contexto.shadowColor = "rgba(0, 0, 0, 0.85)";
  contexto.shadowBlur = t * 0.3;
  lineas.forEach((linea, i) => contexto.fillText(linea, ancho - margen, margen + i * interlineado));
  contexto.restore();

  if (!mapa || !datos.mapa) return;
  contexto.save();
  rectanguloRedondeado(contexto, margen, margen, lado, lado, t * 0.4);
  contexto.clip();
  contexto.drawImage(mapa, margen, margen, lado, lado);
  // El pin, en el punto exacto: la imagen se pidió con 2× de escala y el mapa se dibuja a `lado` píxeles.
  if (datos.ubicacion) {
    const { dx, dy } = desplazamientoEnPixeles(datos.mapa.centro, datos.ubicacion, datos.mapa.zoom, 2);
    const k = lado / mapa.naturalWidth;
    const r = Math.max(5, lado * 0.025);
    const px = Math.min(margen + lado - r, Math.max(margen + r, margen + lado / 2 + dx * k));
    const py = Math.min(margen + lado - r, Math.max(margen + r, margen + lado / 2 + dy * k));
    contexto.beginPath();
    contexto.arc(px, py, r, 0, Math.PI * 2);
    contexto.fillStyle = "#D22F34";
    contexto.fill();
    contexto.lineWidth = Math.max(2, r * 0.35);
    contexto.strokeStyle = "#FFFFFF";
    contexto.stroke();
  }
  // La atribución va dentro del mapa y se lee al tamaño final: en una foto reenviada no hay enlace que seguir.
  const t2 = Math.max(9, Math.round(lado * 0.04));
  contexto.font = `500 ${t2}px Geist, system-ui, sans-serif`;
  const atribucion = datos.mapa.atribucion.split("\n").flatMap((l) => envolver(contexto, l, lado - margen));
  const bandaAlta = atribucion.length * t2 * 1.2 + t2;
  contexto.fillStyle = "rgba(0, 0, 0, 0.6)";
  contexto.fillRect(margen, margen + lado - bandaAlta, lado, bandaAlta);
  contexto.fillStyle = "#FFFFFF";
  contexto.textAlign = "left";
  contexto.textBaseline = "top";
  atribucion.forEach((l, i) => contexto.fillText(l, margen + t2 * 0.5, margen + lado - bandaAlta + t2 * 0.5 + i * t2 * 1.2));
  contexto.restore();
}
