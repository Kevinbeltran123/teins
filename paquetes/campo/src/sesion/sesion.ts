import { db, repositorio, sellarEnSegundoPlano } from "../datos/instancia";
import { quitarSuscripcion } from "../dispositivo/avisos";
import { almacen, cliente, sincronizarEnSegundoPlano } from "../sincronizacion/instancia";
import { VERSION_APP } from "../version";

/** Un usuario de oficina no captura en campo (tabla de permisos del modelo de dominio). */
export class RolNoPermitido extends Error {
  constructor() {
    super("Este usuario no es de técnico");
    this.name = "RolNoPermitido";
  }
}

/**
 * Inicia sesión (requiere conexión, como toda primera instalación: ADR-0015). Guarda el usuario
 * para trabajar sin conexión y reanuda lo que esperaba por una sesión.
 */
export async function iniciarSesion(usuario: string, contrasena: string): Promise<void> {
  await cliente.iniciarSesion(usuario, contrasena);
  await prepararSesion();
}

/** Con la llave de acceso del teléfono (Face ID, huella o PIN; iteración 13): sin escribir nada. */
export async function iniciarSesionConLlave(): Promise<void> {
  await cliente.iniciarSesionConLlave();
  await prepararSesion();
}

async function prepararSesion(): Promise<void> {
  const { usuario: datos, permisoLocalHasta } = await cliente.llamar("obtenerSesion");
  if (datos.rol !== "tecnico") {
    await cliente.cerrarSesion().catch(() => undefined);
    throw new RolNoPermitido();
  }
  await almacen.renovarPermiso(datos.id, permisoLocalHasta, VERSION_APP);
  await db.ajustes.put({ clave: "usuario", valor: datos });
  await db.ajustes.delete("acceso_cerrado");
  await repositorio.asignarSinResponsable(datos.id);
  // Lo que no tenía responsable ya lo tiene: se cifra con su clave.
  void sellarEnSegundoPlano();
  await almacen.reanudar("requiere_sesion");
  // La primera instalación descarga visitas y formatos de inmediato (ADR-0015, sección 5).
  sincronizarEnSegundoPlano({ bajar: true });
}

/** Cierra la sesión. Nunca borra datos del teléfono: lo pendiente espera a que su responsable vuelva. */
export async function cerrarSesion(): Promise<void> {
  // Con la sesión todavía abierta: el servidor solo deja quitar la suscripción propia (ADR-0023).
  await quitarSuscripcion().catch(() => undefined);
  await cliente.cerrarSesion().catch(() => undefined);
  await db.ajustes.delete("usuario");
}
