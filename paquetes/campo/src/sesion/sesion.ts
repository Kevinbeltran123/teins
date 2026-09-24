import { useLiveQuery } from "dexie-react-hooks";
import { db, repositorio } from "../datos/instancia";
import type { UsuarioLocal } from "../datos/modelo";
import { almacen, cliente, sincronizarEnSegundoPlano } from "../sincronizacion/instancia";

/** Un usuario de oficina no captura en campo (tabla de permisos del modelo de dominio). */
export class RolNoPermitido extends Error {
  constructor() {
    super("Este usuario no es de técnico");
    this.name = "RolNoPermitido";
  }
}

/** Usuario con sesión en el teléfono: `undefined` mientras carga, `null` sin sesión. */
export function useUsuario(): UsuarioLocal | null | undefined {
  return useLiveQuery(async () => (await db.ajustes.get("usuario"))?.valor ?? null);
}

/**
 * Inicia sesión (requiere conexión, como toda primera instalación: ADR-0015). Guarda el usuario
 * para trabajar sin conexión y reanuda lo que esperaba por una sesión.
 */
export async function iniciarSesion(usuario: string, contrasena: string): Promise<void> {
  await cliente.iniciarSesion(usuario, contrasena);
  const { usuario: datos } = await cliente.llamar("obtenerSesion");
  if (datos.rol !== "tecnico") {
    await cliente.cerrarSesion().catch(() => undefined);
    throw new RolNoPermitido();
  }
  await db.ajustes.put({ clave: "usuario", valor: datos });
  await repositorio.asignarSinResponsable(datos.id);
  await almacen.reanudar("requiere_sesion");
  sincronizarEnSegundoPlano();
}

/** Cierra la sesión. Nunca borra datos del teléfono: lo pendiente espera a que su responsable vuelva. */
export async function cerrarSesion(): Promise<void> {
  await cliente.cerrarSesion().catch(() => undefined);
  await db.ajustes.delete("usuario");
}
