const hora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });
const soloHora = new Intl.DateTimeFormat("es-CO", { timeStyle: "medium" });
const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export const fechaHora = (iso: string) => hora.format(new Date(iso));
export const horaExacta = (iso: string) => soloHora.format(new Date(iso));
export const megabytes = (bytes: number) => `${numero.format(bytes / 1024 / 1024)} MB`;
