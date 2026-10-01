import { ErrorApi, ErrorDeRed } from "@teins/protocolo";

/**
 * Lo que responde el servidor al cambiar la contraseña o quitar el segundo factor (ADR-0033), en un mensaje junto al
 * campo que hay que corregir o, si no es de un campo, en uno general.
 */
export function errorDeCuenta(error: unknown): { campo?: { ruta: string; mensaje: string }; general?: string } {
  if (error instanceof ErrorDeRed) return { general: "Sin conexión con el servidor. No se cambió nada; intente de nuevo al recuperar la conexión." };
  if (!(error instanceof ErrorApi)) return { general: "No se pudo completar el cambio. Intente de nuevo." };
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
    case "no_autenticado":
      return { general: "Su sesión venció. Inicie sesión de nuevo." };
    default:
      return { general: "No se pudo completar el cambio. Intente de nuevo." };
  }
}
