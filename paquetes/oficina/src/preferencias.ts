import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

/*
  Lo que oficina recuerda de cada persona en este equipo (prototipos/usabilidad-oficina, «Dónde quedó»): la pestaña de
  cada lista, el menú plegado, la vista previa. Las búsquedas duran lo que dura la pestaña del navegador, para que al
  día siguiente no escondan filas sin que se note. Nada de esto va al servidor.
*/

export const llaveDePreferencia = (persona: string, nombre: string) => `teins-oficina:${persona}:${nombre}`;

function interpretar<T>(crudo: string | null, inicial: T, valida: (v: unknown) => v is T): T {
  if (crudo === null) return inicial;
  try {
    const v: unknown = JSON.parse(crudo);
    return valida(v) ? v : inicial;
  } catch {
    return inicial;
  }
}

function leerCrudo(almacen: Storage | null, llave: string): string | null {
  try {
    return almacen?.getItem(llave) ?? null;
  } catch {
    return null;
  }
}

/** Lo guardado, si sigue siendo válido; si no (otra versión de oficina, almacenamiento bloqueado), el inicial. */
export const leerPreferencia = <T>(almacen: Storage | null, llave: string, inicial: T, valida: (v: unknown) => v is T): T => interpretar(leerCrudo(almacen, llave), inicial, valida);

/** Sin almacenamiento (navegación privada, cuota llena) no falla: vale mientras la página siga abierta. */
export function escribirPreferencia(almacen: Storage | null, llave: string, valor: unknown): boolean {
  try {
    if (!almacen) return false;
    almacen.setItem(llave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

/** Quién usa oficina en este equipo: lo que se recuerda es de cada persona. */
export const PersonaDeOficina = createContext("");

type Duracion = "equipo" | "pestana";
function almacenDe(duracion: Duracion): Storage | null {
  try {
    return duracion === "equipo" ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

// Lo que no se pudo guardar en el navegador queda aquí mientras la página siga abierta.
const enMemoria = new Map<string, string>();
const oyentes = new Set<() => void>();
const suscribir = (avisar: () => void) => {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
};

export const esBooleano = (v: unknown): v is boolean => typeof v === "boolean";
export const esTexto = (v: unknown): v is string => typeof v === "string";
export const unoDe =
  <T extends string>(...opciones: readonly T[]) =>
  (v: unknown): v is T =>
    typeof v === "string" && (opciones as readonly string[]).includes(v);

/** Una preferencia de la persona: se lee al pintar y todas las pantallas que la usan cambian juntas. */
export function usePreferencia<T>(nombre: string, inicial: T, valida: (v: unknown) => v is T, duracion: Duracion = "equipo"): [T, (valor: T) => void] {
  const persona = useContext(PersonaDeOficina);
  const llave = `${duracion}:${llaveDePreferencia(persona, nombre)}`;
  const almacen = almacenDe(duracion);
  const guardada = llaveDePreferencia(persona, nombre);
  const crudo = useSyncExternalStore(suscribir, () => enMemoria.get(llave) ?? leerCrudo(almacen, guardada));
  const poner = useCallback(
    (valor: T) => {
      if (escribirPreferencia(almacen, guardada, valor)) enMemoria.delete(llave);
      else enMemoria.set(llave, JSON.stringify(valor));
      oyentes.forEach((avisar) => avisar());
    },
    [almacen, guardada, llave],
  );
  return [interpretar(crudo, inicial, valida), poner];
}

/** Una búsqueda que sigue ahí al volver de un detalle, pero no al día siguiente. */
export const useBusquedaRecordada = (lista: string) => usePreferencia(`buscar-${lista}`, "", esTexto, "pestana");
