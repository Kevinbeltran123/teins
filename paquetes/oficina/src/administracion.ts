import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { conTransicion } from "@teins/ui";
import { cliente } from "./api";
import { errorComun, textoDelServidor } from "./mensajes";

export const consultasDeAdministracion = {
  usuarios: () => queryOptions({ queryKey: ["administracion", "usuarios"], queryFn: () => cliente.llamar("listarUsuarios") }),
  dispositivos: () => queryOptions({ queryKey: ["administracion", "dispositivos"], queryFn: () => cliente.llamar("listarDispositivos") }),
  accesos: () => queryOptions({ queryKey: ["administracion", "accesos"], queryFn: () => cliente.llamar("listarAccesosDeClientes") }),
};

/**
 * Toda acción de administración vuelve a leer las listas (el servidor es la fuente de verdad), en una transición. También
 * los técnicos que se ofrecen al programar: uno recién creado, desactivado o reactivado cambia esa lista.
 */
export function useAccion<E, R>(accion: (entrada: E) => Promise<R>) {
  const consultas = useQueryClient();
  // La relectura no se espera: si falla, no convierte en error una acción que el servidor ya hizo.
  return useMutation({
    mutationFn: accion,
    onSettled: () => {
      void consultas.invalidateQueries({ queryKey: ["programacion", "tecnicos"] });
      void conTransicion(() => consultas.invalidateQueries({ queryKey: ["administracion"] })).catch(() => undefined);
    },
  });
}

/** QR como imagen SVG (la biblioteca se carga solo cuando se necesita). */
export async function qrComoImagen(texto: string): Promise<string> {
  const { default: QRCode } = await import("qrcode");
  const svg = await QRCode.toString(texto, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * La credencial que el servidor ya entregó, con su QR si se pudo dibujar. Nunca falla: si el QR no carga (por ejemplo,
 * una pestaña con la versión anterior), la clave se muestra igual, porque la anterior ya dejó de servir.
 */
export async function credencialConQr<T extends { url: string }>(respuesta: T, dibujar: (texto: string) => Promise<string> = qrComoImagen): Promise<T & { qr: string | null }> {
  try {
    return { ...respuesta, qr: await dibujar(respuesta.url) };
  } catch {
    return { ...respuesta, qr: null };
  }
}

export function mensajeDeAdministracion(problema: unknown): string {
  const error = errorComun(problema, "No se hizo ningún cambio", "No se pudo completar la acción. Intente de nuevo.");
  if (typeof error === "string") return error;
  switch (error.codigo) {
    case "segundo_factor_requerido":
      return "Active el segundo factor para administrar.";
    case "sin_permiso":
      return "Su usuario ya no tiene permiso de administración.";
    case "entrada_invalida":
      // Lo que más se rechaza es el usuario: se dice cómo se escribe. Otro dato se nombra como en la pantalla.
      return error.problema.campos?.every((c) => !c.ruta.endsWith(".usuario"))
        ? textoDelServidor(error, "Revise los datos.")
        : "Revise los datos: el usuario lleva de 3 a 30 letras minúsculas, números, punto o guion, sin espacios.";
    default:
      return textoDelServidor(error, "No se pudo completar la acción. Intente de nuevo.");
  }
}
