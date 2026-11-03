/**
 * La coordenada que sale del teléfono para pedir el mapa de la foto de llegada (ADR-0052): tres decimales, unos 110 m en
 * la latitud de Colombia. El teléfono la redondea antes de pedirla y el servidor otra vez antes de llamar a Geoapify;
 * el punto exacto solo lo usa el teléfono para dibujar el pin.
 */
export const coordenadaParaMapa = (grados: number) => Math.round(grados * 1000) / 1000;
