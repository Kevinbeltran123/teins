import type { VersionFormato } from "@teins/dominio";

/** Formato ficticio del corte 0 (R5). Los formatos reales llegarán como datos desde el servidor. */
export const NOMBRE_FORMATO_DEMO = "Formato de prueba";

export const formatoDemo: VersionFormato = {
  formato: "prueba-ups",
  version: 1,
  secciones: [
    {
      clave: "cuarto_tecnico",
      titulo: "Cuarto técnico",
      campos: [
        { clave: "descripcion", etiqueta: "Descripción del sitio", tipo: "texto" },
        { clave: "potencia_nominal", etiqueta: "Potencia nominal", tipo: "medida", unidades: ["kVA", "kW"] },
        { clave: "distancia_tablero", etiqueta: "Distancia al tablero", tipo: "medida", unidades: ["m", "cm"] },
        { clave: "fotos_equipo", etiqueta: "Fotos del equipo", tipo: "foto" },
      ],
    },
  ],
};
