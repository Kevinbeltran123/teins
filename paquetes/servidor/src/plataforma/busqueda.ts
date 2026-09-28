import { sql, type SQL, type AnyColumn } from "drizzle-orm";

/** Texto de búsqueda sin mayúsculas ni tildes: "Gómez" y "gomez" encuentran lo mismo. */
export const normalizarBusqueda = (texto: string) =>
  texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * La columna contiene el texto, sin distinguir mayúsculas ni tildes (del lado de la base, con `translate`: no
 * hace falta la extensión unaccent). Los comodines del texto se escapan: se busca lo que la persona escribió.
 */
export function contieneTexto(columna: AnyColumn | SQL, texto: string): SQL {
  const patron = `%${normalizarBusqueda(texto).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql`translate(lower(${columna}), 'áéíóúüñàèìòù', 'aeiouunaeiou') like ${patron}`;
}
