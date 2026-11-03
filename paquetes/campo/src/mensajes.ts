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
  firma_invalida: "La firma quedó incompleta. Pide que vuelvan a firmar y revisa la cédula.",
  opcion_invalida: "Elige una de las opciones de la lista",
  horario_invalido: "Revisa las horas: deben estar entre 00:00 y 23:59",
  archivo_muy_grande: "El dibujo pesa demasiado para enviarlo. Borra los trazos que sobren y vuelve a intentarlo.",
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
      return { texto: `No se pudo enviar: ${porQueNoEntro(envio.ultimoError?.codigo).toLowerCase()} Avísale a oficina.`, tono: "error" };
    case "pendiente":
      if (!enLinea || envio.ultimoError?.codigo === "sin_conexion") return { texto: "Sin conexión: se enviará al recuperar señal", tono: "pendiente" };
      if (envio.ultimoError?.codigo === "archivos_en_verificacion") return { texto: "El servidor está verificando las fotos", tono: "pendiente" };
      return { texto: "Pendiente de enviar", tono: "pendiente" };
  }
}

/**
 * Un rechazo que reintentar solo no arregla (ADR-0003), sin la jerga del servidor. El técnico no lo puede
 * resolver: oficina lo ve en "Teléfonos de campo" (ADR-0017) y, cuando lo resuelve, el técnico reintenta.
 */
export function porQueNoEntro(codigo: string | undefined): string {
  switch (codigo) {
    case "formato_desconocido":
      return "Oficina retiró o cambió el formato de este levantamiento.";
    case "conflicto":
      return "Este levantamiento ya lo envió otra persona.";
    case "sin_permiso":
      return "Tu usuario ya no puede enviar este levantamiento.";
    case "respuestas_invalidas":
    case "entrada_invalida":
      return "Oficina no pudo aceptar algunos datos.";
    case "archivos_faltantes":
      return "Una foto o un dibujo no se pudo subir.";
    default:
      return "Oficina no pudo recibirlo.";
  }
}

/** Qué hacer con un rechazo: nada se perdió, oficina ya lo ve y se reintenta cuando lo resuelva, o se corrige (ADR-0045). */
export const QUE_HACER_CON_EL_RECHAZO =
  "Lo capturado sigue guardado en este teléfono. Avísale a oficina: ya ven el error en «Teléfonos de campo». Cuando te digan que está resuelto, toca «Reintentar envío»; si hay algo que corregir, vuelve a borrador.";

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

/**
 * El estado en dos o tres palabras, para la lista del inicio (iteración 32): la explicación larga queda en el detalle.
 * El servidor manda sobre lo que sabe el teléfono.
 */
export function estadoCorto(envio: EstadoDeEnvio | undefined, servidor: EstadoServidor | undefined, enLinea: boolean): { texto: string; tono: Tono | "revision" } | null {
  if (servidor) {
    if (servidor.estado === "en_revision") return { texto: "En revisión", tono: "revision" };
    return { texto: servidor.estado === "revisado" ? "Revisado" : "Recibido", tono: "ok" };
  }
  if (!envio) return null;
  switch (envio.estado) {
    case "recibido":
      return { texto: "Recibido", tono: "ok" };
    case "enviando":
      return { texto: "Enviando…", tono: "pendiente" };
    case "requiere_sesion":
      return { texto: "Inicia sesión para enviar", tono: "pendiente" };
    case "requiere_actualizar":
      return { texto: "Actualiza la app", tono: "pendiente" };
    case "error":
      return { texto: "No se pudo enviar", tono: "error" };
    case "pendiente":
      if (!enLinea || envio.ultimoError?.codigo === "sin_conexion") return { texto: "Se envía al tener señal", tono: "pendiente" };
      if (envio.ultimoError?.codigo === "archivos_en_verificacion") return { texto: "Verificando fotos", tono: "pendiente" };
      return { texto: "Por enviar", tono: "pendiente" };
  }
}

export const claseDeTono: Record<Tono, string> = {
  ok: "text-sync-ok",
  pendiente: "text-sync-pendiente",
  error: "text-error",
};
