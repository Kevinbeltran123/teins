import { randomInt } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { Page } from "@playwright/test";

/**
 * Imagen de prueba (ficticia, R5): la app la recodifica a JPEG como una foto de la cámara.
 * Una franja de tono aleatorio la hace única por corrida: los archivos se direccionan por contenido,
 * y una foto repetida no se vuelve a subir, así que la prueba no ejercitaría la carga.
 */
export function fotoDePrueba(tono = randomInt(20, 236)): Buffer {
  const [ancho, alto] = [640, 480];
  const fila = (y: number) => Buffer.concat([Buffer.from([0]), Buffer.alloc(ancho * 3, y < 32 ? tono : y % 2 ? 90 : 200)]);
  const datos = deflateSync(Buffer.concat(Array.from({ length: alto }, (_, y) => fila(y))));
  const trozo = (tipo: string, contenido: Buffer) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(contenido.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo), contenido])));
    return Buffer.concat([largo, Buffer.from(tipo), contenido, crc]);
  };
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo("IHDR", cabecera), trozo("IDAT", datos), trozo("IEND", Buffer.alloc(0))]);
}

function crc32(b: Buffer): number {
  let c = ~0;
  for (const byte of b) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

export async function iniciarSesion(page: Page, u: { usuario: string; contrasena: string }) {
  await page.getByLabel("Usuario").fill(u.usuario);
  await page.getByLabel("Contraseña").fill(u.contrasena);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
}
