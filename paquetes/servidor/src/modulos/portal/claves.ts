import { createHash, randomInt, scrypt, timingSafeEqual, randomBytes } from "node:crypto";
import { promisify } from "node:util";

const derivar = promisify(scrypt) as (clave: string, sal: Buffer, largo: number, opciones: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

/** Sin letras ni números que se confunden al leerlos en voz alta o escribirlos (0/O, 1/l/I). */
const MINUSCULAS = "abcdefghjkmnpqrstuvwxyz23456789";
const MAYUSCULAS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const aleatorio = (alfabeto: string, largo: number) => Array.from({ length: largo }, () => alfabeto[randomInt(alfabeto.length)]).join("");

/** 20 caracteres de 31 posibles, unos 99 bits: no se puede adivinar ni recorrer. */
export const nuevoIdentificador = () => aleatorio(MINUSCULAS, 20);

/** 12 caracteres (unos 59 bits), en grupos de cuatro para dictarla: ABCD-EFGH-JKMN. */
export function nuevaClave(): string {
  const c = aleatorio(MAYUSCULAS, 12);
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`;
}

/** El cliente puede escribirla con minúsculas, espacios o sin guiones. */
export const normalizarClave = (clave: string) => clave.toUpperCase().replace(/[^A-Z0-9]/g, "");

const PARAMETROS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

/** Hash resistente a fuerza bruta (QA-7): scrypt con sal propia, parámetros guardados con el hash. */
export async function hashDeClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await derivar(normalizarClave(clave), sal, 32, PARAMETROS);
  return `scrypt$${PARAMETROS.N}$${PARAMETROS.r}$${PARAMETROS.p}$${sal.toString("base64")}$${hash.toString("base64")}`;
}

export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const [algoritmo, n, r, p, sal, hash] = guardado.split("$");
  if (algoritmo !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const calculado = await derivar(normalizarClave(clave), Buffer.from(sal, "base64"), esperado.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMETROS.maxmem });
  return timingSafeEqual(calculado, esperado);
}

/** Con un identificador desconocido se verifica igual contra este hash: la respuesta tarda lo mismo. */
export const HASH_DE_RELLENO = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export const nuevoToken = () => randomBytes(32).toString("base64url");
export const huellaDeToken = (token: string) => createHash("sha256").update(token).digest("hex");
