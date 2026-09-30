import { createHmac } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Código TOTP (RFC 6238: SHA-1, 6 dígitos, 30 segundos) de una clave en base32, como una app autenticadora. */
export function codigoTotp(clave: string, ahora = Date.now()): string {
  const bits = [...clave.replace(/=+$/, "").toUpperCase()].map((c) => BASE32.indexOf(c).toString(2).padStart(5, "0")).join("");
  const llave = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(ahora / 30_000)));
  const h = createHmac("sha1", llave).update(contador).digest();
  const desplazamiento = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(desplazamiento) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
