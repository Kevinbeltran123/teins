import type { ArchivoNuevo } from "../datos/repositorio";
import { dibujarSello, type DatosDelSello } from "./sello";

const LADO_MAXIMO = 1600;
const CALIDAD_JPEG = 0.8;

/**
 * Recodifica la foto en el dispositivo (ADR-0007): aplica la orientación, limita el tamaño
 * y elimina todos los metadatos, incluida la ubicación (QA-23). El identificador es la huella SHA-256. Con `sello`, la
 * franja de hora, ubicación y mapa se dibuja en la imagen (ADR-0052): las coordenadas quedan a la vista, no en metadatos,
 * y la huella se calcula después, sobre la foto con su franja.
 */
export async function procesarFoto(original: File, ahora: Date, sello?: DatosDelSello): Promise<ArchivoNuevo> {
  const url = URL.createObjectURL(original);
  try {
    const imagen = new Image();
    imagen.src = url;
    // Los navegadores aplican la orientación EXIF al decodificar una <img>.
    await imagen.decode();

    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(imagen.naturalWidth * escala);
    lienzo.height = Math.round(imagen.naturalHeight * escala);
    const contexto = lienzo.getContext("2d");
    if (!contexto) throw new Error("El navegador no permite procesar la imagen");
    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    if (sello) await dibujarSello(contexto, lienzo.width, sello, sello.mapa ? await cargarMapa(sello.mapa.imagen) : null);

    const blob = await new Promise<Blob | null>((resolver) => lienzo.toBlob(resolver, "image/jpeg", CALIDAD_JPEG));
    if (!blob) throw new Error("No se pudo comprimir la foto");
    const datos = await blob.arrayBuffer();
    return { id: await huella(datos), datos, tipo: "image/jpeg", creadoEn: ahora.toISOString() };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** El mapa incrustado (`data:`), listo para dibujar; si no se puede leer, la foto sale sin él. */
async function cargarMapa(imagen: string): Promise<HTMLImageElement | null> {
  try {
    const mapa = new Image();
    mapa.src = imagen;
    await mapa.decode();
    return mapa;
  } catch {
    return null;
  }
}

export async function huella(datos: ArrayBuffer): Promise<string> {
  const resumen = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(resumen), (b) => b.toString(16).padStart(2, "0")).join("");
}
