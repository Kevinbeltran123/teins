import { errorComun } from "./mensajes";

/**
 * Lo que responde el servidor al cambiar la contraseña o quitar el segundo factor (ADR-0033), en un mensaje junto al
 * campo que hay que corregir o, si no es de un campo, en uno general.
 */
export function errorDeCuenta(problema: unknown): { campo?: { ruta: string; mensaje: string }; general?: string } {
  const error = errorComun(problema, "No se cambió nada", "No se pudo completar el cambio. Intente de nuevo.");
  if (typeof error === "string") return { general: error };
  const ruta = error.problema.campos?.[0]?.ruta.split(".").at(-1);
  switch (error.codigo) {
    case "credencial_incorrecta":
      if (ruta === "codigo") return { campo: { ruta, mensaje: "El código no es correcto o ya venció. Revise que la hora del celular esté al día." } };
      if (ruta === "contrasena") return { campo: { ruta, mensaje: "La contraseña no es correcta." } };
      return { campo: { ruta: "actual", mensaje: "La contraseña actual no es correcta." } };
    case "entrada_invalida":
      if (ruta === "nueva") return { campo: { ruta, mensaje: "Debe ser distinta de la actual y tener de 10 a 128 caracteres." } };
      return { general: "Revise los datos e intente de nuevo." };
    case "demasiadas_solicitudes":
      return { general: "Demasiados intentos. Espere un minuto e intente de nuevo." };
    default:
      return { general: "No se pudo completar el cambio. Intente de nuevo." };
  }
}
