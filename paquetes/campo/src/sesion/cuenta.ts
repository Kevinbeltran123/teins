import { ErrorApi, ErrorDeRed } from "@teins/protocolo";

/** Lo que responde el servidor al cambiar la contraseña (ADR-0033), junto al campo que hay que corregir o en general. */
export function errorDeCuenta(error: unknown): { campo?: "actual" | "nueva"; mensaje: string } {
  if (error instanceof ErrorDeRed) return { mensaje: "Necesitas señal para cambiar la contraseña. No se cambió nada." };
  if (!(error instanceof ErrorApi)) return { mensaje: "No se pudo cambiar la contraseña. Intenta de nuevo." };
  switch (error.codigo) {
    case "credencial_incorrecta":
      return { campo: "actual", mensaje: "La contraseña actual no es correcta." };
    case "entrada_invalida":
      return { campo: "nueva", mensaje: "Debe ser distinta de la actual y tener de 10 a 128 caracteres." };
    case "demasiadas_solicitudes":
      return { mensaje: "Demasiados intentos. Espera un minuto e intenta de nuevo." };
    case "no_autenticado":
      return { mensaje: "Tu sesión venció. Inicia sesión de nuevo." };
    default:
      return { mensaje: "No se pudo cambiar la contraseña. Intenta de nuevo." };
  }
}
