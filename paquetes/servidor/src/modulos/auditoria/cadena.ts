import { createHash } from "node:crypto";

/** Versión de la serialización canónica. Si cambia, los registros viejos se verifican con la suya (ADR-0008). */
export const VERSION_FORMATO_REGISTRO = 1;

export interface ContenidoRegistro {
  organizacionId: string;
  agregadoTipo: string;
  agregadoId: string;
  secuencia: number;
  tipoEvento: string;
  rutaCampo: string | null;
  valorAnterior: unknown;
  valorNuevo: unknown;
  autorId: string;
  horaServidor: Date;
  horaDispositivo: Date | null;
  correlacion: string;
  motivo: string | null;
}

/** JSON con llaves ordenadas en todos los niveles: el mismo contenido siempre produce el mismo texto. */
export function canonico(valor: unknown): string {
  if (valor === null || valor === undefined) return "null";
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(",")}]`;
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  if (typeof valor === "object") {
    const entradas = Object.entries(valor as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entradas.map(([k, v]) => `${JSON.stringify(k)}:${canonico(v)}`).join(",")}}`;
  }
  return JSON.stringify(valor);
}

const serializadores: Record<number, (c: ContenidoRegistro) => string> = {
  1: (c) => canonico({ v: 1, ...c }),
};

/** hash = SHA-256(hash anterior ‖ serialización canónica). */
export function calcularHash(version: number, contenido: ContenidoRegistro, hashAnterior: Buffer | null): Buffer {
  const serializar = serializadores[version];
  if (!serializar) throw new Error(`Versión de registro de auditoría desconocida: ${version}`);
  return createHash("sha256")
    .update(hashAnterior ?? Buffer.alloc(0))
    .update(serializar(contenido), "utf8")
    .digest();
}
