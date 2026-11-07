import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { ErrorApi } from "@teins/protocolo";
import { conTransicion } from "@teins/ui";
import { cliente } from "./api";
import { errorComun, textoDelServidor } from "./mensajes";

export type Vista = "proximas" | "anteriores" | "canceladas";

/** Hoy en la zona del navegador (AAAA-MM-DD): oficina y sus técnicos están en Colombia. */
export const hoyLocal = () => new Date().toLocaleDateString("en-CA");

export const consultasDeProgramacion = {
  /** Los activos (para programar y la lista) o los archivados (ADR-0035). */
  clientes: (vista: "activos" | "archivados" = "activos") =>
    queryOptions({ queryKey: ["programacion", "clientes", vista], queryFn: () => cliente.llamar("listarClientes", { consulta: { vista } }) }),
  cliente: (id: string) => queryOptions({ queryKey: ["programacion", "cliente", id], queryFn: () => cliente.llamar("obtenerCliente", { parametros: { id } }) }),
  // Un minuto, como el catálogo: un técnico que otra persona desactiva deja de ofrecerse pronto. Lo que se cambia aquí
  // en Administración la vuelve a leer al instante.
  tecnicos: () => queryOptions({ queryKey: ["programacion", "tecnicos"], queryFn: () => cliente.llamar("listarTecnicos"), staleTime: 60_000 }),
  /** Los servicios que se pueden programar (ADR-0057): los formatos de la organización. Cambian solo al publicar uno. */
  servicios: () => queryOptions({ queryKey: ["programacion", "servicios"], queryFn: () => cliente.llamar("serviciosParaProgramar"), staleTime: 5 * 60_000 }),
  /** Lo que ocupa a cada técnico ese día (ADR-0037): para programar solo con los libres. */
  ocupacion: (fecha: string) => queryOptions({ queryKey: ["programacion", "ocupacion", fecha], queryFn: () => cliente.llamar("ocupacionDeTecnicos", { consulta: { fecha } }), staleTime: 15_000 }),
  visitas: (vista: Vista, hoy: string) =>
    queryOptions({ queryKey: ["programacion", "visitas", vista, hoy], queryFn: () => cliente.llamar("listarVisitas", { consulta: { vista, hoy } }), refetchInterval: 60_000 }),
};

/**
 * Lo que cambia al reasignar (iteración 24c): quién la recibe y quién deja de verla. El servidor solo asigna técnicos
 * activos: uno desactivado sale al guardar, sin bloquear, y se dice aparte. Sin la lista de activos, no sale nadie.
 */
export function cambiosAlReasignar(antes: readonly { id: string }[], elegidos: readonly string[], activos: ReadonlySet<string> | undefined) {
  const inactivos = activos ? antes.map((t) => t.id).filter((id) => !activos.has(id)) : [];
  const finales = elegidos.filter((id) => !inactivos.includes(id));
  return {
    finales,
    inactivos,
    salen: antes.map((t) => t.id).filter((id) => !finales.includes(id) && !inactivos.includes(id)),
    entran: finales.filter((id) => !antes.some((t) => t.id === id)),
  };
}

/**
 * Toda acción vuelve a leer clientes y visitas: el servidor es la fuente de verdad. Dentro de una transición: la
 * fila nueva entra, la que se va sale y las demás se corren (iteración 27).
 */
export function useAccionDeProgramacion<E, R>(accion: (entrada: E) => Promise<R>) {
  const consultas = useQueryClient();
  return useMutation({ mutationFn: accion, onSettled: () => conTransicion(() => consultas.invalidateQueries({ queryKey: ["programacion"] })) });
}

/** Corregir un cliente o un sitio (ADR-0035): el servidor dice por qué no se pudo (visitas por hacer, el único sitio, archivado). */
export function mensajeDeCliente(error: unknown): string {
  if (error instanceof ErrorApi && error.codigo === "estado_invalido") return textoDelServidor(error, "El cliente cambió mientras tanto. Recargue la página y vuelva a intentar.");
  return mensajeDeProgramacion(error);
}

export function mensajeDeProgramacion(problema: unknown): string {
  const error = errorComun(problema, "No se guardó nada", "No se pudo guardar. Intente de nuevo.");
  if (typeof error === "string") return error;
  switch (error.codigo) {
    case "conflicto_de_version":
      return "Otra persona cambió esta visita mientras usted la tenía abierta. La lista ya muestra lo último: revise y vuelva a intentar.";
    case "estado_invalido":
      // Cancelada, o el cliente o el sitio se archivó con el diálogo abierto: el servidor dice cuál.
      return error.problema.detail ?? "La visita ya está cancelada.";
    // Alguien programó al mismo técnico a esa hora mientras el diálogo estaba abierto (ADR-0037).
    case "tecnico_ocupado":
      return `${error.message}: elija otra hora u otro técnico.`;
    case "entrada_invalida":
      return textoDelServidor(error, "Revise los datos.");
    default:
      return textoDelServidor(error, "No se pudo guardar. Intente de nuevo.");
  }
}

/**
 * Lo que saldría como marcador en el encabezado del informe (ADR-0051): NIT del cliente, ciudad del sitio y celular del
 * solicitante. Son opcionales; se avisa al programar para que oficina los complete antes de que llegue al cliente.
 */
export function faltaEnElEncabezado(d: { nit: string | null; ciudad: string | null; solicitante: { celular: string | null } | null }): string[] {
  return [...(d.nit ? [] : ["el NIT"]), ...(d.ciudad ? [] : ["la ciudad del sitio"]), ...(d.solicitante && !d.solicitante.celular ? ["el celular del solicitante"] : [])];
}
