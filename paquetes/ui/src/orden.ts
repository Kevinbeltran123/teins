/** Una copia de la lista con el elemento de `de` en `a`; si no se mueve, la misma lista. */
export function moverEnLista<T>(lista: readonly T[], de: number, a: number): T[] {
  if (de === a) return lista as T[];
  const copia = [...lista];
  const [x] = copia.splice(de, 1);
  copia.splice(a, 0, x!);
  return copia;
}

/**
 * Dónde cae la fila `de` si su centro está en `centro`: la última fila cuya mitad ya pasó, hacia abajo o hacia arriba.
 * Las filas pueden medir distinto (un capítulo con su selección abierta).
 */
export function destinoAlArrastrar(filas: readonly { top: number; height: number }[], de: number, centro: number): number {
  const mitad = (j: number) => filas[j]!.top + filas[j]!.height / 2;
  let a = de;
  for (let j = de + 1; j < filas.length; j++) if (centro >= mitad(j)) a = j;
  if (a === de) for (let j = de - 1; j >= 0; j--) if (centro <= mitad(j)) a = j;
  return a;
}
