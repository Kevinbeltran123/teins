import { useCallback, useRef, useState, type RefCallback } from "react";
import { flushSync } from "react-dom";

/**
 * Movimiento de la iteración 27 (DESIGN.md, movimiento): cuatro reglas. Lo que cambia se queda en su sitio y se
 * transforma; lo que entra o sale se ve entrar o salir; solo lo nuevo se anima; cada acción dice qué pasó y qué sigue.
 */

/**
 * Lo que se ve en la ventana se mueve: adelante y atrás lo deslizan (pasos de campo, el siguiente levantamiento);
 * sección lo desvanece; fundido lo cruza. Sin dirección, solo se mueve lo que tiene nombre.
 */
export type Direccion = "adelante" | "atras" | "seccion" | "fundido";

export const sinMovimiento = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Lo que React dejó pendiente ya está en el DOM: las notificaciones de las consultas llegan en un setTimeout(0). */
const pintado = () => new Promise<void>((listo) => setTimeout(() => setTimeout(listo, 0), 0));
/**
 * Lo más que la pantalla se queda en la foto de antes. Si lo nuevo tarda más (la red, o un enrutador que no confirma
 * que pintó), la transición sigue con lo que haya y el cambio termina por su cuenta: la pantalla nunca se congela.
 */
const ESPERA_MAXIMA_MS = 1500;

/**
 * Un cambio de estado como View Transition: el navegador toma una foto antes y otra después y anima lo que tiene
 * nombre (`view-transition-name`). El cambio puede ser asíncrono (esperar a que una consulta traiga lo nuevo): la
 * pantalla se queda en la foto de antes mientras tanto, hasta 1,5 s. Sin soporte o con movimiento reducido, el cambio
 * es instantáneo y nada se rompe. Termina cuando termina el cambio, y si el cambio falla, falla.
 */
export async function conTransicion(cambio: () => unknown, direccion?: Direccion): Promise<void> {
  const raiz = document.documentElement;
  if (typeof document.startViewTransition !== "function" || sinMovimiento()) {
    await cambio();
    return;
  }
  if (direccion) raiz.dataset.direccion = direccion;
  else delete raiz.dataset.direccion;
  let terminado: Promise<void> = Promise.resolve();
  const transicion = document.startViewTransition(() => {
    terminado = (async () => {
      await flushSync(cambio);
      await pintado();
    })();
    return Promise.race([terminado.catch(() => undefined), new Promise<void>((listo) => setTimeout(listo, ESPERA_MAXIMA_MS))]);
  });
  void transicion.finished
    .catch(() => undefined)
    .finally(() => {
      if (raiz.dataset.direccion === direccion) delete raiz.dataset.direccion;
    });
  // Una transición que el navegador salta no es un error; un cambio que falla se propaga a quien lo pidió.
  await transicion.updateCallbackDone.catch(() => undefined);
  await terminado;
}

/** Un nombre de transición válido en CSS a partir de un id (los de React y los UUID traen caracteres que no lo son). */
export const nombreDeTransicion = (prefijo: string, id: string) => `${prefijo}-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;

/**
 * Cada elemento con nombre es una foto aparte: con cientos de filas, tomarlas congela la pantalla. Por eso una fila
 * (y lo que lleva dentro con `data-transicion`) tiene nombre solo mientras está en pantalla o cerca: un observador
 * compartido se lo pone y se lo quita.
 */
let observador: IntersectionObserver | undefined;
const nombrar = (elemento: HTMLElement, visible: boolean) => {
  elemento.style.setProperty("view-transition-name", visible ? (elemento.dataset.transicionPropia ?? "none") : "none");
  elemento.querySelectorAll<HTMLElement>("[data-transicion]").forEach((interior) => interior.style.setProperty("view-transition-name", visible ? interior.dataset.transicion! : "none"));
};
const observar = () =>
  (observador ??= new IntersectionObserver((entradas) => entradas.forEach((e) => nombrar(e.target as HTMLElement, e.isIntersecting)), { rootMargin: "200px 0px" }));

/** Ref para un elemento de una lista larga: lleva `nombre` (y sus `data-transicion`) solo mientras se ve. */
export function useNombreEnPantalla<T extends HTMLElement>(nombre: string | undefined): RefCallback<T> {
  return useCallback(
    (elemento: T | null) => {
      if (!elemento || typeof IntersectionObserver === "undefined") return;
      if (nombre) elemento.dataset.transicionPropia = nombre;
      observar().observe(elemento);
      return () => {
        observar().unobserve(elemento);
        nombrar(elemento, false);
      };
    },
    [nombre],
  );
}

/**
 * Solo lo nuevo entra animado: lo que ya estaba la primera vez que la lista se mostró no se anima otra vez, ni al
 * volver a la pantalla. Mientras la lista no ha llegado (`undefined`), nada cuenta como nuevo.
 */
export function useLoNuevo(ids: readonly string[] | undefined): (id: string) => boolean {
  const conocidos = useRef<Set<string>>(null);
  if (ids && !conocidos.current) conocidos.current = new Set(ids);
  return (id) => conocidos.current !== null && !conocidos.current.has(id);
}

/**
 * El orden de una lista con lo nuevo arriba (DESIGN.md, «Lo recién creado entra arriba»): primero lo que esta persona
 * acaba de crear, del más reciente al más viejo (`propios`), después lo nuevo que llegó de otros y al final lo que ya
 * estaba. Así lo suyo no queda debajo de lo que otra persona creó al mismo tiempo.
 */
export function primeroLoNuevo<T extends { id: string }>(lista: readonly T[], esNuevo: (id: string) => boolean, propios: readonly string[]): T[] {
  const nuevos = lista.filter((x) => esNuevo(x.id));
  const puesto = (x: T) => (propios.includes(x.id) ? propios.indexOf(x.id) : propios.length);
  return [...nuevos.sort((a, b) => puesto(a) - puesto(b)), ...lista.filter((x) => !esNuevo(x.id))];
}

/**
 * Una capa a pantalla completa que sube al abrirse y baja al cerrarse (el croquis, la firma): `salir` la deja
 * 200 ms bajando y después llama a `cerrar`. Con movimiento reducido, cierra en el acto.
 */
export function useCapaQueSale(cerrar: () => void): readonly [saliendo: boolean, salir: () => void] {
  const [saliendo, setSaliendo] = useState(false);
  const vigente = useRef(cerrar);
  vigente.current = cerrar;
  const salir = useCallback(() => {
    if (sinMovimiento()) return vigente.current();
    setSaliendo(true);
    setTimeout(() => vigente.current(), 200);
  }, []);
  return [saliendo, salir] as const;
}
