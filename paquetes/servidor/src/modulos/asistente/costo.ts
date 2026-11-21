/**
 * Precios por modelo en nanodólares por token (US$ por millón × 1000): así todo cálculo es entero y exacto. La caché
 * escrita cuesta 1,25 veces la entrada; la leída, una fracción que depende del modelo (ADR-0060).
 */
interface Precio {
  entrada: bigint;
  salida: bigint;
  /** La caché leída como fracción de la entrada: 1/10 o 1/20. */
  divisorCacheLeida: bigint;
  /** Por encima de este total de entrada (incluida la caché), el pedido entero se cobra a `largo`. */
  largo?: { desde: number; entrada: bigint; salida: bigint };
}

const PRECIOS = {
  "claude-haiku-5-5": { entrada: 100n, salida: 500n, divisorCacheLeida: 10n, largo: { desde: 100_000, entrada: 500n, salida: 2500n } },
  "claude-sonnet-5-5": { entrada: 2000n, salida: 10_000n, divisorCacheLeida: 20n },
  "claude-opus-5-5": { entrada: 4000n, salida: 20_000n, divisorCacheLeida: 20n },
  /** El modelo simulado no gasta. */
  simulado: { entrada: 0n, salida: 0n, divisorCacheLeida: 10n },
} satisfies Record<string, Precio>;

export const MODELOS_CON_PRECIO = Object.keys(PRECIOS).filter((m) => m !== "simulado");

export interface UsoDelModelo {
  entrada: number;
  salida: number;
  cacheLeida: number;
  cacheEscrita: number;
}

/** El costo de una vuelta en dólares, como decimal en texto (sin coma flotante). */
export function costoDe(modelo: string, uso: UsoDelModelo): string {
  const precio: Precio | undefined = (PRECIOS as Record<string, Precio>)[modelo];
  if (!precio) throw new Error(`Modelo sin precio: ${modelo}`);
  const totalEntrada = uso.entrada + uso.cacheLeida + uso.cacheEscrita;
  const { entrada, salida } = precio.largo && totalEntrada > precio.largo.desde ? precio.largo : precio;
  // 1,25 en cuartos y la caché leída en décimos o vigésimos, para seguir en enteros.
  const nano = BigInt(uso.entrada) * entrada + BigInt(uso.salida) * salida + (BigInt(uso.cacheEscrita) * entrada * 5n) / 4n + (BigInt(uso.cacheLeida) * entrada) / precio.divisorCacheLeida;
  return nanoADolares(nano);
}

function nanoADolares(nano: bigint): string {
  const entero = nano / 1_000_000_000n;
  const fraccion = (nano % 1_000_000_000n).toString().padStart(9, "0").replace(/(?<!0)0+$/, "");
  return fraccion ? `${entero}.${fraccion}` : `${entero}`;
}

/** Un decimal de la base («5.00», «0.000123400») en su forma corta («5», «0.0001234»). */
export const decimalCorto = (valor: string): string => (valor.includes(".") ? valor.replace(/(?<!0)0+$/, "").replace(/\.$/, "") : valor);
