import { createHash } from "node:crypto";
import { EnviarLevantamiento, ErrorApi, ErrorDeRed, tipoDeProblema, type Cambio, type CodigoProblema, type Problema, type SaludDispositivo } from "@teins/protocolo";
import { archivosReferenciados } from "@teins/dominio";
import { ErrorDeSubida, type Transporte } from "../transporte";

/** Falla que se aplica a la próxima llamada de una operación. */
export type Falla =
  /** La llamada responde normal: sirve para programar una falla en una llamada posterior. */
  | "ninguna"
  /** La solicitud no llega: el servidor no se entera. */
  | "red_antes"
  /** El servidor procesa y confirma, pero la respuesta se pierde (ADR-0018, nivel 3). */
  | "red_despues"
  | "error_500"
  | "sesion_vencida"
  /** El servidor ya no acepta esta versión del protocolo (ADR-0015). */
  | "version_no_soportada"
  /** La sesión existe pero debe cambiar la contraseña temporal: 403 a todo lo demás. */
  | "cambio_de_contrasena";

type Operacion = keyof Transporte;

const error = (codigo: CodigoProblema, estado: number, extra: Partial<Problema> = {}) =>
  new ErrorApi({ type: tipoDeProblema(codigo), title: codigo, status: estado, codigo, ...extra });

/**
 * Servidor falso con la semántica del real: idempotente por llave, exige archivos verificados
 * y valida cada comando con el esquema de `protocolo`. Las fallas se programan por operación.
 */
