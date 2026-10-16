import type { VersionFormato } from "./formato";
import type { ValorCantidades } from "./cantidades";
import { claveDeRepeticion, leerClave, nombrePorDefecto, type Repeticiones } from "./repeticiones";
import { LIMITES } from "./limites";

/** Medida: el número va como texto decimal para no introducir errores de coma flotante (ADR-0006). */
export interface ValorMedida {
  valor: string;
  unidad: string;
}

/** Fotos: identificadores de archivo (huella SHA-256), nunca el binario (ADR-0007). */
export type ValorFotos = readonly string[];

/** Boceto: la huella de su archivo (ADR-0019), como una foto; el documento vive en el archivo. */
export interface ValorBoceto {
  boceto: string;
}

/**
 * Firma de quien recibe la visita (ADR-0024): la huella del documento con sus trazos, quién firmó, cuándo
 * (hora del teléfono) y la constancia que leyó, ya llena. Certifica la visita, no el contenido técnico.
 */
export interface ValorFirma {
  firma: string;
  nombre: string;
  cargo?: string | undefined;
  firmadoEn: string;
  declaracion: string;
}

/** Regla 3: un dato obligatorio que no se pudo obtener se marca con su motivo. */
export interface ValorNoObtenido {
  noObtenido: true;
  motivo: string;
}

export type Valor = string | ValorMedida | ValorFotos | ValorBoceto | ValorCantidades | ValorFirma | ValorNoObtenido;

export const esBoceto = (valor: unknown): valor is ValorBoceto => typeof valor === "object" && valor !== null && !Array.isArray(valor) && "boceto" in valor;
export const esFirma = (valor: unknown): valor is ValorFirma => typeof valor === "object" && valor !== null && !Array.isArray(valor) && "firma" in valor;

/** Respuestas por clave de sección y clave de campo. */
export type Respuestas = Readonly<Record<string, Readonly<Record<string, Valor>>>>;

/** Ciclo de vida (modelo de dominio, sección 5). Anulado llega cuando haga falta. */
export type EstadoLevantamiento = "borrador" | "enviado" | "en_revision" | "revisado";

export interface Levantamiento {
  id: string;
  formato: string;
  versionFormato: number;
  /** Visita en la que se captura. Los borradores de los cortes 0 y 1 no tienen (ADR-0015, expansión). */
  visitaId?: string | undefined;
  estado: EstadoLevantamiento;
  respuestas: Respuestas;
  /** Repeticiones de las secciones repetibles, en orden. Ausente en formatos sin ellas. */
  repeticiones?: Repeticiones | undefined;
  /** Horas del dispositivo (regla 16): declarativas; la oficial la pone el servidor al recibirlo. */
  creadoEn: string;
  actualizadoEn: string;
  enviadoEn?: string;
}

const sinGenerador = (): string => {
  throw new Error("El formato tiene secciones repetibles: falta el generador de ids de repetición");
};

/** El levantamiento nace con las repeticiones mínimas de cada sección repetible. */
export function crearLevantamiento(formato: VersionFormato, id: string, ahora: Date, visitaId?: string, nuevoId: () => string = sinGenerador): Levantamiento {
  const fecha = ahora.toISOString();
  const repeticiones: Record<string, { id: string; nombre: string }[]> = {};
  for (const seccion of formato.secciones) {
    if (!seccion.repetible) continue;
    const lista: { id: string; nombre: string }[] = [];
    for (let i = 0; i < (seccion.repetible.min ?? 0); i++) lista.push({ id: nuevoId(), nombre: nombrePorDefecto(seccion, lista) });
    repeticiones[seccion.clave] = lista;
  }
  return {
    id,
    formato: formato.formato,
    versionFormato: formato.version,
    ...(visitaId ? { visitaId } : {}),
    estado: "borrador",
    respuestas: {},
    ...(Object.keys(repeticiones).length > 0 ? { repeticiones } : {}),
    creadoEn: fecha,
    actualizadoEn: fecha,
  };
}

export function esNoObtenido(valor: unknown): valor is ValorNoObtenido {
  return typeof valor === "object" && valor !== null && "noObtenido" in valor && valor.noObtenido === true;
}

export class LevantamientoNoEditable extends Error {
  constructor(id: string) {
    super(`El levantamiento ${id} ya se envió y no se puede editar`);
    this.name = "LevantamientoNoEditable";
  }
}

/** ¿Es la clave de respuestas de una repetición que este levantamiento ya no tiene? */
function deRepeticionQuitada(levantamiento: Levantamiento, seccion: string): boolean {
  const { seccion: clave, repeticion } = leerClave(seccion);
  return repeticion !== undefined && !(levantamiento.repeticiones?.[clave] ?? []).some((r) => r.id === repeticion);
}

function editar(levantamiento: Levantamiento, seccion: string, ahora: Date, cambio: (valores: Record<string, Valor>) => void) {
  // Regla 4: después del envío el técnico no edita.
  if (levantamiento.estado !== "borrador") throw new LevantamientoNoEditable(levantamiento.id);
  // Lo que llega tarde a una repetición quitada (un «Deshacer», una foto que terminaba de procesarse) no la revive:
  // no tendría dónde verse y el envío la rechazaría para siempre (iteración 42).
  if (deRepeticionQuitada(levantamiento, seccion)) return levantamiento;
  const valores = { ...levantamiento.respuestas[seccion] };
  cambio(valores);
  return {
    ...levantamiento,
    respuestas: { ...levantamiento.respuestas, [seccion]: valores },
    actualizadoEn: ahora.toISOString(),
  };
}

