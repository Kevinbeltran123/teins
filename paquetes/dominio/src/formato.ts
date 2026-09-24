// Subconjunto del meta-esquema de ADR-0006 para el corte 0: una sección, tres tipos de campo.

interface CampoBase {
  clave: string;
  etiqueta: string;
  obligatorio?: boolean;
}

export type DefinicionCampo =
  | (CampoBase & { tipo: "texto" })
  | (CampoBase & { tipo: "medida"; unidades: readonly string[] })
  | (CampoBase & { tipo: "foto"; min?: number });

export interface DefinicionSeccion {
  clave: string;
  titulo: string;
  campos: readonly DefinicionCampo[];
}

export interface VersionFormato {
  formato: string;
  version: number;
  secciones: readonly DefinicionSeccion[];
}
