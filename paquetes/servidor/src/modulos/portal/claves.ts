import { createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import type { Config } from "../../config";

/**
 * Secreto de los códigos del portal (ADR-0053): derivado de `AUTH_SECRETO` con HKDF y una etiqueta propia, así no hay
 * otra variable que poner en cada entorno y no se reutiliza la misma llave para dos cosas.
 */
export const secretoDeCodigos = (config: Pick<Config, "AUTH_SECRETO">): Buffer => Buffer.from(hkdfSync("sha256", config.AUTH_SECRETO, "", "teins-portal-codigos-v1", 32));

/**
 * El código de un pedido: 6 dígitos del HMAC del id del pedido con el secreto. La base solo guarda el id (aleatorio),
 * así que sin el secreto un respaldo no permite calcularlo; y el worker que envía el correo llega al mismo código sin
 * que pase por la cola. El sesgo de reducir 32 bits a 10⁶ es de una parte en 4294: no da ventaja para adivinarlo.
 */
export function derivarCodigo(secreto: Buffer, pedidoId: string): string {
  const n = createHmac("sha256", secreto).update(`codigo:${pedidoId}`).digest().readUInt32BE(0);
  return String(n % 1_000_000).padStart(6, "0");
}

/** Compara en tiempo constante: lo que se escribió no revela cuántos dígitos acertó. */
export function mismoCodigo(secreto: Buffer, pedidoId: string, escrito: string): boolean {
  const esperado = Buffer.from(derivarCodigo(secreto, pedidoId));
  const recibido = Buffer.from(escrito.padEnd(6).slice(0, 6));
  return timingSafeEqual(esperado, recibido);
}

/** Compara dos huellas hexadecimales en tiempo constante. */
export const mismaHuella = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const nuevoToken = () => randomBytes(32).toString("base64url");
export const huellaDeToken = (token: string) => createHash("sha256").update(token).digest("hex");
