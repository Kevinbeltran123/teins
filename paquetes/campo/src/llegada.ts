import { horaCorta, type Respuestas, type VersionFormato } from "@teins/dominio";

/*
  La hora de llegada se sugiere en el campo de horario, nunca se llena sola (ADR-0050): sale de la foto de llegada, la
  de un campo con `sello`, y si no hay foto, del momento en que se empezó el levantamiento.
*/

/** Las huellas de las fotos de los campos con sello, en el orden del formato. */
export function huellasConSello(formato: VersionFormato, respuestas: Respuestas): string[] {
  return formato.secciones.flatMap((s) =>
    s.campos.flatMap((c) => {
      const valor = c.tipo === "foto" && c.sello ? respuestas[s.clave]?.[c.clave] : undefined;
      return Array.isArray(valor) ? (valor as unknown[]).filter((h): h is string => typeof h === "string") : [];
    }),
  );
}

/** "08:14": la hora del teléfono de un momento ISO, la forma de `<input type="time">`. */
export const horaLocalDe = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** El botón «Usar 8:14 a. m. (foto de llegada)». `creadasEn`: cuándo se tomó cada foto, por huella (lo que ya se leyó). */
export function sugerenciaDeLlegada(
  formato: VersionFormato,
  respuestas: Respuestas,
  inicioDelLevantamiento: string,
  creadasEn: ReadonlyMap<string, string>,
): { hora: string; texto: string } {
  const momentos = huellasConSello(formato, respuestas).flatMap((h) => creadasEn.get(h) ?? []);
  const primera = momentos.sort()[0];
  const hora = horaLocalDe(primera ?? inicioDelLevantamiento);
  return { hora, texto: `Usar ${horaCorta(hora)} (${primera ? "foto de llegada" : "inicio del levantamiento"})` };
}
