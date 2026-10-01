import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorApi, ErrorDeRed } from "@teins/protocolo";
import { conTransicion } from "@teins/ui";
import { cliente } from "./api";
import { textoDelServidor } from "./mensajes";

export const consultasDeAdministracion = {
  usuarios: () => queryOptions({ queryKey: ["administracion", "usuarios"], queryFn: () => cliente.llamar("listarUsuarios") }),
  dispositivos: () => queryOptions({ queryKey: ["administracion", "dispositivos"], queryFn: () => cliente.llamar("listarDispositivos") }),
  accesos: () => queryOptions({ queryKey: ["administracion", "accesos"], queryFn: () => cliente.llamar("listarAccesosDeClientes") }),
};

/** Toda acción de administración vuelve a leer las listas (el servidor es la fuente de verdad), en una transición. */
export function useAccion<E, R>(accion: (entrada: E) => Promise<R>) {
  const consultas = useQueryClient();
  return useMutation({ mutationFn: accion, onSettled: () => conTransicion(() => consultas.invalidateQueries({ queryKey: ["administracion"] })) });
}

/** QR como imagen SVG (la biblioteca se carga solo cuando se necesita). */
export async function qrComoImagen(texto: string): Promise<string> {
  const { default: QRCode } = await import("qrcode");
  const svg = await QRCode.toString(texto, { type: "svg", margin: 2, errorCorrectionLevel: "M" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function mensajeDeAdministracion(error: unknown): string {
  if (error instanceof ErrorDeRed) return "Sin conexión con el servidor. No se hizo ningún cambio; intente de nuevo al recuperar la conexión.";
  if (!(error instanceof ErrorApi)) return "No se pudo completar la acción. Intente de nuevo.";
  switch (error.codigo) {
    case "segundo_factor_requerido":
      return "Active el segundo factor para administrar.";
    case "sin_permiso":
      return "Su usuario ya no tiene permiso de administración.";
    case "no_autenticado":
      return "Su sesión venció. Inicie sesión de nuevo.";
    case "entrada_invalida":
      // Lo que más se rechaza es el usuario: se dice cómo se escribe. Otro dato se nombra como en la pantalla.
      return error.problema.campos?.every((c) => !c.ruta.endsWith(".usuario"))
        ? textoDelServidor(error, "Revise los datos.")
        : "Revise los datos: el usuario lleva de 3 a 30 letras minúsculas, números, punto o guion, sin espacios.";
    default:
      return textoDelServidor(error, "No se pudo completar la acción. Intente de nuevo.");
  }
}
