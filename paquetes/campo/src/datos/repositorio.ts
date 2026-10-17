import type { DocumentoBoceto, Levantamiento, ResultadoEnvio, Valor, VersionFormato } from "@teins/dominio";
import type { ArchivoLocal, LevantamientoLocal, LugarDeVisita } from "./modelo";

export type { ArchivoLocal, LevantamientoLocal } from "./modelo";

/** Lo que se quitó de una sección repetida, para devolverlo con "Deshacer". */
export interface RepeticionQuitada {
  repeticion: { id: string; nombre: string };
  posicion: number;
  respuestas: Record<string, Valor> | undefined;
}

/**
 * La visita ya tiene otro borrador: el envío rechazado no vuelve a borrador hasta que ese se envíe o se descarte. Una
 * visita no tiene dos borradores, y el segundo no se vería en ninguna lista (iteración 42).
 */
export class VisitaConOtroBorrador extends Error {
  constructor() {
    super("La visita ya tiene otro borrador");
    this.name = "VisitaConOtroBorrador";
  }
}

/** Archivo recién capturado: aún no se sube. */
export type ArchivoNuevo = Omit<ArchivoLocal, "subida" | "ultimoErrorDeSubida">;

/** Puerto de ADR-0004: la lógica de captura no conoce Dexie. */
export interface RepositorioLevantamientos {
  /** Con el cliente y el sitio de su visita, que lo nombran aunque la visita salga del teléfono (iteración 42). */
  crear(levantamiento: Levantamiento, tecnicoId: string, lugar?: LugarDeVisita): Promise<void>;
  obtener(id: string): Promise<LevantamientoLocal | undefined>;
  /** Levantamientos de un técnico, del más reciente al más antiguo, sin los descartados. */
  listar(tecnicoId: string): Promise<LevantamientoLocal[]>;
  /** La papelera del técnico (ADR-0035): lo descartado, del más reciente al más antiguo. */
  descartados(tecnicoId: string): Promise<LevantamientoLocal[]>;
  /** Descarta un borrador nunca enviado, o un envío en error que oficina no recibió (ADR-0046): sale de Mis visitas y queda en la papelera. */
  descartar(id: string, ahora: Date): Promise<void>;
  /**
   * Lo saca de la papelera. Si su visita ya tiene otro borrador, vuelve como levantamiento suelto: una visita no
   * tiene dos borradores.
   */
  recuperar(id: string): Promise<{ suelto: boolean }>;
  /** Borra lo que lleva más de 30 días en la papelera, con las fotos y dibujos que nada más usa. Devuelve cuántos. */
  vaciarPapelera(ahora: Date): Promise<number>;
  /**
   * Borra los archivos que ningún levantamiento usa: las fotos de un tablero quitado o las que reemplazó «No se pudo
   * obtener» (iteración 42). Corre al abrir la app, nunca mientras un «Deshacer» las puede devolver. Devuelve cuántos.
   */
  limpiarArchivosSinUso(): Promise<number>;
  /** Cuántos levantamientos del teléfono son de otras personas: se conservan, no se muestran. */
  contarDeOtros(tecnicoId: string): Promise<number>;
  /** Los levantamientos del corte 0 no tenían responsable: pasan a quien inicia sesión primero. */
  asignarSinResponsable(tecnicoId: string): Promise<void>;
  /** `undefined` borra la respuesta. */
  guardarRespuesta(id: string, seccion: string, campo: string, valor: Valor | undefined, ahora: Date): Promise<void>;
  /** Secciones repetibles (iteración 9): agrega al final, con el primer nombre libre ("Tablero 3"). */
  agregarRepeticion(id: string, formato: VersionFormato, seccion: string, ahora: Date): Promise<void>;
  renombrarRepeticion(id: string, seccion: string, repeticion: string, nombre: string, ahora: Date): Promise<void>;
  /**
   * Quita la repetición con sus respuestas y devuelve lo quitado, leído en la misma escritura: así "Deshacer" tiene
   * también lo último que se escribió (iteración 24c).
   */
  quitarRepeticion(id: string, seccion: string, repeticion: string, ahora: Date): Promise<RepeticionQuitada | undefined>;
  /** Deshace `quitarRepeticion` (iteración 24c): la devuelve a su lugar con sus respuestas. */
  restaurarRepeticion(id: string, seccion: string, repeticion: { id: string; nombre: string }, posicion: number, respuestas: Record<string, Valor> | undefined, ahora: Date): Promise<void>;
  /**
   * Bocetos (iteración 10): el documento se guarda como archivo por su huella y la respuesta apunta a él,
   * en una transacción. La versión anterior se borra si nada más la usa. No sube hasta enviar (ADR-0019).
   */
  guardarBoceto(id: string, seccion: string, campo: string, documento: DocumentoBoceto, ahora: Date): Promise<void>;
  /**
   * Firma del cliente (iteración 16, ADR-0024): los trazos se guardan como un boceto y la respuesta lleva quién
   * firmó, la hora del teléfono y la constancia que leyó. Volver a firmar la reemplaza; sube al enviar.
   */
  guardarFirma(id: string, seccion: string, campo: string, documento: DocumentoBoceto, datos: { nombre: string; cargo?: string | undefined; declaracion: string }, ahora: Date): Promise<void>;
  obtenerBoceto(huella: string): Promise<DocumentoBoceto | null>;
  /** Guarda el archivo y su referencia en la misma transacción: nunca queda una foto sin referencia. */
  agregarFoto(id: string, seccion: string, campo: string, archivo: ArchivoNuevo, ahora: Date): Promise<void>;
  /**
   * Quita la foto del campo (iteración 14). En la misma transacción borra el archivo si nada más lo usa: se
   * direccionan por contenido, así que otro campo u otro levantamiento pueden compartirlo. Si ya se estaba
   * subiendo, la subida termina sin efecto (no queda nada que marcar) y el envío no lo menciona.
   */
  quitarFoto(id: string, seccion: string, campo: string, huella: string, ahora: Date): Promise<void>;
  obtenerArchivos(ids: readonly string[]): Promise<ArchivoLocal[]>;
  todosLosArchivos(): Promise<ArchivoLocal[]>;
  /**
   * Borrador → Enviado y comando al outbox, en una transacción: si la app se cierra en medio,
   * o queda todo o no queda nada (ADR-0018, nivel 3: cierre entre guardar y encolar). Antes de validar quita lo que el
   * servidor rechazaría sin remedio (respuestas de tableros quitados, caracteres nulos) y mide bocetos y firmas.
   */
  enviar(id: string, formato: VersionFormato, ahora: Date): Promise<ResultadoEnvio>;
  /** Un envío con error permanente vuelve a la cola cuando el técnico lo pide. */
  reintentarEnvio(id: string): Promise<void>;
  /**
   * Un envío que oficina rechazó para siempre vuelve a borrador para corregirlo y enviarlo otra vez (ADR-0045): oficina
   * nunca lo recibió, así que no hay otro editor. Sale de la cola en la misma transacción.
   */
  volverABorrador(id: string): Promise<void>;
}
