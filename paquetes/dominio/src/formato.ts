// Subconjunto del meta-esquema de ADR-0006 y ADR-0050: tipos texto, medida, opcion, opciones, horario, foto, boceto, cantidades y firma, secciones repetibles y tablas de medidas.

interface CampoBase {
  clave: string;
  etiqueta: string;
  obligatorio?: boolean | undefined;
}

export type DefinicionCampo =
  /** `largo`: varias líneas. `valoresComunes`: respuestas frecuentes que se eligen con un toque (rediseño Recorrido). */
  | (CampoBase & { tipo: "texto"; largo?: boolean | undefined; valoresComunes?: readonly string[] | undefined })
  | (CampoBase & { tipo: "medida"; unidades: readonly string[]; valoresComunes?: readonly string[] | undefined })
  /** Una opción de varias (ADR-0050). `otro`: admite además un texto libre ("Otro"). Sí/No es una selección de dos. */
  | (CampoBase & { tipo: "opcion"; opciones: readonly string[]; otro?: boolean | undefined })
  /** Varias opciones a la vez, con "Otro" opcional (ADR-0050). */
  | (CampoBase & { tipo: "opciones"; opciones: readonly string[]; otro?: boolean | undefined })
  /** Hora de llegada y de salida, con el total calculado (ADR-0050). */
  | (CampoBase & { tipo: "horario" })
  /**
   * `puestos`: las tomas que se esperan, con su nombre ("Fachada", "Placa"): se ve cuál falta. `sello`: la foto lleva
   * la franja de hora, ubicación y mapa (ADR-0052).
   */
  | (CampoBase & { tipo: "foto"; min?: number | undefined; puestos?: readonly string[] | undefined; sello?: SelloDeFoto | undefined })
  /** Croquis a mano sobre cuadrícula (ADR-0019). */
  | (CampoBase & { tipo: "boceto" })
  /** Tabla de materiales y trabajos (F9), con las unidades permitidas. */
  | (CampoBase & { tipo: "cantidades"; unidades: readonly string[] })
  /** Firma de quien recibe la visita (ADR-0024). `declaracion` admite {tecnico}, {sitio} y {fecha}. */
  | (CampoBase & { tipo: "firma"; declaracion?: string | undefined; documento?: "opcional" | "obligatorio" | undefined });

/** Qué lleva la franja de una foto (ADR-0052): siempre las dos horas; la ubicación y el mapa, si el formato los pide. */
export interface SelloDeFoto {
  ubicacion?: boolean | undefined;
  mapa?: boolean | undefined;
}

/**
 * Cómo se acomodan campos `medida` que ya existen (ADR-0050): las columnas son solo encabezados ("F1", "F2", "F3");
 * cada fila tiene 1 campo o tantos como columnas. La tabla es presentación: cada celda sigue siendo un campo.
 */
export interface TablaDeMedidas {
  titulo?: string | undefined;
  columnas: readonly string[];
  filas: readonly { etiqueta: string; campos: readonly string[] }[];
}

/** Primera versión de `campo` que sabe dibujar los tipos y las piezas de ADR-0050 y ADR-0052 (ADR-0015, punto 4). */
export const VERSION_APP_OPCIONES = 16;
export const VERSION_APP_HORARIO = 16;
export const VERSION_APP_TABLAS = 16;
export const VERSION_APP_SELLO = 16;
export const VERSION_APP_DOCUMENTO_DE_FIRMA = 16;

export type TipoCampo = DefinicionCampo["tipo"];

/**
 * Qué tipos son un dato simple, que se lee en una línea (texto, medida, selecciones y horario). Los demás van en su propio bloque.
 * Es un Record de todos los tipos: un tipo nuevo no compila hasta decidir aquí cómo se presenta.
 */
const DATO_SIMPLE = { texto: true, medida: true, opcion: true, opciones: true, horario: true, foto: false, boceto: false, cantidades: false, firma: false } satisfies Record<TipoCampo, boolean>;
export const esDatoSimple = (campo: Pick<DefinicionCampo, "tipo">) => DATO_SIMPLE[campo.tipo];

/** Sección que el técnico repite cuantas veces haga falta: "Tablero 1", "Tablero 2" (F2). */
export interface Repetible {
  /** Cómo se llama cada repetición: "Tablero", "Piso", "Área". */
  etiqueta: string;
  /** Repeticiones mínimas para enviar; el levantamiento nace con ellas. Por defecto 0. */
  min?: number | undefined;
  /** Máximo de repeticiones. Por defecto LIMITES.repeticiones. */
  max?: number | undefined;
}

export interface DefinicionSeccion {
  clave: string;
  titulo: string;
  /** Solo para la empresa (ADR-0039): no sale en el informe del cliente salvo que oficina la muestre. Las fotos de llegada. */
  soloEmpresa?: boolean | undefined;
  repetible?: Repetible | undefined;
  /** Mediciones por fase u otras que se leen mejor en filas y columnas (ADR-0050). */
  tablas?: readonly TablaDeMedidas[] | undefined;
  campos: readonly DefinicionCampo[];
}

export interface VersionFormato {
  formato: string;
  version: number;
  /** Nombre que ve el técnico. Opcional porque las versiones publicadas antes no lo tienen (regla 8). */
  nombre?: string | undefined;
  /**
   * Versión mínima de `campo` que sabe mostrar esta versión (ADR-0015, punto 4). La bajada no la
   * entrega a dispositivos más viejos: el técnico sigue con la versión anterior hasta actualizar.
   */
  appMinima?: number | undefined;
  secciones: readonly DefinicionSeccion[];
}
