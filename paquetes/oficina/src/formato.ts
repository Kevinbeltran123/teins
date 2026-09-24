const fechaHora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });
const hora = new Intl.DateTimeFormat("es-CO", { timeStyle: "short" });
const relativo = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" });

export const aFechaHora = (iso: string) => fechaHora.format(new Date(iso));
export const aHora = (ms: number) => hora.format(new Date(ms));

/** "hace 3 horas": cuánto lleva esperando. */
export function haceCuanto(iso: string, ahora = Date.now()): string {
  const segundos = Math.round((new Date(iso).getTime() - ahora) / 1000);
  const unidades: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unidad, tamano] of unidades) {
    if (Math.abs(segundos) >= tamano) return relativo.format(Math.round(segundos / tamano), unidad);
  }
  return "hace un momento";
}
