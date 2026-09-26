import type { CodigoErrorValidacion } from "@teins/dominio";
import type { EstadoDeEnvio, EstadoServidor } from "./datos/modelo";

/** Textos en español de Colombia, con el vocabulario de TEINS (AGENTS.md). */
export const mensajeDeValidacion: Record<CodigoErrorValidacion, string> = {
  campo_obligatorio: "Falta este dato. Si no se pudo obtener, márcalo y escribe el motivo.",
  medida_invalida: "Escribe solo el número, por ejemplo 12,5",
  unidad_no_permitida: "Elige una de las unidades",
  fotos_insuficientes: "Faltan fotos",
  foto_invalida: "Hay una foto dañada. Tómala de nuevo.",
  motivo_requerido: "Escribe por qué no se pudo obtener",
  texto_muy_largo: "El texto es demasiado largo",
  tipo_invalido: "Este dato no tiene la forma esperada",
  campo_desconocido: "Este dato no pertenece al formato",
  seccion_desconocida: "Esta sección no pertenece al formato",
  no_obtenido_no_permitido: "Este dato no es obligatorio: bórralo en lugar de marcarlo",
  no_corregible: "Este dato no se corrige desde oficina",
  repeticiones_insuficientes: "Faltan repeticiones: agrega las que pide el formato",
  repeticiones_excedidas: "Hay más repeticiones de las que permite el formato: quita alguna",
  nombre_de_repeticion_invalido: "Cada una necesita un nombre",
  boceto_invalido: "El boceto está dañado. Vuelve a dibujarlo.",
  cantidades_invalidas: "Revisa las líneas: cada una necesita descripción, una cantidad mayor que cero y una unidad.",
};

export type Tono = "ok" | "pendiente" | "error";

/** Estado de sincronización en palabras: el color nunca es la única señal (DESIGN.md). */
export function estadoDeEnvio(envio: EstadoDeEnvio, enLinea: boolean): { texto: string; tono: Tono } {
  switch (envio.estado) {
    case "recibido":
      return { texto: "Recibido en oficina", tono: "ok" };
    case "enviando":
      return { texto: "Enviando…", tono: "pendiente" };
    case "requiere_sesion":
      return { texto: "Inicia sesión para enviar", tono: "pendiente" };
    case "requiere_actualizar":
      return { texto: "Actualiza la app para enviar", tono: "pendiente" };
    case "error":
      return { texto: `No se pudo enviar: ${envio.ultimoError?.mensaje ?? "error desconocido"}`, tono: "error" };
    case "pendiente":
      if (!enLinea || envio.ultimoError?.codigo === "sin_conexion") return { texto: "Sin conexión: se enviará al recuperar señal", tono: "pendiente" };
      if (envio.ultimoError?.codigo === "archivos_en_verificacion") return { texto: "El servidor está verificando las fotos", tono: "pendiente" };
      return { texto: "Pendiente de enviar", tono: "pendiente" };
  }
}

/** Estado de negocio según el servidor (bajada). */
export function estadoSegunServidor(estado: EstadoServidor): { texto: string; tono: Tono } {
  switch (estado.estado) {
    case "enviado":
      return { texto: "Recibido en oficina", tono: "ok" };
    case "en_revision":
      return { texto: "En revisión en oficina", tono: "pendiente" };
    case "revisado":
      return { texto: "Revisado por oficina", tono: "ok" };
  }
}

export const comentariosDeOficina = (n: number) => (n === 1 ? "1 comentario de oficina" : `${n} comentarios de oficina`);

export const claseDeTono: Record<Tono, string> = {
  ok: "text-sync-ok",
  pendiente: "text-sync-pendiente",
  error: "text-error",
};
