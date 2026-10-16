// Subconjunto del meta-esquema de ADR-0006: tipos texto, medida, foto, boceto, cantidades y firma, y secciones repetibles.

interface CampoBase {
  clave: string;
  etiqueta: string;
  obligatorio?: boolean | undefined;
}

export type DefinicionCampo =
  /** `largo`: varias líneas. `valoresComunes`: respuestas frecuentes que se eligen con un toque (rediseño Recorrido). */
  | (CampoBase & { tipo: "texto"; largo?: boolean | undefined; valoresComunes?: readonly string[] | undefined })
  | (CampoBase & { tipo: "medida"; unidades: readonly string[]; valoresComunes?: readonly string[] | undefined })
  /** `puestos`: las tomas que se esperan, con su nombre ("Fachada", "Placa"): se ve cuál falta. */
  | (CampoBase & { tipo: "foto"; min?: number | undefined; puestos?: readonly string[] | undefined })
  /** Croquis a mano sobre cuadrícula (ADR-0019). */
  | (CampoBase & { tipo: "boceto" })
  /** Tabla de materiales y trabajos (F9), con las unidades permitidas. */
  | (CampoBase & { tipo: "cantidades"; unidades: readonly string[] })
  /** Firma de quien recibe la visita (ADR-0024). `declaracion` admite {tecnico}, {sitio} y {fecha}. */
  | (CampoBase & { tipo: "firma"; declaracion?: string | undefined });

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
