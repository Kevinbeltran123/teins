// Subconjunto del meta-esquema de ADR-0006: tipos texto, medida y foto.

interface CampoBase {
  clave: string;
  etiqueta: string;
  obligatorio?: boolean | undefined;
}

export type DefinicionCampo =
  | (CampoBase & { tipo: "texto" })
  | (CampoBase & { tipo: "medida"; unidades: readonly string[] })
  | (CampoBase & { tipo: "foto"; min?: number | undefined });

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
