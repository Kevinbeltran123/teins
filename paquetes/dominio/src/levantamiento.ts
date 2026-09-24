import type { VersionFormato } from "./formato";

/** Medida: el número va como texto decimal para no introducir errores de coma flotante (ADR-0006). */
export interface ValorMedida {
  valor: string;
  unidad: string;
}

/** Fotos: identificadores de archivo (huella SHA-256), nunca el binario (ADR-0007). */
export type ValorFotos = readonly string[];

/** Regla 3: un dato obligatorio que no se pudo obtener se marca con su motivo. */
export interface ValorNoObtenido {
  noObtenido: true;
  motivo: string;
}

export type Valor = string | ValorMedida | ValorFotos | ValorNoObtenido;

/** Respuestas por clave de sección y clave de campo. */
export type Respuestas = Readonly<Record<string, Readonly<Record<string, Valor>>>>;

export type EstadoLevantamiento = "borrador" | "enviado";

export interface Levantamiento {
  id: string;
  formato: string;
  versionFormato: number;
  estado: EstadoLevantamiento;
  respuestas: Respuestas;
  /** Horas del dispositivo (regla 16): declarativas; la oficial la pone el servidor al recibirlo. */
  creadoEn: string;
  actualizadoEn: string;
  enviadoEn?: string;
}

export function crearLevantamiento(formato: VersionFormato, id: string, ahora: Date): Levantamiento {
  const fecha = ahora.toISOString();
  return {
    id,
    formato: formato.formato,
    versionFormato: formato.version,
    estado: "borrador",
    respuestas: {},
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
