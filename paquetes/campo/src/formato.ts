const hora = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" });
const soloHora = new Intl.DateTimeFormat("es-CO", { timeStyle: "medium" });
const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

export const fechaHora = (iso: string) => hora.format(new Date(iso));
export const horaExacta = (iso: string) => soloHora.format(new Date(iso));
export const megabytes = (bytes: number) => `${numero.format(bytes / 1024 / 1024)} MB`;

/** «2:00 p. m.» sin partirse en dos renglones («2:00 p.» y «m.»): los espacios de la hora pasan a ser duros. */
export const horaSinPartir = (texto: string) => texto.replace(/(\d) ([ap])\. m\./g, "$1 $2. m.");
