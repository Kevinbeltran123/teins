import type { z } from "zod";
import type { FuentesDelAsistente, SerieDelAsistente, TablaDelAsistente } from "@teins/protocolo";
import type { TxOrganizacion } from "../../plataforma/base-de-datos";

export interface ContextoHerramienta {
  organizacionId: string;
  usuarioId: string;
  /** AAAA-MM-DD en America/Bogota. */
  hoy: string;
}

/** Una cifra que el modelo puede elegir como destacada; el valor lo calculó la herramienta, nunca el modelo. */
export interface CifraCandidata {
  id: string;
  valor: string;
  unidad: string | null;
  descripcion: string;
}

export interface ResultadoHerramienta {
  /** Lo que ve la persona junto al paso («3 ítems»). */
  resumen: string;
  /** Reemplaza la etiqueta hecha cuando el resultado la puede decir mejor: los nombres que la entrada solo traía como ids. */
  etiqueta?: string;
  /** Lo que ve el modelo: ya minimizado (ADR-0060). */
  datos: unknown;
  tabla?: TablaDelAsistente;
  fuentes?: FuentesDelAsistente;
  cifras?: CifraCandidata[];
  serie?: SerieDelAsistente;
}

/** Una herramienta de solo lectura (ADR-0060). Corre dentro de `enOrganizacion` con la conexión de negocio. */
export interface Herramienta<E = unknown> {
  /** snake_case, el que ve el modelo. */
  nombre: string;
  /** En español, para el modelo. */
  descripcion: string;
  /** Se convierte a JSON Schema estricto para la API. */
  entrada: z.ZodType<E>;
  /**
   * `false` en las herramientas con muchos parámetros opcionales: la API suma los opcionales de todas las herramientas
   * estrictas de un pedido y rechaza el pedido entero si pasan del límite. Su entrada se valida igual con `entrada`.
   */
  estricta?: boolean;
  etiquetas(entrada: E): { enCurso: string; hecha: string };
  ejecutar(tx: TxOrganizacion, entrada: E, contexto: ContextoHerramienta): Promise<ResultadoHerramienta>;
}

/** Un paso como se guarda: la pantalla ve solo la etiqueta y el resumen; las referencias de la respuesta usan el resultado. */
export interface PasoGuardado {
  herramienta: string;
  etiquetaEnCurso: string;
  etiquetaHecha: string;
  estado: "en_curso" | "hecho" | "fallo";
  /** Lo que ve la persona junto al paso; queda al terminar. */
  resumen: string | null;
  /** El resultado completo: solo mientras la respuesta está en curso. Al terminar se borra (Ley 1581, temporalidad). */
  resultado?: ResultadoHerramienta | null;
}
