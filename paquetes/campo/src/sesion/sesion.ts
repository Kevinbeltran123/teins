import { ErrorDeRed } from "@teins/protocolo";
import { db, repositorio, sellarEnSegundoPlano } from "../datos/instancia";
import { quitarSuscripcion } from "../dispositivo/avisos";
import { ponerInsignia } from "../dispositivo/insignia";
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
 * Entró con una contraseña temporal (ADR-0033): la cambia antes de cualquier otra cosa. El servidor niega todo lo
 * demás mientras tanto; el teléfono no guarda el usuario ni baja nada hasta que la cambie.
 */
export class ContrasenaTemporal extends Error {
  constructor() {
    super("La contraseña es temporal");
    this.name = "ContrasenaTemporal";
  }
}

/**
 * Inicia sesión (requiere conexión, como toda primera instalación: ADR-0015). Guarda el usuario
 * para trabajar sin conexión y reanuda lo que esperaba por una sesión.
 */
export async function iniciarSesion(usuario: string, contrasena: string): Promise<void> {
  await completarCierrePendiente();
  await cliente.iniciarSesion(usuario, contrasena);
  await prepararSesion();
}

/** Con la llave de acceso del teléfono (Face ID, huella o PIN; iteración 13): sin escribir nada. */
export async function iniciarSesionConLlave(): Promise<void> {
  await completarCierrePendiente();
  await cliente.iniciarSesionConLlave();
  await prepararSesion();
}

async function prepararSesion(): Promise<void> {
  const { usuario: datos, permisoLocalHasta, organizacion } = await cliente.llamar("obtenerSesion");
  if (datos.rol !== "tecnico") {
    await cliente.cerrarSesion().catch(() => undefined);
    throw new RolNoPermitido();
  }
  if (datos.debeCambiarContrasena) throw new ContrasenaTemporal();
  await almacen.renovarPermiso(datos.id, permisoLocalHasta, VERSION_APP);
  await db.ajustes.put({ clave: "usuario", valor: datos });
  // El nombre de la organización sale en la franja de la foto de llegada (ADR-0052).
  await db.ajustes.put({ clave: "organizacion", valor: organizacion.nombre });
  await db.ajustes.delete("acceso_cerrado");
  await repositorio.asignarSinResponsable(datos.id);
  // Lo que no tenía responsable ya lo tiene: se cifra con su clave.
  void sellarEnSegundoPlano();
  await almacen.reanudar("requiere_sesion");
  // La primera instalación descarga visitas y formatos de inmediato (ADR-0015, sección 5).
  sincronizarEnSegundoPlano({ bajar: true });
}

/** Cambia la temporal por la propia. `entrarConLaNueva` sigue como cualquier ingreso. */
export async function cambiarContrasenaTemporal(temporal: string, nueva: string): Promise<void> {
  await cliente.llamar("cambiarContrasena", { cuerpo: { actual: temporal, nueva } });
}

export const entrarConLaNueva = prepararSesion;

/** Sale sin cambiar la temporal: cierra la sesión en el servidor y no toca nada del teléfono. */
export async function salirSinCambiar(): Promise<void> {
  await cliente.cerrarSesion().catch(() => undefined);
}

/**
 * Cierra la sesión. Nunca borra datos del teléfono: lo pendiente espera a que su responsable vuelva. Sin
 * señal, la sesión sigue abierta en el servidor hasta que `completarCierrePendiente` la cierra.
 */
export async function cerrarSesion(): Promise<void> {
  // El número del ícono es de esta persona (iteración 46): no se queda para la siguiente.
  void ponerInsignia(0);
  // Con la sesión todavía abierta: el servidor solo deja quitar la suscripción propia (ADR-0023).
  await quitarSuscripcion().catch(() => undefined);
  const sinSenal = await cliente.cerrarSesion().then(
    () => false,
    (error: unknown) => error instanceof ErrorDeRed,
  );
  await db.transaction("rw", db.ajustes, async () => {
    await db.ajustes.delete("usuario");
    if (sinSenal) await db.ajustes.put({ clave: "cierre_pendiente", valor: new Date().toISOString() });
  });
  // Otra vez al final: la pantalla pudo volver a ponerlo mientras se cerraba en el servidor.
  void ponerInsignia(0);
}

let cierreEnCurso: Promise<void> | null = null;

/**
 * Cierra en el servidor la sesión que se cerró sin señal: al volver la señal y antes de iniciar otra. Se
 * espera antes de iniciar sesión: si la respuesta del cierre llegara después, borraría la cookie nueva.
 */
export function completarCierrePendiente(): Promise<void> {
  cierreEnCurso ??= (async () => {
    if (!(await db.ajustes.get("cierre_pendiente"))) return;
    try {
      await cliente.cerrarSesion();
    } catch (error) {
      // Sin señal todavía: se intenta de nuevo al volver. Otra respuesta del servidor es que ya no hay sesión.
      if (error instanceof ErrorDeRed) return;
    }
    await db.ajustes.delete("cierre_pendiente");
  })().finally(() => {
    cierreEnCurso = null;
  });
  return cierreEnCurso;
}
