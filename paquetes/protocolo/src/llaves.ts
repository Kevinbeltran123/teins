/** Llave de idempotencia de un envío: derivada del levantamiento, estable entre reintentos y reinstalaciones. */
export const llaveDeEnvio = (idLevantamiento: string) => `enviar:${idLevantamiento}`;