/** Guarda o borra (`undefined`) una respuesta del borrador. */
export function responder(
  levantamiento: Levantamiento,
  seccion: string,
  campo: string,
  valor: Valor | undefined,
  ahora: Date,
): Levantamiento {
  return editar(levantamiento, seccion, ahora, (valores) => {
    if (valor === undefined) delete valores[campo];
    else valores[campo] = valor;
  });
}

/** Agrega una foto a un campo sin repetirla (los archivos se direccionan por contenido). */
export function agregarFoto(levantamiento: Levantamiento, seccion: string, campo: string, huella: string, ahora: Date): Levantamiento {
  return editar(levantamiento, seccion, ahora, (valores) => {
    const actuales = valores[campo];
    const fotos = Array.isArray(actuales) ? (actuales as readonly string[]) : [];
    if (!fotos.includes(huella)) valores[campo] = [...fotos, huella];
  });
}

function editarRepeticiones(levantamiento: Levantamiento, seccion: string, ahora: Date, cambio: (lista: { id: string; nombre: string }[]) => void): Levantamiento {
  // Regla 4: después del envío el técnico no edita.
  if (levantamiento.estado !== "borrador") throw new LevantamientoNoEditable(levantamiento.id);
  const actual = levantamiento.repeticiones?.[seccion];
  const lista = [...(actual ?? [])];
  cambio(lista);
  // Renombrar o quitar en una sección sin repeticiones no cambia nada: no se crea una lista que el envío rechazaría.
  if (actual === undefined && lista.length === 0) return levantamiento;
  return { ...levantamiento, repeticiones: { ...levantamiento.repeticiones, [seccion]: lista }, actualizadoEn: ahora.toISOString() };
}

/** Agrega una repetición al final, con el primer nombre libre ("Tablero 3"). */
export function agregarRepeticion(levantamiento: Levantamiento, formato: VersionFormato, seccion: string, id: string, ahora: Date): Levantamiento {
  const definicion = formato.secciones.find((s) => s.clave === seccion);
  if (!definicion?.repetible) throw new Error(`La sección ${seccion} no es repetible`);
  const maximo = definicion.repetible.max ?? LIMITES.repeticiones;
  return editarRepeticiones(levantamiento, seccion, ahora, (lista) => {
    if (lista.length >= maximo) throw new Error(`La sección ${seccion} ya tiene el máximo de repeticiones (${maximo})`);
    if (lista.some((r) => r.id === id)) throw new Error(`La repetición ${id} ya existe`);
    lista.push({ id, nombre: nombrePorDefecto(definicion, lista) });
  });
}

export function renombrarRepeticion(levantamiento: Levantamiento, seccion: string, id: string, nombre: string, ahora: Date): Levantamiento {
  return editarRepeticiones(levantamiento, seccion, ahora, (lista) => {
    const i = lista.findIndex((r) => r.id === id);
    // Un nombre vacío deja el anterior: el envío exige nombre.
    const limpio = nombre.trim().slice(0, LIMITES.nombreDeRepeticion);
    if (i >= 0 && limpio !== "") lista[i] = { id, nombre: limpio };
  });
}

/** Quita la repetición y sus respuestas. Las fotos siguen en el teléfono hasta que nada las use. */
export function quitarRepeticion(levantamiento: Levantamiento, seccion: string, id: string, ahora: Date): Levantamiento {
  const sinLaRepeticion = editarRepeticiones(levantamiento, seccion, ahora, (lista) => {
    const i = lista.findIndex((r) => r.id === id);
    if (i >= 0) lista.splice(i, 1);
  });
  const { [claveDeRepeticion(seccion, id)]: _quitada, ...respuestas } = sinLaRepeticion.respuestas;
  return { ...sinLaRepeticion, respuestas };
}

/**
 * Deshace `quitarRepeticion` (iteración 24c): la repetición vuelve a su lugar con sus respuestas. Si ya está, no
 * cambia nada, así un segundo "Deshacer" no la duplica.
 */
export function restaurarRepeticion(
  levantamiento: Levantamiento,
  seccion: string,
  repeticion: { id: string; nombre: string },
  posicion: number,
  respuestas: Record<string, Valor> | undefined,
  ahora: Date,
): Levantamiento {
  if (levantamiento.repeticiones?.[seccion]?.some((r) => r.id === repeticion.id)) return levantamiento;
  const conLaRepeticion = editarRepeticiones(levantamiento, seccion, ahora, (lista) => {
    lista.splice(Math.min(posicion, lista.length), 0, { ...repeticion });
  });
  if (!respuestas) return conLaRepeticion;
  return { ...conLaRepeticion, respuestas: { ...conLaRepeticion.respuestas, [claveDeRepeticion(seccion, repeticion.id)]: respuestas } };
}

/**
 * Sin las respuestas de repeticiones que ya no existen. Solo las dejaba una escritura tardía antes de la iteración 42:
 * son de algo que el técnico quitó, y el envío las rechaza (`seccion_desconocida`) sin que la pantalla pueda arreglarlo.
 */
export function sinRespuestasHuerfanas<L extends Levantamiento>(levantamiento: L): L {
  if (!Object.keys(levantamiento.respuestas).some((s) => deRepeticionQuitada(levantamiento, s))) return levantamiento;
  return { ...levantamiento, respuestas: Object.fromEntries(Object.entries(levantamiento.respuestas).filter(([s]) => !deRepeticionQuitada(levantamiento, s))) };
}
