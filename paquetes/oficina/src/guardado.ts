import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { ErrorApi, ErrorDeRed } from "@teins/protocolo";
import { useConexion } from "@teins/ui";
import type { Borrador } from "./borrador";
import { escribirPreferencia, llaveDePreferencia, PersonaDeOficina } from "./preferencias";

/*
  El guardado automático del informe y la cotización (prototipos/usabilidad-oficina, «Guardado automático»): se guarda
  1,5 s después de dejar de escribir y al salir de la pantalla, con las mismas operaciones y la misma revisión de
  versión de siempre. Mientras no se guarda, lo escrito queda también en este equipo: si se cae la conexión o se cierra
  la pestaña, vuelve al abrir el documento. Si otra persona guardó antes, no se pisa nada: se pregunta.
*/

export type EstadoGuardado = "guardado" | "pendiente" | "guardando" | "sin-conexion" | "conflicto" | "error";

export const ESPERA_AL_ESCRIBIR = 1500;
/** Sin respuesta del servidor aunque el navegador diga que hay red, o con la sesión vencida: se vuelve a intentar cada tanto. */
const REINTENTO_SIN_RED = 10_000;

export function estadoTrasError(error: unknown, enLinea: boolean): EstadoGuardado {
  if (error instanceof ErrorApi && error.codigo === "conflicto_de_version") return "conflicto";
  // La sesión venció: la persona ingresa de nuevo encima (rutas.tsx) y se vuelve a intentar solo.
  if (error instanceof ErrorApi && error.codigo === "no_autenticado") return "pendiente";
  if (!enLinea || error instanceof ErrorDeRed) return "sin-conexion";
  return "error";
}

export interface Copia<B> {
  version: number;
  borrador: B;
}

/**
 * Qué hacer con lo que quedó escrito en este equipo: si se basa en la versión que hay, se recupera y se guarda; si otra
 * persona guardó después, se pregunta. Una copia de una versión que el servidor no tiene no sirve.
 */
export function copiaParaRestaurar<B>(copia: Copia<B> | null, version: number): { accion: "restaurar" | "preguntar"; borrador: B } | null {
  if (!copia || copia.version > version) return null;
  return { accion: copia.version === version ? "restaurar" : "preguntar", borrador: copia.borrador };
}

/**
 * Qué pasa con la copia en este equipo tras un cambio: se escribe mientras haya algo sin guardar, también con un
 * conflicto (si se cierra la pestaña antes de elegir, vuelve al abrir y se pregunta), y se borra cuando todo quedó
 * guardado. Con el conflicto de lo escrito antes, la copia conserva eso hasta que se elija; mientras se guarda, espera.
 */
export function copiaTrasCambio(estado: EstadoGuardado, cambios: boolean, conflictoDeAntes: boolean): "escribir" | "borrar" | "dejar" {
  if (estado === "guardando") return "dejar";
  if (estado === "conflicto") return cambios && !conflictoDeAntes ? "escribir" : "dejar";
  return cambios ? "escribir" : "borrar";
}

function leerCopia<B>(llave: string): Copia<B> | null {
  try {
    const crudo = localStorage.getItem(llave);
    const c = crudo ? (JSON.parse(crudo) as Partial<Copia<B>>) : null;
    return c && typeof c.version === "number" && c.borrador !== undefined ? { version: c.version, borrador: c.borrador } : null;
  } catch {
    return null;
  }
}
function borrarCopia(llave: string) {
  try {
    localStorage.removeItem(llave);
  } catch {
    // Sin almacenamiento: no había copia.
  }
}
const almacen = () => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

interface Opciones<B> {
  /** Qué documento es, para su copia en el equipo: "informe:<id>". */
  documento: string;
  borrador: Borrador<B>;
  /** Una cotización con campos por corregir no se guarda hasta que se corrijan. */
  puedeGuardar?: boolean;
  /** Guarda sobre `version` y devuelve la versión nueva. */
  guardar: (version: number, contenido: B) => Promise<number>;
  /** Vuelve a leer el documento del servidor. */
  recargar: () => void;
}

