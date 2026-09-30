import { useLiveQuery } from "dexie-react-hooks";
import { leerUsuario } from "../datos/base";
import { db } from "../datos/instancia";
import type { UsuarioLocal } from "../datos/modelo";

/** Usuario con sesión en el teléfono: `undefined` mientras carga, `null` sin sesión. */
export function useUsuario(): UsuarioLocal | null | undefined {
  return useLiveQuery(() => leerUsuario(db));
}
