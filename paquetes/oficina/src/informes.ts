import type { TextoPropio } from "@teins/documentos";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorApi, type CuerpoEntrada, type Respuesta } from "@teins/protocolo";
import { cliente } from "./api";
import { textoDelServidor } from "./mensajes";

type VersionPublicada = Respuesta<"obtenerInforme">["versiones"][number];

/** El avance de una versión recién publicada, en una línea (iteración 27). Una retirada ya no está en el portal (ADR-0034). */
export function resumenDelAvance(v: Pick<VersionPublicada, "pdf" | "retirada" | "envios">): string {
  if (v.retirada) return "Retirada del portal";
  if (v.pdf === "fallido") return "No se generó el PDF";
  if (v.pdf !== "listo") return "Generando el PDF";
  if (v.envios.some((e) => e.estado === "en_cola")) return "Enviando";
  return v.envios.length > 0 ? "En el portal y enviada" : "En el portal";
}

function useRefrescar() {
  const consultas = useQueryClient();
  return () => consultas.invalidateQueries({ queryKey: ["informes"] });
}

/** Uno por visita: abrirlo dos veces devuelve el mismo. */
export function useAbrirInformeDeVisita() {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (visitaId: string) => cliente.llamar("abrirInformeDeVisita", { cuerpo: { visitaId } }),
    onSuccess: () => refrescar(),
  });
}

export function useGuardarInforme(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: (cuerpo: CuerpoEntrada<"guardarInforme">) => cliente.llamar("guardarInforme", { parametros: { id }, cuerpo }),
    onSettled: () => refrescar(),
  });
}

export function usePublicarInforme(id: string) {
  const refrescar = useRefrescar();
  return useMutation({
    mutationFn: ({ version, destinatarios, mensaje }: { version: number; destinatarios: string[]; mensaje?: TextoPropio | undefined }) =>
      cliente.llamar("publicarInforme", { parametros: { id }, cuerpo: { version, destinatarios, ...(mensaje && { mensaje }) } }),
    onSettled: () => refrescar(),
  });
}

export class PlanoRechazado extends Error {
  constructor(readonly nombre: string) {
    super(`No se pudo subir ${nombre}`);
    this.name = "PlanoRechazado";
  }
}

/**
 * Sube un plano en PDF directo al almacenamiento (ADR-0007), igual que las fotos de campo: huella
 * SHA-256 calculada aquí, URL firmada del servidor y verificación en el worker.
 */
export async function subirPlano(archivo: File): Promise<{ huella: string; nombre: string }> {
  const datos = await archivo.arrayBuffer();
  const huella = [...new Uint8Array(await crypto.subtle.digest("SHA-256", datos))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const autorizacion = await cliente.llamar("autorizarSubida", { cuerpo: { huella, bytes: datos.byteLength, tipo: "application/pdf" } });
  if (autorizacion.estado === "autorizada") {
    const respuesta = await fetch(autorizacion.url, { method: "PUT", headers: autorizacion.cabeceras, body: datos });
    if (!respuesta.ok) throw new PlanoRechazado(archivo.name);
    await cliente.llamar("confirmarSubida", { parametros: { huella } });
  }
  return { huella, nombre: archivo.name.replace(/\.pdf$/i, "") };
}

/** Qué decirle a oficina sobre un error del informe. */
export function mensajeDeInforme(error: unknown, nombreDe: (id: string) => string): string[] {
  if (!(error instanceof ErrorApi)) return [error instanceof PlanoRechazado ? `${error.message}. Verifique que sea un PDF.` : "No se pudo completar la acción. Intente de nuevo."];
  switch (error.codigo) {
    case "informe_invalido":
      return (error.problema.erroresInforme ?? []).map((e) => {
        const quien = e.levantamientoId ? nombreDe(e.levantamientoId) : "";
        switch (e.codigo) {
          case "no_revisado":
            return `${quien}: todavía no está revisado.`;
          case "otra_visita":
            return `${quien}: es de otra visita.`;
          case "sin_levantamientos":
            return "Incluya al menos un levantamiento revisado antes de publicar.";
          case "plano_invalido":
            return "Hay un plano sin nombre o inválido.";
          case "plano_repetido":
            return "El mismo plano está dos veces.";
          default:
            return "El informe no cumple sus reglas.";
        }
      });
    case "archivos_en_verificacion":
      return ["El servidor está verificando los planos. Intente publicar en unos segundos."];
    case "archivos_faltantes":
      return ["Hay planos que no terminaron de subir. Quítelos y vuelva a agregarlos."];
    case "tipo_de_archivo_no_permitido":
      return ["Los planos se adjuntan en PDF."];
    case "archivo_demasiado_grande":
      return ["El plano supera el tamaño permitido (10 MB)."];
    case "conflicto_de_version":
      return ["Otra persona guardó o publicó este informe mientras usted lo tenía abierto. Lo suyo no se guardó: recargue para ver la versión actual."];
    default:
      return [textoDelServidor(error, "No se pudo completar la acción.")];
  }
}
