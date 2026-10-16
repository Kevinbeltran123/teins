import { useLiveQuery } from "dexie-react-hooks";

/** Lo último que leyó cada pantalla, en memoria mientras la app está abierta. Nunca se guarda en el teléfono. */
const recuerdo = new Map<string, unknown>();

/**
 * `useLiveQuery` que, al volver a montarse, empieza con lo último que leyó y después se actualiza: el inicio no
 * muestra su esqueleto al volver de una captura (iteración 27). La clave lleva al usuario cuando la lectura es suya.
 */
export function useLecturaRecordada<T>(clave: string, lectura: () => Promise<T> | T, dependencias: unknown[]): T | undefined {
  const valor = useLiveQuery(lectura, dependencias, recuerdo.get(clave) as T | undefined);
  if (valor !== undefined) recuerdo.set(clave, valor);
  return valor;
}

/** Al cerrar la sesión (o vencerse) no queda nada de la persona anterior en memoria. */
export const olvidarLecturas = () => recuerdo.clear();