export function servidorFalso(opciones: { verificacionesPendientes?: number } = {}) {
  const almacenamiento = new Map<string, Buffer>();
  const tipos = new Map<string, string>();
  const archivos = new Map<string, "pendiente" | "subido" | "verificado">();
  const recibidos = new Map<string, { resultado: { resultado: "aceptado"; levantamientoId: string; recibidoEn: string }; veces: number }>();
  const fallas = new Map<Operacion, Falla[]>();
  const llamadas: Operacion[] = [];
  let verificacionesPendientes = opciones.verificacionesPendientes ?? 0;
  let reloj = 0;
  /** Registro de cambios del servidor: la posición + 1 es la secuencia. */
  const cambios: (Cambio | null)[] = [];
  /** Época de la bajada (ADR-0038): la cambia `limpiar`. */
  let epoca = "inicial";
  const informes: { id: string; secreto: string; salud: SaludDispositivo }[] = [];
  /** Revocado: toda operación con sesión responde "no autenticado"; la consulta con secreto devuelve la orden. */
  const revocados = new Set<string>();
  const confirmados: string[] = [];
  let permisoLocalHasta = "2026-10-01T00:00:00.000Z";
  let tamanoDePagina = 100;
  /** Visitas terminadas desde el teléfono, con cuántas llamadas llegaron con cada llave (ADR-0037). */
  const terminadas = new Map<string, { en: string; llamadas: Map<string, number> }>();
  /** Visitas canceladas: terminarlas responde "estado inválido". */
  const canceladas = new Set<string>();
  /** Respuestas a oficina por llave, con cuántas llamadas llegaron (ADR-0040). */
  const respuestas = new Map<string, { id: string; texto: string; veces: number }>();
  /** Levantamientos revisados: su conversación está cerrada. */
  const revisados = new Set<string>();
  /** Archivos que el almacenamiento rechaza siempre. */
  const rechazadas = new Set<string>();

  function aplicarFalla<T>(op: Operacion, ejecutar: () => T): T {
    llamadas.push(op);
    const falla = fallas.get(op)?.shift();
    if (falla === "red_antes") throw new ErrorDeRed(new TypeError("Failed to fetch"));
    if (revocados.size > 0 && op !== "subir" && op !== "consultarOrdenes") throw error("no_autenticado", 401);
    if (falla === "error_500") throw error("error_interno", 500);
    if (falla === "sesion_vencida") throw error("no_autenticado", 401);
    if (falla === "version_no_soportada") throw error("version_protocolo_no_soportada", 426);
    if (falla === "cambio_de_contrasena") throw error("cambio_de_contrasena_requerido", 403);
    const resultado = ejecutar();
    if (falla === "red_despues") throw new ErrorDeRed(new TypeError("Network connection was lost"));
    return resultado;
  }

  const transporte: Transporte = {
    async autorizarSubida({ huella, tipo }) {
      return aplicarFalla("autorizarSubida", () => {
        tipos.set(huella, tipo);
        const estado = archivos.get(huella);
        if (estado === "subido" || estado === "verificado") return { estado: "existente" as const, archivo: estado };
        archivos.set(huella, "pendiente");
        return { estado: "autorizada" as const, url: `https://almacen.prueba/${huella}`, metodo: "PUT" as const, cabeceras: {}, expiraEn: new Date().toISOString() };
      });
    },
    async subir(url, _cabeceras, datos) {
      return aplicarFalla("subir", () => {
        const huella = url.split("/").at(-1)!;
        // Un archivo que el almacenamiento rechaza siempre (por ejemplo, demasiado grande).
        if (rechazadas.has(huella)) throw new ErrorDeSubida(413);
        const contenido = Buffer.from(datos);
        // Como el almacenamiento real: rechaza un contenido que no corresponde a la huella firmada.
        if (createHash("sha256").update(contenido).digest("hex") !== huella) throw new ErrorDeSubida(400);
        almacenamiento.set(huella, contenido);
      });
    },
    async confirmarSubida(huella) {
      return aplicarFalla("confirmarSubida", () => {
        if (!almacenamiento.has(huella)) throw error("archivos_faltantes", 409, { faltantes: [huella] });
        if (archivos.get(huella) === "pendiente") archivos.set(huella, "subido");
        return { archivo: archivos.get(huella) === "verificado" ? ("verificado" as const) : ("subido" as const) };
      });
    },
    async enviarComando(comando) {
      return aplicarFalla("enviarComando", () => {
        const valido = EnviarLevantamiento.parse(comando);
        const previo = recibidos.get(valido.llave);
        if (previo) {
          previo.veces++;
          return previo.resultado;
        }
        // Como el servidor real: fotos y bocetos deben haber llegado (QA-2).
        const huellas = archivosReferenciados(valido.levantamiento.respuestas);
        const faltantes = huellas.filter((h) => !archivos.has(h) || archivos.get(h) === "pendiente");
        if (faltantes.length > 0) throw error("archivos_faltantes", 409, { faltantes });
        if (huellas.some((h) => archivos.get(h) === "subido")) {
          if (verificacionesPendientes > 0) {
            verificacionesPendientes--;
            throw error("archivos_en_verificacion", 409, { pendientes: huellas, reintentarEnSegundos: 5 });
          }
          for (const h of huellas) archivos.set(h, "verificado");
        }
        const resultado = { resultado: "aceptado" as const, levantamientoId: valido.levantamiento.id, recibidoEn: new Date(Date.UTC(2026, 8, 24, 0, 0, reloj++)).toISOString() };
        recibidos.set(valido.llave, { resultado, veces: 1 });
        cambios.push({ tipo: "levantamiento", id: valido.levantamiento.id, estado: "enviado", recibidoEn: resultado.recibidoEn });
        return resultado;
      });
    },
    async obtenerCambios(desde) {
      return aplicarFalla("obtenerCambios", () => {
        const pagina = cambios.slice(desde, desde + tamanoDePagina);
        return { cambios: pagina.filter((c) => c !== null), puntoDeControl: desde + pagina.length, hayMas: desde + pagina.length < cambios.length, permisoLocalHasta, epoca };
      });
    },
    async informarDispositivo(cuerpo) {
      return aplicarFalla("informarDispositivo", () => {
        informes.push(cuerpo);
        return {};
      });
    },
    async consultarOrdenes({ id, secreto, confirmados: nuevos = [] }) {
      return aplicarFalla("consultarOrdenes", () => {
        if (!informes.some((i) => i.id === id && i.secreto === secreto)) throw error("no_autenticado", 401);
        confirmados.push(...nuevos.filter((u) => revocados.has(u) && !confirmados.includes(u)));
        return { borrar: [...revocados].filter((u) => !confirmados.includes(u)) };
      });
    },
    async terminarVisita(visitaId, { llave, en }) {
      return aplicarFalla("terminarVisita", () => {
        if (canceladas.has(visitaId)) throw error("estado_invalido", 409);
        // Como el real: repetirla devuelve la primera, con cualquier llave.
        const previa = terminadas.get(visitaId) ?? { en, llamadas: new Map<string, number>() };
        previa.llamadas.set(llave, (previa.llamadas.get(llave) ?? 0) + 1);
        terminadas.set(visitaId, previa);
        return { terminada: { en: previa.en } };
      });
    },
    async responderComentario(levantamientoId, _comentarioId, { llave, texto }) {
      return aplicarFalla("responderComentario", () => {
        // Como el real: un reintento con la misma llave devuelve el mismo mensaje, aunque ya esté revisado.
        const previa = respuestas.get(llave);
        if (!previa && revisados.has(levantamientoId)) throw error("estado_invalido", 409);
        const mensaje = previa ?? { id: crypto.randomUUID(), texto, veces: 0 };
        mensaje.veces++;
        respuestas.set(llave, mensaje);
        return { id: mensaje.id, texto, de: "tecnico" as const, autor: "Técnico", creadoEn: new Date(reloj).toISOString(), llave, leido: false };
      });
    },
  };

  return {
    transporte,
    programar(op: Operacion, ...lista: Falla[]) {
      fallas.set(op, [...(fallas.get(op) ?? []), ...lista]);
    },
    /** Olvida un archivo, como si el almacenamiento lo hubiera perdido. */
    perderArchivo(huella: string) {
      almacenamiento.delete(huella);
      archivos.delete(huella);
    },
    recibidos,
    terminadas,
    respuestas,
    marcarRevisado(levantamientoId: string) {
      revisados.add(levantamientoId);
    },
    rechazarSiempre(huella: string) {
      rechazadas.add(huella);
    },
    cancelar(visitaId: string) {
      canceladas.add(visitaId);
    },
    almacenamiento,
    /** Con qué tipo pidió subir cada archivo el teléfono. */
    tipos,
    llamadas,
    cambios,
    informes,
    confirmados,
    publicar(...nuevos: Cambio[]) {
      cambios.push(...nuevos);
    },
    revocar(usuarioId: string) {
      revocados.add(usuarioId);
    },
    renovarPermiso(hasta: string) {
      permisoLocalHasta = hasta;
    },
    paginasDe(n: number) {
      tamanoDePagina = n;
    },
    /**
     * Como dejar-limpio.sql (ADR-0038): borra del registro las visitas, los levantamientos y el catálogo (la secuencia
     * sigue, quedan huecos), conserva formatos y símbolos y cambia la época.
     */
    limpiar() {
      for (const [i, c] of cambios.entries()) if (c && c.tipo !== "formato" && c.tipo !== "simbolo") cambios[i] = null;
      recibidos.clear();
      epoca = `limpieza-${cambios.length}`;
    },
  };
}