export function useGuardadoAutomatico<B>({ documento, borrador, puedeGuardar = true, guardar, recargar }: Opciones<B>) {
  const enLinea = useConexion();
  const persona = useContext(PersonaDeOficina);
  const llave = llaveDePreferencia(persona, `copia-${documento}`);
  // Lo escrito en este equipo que quedó de antes (se cerró la pestaña, se cayó la conexión).
  const [deAntes] = useState(() => copiaParaRestaurar(leerCopia<B>(llave), borrador.version));
  const [estado, setEstado] = useState<EstadoGuardado>(deAntes?.accion === "preguntar" ? "conflicto" : "guardado");
  const [error, setError] = useState<unknown>(null);
  const [ronda, setRonda] = useState(0);
  // La versión que guardó otra persona, para guardar la propia encima si se elige.
  const versionDeOtro = useRef<number | null>(deAntes?.accion === "preguntar" ? borrador.version : null);
  // El conflicto viene de lo escrito antes en este equipo (no de un guardado de ahora).
  const [conflictoDeAntes, setConflictoDeAntes] = useState(deAntes?.accion === "preguntar");
  const cola = useRef<Promise<unknown>>(Promise.resolve());
  // Lo que no se pudo guardar: no se reintenta igual hasta que cambie (o, sin conexión, cada tanto).
  const fallido = useRef<string | null>(null);
  const vigente = useRef({ borrador, guardar, puedeGuardar, enLinea, estado });
  vigente.current = { borrador, guardar, puedeGuardar, enLinea, estado };
  const contenido = JSON.stringify(borrador.borrador);

  /** Guarda lo pendiente, uno detrás de otro: cada guardado va sobre la versión que dejó el anterior. */
  const ejecutar = useCallback((): Promise<number> => {
    const paso = cola.current.catch(() => undefined).then(async () => {
      const v = vigente.current;
      const { version, borrador: enviado } = v.borrador.actual();
      if (!v.borrador.hayCambios() || !v.puedeGuardar || v.estado === "conflicto") return version;
      setEstado("guardando");
      try {
        const nueva = await v.guardar(version, enviado);
        v.borrador.guardado(nueva, enviado);
        if (!v.borrador.hayCambios()) borrarCopia(llave);
        fallido.current = null;
        setError(null);
        setEstado(v.borrador.hayCambios() ? "pendiente" : "guardado");
        return nueva;
      } catch (e) {
        fallido.current = JSON.stringify(enviado);
        if (e instanceof ErrorApi && e.codigo === "conflicto_de_version") versionDeOtro.current = e.problema.versionActual ?? null;
        setError(e);
        setEstado(estadoTrasError(e, navigator.onLine));
        throw e;
      } finally {
        setRonda((r) => r + 1);
      }
    });
    cola.current = paso;
    return paso;
  }, [llave]);

  // Lo de antes, si se basa en lo que hay, vuelve solo y se guarda; si no, ya se está preguntando (estado "conflicto").
  useEffect(() => {
    if (deAntes?.accion === "restaurar") borrador.setBorrador(deAntes.borrador);
    // Solo al abrir el documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada cambio: la copia en el equipo y, al dejar de escribir, el guardado.
  useEffect(() => {
    const v = vigente.current;
    const copia = copiaTrasCambio(v.estado, v.borrador.hayCambios(), conflictoDeAntes);
    if (copia === "escribir") escribirPreferencia(almacen(), llave, v.borrador.actual());
    if (copia === "borrar") borrarCopia(llave);
    if (v.estado === "conflicto" || v.estado === "guardando") return;
    if (!v.borrador.hayCambios()) {
      if (v.estado !== "guardado") setEstado("guardado");
      return;
    }
    if (!enLinea) return setEstado("sin-conexion");
    const repetido = fallido.current === contenido;
    if (repetido && v.estado === "error") return;
    if (!(repetido && v.estado === "sin-conexion")) setEstado("pendiente");
    // Lo que ya falló igual se reintenta cada tanto, no a cada momento.
    if (!puedeGuardar) return;
    const t = setTimeout(() => void ejecutar().catch(() => undefined), repetido ? REINTENTO_SIN_RED : ESPERA_AL_ESCRIBIR);
    return () => clearTimeout(t);
  }, [contenido, enLinea, puedeGuardar, ronda, llave, ejecutar, conflictoDeAntes]);

  // Al salir de la pantalla, lo pendiente se guarda sin esperar.
  useEffect(
    () => () => {
      const v = vigente.current;
      if (v.borrador.hayCambios() && v.puedeGuardar && v.enLinea && v.estado !== "conflicto") void ejecutar().catch(() => undefined);
    },
    [ejecutar],
  );

  return {
    estado,
    error,
    conflictoDeAntes,
    /** Para publicar: guarda lo pendiente ya y devuelve la versión que queda. */
    guardarAhora: () => ejecutar(),
    reintentar: () => {
      fallido.current = null;
      setEstado("pendiente");
      void ejecutar().catch(() => undefined);
    },
    /** Lo de esta persona va encima de lo que guardó la otra. */
    guardarLaMia: () => {
      const otra = versionDeOtro.current;
      if (conflictoDeAntes && deAntes) borrador.setBorrador(deAntes.borrador);
      setConflictoDeAntes(false);
      if (otra !== null) borrador.rebasar(otra);
      versionDeOtro.current = null;
      setEstado("pendiente");
      vigente.current.estado = "pendiente";
      setRonda((r) => r + 1);
    },
    /** Lo de esta persona se descarta y se carga lo guardado. */
    cargarLaGuardada: () => {
      borrarCopia(llave);
      versionDeOtro.current = null;
      setConflictoDeAntes(false);
      borrador.descartar();
      setEstado("guardado");
      setError(null);
      recargar();
    },
  };
}
