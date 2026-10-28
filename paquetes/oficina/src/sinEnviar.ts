import { createContext, useContext, useRef, useState } from "react";
import type { Escrito, Pendiente } from "./revision";

/**
 * Lo escrito y no enviado en la revisión, por destino. Vive en el detalle y no en cada campo: cambiar de pestaña del
 * panel, ocultarlo, cerrar la hoja lateral o abrir el globo de otra fila no lo borra, y «Marcar revisado» dice qué se
 * pierde.
 */
export const SinEnviar = createContext<Map<string, Pendiente> | null>(null);

/**
 * Lo escrito sin enviar de cada levantamiento, fuera del detalle: Esc, el menú, Atrás o «Siguiente» lo desmontan, y al
 * volver sigue ahí (iteración 42). Los comentarios se copian en la pestaña (`sessionStorage`) y también vuelven al
 * recargar; de una corrección solo queda la marca de que hay una abierta, que se va con su editor.
 */
export class LoSinEnviar extends Map<string, Pendiente> {
  private readonly llave: string;
  constructor(levantamientoId: string) {
    super();
    this.llave = `revision-sin-enviar:${levantamientoId}`;
    try {
      for (const [clave, pendiente] of JSON.parse(sessionStorage.getItem(this.llave) ?? "[]") as [string, Pendiente][]) super.set(clave, pendiente);
    } catch {
      // Sin almacenamiento de la pestaña (navegación privada estricta), lo escrito vive mientras la app esté abierta.
    }
  }
  override set(clave: string, pendiente: Pendiente) {
    super.set(clave, pendiente);
    this.copiar();
    return this;
  }
  override delete(clave: string) {
    const habia = super.delete(clave);
    this.copiar();
    return habia;
  }
  override clear() {
    super.clear();
    this.copiar();
  }
  private copiar() {
    try {
      const comentarios = [...this].filter(([, p]) => p.que.tipo !== "correccion");
      if (comentarios.length === 0) sessionStorage.removeItem(this.llave);
      else sessionStorage.setItem(this.llave, JSON.stringify(comentarios));
    } catch {
      // Lleno o sin permiso: sigue en memoria.
    }
  }
}
const sinEnviarPorLevantamiento = new Map<string, LoSinEnviar>();
export const sinEnviarDe = (levantamientoId: string) => {
  let registro = sinEnviarPorLevantamiento.get(levantamientoId);
  if (!registro) sinEnviarPorLevantamiento.set(levantamientoId, (registro = new LoSinEnviar(levantamientoId)));
  return registro;
};
export const hayCorreccionAbierta = (pendientes: Iterable<Pendiente>) => [...pendientes].some((p) => p.que.tipo === "correccion");

/**
 * Un texto de la revisión que sigue ahí si su campo se desmonta y vuelve a montarse. El tercero vacía lo enviado al
 * llegar, solo si el campo sigue diciendo eso: lo que se escribió mientras se enviaba se queda (iteración 42).
 */
export function useSinEnviar<T>(que: Escrito, inicial: T): [T, (valor: T) => void, (enviado: T) => void] {
  const pendientes = useContext(SinEnviar);
  const clave = JSON.stringify(que);
  const [valor, setValor] = useState<T>(() => (pendientes?.has(clave) ? (pendientes.get(clave)!.valor as T) : inicial));
  const ultimo = useRef(valor);
  const poner = (nuevo: T) => {
    ultimo.current = nuevo;
    setValor(nuevo);
    pendientes?.set(clave, { que, valor: nuevo });
  };
  const vaciarSiSigue = (enviado: T) => {
    if ((pendientes ? pendientes.get(clave)?.valor : ultimo.current) === enviado) poner(inicial);
  };
  return [valor, poner, vaciarSiSigue];
}
