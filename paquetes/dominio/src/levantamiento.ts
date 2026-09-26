import type { VersionFormato } from "./formato";
import type { ValorCantidades } from "./cantidades";
import { claveDeRepeticion, nombrePorDefecto, type Repeticiones } from "./repeticiones";
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

/** Regla 3: un dato obligatorio que no se pudo obtener se marca con su motivo. */
export interface ValorNoObtenido {
  noObtenido: true;
  motivo: string;
}

export type Valor = string | ValorMedida | ValorFotos | ValorBoceto | ValorCantidades | ValorNoObtenido;

export const esBoceto = (valor: unknown): valor is ValorBoceto => typeof valor === "object" && valor !== null && !Array.isArray(valor) && "boceto" in valor;

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

function editar(levantamiento: Levantamiento, seccion: string, ahora: Date, cambio: (valores: Record<string, Valor>) => void) {
  // Regla 4: después del envío el técnico no edita.
  if (levantamiento.estado !== "borrador") throw new LevantamientoNoEditable(levantamiento.id);
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
  const lista = [...(levantamiento.repeticiones?.[seccion] ?? [])];
  cambio(lista);
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
    if (i >= 0) lista[i] = { id, nombre: nombre.slice(0, LIMITES.nombreDeRepeticion) };
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
